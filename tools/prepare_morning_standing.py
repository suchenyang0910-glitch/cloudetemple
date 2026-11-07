from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import minimum_filter


VISITORS = ("short-light", "curly-dark", "curly-medium", "bun-light", "bun-dark", "ponytail-medium")


parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)

for visitor in VISITORS:
    source = args.source / f"visitor-{visitor}.png"
    image = Image.open(source).convert("RGBA")
    data = np.asarray(image).copy()
    distance = 255 - data[:, :, :3].min(axis=2)
    alpha = np.clip((distance.astype(float) - 5) * 255 / 20, 0, 255).astype("uint8")
    alpha[alpha < 12] = 0
    alpha = minimum_filter(alpha, size=5)
    data[:, :, 3] = np.minimum(data[:, :, 3], alpha)
    data[data[:, :, 3] == 0, :3] = 0
    result = Image.fromarray(data).resize((600, 900), Image.Resampling.LANCZOS)
    target = args.output / f"visitor-{visitor}-stand.webp"
    result.save(target, "WEBP", quality=84, method=6, exact=True)
    assert target.stat().st_size < 150_000, (target.name, target.stat().st_size)

print({"passed": True, "files": len(VISITORS)})
