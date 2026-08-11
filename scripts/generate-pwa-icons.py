from pathlib import Path

from PIL import Image

# Reproducible setup:
#   python -m pip install -r requirements-icons.txt
#   python scripts/generate-pwa-icons.py


ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / "assets" / "icons"
MASTER = ICONS / "icon-master-1024.png"
MASKABLE_BACKGROUND = (253, 198, 46, 255)

OUTPUT_SIZES = {
    "apple-touch-icon.png": 180,
    "mstile-150x150.png": 150,
}

WINDOWS_OUTPUT_SIZES = {
    "icon-any-192-v3.png": 192,
    "icon-any-512-v3.png": 512,
}


def centered_variant(source, size, artwork_ratio, background_color=None):
    background = Image.new(
        "RGBA",
        (size, size),
        background_color or source.getpixel((0, 0)),
    )
    artwork_size = round(size * artwork_ratio)
    artwork = source.resize((artwork_size, artwork_size), Image.Resampling.LANCZOS)
    offset = (size - artwork_size) // 2
    background.alpha_composite(artwork, (offset, offset))
    return background


def transparent_corner_variant(source, size):
    cleaned = source.copy()
    corner_size = round(source.width * 0.16)
    red_reference = MASKABLE_BACKGROUND[0]

    for y in range(source.height):
        for x in range(source.width):
            is_corner = (
                (x < corner_size or x >= source.width - corner_size)
                and (y < corner_size or y >= source.height - corner_size)
            )
            if not is_corner:
                continue

            red, _, _, _ = source.getpixel((x, y))
            alpha = min(255, round(red * 255 / red_reference))
            if alpha <= 4:
                alpha = 0
            cleaned.putpixel((x, y), (*MASKABLE_BACKGROUND[:3], alpha))

    return cleaned.resize((size, size), Image.Resampling.LANCZOS)


def main():
    ICONS.mkdir(parents=True, exist_ok=True)
    source = Image.open(MASTER).convert("RGBA")
    master = source.resize((1024, 1024), Image.Resampling.LANCZOS)
    master.save(MASTER, optimize=True)

    for filename, size in OUTPUT_SIZES.items():
        master.resize((size, size), Image.Resampling.LANCZOS).save(
            ICONS / filename,
            optimize=True,
        )

    for filename, size in WINDOWS_OUTPUT_SIZES.items():
        transparent_corner_variant(master, size).save(
            ICONS / filename,
            optimize=True,
        )

    maskable_inset = round(master.width * 0.0625)
    maskable_source = master.crop((
        maskable_inset,
        maskable_inset,
        master.width - maskable_inset,
        master.height - maskable_inset,
    ))
    for size in (192, 512):
        centered_variant(maskable_source, size, 0.66, MASKABLE_BACKGROUND).save(
            ICONS / f"icon-maskable-{size}-v2.png",
            optimize=True,
        )

    # Favicon keeps only the central mark enlarged, avoiding unreadable edge detail.
    for size in (16, 32):
        centered_variant(master, size, 0.82).save(
            ICONS / f"favicon-{size}x{size}.png",
            optimize=True,
        )

    master.save(
        ICONS / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )


if __name__ == "__main__":
    main()
