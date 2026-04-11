"""
DSA Pixel Token — XXL Sprite Builder
Composites + recolors LPC layers into complete DSA character sprite sheets.
Run: python build_sprites.py
Requires: pip install pillow numpy
"""

import zipfile, io, os
import numpy as np
from PIL import Image

ZIP  = "lpc_medieval_characters.zip"
OUT  = "."
ANIM = "walkcycle"

# ─── Color Utils ──────────────────────────────────────────────────────────────

def recolor(img, target_rgb, preserve_alpha=True):
    """Fast numpy recolor: maps all colors to new hue, preserving luminance."""
    arr = np.array(img.convert("RGBA"), dtype=np.float32)
    alpha = arr[:, :, 3:4]
    rgb   = arr[:, :, :3]

    lum = (0.299*rgb[:,:,0] + 0.587*rgb[:,:,1] + 0.114*rgb[:,:,2]) / 255.0
    lum = lum[:, :, np.newaxis]

    t = np.array(target_rgb, dtype=np.float32)
    new_rgb = np.clip(t * lum, 0, 255)

    result = np.concatenate([new_rgb, alpha], axis=2).astype(np.uint8)
    return Image.fromarray(result, 'RGBA')

def tint(img, target_rgb, strength=0.6):
    """Soft tint: blends original color toward target_rgb."""
    arr = np.array(img.convert("RGBA"), dtype=np.float32)
    alpha = arr[:, :, 3:4]
    rgb   = arr[:, :, :3]

    t = np.array(target_rgb, dtype=np.float32)
    tinted = rgb * (1 - strength) + t * strength
    tinted = np.clip(tinted, 0, 255)

    result = np.concatenate([tinted, alpha], axis=2).astype(np.uint8)
    return Image.fromarray(result, 'RGBA')

def darken(img, factor=0.4):
    """Darken image by factor (0=black, 1=unchanged)."""
    arr = np.array(img.convert("RGBA"), dtype=np.float32)
    arr[:,:,:3] *= factor
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, 'RGBA')

def grayscale_layer(img):
    """Convert to grayscale while keeping RGBA format."""
    arr = np.array(img.convert("RGBA"), dtype=np.float32)
    lum = 0.299*arr[:,:,0] + 0.587*arr[:,:,1] + 0.114*arr[:,:,2]
    arr[:,:,0] = arr[:,:,1] = arr[:,:,2] = lum
    return Image.fromarray(arr.astype(np.uint8), 'RGBA')

# ─── Layer Loader ─────────────────────────────────────────────────────────────

def load_layer(z, name, anim, transform=None):
    """Load a single layer from zip, optionally apply transform."""
    path = f"lpc_entry/png/{anim}/{name}"
    if path not in z.namelist():
        return None
    img = Image.open(io.BytesIO(z.read(path))).convert("RGBA")
    if transform:
        img = transform(img)
    return img

def composite(z, layers, anim):
    """
    layers = list of:
      - "FILENAME.png"                  → load as-is
      - ("FILENAME.png", fn)            → load + apply fn(img)
      - ("FILENAME.png", fn, args...)   → load + apply fn(img, *args)
    """
    base = None
    for entry in layers:
        if isinstance(entry, str):
            name, transform = entry, None
        elif len(entry) == 2:
            name, transform = entry
        else:
            name = entry[0]
            fn   = entry[1]
            args = entry[2:]
            transform = lambda img, f=fn, a=args: f(img, *a)

        layer = load_layer(z, name, anim, transform)
        if layer is None:
            print(f"    ⚠  Missing: {name}")
            continue
        if base is None:
            base = Image.new("RGBA", layer.size, (0,0,0,0))
        base = Image.alpha_composite(base, layer)
    return base

# ─── Character Definitions ────────────────────────────────────────────────────
# Colors: (R, G, B)
BLACK  = (40,  40,  45)
DGRAY  = (80,  80,  90)
GRAY   = (140, 140, 150)
LGRAY  = (200, 200, 210)
WHITE  = (230, 230, 240)
GOLD   = (210, 170,  50)
RED    = (160,  30,  30)
BLUE   = (40,   80, 160)
GREEN  = (40,  110,  50)
PURPLE = (100,  40, 160)
BROWN  = (120,  70,  30)

CHARACTERS = {

    # ── Krieger ───────────────────────────────────────────────────────────────
    "dsa_krieger_silber": [
        "BODY_male.png",
        "LEGS_plate_armor_pants.png",
        "FEET_plate_armor_shoes.png",
        "TORSO_plate_armor_torso.png",
        "TORSO_plate_armor_arms_shoulders.png",
        "HANDS_plate_armor_gloves.png",
        "HEAD_plate_armor_helmet.png",
        "BELT_leather.png",
    ],
    "dsa_krieger_schwarz": [
        "BODY_male.png",
        ("LEGS_plate_armor_pants.png",       recolor, BLACK),
        ("FEET_plate_armor_shoes.png",        recolor, BLACK),
        ("TORSO_plate_armor_torso.png",       recolor, BLACK),
        ("TORSO_plate_armor_arms_shoulders.png", recolor, BLACK),
        ("HANDS_plate_armor_gloves.png",      recolor, BLACK),
        ("HEAD_plate_armor_helmet.png",       recolor, BLACK),
        "BELT_leather.png",
    ],
    "dsa_krieger_gold": [
        "BODY_male.png",
        ("LEGS_plate_armor_pants.png",        recolor, GOLD),
        ("FEET_plate_armor_shoes.png",         recolor, GOLD),
        ("TORSO_plate_armor_torso.png",        recolor, GOLD),
        ("TORSO_plate_armor_arms_shoulders.png",recolor, GOLD),
        ("HANDS_plate_armor_gloves.png",       recolor, GOLD),
        ("HEAD_plate_armor_helmet.png",        recolor, GOLD),
        "BELT_leather.png",
    ],

    # ── Schurke ───────────────────────────────────────────────────────────────
    "dsa_schurke_braun": [
        "BODY_male.png",
        "LEGS_pants_greenish.png",
        ("TORSO_leather_armor_shirt_white.png", recolor, BROWN),
        "TORSO_leather_armor_torso.png",
        "TORSO_leather_armor_shoulders.png",
        "TORSO_leather_armor_bracers.png",
        "FEET_shoes_brown.png",
        "HEAD_leather_armor_hat.png",
        "BELT_rope.png",
        "BEHIND_quiver.png",
    ],
    "dsa_schurke_schwarz": [
        "BODY_male.png",
        ("LEGS_pants_greenish.png",              recolor, BLACK),
        ("TORSO_leather_armor_shirt_white.png",  recolor, DGRAY),
        ("TORSO_leather_armor_torso.png",        recolor, BLACK),
        ("TORSO_leather_armor_shoulders.png",    recolor, BLACK),
        ("TORSO_leather_armor_bracers.png",      recolor, BLACK),
        ("FEET_shoes_brown.png",                 recolor, BLACK),
        ("HEAD_leather_armor_hat.png",           recolor, BLACK),
        ("BELT_rope.png",                        recolor, DGRAY),
        "BEHIND_quiver.png",
    ],
    "dsa_schurke_gruen": [
        "BODY_male.png",
        ("LEGS_pants_greenish.png",              recolor, GREEN),
        ("TORSO_leather_armor_shirt_white.png",  recolor, GREEN),
        ("TORSO_leather_armor_torso.png",        recolor, GREEN),
        ("TORSO_leather_armor_shoulders.png",    recolor, GREEN),
        ("TORSO_leather_armor_bracers.png",      recolor, GREEN),
        ("FEET_shoes_brown.png",                 recolor, BROWN),
        ("HEAD_leather_armor_hat.png",           recolor, GREEN),
        ("BELT_rope.png",                        recolor, BROWN),
        "BEHIND_quiver.png",
    ],

    # ── Magier ────────────────────────────────────────────────────────────────
    "dsa_magier_braun": [
        "BODY_male.png",
        "LEGS_robe_skirt.png",
        "TORSO_robe_shirt_brown.png",
        "HEAD_robe_hood.png",
        "BELT_rope.png",
    ],
    "dsa_magier_schwarz": [
        "BODY_male.png",
        ("LEGS_robe_skirt.png",         recolor, BLACK),
        ("TORSO_robe_shirt_brown.png",  recolor, BLACK),
        ("HEAD_robe_hood.png",          recolor, BLACK),
        ("BELT_rope.png",               recolor, DGRAY),
    ],
    "dsa_magier_grau": [
        "BODY_male.png",
        ("LEGS_robe_skirt.png",         recolor, GRAY),
        ("TORSO_robe_shirt_brown.png",  recolor, GRAY),
        ("HEAD_robe_hood.png",          recolor, DGRAY),
        ("BELT_rope.png",               recolor, LGRAY),
    ],
    "dsa_magier_weiss": [
        "BODY_male.png",
        ("LEGS_robe_skirt.png",         recolor, WHITE),
        ("TORSO_robe_shirt_brown.png",  recolor, WHITE),
        ("HEAD_robe_hood.png",          recolor, LGRAY),
        ("BELT_rope.png",               recolor, WHITE),
    ],
    "dsa_magier_blau": [
        "BODY_male.png",
        ("LEGS_robe_skirt.png",         recolor, BLUE),
        ("TORSO_robe_shirt_brown.png",  recolor, BLUE),
        ("HEAD_robe_hood.png",          recolor, BLUE),
        ("BELT_rope.png",               recolor, LGRAY),
    ],
    "dsa_magier_rot": [
        "BODY_male.png",
        ("LEGS_robe_skirt.png",         recolor, RED),
        ("TORSO_robe_shirt_brown.png",  recolor, RED),
        ("HEAD_robe_hood.png",          recolor, RED),
        ("BELT_rope.png",               recolor, DGRAY),
    ],

    # ── Geweihter ─────────────────────────────────────────────────────────────
    "dsa_geweihter_lila": [
        "BODY_male.png",
        "LEGS_robe_skirt.png",
        "TORSO_chain_armor_torso.png",
        "TORSO_chain_armor_jacket_purple.png",
        "HEAD_chain_armor_hood.png",
        "BELT_leather.png",
    ],
    "dsa_geweihter_weiss": [       # Praios / Boron-Geweihter
        "BODY_male.png",
        ("LEGS_robe_skirt.png",                  recolor, WHITE),
        ("TORSO_chain_armor_torso.png",           recolor, LGRAY),
        ("TORSO_chain_armor_jacket_purple.png",   recolor, WHITE),
        ("HEAD_chain_armor_hood.png",             recolor, WHITE),
        ("BELT_leather.png",                      recolor, GOLD),
    ],
    "dsa_geweihter_schwarz": [     # Boron / Gravesh-Geweihter
        "BODY_male.png",
        ("LEGS_robe_skirt.png",                   recolor, BLACK),
        ("TORSO_chain_armor_torso.png",            recolor, DGRAY),
        ("TORSO_chain_armor_jacket_purple.png",    recolor, BLACK),
        ("HEAD_chain_armor_hood.png",              recolor, BLACK),
        ("BELT_leather.png",                       recolor, DGRAY),
    ],

    # ── Kettenhemd-Kämpfer (Söldner) ──────────────────────────────────────────
    "dsa_soeldner_grau": [
        "BODY_male.png",
        ("LEGS_plate_armor_pants.png",      recolor, GRAY),
        ("FEET_plate_armor_shoes.png",       recolor, GRAY),
        ("TORSO_chain_armor_torso.png",      recolor, GRAY),
        ("HEAD_chain_armor_helmet.png",      recolor, GRAY),
        "BELT_leather.png",
    ],
    "dsa_soeldner_rost": [
        "BODY_male.png",
        ("LEGS_plate_armor_pants.png",      recolor, (110, 60, 20)),
        ("FEET_plate_armor_shoes.png",       recolor, (110, 60, 20)),
        ("TORSO_chain_armor_torso.png",      recolor, (110, 60, 20)),
        ("HEAD_chain_armor_helmet.png",      recolor, (100, 55, 15)),
        "BELT_leather.png",
    ],

    # ── Waldläufer / Jäger ────────────────────────────────────────────────────
    "dsa_jaeger_gruen": [
        "BODY_male.png",
        ("LEGS_pants_greenish.png",               recolor, GREEN),
        ("TORSO_leather_armor_shirt_white.png",   recolor, (60, 90, 40)),
        ("TORSO_leather_armor_torso.png",         recolor, GREEN),
        ("TORSO_leather_armor_shoulders.png",     recolor, GREEN),
        ("FEET_shoes_brown.png",                  recolor, BROWN),
        ("HEAD_chain_armor_hood.png",             recolor, GREEN),
        "BELT_leather.png",
        "BEHIND_quiver.png",
    ],
    "dsa_jaeger_braun": [
        "BODY_male.png",
        ("LEGS_pants_greenish.png",               recolor, BROWN),
        ("TORSO_leather_armor_shirt_white.png",   recolor, (90, 60, 30)),
        ("TORSO_leather_armor_torso.png",         recolor, BROWN),
        ("TORSO_leather_armor_shoulders.png",     recolor, BROWN),
        ("FEET_shoes_brown.png",                  recolor, BROWN),
        ("HEAD_leather_armor_hat.png",            recolor, BROWN),
        "BELT_rope.png",
        "BEHIND_quiver.png",
    ],

    # ── Bauer / NPC ───────────────────────────────────────────────────────────
    "dsa_bauer": [
        "BODY_male.png",
        ("LEGS_pants_greenish.png",              recolor, (100, 80, 40)),
        ("TORSO_leather_armor_shirt_white.png",  recolor, (210, 190, 150)),
        ("FEET_shoes_brown.png",                 recolor, BROWN),
        ("BELT_rope.png",                        recolor, BROWN),
    ],
    "dsa_haendler": [
        "BODY_male.png",
        ("LEGS_robe_skirt.png",                  recolor, (60, 40, 100)),
        ("TORSO_robe_shirt_brown.png",           recolor, (80, 55, 130)),
        ("HEAD_leather_armor_hat.png",           recolor, (50, 35, 80)),
        ("BELT_leather.png",                     recolor, GOLD),
    ],

    # ── Druide ────────────────────────────────────────────────────────────────
    "dsa_druide_gruen": [
        "BODY_male.png",
        ("LEGS_robe_skirt.png",              recolor, (40, 90, 40)),
        ("TORSO_robe_shirt_brown.png",       recolor, (50, 100, 30)),
        ("HEAD_robe_hood.png",               recolor, (40, 80, 30)),
        ("BELT_rope.png",                    recolor, BROWN),
    ],
    "dsa_druide_braun": [
        "BODY_male.png",
        ("LEGS_robe_skirt.png",              recolor, (70, 50, 20)),
        ("TORSO_robe_shirt_brown.png",       recolor, (90, 65, 25)),
        ("HEAD_robe_hood.png",               recolor, (60, 45, 15)),
        ("BELT_rope.png",                    recolor, (80, 55, 20)),
    ],
    "dsa_druide_grau": [
        "BODY_male.png",
        ("LEGS_robe_skirt.png",              recolor, GRAY),
        ("TORSO_robe_shirt_brown.png",       recolor, LGRAY),
        ("HEAD_robe_hood.png",               recolor, DGRAY),
        ("BELT_rope.png",                    recolor, BROWN),
    ],

    # ── Hexe ──────────────────────────────────────────────────────────────────
    "dsa_hexe_schwarz": [
        "BODY_male.png",
        ("LEGS_robe_skirt.png",              recolor, BLACK),
        ("TORSO_robe_shirt_brown.png",       recolor, (30, 0, 40)),
        ("HEAD_leather_armor_hat.png",       recolor, BLACK),  # Spitzhut!
        ("BELT_rope.png",                    recolor, PURPLE),
    ],
    "dsa_hexe_lila": [
        "BODY_male.png",
        ("LEGS_robe_skirt.png",              recolor, PURPLE),
        ("TORSO_robe_shirt_brown.png",       recolor, (80, 30, 120)),
        ("HEAD_leather_armor_hat.png",       recolor, (50, 20, 80)),
        ("BELT_rope.png",                    recolor, (180, 120, 200)),
    ],
    "dsa_hexe_gruen": [
        "BODY_male.png",
        ("LEGS_robe_skirt.png",              recolor, (20, 60, 20)),
        ("TORSO_robe_shirt_brown.png",       recolor, (30, 80, 20)),
        ("HEAD_leather_armor_hat.png",       recolor, (20, 50, 10)),
        ("BELT_rope.png",                    recolor, BROWN),
    ],

    # ── Soldat (Wachen, Garde) ─────────────────────────────────────────────────
    "dsa_soldat_rot": [           # Gardetruppe / Miliz
        "BODY_male.png",
        ("LEGS_plate_armor_pants.png",           recolor, DGRAY),
        ("FEET_plate_armor_shoes.png",            recolor, DGRAY),
        ("TORSO_chain_armor_torso.png",           recolor, DGRAY),
        ("TORSO_plate_armor_arms_shoulders.png",  recolor, RED),
        ("HEAD_chain_armor_helmet.png",           recolor, RED),
        ("BELT_leather.png",                      recolor, (80, 20, 20)),
    ],
    "dsa_soldat_blau": [          # Stadtgarde
        "BODY_male.png",
        ("LEGS_plate_armor_pants.png",           recolor, DGRAY),
        ("FEET_plate_armor_shoes.png",            recolor, DGRAY),
        ("TORSO_chain_armor_torso.png",           recolor, DGRAY),
        ("TORSO_plate_armor_arms_shoulders.png",  recolor, BLUE),
        ("HEAD_chain_armor_helmet.png",           recolor, BLUE),
        ("BELT_leather.png",                      recolor, DGRAY),
    ],
    "dsa_soldat_grau": [          # Standardsoldat
        "BODY_male.png",
        ("LEGS_plate_armor_pants.png",           recolor, DGRAY),
        ("FEET_plate_armor_shoes.png",            recolor, DGRAY),
        ("TORSO_chain_armor_torso.png",           recolor, GRAY),
        ("TORSO_plate_armor_arms_shoulders.png",  recolor, DGRAY),
        ("HEAD_chain_armor_helmet.png",           recolor, GRAY),
        "BELT_leather.png",
    ],
    "dsa_soldat_gold": [          # Elitegarde
        "BODY_male.png",
        ("LEGS_plate_armor_pants.png",           recolor, GOLD),
        ("FEET_plate_armor_shoes.png",            recolor, GOLD),
        ("TORSO_plate_armor_torso.png",           recolor, GOLD),
        ("TORSO_plate_armor_arms_shoulders.png",  recolor, GOLD),
        ("HEAD_plate_armor_helmet.png",           recolor, GOLD),
        ("BELT_leather.png",                      recolor, RED),
    ],

    # ── Söldner (bereits oben, hier weitere) ──────────────────────────────────
    "dsa_soeldner_schwarz": [
        "BODY_male.png",
        ("LEGS_plate_armor_pants.png",      recolor, BLACK),
        ("FEET_plate_armor_shoes.png",       recolor, BLACK),
        ("TORSO_chain_armor_torso.png",      recolor, DGRAY),
        ("TORSO_leather_armor_shoulders.png",recolor, BLACK),
        ("HEAD_chain_armor_helmet.png",      recolor, BLACK),
        ("BELT_leather.png",                 recolor, DGRAY),
    ],

    # ── Elementare ────────────────────────────────────────────────────────────
    "dsa_elemental_feuer": [
        ("BODY_male.png",                    recolor, (220, 80, 20)),
        ("LEGS_robe_skirt.png",              recolor, (200, 60, 10)),
        ("TORSO_robe_shirt_brown.png",       recolor, (240, 120, 30)),
        ("HEAD_robe_hood.png",               recolor, (255, 100, 20)),
    ],
    "dsa_elemental_wasser": [
        ("BODY_male.png",                    recolor, (30, 100, 200)),
        ("LEGS_robe_skirt.png",              recolor, (20, 80, 180)),
        ("TORSO_robe_shirt_brown.png",       recolor, (40, 130, 220)),
        ("HEAD_robe_hood.png",               recolor, (20, 90, 200)),
    ],
    "dsa_elemental_erde": [
        ("BODY_male.png",                    recolor, (80, 55, 20)),
        ("LEGS_robe_skirt.png",              recolor, (60, 45, 15)),
        ("TORSO_plate_armor_torso.png",      recolor, (90, 65, 25)),
        ("TORSO_plate_armor_arms_shoulders.png", recolor, (70, 50, 15)),
        ("HEAD_plate_armor_helmet.png",      recolor, (85, 60, 20)),
    ],
    "dsa_elemental_luft": [
        ("BODY_male.png",                    tint, WHITE, 0.5),
        ("LEGS_robe_skirt.png",              recolor, (200, 220, 240)),
        ("TORSO_robe_shirt_brown.png",       recolor, (210, 230, 250)),
        ("HEAD_robe_hood.png",               recolor, (190, 210, 235)),
    ],

    # ── Dämonen ───────────────────────────────────────────────────────────────
    "dsa_daemon_rot": [
        ("BODY_male.png",                    recolor, (180, 30, 30)),
        ("LEGS_plate_armor_pants.png",       recolor, (120, 20, 20)),
        ("FEET_plate_armor_shoes.png",        recolor, BLACK),
        ("TORSO_plate_armor_torso.png",       recolor, (100, 15, 15)),
        ("TORSO_plate_armor_arms_shoulders.png", recolor, (120, 20, 20)),
        ("HEAD_plate_armor_helmet.png",       recolor, (90, 10, 10)),
    ],
    "dsa_daemon_schwarz": [
        ("BODY_male.png",                    recolor, (40, 20, 60)),
        ("LEGS_robe_skirt.png",              recolor, (20, 10, 40)),
        ("TORSO_plate_armor_torso.png",       recolor, (30, 15, 50)),
        ("TORSO_plate_armor_arms_shoulders.png", recolor, (25, 10, 45)),
        ("HEAD_plate_armor_helmet.png",       recolor, (20, 5, 35)),
        ("BELT_rope.png",                     recolor, PURPLE),
    ],
    "dsa_daemon_lila": [
        ("BODY_male.png",                    recolor, PURPLE),
        ("LEGS_robe_skirt.png",              recolor, (70, 20, 100)),
        ("TORSO_plate_armor_torso.png",       recolor, (80, 30, 120)),
        ("TORSO_plate_armor_arms_shoulders.png", recolor, (70, 25, 110)),
        ("HEAD_chain_armor_helmet.png",       recolor, (60, 20, 90)),
    ],

    # ── Untoter / Böswillige ──────────────────────────────────────────────────
    "dsa_skelett": [
        "BODY_skeleton.png",
        "WEAPON_shield_cutout_body.png",
    ],
    "dsa_skelett_schwarz": [
        ("BODY_skeleton.png",               recolor, (50, 50, 60)),
        ("WEAPON_shield_cutout_body.png",   recolor, BLACK),
    ],
    "dsa_zombie": [
        ("BODY_male.png",                   tint, (50, 100, 50), 0.4),
        ("LEGS_robe_skirt.png",             recolor, (50, 50, 40)),
        ("TORSO_robe_shirt_brown.png",      recolor, (40, 60, 30)),
    ],
    "dsa_schwarzmagier": [
        "BODY_male.png",
        ("LEGS_robe_skirt.png",             recolor, (20, 0, 30)),
        ("TORSO_robe_shirt_brown.png",      recolor, (15, 0, 25)),
        ("HEAD_robe_hood.png",              recolor, (20, 0, 30)),
        ("BELT_rope.png",                   recolor, PURPLE),
    ],
}

# ─── Build All ────────────────────────────────────────────────────────────────

def main():
    print(f"Opening {ZIP}...")
    with zipfile.ZipFile(ZIP) as z:
        total = len(CHARACTERS)
        for i, (name, layers) in enumerate(CHARACTERS.items(), 1):
            print(f"  [{i:2d}/{total}] {name}...")
            img = composite(z, layers, ANIM)
            if img is None:
                print(f"       SKIP (no layers)")
                continue
            out = os.path.join(OUT, f"{name}.png")
            img.save(out)
            print(f"         OK {img.size[0]}x{img.size[1]}px -> {out}")

    print(f"\nFERTIG: {total} Sprites gebaut!")
    print("\nTestbed-Einstellungen:")
    print("  Frame: 64×64 | Frames/Dir: 9 | Idle: 0")
    print("  Reihen: Unten=2, Links=1, Rechts=3, Oben=0")

if __name__ == "__main__":
    main()
