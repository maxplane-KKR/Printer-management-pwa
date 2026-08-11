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
    "icon-192.png": 192,
    "icon-512.png": 512,
    "apple-touch-icon.png": 180,
    "mstile-150x150.png": 150,
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
