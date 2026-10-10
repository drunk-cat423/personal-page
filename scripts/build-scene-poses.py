"""Encode the six registered poses for browser-side blending (requires Pillow)."""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/illustrations/cel-six'
OUTPUT = ROOT / 'assets/illustrations/web/poses'
ORDER = {'meadow': 'adcbef', 'coast': 'acbdef'}
report = {}
for scene, order in ORDER.items():
    report[scene] = {'source_sequence': list(order), 'quality': 96, 'alpha_quantization': False,
                     'cycle_ms': 6000, 'hold_ms': 500, 'dissolve_ms': 500, 'variants': {}}
    for width in [1280, 960]:
        directory = OUTPUT / scene / str(width)
        directory.mkdir(parents=True, exist_ok=True)
        entries = []
        for index, source_letter in enumerate(order):
            source = SOURCE / f'{scene}-aligned-{source_letter}.png'
            if not source.exists():
                raise FileNotFoundError(f'{source}: run node scripts/build-six-pose-wind.mjs --prepare-only first')
            with Image.open(source) as image:
                image = image.convert('RGBA')
                image = image.resize((width, round(image.height * width / image.width)), Image.Resampling.LANCZOS)
                destination = directory / f'{chr(97+index)}.webp'
                image.save(destination, format='WEBP', quality=96, method=6)
                with Image.open(destination) as encoded:
                    assert encoded.n_frames == 1 and encoded.size == image.size
                    assert encoded.convert('RGBA').getchannel('A').tobytes() == image.getchannel('A').tobytes()
            entries.append({'pose': chr(97+index), 'source_pose': source_letter,
                            'file': destination.relative_to(ROOT).as_posix(),
                            'bytes': destination.stat().st_size,
                            'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
                            'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest()})
        assert len({entry['sha256'] for entry in entries}) == 6
        report[scene]['variants'][str(width)] = {'total_bytes': sum(e['bytes'] for e in entries), 'files': entries}
        print(json.dumps({'scene': scene, 'width': width, 'total_bytes': sum(e['bytes'] for e in entries)}), flush=True)
(OUTPUT / 'manifest.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
