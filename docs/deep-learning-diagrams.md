# Deep learning architecture diagrams

Use **架構圖** in the top toolbar to build editable research figures. The top **立體神經網路方塊** designer creates actual three-face cuboids. Drag **水平視角** (−60° to 60°) and **俯視角** (0° to 55°); set width, height, depth, number of layers, spacing, color and labels. The preview updates immediately. **加入目前圖頁** inserts the stack as native polygon and text layers. Select a face, reopen **架構圖**, and use **更新選取方塊** to change the whole stack later. **以這個視角建立 CNN 範例** creates a new six-stage CNN page.

The gallery contains five starters: attention and multi-branch fusion, planar CNN feature maps, conditional diffusion with U-Net, graph and tensor diffusion, and material-adapted monocular depth. The depth starter uses a 1800 × 950 canvas with patch embeddings, a pre-norm Transformer, DPT reassembly/fusion, a graphical candidate residual adapter and training-only depth supervision. Each template creates a **new page**.

The gallery offers fourteen reusable pieces with native vector thumbnails: patch embedding, token sequence, Transformer encoder, Q/K/V attention, DPT multi-scale decoder, convolution/norm/activation, upsampling, gated residual adapter, feature-map stack, channel attention, U-Net, tensor grid, merge operator and diffusion step. Search by topic, click a piece, then edit its native layers. Inserting a piece is one Undo step. All fourteen IDs are discoverable through `list_diagram_components` and available to `create_diagram_component` in MCP.

Diagram groups use `layerGroup.paintMode = "solid"`: each surface's fill and outline are painted together in depth order. The editor, SVG and native PPT export use the same ordering, so back edges cannot bleed through front faces. Existing 3D groups with `diagram3d` metadata are recognized automatically. Ordinary tracing layers retain their fill/outline behavior.

The Transformer diagram follows the pre-norm structure in [ViT](https://research.google/pubs/an-image-is-worth-16x16-words-transformers-for-image-recognition-at-scale/); the decoder summarizes reassembly and multi-scale fusion from [DPT](https://github.com/isl-org/DPT). Layer taps, dimensions and head variants depend on the chosen implementation. The residual adapter is a candidate design, not a published or validated method. It consumes the decoder's spatial feature F, resizes to the output resolution, predicts a sigmoid gate and a signed residual, then adds their product to the baseline depth. Displayed grids illustrate tensors rather than experimental predictions.

## Make a figure that explains the model

1. Choose the closest template and replace its sample labels with the model's actual input, tensor dimensions, operations, and output. Templates are **layout starters**, not claims that a particular model has been implemented.
2. Add a component only when it represents a real branch or operation. Connect it with Skechu arrows. For a CNN, distinguish convolution, pooling, and classifier stages; show feature-map size and channel count where useful.
3. For attention or multi-branch models, label the merge operation (`+`, multiplication, or concatenation) and show which branch feeds it. For U-Net and diffusion, distinguish the encoder/decoder skip connections from time and conditioning inputs.
4. Keep training-only inputs, targets, and losses separate from the inference path. Mark optional modules as optional. This is especially important when a figure appears in a research proposal.
5. Save the `.skc` project for further editing. Use SVG for publications or the native PPTX export for an editable slide deck. Direct copy into desktop PowerPoint requires the Windows companion.

All template shapes, arrows, and text use the existing Skechu item types; no reference bitmap is pasted into the page. The sample figures are original layouts inspired by common scientific diagram conventions. Check mathematical notation, dataset labels, and architecture claims against your own work before submitting a figure.

The cuboid generator lives in [`app/diagram-3d.js`](../app/diagram-3d.js). It also backs the opt-in `create_diagram_block_3d` browser API and MCP command. The older layouts live in [`app/deep-learning-diagrams.js`](../app/deep-learning-diagrams.js). The built-in canvas size is 1200 × 675. The returned items use supported native types. Run `node --test tests/test-deep-learning-diagrams.cjs tests/test-diagram-3d.cjs` after changes.
