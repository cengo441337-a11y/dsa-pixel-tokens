#!/usr/bin/env python3
"""
DSA Token Generator — Forgotten Adventures Style
Nutzt fal-ai/flux-lora + Dark Fantasy LoRA fuer painted VTT Tokens.

Features:
  - Painted dark fantasy illustration style (Magic the Gathering / D&D Artwork Qualitaet)
  - Automatisches Background-Removal (fal.ai rembg)
  - Cirkulaerer Token-Rahmen (Pillow, gold/dark fantasy)
  - Output: 256x256 und 512x512 PNG fuer FoundryVTT

Aufruf:
  python generate_tokens_lora.py                    # alle Tokens
  python generate_tokens_lora.py zwerg_krieger      # einen Token
  python generate_tokens_lora.py --cost             # nur Kosten
  python generate_tokens_lora.py --no-frame         # ohne Rahmen
"""

import os, sys, time, urllib.request, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
from io import BytesIO

FAL_KEY = "9bccea4b-8659-4e26-adca-c1ff54726e42:b806b31c011aee18cf8e14a584e7c74a"
os.environ["FAL_KEY"] = FAL_KEY

import fal_client

# ── Config ────────────────────────────────────────────────────────────────────

TOKEN_DIR  = Path(__file__).parent
OUT_DIR    = TOKEN_DIR / "lora_tokens"
LORA_URL   = "https://huggingface.co/Shakker-Labs/FLUX.1-dev-LoRA-Dark-Fantasy/resolve/main/FLUX.1-dev-lora-Dark-Fantasy.safetensors"
LORA_SCALE = 0.8
IMG_SIZE   = 512
COST_PER   = 0.035 * (IMG_SIZE * IMG_SIZE / 1_000_000)  # $0.035/megapixel

# ── Style ─────────────────────────────────────────────────────────────────────

STYLE = (
    "full body standing pose, complete figure head to toe, "
    "fantasy RPG character token art, dramatic rim lighting, "
    "pure black background, detailed painterly illustration, "
    "high quality digital fantasy art, Magic the Gathering card art style"
)

NEGATIVE = (
    "blurry, low quality, multiple characters, portrait only, bust only, head only, cropped body, "
    "cut off legs, cut off feet, modern clothes, sci-fi, photorealistic, 3d render, "
    "circular frame, border, UI elements, text, watermark, nsfw"
)

# ── Token Definitionen ────────────────────────────────────────────────────────

TOKENS = [
    {"id": "zwerg_krieger",       "prompt": f"stocky dwarf warrior, braided red beard, heavy runic plate armor, double-headed battle axe, fierce expression, glowing runes, {STYLE}"},
    {"id": "zwerg_haendler",      "prompt": f"stout dwarf merchant, well-groomed brown beard with gold rings, rich robes, coin purse, shrewd eyes, ornate dwarven details, {STYLE}"},
    {"id": "waldelfe_bogenschuetze", "prompt": f"slender wood elf archer, silver hair, dark green leather armor with leaf motifs, longbow drawn, glowing green eyes, forest magic aura, {STYLE}"},
    {"id": "dunkelelf_assassine", "prompt": f"dark elf assassin, lavender skin, white hair, black leather armor, twin daggers, cold silver eyes, shadow magic tendrils, {STYLE}"},
    {"id": "mensch_magier",       "prompt": f"human arcane mage, long dark coat with arcane symbols, glowing staff, purple energy crackling around hands, intense expression, {STYLE}"},
    {"id": "mensch_kriegerin",    "prompt": f"human female warrior, auburn hair in braid, silver plate armor, longsword and shield, battle-worn, determined expression, red cape, {STYLE}"},
    {"id": "thorwaler",           "prompt": f"massive norse barbarian, braided blond beard, fur-lined chainmail, giant two-handed sword, war paint, berserker rage eyes, {STYLE}"},
    {"id": "tulamide_haendler",   "prompt": f"middle eastern merchant, dark skin, ornate turban, flowing gold and crimson silk robes, curved scimitar, mysterious smile, {STYLE}"},
    {"id": "ork_krieger",         "prompt": f"brutish green-skinned orc warrior, crude heavy armor with skull decorations, massive spiked club, tusks, war paint, savage energy, {STYLE}"},
    {"id": "ork_schamane",        "prompt": f"hunched orc shaman, greenish-brown skin, bone and feather decorations, wooden staff with skull totem, glowing ritual tattoos, dark magic, {STYLE}"},
    {"id": "goblin_schurke",      "prompt": f"small wiry goblin rogue, mottled green skin, patched leather armor, crooked dagger, enormous ears, mischievous glowing yellow eyes, {STYLE}"},
    {"id": "skelett_krieger",     "prompt": f"undead skeleton warrior, animated bones, rusted ancient armor, sword and shield, glowing green soul fire in eye sockets, dark necromantic aura, {STYLE}"},
    {"id": "untot_zombie",        "prompt": f"rotting zombie undead, torn peasant clothing, decayed flesh, blank milky eyes, grasping hands, dark ichor, shambling pose, {STYLE}"},
    {"id": "daemon_teufel",       "prompt": f"imposing demon, obsidian horns, black scaled skin, burning red eyes, clawed hands, hellfire aura, tattered dark wings, malevolent grin, {STYLE}"},
    {"id": "drache_klein",        "prompt": f"small fierce dragon, emerald green scales, yellow slit eyes, spread wings, smoke from nostrils, sharp talons, {STYLE}"},
    {"id": "nsc_wirt",            "prompt": f"rotund jolly tavern innkeeper, ale-stained apron, friendly smile, holding tankard, warm trustworthy face, {STYLE}"},
    {"id": "nsc_haendlerin",      "prompt": f"middle-aged female merchant, practical clothing, coin purse, merchant ledger, knowing smile, guild mark on collar, {STYLE}"},
    {"id": "nsc_priester",        "prompt": f"elderly temple priest, white and gold robes, holy symbol pendant, gentle wise expression, soft divine glow, {STYLE}"},
]

# ── Bild-Generierung ──────────────────────────────────────────────────────────

def generate_image(prompt: str) -> Image.Image:
    result = fal_client.submit(
        "fal-ai/flux-lora",
        arguments={
            "prompt": prompt,
            "negative_prompt": NEGATIVE,
            "loras": [{"path": LORA_URL, "scale": LORA_SCALE}],
            "image_size": {"width": IMG_SIZE, "height": IMG_SIZE},
            "num_images": 1,
            "num_inference_steps": 28,
            "guidance_scale": 3.5,
            "output_format": "png",
            "enable_safety_checker": False,
        }
    ).get()
    url = result["images"][0]["url"]
    data = urllib.request.urlopen(url).read()
    return Image.open(BytesIO(data)).convert("RGBA")


def remove_background(img: Image.Image) -> Image.Image:
    buf = BytesIO()
    img.convert("RGB").save(buf, "PNG")
    import base64
    b64 = base64.b64encode(buf.getvalue()).decode()
    data_url = f"data:image/png;base64,{b64}"
    result = fal_client.submit(
        "fal-ai/imageutils/rembg",
        arguments={"image_url": data_url}
    ).get()
    data = urllib.request.urlopen(result["image"]["url"]).read()
    return Image.open(BytesIO(data)).convert("RGBA")


# ── Token-Rahmen ──────────────────────────────────────────────────────────────

def apply_token_frame(img: Image.Image, size: int = 256) -> Image.Image:
    """
    Erstellt einen VTT-Token:
    1. Bild auf Kreis croppen
    2. Goldenen dark-fantasy Rahmen drauf
    3. Subtilen inneren Schatten
    """
    img = img.resize((size, size), Image.LANCZOS)

    # ── 1. Kreismaske ──────────────────────────────────────────────────────────
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    padding = int(size * 0.04)
    draw.ellipse([padding, padding, size - padding, size - padding], fill=255)

    # Weiche Kante
    mask = mask.filter(ImageFilter.GaussianBlur(1))

    circle_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    circle_img.paste(img, mask=mask)

    # ── 2. Aeusserer Rahmen (dunkles Gold) ────────────────────────────────────
    frame = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    fd = ImageDraw.Draw(frame)

    # Aeusserer dunkler Ring
    fd.ellipse([0, 0, size - 1, size - 1], outline=(20, 15, 8, 255), width=int(size * 0.025))
    # Goldener Hauptring
    fd.ellipse([int(size*0.01), int(size*0.01), size-int(size*0.01)-1, size-int(size*0.01)-1],
               outline=(160, 120, 40, 255), width=int(size * 0.02))
    # Innerer heller Goldring
    fd.ellipse([int(size*0.04), int(size*0.04), size-int(size*0.04)-1, size-int(size*0.04)-1],
               outline=(200, 165, 80, 180), width=int(size * 0.008))

    # ── 3. Innerer Schatten ───────────────────────────────────────────────────
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    for i in range(8):
        alpha = int(60 * (1 - i / 8))
        offset = int(size * 0.04) + i
        sd.ellipse([offset, offset, size - offset, size - offset],
                   outline=(0, 0, 0, alpha), width=2)

    # ── Zusammenfuegen ────────────────────────────────────────────────────────
    result = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    result.paste(circle_img, (0, 0), circle_img)
    result.paste(shadow, (0, 0), shadow)
    result.paste(frame, (0, 0), frame)

    return result


# ── Main ──────────────────────────────────────────────────────────────────────

def get_tokens(filter_kw: str = None) -> list:
    if filter_kw:
        return [t for t in TOKENS if filter_kw.lower() in t["id"].lower()]
    return TOKENS


def estimate_cost(count: int):
    # generate + rembg (~same cost)
    total = count * COST_PER * 2
    print(f"\n  {count} Tokens x 2 API-Calls = ${total:.2f} USD geschaetzt\n")


def main():
    args      = sys.argv[1:]
    cost_only = "--cost" in args
    no_frame  = "--no-frame" in args
    filter_kw = next((a for a in args if not a.startswith("--")), None)

    tokens = get_tokens(filter_kw)
    if not tokens:
        print("Keine Tokens gefunden.")
        return

    OUT_DIR.mkdir(exist_ok=True)

    print(f"\nDSA Token Generator (Flux LoRA — Dark Fantasy Style)")
    print(f"Tokens: {len(tokens)} | Output: {OUT_DIR}")
    estimate_cost(len(tokens))

    if cost_only:
        return

    for i, token in enumerate(tokens, 1):
        out_path = OUT_DIR / f"{token['id']}.png"
        if out_path.exists():
            print(f"[{i}/{len(tokens)}] {token['id']} — SKIP (existiert)")
            continue

        print(f"[{i}/{len(tokens)}] {token['id']}")
        t0 = time.time()

        try:
            # Generieren
            print(f"  [GEN]  ...", end=" ", flush=True)
            img = generate_image(token["prompt"])
            print(f"OK ({time.time()-t0:.1f}s)")

            # Background entfernen
            print(f"  [RMBG] ...", end=" ", flush=True)
            t1 = time.time()
            img = remove_background(img)
            print(f"OK ({time.time()-t1:.1f}s)")

            # Rahmen anwenden
            if not no_frame:
                img_256 = apply_token_frame(img, 256)
                img_512 = apply_token_frame(img, 512)
                img_256.save(OUT_DIR / f"{token['id']}_256.png", "PNG")
                img_512.save(out_path, "PNG")
            else:
                img.save(out_path, "PNG")

            print(f"  -> {out_path.name} ({time.time()-t0:.1f}s total)\n")

        except Exception as e:
            print(f"\n  FEHLER: {e}\n")

        time.sleep(0.3)

    print(f"\nFertig! Tokens in: {OUT_DIR}\n")


if __name__ == "__main__":
    main()
