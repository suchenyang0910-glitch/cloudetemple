from pathlib import Path
from subprocess import run
from tempfile import TemporaryDirectory

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "evidence"
OUT = EVIDENCE / "hd2d"
BASELINE = EVIDENCE / "walk-30s.mp4"
CURRENT = EVIDENCE / "walk-hd2d-30s.mp4"
FRAMES = {
    "courtyard-walk": (2.0, 2.0),
    "hall-front": (9.0, 9.0),
    "incense": (17.0, 11.0),
    "bow-mid": (22.5, 18.0),
}


def capture(video: Path, seconds: float, output: Path) -> None:
    result = run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", str(seconds), "-i", str(video), "-frames:v", "1", str(output)])
    if result.returncode:
        raise RuntimeError(f"ffmpeg failed for {video.name} at {seconds}s")


def main() -> None:
    if not BASELINE.is_file() or not CURRENT.is_file():
        raise FileNotFoundError("both 30-second recordings are required")
    OUT.mkdir(parents=True, exist_ok=True)
    font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 22)
    with TemporaryDirectory(prefix="chuamay-hd2d-") as folder:
        temp = Path(folder)
        for name, (old_time, new_time) in FRAMES.items():
            old_path, new_path = temp / f"{name}-old.png", temp / f"{name}-new.png"
            capture(BASELINE, old_time, old_path)
            capture(CURRENT, new_time, new_path)
            old, new = Image.open(old_path).convert("RGB"), Image.open(new_path).convert("RGB")
            height = max(old.height, new.height)
            canvas = Image.new("RGB", (old.width + new.width, height + 42), "#e8e0d1")
            canvas.paste(old, (0, 42)); canvas.paste(new, (old.width, 42))
            draw = ImageDraw.Draw(canvas)
            draw.text((12, 9), "Round 1 - procedural 3D", fill="#3d3933", font=font)
            draw.text((old.width + 12, 9), "Round 2 - HD-2D", fill="#3d3933", font=font)
            canvas.save(OUT / f"comparison-{name}.png", optimize=True)


if __name__ == "__main__":
    main()
