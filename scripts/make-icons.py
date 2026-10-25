#!/usr/bin/env python3
"""Génère les icônes PWA originales de « Cour de Récré » (PIL uniquement)."""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

VOID = (22, 35, 74)
FLOOR = (217, 217, 222)
FLOOR_SIDE = (141, 141, 154)
WHITE = (255, 255, 255)
RED = (214, 48, 60)
INK = (30, 30, 40)
YELLOW = (242, 194, 46)
SKIN = (243, 202, 164)
HAIR = (123, 35, 65)
GOLD = (242, 200, 75)
TROUSERS = (58, 58, 76)
SHOES = (74, 45, 26)


def draw_icon(size: int, pad_ratio: float) -> Image.Image:
    img = Image.new("RGBA", (size, size), VOID)
    d = ImageDraw.Draw(img)
    s = size
    pad = s * pad_ratio
    # Sol en losange avec épaisseur.
    cx, cy = s / 2, s * 0.56
    hw, hh = s / 2 - pad, (s / 2 - pad) * 0.5
    thick = s * 0.05
    d.polygon([(cx - hw, cy), (cx, cy + hh), (cx, cy + hh + thick), (cx - hw, cy + thick)], fill=FLOOR_SIDE)
    d.polygon([(cx, cy + hh), (cx + hw, cy), (cx + hw, cy + thick), (cx, cy + hh + thick)], fill=(154, 154, 166))
    d.polygon([(cx, cy - hh), (cx + hw, cy), (cx, cy + hh), (cx - hw, cy)], fill=FLOOR)
    # Case blanche avec un cœur.
    tw, th = hw * 0.5, hh * 0.5
    tcx, tcy = cx - hw * 0.22, cy + hh * 0.1
    d.polygon([(tcx, tcy - th), (tcx + tw, tcy), (tcx, tcy + th), (tcx - tw, tcy)], fill=WHITE, outline=(181, 181, 192))
    heart(d, tcx, tcy, tw * 0.5, RED)
    # Élève en pixel art (uniforme jaune), à l'échelle.
    px = s / 100
    ox, oy = cx + hw * 0.28 - 8 * px, cy - hh * 0.2 - 2 * px
    student(d, ox, oy, px)
    return img


def heart(d: ImageDraw.ImageDraw, cx: float, cy: float, r: float, color) -> None:
    # Deux disques + un triangle, aplati pour la perspective.
    ry = r * 0.62
    d.ellipse([cx - r, cy - ry * 0.9, cx, cy + ry * 0.1], fill=color)
    d.ellipse([cx, cy - ry * 0.9, cx + r, cy + ry * 0.1], fill=color)
    d.polygon([(cx - r, cy - ry * 0.25), (cx + r, cy - ry * 0.25), (cx, cy + ry * 1.05)], fill=color)


def student(d: ImageDraw.ImageDraw, ox: float, oy: float, px: float) -> None:
    def rect(x, y, w, h, color):
        d.rectangle([ox + x * px, oy + y * px, ox + (x + w) * px - 1, oy + (y + h) * px - 1], fill=color)

    def rect_o(x, y, w, h, color):
        rect(x - 1, y - 1, w + 2, h + 2, INK)
        rect(x, y, w, h, color)

    # Jambes
    rect_o(3, 26, 4, 10, TROUSERS)
    rect_o(9, 26, 4, 10, TROUSERS)
    rect(2, 36, 6, 2, SHOES)
    rect(8, 36, 6, 2, SHOES)
    # Bras
    rect_o(-1, 13, 3, 10, YELLOW)
    rect_o(14, 13, 3, 10, YELLOW)
    rect(-1, 23, 3, 2, SKIN)
    rect(14, 23, 3, 2, SKIN)
    # Veste
    rect_o(2, 12, 12, 14, YELLOW)
    rect(2, 13, 2, 12, (181, 138, 16))
    rect_o(4, 12, 8, 2, (255, 226, 122))
    for i in range(3):
        rect(7, 16 + i * 3, 2, 2, GOLD)
    # Cou et tête
    rect(6, 10, 4, 2, SKIN)
    rect_o(2, 0, 12, 11, SKIN)
    rect_o(2, -1, 12, 4, HAIR)
    rect(3, 3, 3, 2, HAIR)
    rect(8, 3, 2, 1, HAIR)
    rect(2, 3, 1, 5, HAIR)
    rect(13, 3, 1, 5, HAIR)
    rect(4, 6, 2, 2, INK)
    rect(10, 6, 2, 2, INK)
    rect(7, 9, 2, 1, (179, 95, 95))


def main() -> None:
    base = draw_icon(512, 0.06)
    base.save(OUT / "icon-512.png")
    base.resize((192, 192), Image.LANCZOS).save(OUT / "icon-192.png")
    base.resize((180, 180), Image.LANCZOS).save(OUT / "apple-touch-icon.png")
    draw_icon(512, 0.16).save(OUT / "icon-512-maskable.png")
    print("Icônes générées dans", OUT)


if __name__ == "__main__":
    main()
