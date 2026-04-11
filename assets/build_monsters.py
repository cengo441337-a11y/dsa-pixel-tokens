"""
DSA Monster Sprite Generator
Generates LPC-format walking sprites for DSA monsters.
Run from assets/ directory: python build_monsters.py
"""

import os
import math
import numpy as np
from PIL import Image, ImageDraw

FRAME_W = 64
FRAME_H = 64
DIRS    = 4   # UP, LEFT, DOWN, RIGHT
FRAMES  = 9   # 0=idle, 1-8=walk

def blank():
    return Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))

def make_sheet(rows):
    """rows: list of 4 lists of 9 Images → (576, 256) spritesheet"""
    sheet = Image.new("RGBA", (FRAME_W * FRAMES, FRAME_H * DIRS), (0, 0, 0, 0))
    for row_idx, frames in enumerate(rows):
        for col_idx, frame in enumerate(frames):
            sheet.paste(frame, (col_idx * FRAME_W, row_idx * FRAME_H))
    return sheet

# ─── Walk cycle math ──────────────────────────────────────────────────────────

def walk_phase(frame_idx):
    """Returns (leg_phase, arm_phase, body_bob) for frame 0-8.
    leg_phase in [-1, 1]: -1=left leg forward, +1=right leg forward
    body_bob in [-2, 0]: pixel offset up/down
    """
    if frame_idx == 0:
        return 0.0, 0.0, 0
    t = (frame_idx - 1) / 7  # 0..1 over walk frames 1-8
    leg_phase = math.sin(t * 2 * math.pi)
    arm_phase = -leg_phase  # arms swing opposite to legs
    body_bob  = -int(abs(math.sin(t * 4 * math.pi)) * 2)
    return leg_phase, arm_phase, body_bob

# ─── Generic humanoid renderer ────────────────────────────────────────────────

def draw_humanoid_front(cfg, frame_idx, facing="front"):
    """
    Draws a humanoid monster from front (or back) view.
    cfg keys: skin, armor, eye, head_r, torso_w, torso_h, leg_w, leg_h, arm_w, arm_h,
              horns (bool), tail (bool), extra_large (bool)
    """
    img   = blank()
    draw  = ImageDraw.Draw(img)
    leg_p, arm_p, bob = walk_phase(frame_idx)
    cx = FRAME_W // 2
    cy = FRAME_H // 2 + bob

    skin  = cfg["skin"]
    armor = cfg.get("armor", skin)
    eye   = cfg.get("eye", (200, 50, 50, 230))

    hr = cfg.get("head_r",  10)
    tw = cfg.get("torso_w", 14)
    th = cfg.get("torso_h", 16)
    lw = cfg.get("leg_w",    7)
    lh = cfg.get("leg_h",   14)
    aw = cfg.get("arm_w",    5)
    ah = cfg.get("arm_h",   12)

    # Y offsets (from center of body)
    head_top    = cy - th//2 - hr*2 + 2
    torso_top   = cy - th//2
    torso_bot   = cy + th//2
    leg_top     = torso_bot
    arm_top     = torso_top + 2

    # ── Legs ──────────────────────────────────────────────────────────────────
    for side in [-1, 1]:
        lx = cx + side * (tw//4 + lw//2 - 1)
        if facing == "back":
            step = -int(leg_p * 5 * side)
        else:
            step = int(leg_p * 5 * side)
        draw.rectangle([lx - lw//2, leg_top, lx + lw//2, leg_top + lh + step],
                       fill=armor)
        # Boot
        boot_y = leg_top + lh + step
        bx = lx + int(step * 0.3)
        draw.rectangle([bx - lw//2 - 1, boot_y - 3, bx + lw//2 + 1, boot_y + 3],
                       fill=cfg.get("boot", (40, 30, 20, 220)))

    # ── Torso ─────────────────────────────────────────────────────────────────
    draw.rectangle([cx - tw//2, torso_top, cx + tw//2, torso_bot], fill=armor)

    # ── Arms ──────────────────────────────────────────────────────────────────
    for side in [-1, 1]:
        ax = cx + side * (tw//2 + aw//2)
        if facing == "back":
            swing = int(arm_p * 5 * side)
        else:
            swing = -int(arm_p * 5 * side)
        draw.rectangle([ax - aw//2, arm_top, ax + aw//2, arm_top + ah + swing],
                       fill=armor)
        # Hand
        hand_y = arm_top + ah + swing
        draw.ellipse([ax - aw//2, hand_y - 2, ax + aw//2, hand_y + 3],
                     fill=skin)

    # ── Head ──────────────────────────────────────────────────────────────────
    hcx = cx
    hcy = head_top + hr
    draw.ellipse([hcx - hr, hcy - hr, hcx + hr, hcy + hr], fill=skin)

    # Horns
    if cfg.get("horns"):
        for side in [-1, 1]:
            hx = hcx + side * (hr - 3)
            draw.polygon([
                (hx, hcy - hr),
                (hx + side * 3, hcy - hr - 10),
                (hx + side * 6, hcy - hr)
            ], fill=cfg.get("horn_color", (80, 60, 40, 220)))

    # Tail
    if cfg.get("tail") and facing == "back":
        tail_x = cx + int(arm_p * 4)
        for seg in range(6):
            ty = torso_bot + seg * 3
            tx = cx + int(math.sin(seg * 0.8 + bob * 0.3) * 5)
            draw.ellipse([tx - 3, ty, tx + 3, ty + 4],
                         fill=cfg.get("tail_color", skin))

    # Eyes (only front)
    if facing == "front":
        for side in [-1, 1]:
            ex = hcx + side * (hr // 2)
            ey = hcy - hr // 4
            draw.ellipse([ex - 2, ey - 2, ex + 2, ey + 2], fill=eye)
        # Nose
        draw.ellipse([hcx - 1, hcy + 2, hcx + 1, hcy + 4],
                     fill=(int(skin[0]*0.8), int(skin[1]*0.8), int(skin[2]*0.8), skin[3]))
    else:
        # Back of head: just neck
        draw.rectangle([cx - 4, hcy + hr - 2, cx + 4, torso_top + 4],
                       fill=skin)

    return img

def draw_humanoid_side(cfg, frame_idx, direction="right"):
    """Side-view of humanoid (left or right)."""
    img  = blank()
    draw = ImageDraw.Draw(img)
    leg_p, arm_p, bob = walk_phase(frame_idx)
    sign = 1 if direction == "right" else -1

    skin  = cfg["skin"]
    armor = cfg.get("armor", skin)
    eye   = cfg.get("eye", (200, 50, 50, 230))

    hr = cfg.get("head_r", 10)
    tw = cfg.get("torso_w", 14)
    th = cfg.get("torso_h", 16)
    lw = cfg.get("leg_w",    7)
    lh = cfg.get("leg_h",   14)
    aw = cfg.get("arm_w",    5)
    ah = cfg.get("arm_h",   12)

    cx      = FRAME_W // 2 - sign * 2
    cy      = FRAME_H // 2 + bob
    torso_top = cy - th // 2
    torso_bot = cy + th // 2
    head_cy   = torso_top - hr + 2

    # Legs (alternating for walk)
    for i, leg_off in enumerate([int(leg_p * 7), -int(leg_p * 7)]):
        lx = cx + sign * 2 - sign * i * 2
        alpha = 200 if i == 0 else 150
        a_col = (armor[0], armor[1], armor[2], alpha)
        draw.rectangle([lx - lw//4, torso_bot, lx + lw//4, torso_bot + lh + leg_off],
                       fill=a_col)
        boot_y = torso_bot + lh + leg_off
        bx0 = lx - lw//3; bx1 = lx + lw//3 + sign*3
        draw.rectangle([min(bx0,bx1), boot_y - 3, max(bx0,bx1)+1, boot_y + 3],
                       fill=cfg.get("boot", (40, 30, 20, alpha)))

    # Torso
    draw.rectangle([cx - tw//4, torso_top, cx + tw//4 + 2, torso_bot],
                   fill=armor)

    # Arms (front arm swings forward/back)
    arm_swing = int(arm_p * 8)
    def rect(x0, y0, x1, y1, **kw):
        draw.rectangle([min(x0,x1), min(y0,y1), max(x0,x1)+1, max(y0,y1)], **kw)
    # Back arm
    bax0 = cx - sign * 2
    bax1 = cx - sign * 2 + sign * aw//2
    rect(bax0, torso_top + 2, bax1, torso_top + ah - arm_swing,
         fill=(max(0,armor[0]-20), max(0,armor[1]-20), max(0,armor[2]-20), 180))
    # Front arm
    fax0 = cx + sign * 3
    fax1 = cx + sign * 3 + sign * aw//2
    rect(fax0, torso_top + 2, fax1, torso_top + ah + arm_swing, fill=armor)

    # Head
    draw.ellipse([cx - hr + sign*2, head_cy - hr, cx + hr + sign*2, head_cy + hr],
                 fill=skin)
    # Eye (forward side only)
    ex = cx + sign * (hr - 2)
    ey = head_cy - 2
    draw.ellipse([ex - 2, ey - 2, ex + 2, ey + 2], fill=eye)

    # Horns
    if cfg.get("horns"):
        hx = cx + sign * (hr - 1)
        draw.polygon([
            (hx, head_cy - hr),
            (hx + sign * 2, head_cy - hr - 10),
            (hx + sign * 5, head_cy - hr + 1)
        ], fill=cfg.get("horn_color", (80, 60, 40, 220)))

    return img

def make_monster_frames(cfg):
    """Build all 4 directions × 9 frames."""
    rows = []
    for direction in ["up", "left", "down", "right"]:
        frames = []
        for f in range(FRAMES):
            if direction == "down":
                frames.append(draw_humanoid_front(cfg, f, "front"))
            elif direction == "up":
                frames.append(draw_humanoid_front(cfg, f, "back"))
            elif direction == "left":
                frames.append(draw_humanoid_side(cfg, f, "left"))
            else:  # right
                frames.append(draw_humanoid_side(cfg, f, "right"))
        rows.append(frames)
    return rows

# ─── Monster Definitionen ──────────────────────────────────────────────────────

MONSTERS = {

    "goblin": {
        "skin":       (85, 140, 60, 230),
        "armor":      (110, 80, 40, 230),
        "eye":        (240, 60, 60, 240),
        "boot":       (55, 40, 20, 230),
        "horn_color": None,
        "head_r":     9,
        "torso_w":    12,
        "torso_h":    13,
        "leg_w":      6,
        "leg_h":      12,
        "arm_w":      4,
        "arm_h":      10,
        "horns":      False,
        "tail":       False,
    },

    "skelettkrieger": {
        "skin":       (215, 210, 195, 230),
        "armor":      (130, 100, 70, 230),
        "eye":        (255, 50, 50, 255),
        "boot":       (90, 70, 50, 230),
        "head_r":     9,
        "torso_w":    12,
        "torso_h":    14,
        "leg_w":      5,
        "leg_h":      14,
        "arm_w":      4,
        "arm_h":      11,
        "horns":      False,
        "tail":       False,
    },

    "ork": {
        "skin":       (100, 130, 75, 230),
        "armor":      (60, 55, 50, 240),
        "eye":        (255, 80, 20, 240),
        "boot":       (40, 35, 25, 230),
        "horn_color": (70, 55, 35, 220),
        "head_r":     11,
        "torso_w":    18,
        "torso_h":    18,
        "leg_w":      8,
        "leg_h":      15,
        "arm_w":      7,
        "arm_h":      13,
        "horns":      True,
        "tail":       False,
    },

    "troll": {
        "skin":       (125, 115, 100, 235),
        "armor":      (105, 95, 80, 235),
        "eye":        (240, 200, 40, 240),
        "boot":       (80, 70, 55, 235),
        "horn_color": (80, 70, 55, 220),
        "head_r":     13,
        "torso_w":    24,
        "torso_h":    22,
        "leg_w":      11,
        "leg_h":      16,
        "arm_w":      9,
        "arm_h":      14,
        "horns":      True,
        "tail":       False,
    },

    "oger": {
        "skin":       (175, 135, 85, 235),
        "armor":      (140, 105, 60, 235),
        "eye":        (60, 200, 60, 240),
        "boot":       (90, 65, 35, 235),
        "horn_color": None,
        "head_r":     14,
        "torso_w":    28,
        "torso_h":    26,
        "leg_w":      13,
        "leg_h":      17,
        "arm_w":      11,
        "arm_h":      15,
        "horns":      False,
        "tail":       False,
    },
}

# ─── Build ─────────────────────────────────────────────────────────────────────

os.makedirs("monsters", exist_ok=True)

for name, cfg in MONSTERS.items():
    rows   = make_monster_frames(cfg)
    sheet  = make_sheet(rows)
    path   = f"monsters/{name}.png"
    sheet.save(path)
    print(f"  {path}  ({sheet.size[0]}×{sheet.size[1]}px, {DIRS} rows × {FRAMES} frames)")

print(f"\nFertig! {len(MONSTERS)} Monster-Sprites generiert.")
print("Foundry-Einstellungen pro Monster-Token:")
print("  Frame-Breite/Höhe: 64  |  Frames/Richtung: 9")
print("  Reihen: Unten=2, Links=1, Rechts=3, Oben=0")
