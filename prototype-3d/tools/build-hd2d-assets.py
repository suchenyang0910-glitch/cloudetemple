from pathlib import Path

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
OUT = ROOT / "assets"
SOURCE = OUT / "source"
SPRITES = OUT / "visitor"
SCENE = OUT / "scene"
PACK = ROOT / "reference-pack"
APP_ASSETS = REPO / "assets" / "processed-v1" / "img"
CANVAS = (768, 768)
BASELINE = 744


def clean_generated(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    alpha = image.getchannel("A").point(lambda value: max(0, min(255, (value - 120) * 2)))
    image.putalpha(alpha)
    return image


def remove_white(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    white = Image.new("RGB", image.size, "white")
    distance = ImageChops.difference(image.convert("RGB"), white).convert("L")
    alpha = distance.point(lambda value: 0 if value < 4 else 255 if value > 18 else int((value - 4) / 14 * 255))
    image.putalpha(alpha)
    return image


def save_frame(image: Image.Image, name: str, target_height: int) -> None:
    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    if not bounds:
        raise ValueError(f"empty frame: {name}")
    image = image.crop(bounds)
    scale = target_height / image.height
    width = round(image.width * scale)
    image = image.resize((width, target_height), Image.Resampling.LANCZOS)
    if width > CANVAS[0] - 24:
        scale = (CANVAS[0] - 24) / width
        image = image.resize((CANVAS[0] - 24, round(target_height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    canvas.alpha_composite(image, ((CANVAS[0] - image.width) // 2, BASELINE - image.height))
    canvas.save(SPRITES / f"{name}.webp", "WEBP", lossless=True, method=6)


def crop_sheet(path: Path) -> tuple[Image.Image, Image.Image]:
    image = clean_generated(Image.open(path))
    half = image.width // 2
    return image.crop((0, 0, half, image.height)), image.crop((half, 0, image.width, image.height))


def save_crop(image: Image.Image, box: tuple[int, int, int, int], name: str, size: tuple[int, int]) -> None:
    image.crop(box).resize(size, Image.Resampling.LANCZOS).save(SCENE / name, "WEBP", quality=82, method=6)


def save_cutout(path: Path, name: str, width: int = 512) -> None:
    image = remove_white(Image.open(path))
    bounds = image.getchannel("A").getbbox()
    if not bounds:
        raise ValueError(f"empty cutout: {name}")
    image = image.crop(bounds)
    image.thumbnail((width, width), Image.Resampling.LANCZOS)
    image.save(SCENE / name, "WEBP", lossless=True, method=6)


def main() -> None:
    SPRITES.mkdir(parents=True, exist_ok=True)
    SCENE.mkdir(parents=True, exist_ok=True)

    turnaround = Image.open(PACK / "visitor-bun-light-turnaround.png")
    third = turnaround.width // 3
    for name, box in {
        "stand-front": (0, 0, third, turnaround.height),
        "stand-side": (third, 0, third * 2, turnaround.height),
        "stand-back": (third * 2, 0, turnaround.width, turnaround.height),
    }.items():
        save_frame(remove_white(turnaround.crop(box)), name, 690)

    side_frames = crop_sheet(SOURCE / "visitor-walk-side-strip.png")
    back_frames = crop_sheet(SOURCE / "visitor-walk-back-strip.png")
    for index, image in enumerate(side_frames, 1):
        save_frame(image, f"walk-side-{index}", 690)
    for index, image in enumerate(back_frames, 1):
        save_frame(image, f"walk-back-{index}", 690)
    save_frame(clean_generated(Image.open(SOURCE / "visitor-palms-standing.png")), "palms", 690)

    for index, height in enumerate((470, 430, 300), 1):
        save_frame(Image.open(APP_ASSETS / f"visitor-bun-light-bow-{index}.webp").convert("RGBA"), f"bow-{index}", height)
    save_frame(Image.open(APP_ASSETS / "visitor-bun-light-sit.webp").convert("RGBA"), "sit", 565)

    hall = Image.open(PACK / "hall-front-day-no-buddha.png").convert("RGB")
    courtyard = Image.open(APP_ASSETS / "scene-vn-courtyard-day.webp").convert("RGB")
    save_crop(hall, (245, 315, 696, 980), "hall-wall.webp", (512, 768))
    save_crop(hall, (0, 0, 941, 620), "hall-roof.webp", (768, 508))
    save_crop(hall, (0, 870, 941, 1672), "hall-floor.webp", (768, 654))
    save_crop(hall, (0, 300, 260, 980), "hall-mountain-left.webp", (300, 768))
    save_crop(hall, (681, 300, 941, 980), "hall-mountain-right.webp", (300, 768))
    save_crop(courtyard, (0, 0, 941, 930), "courtyard-mist.webp", (768, 760))
    save_crop(courtyard, (0, 780, 941, 1672), "courtyard-floor.webp", (768, 728))

    save_cutout(PACK / "objects" / "altar-table.png", "altar-table.webp")
    save_cutout(PACK / "objects" / "cloud-bracket.png", "cloud-bracket.webp")
    save_cutout(PACK / "objects" / "incense-burner.png", "incense-burner.webp")
    save_cutout(PACK / "objects" / "lotus-oil-lamp.png", "lotus-oil-lamp.webp")
    save_cutout(PACK / "objects" / "meditation-cushion.png", "meditation-cushion.webp")
    save_cutout(PACK / "objects" / "column-stone-base.png", "column-stone-base.webp")


if __name__ == "__main__":
    main()
