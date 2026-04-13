import sys, os, time, base64, urllib.request, urllib.parse, json
sys.stdout.reconfigure(encoding='utf-8')
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image
import numpy as np
import io

FAL_KEY = "9bccea4b-8659-4e26-adca-c1ff54726e42:b806b31c011aee18cf8e14a584e7c74a"
OUT_DIR = os.path.join(os.path.dirname(__file__), 'monsters')
BASE = "chibi pixel art RPG token, fantasy dark demon, 2D pixel art 8-bit style, vibrant colors, black outline, cute but menacing, full body portrait, centered, white background"

DEMONS = [
    ("aphestadil", f"{BASE}, slim dark female demon, flowing black gown, young body ancient wrinkled face, long knee-length black hair, sleep demoness, multiple horns, eerie pale glow"),
    ("eugalp", f"{BASE}, rotting zombie corpse demon, 4 curved pus-dripping horns on back, plague boils and sores, pestilence aura, greenish decay, Mishkhara servant"),
    ("hanaestil", f"{BASE}, seductive ebony-skinned dark female demon, white ankle-length flowing hair, 5 horns, Dar-Klajid servant, alluring but dangerous, dark beauty"),
    ("hirr_nirat", f"{BASE}, giant demonic rat, reddish glowing eyes, plague aura, foul misty haze around it, Mishkhara rat lord, oversized supernatural rat"),
    ("ivash", f"{BASE}, humanoid fire demon, made of living flame, fire tongue, vague human shape in flame, fire spirit demon, servant of Nameless God"),
    ("may_hay_tam", f"{BASE}, giant tree plant demon, thick vine tentacles, branches as arms, seaweed and roots, ancient demonic tree creature, eldritch plant monster"),
    ("qok_maloth", f"{BASE}, crippled vulture demon, deformed magical vulture, dark feathers, menacing beak, knowledge and magic demon, Amazeroth servant"),
    ("quitslinga", f"{BASE}, multi-armed tentacle nightmare demon, shapeshifter true form, 4 horns, multiple tentacle arms, 4-horned horror, Amazeroth shapeshifter"),
    ("shihayazad", f"{BASE}, massive 7-horned reptilian demon, bat wings, rat-like head with human features, yellow slit eyes, only 2 clawed legs, spines on back, chaos destroyer"),
    ("thaz_laraanji", f"{BASE}, beautiful dream demon succubus incubus, ethereal seductive form, Belkelel servant, glowing eyes, night visitor, dream stealer"),
    ("thalon", f"{BASE}, small black weasel demon, supernatural dark weasel, glowing eyes, Belshirash servant, quick and stealthy demonic weasel"),
    ("amrychoth", f"{BASE}, triangular manta ray demon, dark underwater, 5 horn-like mouthpieces in front, 3 red eyes, water swirling around it, Charyptoroth servant"),
    ("amrifas", f"{BASE}, giant earth worm demon, massive subterranean worm, 9 horns, earth shaker, Agrimoth servant, huge coiling worm from underground"),
    ("haqoum", f"{BASE}, humanoid demon with giant water-balloon head, golden skin with gemstone warts, single sparkling diamond horn on forehead, richly dressed Grolm-like figure"),
    ("qasaar", f"{BASE}, tiny demonic black kitten, innocent cute appearance but evil eyes, pechblack fur, Aphasmayra servant, Cha'Shahr, small purring cat demon"),
    ("je_chrizlayk_ura", f"{BASE}, black slime blob demon, 1 horn with pendulous eyeball, covered in warts, shapeless amorphous body, construction demon, Agrimoth worker demon"),
    ("mactans", f"{BASE}, spider body demon, 5 orange horns on chitin back, weeping warts, tentacles with blue unholy glow instead of head, sinister magical spider"),
    ("iltapeth_istapher", f"{BASE}, conjoined twin demon, one body with two heads four arms three legs, sickly green scales, grotesque mirrored human faces, Aphestadil servant"),
    ("muwallaraan", f"{BASE}, obsidian black horse demon, large bat wings from shoulders, blood-red glowing eyes, fanged mouth, Belkelel demonic steed"),
    ("karunga", f"{BASE}, floating amorphous green glowing entity, bright neon green blob, formless hovering demon, Amazeroth messenger, luminescent chaos spirit"),
    ("karmoth", f"{BASE}, massive bull demon, 6 forward-curved horns, single red eye under forehead, black shaggy fur, brilliant red tongue, holding two giant axes, Belhalhar warlord"),
    ("usuzoreel", f"{BASE}, ghostly frozen humanoid demon, grotesque translucent ice shape, no solid form, terrifying screaming ghost, Belshirash Wild Hunt driver"),
    ("azamir", f"{BASE}, two enormous alien monstrous eyes floating in darkness, flame pillar, icy spectral wind form, 7-horned relentless pursuer demon, no visible body only eyes"),
    ("isyahadin_rahastes", f"{BASE}, twin chaos cloud demons, dark roiling swirling black mist, twin silhouettes in the fog, insect buzzing aura, plague harvest destroyers"),
]

def remove_bg(img_bytes, target=256):
    img = Image.open(io.BytesIO(img_bytes)).convert("RGBA")
    arr = np.array(img)
    r, g, b, a = arr[:,:,0], arr[:,:,1], arr[:,:,2], arr[:,:,3]
    white_mask = (r > 235) & (g > 235) & (b > 235)
    arr[:,:,3] = np.where(white_mask, 0, a)
    result = Image.fromarray(arr).resize((target, target), Image.LANCZOS)
    buf = io.BytesIO()
    result.save(buf, format='PNG')
    return buf.getvalue()

def call_fal(name, prompt, retries=3):
    payload = json.dumps({
        "prompt": prompt,
        "image_size": "square",
        "num_inference_steps": 4,
        "num_images": 1,
        "enable_safety_checker": False
    }).encode()
    url = "https://fal.run/fal-ai/flux/schnell"
    req = urllib.request.Request(url, data=payload, headers={
        "Authorization": f"Key {FAL_KEY}",
        "Content-Type": "application/json"
    })
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                data = json.loads(resp.read())
                img_url = data['images'][0]['url']
            img_req = urllib.request.Request(img_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(img_req, timeout=120) as r:
                raw = r.read()
            return raw
        except Exception as e:
            print(f"  [retry {attempt+1}] {name}: {e}")
            time.sleep(3)
    raise RuntimeError(f"Failed after {retries} retries: {name}")

def gen_demon(name, prompt):
    raw_path = os.path.join(OUT_DIR, f"{name}_raw.png")
    out_path = os.path.join(OUT_DIR, f"{name}_token.png")
    if os.path.exists(out_path):
        print(f"  [SKIP] {name} already exists")
        return name, True
    print(f"  [GEN] {name}...")
    raw = call_fal(name, prompt)
    with open(raw_path, 'wb') as f:
        f.write(raw)
    clean = remove_bg(raw)
    with open(out_path, 'wb') as f:
        f.write(clean)
    print(f"  [OK]  {name}")
    return name, True

print(f"Generating {len(DEMONS)} WdZ demon tokens...")
errors = []
with ThreadPoolExecutor(max_workers=5) as ex:
    futures = {ex.submit(gen_demon, n, p): n for n, p in DEMONS}
    for fut in as_completed(futures):
        try:
            n, ok = fut.result()
        except Exception as e:
            n = futures[fut]
            errors.append(n)
            print(f"  [ERR] {n}: {e}")

print(f"\nDone. Errors: {errors if errors else 'none'}")
