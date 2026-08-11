import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = json.loads((ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))


for icon in (item for item in MANIFEST["icons"] if item["purpose"] == "any"):
    path = ROOT / icon["src"].lstrip("/")
    image = Image.open(path).convert("RGBA")
    width, height = image.size
    corners = (
        image.getpixel((0, 0)),
        image.getpixel((width - 1, 0)),
        image.getpixel((0, height - 1)),
        image.getpixel((width - 1, height - 1)),
    )
    assert all(alpha == 0 for _, _, _, alpha in corners), (
        f"{path.name} มุมทั้งสี่ต้องโปร่งใสสำหรับไอคอน Windows"
    )


for size in (192, 512):
    path = ROOT / "assets" / "icons" / f"icon-maskable-{size}-v2.png"
    image = Image.open(path).convert("RGBA")
    border = max(1, round(size * 0.1))
    edge_pixels = []

    for y in range(size):
        for x in range(size):
            if x < border or x >= size - border or y < border or y >= size - border:
                edge_pixels.append(image.getpixel((x, y)))

    assert all(alpha == 255 for _, _, _, alpha in edge_pixels), (
        f"{path.name} ขอบนอกต้องทึบสำหรับ Android maskable icon"
    )
    assert not any(max(red, green, blue) < 48 for red, green, blue, _ in edge_pixels), (
        f"{path.name} ต้องไม่มีขอบดำในพื้นที่รอบนอก 10%"
    )

    artwork_edge = round(size * 0.18)
    artwork_corners = (
        (artwork_edge, artwork_edge),
        (size - artwork_edge - 1, artwork_edge),
        (artwork_edge, size - artwork_edge - 1),
        (size - artwork_edge - 1, size - artwork_edge - 1),
    )
    assert all(max(image.getpixel(point)[:3]) >= 96 for point in artwork_corners), (
        f"{path.name} ต้องไม่มีมุมดำจากกรอบ master ซ้อนอยู่ใน safe zone"
    )


expected_android_hashes = {
    "icon-maskable-192-v2.png": "9f0aeeae092cb141200b7366b1ed5c6d63a033b557efd9a94c16a2b3804421ae",
    "icon-maskable-512-v2.png": "e0210d6e58f48ee14e69003c6f59f72a3bf78332b0c8ef0bd98266fcb5fe7133",
}
for filename, expected_hash in expected_android_hashes.items():
    actual_hash = hashlib.sha256((ROOT / "assets" / "icons" / filename).read_bytes()).hexdigest()
    assert actual_hash == expected_hash, f"{filename} ของ Android ต้องไม่เปลี่ยน"


print("pwa icon pixel tests passed")
