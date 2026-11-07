from __future__ import annotations

import hashlib
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "reference-pack"
SOURCE = PACK / "source"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    turnaround = Image.open(SOURCE / "approved-character-turnaround.png").convert("RGB")
    width, height = turnaround.size
    if (width, height) != (1774, 887):
        raise ValueError(f"unexpected turnaround size: {(width, height)}")

    # The approved woman occupies the right half in consistent front/side/back poses.
    woman = turnaround.crop((width // 2, 0, width, height))
    woman.save(PACK / "visitor-bun-light-turnaround.png", optimize=True)
    third = woman.width // 3
    crops = {
        "front": (0, 0, third, height),
        "side": (third, 0, third * 2, height),
        "back": (third * 2, 0, woman.width, height),
    }
    for name, box in crops.items():
        woman.crop(box).save(PACK / f"visitor-bun-light-{name}.png", optimize=True)

    files = sorted(path for path in PACK.rglob("*") if path.is_file() and path.name != "SHA256SUMS.txt")
    (PACK / "SHA256SUMS.txt").write_text(
        "".join(f"{sha256(path)}  {path.relative_to(PACK).as_posix()}\n" for path in files),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
