"""
DSA Pixel Token - Female Sprite Builder
Creates female character variants using LPC Sara layers.
Run: python build_sprites_female.py
Requires: pip install pillow numpy
"""

import zipfile, io, os
import numpy as np
from PIL import Image

SARA_ZIP = "lpc_sara.zip"
OUT = "."

FW, FH = 64, 64
WALK_ROWS   = [8, 9, 10, 11]   # up, left, right, down (0-indexed row in full sheet)
WALK_FRAMES = 9

# ─── Color Utils ──────────────────────────────────────────────────────────────

def recolor(img, target_rgb):
    """Luminance-preserving recolor (numpy, fast)."""
    arr = np.array(img.convert("RGBA"), dtype=np.float32)
    alpha = arr[:, :, 3:4]
    rgb   = arr[:, :, :3]
    lum   = (0.299*rgb[:,:,0] + 0.587*rgb[:,:,1] + 0.114*rgb[:,:,2]) / 255.0
    lum   = lum[:, :, np.newaxis]
    t     = np.array(target_rgb, dtype=np.float32)
    new_rgb = np.clip(t * lum, 0, 255)
    return Image.fromarray(
        np.concatenate([new_rgb, alpha], axis=2).astype(np.uint8), 'RGBA')

def tint(img, target_rgb, strength=0.55):
    """Soft blend toward target color."""
    arr   = np.array(img.convert("RGBA"), dtype=np.float32)
    alpha = arr[:, :, 3:4]
    rgb   = arr[:, :, :3]
    t     = np.array(target_rgb, dtype=np.float32)
    tinted = np.clip(rgb*(1-strength) + t*strength, 0, 255)
    return Image.fromarray(
        np.concatenate([tinted, alpha], axis=2).astype(np.uint8), 'RGBA')

# ─── Sara Helpers ─────────────────────────────────────────────────────────────

def load_sara(z, filename):
    """Load a Sara layer from zip, convert to RGBA."""
    return Image.open(io.BytesIO(z.read(f"LPC_Sara/{filename}"))).convert("RGBA")

def pad_to(img, target_size):
    """Pad image with transparency to match target_size (W, H)."""
    if img.size == target_size:
        return img
    canvas = Image.new("RGBA", target_size, (0, 0, 0, 0))
    canvas.paste(img, (0, 0))
    return canvas

def extract_walkcycle(img):
    """Slice 4-direction walkcycle from Sara full sheet (rows 8-11, 9 frames each)."""
    out = Image.new("RGBA", (FW * WALK_FRAMES, FH * 4), (0, 0, 0, 0))
    for i, row in enumerate(WALK_ROWS):
        for col in range(WALK_FRAMES):
            frame = img.crop((col*FW, row*FH, (col+1)*FW, (row+1)*FH))
            out.paste(frame, (col*FW, i*FH))
    return out

def build_variant(z, base_full,
                  shirt_color    = None,
                  leggings_color = None,
                  shoes_color    = None,
                  hair_color     = None):
    """
    Composite a Sara variant.
    base_full : SaraFullSheet (832x1344) — all layers already composited
    *_color   : (R,G,B) tuple to recolor that layer, or None = keep original
    """
    full_size = base_full.size   # (832, 1344)

    # Load individual clothing layers (826x1344) → pad to full size
    shirt    = pad_to(load_sara(z, "SaraShirt.png"),    full_size)
    leggings = pad_to(load_sara(z, "SaraLeggings.png"), full_size)
    shoes    = pad_to(load_sara(z, "SaraShoes.png"),    full_size)
    hair_bot = pad_to(load_sara(z, "SaraHairBottomLayer.png"), full_size)
    hair_top = pad_to(load_sara(z, "SaraHairTopLayer.png"),    full_size)

    # Start from full composited sheet
    canvas = base_full.copy()

    # Paint recolored clothing on top — this overwrites the original colors
    if leggings_color:
        canvas = Image.alpha_composite(canvas, recolor(leggings, leggings_color))
    if shirt_color:
        canvas = Image.alpha_composite(canvas, recolor(shirt, shirt_color))
    if shoes_color:
        canvas = Image.alpha_composite(canvas, recolor(shoes, shoes_color))

    # Hair: always restore top layer so it sits above new clothing
    if hair_color:
        canvas = Image.alpha_composite(canvas, recolor(hair_bot, hair_color))
        canvas = Image.alpha_composite(canvas, recolor(hair_top, hair_color))
    else:
        canvas = Image.alpha_composite(canvas, hair_top)

    return extract_walkcycle(canvas)

# ─── Colors ───────────────────────────────────────────────────────────────────

BLACK   = (40,  40,  45)
DGRAY   = (80,  80,  90)
GRAY    = (140, 140, 150)
LGRAY   = (200, 200, 210)
WHITE   = (230, 230, 240)
SILVER  = (175, 185, 200)
GOLD    = (210, 170,  50)
RED     = (160,  30,  30)
BLUE    = (40,   80, 160)
GREEN   = (40,  110,  50)
PURPLE  = (100,  40, 160)
BROWN   = (120,  70,  30)
AUBURN  = (155,  70,  25)
LTBRWN  = (180, 130,  60)   # light brown / blonde-ish
DKBRWN  = (80,   45,  10)   # dark brown
DARKPUR = (60,   15,  90)   # dark purple
TEAL    = (30,  110, 110)
PINK    = (190,  70, 120)

# ─── Character Definitions ────────────────────────────────────────────────────
# Format: "output_name": (shirt_color, leggings_color, shoes_color, hair_color)
# None = keep original Sara color

FEMALE_CHARS = {

    # ── Kriegerin (Plate armor look via silver/black/gold palette) ─────────────
    "dsa_kriegerin_silber":    (SILVER, SILVER, GRAY,   None),
    "dsa_kriegerin_schwarz":   (BLACK,  BLACK,  BLACK,  None),
    "dsa_kriegerin_gold":      (GOLD,   GOLD,   GOLD,   None),

    # ── Schurkin (Leather rogue) ───────────────────────────────────────────────
    "dsa_schurkin_braun":      (BROWN,          (100, 65, 25),  BROWN,  DKBRWN),
    "dsa_schurkin_schwarz":    (BLACK,           DGRAY,          BLACK,  BLACK),
    "dsa_schurkin_gruen":      ((45, 80, 30),   GREEN,           BROWN,  DKBRWN),

    # ── Magierin (Robe mages) ──────────────────────────────────────────────────
    "dsa_magierin_schwarz":    (BLACK,           (30, 0, 40),    BLACK,  (220, 215, 225)),  # white hair
    "dsa_magierin_grau":       (GRAY,            DGRAY,          GRAY,   DKBRWN),
    "dsa_magierin_weiss":      (WHITE,           LGRAY,          LGRAY,  None),              # blonde
    "dsa_magierin_blau":       (BLUE,            (30, 60, 130),  (40, 50, 90),  DKBRWN),
    "dsa_magierin_rot":        (RED,             (120, 20, 20),  BROWN,  (30, 20, 60)),     # dark
    "dsa_magierin_lila":       (PURPLE,          (70, 20, 100),  BLACK,  DARKPUR),

    # ── Geweihte (Clerics / temple servants) ──────────────────────────────────
    "dsa_geweihte_lila":       (PURPLE,          (80, 30, 120),  (70, 25, 90),  DKBRWN),
    "dsa_geweihte_weiss":      (WHITE,           (200, 200, 220), LGRAY,  LTBRWN),
    "dsa_geweihte_schwarz":    (BLACK,           (20, 0, 30),    BLACK,  BLACK),
    "dsa_geweihte_gold":       (GOLD,            (160, 130, 30), BROWN,  None),             # sun temple

    # ── Hexe (Witches — dark & mysterious) ────────────────────────────────────
    "dsa_hexe_schwarz_f":      ((25, 0, 35),     BLACK,          BLACK,  BLACK),
    "dsa_hexe_lila_f":         ((90, 30, 130),   PURPLE,         (50, 20, 80),  DARKPUR),
    "dsa_hexe_gruen_f":        ((30, 75, 20),    (20, 60, 15),   BROWN,  BLACK),

    # ── Druidin ────────────────────────────────────────────────────────────────
    "dsa_druidin_gruen":       ((50, 100, 30),   (40, 80, 20),   BROWN,  AUBURN),
    "dsa_druidin_braun":       ((90, 60, 20),    BROWN,          BROWN,  AUBURN),
    "dsa_druidin_grau":        (LGRAY,           GRAY,           BROWN,  GRAY),

    # ── Jaegerin (Rangers) ─────────────────────────────────────────────────────
    "dsa_jaegerin_gruen":      ((55, 85, 35),    GREEN,          BROWN,  AUBURN),
    "dsa_jaegerin_braun":      ((90, 60, 25),    BROWN,          BROWN,  LTBRWN),

    # ── Soeldnerin (Mercenaries) ───────────────────────────────────────────────
    "dsa_soeldnerin_grau":     (GRAY,            DGRAY,          GRAY,   DKBRWN),
    "dsa_soeldnerin_schwarz":  (DGRAY,           BLACK,          BLACK,  DKBRWN),

    # ── Elementare weiblich ───────────────────────────────────────────────────
    "dsa_elemental_feuer_f":   ((220, 80, 20),   (200, 60, 10),  BLACK,  (240, 140, 20)),
    "dsa_elemental_wasser_f":  ((30, 100, 200),  (20, 80, 180),  (20, 70, 160), (80, 160, 220)),
    "dsa_elemental_erde_f":    ((80, 55, 20),    (60, 45, 15),   (70, 50, 15),  (90, 60, 20)),
    "dsa_elemental_luft_f":    ((200, 220, 240), (185, 210, 235),(190, 215, 235),(220, 230, 240)),

    # ── Weibliche NPCs ────────────────────────────────────────────────────────
    "dsa_buergerin":           ((180, 140, 90),  (80, 60, 150),  BROWN,  AUBURN),
    "dsa_haendlerin":          ((100, 70, 160),  (80, 55, 130),  BROWN,  LTBRWN),
    "dsa_baeuerin":            ((200, 180, 140), (90, 70, 35),   BROWN,  LTBRWN),
    "dsa_gaertnerin":          ((80, 120, 60),   (60, 90, 30),   BROWN,  AUBURN),
    "dsa_heilerin":            (TEAL,            (25, 90, 90),   LGRAY,  None),
}

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print(f"Opening {SARA_ZIP}...")
    with zipfile.ZipFile(SARA_ZIP) as z:
        # Pre-load base Sara sheet once
        base_full = load_sara(z, "SaraFullSheet.png")
        print(f"  Base sheet: {base_full.size}")

        total = len(FEMALE_CHARS)
        ok, fail = 0, 0

        for i, (name, cols) in enumerate(FEMALE_CHARS.items(), 1):
            shirt_c, legs_c, shoes_c, hair_c = cols
            print(f"  [{i:2d}/{total}] {name}...", end=" ", flush=True)
            try:
                img = build_variant(z, base_full, shirt_c, legs_c, shoes_c, hair_c)
                img.save(os.path.join(OUT, f"{name}.png"))
                print(f"OK  ({img.size[0]}x{img.size[1]}px)")
                ok += 1
            except Exception as e:
                print(f"FEHLER: {e}")
                fail += 1

    print(f"\nFERTIG: {ok}/{total} weibliche Sprites gebaut."
          + (f"  {fail} Fehler." if fail else ""))
    print("Einstellungen fuer Foundry:")
    print("  Frame 64x64 | Frames/Dir: 9 | Idle: 0")
    print("  Reihen: Unten=2, Links=1, Rechts=3, Oben=0")

if __name__ == "__main__":
    main()
