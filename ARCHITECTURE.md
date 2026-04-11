# DSA Pixel-Art Tokens — Architektur

## Projekttyp
**FoundryVTT-Modul** das auf dem `gdsa` System (DSA 4.1) aufbaut.
Wir ersetzen NICHT gdsa, sondern erweitern es um:
- Pixel-Art Character Sheet (Override)
- Automatische VFX bei Proben/Kampf/Magie
- Erweiterte Kampf- und Magie-Dialoge
- Verbesserten Helden-Software XML Import
- Komplette Effekt-Pipeline (Sound + Visual + Automation)

## Dateistruktur

```
dsa-pixel-tokens/
├── module.json                    # Manifest (Dependency: gdsa, socketlib)
├── ARCHITECTURE.md                # Dieses Dokument
│
├── scripts/
│   ├── pixel-tokens.mjs           # [BESTEHEND] Sprite-System, Effekte, Zonen
│   ├── module.mjs                 # Haupt-Entry: Hook-Registration, Sheet-Override
│   ├── config.mjs                 # Konstanten, Spell-DB, Effekt-Mappings, Waffen-DB
│   ├── dice-hooks.mjs             # Hooks in gdsa dice.js: Auto-Trigger Effekte
│   ├── combat.mjs                 # Kampf-Automation: AT/PA/FK Hooks, Manöver
│   ├── magic.mjs                  # Magie-Automation: Zauberprobe-Dialog, Modifikationen
│   ├── sheet.mjs                  # Pixel-Art CharacterSheet Klasse
│   └── xml-parser.mjs             # Helden-Software XML Import (verbessert)
│
├── templates/
│   ├── sheet/
│   │   ├── character-sheet.hbs    # Haupttemplate Heldenbogen
│   │   └── partials/
│   │       ├── header.hbs         # Kopf: Name, Rasse, Kultur, Profession, Bild
│   │       ├── attributes.hbs     # Eigenschaften (MU-KK) + abgeleitete Werte
│   │       ├── resources.hbs      # LeP/AsP/AuP Balken
│   │       ├── talents.hbs        # Talente (alle Kategorien)
│   │       ├── combat.hbs         # Kampftalente, Waffen, Rüstung, INI
│   │       ├── magic.hbs          # Zauber, Rituale, AsP
│   │       ├── equipment.hbs      # Inventar, Geld
│   │       └── notes.hbs          # Notizen, Hintergrund
│   │
│   ├── dialogs/
│   │   ├── probe-dialog.hbs       # 3W20 Talentprobe mit Modifikator-Eingabe
│   │   ├── spell-dialog.hbs       # Zauberprobe + Spontanmodifikationen
│   │   ├── attack-dialog.hbs      # Angriff mit Manöver-Auswahl
│   │   ├── damage-dialog.hbs      # Schaden + RS Verrechnung
│   │   └── zone-select.hbs        # Zone markieren nach Zauberprobe
│   │
│   └── chat/
│       ├── probe-result.hbs       # Proben-Ergebnis im Chat
│       ├── attack-result.hbs      # Angriff/Parade/Schaden im Chat
│       └── spell-result.hbs       # Zauber-Ergebnis im Chat
│
├── styles/
│   ├── pixel-tokens.css           # [BESTEHEND] Sprite/Token CSS
│   ├── sheet.css                  # Character Sheet Styles (Pixel-Art Theme)
│   └── dialogs.css                # Dialog/Chat Styles
│
├── data/
│   ├── spells.json                # Alle DSA 4.1 Zauber
│   ├── talents.json               # Alle Talente mit Proben
│   ├── weapons.json               # Alle Waffen mit Stats
│   ├── armor.json                 # Alle Rüstungen
│   ├── advantages.json            # Vorteile
│   ├── disadvantages.json         # Nachteile
│   ├── special-abilities.json     # Sonderfertigkeiten
│   └── effect-mappings.json       # Zauber → VFX-Effekt Zuordnung
│
├── assets/                        # [BESTEHEND] 200+ PNGs, WAVs
├── lang/de.json                   # [BESTEHEND] Deutsche Lokalisierung
└── macros/                        # [BESTEHEND] Effekt-Makros
```

## Modul-Architektur

### Entry Point: module.mjs
```
init Hook:
  - Register PixelArtCharacterSheet (Override für gdsa PlayerCharakterSheet)
  - Register CSS files
  - Register Handlebars partials
  - Load data/*.json Datenbanken

ready Hook:
  - Dice-Hooks aktivieren (dice-hooks.mjs)
  - Combat-Hooks aktivieren (combat.mjs)
  - Magic-Hooks aktivieren (magic.mjs)
  - Effekt-Makros erstellen (pixel-tokens.mjs)
```

### Sheet Override: sheet.mjs
```
class PixelArtCharacterSheet extends gdsa.PlayerCharakterSheet
  - getData(): gdsa-Daten + unsere Zusatzdaten
  - activateListeners(): Dice-Rolls, Drag-Drop, Tabs
  - _onRollAttribute(): Eigenschaftsprobe mit Dialog
  - _onRollTalent(): Talentprobe mit Modifikator-Dialog
  - _onRollAttack(): Angriff mit Manöver-Dialog
  - _onRollSpell(): Zauberprobe mit Modifikations-Dialog
```

### Dice Hooks: dice-hooks.mjs
```
Hook: renderChatMessage
  - Erkennt gdsa-Würfelergebnisse
  - AT erfolgreich → spawnEffect() auf Ziel
  - AT fehlgeschlagen → Miss-Animation
  - Zauber erfolgreich → Zauber-Effekt + Zone-Dialog
  - Patzer → Patzer-VFX + Sound
  - Glücklich → Glücklich-VFX
```

### Combat: combat.mjs
```
- Manöver-Modifikatoren (aus data/weapons.json)
- Schaden-Berechnung: TP + KK-Bonus - RS = SP
- Wundschwellen-Check: SP >= KO/2 → Wunde
- Fernkampf: Projektil-Animation (spawnProjectile)
- Treffer: schadenflash + Sound
- Verfehlung: Miss-Animation + Sound
```

### Magic: magic.mjs
```
- Spontanmodifikations-Dialog (Slider für jede Mod)
- AsP-Berechnung live im Dialog
- Probe-Erschwernisse live berechnen
- Nach erfolgreicher Probe:
  - Effekt-Typ erkennen (target/zone/projectile/aura)
  - Für Zonenzauber: Grid-Markierung öffnen
  - VFX auto-trigger über effect-mappings.json
```

## gdsa Integration Points

### Daten die wir von gdsa LESEN:
- `actor.system.MU.value` ... `actor.system.KK.value` (Eigenschaften)
- `actor.system.LeP.value/.max` (Lebenspunkte)
- `actor.system.AsP.value/.max` (Astralpunkte)
- `actor.system.ATBasis.value` (AT-Basiswert)
- `actor.system.PABasis.value` (PA-Basiswert)
- `actor.system.FKBasis.value` (FK-Basiswert)
- `actor.system.INIBasis.value` (Initiative)
- `actor.system.MR.value` (Magieresistenz)
- `actor.items` (Waffen, Zauber, SF, etc.)

### Daten die wir SCHREIBEN:
- `actor.system.LeP.value` (nach Schaden)
- `actor.system.AsP.value` (nach Zaubern)
- `actor.system.AuP.value` (nach Anstrengung)
- Flags auf Token/Template für persistente Zonen-Effekte

### Hooks die wir ABFANGEN:
- `renderChatMessage` → Probenergebnis → VFX
- `preUpdateActor` → LeP-Änderung → Schadenflash (schon implementiert)
- `updateToken` → Bewegung → Walk-Animation (schon implementiert)
- `renderTokenHUD` → Quick-Effect Buttons (schon implementiert)

## Pixel-Art Design Language

### Farben
- Background: #1a1a2e (dunkel-lila)
- Panel: #16213e (dunkel-blau)
- Accent: #e94560 (rot)
- Gold: #ffd700
- Text: #eee
- Mana/AsP: #4a90d9 (blau)
- Health/LeP: #d94a4a (rot)
- Stamina/AuP: #4ad94a (grün)

### Schrift
- Haupttext: "Press Start 2P" (Google Font) oder "VT323"
- Zahlen/Werte: monospace pixel font
- Labels: sans-serif klein

### UI-Elemente
- Pixel-Borders (2px solid, retro style)
- 8-bit Style Buttons mit Hover-Glow
- Animierte HP/AsP/AuP Balken
- Retro Tab-Navigation
- Pixel-Art Würfel-Icons
