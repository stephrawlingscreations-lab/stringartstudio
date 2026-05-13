#!/usr/bin/env python3
"""One-off generator for home-screen / favicon PNGs. Re-run if art changes."""
from __future__ import annotations

import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.abspath(__file__))
W = H = 180


def vertical_gradient(size: tuple[int, int], top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    img = Image.new("RGB", size)
    draw = ImageDraw.Draw(img)
    w, h = size
    for y in range(h):
        t = y / max(h - 1, 1)
        r = int(top[0] * (1 - t) + bottom[0] * t)
        g = int(top[1] * (1 - t) + bottom[1] * t)
        b = int(top[2] * (1 - t) + bottom[2] * t)
        draw.line([(0, y), (w, y)], fill=(r, g, b))
    return img


def save_pair(name: str, img180: Image.Image) -> None:
    path180 = os.path.join(ROOT, f"{name}-180.png")
    path32 = os.path.join(ROOT, f"{name}-32.png")
    img180.save(path180, "PNG", optimize=True)
    img180.resize((32, 32), Image.Resampling.LANCZOS).save(path32, "PNG", optimize=True)


def icon_household() -> Image.Image:
    base = vertical_gradient((W, H), (99, 102, 241), (49, 46, 129))
    d = ImageDraw.Draw(base)
    cx = W // 2
    d.polygon([(cx, 36), (cx + 54, 84), (cx - 54, 84)], fill=(255, 255, 255))
    d.rounded_rectangle((cx - 50, 84, cx + 50, 146), radius=10, fill=(255, 255, 255))
    d.rounded_rectangle((cx - 18, 100, cx + 18, 146), radius=5, fill=(67, 56, 202))
    return base


def icon_grass() -> Image.Image:
    base = vertical_gradient((W, H), (15, 51, 38), (52, 150, 95))
    d = ImageDraw.Draw(base)
    d.ellipse((46, 50, 116, 126), fill=(232, 245, 236))
    d.ellipse((60, 46, 130, 116), fill=(210, 235, 220))
    d.ellipse((86, 68, 136, 128), fill=(176, 225, 198))
    d.rounded_rectangle((86, 116, 94, 150), radius=3, fill=(232, 245, 236))
    return base


def icon_tv() -> Image.Image:
    base = vertical_gradient((W, H), (30, 41, 72), (8, 10, 18))
    d = ImageDraw.Draw(base)
    d.rounded_rectangle((36, 46, 144, 120), radius=14, outline=(251, 191, 36), width=6)
    d.rounded_rectangle((46, 56, 134, 112), radius=10, fill=(34, 211, 238))
    d.line([(54, 74), (126, 74)], fill=(8, 100, 118), width=2)
    d.line([(54, 90), (112, 90)], fill=(8, 100, 118), width=2)
    d.rounded_rectangle((76, 120, 104, 142), radius=5, fill=(251, 191, 36))
    d.ellipse((68, 134, 112, 158), fill=(251, 191, 36))
    return base


def icon_portal() -> Image.Image:
    base = vertical_gradient((W, H), (42, 50, 68), (105, 143, 128))
    d = ImageDraw.Draw(base)
    # 2x2 grid of rounded squares representing the hub tiles
    s, r, gap = 52, 10, 14
    positions = [(34, 34), (34 + s + gap, 34), (34, 34 + s + gap), (34 + s + gap, 34 + s + gap)]
    for x, y in positions:
        d.rounded_rectangle((x, y, x + s, y + s), radius=r, fill=(255, 255, 255, 180))
    # Subtle inner highlight on top-left tile
    d.rounded_rectangle((38, 38, 38 + 44, 38 + 44), radius=8, fill=(255, 255, 255, 40))
    return base


def main() -> None:
    save_pair("household", icon_household())
    save_pair("grass", icon_grass())
    save_pair("tv", icon_tv())
    save_pair("portal", icon_portal())
    print("Wrote household-180.png, grass-180.png, tv-180.png, portal-180.png (+ 32px favicons)")


if __name__ == "__main__":
    main()
