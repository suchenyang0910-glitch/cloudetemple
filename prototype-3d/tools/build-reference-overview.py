from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "reference-pack"
OUTPUT = PACK / "reference-overview.png"
ITEMS = [
    ("Adult visitor turnaround", PACK / "visitor-bun-light-turnaround.png"),
    ("Hall layout - Buddha removed", PACK / "hall-front-day-no-buddha.png"),
    ("Incense burner", PACK / "objects" / "incense-burner.png"),
    ("Altar table", PACK / "objects" / "altar-table.png"),
    ("Meditation cushion", PACK / "objects" / "meditation-cushion.png"),
    ("Column and stone base", PACK / "objects" / "column-stone-base.png"),
    ("Lotus oil lamp", PACK / "objects" / "lotus-oil-lamp.png"),
    ("Cloud-pattern bracket", PACK / "objects" / "cloud-bracket.png"),
]


def main() -> None:
    missing = [str(path) for _, path in ITEMS if not path.is_file()]
    if missing:
        raise FileNotFoundError("missing reference files: " + ", ".join(missing))

    canvas = Image.new("RGB", (1800, 1280), "#eee7d8")
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 28)
    title_font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 38)
    draw.text((56, 28), "Cloud Temple - Tripo Private reference pack", fill="#4a3a2b", font=title_font)
    draw.text((56, 78), "Hall layout contains no Buddha details; objects are uploaded one at a time.", fill="#76624f", font=font)

    for index, (label, path) in enumerate(ITEMS):
        column = index % 4
        row = index // 4
        x = 45 + column * 438
        y = 135 + row * 560
        frame = (x, y, x + 410, y + 500)
        draw.rounded_rectangle(frame, radius=18, fill="#faf8f2", outline="#c9b99f", width=3)
        with Image.open(path) as source:
            image = source.convert("RGB")
            image.thumbnail((370, 420), Image.Resampling.LANCZOS)
            image_x = x + (410 - image.width) // 2
            image_y = y + 20 + (420 - image.height) // 2
            canvas.paste(image, (image_x, image_y))
        draw.text((x + 20, y + 454), label, fill="#4a3a2b", font=font)

    canvas.save(OUTPUT, optimize=True)


if __name__ == "__main__":
    main()
