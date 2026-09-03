"""Manual smoke check AFTER copying the QA fixture with the actual UI button.

Pastes only into a new hidden scratch presentation, never a user's slide.
Does not copy or clear clipboard contents. Run explicitly, not in CI discovery.
"""
import argparse
import json
from pathlib import Path

import pythoncom
import win32com.client


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--expect', choices=['native', 'picture'], required=True)
    args = parser.parse_args()
    pythoncom.CoInitialize()
    presentation = None
    try:
        app = win32com.client.GetActiveObject('PowerPoint.Application')
        existing = app.Presentations.Count
        presentation = app.Presentations.Add(False)
        slide = presentation.Slides.Add(1, 12)
        pasted = slide.Shapes.Paste()
        types = []

        def inspect(shape):
            if shape.Type == 6:
                for index in range(1, shape.GroupItems.Count + 1):
                    inspect(shape.GroupItems.Item(index))
            else:
                types.append(shape.Type)

        for index in range(1, pasted.Count + 1):
            inspect(pasted.Item(index))
        if args.expect == 'native':
            assert len(types) >= 4 and all(kind not in (11, 13) for kind in types), types
        else:
            assert types == [13], types
        output = Path(__file__).resolve().parents[1] / '.codex-tmp' / 'clipboard-paste-qa'
        output.mkdir(parents=True, exist_ok=True)
        slide.Export(str(output / f'{args.expect}.png'), 'PNG', 1200, 900)
        print(json.dumps({'pasted': len(types), 'types': types, 'expect': args.expect,
                          'existingPresentationsUntouched': existing}, ensure_ascii=False))
    finally:
        if presentation is not None:
            presentation.Saved = True
            presentation.Close()
        pythoncom.CoUninitialize()


if __name__ == '__main__':
    main()
