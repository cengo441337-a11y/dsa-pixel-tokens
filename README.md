# DSA Pixel-Art Tokens

[![FoundryVTT](https://img.shields.io/badge/FoundryVTT-v12-orange?style=for-the-badge&logo=data:image/png;base64,iVBORw0KGgo=)](https://foundryvtt.com/)
[![Version](https://img.shields.io/badge/Version-0.2.0-brightgreen?style=for-the-badge)]()
[![DSA](https://img.shields.io/badge/System-DSA%205%20%2F%20gdsa-blueviolet?style=for-the-badge)]()
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)]()

> Animierte Pixel-Art Tokens im 16-Bit JRPG-Stil für FoundryVTT — DSA 5 & gdsa kompatibel.

---

## Features

### Animierte Sprites
- **LPC-Spritesheets** (576×256px, 4 Richtungen × 9 Frames) — 4-Richtungs-Laufanimation
- **30+ DSA-Charakterklassen**: Magier, Krieger, Druidin, Hexe, Geweihte, Schurke, Söldner, Elementare, Dämonen, Zombies, Skelette
- **5 Monster-Sprites**: Goblin, Ork, Skelettkrieger, Troll, Oger (prozedural generiert)
- **Kreaturen**: Bär, Fuchs, Ratte, Schlange, Pilzmensch, Hai, Hirsch u.v.m.

### Zaubereffekte (Pixel-Art Animationen)
| Effekt | Typ | FPS |
|--------|-----|-----|
| Flammenpfeil | Projektil | 14 |
| Feuerball | Flächenziel | 12 |
| Blitz | Ziel | 14 |
| Heilung | Aura | 10 |
| Armatrutz | Aura | 10 |
| Pandemonium | Flächenziel | 12 |
| Attributo | Aura | 10 |
| Respondami | Ziel | 10 |
| Aquafaxius | Projektil | 12 |
| Fulminictus | Ziel | 14 |
| Schadenflash | Treffer-Reaktion | 18 |
| Tod-Animation | Tod | 10 |

### Status-Indikatoren
Pixel-Art Icons über dem Token für: Vergiftet, Betäubt, Gesegnet, Gelähmt, Verwirrt, Blind, Tot, Brennend

### Token HUD
Schnellzugriff-Buttons im Token-HUD für die 6 häufigsten Zauber.  
Klick → Effekt am eigenen Token, Shift+Klick → am Ziel (mit `T` anvisieren).

### Combat-Reaktionen
- **Schadenstreffer**: Roter Flash + Blutpartikel bei HP-Verlust (automatisch per preUpdateActor Hook)
- **Tod**: Schwarze Void + lila Partikel + Pixel-Totenkopf bei HP ≤ 0

### Makro-System
Automatische Generierung von Drag&Drop-Makros für alle Effekte.  
Projektile: eigenen Token auswählen + Ziel mit `T` anvisieren → Makro ausführen.

---

## Installation

### Manuell
1. FoundryVTT öffnen → **Add-on Module** → **Install Module**
2. Manifest URL eintragen:
   ```
   https://git.dc-infosec.de/admin/dsa-pixel-tokens/raw/branch/main/module.json
   ```

### Lokal (Entwicklung)
```bash
# Symlink in FoundryVTT Data-Ordner
mklink /D "C:\Users\<user>\AppData\Local\FoundryVTT\Data\modules\dsa-pixel-tokens" "E:\Dev\foundry-modules\dsa-pixel-tokens"
```

---

## Assets generieren

Die Pixel-Art Assets werden mit Python (Pillow + numpy) prozedural generiert:

```bash
# Alle Zaubereffekte (Spritesheets)
python assets/build_effects.py

# Monster-Sprites
python assets/build_monsters.py

# Status-Icons (32×32px)
# Wird automatisch am Ende von build_effects.py generiert
```

**Abhängigkeiten:**
```bash
pip install Pillow numpy
```

---

## Verzeichnisstruktur

```
dsa-pixel-tokens/
├── assets/
│   ├── build_effects.py      # Zaubereffekt-Generator
│   ├── build_monsters.py     # Monster-Spritesheet-Generator
│   ├── build_sprites.py      # Charakter-Spritesheet-Generator
│   ├── fx_*.png              # Generierte Effekt-Spritesheets
│   ├── monsters/             # Monster-Sprites (LPC-Format)
│   ├── status/               # Status-Icon-PNGs (32×32)
│   ├── sounds/               # WAV-Sounds für Effekte
│   └── dsa_*.png             # Charakter-Tokens
├── scripts/
│   └── pixel-tokens.mjs      # Haupt-Modul (FoundryVTT ESModule)
├── styles/
│   └── pixel-tokens.css
├── lang/
│   └── de.json               # Übersetzungen
├── macros/                   # Vorgefertigte Makros
└── module.json
```

---

## Kompatibilität

| System | Status |
|--------|--------|
| DSA 5 (gdsa) | ✅ Vollständig |
| FoundryVTT v12 | ✅ Verified |
| FoundryVTT v11 | ✅ Minimum |
| D&D 5e | ⚠️ HP-Hooks funktionieren |
| PF2e | ⚠️ HP-Hooks funktionieren |

---

## Entwicklung

### Neue Effekte hinzufügen
1. `make_<effektname>()` Funktion in `assets/build_effects.py` schreiben
2. Eintrag in `EFFECTS` Dict am Ende der Datei
3. `python assets/build_effects.py` ausführen
4. EFFECT_PRESETS Eintrag in `scripts/pixel-tokens.mjs` ergänzen

### Hooks (FoundryVTT v12)
- `preUpdateActor` → Schadenflash / Tod-Animation
- `updateToken` + `createActiveEffect` / `deleteActiveEffect` → Status-Icons
- `renderTokenHUD` → HUD-Buttons

---

## Credits

- Sprite-Design: Procedural Python (Pillow) — inspiriert vom [LPC Spritesheet Standard](https://lpc.opengameart.org/)
- Sounds: RPG Sound Pack (OpenGameArt)
- Entwickelt für das Aventurien-Tischrunden-Setup

---

*Nur für den privaten Einsatz mit lizenziertem FoundryVTT und DSA-Regelwerk.*
