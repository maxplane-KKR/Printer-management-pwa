from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]


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


print("pwa icon pixel tests passed")
