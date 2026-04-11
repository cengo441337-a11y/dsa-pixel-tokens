"""
DSA Elementargeister / Dschinne Sprite Generator
Generiert LPC-kompatible Sprites für DSA 4.1 Dschinne & Meister-Dschinne.
Run from assets/ directory:  python build_dschinne.py

Elemental design:
  - Schwebender Kern (Orb) statt Torso
  - Elementares "Schweifsegment" statt Beine
  - Glühende Augen
  - Kronenförmige Element-Partikel (Feuer=Flammen, Wasser=Tropfen, etc.)
  - 9 Frames: 0=idle, 1-8=Schwebe-Zyklus
  - 4 Richtungen (Up/Left/Down/Right) → LPC-Format
"""

import math
import os
from PIL import Image, ImageDraw, ImageFilter

FRAME_W = 64
FRAME_H = 64
DIRS    = 4
FRAMES  = 9

def blank():
    return Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))

def make_sheet(rows):
    sheet = Image.new("RGBA", (FRAME_W * FRAMES, FRAME_H * DIRS), (0, 0, 0, 0))
    for ri, frames in enumerate(rows):
        for ci, f in enumerate(frames):
            sheet.paste(f, (ci * FRAME_W, ri * FRAME_H), f)
    return sheet

def float_phase(frame_idx):
    """Vertikaler Schwebeversatz (Pixel) für Frame 0-8."""
    if frame_idx == 0:
        return 0, 0.0
    t = (frame_idx - 1) / 7.0
    bob   = -int(math.sin(t * 2 * math.pi) * 3)   # -3..+3 px
    pulse = 0.88 + math.sin(t * 2 * math.pi) * 0.12  # 0.88..1.00 Skalierung
    return bob, pulse

def clamp_color(c, alpha=None):
    r = max(0, min(255, int(c[0])))
    g = max(0, min(255, int(c[1])))
    b = max(0, min(255, int(c[2])))
    a = c[3] if alpha is None else alpha
    return (r, g, b, max(0, min(255, int(a))))

def blend(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(4))

# ─── Elementarkörper ─────────────────────────────────────────────────────────

def draw_dschinn_frame(cfg, frame_idx, direction="front"):
    """
    Zeichnet einen Dschinn-Frame.
    cfg keys:
      core_color     - Hauptfarbe (RGBA)
      glow_color     - Leuchtfarbe (RGBA, semi-transparent)
      eye_color      - Augenfarbe (RGBA)
      trail_color    - Schweif-Farbe (RGBA)
      crown_color    - Kronen-/Partikel-Farbe (RGBA)
      crown_type     - "flame" | "wave" | "wisp" | "rock"
      size           - 1.0=Standard Dschinn, 1.4=Meister
      glow_rings     - Anzahl Leuchtkreise
    """
    img  = blank()
    draw = ImageDraw.Draw(img)
    bob, pulse = float_phase(frame_idx)

    cx  = FRAME_W // 2
    # Mittelpunkt des Körpers etwas über Bildmitte
    cy  = FRAME_H // 2 - 4 + bob

    s   = cfg.get("size", 1.0)
    cr  = int(12 * s)   # Kern-Radius
    gc  = cfg["core_color"]
    gl  = cfg["glow_color"]
    ec  = cfg["eye_color"]
    tc  = cfg["trail_color"]
    cc  = cfg["crown_color"]

    # ── Leuchtschimmer (hinterster Layer) ────────────────────────────────────
    rings = cfg.get("glow_rings", 2)
    for ri in range(rings, 0, -1):
        rr  = int(cr * (1 + ri * 0.55) * pulse)
        alpha = int(60 / ri)
        glow_col = clamp_color(gl, alpha)
        draw.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=glow_col)

    # ── Elemental Schweif (untere Hälfte) ─────────────────────────────────────
    tail_h = int(22 * s)
    tail_y_top  = cy + cr - 2
    tail_y_bot  = tail_y_top + tail_h
    tail_w_top  = int(cr * 0.9)
    tail_w_bot  = max(2, int(cr * 0.15))

    crown_type = cfg.get("crown_type", "flame")

    for seg in range(tail_h):
        t_ratio = seg / tail_h
        w = int(tail_w_top * (1 - t_ratio) + tail_w_bot * t_ratio)
        alpha_seg = int(200 * (1 - t_ratio * 0.8))

        # Wasser & Eis: Wellen-Offset
        if crown_type in ("wave", "wisp"):
            wave_ox = int(math.sin((seg * 0.45 + frame_idx * 0.3) * math.pi) * 3 * s)
        else:
            wave_ox = 0

        seg_col = blend(tc, (tc[0], tc[1], tc[2], 0), t_ratio * 0.5)
        seg_col = clamp_color(seg_col, alpha_seg)
        x0 = cx + wave_ox - w
        x1 = cx + wave_ox + w
        y  = tail_y_top + seg
        if y < FRAME_H:
            draw.rectangle([x0, y, x1, y], fill=seg_col)

    # ── Kern (Orb) ────────────────────────────────────────────────────────────
    cr_scaled = int(cr * pulse)
    draw.ellipse([cx - cr_scaled, cy - cr_scaled, cx + cr_scaled, cy + cr_scaled],
                 fill=clamp_color(gc))
    # Highlight (heller Fleck oben links)
    hi_r = max(2, cr_scaled // 3)
    hi_x = cx - cr_scaled // 3
    hi_y = cy - cr_scaled // 3
    hi_col = clamp_color((
        min(255, gc[0] + 80),
        min(255, gc[1] + 80),
        min(255, gc[2] + 80),
        180
    ))
    draw.ellipse([hi_x - hi_r, hi_y - hi_r, hi_x + hi_r, hi_y + hi_r], fill=hi_col)

    # ── Krone / Partikel ──────────────────────────────────────────────────────
    num_particles = cfg.get("num_particles", 5)

    if crown_type == "flame":
        # Flammen-Krone: nach oben zackende Dreiecke
        for i in range(num_particles):
            angle  = (i / num_particles) * 2 * math.pi - math.pi / 2
            angle += math.sin(frame_idx * 0.6 + i) * 0.25
            dist   = cr_scaled + int(4 * s)
            px     = cx + int(math.cos(angle) * dist)
            py     = cy + int(math.sin(angle) * dist)
            fh     = int((5 + math.sin(frame_idx * 0.7 + i * 1.3) * 2) * s)
            fw     = max(2, int(3 * s))
            flame_col = clamp_color(cc, 220)
            tip_col   = clamp_color((min(255, cc[0] + 60), min(255, cc[1] + 60), cc[2], 160))
            draw.polygon([
                (px - fw, py),
                (px + fw, py),
                (px, py - fh)
            ], fill=flame_col)
            draw.ellipse([px - 1, py - fh - 1, px + 1, py - fh + 1], fill=tip_col)

    elif crown_type == "wave":
        # Wassertropfen / Wellen-Krone
        for i in range(num_particles):
            angle = (i / num_particles) * 2 * math.pi
            angle += frame_idx * 0.18
            dist  = cr_scaled + int(4 * s)
            px    = cx + int(math.cos(angle) * dist)
            py    = cy + int(math.sin(angle) * dist)
            dr    = max(2, int(3 * s))
            drop_col = clamp_color(cc, 200)
            draw.ellipse([px - dr, py - dr * 2, px + dr, py + dr // 2], fill=drop_col)

    elif crown_type == "wisp":
        # Luft: dünne Spiralen
        for i in range(num_particles):
            for ring in range(2):
                angle  = (i / num_particles) * 2 * math.pi + ring * math.pi
                angle += frame_idx * 0.22
                dist   = cr_scaled + int((3 + ring * 4) * s)
                px     = cx + int(math.cos(angle) * dist)
                py     = cy + int(math.sin(angle) * dist)
                wr     = max(1, int(2 * s))
                wisp_alpha = 180 - ring * 60
                draw.ellipse([px - wr, py - wr, px + wr, py + wr],
                             fill=clamp_color(cc, wisp_alpha))

    elif crown_type == "rock":
        # Erde: eckige Steinbrocken
        for i in range(num_particles):
            angle = (i / num_particles) * 2 * math.pi - math.pi / 2
            angle += math.sin(frame_idx * 0.2 + i) * 0.1
            dist  = cr_scaled + int(5 * s)
            px    = cx + int(math.cos(angle) * dist)
            py    = cy + int(math.sin(angle) * dist)
            rs    = max(2, int(4 * s))
            rock_col = clamp_color(cc, 230)
            draw.rectangle([px - rs, py - rs // 2, px + rs, py + rs // 2], fill=rock_col)
            # Glanz
            gem_col = clamp_color((min(255, cc[0]+60), min(255, cc[1]+80), min(255, cc[2]+40), 160))
            draw.rectangle([px - 1, py - 1, px + 1, py], fill=gem_col)

    # ── Augen ─────────────────────────────────────────────────────────────────
    if direction in ("front", "back"):
        eye_sep = int(cr_scaled * 0.4)
        ey_off  = int(cr_scaled * 0.15)
        for side in [-1, 1]:
            ex = cx + side * eye_sep
            ey = cy - ey_off
            er = max(1, int(3 * s))
            # Pupille
            draw.ellipse([ex - er, ey - er, ex + er, ey + er], fill=clamp_color(ec))
            # Leuchtring
            glow_r = er + 1
            draw.ellipse([ex - glow_r, ey - glow_r, ex + glow_r, ey + glow_r],
                         fill=clamp_color(ec, 60), outline=clamp_color(ec, 120))
            # Highlight
            draw.ellipse([ex - 1, ey - er + 1, ex, ey - 1],
                         fill=(255, 255, 255, 180))

    else:  # Seitenansicht: ein Auge
        sign = 1 if direction == "right" else -1
        ex   = cx + sign * int(cr_scaled * 0.3)
        ey   = cy - int(cr_scaled * 0.2)
        er   = max(1, int(3 * s))
        draw.ellipse([ex - er, ey - er, ex + er, ey + er], fill=clamp_color(ec))
        draw.ellipse([ex - 1, ey - er + 1, ex, ey - 1], fill=(255, 255, 255, 180))

    # ── Seitensilhouette: leicht abgeflachter Orb ─────────────────────────────
    if direction in ("left", "right"):
        # Seitlich sieht der Orb etwas schmaler aus
        sign = 1 if direction == "right" else -1
        # Ausblenden der "Rückseite"
        fade_x = cx - sign * cr_scaled
        for px in range(int(cr_scaled * 0.3)):
            alpha_fade = int(200 * (px / (cr_scaled * 0.3)))
            col = clamp_color(gc, alpha_fade)
            x0 = fade_x + sign * px
            draw.line([(x0, cy - cr_scaled), (x0, cy + cr_scaled)], fill=col)

    return img

def make_dschinn_frames(cfg):
    rows = []
    for direction in ["up", "left", "down", "right"]:
        frames = []
        dir_map = {"up": "back", "down": "front", "left": "left", "right": "right"}
        for f in range(FRAMES):
            frames.append(draw_dschinn_frame(cfg, f, dir_map[direction]))
        rows.append(frames)
    return rows

# ─── Dschinn-Definitionen ─────────────────────────────────────────────────────

DSCHINNE = {

    # ── Dschinne (Standard) ──────────────────────────────────────────────────

    "dschinn_feuer": {
        "core_color":    (240, 100,  20, 230),
        "glow_color":    (255,  60,   0, 180),
        "eye_color":     (255, 240,  80, 255),
        "trail_color":   (200,  50,   0, 200),
        "crown_color":   (255, 180,  30, 240),
        "crown_type":    "flame",
        "num_particles": 6,
        "glow_rings":    3,
        "size":          1.0,
    },

    "dschinn_wasser": {
        "core_color":    ( 40, 120, 220, 210),
        "glow_color":    ( 80, 160, 255, 150),
        "eye_color":     (180, 240, 255, 255),
        "trail_color":   ( 20,  80, 180, 190),
        "crown_color":   (120, 200, 255, 220),
        "crown_type":    "wave",
        "num_particles": 7,
        "glow_rings":    3,
        "size":          1.0,
    },

    "dschinn_luft": {
        "core_color":    (200, 230, 255, 180),
        "glow_color":    (220, 240, 255, 100),
        "eye_color":     (100, 200, 255, 255),
        "trail_color":   (180, 220, 255, 140),
        "crown_color":   (240, 250, 255, 200),
        "crown_type":    "wisp",
        "num_particles": 8,
        "glow_rings":    4,
        "size":          1.0,
    },

    "dschinn_erde": {
        "core_color":    (110,  80,  40, 235),
        "glow_color":    (150, 110,  60, 140),
        "eye_color":     ( 80, 200,  60, 255),
        "trail_color":   ( 80,  55,  25, 220),
        "crown_color":   (160, 120,  70, 230),
        "crown_type":    "rock",
        "num_particles": 5,
        "glow_rings":    2,
        "size":          1.0,
    },

    # ── Meister-Dschinne (größer, leuchtender) ───────────────────────────────

    "meisterdschinn_feuer": {
        "core_color":    (255,  70,   0, 245),
        "glow_color":    (255,  30,   0, 200),
        "eye_color":     (255, 255, 100, 255),
        "trail_color":   (220,  30,   0, 220),
        "crown_color":   (255, 220,  20, 255),
        "crown_type":    "flame",
        "num_particles": 8,
        "glow_rings":    4,
        "size":          1.4,
    },

    "meisterdschinn_wasser": {
        "core_color":    ( 20,  80, 200, 230),
        "glow_color":    ( 60, 140, 255, 180),
        "eye_color":     (220, 255, 255, 255),
        "trail_color":   ( 10,  50, 160, 210),
        "crown_color":   (100, 190, 255, 240),
        "crown_type":    "wave",
        "num_particles": 9,
        "glow_rings":    4,
        "size":          1.4,
    },

    "meisterdschinn_luft": {
        "core_color":    (230, 245, 255, 200),
        "glow_color":    (210, 235, 255, 120),
        "eye_color":     ( 80, 180, 255, 255),
        "trail_color":   (200, 230, 255, 160),
        "crown_color":   (255, 255, 255, 220),
        "crown_type":    "wisp",
        "num_particles": 10,
        "glow_rings":    5,
        "size":          1.4,
    },

    "meisterdschinn_erde": {
        "core_color":    (130,  95,  45, 245),
        "glow_color":    (170, 130,  70, 160),
        "eye_color":     (100, 220,  80, 255),
        "trail_color":   ( 95,  65,  28, 235),
        "crown_color":   (180, 140,  80, 240),
        "crown_type":    "rock",
        "num_particles": 7,
        "glow_rings":    3,
        "size":          1.4,
    },
}

# ─── Ikonen (64×64, mittlerer Frame, Vorderansicht) ──────────────────────────

def make_icon(cfg):
    frame = draw_dschinn_frame(cfg, 0, "front")
    # Leichtes Glow-Blur für Icon
    try:
        blurred = frame.filter(ImageFilter.GaussianBlur(1))
        result  = Image.alpha_composite(blurred, frame)
        return result.resize((64, 64), Image.NEAREST)
    except Exception:
        return frame

# ─── Build ────────────────────────────────────────────────────────────────────

os.makedirs("monsters", exist_ok=True)
os.makedirs("icons",    exist_ok=True)

print("Generiere DSA Dschinne & Meister-Dschinne...")

for name, cfg in DSCHINNE.items():
    rows  = make_dschinn_frames(cfg)
    sheet = make_sheet(rows)
    path  = f"monsters/{name}.png"
    sheet.save(path)
    print(f"  {path}  ({sheet.size[0]}×{sheet.size[1]}px)")

    icon      = make_icon(cfg)
    icon_path = f"icons/{name}_icon.png"
    icon.save(icon_path)
    print(f"  {icon_path}  (64×64 Icon)")

print(f"\nFertig! {len(DSCHINNE)} Dschinn-Sprites generiert.")
print("\nFoundry Token-Einstellungen:")
print("  Frame: 64×64 | Frames/Dir: 9 | Reihen: Unten=2, Links=1, Rechts=3, Oben=0")
print("\nTipp: Meister-Dschinne auf 2×2 Token-Größe setzen für mehr Präsenz!")
