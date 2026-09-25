# Deep learning architecture diagrams

Use **架構圖** in the top toolbar to build editable research figures. The top **立體神經網路方塊** designer creates actual three-face cuboids. Drag **水平視角** (−60° to 60°) and **俯視角** (0° to 55°); set width, height, depth, number of layers, spacing, color and labels. The preview updates immediately. **加入目前圖頁** inserts the stack as native polygon and text layers. Select a face, reopen **架構圖**, and use **更新選取方塊** to change the whole stack later. **以這個視角建立 CNN 範例** creates a new six-stage CNN page.

The gallery also contains five older flat-layout starters: attention and multi-branch fusion, planar CNN feature maps, conditional diffusion with U-Net, graph and tensor diffusion, and material-aware monocular depth. Each template creates a **new page** so the current drawing is preserved.

The same gallery offers six reusable flat pieces for the current page: a planar feature-map stack, attention block, U-Net with skip connections, colored tensor grid, merge operator, and single diffusion step. Search by topic, click a piece, then drag or edit its native layers. Related layers appear in a named group in the layer panel. Inserting a piece is one Undo step.

## Make a figure that explains the model

1. Choose the closest template and replace its sample labels with the model's actual input, tensor dimensions, operations, and output. Templates are **layout starters**, not claims that a particular model has been implemented.
2. Add a component only when it represents a real branch or operation. Connect it with Skechu arrows. For a CNN, distinguish convolution, pooling, and classifier stages; show feature-map size and channel count where useful.
3. For attention or multi-branch models, label the merge operation (`+`, multiplication, or concatenation) and show which branch feeds it. For U-Net and diffusion, distinguish the encoder/decoder skip connections from time and conditioning inputs.
4. Keep training-only inputs, targets, and losses separate from the inference path. Mark optional modules as optional. This is especially important when a figure appears in a research proposal.
5. Save the `.skc` project for further editing. Use SVG for publications or the native PPTX export for an editable slide deck. Direct copy into desktop PowerPoint requires the Windows companion.

All template shapes, arrows, and text use the existing Skechu item types; no reference bitmap is pasted into the page. The sample figures are original layouts inspired by common scientific diagram conventions. Check mathematical notation, dataset labels, and architecture claims against your own work before submitting a figure.

The cuboid generator lives in [`app/diagram-3d.js`](../app/diagram-3d.js). It also backs the opt-in `create_diagram_block_3d` browser API and MCP command. The older layouts live in [`app/deep-learning-diagrams.js`](../app/deep-learning-diagrams.js). The built-in canvas size is 1200 × 675. The returned items use supported native types. Run `node --test tests/test-deep-learning-diagrams.cjs tests/test-diagram-3d.cjs` after changes.
