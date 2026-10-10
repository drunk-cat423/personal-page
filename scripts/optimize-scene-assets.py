"""Build web-sized scene assets from the approved originals (requires Pillow)."""
from pathlib import Path
import argparse
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/illustrations'
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=SOURCE / 'web')
parser.add_argument('--only', choices=['meadow', 'coast'])
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
report = {}
for name in ([args.only] if args.only else ['meadow', 'coast']):
    frames, durations = [], []
    with Image.open(SOURCE / f'cel-six/{name}-six-wind.webp') as original:
        for i in range(original.n_frames):
            original.seek(i)
            original.load()
            frames.append(original.convert('RGBA').copy())
            durations.append(original.info['duration'])
    report[name] = {'original_bytes': (SOURCE / f'cel-six/{name}-six-wind.webp').stat().st_size,
                    'source_frames': len(frames), 'duration_ms': sum(durations), 'variants': []}
    for width, quality in [(960, 70), (640, 68)]:
        size = (width, round(frames[0].height * width / frames[0].width))
        resized = [frame.resize(size, Image.Resampling.LANCZOS) for frame in frames]
        # Six-bit alpha limits rendered edge error to about 2/255 on paper,
        # while removing high-frequency transparency noise from every frame.
        alpha_levels = [round(round(value * 63 / 255) * 255 / 63) for value in range(256)]
        for frame in resized:
            frame.putalpha(frame.getchannel('A').point(alpha_levels))
        destination = args.output / f'{name}-wind-{width}.webp'
        resized[0].save(destination, format='WEBP', save_all=True, append_images=resized[1:],
                        duration=durations, loop=0, quality=quality, method=4,
                        background=(0, 0, 0, 0))
        with Image.open(destination) as result:
            actual_durations, has_transparency = [], False
            for i in range(result.n_frames):
                result.seek(i)
                result.load()
                actual_durations.append(result.info['duration'])
                has_transparency |= result.convert('RGBA').getextrema()[3][0] == 0
            assert result.size == size and sum(actual_durations) == sum(durations)
            assert result.info['loop'] == 0 and has_transparency
            entry = {'path': destination.name, 'bytes': destination.stat().st_size,
                     'width': width, 'quality': quality, 'frames': result.n_frames,
                     'duration_ms': sum(actual_durations), 'transparent': has_transparency}
            report[name]['variants'].append(entry)
            print(json.dumps(entry), flush=True)
        with Image.open(SOURCE / f'{name}-static.png') as poster:
            poster_width = 1280 if width == 960 else width
            poster = poster.convert('RGBA').resize((poster_width, round(poster.height * poster_width / poster.width)), Image.Resampling.LANCZOS)
            poster_path = args.output / f'{name}-still-{poster_width}.webp'
            poster.save(poster_path, format='WEBP', quality=82, method=6)
            print(json.dumps({'path': poster_path.name, 'bytes': poster_path.stat().st_size}), flush=True)
    del frames
(args.output / 'optimization.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
