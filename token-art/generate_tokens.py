#!/usr/bin/env python3
"""
DSA Token Art Generator
Generiert Full-Body Character Art für FoundryVTT via fal.ai Flux Dev

Aufruf:
  python generate_tokens.py           # alle Tokens generieren
  python generate_tokens.py zwerg     # nur Tokens die "zwerg" im Namen haben
  python generate_tokens.py --cost    # nur Kosten-Schätzung, kein API-Call
"""

import os, sys, time, json, urllib.request
from pathlib import Path

FAL_KEY  = "9bccea4b-8659-4e26-adca-c1ff54726e42:b806b31c011aee18cf8e14a584e7c74a"
OUT_DIR  = Path(__file__).parent
COST_PER = 0.025   # ~$0.025 pro Flux Dev Bild (512px)

os.environ["FAL_KEY"] = FAL_KEY

import fal_client

# ── Style Prefix ─────────────────────────────────────────────────────────────
# Konsistenter Look über alle Tokens
STYLE = (
    "dark fantasy RPG character token art, "
    "full body standing pose, facing slightly right, "
    "dramatic rim lighting, deep shadows, rich colors, "
    "painterly illustration style, "
    "pure black background, "
    "no frame, no border, no circle, no UI elements, "
    "high detail, concept art quality"
)

NEGATIVE = (
    "round frame, circular border, token frame, UI, HUD, "
    "white background, plain background, blurry, low quality, "
    "multiple characters, cropped, portrait only, floating limbs"
)

# ── Token Definitionen ────────────────────────────────────────────────────────
TOKENS = [
    # Spieler-Charaktere
    {
        "id": "zwerg_krieger",
        "name": "Zwerg Krieger",
        "prompt": f"dwarf warrior, stocky muscular build, braided red beard, "
                  f"heavy dwarven plate armor with rune engravings, "
                  f"double-headed battle axe, determined fierce expression, "
                  f"glowing runes on armor, {STYLE}",
    },
    {
        "id": "zwerg_haendler",
        "name": "Zwerg Händler",
        "prompt": f"dwarf merchant, stout build, well-groomed brown beard with gold rings, "
                  f"rich merchant robes, coin pouch at belt, shrewd calculating eyes, "
                  f"ornate dwarven craftsmanship details, {STYLE}",
    },
    {
        "id": "waldelfe_bogenschuetze",
        "name": "Waldelfe Bogenschütze",
        "prompt": f"wood elf archer, slender graceful figure, long silver hair, "
                  f"dark green leather armor with leaf motifs, elegant longbow drawn, "
                  f"glowing green eyes, forest magic aura, {STYLE}",
    },
    {
        "id": "dunkelelf_assassine",
        "name": "Dunkelelf Assassine",
        "prompt": f"dark elf assassin, pale lavender skin, white hair, "
                  f"black leather armor, twin daggers, cold silver eyes, "
                  f"shadow magic tendrils, sinister elegant pose, {STYLE}",
    },
    {
        "id": "mensch_magier",
        "name": "Mensch Magier",
        "prompt": f"human arcane mage, tall robed figure, long dark coat with arcane symbols, "
                  f"glowing magical staff, purple energy crackling around hands, "
                  f"intense focused expression, arcane tome at belt, {STYLE}",
    },
    {
        "id": "mensch_kriegerin",
        "name": "Mensch Kriegerin",
        "prompt": f"human female warrior, athletic build, dark auburn hair in braid, "
                  f"silver plate armor, longsword and shield, battle-worn look, "
                  f"determined expression, red cape, {STYLE}",
    },
    {
        "id": "thorwaler",
        "name": "Thorwaler Barbar",
        "prompt": f"norse barbarian warrior, massive muscular build, braided blond beard, "
                  f"fur-lined chainmail, giant two-handed sword, "
                  f"war paint on face, berserker rage in eyes, {STYLE}",
    },
    {
        "id": "tulamide_haendler",
        "name": "Tulamide Händler",
        "prompt": f"middle eastern merchant, slim figure, dark skin, ornate turban, "
                  f"flowing silk robes in gold and crimson, curved scimitar at hip, "
                  f"mysterious smile, desert spices and goods, {STYLE}",
    },
    # Gegner / NPCs
    {
        "id": "ork_krieger",
        "name": "Ork Krieger",
        "prompt": f"orc warrior, brutish muscular green-skinned figure, "
                  f"crude heavy armor with skull decorations, massive club, "
                  f"tusks, war paint, primal savage energy, {STYLE}",
    },
    {
        "id": "ork_schamane",
        "name": "Ork Schamane",
        "prompt": f"orc shaman, hunched figure, greenish-brown skin, "
                  f"bone and feather decorations, wooden staff with skull totem, "
                  f"glowing ritual tattoos, swirling dark magic, {STYLE}",
    },
    {
        "id": "goblin_schurke",
        "name": "Goblin Schurke",
        "prompt": f"goblin rogue, small wiry figure, mottled green skin, "
                  f"patched leather armor, crooked dagger, enormous ears, "
                  f"mischievous glowing yellow eyes, {STYLE}",
    },
    {
        "id": "skelett_krieger",
        "name": "Skelett Krieger",
        "prompt": f"undead skeleton warrior, animated bones, rusted ancient armor, "
                  f"sword and shield, glowing green soul fire in eye sockets, "
                  f"tattered robe remnants, necromantic dark aura, {STYLE}",
    },
    {
        "id": "untot_zombie",
        "name": "Zombie",
        "prompt": f"zombie undead, rotting humanoid, torn peasant clothing, "
                  f"decayed flesh, blank milky eyes, outstretched grasping hands, "
                  f"dark ichor dripping, shambling pose, {STYLE}",
    },
    {
        "id": "daemon_teufel",
        "name": "Dämon",
        "prompt": f"demon creature, imposing dark figure, obsidian horns, "
                  f"black scaled skin, burning red eyes, clawed hands, "
                  f"hellfire aura, tattered dark wings, malevolent grin, {STYLE}",
    },
    {
        "id": "drache_klein",
        "name": "Kleiner Drache",
        "prompt": f"small dragon creature, emerald green scales, "
                  f"fierce yellow slit eyes, spread wings, "
                  f"smoke from nostrils, sharp talons, {STYLE}",
    },
    {
        "id": "nsc_wirt",
        "name": "NSC Wirt",
        "prompt": f"tavern innkeeper NPC, rotund jolly man, "
                  f"ale-stained apron, friendly smile, holding tankard, "
                  f"warm tavern lighting, trustworthy face, {STYLE}",
    },
    {
        "id": "nsc_haendlerin",
        "name": "NSC Händlerin",
        "prompt": f"female merchant NPC, middle-aged woman, practical clothing, "
                  f"coin purse, merchant ledger, knowing smile, "
                  f"guild mark on collar, {STYLE}",
    },
    {
        "id": "nsc_priester",
        "name": "NSC Priester",
        "prompt": f"temple priest NPC, elderly man, white and gold robes, "
                  f"holy symbol pendant, gentle wise expression, "
                  f"soft divine glow, {STYLE}",
    },
]

# ── Generator ─────────────────────────────────────────────────────────────────

def estimate_cost():
    print(f"\n{'─'*50}")
    print(f"  {len(TOKENS)} Tokens × ${COST_PER:.3f} = ${len(TOKENS)*COST_PER:.2f} USD")
    print(f"{'─'*50}\n")

def download_image(url: str, dest: Path):
    urllib.request.urlretrieve(url, dest)

def generate_token(token: dict, size: int = 512) -> Path:
    out_path = OUT_DIR / f"{token['id']}.png"
    if out_path.exists():
        print(f"  [SKIP] {token['name']} (existiert bereits)")
        return out_path

    print(f"  [GEN]  {token['name']}...")
    t0 = time.time()

    result = fal_client.submit(
        "fal-ai/flux/dev",
        arguments={
            "prompt": token["prompt"],
            "negative_prompt": NEGATIVE,
            "image_size": {"width": size, "height": size},
            "num_images": 1,
            "enable_safety_checker": False,
            "num_inference_steps": 28,
            "guidance_scale": 3.5,
            "output_format": "png",
        }
    ).get()

    img_url = result["images"][0]["url"]
    download_image(img_url, out_path)
    elapsed = time.time() - t0
    print(f"         → {out_path.name} ({elapsed:.1f}s)")
    return out_path


def remove_background(img_path: Path) -> Path:
    """Hintergrund entfernen via fal.ai rembg → transparentes PNG"""
    print(f"  [RMBG] {img_path.name}...")

    with open(img_path, "rb") as f:
        img_data = f.read()

    import base64
    b64 = base64.b64encode(img_data).decode()
    data_url = f"data:image/png;base64,{b64}"

    result = fal_client.submit(
        "fal-ai/imageutils/rembg",
        arguments={"image_url": data_url}
    ).get()

    out_path = img_path.parent / f"{img_path.stem}_nobg.png"
    download_image(result["image"]["url"], out_path)
    print(f"         → {out_path.name}")
    return out_path


def main():
    args = sys.argv[1:]

    if "--cost" in args:
        estimate_cost()
        return

    # Filter by name if keyword passed
    filter_kw = [a for a in args if not a.startswith("--")]
    tokens = TOKENS
    if filter_kw:
        kw = filter_kw[0].lower()
        tokens = [t for t in TOKENS if kw in t["id"].lower() or kw in t["name"].lower()]
        if not tokens:
            print(f"Keine Tokens mit '{kw}' gefunden.")
            return

    do_rembg = "--rembg" in args  # optional: Hintergrund entfernen

    print(f"\n{'═'*50}")
    print(f"  DSA Token Art Generator — {len(tokens)} Tokens")
    print(f"  Output: {OUT_DIR}")
    print(f"{'═'*50}\n")

    estimate_cost() if not filter_kw else None

    for i, token in enumerate(tokens, 1):
        print(f"[{i}/{len(tokens)}]", end=" ")
        img = generate_token(token)
        if do_rembg:
            remove_background(img)
        time.sleep(0.5)  # kurze Pause zwischen Requests

    print(f"\n{'═'*50}")
    print(f"  Fertig! PNGs in: {OUT_DIR}")
    print(f"{'═'*50}\n")


if __name__ == "__main__":
    main()
