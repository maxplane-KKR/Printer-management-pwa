from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / "assets" / "icons"
MASTER = ICONS / "icon-master-1024.png"

OUTPUT_SIZES = {
    "icon-192.png": 192,
    "icon-512.png": 512,
    "icon-maskable-192.png": 192,
    "icon-maskable-512.png": 512,
    "apple-touch-icon.png": 180,
    "favicon-16x16.png": 16,
    "favicon-32x32.png": 32,
    "mstile-150x150.png": 150,
}


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

    master.save(
        ICONS / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )


if __name__ == "__main__":
    main()
