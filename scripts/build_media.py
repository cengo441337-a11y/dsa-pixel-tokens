#!/usr/bin/env python3
"""Generate promo media for the dsa-pixel-tokens public release.

Outputs to docs/media/:
- banner.png           — 4-token hero banner (wide)
- tokens-grid.png      — 3×4 showcase of named characters from token-art/
- bestiary-grid.png    — 8×5 compact grid of random monsters from assets/monsters/
- chibi-showcase.png   — five named chibi heroes × four rotations
- walk-sara.gif        — animated walk-cycle from assets/sara_walk.png
- walk-barbarian.gif   — animated walk-cycle from assets/lpc_barbarian_walk.png
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import random
import sys

ROOT = Path(__file__).resolve().parent.parent
MEDIA = ROOT / "docs" / "media"
MEDIA.mkdir(parents=True, exist_ok=True)

# Dark-cyberpunk backdrop that survives on any GitHub theme
BG = (15, 17, 23)          # #0f1117
ACCENT = (0, 245, 255)     # cyan neon

# ── helpers ──────────────────────────────────────────────────────────────────

def load(path, size=None):
    im = Image.open(path).convert("RGBA")
    if size:
        im = im.resize(size, Image.NEAREST)
    return im

def paste_centered(bg, fg, cx, cy):
    """Paste fg centered at (cx, cy) on bg, respecting alpha."""
    w, h = fg.size
    bg.paste(fg, (cx - w // 2, cy - h // 2), fg)

# ── 1. Banner ─────────────────────────────────────────────────────────────────

def make_banner():
    """Wide hero banner: 4 iconic tokens on a dark background."""
    picks = ["drache_klein.png", "daemon_teufel.png",
             "mensch_magier.png", "skelett_krieger.png"]
    tiles = [load(ROOT / "token-art" / p, (192, 192)) for p in picks]

    W, H = 1280, 320
    out = Image.new("RGB", (W, H), BG)
    spacing = W // 5
    for i, t in enumerate(tiles):
        paste_centered(out, t, spacing * (i + 1), H // 2)

    out.save(MEDIA / "banner.png", optimize=True)
    print("  banner.png              1280×320")

# ── 2. Tokens grid (named artwork) ───────────────────────────────────────────

def make_tokens_grid():
    """3×4 grid of the named 1-bit-style token artwork in token-art/."""
    picks = [
        "mensch_kriegerin.png", "mensch_magier.png", "drache_klein.png",
        "daemon_teufel.png", "goblin_schurke.png", "dunkelelf_assassine.png",
        "ork_krieger.png", "ork_schamane.png", "skelett_krieger.png",
        "untot_zombie.png", "thorwaler.png", "tulamide_haendler.png",
    ]
    tiles = []
    for p in picks:
        candidate = ROOT / "token-art" / p
        if candidate.exists():
            tiles.append(load(candidate, (160, 160)))

    cols, rows = 4, 3
    cell = 180
    W, H = cell * cols, cell * rows
    out = Image.new("RGB", (W, H), BG)
    for i, t in enumerate(tiles[: cols * rows]):
        cx = (i % cols) * cell + cell // 2
        cy = (i // cols) * cell + cell // 2
        paste_centered(out, t, cx, cy)

    out.save(MEDIA / "tokens-grid.png", optimize=True)
    print(f"  tokens-grid.png         {W}×{H}  ({len(tiles)} tokens)")

# ── 3. Bestiary grid (random sample of 40 monsters) ──────────────────────────

def make_bestiary_grid():
    """8×5 compact grid of random monster tokens — illustrates scale."""
    all_monsters = list((ROOT / "assets" / "monsters").glob("*.png"))
    if not all_monsters:
        print("  bestiary-grid           SKIPPED (no assets/monsters/*.png)")
        return

    random.seed(42)
    picks = random.sample(all_monsters, min(40, len(all_monsters)))

    cell = 96
    cols, rows = 8, 5
    W, H = cell * cols, cell * rows
    out = Image.new("RGB", (W, H), BG)

    for i, p in enumerate(picks[: cols * rows]):
        try:
            t = load(p, (88, 88))
        except Exception:
            continue
        cx = (i % cols) * cell + cell // 2
        cy = (i // cols) * cell + cell // 2
        paste_centered(out, t, cx, cy)

    out.save(MEDIA / "bestiary-grid.png", optimize=True)
    print(f"  bestiary-grid.png       {W}×{H}  (40 of {len(all_monsters)})")

# ── 4. Chibi showcase (5 heroes × 4 rotations) ───────────────────────────────

def make_chibi_showcase():
    """Five named chibi heroes × four directional rotations."""
    chibi_root = ROOT / "assets" / "monsters" / "chibi"
    heroes = []
    for name in ["alrik", "brandt", "dunya", "edo", "tamir"]:
        rots = chibi_root / name / "rotations"
        if not rots.exists():
            continue
        row = []
        for direction in ["north", "east", "south", "west"]:
            p = rots / f"{direction}.png"
            if p.exists():
                row.append((name, direction, p))
        if len(row) == 4:
            heroes.append(row)

    if not heroes:
        print("  chibi-showcase          SKIPPED (no chibi rotations)")
        return

    cell = 120
    cols, rows = 4, len(heroes)
    # +32 on top for direction labels, +120 on left for hero names
    H_PAD = 32
    W_PAD = 120
    W = cols * cell + W_PAD
    H = rows * cell + H_PAD

    out = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(out)

    try:
        font = ImageFont.truetype("arial.ttf", 14)
    except Exception:
        font = ImageFont.load_default()

    # direction headers
    for c, d in enumerate(["N", "E", "S", "W"]):
        cx = W_PAD + c * cell + cell // 2
        draw.text((cx - 5, 8), d, fill=ACCENT, font=font)

    for r, row in enumerate(heroes):
        # hero name on the left
        name = row[0][0].upper()
        draw.text((10, H_PAD + r * cell + cell // 2 - 8), name,
                  fill=ACCENT, font=font)
        for c, (_, _, path) in enumerate(row):
            try:
                t = load(path, (110, 110))
            except Exception:
                continue
            cx = W_PAD + c * cell + cell // 2
            cy = H_PAD + r * cell + cell // 2
            paste_centered(out, t, cx, cy)

    out.save(MEDIA / "chibi-showcase.png", optimize=True)
    print(f"  chibi-showcase.png      {W}×{H}  ({len(heroes)} heroes × 4 dirs)")

# ── 5. Walk-cycle GIFs ───────────────────────────────────────────────────────

def make_walk_gif(sheet_path, out_name, frames=9, row=2, cell=64, fps=10):
    """
    LPC walk cycle: 4 rows (N, W, S, E) × 9 frames of `cell` px.
    Default sheet is 576×256 = 9×64 × 4×64.
    row=2 = "south" direction (walking toward camera) for front-facing preview.
    """
    if not Path(sheet_path).exists():
        print(f"  {out_name}   SKIPPED (sheet missing)")
        return

    sheet = Image.open(sheet_path).convert("RGBA")
    cw, ch = cell, cell
    y = row * ch

    # Extract frames
    orig_frames = [sheet.crop((i * cw, y, (i + 1) * cw, y + ch))
                   for i in range(frames)]

    # Scale up 4× so the pixel art stays crunchy on GitHub
    scale = 4
    big_frames = [f.resize((cw * scale, ch * scale), Image.NEAREST)
                  for f in orig_frames]

    # Compose each frame onto a dark backdrop so transparency renders
    # consistently in the final GIF (palette mode loses alpha).
    W = cw * scale + 40
    H = ch * scale + 40
    composited = []
    for f in big_frames:
        bg = Image.new("RGB", (W, H), BG)
        paste_centered(bg, f, W // 2, H // 2)
        composited.append(bg.convert("P", palette=Image.ADAPTIVE))

    duration_ms = int(1000 / fps)
    composited[0].save(
        MEDIA / out_name,
        save_all=True,
        append_images=composited[1:],
        optimize=True,
        duration=duration_ms,
        loop=0,
        disposal=2,
    )
    print(f"  {out_name:<20}    {W}×{H}  ({frames} frames, {fps} fps)")

# ── main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Building docs/media/ …")
    make_banner()
    make_tokens_grid()
    make_bestiary_grid()
    make_chibi_showcase()
    make_walk_gif(ROOT / "assets" / "sara_walk.png",       "walk-sara.gif")
    make_walk_gif(ROOT / "assets" / "lpc_barbarian_walk.png",
                                                            "walk-barbarian.gif")
    print("Done.")
