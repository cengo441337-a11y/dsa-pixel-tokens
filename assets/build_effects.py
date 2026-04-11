"""
DSA Pixel Token - Effect Sprite Generator
Generates animated spell effect sprite sheets (horizontal, 1 row)
Run: python build_effects.py
"""

import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import math

FRAME_W = 64
FRAME_H = 64

def make_sheet(frames):
    """Combine list of RGBA images into horizontal sprite sheet."""
    sheet = Image.new("RGBA", (FRAME_W * len(frames), FRAME_H), (0,0,0,0))
    for i, f in enumerate(frames):
        sheet.paste(f.resize((FRAME_W, FRAME_H), Image.NEAREST), (i * FRAME_W, 0))
    return sheet

def radial_gradient(cx, cy, r, color, falloff=2.0):
    """Create a radial gradient circle as numpy array."""
    Y, X = np.ogrid[:FRAME_H, :FRAME_W]
    dist = np.sqrt((X - cx)**2 + (Y - cy)**2)
    alpha = np.clip(1.0 - (dist / max(r, 1)) ** falloff, 0, 1)
    r_ch = np.full((FRAME_H, FRAME_W), color[0], dtype=np.float32)
    g_ch = np.full((FRAME_H, FRAME_W), color[1], dtype=np.float32)
    b_ch = np.full((FRAME_H, FRAME_W), color[2], dtype=np.float32)
    a_ch = alpha * 255
    arr = np.stack([r_ch, g_ch, b_ch, a_ch], axis=2).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")

# ─── Feuerball (Projektil) ─────────────────────────────────────────────────────
def make_fireball(n_frames=8):
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        # Outer glow (orange)
        glow_r = 8 + int(t * 12)
        glow = radial_gradient(cx, cy, glow_r, (255, 120, 20), falloff=1.5)
        img = Image.alpha_composite(img, glow)
        # Core (bright yellow)
        core_r = 4 + int(t * 6)
        core = radial_gradient(cx, cy, core_r, (255, 240, 60), falloff=2.5)
        img = Image.alpha_composite(img, core)
        # Trailing sparks
        draw = ImageDraw.Draw(img)
        for s in range(4):
            sx = cx - int(t * 15) + np.random.randint(-3, 4)
            sy = cy + np.random.randint(-6, 7)
            spark_c = (255, np.random.randint(80, 180), 20, np.random.randint(120, 220))
            draw.ellipse([sx-2, sy-2, sx+2, sy+2], fill=spark_c)
        frames.append(img)
    return frames

# ─── Explosion ─────────────────────────────────────────────────────────────────
def make_explosion(n_frames=10):
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        fade = 1.0 - max(0, (t - 0.5) * 2)
        # Outer smoke ring
        smoke_r = int(5 + t * 28)
        smoke = radial_gradient(cx, cy, smoke_r, (80, 60, 50), falloff=0.8)
        smoke_arr = np.array(smoke)
        smoke_arr[:,:,3] = (smoke_arr[:,:,3] * fade * 0.6).astype(np.uint8)
        img = Image.alpha_composite(img, Image.fromarray(smoke_arr, "RGBA"))
        # Fire ball
        if t < 0.6:
            fire_r = int(4 + t * 22)
            fire = radial_gradient(cx, cy, fire_r, (255, int(60 + t*100), 10), falloff=1.8)
            fire_arr = np.array(fire)
            fire_arr[:,:,3] = (fire_arr[:,:,3] * (1 - t) * 1.2).clip(0,255).astype(np.uint8)
            img = Image.alpha_composite(img, Image.fromarray(fire_arr, "RGBA"))
        # Bright core
        if t < 0.3:
            core = radial_gradient(cx, cy, int(8 - t*20), (255, 240, 200), falloff=3.0)
            img = Image.alpha_composite(img, core)
        frames.append(img)
    return frames

# ─── Eissplitter / Frostblitz ──────────────────────────────────────────────────
def make_ice(n_frames=8):
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        draw = ImageDraw.Draw(img)
        fade = 1.0 - max(0, (t - 0.6) * 2.5)
        # Ice core
        r = int(4 + t * 10)
        glow = radial_gradient(cx, cy, r, (140, 200, 255), falloff=1.5)
        glow_arr = np.array(glow)
        glow_arr[:,:,3] = (glow_arr[:,:,3] * fade).astype(np.uint8)
        img = Image.alpha_composite(img, Image.fromarray(glow_arr, "RGBA"))
        # Ice shards (spikes)
        n_shards = 6
        for s in range(n_shards):
            angle = (s / n_shards) * 2 * math.pi + t * 0.5
            length = int(6 + t * 16)
            ex = int(cx + math.cos(angle) * length)
            ey = int(cy + math.sin(angle) * length)
            alpha_val = int(200 * fade)
            color = (180, 230, 255, alpha_val)
            draw.line([(cx, cy), (ex, ey)], fill=color, width=2)
            # Shard tip
            draw.ellipse([ex-2, ey-2, ex+2, ey+2], fill=(220, 245, 255, alpha_val))
        # Center bright
        bright = radial_gradient(cx, cy, int(3 + t*4), (255, 255, 255), falloff=3.0)
        bright_arr = np.array(bright)
        bright_arr[:,:,3] = (bright_arr[:,:,3] * fade).astype(np.uint8)
        img = Image.alpha_composite(img, Image.fromarray(bright_arr, "RGBA"))
        frames.append(img)
    return frames

# ─── Blitz ─────────────────────────────────────────────────────────────────────
def make_lightning(n_frames=6):
    rng = np.random.default_rng(42)
    frames = []
    for i in range(n_frames):
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        draw = ImageDraw.Draw(img)
        if i < 4:
            # Draw zigzag bolt from top to bottom
            x = FRAME_W // 2
            y = 4
            alpha = 255 if i % 2 == 0 else 160
            pts = [(x, y)]
            while y < FRAME_H - 8:
                y += rng.integers(6, 14)
                x += rng.integers(-10, 11)
                x = max(8, min(FRAME_W-8, x))
                pts.append((x, min(y, FRAME_H-4)))
            # Glow (outer, white-blue)
            for j in range(len(pts)-1):
                draw.line([pts[j], pts[j+1]], fill=(180, 200, 255, int(alpha*0.5)), width=5)
            # Core (bright white)
            for j in range(len(pts)-1):
                draw.line([pts[j], pts[j+1]], fill=(255, 255, 220, alpha), width=2)
        # Flash frame: bright overall glow
        if i == 1:
            flash = radial_gradient(FRAME_W//2, FRAME_H//2, 25, (200, 210, 255), falloff=1.2)
            flash_arr = np.array(flash)
            flash_arr[:,:,3] = (flash_arr[:,:,3] * 0.4).astype(np.uint8)
            img = Image.alpha_composite(flash, img)
        frames.append(img)
    return frames

# ─── Heilung ───────────────────────────────────────────────────────────────────
def make_heal(n_frames=8):
    rng = np.random.default_rng(7)
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        draw = ImageDraw.Draw(img)
        # Rising sparkles
        for s in range(8):
            sx = int(cx + math.sin(s * 0.8 + t * 4) * (10 + s * 2))
            sy = int(cy + 20 - t * 40 + s * 3)
            if 0 <= sx < FRAME_W and 0 <= sy < FRAME_H:
                fade = 1.0 - abs(t - 0.5) * 2
                alpha = int(200 * max(0, fade))
                color = (int(80 + s*15), 255, int(100 + s*10), alpha)
                draw.ellipse([sx-2, sy-2, sx+2, sy+2], fill=color)
        # Central glow
        r = int(4 + math.sin(t * math.pi) * 12)
        glow = radial_gradient(cx, cy, r, (120, 255, 150), falloff=2.0)
        glow_arr = np.array(glow)
        fade_val = math.sin(t * math.pi)
        glow_arr[:,:,3] = (glow_arr[:,:,3] * fade_val * 0.7).astype(np.uint8)
        img = Image.alpha_composite(img, Image.fromarray(glow_arr, "RGBA"))
        frames.append(img)
    return frames

# ─── Gift / Säurewolke ─────────────────────────────────────────────────────────
def make_poison(n_frames=8):
    rng = np.random.default_rng(13)
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        draw = ImageDraw.Draw(img)
        # Expanding cloud
        r = int(6 + t * 20)
        fade = 1.0 - max(0, t - 0.5) * 2
        for blob in range(5):
            bx = cx + int(math.sin(blob * 1.3 + t * 2) * r * 0.5)
            by = cy + int(math.cos(blob * 1.1 + t * 1.5) * r * 0.4)
            br = int(r * 0.4 + blob * 2)
            glow = radial_gradient(bx, by, br, (40, 180, 40), falloff=1.3)
            g_arr = np.array(glow)
            g_arr[:,:,3] = (g_arr[:,:,3] * fade * 0.6).astype(np.uint8)
            img = Image.alpha_composite(img, Image.fromarray(g_arr, "RGBA"))
        # Bubbles
        for b in range(4):
            bx = cx + rng.integers(-15, 16)
            by = cy + rng.integers(-15, 16)
            alpha = int(180 * fade)
            draw.ellipse([bx-3, by-3, bx+3, by+3],
                         outline=(100, 255, 80, alpha), width=1)
        frames.append(img)
    return frames

# ─── Schatten / Dunkle Magie ───────────────────────────────────────────────────
def make_shadow(n_frames=8):
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        # Expanding dark vortex
        r = int(4 + t * 24)
        fade = 1.0 - max(0, t - 0.6) * 2.5
        outer = radial_gradient(cx, cy, r, (60, 0, 100), falloff=0.8)
        o_arr = np.array(outer)
        o_arr[:,:,3] = (o_arr[:,:,3] * fade * 0.8).astype(np.uint8)
        img = Image.alpha_composite(img, Image.fromarray(o_arr, "RGBA"))
        # Inner dark core
        core = radial_gradient(cx, cy, max(1, int(r * 0.5)), (10, 0, 20), falloff=1.5)
        c_arr = np.array(core)
        c_arr[:,:,3] = (c_arr[:,:,3] * fade).astype(np.uint8)
        img = Image.alpha_composite(img, Image.fromarray(c_arr, "RGBA"))
        # Purple rim
        draw = ImageDraw.Draw(img)
        for p in range(6):
            angle = p / 6 * 2 * math.pi + t * 3
            px_ = int(cx + math.cos(angle) * r)
            py_ = int(cy + math.sin(angle) * r)
            if 0 <= px_ < FRAME_W and 0 <= py_ < FRAME_H:
                draw.ellipse([px_-2, py_-2, px_+2, py_+2],
                             fill=(160, 20, 220, int(200 * fade)))
        frames.append(img)
    return frames

# ─── Wasser / Aqua ────────────────────────────────────────────────────────────
def make_water(n_frames=8):
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        draw = ImageDraw.Draw(img)
        fade = math.sin(t * math.pi)
        # Water ring expanding
        r = int(4 + t * 22)
        ring_glow = radial_gradient(cx, cy, r, (40, 120, 220), falloff=1.0)
        inner = radial_gradient(cx, cy, max(1, r-6), (40, 120, 220), falloff=1.0)
        # Subtract inner to make ring
        r_arr = np.array(ring_glow, dtype=np.float32)
        i_arr = np.array(inner, dtype=np.float32)
        ring_arr = r_arr.copy()
        ring_arr[:,:,3] = np.clip(r_arr[:,:,3] - i_arr[:,:,3], 0, 255) * fade
        img = Image.alpha_composite(img, Image.fromarray(ring_arr.astype(np.uint8), "RGBA"))
        # Droplets
        for d in range(5):
            angle = d / 5 * 2 * math.pi + t
            dx = int(cx + math.cos(angle) * (r + 4))
            dy = int(cy + math.sin(angle) * (r + 4))
            if 0 <= dx < FRAME_W and 0 <= dy < FRAME_H:
                draw.ellipse([dx-2, dy-2, dx+2, dy+2],
                             fill=(100, 180, 255, int(200 * fade)))
        frames.append(img)
    return frames

# ─── Flammenpfeil (schlanker Feuer-Pfeil, Projektil) ─────────────────────────
def make_flammenpfeil(n_frames=7):
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        # Elongated flame core (horizontal)
        glow_rx, glow_ry = int(14 + t*4), int(5 + t*2)
        for dx in range(-glow_rx, glow_rx+1):
            for dy in range(-glow_ry, glow_ry+1):
                dist = math.sqrt((dx/glow_rx)**2 + (dy/glow_ry)**2) if glow_rx > 0 else 1
                if dist < 1:
                    falloff = (1 - dist)**1.4
                    px_, py_ = cx + dx, cy + dy
                    if 0 <= px_ < FRAME_W and 0 <= py_ < FRAME_H:
                        a = int(220 * falloff)
                        r_ch = int(255 * falloff)
                        g_ch = int((80 + t*100) * falloff)
                        img.putpixel((px_, py_), (r_ch, g_ch, 10, a))
        # Bright tip
        tip_x = cx + glow_rx - 2
        core = radial_gradient(tip_x, cy, int(3 + t*2), (255, 240, 80), falloff=3.0)
        img = Image.alpha_composite(img, core)
        # Trailing smoke
        draw = ImageDraw.Draw(img)
        for s in range(3):
            sx = cx - glow_rx - int(t * 8) + np.random.randint(-2, 3)
            sy = cy + np.random.randint(-3, 4)
            draw.ellipse([sx-2, sy-2, sx+2, sy+2],
                         fill=(60, 40, 20, np.random.randint(60, 120)))
        frames.append(img)
    return frames

# ─── Donnerkeil / Fulminictus (Blitzeinschlag + Schockwelle) ──────────────────
def make_donnerkeil(n_frames=10):
    rng = np.random.default_rng(99)
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        # ── All composites first ──────────────────────────────────────────────
        if i == 0:
            fa = np.array(radial_gradient(cx, cy, 28, (255, 255, 255), falloff=1.0))
            fa[:,:,3] = (fa[:,:,3] * 0.9).astype(np.uint8)
            img = Image.alpha_composite(img, Image.fromarray(fa, "RGBA"))
        if i < 4:
            g_r = max(1, int(12 - i*2))
            ga = np.array(radial_gradient(cx, cy, g_r, (200, 220, 255), falloff=2.0))
            ga[:,:,3] = (ga[:,:,3] * max(0, 0.8 - i*0.15)).clip(0,255).astype(np.uint8)
            img = Image.alpha_composite(img, Image.fromarray(ga, "RGBA"))
        # ── Draw after all composites ─────────────────────────────────────────
        draw = ImageDraw.Draw(img)
        if i < 5:
            x, y = cx, 2
            pts = [(x, y)]
            while y < FRAME_H - 8:
                y += rng.integers(8, 16)
                x += rng.integers(-12, 13)
                x = max(4, min(FRAME_W-4, x))
                pts.append((x, min(y, FRAME_H-4)))
            alpha = 255 if i < 3 else 120
            for j in range(len(pts)-1):
                draw.line([pts[j], pts[j+1]], fill=(180, 210, 255, int(alpha*0.6)), width=6)
            for j in range(len(pts)-1):
                draw.line([pts[j], pts[j+1]], fill=(255, 255, 220, alpha), width=2)
        if i >= 2:
            ring_r = int((i - 2) * 7)
            fade   = max(0, 1.0 - (i - 2) / 6)
            draw.ellipse([cx-ring_r, cy-ring_r, cx+ring_r, cy+ring_r],
                         outline=(200, 220, 255, int(200 * fade)), width=3)
        frames.append(img)
    return frames

# ─── Armatrutz (goldener Schutzkreis) ─────────────────────────────────────────
def make_armatrutz(n_frames=10):
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        draw = ImageDraw.Draw(img)
        pulse = math.sin(t * math.pi * 2) * 0.3 + 0.7
        # Expanding outer ring
        r1 = int(20 + math.sin(t * math.pi) * 6)
        a1 = int(180 * pulse * (1 - max(0, t - 0.7) * 3))
        draw.ellipse([cx-r1, cy-r1, cx+r1, cy+r1],
                     outline=(255, 210, 50, a1), width=3)
        # Inner glow ring
        r2 = int(r1 * 0.65)
        draw.ellipse([cx-r2, cy-r2, cx+r2, cy+r2],
                     outline=(255, 240, 120, int(a1 * 0.7)), width=2)
        # Corner runes (4 glowing dots at cardinal positions)
        for ang in range(0, 360, 90):
            rad = math.radians(ang + t * 45)
            px_ = int(cx + math.cos(rad) * r1)
            py_ = int(cy + math.sin(rad) * r1)
            if 0 <= px_ < FRAME_W and 0 <= py_ < FRAME_H:
                draw.ellipse([px_-3, py_-3, px_+3, py_+3],
                             fill=(255, 230, 80, int(200 * pulse)))
        # Soft gold fill
        glow = radial_gradient(cx, cy, r2, (200, 160, 30), falloff=2.0)
        g_arr = np.array(glow)
        g_arr[:,:,3] = (g_arr[:,:,3] * 0.2 * pulse).astype(np.uint8)
        img = Image.alpha_composite(img, Image.fromarray(g_arr, "RGBA"))
        frames.append(img)
    return frames

# ─── Balsam Salabunde (rosa/goldener Heilregen) ───────────────────────────────
def make_balsamsal(n_frames=10):
    rng = np.random.default_rng(17)
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        fade_val = math.sin(t * math.pi)
        # ── All composites first ──────────────────────────────────────────────
        r = int(6 + fade_val * 14)
        g_arr = np.array(radial_gradient(cx, cy, r, (220, 100, 160), falloff=2.0))
        g_arr[:,:,3] = (g_arr[:,:,3] * fade_val * 0.6).astype(np.uint8)
        img = Image.alpha_composite(img, Image.fromarray(g_arr, "RGBA"))
        if t < 0.5:
            bright_r = int(4 + t * 8)
            b_arr = np.array(radial_gradient(cx, cy, bright_r, (255, 240, 255), falloff=3.0))
            b_arr[:,:,3] = (b_arr[:,:,3] * (0.5 - t) * 2).astype(np.uint8)
            img = Image.alpha_composite(img, Image.fromarray(b_arr, "RGBA"))
        # ── Draw after all composites ─────────────────────────────────────────
        draw = ImageDraw.Draw(img)
        for s in range(12):
            sx = int(cx + math.sin(s*0.7 + t*5) * (12 + s*1.5))
            sy = int(cy + 22 - t*44 + s*2)
            if 0 <= sx < FRAME_W and 0 <= sy < FRAME_H:
                alpha = int(220 * max(0, fade_val))
                color = (255, 210, 50, alpha) if s % 2 == 0 else (230, 100, 170, alpha)
                draw.ellipse([sx-2, sy-2, sx+2, sy+2], fill=color)
        frames.append(img)
    return frames

# ─── Horriphobus (Angst — schwarze Tentakel) ──────────────────────────────────
def make_horriphobus(n_frames=9):
    rng = np.random.default_rng(66)
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        fade = 1.0 - max(0, (t - 0.6) * 2.5)
        r = int(3 + t * 14)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        # ── All composites first ──────────────────────────────────────────────
        v_arr = np.array(radial_gradient(cx, cy, r, (5, 0, 10), falloff=1.2))
        v_arr[:,:,3] = (v_arr[:,:,3] * fade * 0.9).astype(np.uint8)
        img = Image.alpha_composite(img, Image.fromarray(v_arr, "RGBA"))
        # ── Draw after all composites ─────────────────────────────────────────
        draw = ImageDraw.Draw(img)
        for s in range(8):
            base_angle = (s / 8) * 2 * math.pi
            tx, ty = cx, cy
            n_segs = int(3 + t * 4)
            for seg in range(n_segs):
                seg_t = (seg + 1) / n_segs
                angle = base_angle + rng.uniform(-0.35, 0.35)
                length = int(t * 22 * seg_t)
                ex = max(1, min(FRAME_W-1, int(cx + math.cos(angle) * length)))
                ey = max(1, min(FRAME_H-1, int(cy + math.sin(angle) * length)))
                a_val = int(200 * fade * (1 - seg_t * 0.4))
                col = (int(40 + seg_t*40), 0, int(60 + seg_t*30), a_val)
                draw.line([(tx, ty), (ex, ey)], fill=col, width=2)
                tx, ty = ex, ey
        if t > 0.2:
            for e in range(3):
                ang = e / 3 * 2 * math.pi + t * 1.5
                ex_ = int(cx + math.cos(ang) * (r * 0.6))
                ey_ = int(cy + math.sin(ang) * (r * 0.6))
                draw.ellipse([ex_-3, ey_-3, ex_+3, ey_+3],
                             fill=(240, 30, 30, int(220 * fade)))
        frames.append(img)
    return frames

# ─── Invocatio (Beschwörungs-Pentagramm) ──────────────────────────────────────
def make_invocatio(n_frames=12):
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        draw = ImageDraw.Draw(img)
        fade = math.sin(t * math.pi)
        r = int(22 + math.sin(t * math.pi * 1.5) * 4)
        # Outer ring
        a_ring = int(200 * fade)
        draw.ellipse([cx-r, cy-r, cx+r, cy+r],
                     outline=(160, 60, 220, a_ring), width=2)
        # Pentagram lines
        pts5 = []
        for p in range(5):
            ang = (p / 5) * 2 * math.pi - math.pi/2 + t * 0.8
            pts5.append((cx + math.cos(ang) * r, cy + math.sin(ang) * r))
        star_order = [0, 2, 4, 1, 3, 0]
        for k in range(len(star_order)-1):
            pa = pts5[star_order[k]]
            pb = pts5[star_order[k+1]]
            draw.line([pa, pb], fill=(180, 80, 240, int(160 * fade)), width=1)
        # Corner rune glows
        for p_pt in pts5:
            px_, py_ = int(p_pt[0]), int(p_pt[1])
            if 0 <= px_ < FRAME_W and 0 <= py_ < FRAME_H:
                draw.ellipse([px_-3, py_-3, px_+3, py_+3],
                             fill=(220, 120, 255, int(200 * fade)))
        # Central vortex
        inner_r = int(4 + math.sin(t * math.pi * 3) * 3)
        inner = radial_gradient(cx, cy, inner_r, (180, 60, 240), falloff=2.5)
        i_arr = np.array(inner)
        i_arr[:,:,3] = (i_arr[:,:,3] * fade * 0.8).astype(np.uint8)
        img = Image.alpha_composite(img, Image.fromarray(i_arr, "RGBA"))
        frames.append(img)
    return frames

# ─── Daemonenbann / Heiliger Burst ────────────────────────────────────────────
def make_daemonenbann(n_frames=8):
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        fade = 1.0 - max(0, (t - 0.4) * 1.8)
        # ── All composites first ──────────────────────────────────────────────
        if t < 0.5:
            core_r = int(10 - t * 14)
            if core_r > 0:
                c_arr = np.array(radial_gradient(cx, cy, core_r, (255, 255, 230), falloff=2.5))
                c_arr[:,:,3] = (c_arr[:,:,3] * fade).astype(np.uint8)
                img = Image.alpha_composite(img, Image.fromarray(c_arr, "RGBA"))
        # ── Draw after all composites ─────────────────────────────────────────
        draw = ImageDraw.Draw(img)
        beam_len = int(t * 28)
        beam_w   = max(1, int(6 - t * 4))
        for ang in [0, 90, 180, 270]:
            rad = math.radians(ang)
            draw.line([(cx, cy),
                       (int(cx + math.cos(rad)*beam_len), int(cy + math.sin(rad)*beam_len))],
                      fill=(255, 240, 120, int(220 * fade)), width=beam_w)
        for ang in [45, 135, 225, 315]:
            rad = math.radians(ang)
            d = int(beam_len * 0.7)
            draw.line([(cx, cy),
                       (int(cx + math.cos(rad)*d), int(cy + math.sin(rad)*d))],
                      fill=(255, 255, 180, int(150 * fade)), width=max(1, beam_w-2))
        ring_r = int(t * 26)
        if ring_r > 0:
            draw.ellipse([cx-ring_r, cy-ring_r, cx+ring_r, cy+ring_r],
                         outline=(255, 230, 100, int(180 * fade * 0.6)), width=2)
        frames.append(img)
    return frames

# ─── Motoricus (Telekinese — blaues Energiefeld) ──────────────────────────────
def make_motoricus(n_frames=8):
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        draw = ImageDraw.Draw(img)
        fade = math.sin(t * math.pi)
        spin = t * 2 * math.pi * 1.5
        # Spinning arcs
        for arc in range(3):
            base_ang = arc / 3 * 2 * math.pi + spin
            r = int(16 + arc * 3)
            # Arc segment (draw as series of dots along arc)
            for dot in range(20):
                dot_ang = base_ang + dot / 20 * math.pi
                dx = int(cx + math.cos(dot_ang) * r)
                dy = int(cy + math.sin(dot_ang) * r)
                if 0 <= dx < FRAME_W and 0 <= dy < FRAME_H:
                    a_val = int(200 * fade * (dot / 20))
                    bright = 180 + int(75 * (1 - dot/20))
                    draw.ellipse([dx-1, dy-1, dx+1, dy+1],
                                 fill=(50, bright, 255, a_val))
        # Central dot
        core = radial_gradient(cx, cy, int(4 + fade*4), (80, 160, 255), falloff=2.5)
        c_arr = np.array(core)
        c_arr[:,:,3] = (c_arr[:,:,3] * fade * 0.9).astype(np.uint8)
        img = Image.alpha_composite(img, Image.fromarray(c_arr, "RGBA"))
        frames.append(img)
    return frames

# ─── Visibili (Unsichtbarkeit — silbernes Flimmern) ───────────────────────────
def make_visibili(n_frames=8):
    rng = np.random.default_rng(55)
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        draw = ImageDraw.Draw(img)
        # Fading shimmer — brightest mid-animation then fades away
        peak = 1.0 - abs(t - 0.35) * 2.5
        fade = max(0, peak)
        # Shimmer particles
        for s in range(20):
            sx = rng.integers(cx - 20, cx + 21)
            sy = rng.integers(cy - 24, cy + 25)
            sz = rng.integers(1, 4)
            a_val = int(230 * fade * rng.uniform(0.4, 1.0))
            lum = rng.integers(180, 256)
            draw.ellipse([sx-sz, sy-sz, sx+sz, sy+sz],
                         fill=(lum, lum, 255, a_val))
        # Outline shimmer ring
        r = int(18 + t * 4)
        for p in range(24):
            ang = p / 24 * 2 * math.pi + t * 2
            px_ = int(cx + math.cos(ang) * r)
            py_ = int(cy + math.sin(ang) * r)
            if 0 <= px_ < FRAME_W and 0 <= py_ < FRAME_H:
                a_val = int(200 * fade * (0.5 + 0.5 * math.sin(ang * 3 + t * 8)))
                draw.ellipse([px_-1, py_-1, px_+1, py_+1],
                             fill=(220, 230, 255, a_val))
        frames.append(img)
    return frames

# ─── Odem Arcanum (Magieatem — blauer Nebelhauch) ─────────────────────────────
def make_odem(n_frames=10):
    rng = np.random.default_rng(33)
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        fade = math.sin(t * math.pi)
        # Expanding mist cloud (multiple overlapping blobs)
        for blob in range(6):
            bx = cx + int(math.cos(blob * 1.05 + t * 1.5) * (t * 16))
            by = cy + int(math.sin(blob * 0.9  + t * 1.2) * (t * 10))
            br = int(5 + t * 12 + blob * 1.5)
            col = (60 + blob * 12, 120 + blob * 8, 220, 0)
            glow = radial_gradient(bx, by, br, (60 + blob*12, 120 + blob*8, 220), falloff=1.2)
            g_arr = np.array(glow)
            g_arr[:,:,3] = (g_arr[:,:,3] * fade * 0.45).astype(np.uint8)
            img = Image.alpha_composite(img, Image.fromarray(g_arr, "RGBA"))
        # Bright mana sparks
        draw = ImageDraw.Draw(img)
        for s in range(5):
            sx = int(cx + math.sin(s * 1.3 + t * 6) * (8 + s * 2))
            sy = int(cy + math.cos(s * 1.1 + t * 4) * (6 + s * 1.5))
            if 0 <= sx < FRAME_W and 0 <= sy < FRAME_H:
                a_val = int(200 * fade)
                draw.ellipse([sx-2, sy-2, sx+2, sy+2],
                             fill=(160, 200, 255, a_val))
        frames.append(img)
    return frames

# ─── Brennen (anhaltende Feuerapura / Ignifaxius-Zieleffekt) ─────────────────
def make_brennen(n_frames=10):
    rng = np.random.default_rng(77)
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        draw = ImageDraw.Draw(img)
        # Ring of fire around token position
        for flame in range(10):
            ang = (flame / 10) * 2 * math.pi + t * 3.5
            r = 18 + int(math.sin(t * math.pi * 2 + flame * 0.7) * 4)
            fx_ = int(cx + math.cos(ang) * r)
            fy_ = int(cy + math.sin(ang) * r)
            # Flame column rising upward
            flame_h = rng.integers(4, 14)
            for fh in range(flame_h):
                px_ = fx_ + rng.integers(-1, 2)
                py_ = fy_ - fh
                if 0 <= px_ < FRAME_W and 0 <= py_ < FRAME_H:
                    fade_h = 1 - fh / flame_h
                    heat = 1 - fh / flame_h * 0.6
                    r_ch = int(255 * heat)
                    g_ch = int((30 + fh * 12) * heat)
                    a_val = int(200 * fade_h)
                    draw.point((px_, py_), fill=(r_ch, g_ch, 0, a_val))
        # Inner ember glow
        glow = radial_gradient(cx, cy, 16, (200, 60, 10), falloff=1.5)
        g_arr = np.array(glow)
        g_arr[:,:,3] = (g_arr[:,:,3] * 0.25).astype(np.uint8)
        img = Image.alpha_composite(img, Image.fromarray(g_arr, "RGBA"))
        frames.append(img)
    return frames

# ─── Schattenform / Schatten-Werden (Token verschwindet in Dunkelheit) ────────
def make_schattenform(n_frames=10):
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        r    = int((t * 2 * 26) if t < 0.5 else ((1-(t-0.5)*2)*26))
        fade = (t * 2)          if t < 0.5 else (1-(t-0.5)*2)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        # ── All composites first ──────────────────────────────────────────────
        if r > 0:
            o_arr = np.array(radial_gradient(cx, cy, r, (10, 0, 20), falloff=0.6))
            o_arr[:,:,3] = (o_arr[:,:,3] * fade * 0.85).astype(np.uint8)
            img = Image.alpha_composite(img, Image.fromarray(o_arr, "RGBA"))
        if t > 0.7:
            void_r = int((t - 0.7) * 3 * 10)
            if void_r > 0:
                v_arr = np.array(radial_gradient(cx, cy, void_r, (60, 0, 100), falloff=2.0))
                v_arr[:,:,3] = (v_arr[:,:,3] * (t-0.7)*3).astype(np.uint8)
                img = Image.alpha_composite(img, Image.fromarray(v_arr, "RGBA"))
        # ── Draw tendrils after all composites ────────────────────────────────
        draw = ImageDraw.Draw(img)
        for s in range(12):
            ang    = (s / 12) * 2 * math.pi + t * 5
            length = max(1, int(r * 0.85))
            for seg in range(length):
                seg_t   = seg / length
                cur_ang = ang + seg_t * 0.6
                d       = int(r * seg_t)
                px_     = int(cx + math.cos(cur_ang) * d)
                py_     = int(cy + math.sin(cur_ang) * d)
                if 0 <= px_ < FRAME_W and 0 <= py_ < FRAME_H:
                    a_val = int(200 * fade * (1 - seg_t * 0.5))
                    col   = (int(25 + seg_t*25), 0, int(40 + seg_t*35), a_val)
                    draw.point((px_, py_), fill=col)
        frames.append(img)
    return frames

# ─── Turbomagia / Windbraut / Aerofurore (Windhose) ──────────────────────────
def make_wind(n_frames=8):
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        draw = ImageDraw.Draw(img)
        fade = math.sin(t * math.pi)
        spin = t * 2 * math.pi * 2.5
        # Spiraling wind streaks
        for layer in range(3):
            r_base = 8 + layer * 6
            for dot in range(30):
                dot_t = dot / 30
                spiral_r = r_base + dot_t * (14 - layer * 3)
                spiral_ang = spin + dot_t * 2 * math.pi * (1.5 - layer * 0.3)
                # Vertical offset (funnel shape)
                vert = int((dot_t - 0.5) * 30)
                px_ = int(cx + math.cos(spiral_ang) * spiral_r)
                py_ = int(cy + vert + math.sin(spiral_ang) * spiral_r * 0.35)
                if 0 <= px_ < FRAME_W and 0 <= py_ < FRAME_H:
                    a_val = int(170 * fade * (1 - dot_t * 0.4))
                    lum = 180 + layer * 20
                    draw.ellipse([px_-1, py_-1, px_+1, py_+1],
                                 fill=(lum, lum+10, lum+20, a_val))
        frames.append(img)
    return frames

# ─── Paralysis / Corpofesso (goldene Stasis) ──────────────────────────────────
def make_paralysis(n_frames=9):
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        draw = ImageDraw.Draw(img)
        fade = 1.0 - max(0, (t - 0.6) * 2.5)
        # Lightning cage bars (horizontal/vertical lines)
        cage_r = int(12 + t * 6)
        # 4 sides of cage lightning
        for side in range(4):
            ang_start = side * math.pi / 2
            # Jagged line along side
            for seg in range(8):
                seg_t = seg / 8
                a1 = ang_start + seg_t * math.pi / 2
                a2 = ang_start + (seg_t + 1/8) * math.pi / 2
                noise = (seg % 2 - 0.5) * 4
                px1 = int(cx + math.cos(a1) * (cage_r + noise))
                py1 = int(cy + math.sin(a1) * (cage_r + noise))
                px2 = int(cx + math.cos(a2) * (cage_r - noise))
                py2 = int(cy + math.sin(a2) * (cage_r - noise))
                a_val = int(200 * fade)
                draw.line([(px1, py1), (px2, py2)],
                          fill=(255, 220, 60, a_val), width=2)
        # Center glow
        inner = radial_gradient(cx, cy, int(8 - t * 4), (255, 200, 50), falloff=2.5)
        i_arr = np.array(inner)
        i_arr[:,:,3] = (i_arr[:,:,3] * fade * 0.5).astype(np.uint8)
        img = Image.alpha_composite(img, Image.fromarray(i_arr, "RGBA"))
        frames.append(img)
    return frames

# ─── Silentium (Stille-Blase / Schweigen) ─────────────────────────────────────
def make_silentium(n_frames=9):
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        fade = math.sin(t * math.pi)
        r    = int(18 + math.sin(t * math.pi * 1.2) * 4)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        # ── All composites first ──────────────────────────────────────────────
        g_arr = np.array(radial_gradient(cx, cy, r, (210, 215, 240), falloff=0.5))
        g_arr[:,:,3] = (g_arr[:,:,3] * fade * 0.12).astype(np.uint8)
        img = Image.alpha_composite(img, Image.fromarray(g_arr, "RGBA"))
        # ── Draw after all composites ─────────────────────────────────────────
        draw = ImageDraw.Draw(img)
        draw.ellipse([cx-r, cy-r, cx+r, cy+r],
                     outline=(200, 200, 220, int(150 * fade)), width=2)
        if t > 0.3:
            wave_fade = min(1.0, (t - 0.3) * 2) * fade
            for dot in range(4):
                ang = dot / 4 * 2 * math.pi + t
                dx  = int(cx + math.cos(ang) * (r * 0.5))
                dy  = int(cy + math.sin(ang) * (r * 0.5))
                if 0 <= dx < FRAME_W and 0 <= dy < FRAME_H:
                    draw.ellipse([dx-3, dy-3, dx+3, dy+3],
                                 fill=(180, 180, 200, int(160 * wave_fade)))
                    draw.line([(dx-4, dy-4), (dx+4, dy+4)],
                              fill=(230, 60, 60, int(200 * wave_fade)), width=2)
                    draw.line([(dx+4, dy-4), (dx-4, dy+4)],
                              fill=(230, 60, 60, int(200 * wave_fade)), width=2)
        frames.append(img)
    return frames

# ─── Portal Öffnen (magisches Dimensionstor) ──────────────────────────────────
def make_portal(n_frames=12):
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t       = i / (n_frames - 1)
        open_t  = min(1.0, t * 2)
        close_t = max(0, (t - 0.75) * 4)
        w = max(1, int(open_t * 26 * (1 - close_t * 0.7)))
        h = max(1, int(26 * (1 - close_t * 0.3)))
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        # ── All composites first ──────────────────────────────────────────────
        f_arr = np.array(radial_gradient(cx, cy, max(w-2, 1), (30, 10, 120), falloff=0.7))
        mask  = Image.new("L", (FRAME_W, FRAME_H), 0)
        ImageDraw.Draw(mask).ellipse([cx-w, cy-h, cx+w, cy+h], fill=200)
        f_arr[:,:,3] = (np.array(mask, dtype=np.float32)/255 * 0.55 * (1-close_t) * 255).astype(np.uint8)
        img = Image.alpha_composite(img, Image.fromarray(f_arr, "RGBA"))
        e_arr = np.array(radial_gradient(cx, cy, max(w+6, 3), (100, 50, 230), falloff=1.8))
        e_arr[:,:,3] = (e_arr[:,:,3] * 0.3 * (1-close_t) * open_t).astype(np.uint8)
        img = Image.alpha_composite(img, Image.fromarray(e_arr, "RGBA"))
        # ── Draw after all composites ─────────────────────────────────────────
        draw  = ImageDraw.Draw(img)
        a_ring = int(220 * (1 - close_t))
        draw.ellipse([cx-w, cy-h, cx+w, cy+h], outline=(80, 30, 200, a_ring), width=3)
        spin = t * 2 * math.pi * 2
        for dot in range(16):
            dot_ang = dot / 16 * 2 * math.pi + spin
            px_ = int(cx + math.cos(dot_ang) * w)
            py_ = int(cy + math.sin(dot_ang) * h)
            if 0 <= px_ < FRAME_W and 0 <= py_ < FRAME_H:
                a_dot = int(220 * (1 - close_t) * open_t)
                lum_r = 140 + int(math.sin(dot_ang * 3) * 60)
                draw.ellipse([px_-3, py_-3, px_+3, py_+3],
                             fill=(lum_r, 60, 255, a_dot))
        frames.append(img)
    return frames

# ─── Planasphere / Astralfenster (Rift in der Realität, exotisch) ─────────────
def make_planastral(n_frames=14):
    rng = np.random.default_rng(42)
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        if t < 0.3:
            tear_t, hold_t, col_t = t / 0.3,        0.0,              0.0
        elif t < 0.7:
            tear_t, hold_t, col_t = 1.0,             (t-0.3)/0.4,     0.0
        else:
            tear_t, hold_t, col_t = 1.0,             1.0,             (t-0.7)/0.3
        rift_w = max(1, int(tear_t * 20 * (1 - col_t * 0.8)))
        rift_h = max(1, int(tear_t * 28 * (1 - col_t * 0.5)))
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        # ── All composites first ──────────────────────────────────────────────
        if rift_w > 1:
            f_arr = np.array(radial_gradient(cx, cy, rift_w, (80, 0, 160), falloff=0.5))
            mask  = Image.new("L", (FRAME_W, FRAME_H), 0)
            ImageDraw.Draw(mask).ellipse([cx-rift_w, cy-rift_h, cx+rift_w, cy+rift_h], fill=220)
            f_arr[:,:,3] = (np.array(mask, dtype=np.float32)/255 * 0.7*(1-col_t)*255).astype(np.uint8)
            img = Image.alpha_composite(img, Image.fromarray(f_arr, "RGBA"))
        halo_r = int(rift_w * 1.5 + 4)
        if halo_r > 0:
            h_arr = np.array(radial_gradient(cx, cy, halo_r, (120, 20, 200), falloff=2.0))
            h_arr[:,:,3] = (h_arr[:,:,3] * 0.35 * tear_t * (1-col_t)).astype(np.uint8)
            img = Image.alpha_composite(img, Image.fromarray(h_arr, "RGBA"))
        # ── Draw after all composites ─────────────────────────────────────────
        draw = ImageDraw.Draw(img)
        # Chromatic rift edges
        a_val = int(220 * (1 - col_t) * tear_t)
        for y in range(FRAME_H):
            jag = int(math.sin(y * 0.25 + t * 8) * 3 * tear_t)
            lx  = cx - rift_w + jag
            if 0 <= lx < FRAME_W:
                draw.point((lx, y), fill=(255, 80, 20, a_val))
            rx = cx + rift_w + int(math.sin(y * 0.25 + t * 8 + math.pi) * 3 * tear_t)
            if 0 <= rx < FRAME_W:
                draw.point((rx, y), fill=(40, 160, 255, a_val))
        # Energy sparks
        if hold_t > 0.2:
            dist = int((hold_t - 0.2) * 22)
            for s in range(8):
                ang = (s / 8) * 2 * math.pi + t * 1.5
                px_ = max(0, min(FRAME_W-1, int(cx + math.cos(ang) * dist)))
                py_ = max(0, min(FRAME_H-1, int(cy + math.sin(ang) * dist * 0.5)))
                star_c = (rng.integers(150,256), rng.integers(0,100), 255, int(220*(1-col_t)))
                draw.ellipse([px_-3, py_-3, px_+3, py_+3], fill=star_c)
        frames.append(img)
    return frames

# ─── Verwandlung / Metamorpho (Transformations-Wirbel) ───────────────────────
def make_verwandlung(n_frames=10):
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        draw = ImageDraw.Draw(img)
        fade = math.sin(t * math.pi)
        spin = t * 2 * math.pi * 3
        # Multi-colored spiral particles
        colors = [(120, 220, 80), (80, 180, 255), (220, 80, 255), (255, 180, 30)]
        for c_idx, col in enumerate(colors):
            r_base = 6 + c_idx * 4
            for dot in range(20):
                dot_t = dot / 20
                spiral_r = r_base + dot_t * 12
                dot_ang  = spin + c_idx * math.pi / 2 + dot_t * 2 * math.pi
                px_ = int(cx + math.cos(dot_ang) * spiral_r)
                py_ = int(cy + math.sin(dot_ang) * spiral_r * 0.7)
                if 0 <= px_ < FRAME_W and 0 <= py_ < FRAME_H:
                    a_val = int(200 * fade * (1 - dot_t * 0.5))
                    draw.ellipse([px_-1, py_-1, px_+1, py_+1],
                                 fill=(*col, a_val))
        # Central bright flash
        if 0.3 < t < 0.7:
            flash_r = int(8 * math.sin((t - 0.3) / 0.4 * math.pi))
            flash = radial_gradient(cx, cy, max(1, flash_r), (255, 255, 255), falloff=2.5)
            f_arr = np.array(flash)
            f_arr[:,:,3] = (f_arr[:,:,3] * 0.6 * math.sin((t-0.3)/0.4*math.pi)).astype(np.uint8)
            img = Image.alpha_composite(img, Image.fromarray(f_arr, "RGBA"))
        frames.append(img)
    return frames

# ─── Pandemonium (Skelette / Mäuler aus dem Boden) — großflächig ─────────────
# Designprinzip: MUTIGE Formen bei 64px. Schädel 18px breit, Zähne 4px.
def _draw_skull(draw, cx, cy, size, alpha):
    """Draw a bold pixel-art skull at (cx,cy). size ≈ half-width."""
    s = max(5, size)
    bone = (210, 205, 185, alpha)
    dark = (15,   5,  20, alpha)
    red  = (200,  20,  20, int(alpha * 0.8))
    # Head oval (filled)
    draw.ellipse([cx-s, cy-s, cx+s, cy+int(s*0.85)], fill=bone)
    # Eye sockets (dark filled squares) — each 30% of skull width
    ew = max(2, s//3)
    draw.rectangle([cx-s+ew//2,     cy-ew, cx-s//4,       cy+ew], fill=dark)
    draw.rectangle([cx+s//4,        cy-ew, cx+s-ew//2,    cy+ew], fill=dark)
    # Jaw / lower face
    jaw_h = max(3, s//3)
    draw.ellipse([cx-s+2, cy+int(s*0.5), cx+s-2, cy+int(s*0.85)+jaw_h],
                 fill=bone)
    # Teeth (4 dark rectangles between upper/lower jaw)
    tw = max(2, (2*s-4)//5)
    ty = int(cy + s*0.6)
    for k in range(4):
        tx = cx - s + 3 + k*(tw+1)
        if tx + tw < cx + s:
            draw.rectangle([tx, ty, tx+tw-1, ty+jaw_h-2], fill=dark)
    # Red eye glow
    for ex_, ey_ in [(cx-s//2, cy), (cx+s//2, cy)]:
        draw.ellipse([ex_-ew//2, ey_-ew//2, ex_+ew//2, ey_+ew//2], fill=red)

def _draw_hand(draw, cx, cy, size, alpha):
    """Bold skeletal hand reaching upward."""
    s = max(4, size)
    bone = (200, 195, 170, alpha)
    # Wrist/arm
    draw.rectangle([cx-s//3, cy, cx+s//3, cy+s], fill=bone)
    # Palm
    draw.ellipse([cx-s//2, cy-s//3, cx+s//2, cy+s//3], fill=bone)
    # 4 fingers up
    fw = max(2, s//4)
    for f in range(4):
        fx_ = cx - s//2 + 1 + f*(fw+1)
        fl  = s + (2 if f%2 else 0)
        draw.rectangle([fx_, cy-s//3-fl, fx_+fw-1, cy-s//3], fill=bone)
        # Fingertip rounded
        draw.ellipse([fx_-1, cy-s//3-fl-2, fx_+fw, cy-s//3-fl+2], fill=bone)

def make_pandemonium(n_frames=14):
    """AOE: Lovecraft-Tentakel steigen aus einem dunklen Spalt.
    Dicke, wellenartige Pixel-Tentakel mit Saugern und Spitze.
    """
    rng = np.random.default_rng(42)
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2

    # 5 Tentakel mit individueller Position, Phase, Höhe, Verzögerung
    n_tent = 5
    configs = []
    for i in range(n_tent):
        configs.append({
            'base_x':   int(cx - 22 + i * 11 + rng.integers(-2, 3)),
            'base_y':   cy + 22,
            'phase':    i * (2 * math.pi / n_tent) + rng.uniform(0, 0.6),
            'max_h':    rng.integers(30, 48),
            'delay':    i / n_tent * 0.35,
            'lean':     rng.uniform(-0.5, 0.5),
        })

    for i in range(n_frames):
        t = i / (n_frames - 1)

        # ── Glow-Layer ────────────────────────────────────────────────────────
        glow = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))

        # Dunkle Bodenvoid
        void_r    = int(5 + t * 22)
        void_fade = math.sin(t * math.pi) * 0.9
        vg = np.array(radial_gradient(cx, cy+20, void_r, (50, 0, 75), falloff=0.7))
        vg[:, :, 3] = (vg[:, :, 3] * void_fade).astype(np.uint8)
        glow = Image.alpha_composite(glow, Image.fromarray(vg, "RGBA"))

        # Äußere Aura
        if t > 0.1:
            ag = np.array(radial_gradient(cx, cy+10, int(10 + t * 26), (20, 0, 40), falloff=1.3))
            ag[:, :, 3] = (ag[:, :, 3] * min(1.0, t * 2) * 0.35).astype(np.uint8)
            glow = Image.alpha_composite(glow, Image.fromarray(ag, "RGBA"))

        # Tentakel-Glühen (lila Schein um jeden Tentakel)
        for tc in configs:
            lt = max(0.0, min(1.0, (t - tc['delay']) / max(0.01, 0.85 - tc['delay'])))
            if lt <= 0:
                continue
            fade = min(1.0, lt * 2.5) * (1 - max(0.0, (lt - 0.75) * 4))
            if fade < 0.08:
                continue
            tip_x = int(tc['base_x'] + tc['lean'] * tc['max_h'] * 0.4
                        + math.sin(tc['phase'] + t * 4) * 6)
            tip_y = int(tc['base_y'] - lt * tc['max_h'])
            tg = np.array(radial_gradient(tip_x, tip_y, 8, (100, 0, 160), falloff=2.0))
            tg[:, :, 3] = (tg[:, :, 3] * fade * 0.45).astype(np.uint8)
            glow = Image.alpha_composite(glow, Image.fromarray(tg, "RGBA"))

        # ── Detail-Layer ──────────────────────────────────────────────────────
        detail = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
        draw   = ImageDraw.Draw(detail)

        # Risslinien im Boden
        crack_fade = min(1.0, t * 3)
        a_ck = int(160 * crack_fade)
        if a_ck > 8:
            for c in range(6):
                ang     = c / 6 * 2 * math.pi + 0.3
                ck_len  = int(t * 18)
                kx, ky  = cx, cy + 20
                prev    = (kx, ky)
                for _ in range(max(1, ck_len // 4)):
                    kx = max(1, min(FRAME_W-2, kx + int(math.cos(ang)*4 + rng.integers(-2, 3))))
                    ky = max(1, min(FRAME_H-2, ky + int(math.sin(ang)*3 + rng.integers(-1, 2))))
                    draw.line([prev, (kx, ky)], fill=(130, 0, 180, a_ck), width=2)
                    prev = (kx, ky)

        # Tentakel zeichnen
        for tc in configs:
            lt = max(0.0, min(1.0, (t - tc['delay']) / max(0.01, 0.85 - tc['delay'])))
            if lt <= 0:
                continue
            fade = min(1.0, lt * 2.5) * (1 - max(0.0, (lt - 0.75) * 4))
            if fade < 0.05:
                continue
            a_val    = int(240 * fade)
            cur_h    = int(lt * tc['max_h'])
            if cur_h < 4:
                continue

            # Pfadpunkte mit Wellenbewegung
            n_segs = max(3, cur_h // 4)
            pts = []
            for s in range(n_segs + 1):
                st    = s / n_segs
                wave  = math.sin(st * math.pi * 2.8 + tc['phase'] + t * 5.5) * (3 + st * 7)
                lean  = tc['lean'] * st * cur_h * 0.45
                px_   = max(2, min(FRAME_W-3, int(tc['base_x'] + wave + lean)))
                py_   = max(2, min(FRAME_H-3, int(tc['base_y'] - st * cur_h)))
                pts.append((px_, py_))

            # Tentakel-Körper (dicker Stamm, verjüngend zur Spitze)
            for p in range(len(pts) - 1):
                seg_frac = p / max(1, len(pts) - 1)
                w = max(2, int(7 - seg_frac * 5))
                # Außenkontur (heller lila)
                draw.line([pts[p], pts[p+1]], fill=(80, 0, 120, a_val), width=w + 2)
                # Kern (dunkles Lila)
                draw.line([pts[p], pts[p+1]], fill=(30, 0, 55, a_val), width=w)

            # Sauger entlang des Tentakels
            for p_idx in range(0, len(pts), 2):
                px_, py_ = pts[p_idx]
                sr = max(1, 3 - p_idx // 3)
                draw.ellipse([px_-sr, py_-sr, px_+sr, py_+sr],
                             fill=(140, 20, 180, int(a_val * 0.85)))

            # Spitze mit Krümmung
            if len(pts) >= 2:
                tip   = pts[-1]
                curl_ang = tc['phase'] + t * 4
                curl_x   = max(1, min(FRAME_W-2, int(tip[0] + math.cos(curl_ang) * 6)))
                curl_y   = max(1, min(FRAME_H-2, int(tip[1] + math.sin(curl_ang) * 4 - 2)))
                draw.line([tip, (curl_x, curl_y)],
                          fill=(120, 0, 180, int(a_val * 0.8)), width=3)
                # Spitzenglanz-Punkt
                draw.ellipse([curl_x-2, curl_y-2, curl_x+2, curl_y+2],
                             fill=(200, 100, 255, int(a_val * 0.7)))

        # ── Zusammenführen ────────────────────────────────────────────────────
        img = Image.alpha_composite(glow, detail)
        frames.append(img)
    return frames

# ─── Fesselranken (dicke Ranken aus dem Boden) ────────────────────────────────
def make_fesselranken(n_frames=12):
    """Sumpfzauber: kräftige grüne Ranken wachsen aus dem Boden.
    FIX: Glow-Layer und Draw-Layer getrennt compositen.
    """
    rng = np.random.default_rng(88)
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2

    n_vines   = 5
    vine_x    = [cx - 22, cx - 10, cx, cx + 10, cx + 22]
    vine_lean = [-0.35, -0.15, 0.0, 0.15, 0.35]
    vine_delay = [0.0, 0.1, 0.15, 0.1, 0.0]

    for i in range(n_frames):
        t = i / (n_frames - 1)

        # ── Glow-Layer ────────────────────────────────────────────────────────
        glow = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
        swamp_fade = math.sin(t * math.pi) * 0.65
        sg = np.array(radial_gradient(cx, cy+18, int(8 + t*24), (20, 80, 15), falloff=1.1))
        sg[:, :, 3] = (sg[:, :, 3] * swamp_fade).astype(np.uint8)
        glow = Image.alpha_composite(glow, Image.fromarray(sg, "RGBA"))

        # ── Detail-Layer ──────────────────────────────────────────────────────
        detail = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
        draw   = ImageDraw.Draw(detail)

        for v in range(n_vines):
            delay   = vine_delay[v]
            local_t = max(0.0, min(1.0, (t - delay) / max(0.01, 0.88 - delay)))
            if local_t <= 0.0:
                continue
            fade_v = min(1.0, local_t*3.0) * (1 - max(0.0, (local_t-0.72)*3.5))
            a_v    = int(230 * fade_v)
            if a_v < 8:
                continue

            vine_len  = int(local_t * 46)
            base_x    = vine_x[v]
            base_y    = cy + 22
            lean_ang  = vine_lean[v]

            pts = []
            seg_count = max(2, vine_len // 5)
            for seg in range(seg_count + 1):
                seg_t = seg / seg_count
                sway  = math.sin(seg_t * math.pi * 2.0 + v * 1.2) * 4
                vx_   = int(base_x + math.sin(lean_ang)*seg_t*vine_len + sway)
                vy_   = int(base_y - seg_t * vine_len)
                pts.append((max(1, min(FRAME_W-1, vx_)), max(1, min(FRAME_H-1, vy_))))

            # Thick stem
            for p in range(len(pts) - 1):
                draw.line([pts[p], pts[p+1]], fill=(35, 115, 20, a_v), width=3)

            # Bold thorns
            for p_idx in range(1, len(pts)-1, 2):
                px_, py_ = pts[p_idx]
                tc = (65, 95, 18, int(a_v*0.9))
                draw.polygon([(px_, py_),(px_-6, py_-4),(px_-3, py_+2)], fill=tc)
                draw.polygon([(px_, py_),(px_+6, py_-4),(px_+3, py_+2)], fill=tc)

            # Leaf cluster at tip
            if vine_len > 14 and pts:
                tip = pts[-1]
                ls  = int(5 + local_t * 5)
                lc  = (55, 170, 30, int(a_v * 0.95))
                for bud in range(4):
                    b_ang = bud / 4 * 2 * math.pi + v * 0.5
                    bx_   = max(0, min(FRAME_W-1, tip[0] + int(math.cos(b_ang)*ls)))
                    by_   = max(0, min(FRAME_H-1, tip[1] + int(math.sin(b_ang)*ls*0.6)))
                    draw.ellipse([bx_-3, by_-3, bx_+3, by_+3], fill=lc)

        # ── Zusammenführen ────────────────────────────────────────────────────
        img = Image.alpha_composite(glow, detail)
        frames.append(img)
    return frames

# ─── Schadenstreffer-Flash (roter Aufblitz bei Treffern) ──────────────────────
def make_schadenflash(n_frames=6):
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        fade = 1.0 - t
        r = int(4 + t * 28)
        # Roter Kern-Burst (nur am Anfang)
        if t < 0.4:
            c_arr = np.array(radial_gradient(cx, cy, int(18 - t * 30), (255, 40, 20), falloff=2.0))
            c_arr[:,:,3] = (c_arr[:,:,3] * (1 - t * 2.5)).astype(np.uint8)
            img = Image.alpha_composite(img, Image.fromarray(c_arr, "RGBA"))
        draw = ImageDraw.Draw(img)
        # Expandierender roter Ring
        if r > 0:
            draw.ellipse([cx-r, cy-r, cx+r, cy+r],
                         outline=(255, 50, 20, int(230 * fade)), width=max(1, int(3 - t*2)))
        # Blut-Funken
        for s in range(8):
            ang = (s/8)*2*math.pi + t*0.5
            sr = int(r * 0.75)
            sx = int(cx + math.cos(ang)*sr)
            sy = int(cy + math.sin(ang)*sr)
            if 0 <= sx < FRAME_W and 0 <= sy < FRAME_H:
                draw.ellipse([sx-2, sy-2, sx+2, sy+2],
                             fill=(255, 30+int(t*80), 0, int(210*fade)))
        frames.append(img)
    return frames

# ─── Tod-Animation (Token verblasst/zerfällt bei LP 0) ───────────────────────
def make_tod_animation(n_frames=12):
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        draw = ImageDraw.Draw(img)
        if t < 0.5:
            phase = t * 2
            # Schwarzer Nebel expandiert
            void_r = int(phase * 28)
            if void_r > 0:
                v_arr = np.array(radial_gradient(cx, cy, void_r, (10, 0, 0), falloff=0.8))
                v_arr[:,:,3] = (v_arr[:,:,3] * phase * 0.85).astype(np.uint8)
                img = Image.alpha_composite(img, Image.fromarray(v_arr, "RGBA"))
            # Rotes Flackern
            if phase > 0.3 and int(phase * 5) % 2 == 0:
                r_arr = np.array(radial_gradient(cx, cy, 12, (200, 0, 0), falloff=2.0))
                r_arr[:,:,3] = (r_arr[:,:,3] * 0.55).astype(np.uint8)
                img = Image.alpha_composite(img, Image.fromarray(r_arr, "RGBA"))
            # Aufsteigende lila Partikel
            for s in range(6):
                px_ = cx + int(math.sin(s*1.1 + phase*8)*12)
                py_ = int(cy - phase*20 + s*3)
                if 0 <= px_ < FRAME_W and 0 <= py_ < FRAME_H:
                    draw.ellipse([px_-2, py_-2, px_+2, py_+2],
                                 fill=(60, 0, 80, int(200*phase)))
        else:
            phase = (t - 0.5) * 2
            fade = 1.0 - phase
            # Dunkler Hintergrund
            bg_arr = np.array(radial_gradient(cx, cy, 26, (5, 0, 5), falloff=0.5))
            bg_arr[:,:,3] = (bg_arr[:,:,3] * fade * 0.7).astype(np.uint8)
            img = Image.alpha_composite(img, Image.fromarray(bg_arr, "RGBA"))
            # Pixel-Totenschädel
            a_val = int(230 * fade)
            draw.ellipse([cx-10, cy-12, cx+10, cy+4],  fill=(195, 195, 185, a_val))
            draw.ellipse([cx-7,  cy-2,  cx+7,  cy+8],  fill=(195, 195, 185, a_val))
            draw.ellipse([cx-6,  cy-9,  cx-2,  cy-5],  fill=(10, 0, 10, a_val))
            draw.ellipse([cx+2,  cy-9,  cx+6,  cy-5],  fill=(10, 0, 10, a_val))
            draw.rectangle([cx-1, cy-4, cx+1, cy-2],   fill=(10, 0, 10, a_val))
            for tooth in range(4):
                tx = cx - 6 + tooth * 3
                draw.rectangle([tx, cy+2, tx+2, cy+7], fill=(10, 0, 10, a_val))
            draw.ellipse([cx-5, cy-8, cx-3, cy-6], fill=(255, 30, 0, int(a_val*0.9)))
            draw.ellipse([cx+3, cy-8, cx+5, cy-6], fill=(255, 30, 0, int(a_val*0.9)))
        frames.append(img)
    return frames

# ─── Attributo (Attributsteigerung — goldener Sternglanz) ─────────────────────
def make_attributo(n_frames=8):
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        draw = ImageDraw.Draw(img)
        fade = math.sin(t * math.pi)
        # Goldener Glow
        g_arr = np.array(radial_gradient(cx, cy, 22, (255, 200, 50), falloff=1.5))
        g_arr[:,:,3] = (g_arr[:,:,3] * fade * 0.38).astype(np.uint8)
        img = Image.alpha_composite(img, Image.fromarray(g_arr, "RGBA"))
        # Rotierender Ring
        r = int(18 + math.sin(t*math.pi*2)*2)
        draw.ellipse([cx-r, cy-r, cx+r, cy+r],
                     outline=(255, 215, 60, int(185*fade)), width=2)
        # Stern-Funken
        for s in range(6):
            ang = (s/6)*2*math.pi + t*math.pi*1.5
            sr  = 14 + int(math.sin(t*math.pi*2 + s)*4)
            sx  = int(cx + math.cos(ang)*sr)
            sy  = int(cy + math.sin(ang)*sr)
            if 0<=sx<FRAME_W and 0<=sy<FRAME_H:
                ss = 3 if s%2==0 else 2
                draw.polygon([
                    (sx,sy-ss*2),(sx+1,sy-1),(sx+ss*2,sy),
                    (sx+1,sy+1),(sx,sy+ss*2),(sx-1,sy+1),
                    (sx-ss*2,sy),(sx-1,sy-1)
                ], fill=(255, 235, 100, int(225*fade)))
        frames.append(img)
    return frames

# ─── Respondami (Gedankenlesen — cyan-türkis, kreisende Ringe) ────────────────
def make_respondami(n_frames=8):
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        draw = ImageDraw.Draw(img)
        fade = math.sin(t*math.pi)
        for ring in range(3):
            r_ring = 7 + ring * 6
            spin = t * 2*math.pi * (1.5 - ring*0.3) * (1 if ring%2==0 else -1)
            for dot in range(16):
                ang = spin + dot/16 * 2*math.pi
                dx_ = int(cx + math.cos(ang)*r_ring)
                dy_ = int(cy + math.sin(ang)*r_ring)
                if 0<=dx_<FRAME_W and 0<=dy_<FRAME_H:
                    bright = int(170*fade*(0.5+0.5*math.sin(ang*3 + t*5)))
                    draw.ellipse([dx_-1, dy_-1, dx_+1, dy_+1],
                                 fill=(50+bright//3, 210, 255, bright))
        inner = radial_gradient(cx, cy, int(5+fade*3), (100, 240, 255), falloff=2.5)
        i_arr = np.array(inner)
        i_arr[:,:,3] = (i_arr[:,:,3] * fade * 0.7).astype(np.uint8)
        img = Image.alpha_composite(img, Image.fromarray(i_arr, "RGBA"))
        frames.append(img)
    return frames

# ─── Aquafaxius (Wasserstrahl — blau-weiße Fontäne) ──────────────────────────
def make_aquafaxius(n_frames=9):
    rng = np.random.default_rng(42)
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        fade = math.sin(t*math.pi)
        w_arr = np.array(radial_gradient(cx, cy, int(7+t*10), (30, 130, 255), falloff=1.5))
        w_arr[:,:,3] = (w_arr[:,:,3] * fade * 0.7).astype(np.uint8)
        img = Image.alpha_composite(img, Image.fromarray(w_arr, "RGBA"))
        draw = ImageDraw.Draw(img)
        for s in range(10):
            ang = (s/10)*2*math.pi + t*3
            sr  = int(10 + t*14 + rng.integers(-3, 4))
            sx  = int(cx + math.cos(ang)*sr)
            sy  = int(cy + math.sin(ang)*sr)
            if 0<=sx<FRAME_W and 0<=sy<FRAME_H:
                lum = rng.integers(160, 256)
                draw.ellipse([sx-2, sy-2, sx+2, sy+2],
                             fill=(lum//3, lum//2, lum, int(185*fade)))
        if t > 0.4:
            for c in range(4):
                ang = c/4*2*math.pi + t*1.5
                cx2 = int(cx + math.cos(ang)*16)
                cy2 = int(cy + math.sin(ang)*16)
                ca  = int(200 * fade * min(1.0, (t-0.4)*3))
                draw.polygon([(cx2,cy2-5),(cx2+3,cy2),(cx2,cy2+5),(cx2-3,cy2)],
                             fill=(180, 220, 255, ca))
        frames.append(img)
    return frames

# ─── Fulminictus (Blitzsturm — mehrere Blitze von oben) ──────────────────────
def make_fulminictus(n_frames=8):
    rng = np.random.default_rng(99)
    frames = []
    cx, cy = FRAME_W//2, FRAME_H//2
    for i in range(n_frames):
        t = i / (n_frames - 1)
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (0,0,0,0))
        draw = ImageDraw.Draw(img)
        fade = 1.0 - max(0, (t - 0.5) * 2)
        if fade > 0:
            for bolt in range(3):
                bx = cx + rng.integers(-10, 11)
                px_, py_ = bx, 2
                segs = 8
                for seg in range(segs):
                    seg_t = (seg+1)/segs
                    nx = bx + rng.integers(-8, 9)
                    ny = int(seg_t * (cy + 12))
                    a_val = int(235 * fade * (1 - seg*0.04))
                    col = (200, 220, 255, a_val) if seg%2==0 else (255, 255, 255, a_val)
                    draw.line([(px_,py_),(nx,ny)], fill=col, width=2)
                    if seg == segs//2:
                        fx = nx + rng.integers(-12, 13)
                        fy = ny + rng.integers(8, 16)
                        draw.line([(nx,ny),(fx,fy)],
                                  fill=(160,200,255,int(185*fade)), width=1)
                    px_, py_ = nx, ny
            impact = radial_gradient(cx, cy+10, int(8+fade*6), (180, 200, 255), falloff=2.0)
            i_arr = np.array(impact)
            i_arr[:,:,3] = (i_arr[:,:,3] * fade * 0.6).astype(np.uint8)
            img = Image.alpha_composite(img, Image.fromarray(i_arr, "RGBA"))
        frames.append(img)
    return frames

# ─── Build All ─────────────────────────────────────────────────────────────────

EFFECTS = {
    # Bestehende (8)
    "fx_feuerball":     make_fireball(8),
    "fx_explosion":     make_explosion(10),
    "fx_eis":           make_ice(8),
    "fx_blitz":         make_lightning(6),
    "fx_heilung":       make_heal(8),
    "fx_gift":          make_poison(8),
    "fx_schatten":      make_shadow(8),
    "fx_wasser":        make_water(8),
    # DSA-Zauber Welle 1 (10)
    "fx_flammenpfeil":  make_flammenpfeil(7),
    "fx_donnerkeil":    make_donnerkeil(10),
    "fx_armatrutz":     make_armatrutz(10),
    "fx_balsamsal":     make_balsamsal(10),
    "fx_horriphobus":   make_horriphobus(9),
    "fx_invocatio":     make_invocatio(12),
    "fx_daemonenbann":  make_daemonenbann(8),
    "fx_motoricus":     make_motoricus(8),
    "fx_visibili":      make_visibili(8),
    "fx_odem":          make_odem(10),
    # DSA-Zauber Welle 2 (8)
    "fx_brennen":       make_brennen(10),
    "fx_schattenform":  make_schattenform(10),
    "fx_wind":          make_wind(8),
    "fx_paralysis":     make_paralysis(9),
    "fx_silentium":     make_silentium(9),
    "fx_portal":        make_portal(12),
    "fx_planastral":    make_planastral(14),
    "fx_verwandlung":   make_verwandlung(10),
    # Welle 3 (2)
    "fx_pandemonium":   make_pandemonium(14),
    "fx_fesselranken":  make_fesselranken(12),
    # Welle 4 — Neue DSA-Zauber
    "fx_attributo":     make_attributo(8),
    "fx_respondami":    make_respondami(8),
    "fx_aquafaxius":    make_aquafaxius(9),
    "fx_fulminictus":   make_fulminictus(8),
    # Kampf-Reaktionen
    "fx_schadenflash":  make_schadenflash(6),
    "fx_tod_animation": make_tod_animation(12),
}

os.makedirs("icons", exist_ok=True)

for name, frames in EFFECTS.items():
    sheet = make_sheet(frames)
    sheet.save(f"{name}.png")
    print(f"  {name}.png  ({len(frames)} frames, {sheet.size[0]}x{sheet.size[1]}px)")
    # Icon: mittlerer Frame (meistens am sichtbarsten)
    icon_frame = frames[len(frames) // 2].copy().resize((64, 64), Image.NEAREST)
    icon_name  = name.replace("fx_", "") + "_icon.png"
    icon_frame.save(f"icons/{icon_name}")

print(f"\nFertig! {len(EFFECTS)} Effekte + Icons generiert.")

# ─── Status-Icons (32×32 Pixel-Art) ───────────────────────────────────────────

def make_status_icons():
    """Generiert 32×32 Pixel-Art Status-Icons für Token-Overlays."""
    SW, SH = 32, 32
    cx, cy = SW//2, SH//2
    icons = {}

    # vergiftet — grüner Schädel
    img = Image.new("RGBA", (SW, SH), (0,0,0,0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([cx-8, cy-9, cx+8, cy+3],  fill=(55, 175, 45, 220))
    draw.ellipse([cx-5, cy-2, cx+5, cy+6],  fill=(55, 175, 45, 220))
    draw.ellipse([cx-4, cy-7, cx-1, cy-4],  fill=(10, 20, 10, 220))
    draw.ellipse([cx+1, cy-7, cx+4, cy-4],  fill=(10, 20, 10, 220))
    for d in range(3):
        dx = cx - 4 + d*4
        draw.ellipse([dx-2, cy+5, dx+2, cy+9], fill=(75, 195, 65, 200))
    icons["vergiftet"] = img

    # betaeubt — gelbe Sterne
    img = Image.new("RGBA", (SW, SH), (0,0,0,0))
    draw = ImageDraw.Draw(img)
    for s in range(4):
        ang = s/4 * 2*math.pi
        sx_ = int(cx + math.cos(ang)*10)
        sy_ = int(cy + math.sin(ang)*8)
        ss  = 4
        draw.polygon([
            (sx_,sy_-ss),(sx_+1,sy_-1),(sx_+ss,sy_),(sx_+1,sy_+1),
            (sy_,sy_+ss),(sx_-1,sy_+1),(sx_-ss,sy_),(sx_-1,sy_-1)
        ], fill=(255, 220, 50, 220))
    icons["betaeubt"] = img

    # gesegnet — weißes Kreuz im Heiligenschein
    img = Image.new("RGBA", (SW, SH), (0,0,0,0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([cx-10, cy-10, cx+10, cy+10], outline=(255, 240, 180, 200), width=2)
    draw.rectangle([cx-2, cy-9, cx+2, cy+9],  fill=(255, 240, 180, 220))
    draw.rectangle([cx-9, cy-2, cx+9, cy+2],  fill=(255, 240, 180, 220))
    icons["gesegnet"] = img

    # gelaeumt — gelber Blitz
    img = Image.new("RGBA", (SW, SH), (0,0,0,0))
    draw = ImageDraw.Draw(img)
    draw.polygon([
        (cx+2,cy-11),(cx-4,cy-1),(cx+2,cy-1),
        (cx-5,cy+11),(cx+6,cy+1),(cx-1,cy+1)
    ], fill=(255, 230, 50, 220))
    icons["gelaeumt"] = img

    # verwirrt — lila Spirale + ?
    img = Image.new("RGBA", (SW, SH), (0,0,0,0))
    draw = ImageDraw.Draw(img)
    for dot in range(24):
        t_d = dot/24
        r_sp = 3 + t_d*9
        ang  = t_d*4*math.pi
        px_  = int(cx + math.cos(ang)*r_sp)
        py_  = int(cy + math.sin(ang)*r_sp)
        lum  = int(140 + t_d*100)
        draw.ellipse([px_-1,py_-1,px_+1,py_+1], fill=(lum, 60, lum, 200))
    draw.ellipse([cx-3,cy-3,cx+3,cy+3], fill=(255, 100, 255, 220))
    icons["verwirrt"] = img

    # blind — geschlossenes Auge mit rotem Balken
    img = Image.new("RGBA", (SW, SH), (0,0,0,0))
    draw = ImageDraw.Draw(img)
    draw.arc([cx-10, cy-5, cx+10, cy+5], start=0, end=180,
             fill=(200,200,200,220), width=3)
    for lash in range(5):
        lx = cx - 8 + lash*4
        draw.line([(lx, cy), (lx-1, cy+4)], fill=(200,200,200,180), width=1)
    draw.line([(cx-12,cy-1),(cx+12,cy-1)], fill=(220,50,50,230), width=3)
    icons["blind"] = img

    # tot — roter Schädel
    img = Image.new("RGBA", (SW, SH), (0,0,0,0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([cx-8, cy-9, cx+8, cy+3],  fill=(175, 45, 45, 220))
    draw.ellipse([cx-5, cy-1, cx+5, cy+7],  fill=(175, 45, 45, 220))
    draw.ellipse([cx-4, cy-7, cx-1, cy-4],  fill=(10, 0, 0, 220))
    draw.ellipse([cx+1, cy-7, cx+4, cy-4],  fill=(10, 0, 0, 220))
    draw.rectangle([cx-1,cy-3, cx+1,cy-1],  fill=(10, 0, 0, 220))
    for tooth in range(3):
        tx = cx - 4 + tooth*3
        draw.rectangle([tx, cy+2, tx+2, cy+6], fill=(10, 0, 0, 220))
    icons["tot"] = img

    # brennend — orange Flamme
    img = Image.new("RGBA", (SW, SH), (0,0,0,0))
    draw = ImageDraw.Draw(img)
    draw.polygon([
        (cx,cy-11),(cx+3,cy-5),(cx+8,cy-8),(cx+6,cy+2),
        (cx+9,cy+8),(cx,cy+11),(cx-9,cy+8),(cx-6,cy+2),
        (cx-8,cy-8),(cx-3,cy-5)
    ], fill=(255, 135, 20, 220))
    draw.polygon([
        (cx,cy-6),(cx+2,cy-1),(cx+5,cy-4),(cx+4,cy+3),
        (cx,cy+7),(cx-4,cy+3),(cx-5,cy-4),(cx-2,cy-1)
    ], fill=(255, 230, 75, 200))
    icons["brennend"] = img

    os.makedirs("status", exist_ok=True)
    for name, icon_img in icons.items():
        icon_img.save(f"status/{name}.png")
        print(f"  status/{name}.png")
    return icons

print("\n--- Status-Icons ---")
make_status_icons()
print("Status-Icons fertig!")
print("Testbed: Frames/Dir=N, Reihen alle=0 (nur 1 Reihe)")
