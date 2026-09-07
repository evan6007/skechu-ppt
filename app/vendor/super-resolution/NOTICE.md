# Browser super-resolution assets

These third-party files are not covered solely by Skechu-PPT's MIT license.

## Real-ESRGAN AnimeVideo-v3

- Source: <https://github.com/xinntao/Real-ESRGAN>
- Model: <https://github.com/xinntao/Real-ESRGAN/blob/master/docs/anime_video_model.md>
- Original checkpoint: <https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-animevideov3.pth>
- License: BSD-3-Clause, retained in `REALESRGAN-LICENSE.txt`.
- Original SHA-256: `b8a8376811077954d82ca3fcf476f1ac3da3e8a68a4f4d71363008000a18b75d`.
- Converted weights: `anime-v3-f32.bin`, 2,485,696 bytes.
- Converted SHA-256: `b66812bd06d6f5c803c1236b738f56ffc55ba15c7d8881187bb0a3d0a61a1709`.

Conversion by Skechu-PPT changes storage layout only (OIHW to HWIO, final pixel-shuffle channel ordering). The 18 convolutions, PReLU, 4x shuffle and nearest-neighbour residual are unchanged. Float32 weights are neither quantized nor retrained. This is an integration of an existing model, not a newly trained or invented model. Reproduce with `scripts/convert_anime_sr.py`; PyTorch is needed only by developers for conversion, never by website users.

## TensorFlow.js 4.22.0

- Source: <https://github.com/tensorflow/tfjs/tree/tfjs-v4.22.0>
- Distribution: `@tensorflow/tfjs@4.22.0`, `dist/tf.min.js`, renamed `tf-4.22.0.min.js` without modifying its contents.
- License: Apache-2.0, retained in `TENSORFLOWJS-LICENSE.txt` and the distribution's embedded notices.
- Size: 1,469,843 bytes; SHA-256: `300dfae273d20b4046f46a06d735688f03675a807561e9bcb5f664eb2f3d2831`.

Model, manifest and runtime total 3,958,696 bytes, excluding these small license/notice documents. They are served from the same static site, loaded only after the user starts AI enhancement. Neither third-party inference servers nor external model CDNs receive the user's image.
