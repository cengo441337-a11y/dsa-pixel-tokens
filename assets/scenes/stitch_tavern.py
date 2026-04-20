"""Stitch 4 tavern tiles (400x400) into one 800x800 scene image.

Layout:
  NW | NE
  ---+---
  SW | SE
"""
from PIL import Image
import os

BASE = os.path.dirname(os.path.abspath(__file__))
TILES = {
    (0, 0):   os.path.join(BASE, "tavern_big_nw.png"),
    (400, 0): os.path.join(BASE, "tavern_big_ne.png"),
    (0, 400): os.path.join(BASE, "tavern_big_sw.png"),
    (400, 400): os.path.join(BASE, "tavern_big_se.png"),
}
OUT = os.path.join(BASE, "tavern_big.png")

# 800x800 auf schwarzem Hintergrund (damit keine Transparenz-Luecken sichtbar sind)
canvas = Image.new("RGB", (800, 800), (10, 6, 4))  # fast-schwarzer Ton (wie die Kacheln am Rand)

for (x, y), path in TILES.items():
    if not os.path.exists(path):
        print(f"[ERROR] Fehlt: {path}")
        continue
    tile = Image.open(path).convert("RGBA")
    # Transparenter Rand wird durch den canvas-Hintergrund ersetzt
    canvas.paste(tile, (x, y), tile)
    print(f"[OK] {os.path.basename(path)} -> ({x},{y})")

canvas.save(OUT)
print(f"\n[SAVED] {OUT} ({canvas.size[0]}x{canvas.size[1]})")
