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


---

# Prüfen und Ändern (seit v0.8.0)

## Das Sicherheitsnetz

```bash
npm run check      # statische Prüfung + 144 Regeltests
npm run test       # nur die Tests
npm run mutation   # baut 19 Fehler ein und verlangt rote Tests
```

Kein Fremdpaket, keine Installation. Wer das Modul frisch klont, kann sofort
prüfen — das war Absicht: eine Prüfung, für die man erst etwas einrichten muss,
läuft irgendwann nicht mehr.

### `tests/foundry-stub.mjs`

Notdürftiger Ersatz für die Foundry-Laufzeitumgebung, damit sich die
Modul-Dateien in einem nackten Node-Prozess importieren lassen. Er ist bewusst
KEIN Foundry-Nachbau: gerade genug, dass der Import durchläuft. Wer eine
Funktion testen will, die echtes Foundry-Verhalten braucht, setzt dieses
Verhalten im Test selbst — nicht heimlich im Ersatz. Sonst prüft der Test am
Ende den Ersatz statt das Modul.

### `tests/syntaxpruefung.mjs`

Acht Prüfungen für Fehlerklassen, die `node --check` durchwinkt:

| Prüfung | Fängt |
|---|---|
| Syntax | kaputte Klammern |
| JSON | unlesbare Daten-Dateien |
| Selbstzuweisung | `const x = x` — gültige Syntax, wirft zur Laufzeit |
| Aufruf vor Deklaration | `const helfer` unterhalb seines Aufrufs |
| Ladbarkeit | jedes Modul lädt kopflos |
| Unbekannte Bezeichner | benutzt, aber nirgends deklariert |
| Chat | direkte `ChatMessage.create`-Aufrufe |
| Verdrahtung | neue Bausteine, die niemand aufruft |

Jede dieser Prüfungen war einmal rot — wie man das nachstellt, steht im
Kommentar der jeweiligen Prüfung.

### `tests/mutationspruefung.mjs`

Prüft die Tests, nicht den Code. Ein grüner Testlauf beweist nur, dass die Tests
durchlaufen — nicht, dass sie etwas merken würden. **Wer eine neue Regel
absichert, trägt hier eine Mutation dazu ein.** Eine Regel ohne Mutation ist
eine Regel, von der niemand weiss, ob ihr Test greift.

## Wiederkehrende Muster

**Eine Regel, eine Stelle.** Wo dieselbe Rechnung an mehreren Orten stand, lief
sie auseinander: der Initiative-Malus wurde an vier Stellen verschieden
gerechnet, die Trefferzone aus zwei verschiedenen Tabellen gewürfelt, die
Schadensformel von drei Umwandlern übersetzt — einer davon falsch. Neue Regeln
gehören nach `config.mjs` und werden von dort aufgerufen.

**Vergessen darf nicht stillschweigend funktionieren.** `deduplicateActors()`
löscht nur mit ausdrücklichem Schalter; wer ihn vergisst, bekommt eine Liste
statt eines Verlusts. `applyCrit()` liefert die einzigen gültigen Werte; wer den
Aufruf vergisst, bekommt kein falsches Ergebnis, sondern gar keins.

**Maschinenentscheidungen nicht aus Fliesstext.** Eigene Chatnachrichten tragen
ihr Ergebnis maschinenlesbar im Kennfeld (`dsaChat` / `dsaFlags`). Die
Textauswertung in `dice-hooks.mjs` ist ausdrücklich eine Notlösung für fremde
Module, deren Aufbau wir nicht ändern können.

## Neue Systeme seit v0.8.0

```
scripts/zustaende.mjs        Die acht DSA-4.1-Zustände, Stufe 0–4.
                             zustandsMalus() wird von sheet.mjs bei jeder
                             Probe und jedem Kampfwurf gelesen.

scripts/sammelprobe.mjs      Kumulative Proben über mehrere Versuche.
                             versuchVerrechnen() ist rein — die Würfel kommen
                             von aussen, nur deshalb prüfbar.

scripts/kampfuebersicht.mjs  Lesende Tafel über alle Kämpfer.
                             sichtbarFuer() entscheidet, wer welche Werte sieht.
```

---

# Was bewusst offen ist

Damit niemand sucht und denkt, er habe etwas übersehen.

**Rundung der Fünftel-Formeln.** `DERIVED_FORMULAS` benutzt `Math.round` für
AT-, PA-, FK-, INI-Basis und Magieresistenz, mit Verweis auf WdH S.20 („echt
gerundet"). Ein Prüfbericht hat `Math.ceil` gefordert. Ich konnte die Quelle
nicht einsehen und habe die dokumentierte Entscheidung stehen lassen — eine
begründete Wahl gegen eine ungeprüfte Behauptung auszutauschen wäre keine
Verbesserung. Wer das Regelwerk zur Hand hat, entscheidet es an genau einer
Stelle: `config.mjs::DERIVED_FORMULAS`.

**Ausweichen-Basiswert.** `AW` entspricht dem PA-Basiswert (Verweis auf
WdS S.66). Es gibt Fassungen, die GE/2 nennen. Der Widerspruch im Modul selbst —
ein Fallback in `_rollDodge`, der `PA-Basis/2` rechnete — ist beseitigt; die
Regelfrage bleibt offen.

**Geltungsbereich einzelner Zustände.** Dass pro Stufe ein Punkt abgezogen wird
und Stufe 4 handlungsunfähig macht, ist einheitlich. Welche Eigenschaften ein
einzelner Zustand genau betrifft, ist zwischen den Regelwerken unterschiedlich
beschrieben. Die Tabelle steht deshalb gebündelt in `zustaende.mjs::ZUSTAENDE`
und ist an einer Stelle korrigierbar.

**Auslegung von `value` im Helden-Import.** Das Feld bedeutet in den drei
vorliegenden Heldendateien nicht dasselbe — mal Zukauf, mal Endwert.
`mrAusImport()` unterscheidet am Formelwert. Das ist eine begründete Auslegung,
keine dokumentierte Schnittstelle. Taucht eine Datei auf, bei der sie
danebenliegt, gehört sie als Testfall in `tests/helden-import.test.mjs`.

**Nicht geprüft: die Oberfläche.** Getestet wird, was gerechnet wird. Dialoge,
Fenster und HTML bleiben ungetestet — Oberflächen ändern sich schneller, als
ihre Tests nützen.

**Nicht geprüft: eine laufende Foundry-Instanz.** Alle Befunde und alle
Reparaturen sind gegen den Quelltext und gegen die Regeltests belegt, nicht
gegen eine laufende Welt. Die Ressourcen- und Rechte-Reparaturen
(Ticker-Absicherung, Spielleiter-Umweg, Statussymbole) sollten beim nächsten
Spielabend beobachtet werden.

**Offen aus den Prüfberichten, noch nicht angefasst:** die Reihenfolgeabhängigkeit
beim `_finalMax`-Schnappschuss im Import, die fehlende Weitergabe von `merkmal`
und `isBeschwoerung` aus dem Heldenbogen an `castSpell` (dadurch laufen
Beschwörungen als gewöhnliche Zauber), die Kosten-Auslegung bei 165 Zaubern mit
Zusatzterm, und der Radius von Zonenzaubern bei Szenen mit `grid.distance` ≠ 1.
