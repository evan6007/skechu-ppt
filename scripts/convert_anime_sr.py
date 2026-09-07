"""Convert official Real-ESRGAN AnimeVideo-v3 weights to a small TF.js layout.

No TensorFlow/ONNX converter is needed at runtime. Architecture and weights are
from Xintao Wang's BSD-3-Clause Real-ESRGAN (see bundled license). This is a
layout conversion, not retraining or a new super-resolution model.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import torch
from torch import nn

SOURCE_SHA256 = "b8a8376811077954d82ca3fcf476f1ac3da3e8a68a4f4d71363008000a18b75d"


class ReferenceNetwork(nn.Module):
    def __init__(self):
        super().__init__()
        self.body = nn.ModuleList([nn.Conv2d(3, 64, 3, padding=1), nn.PReLU(64)])
        for _ in range(16):
            self.body.extend([nn.Conv2d(64, 64, 3, padding=1), nn.PReLU(64)])
        self.body.append(nn.Conv2d(64, 48, 3, padding=1))

    def forward(self, value):
        original = value
        for layer in self.body:
            value = layer(value)
        return nn.functional.pixel_shuffle(value, 4) + nn.functional.interpolate(original, scale_factor=4, mode="nearest")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("checkpoint", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--fixture", type=Path)
    args = parser.parse_args()
    if hashlib.sha256(args.checkpoint.read_bytes()).hexdigest() != SOURCE_SHA256:
        raise ValueError("Not the verified official AnimeVideo-v3 checkpoint")
    state = torch.load(args.checkpoint, map_location="cpu", weights_only=True)["params"]
    reference = ReferenceNetwork().eval()
    reference.load_state_dict(state, strict=True)
    blocks, layers, offset = [], [], 0
    # PixelShuffle uses [channel, row, column], TF depthToSpace uses
    # [row, column, channel]. Reorder the last convolution's output channels.
    permutation = [c * 16 + subpixel for subpixel in range(16) for c in range(3)]

    def store(array):
        nonlocal offset
        data = np.ascontiguousarray(array, dtype="<f4")
        result = {"offset": offset, "shape": list(data.shape), "length": data.size}
        blocks.append(data.tobytes())
        offset += data.size
        return result

    for index in range(18):
        weight = state[f"body.{index * 2}.weight"].numpy()
        bias = state[f"body.{index * 2}.bias"].numpy()
        if index == 17:
            weight, bias = weight[permutation], bias[permutation]
        layer = {"weight": store(weight.transpose(2, 3, 1, 0)), "bias": store(bias)}
        if index < 17:
            layer["alpha"] = store(state[f"body.{index * 2 + 1}.weight"].numpy())
        layers.append(layer)
    data = b"".join(blocks)
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "anime-v3-f32.bin").write_bytes(data)
    manifest = {"version": 1, "name": "Real-ESRGAN AnimeVideo-v3", "scale": 4,
                "sourceSha256": SOURCE_SHA256, "weightsSha256": hashlib.sha256(data).hexdigest(),
                "weightsBytes": len(data), "layers": layers}
    (args.output / "anime-v3.json").write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf-8")
    if args.fixture:
        torch.set_num_threads(2)
        rng = np.random.default_rng(8601)
        rgb = rng.integers(0, 256, (19, 23, 3), dtype=np.uint8)
        with torch.no_grad():
            result = reference(torch.from_numpy(rgb.transpose(2, 0, 1).copy()).float()[None] / 255)[0].permute(1, 2, 0).numpy()
        args.fixture.parent.mkdir(parents=True, exist_ok=True)
        args.fixture.write_text(json.dumps({"width": 23, "height": 19,
            "rgb": rgb.reshape(-1).tolist(), "expected": result.reshape(-1).tolist()}, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({k: manifest[k] for k in ["name", "weightsBytes", "weightsSha256"]}))


if __name__ == "__main__":
    main()
