#!/usr/bin/env python3
"""
DSA Token Sprite-Sheet Generator
Generiert animierte Sprite-Sheets via Google Nano Banana 2 (gemini-3.1-flash-image-preview)
mit Subject Consistency — Charakter bleibt identisch ueber alle Frames.

Frames pro Animation:
  idle   — 6 Frames (subtile Pose-Variationen)
  attack — 4 Frames (Angriffsbewegung)
  cast   — 4 Frames (Zauberwirken)
  hit    — 3 Frames (Treffer-Reaktion)

Output: sheets/{token_id}_sheet.png
        sheets/manifest.json

Aufruf:
  python generate_spritesheets.py                    # alle Tokens
  python generate_spritesheets.py zwerg_krieger      # nur einen
  python generate_spritesheets.py --cost             # nur Kosten
  python generate_spritesheets.py --idle-only        # nur Idle-Animation
"""

import os, sys, time, json
from pathlib import Path
from PIL import Image
from io import BytesIO

GEMINI_KEY = os.environ.get("GEMINI_KEY") or os.environ.get("GOOGLE_API_KEY")
if not GEMINI_KEY:
    print(
        "[generate_spritesheets] set GEMINI_KEY (or GOOGLE_API_KEY) in your "
        "environment — see .env.example",
        file=sys.stderr,
    )
    sys.exit(1)
os.environ["GOOGLE_API_KEY"] = GEMINI_KEY

from google import genai
from google.genai import types

client = genai.Client()

TOKEN_DIR  = Path(__file__).parent
SHEET_DIR  = TOKEN_DIR / "sheets"
FRAME_SIZE = 192
MODEL      = "gemini-3.1-flash-image-preview"
COST_PER   = 0.03  # ~$0.03 pro generiertes Bild

# ── Style ────────────────────────────────────────────────────────────────────

STYLE = (
    "dark fantasy RPG character art, full body, same character as the reference image, "
    "dramatic rim lighting, deep shadows, rich painterly illustration style, "
    "pure black background, no frame, no border, no UI, high detail"
)

# ── Animationen ──────────────────────────────────────────────────────────────

ANIMATIONS = {
    "idle": {
        "frames": 6,
        "fps": 4,
        "loop": True,
        "prompts": [
            "The character stands at ease, weight slightly shifted to the left foot. " + STYLE,
            "The character in a relaxed stance, head turned slightly, breathing calmly. " + STYLE,
            "The character stands upright, weapon hand slightly relaxed, subtle pose shift. " + STYLE,
            "The character at rest, torso rotated a few degrees, idle breath. " + STYLE,
            "The character standing, weight shifted to right foot, calm expression. " + STYLE,
            "The character in neutral pose, slight lean forward, alert but relaxed. " + STYLE,
        ],
    },
    "attack": {
        "frames": 4,
        "fps": 10,
        "loop": False,
        "prompts": [
            "The character winds up for an attack, weapon drawn back, aggressive wide stance. " + STYLE,
            "The character mid-swing, weapon in fast motion, lunging forward, intense expression. " + STYLE,
            "The character at full extension of the strike, weapon fully extended, impact moment. " + STYLE,
            "The character recovering after the strike, stepping back, guard raised. " + STYLE,
        ],
    },
    "cast": {
        "frames": 4,
        "fps": 8,
        "loop": False,
        "prompts": [
            "The character begins casting a spell, hands raised, faint magical glow around fingers. " + STYLE,
            "The character channeling magic, both arms extended, visible arcane energy swirling around them. " + STYLE,
            "The character releases the spell, bright magical burst from hands, face lit by magic light. " + STYLE,
            "The character after casting, lowering arms, magical afterglow fading, exhaled breath. " + STYLE,
        ],
    },
    "hit": {
        "frames": 3,
        "fps": 10,
        "loop": False,
        "prompts": [
            "The character recoiling from a hit, staggering backward, pain on face, off-balance. " + STYLE,
            "The character stumbling, losing footing, guard broken, wincing. " + STYLE,
            "The character regaining stance after taking a hit, gritting teeth, determined. " + STYLE,
        ],
    },
}

# ── Generator ─────────────────────────────────────────────────────────────────

def generate_frame(token_path: Path, prompt: str) -> Image.Image:
    with open(token_path, "rb") as f:
        img_bytes = f.read()

    response = client.models.generate_content(
        model=MODEL,
        contents=[
            prompt,
            types.Part.from_bytes(data=img_bytes, mime_type="image/png"),
        ],
        config=types.GenerateContentConfig(
            response_modalities=["TEXT", "IMAGE"],
        ),
    )
    for part in response.candidates[0].content.parts:
        if hasattr(part, "inline_data") and part.inline_data:
            return Image.open(BytesIO(part.inline_data.data))
    raise RuntimeError("Kein Bild in der Antwort")


def build_spritesheet(token_id: str, frames: dict) -> Path:
    SHEET_DIR.mkdir(exist_ok=True)
    anim_names = [k for k in ANIMATIONS if k in frames]
    max_cols   = max(len(frames[a]) for a in anim_names)
    sheet = Image.new("RGBA", (max_cols * FRAME_SIZE, len(anim_names) * FRAME_SIZE), (0, 0, 0, 0))
    for row, anim in enumerate(anim_names):
        for col, img in enumerate(frames[anim]):
            sheet.paste(img.resize((FRAME_SIZE, FRAME_SIZE), Image.LANCZOS),
                        (col * FRAME_SIZE, row * FRAME_SIZE))
    out = SHEET_DIR / f"{token_id}_sheet.png"
    sheet.save(out, "PNG")
    return out


def build_manifest(generated: dict) -> Path:
    manifest = {}
    for token_id, anim_data in generated.items():
        manifest[token_id] = {
            "sheet": f"token-art/sheets/{token_id}_sheet.png",
            "frameSize": FRAME_SIZE,
            "animations": {}
        }
        for row, anim_name in enumerate(ANIMATIONS):
            if anim_name not in anim_data:
                continue
            a = ANIMATIONS[anim_name]
            manifest[token_id]["animations"][anim_name] = {
                "row": row,
                "frames": len(anim_data[anim_name]),
                "fps": a["fps"],
                "loop": a["loop"],
            }
    out = SHEET_DIR / "manifest.json"
    out.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    return out


def get_token_files(filter_kw: str = None) -> list:
    tokens = sorted(p for p in TOKEN_DIR.glob("*.png")
                    if not any(s in p.stem for s in ("_nobg", "_sheet")))
    if filter_kw:
        tokens = [p for p in tokens if filter_kw.lower() in p.stem.lower()]
    return tokens


def estimate_cost(num_tokens: int, anims: list) -> float:
    total = sum(ANIMATIONS[a]["frames"] for a in anims) * num_tokens
    cost  = total * COST_PER
    print(f"\n  {num_tokens} Tokens x {sum(ANIMATIONS[a]['frames'] for a in anims)} Frames = {total} API-Calls")
    print(f"  Kosten ca.: ${cost:.2f} USD\n")
    return cost


def main():
    args      = sys.argv[1:]
    idle_only = "--idle-only" in args
    cost_only = "--cost" in args
    filter_kw = next((a for a in args if not a.startswith("--")), None)

    anims  = ["idle"] if idle_only else list(ANIMATIONS.keys())
    tokens = get_token_files(filter_kw)

    if not tokens:
        print("Keine Tokens gefunden.")
        return

    print(f"\nDSA Sprite-Sheet Generator (Nano Banana 2)")
    print(f"Tokens: {len(tokens)} | Anims: {', '.join(anims)} | Frame: {FRAME_SIZE}px")
    estimate_cost(len(tokens), anims)

    if cost_only:
        return

    all_generated = {}

    for ti, token_path in enumerate(tokens, 1):
        token_id  = token_path.stem
        ref_image = Image.open(token_path).convert("RGB")
        print(f"[{ti}/{len(tokens)}] {token_id}")

        frames = {}
        for anim_name in anims:
            frames[anim_name] = []
            for fi, prompt in enumerate(ANIMATIONS[anim_name]["prompts"]):
                print(f"  {anim_name} [{fi+1}/{ANIMATIONS[anim_name]['frames']}]...", end=" ", flush=True)
                t0 = time.time()
                try:
                    frame = generate_frame(token_path, prompt)
                    frames[anim_name].append(frame)
                    print(f"OK ({time.time()-t0:.1f}s)")
                except Exception as e:
                    print(f"FEHLER: {e}")
                    frames[anim_name].append(ref_image.copy())
                time.sleep(0.5)

        sheet_path = build_spritesheet(token_id, frames)
        print(f"  -> {sheet_path.name}\n")
        all_generated[token_id] = frames

    manifest = build_manifest(all_generated)
    print(f"Manifest: {manifest}")
    print(f"\nFertig! {len(all_generated)} Sprite-Sheets generiert.\n")


if __name__ == "__main__":
    main()
