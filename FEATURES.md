# DSA Pixel-Art Tokens — Feature-Ubersicht

_FoundryVTT v12 Modul fur DSA 4.1 (gdsa-System)_
_Letzte Aktualisierung: April 2026_

---

## Kampfsystem

### Angriff (1W20 vs AT)
- **13 Kampfmanover** mit vollstandiger Regelumsetzung (WdS):
  - Normaler Angriff
  - Wuchtschlag (AT-Ansage, +Ansage TP mit SF / halbe ohne)
  - Finte (AT-Ansage, gegnerische PA-Ansage fur diese Abwehr)
  - Gezielter Stich (AT-4, ignoriert 2 RS, auto +1 Wunde, benotigt SF)
  - Hammerschlag (AT-8, verbraucht alle Aktionen, benotigt SF)
  - Niederwerfen (AT-4, Gegner KK-Probe, benotigt SF)
  - Sturmangriff (AT-Ansage, TP+GS/2+4, RS ignoriert, Passierschlag bei Miss)
  - Todesstoss (AT-8, RS ignoriert, WS-2, +2 auto Wunden, Passierschlag bei Miss)
  - Klingensturm (AT+2, auf 2 Gegner aufteilen, benotigt SF)
  - Passierschlag (AT-4, keine Parade moglich, INI-1W6 bei Treffer)
- **Gezielter Angriff** auf bestimmte Korperzone (Kopf -8, Arm/Bein -4)
- **Kritischer Treffer** (1) und **Patzer** (20) mit Bestatigungswurf
- **Patzer-Tabelle** (1W6 bei bestatigtem Patzer)
- Automatischer **Trefferzonen-Wurf** (1W20 nach WdS-Tabelle)
- **Zonen-RS** des Ziels wird im Chat angezeigt

### Parade (1W20 vs PA)
- **Normale Parade** + 3 Parade-Manover:
  - Meisterparade (PA-Ansage, nachste Aktion +Ansage)
  - Gegenhalten (Gegenangriff AT-4 sofort)
  - Binden (eigene AT+Ansage, gegnerische PA-Ansage)
- **Gluckliche Parade** (1 gewurfelt → Freie Aktion bleibt erhalten)
- **Sehr grosser Gegner** Checkbox: Parade ohne Schild wird blockiert

### Ausweichen (1W20 vs AW)
- **Normales Ausweichen** (Freie Aktion, AW - halbe eBE)
- **Gezieltes Ausweichen** (Volle Aktion, AW + Ansage - volle eBE)
- Gluckliches Ausweichen (1) und Patzer (20) mit Bestatigung
- Gegen sehr grosse Gegner (GK II+): einzige Verteidigung ohne Schild

### Schadenswurf
- Automatische TP-Berechnung aus Waffendaten (z.B. "2W6+4")
- **Auto-Trefferzone** (1W20)
- **Zonen-RS** des Ziels wird automatisch berechnet (aus Rustungs-Datenbank)
- **Manover-Boni** werden automatisch verrechnet (Wuchtschlag, Sturmangriff etc.)
- **Auto-SP-Abzug**: LeP des markierten Ziels werden automatisch reduziert
- Chat zeigt: TP - RS = SP, neue LeP des Ziels, Kampfunfahig-Warnung bei 0 LeP

### Wundregeln (NEU)
- **Wundschwellen** basierend auf KO:
  - WS1 = KO/2 (aufgerundet) → 1 Wunde
  - WS2 = KO → 2 Wunden
  - WS3 = KO x 1.5 (aufgerundet) → 3 Wunden
- **Persistentes Wunden-Tracking** pro Trefferzone (8 Zonen)
- **Kumulative Penalty**: -1 pro Wunde auf ALLE Proben (AT, PA, Talente, Eigenschaften)
- **3+ Wunden auf einer Zone**: Zone UNBRAUCHBAR (Warnung im Chat)
- **Wund-Anzeige** auf dem Charakterbogen mit Zonen-Ubersicht
- **Heilen-Button** zum Zurucksetzen aller Wunden
- Manover-Integration: Gezielter Stich (+1 auto Wunde), Todesstoss (+2 auto Wunden, WS-2)

### Fernkampf
- **FK-AT** = FK-Basis + volles TAW (nicht halbes wie bei Nahkampf)
- **Reichweiten-Modifikatoren**: Nah +2, Mittel 0, Fern -2, Sehr fern -4
- **Pfeil-Verzauberung**: 9 Elementar-Pfeile (Feuer, Eis, Erz, Blitz, Luft, Humus, Gift, Wasser, Dunkelheit)
- VFX-Projektil vom Schutzen zum Ziel mit Einschlag-Effekt

### Rustungssystem
- **70+ Rustungsteile** aus WdS Datenbank mit Zonen-RS
- **8 Trefferzonen**: Kopf, Brust, Rucken, Bauch, L./R. Arm, L./R. Bein
- **Gewichtete BE (gBE)** statt roher BE — dezimal, nicht gerundet
- **Effektive BE (eBE)** nach Rustungsgewohnung
- **Rustungsgewohnung** I/II/III mit korrekten Regeln
- **INI-Malus** durch Rustung + Schild
- **Schild-System**: AT-Malus + PA-Bonus auf alle Kampftalente

### Passierschlag-Automation
- Automatischer Passierschlag-Dialog wenn ein Token aus Nahkampfreichweite bewegt wird
- Alle angrenzenden Gegner erhalten die Moglichkeit zum Passierschlag

---

## Magiesystem

### Zauberprobe (3W20)
- Vollstandige 3W20-Probe mit allen 3 Probe-Eigenschaften
- **TaP*-Berechnung** (Talentpunkte ubrig)
- Kritisch (dreifach 1) und Patzer (dreifach 20) Erkennung
- Automatischer **AsP-Abzug** nach erfolgreicher Probe
- Würfelformeln als Kosten (z.B. "2W6 AsP") werden sofort ausgewurft

### Spontane Modifikationen (WdZ-konform)
6 Modifikations-Kategorien:
1. **Reichweite** (vergrossern/verkleinern)
2. **Zauberdauer** (halbiert/verdoppelt)
3. **Wirkungsdauer** (verdoppelt/halbiert/fest)
4. **AsP-Einsparung** (-10% bis -50%)
5. **Erzwingen** (doppelte AsP, +1 bis +5 Erleichterung)
6. **Veranderte Technik** (Komponente weglassen)

### Reprasentations-spezifische Regeln
- **Gildenmagisch**: Alle ZfP-Kosten halbiert
- **Elfisch**: 1 AsP Rabatt, KL/IN tauschbar in Probe
- **Borbaradianisch**: Reichweite 7 ZfP/Stufe
- **Druidisch**: Erzwingen immer moglich, halbe AsP
- **Kristallomantisch**: Alle ZfP x2 (ohne Kristall), AsP x0.75
- **Schelmisch**: Kein Erzwingen, keine Wirkungsdauer-Verdoppelung

### Zauber-Datenbank
- **689 Zauber** mit Probe, Kosten, Reichweite, Dauer, Varianten
- Aus Liber Cantiones, WdZ und Erganzungsbandern
- Zauber-Varianten mit konditionalen ZfP-Kosten

### Zoneneffekte
- **Messbare Template-Platzierung** fur Flachenzauber
- 4 Formen: Kreis, Kegel, Strahl, Feld
- Einstellbarer Radius/Lange
- Farbcodiert je Zauber-Element

---

## VFX-Engine

### PIXI.Graphics-basierte Effekte
35+ dynamisch gerenderte Effekte — keine Sprite-Sheets, alles Echtzeit:
- **Feuer**: Feuerball, Explosion, Brennen, Flammeneffekte
- **Eis**: Eiskristalle, Frostschild, Kalteeffekte
- **Blitz**: Zackenblitze mit Verzweigungen, Screen-Flash
- **Heilung**: Goldene Sterne, sanfte Ring-Pulse
- **Schatten**: Dunkle Tentakel, Schattenform
- **Gift**: Toxische Wolke, Blasen
- **Wasser**: Wellen, Wasserstrahl
- **Wind**: Wirbel mit Partikel-Trails
- **Beschworing**: Ritualkreis mit aufsteigender Entitat
- **Tod**: Dunkle Nova, Seelen-Wisps

### Auto-VFX bei Zauberproben
- **200+ Zauber** direkt zu VFX gemappt (SPELL_EFFECT_MAP)
- Automatische Effekt-Erkennung bei erfolgreicher Zauberprobe
- Keyword-Fallback fur nicht gemappte Zauber
- Effekt-Typen: Projektil, Ziel, Zone, Aura

### Projektil-System
- Animierte Projektile vom Zauberer zum Ziel
- Einschlag-Effekte bei Treffer
- 9 Pfeil-Verzauberungen mit eigenen Projektilen

### Effekt-Picker
- Token-HUD Button (Blitz-Icon) offnet Effekt-Auswahl
- Alle 34 Effekte direkt abspielbar
- `DSAEffekte()` Macro-Funktion

---

## Wurfel-Animationen

- **Pixel-Art W20** und **W6** direkt auf dem Canvas
- Automatisch bei jedem Wurf am aktiven Token des Wurfelenden
- PIXI.Graphics gerendert (kein Sprite-Sheet)
- Farbcodiert: Gold (Krit), Rot (Patzer), Weiss (Normal)

---

## Kampf-Sounds

- **Nahkampf**: Treffer-Sound sofort (hit_impact.wav / hit_armor.wav fur Krit)
- **Fernkampf**: Abschuss-Sound + verzogerter Einschlag (realistisch nach Flugzeit)
- **Patzer**: Eigener Fumble-Sound
- **Daneben**: Miss-Sound
- **Zauber**: Spell-Sound bei Probe

---

## Kreaturen-System

### Kreaturen-Picker
- **138+ Kreaturen** aus offiziellen Quellen (Tractatus Contra Daemones, Elementare Gewalten, Von Toten und Untoten)
- Gruppiert nach Typ:
  - Damonen (nach Erzdamon: Blakharaz, Lolgramoth, Tasfarelel etc.)
  - Elementargeister, Dschinne, Meister-Dschinne
  - Benannte Elementare (Blizzantil, Himmelsgazelle etc.)
  - Untote (Skelette, Zombies, Mumien, Ghule etc.)
  - Golems (Abu al Hamam, Al Jallahir etc.)
  - Monster (Drachen, Oger, Trolle etc.)
- Ein-Klick-Spawning: Actor + Token werden automatisch erstellt
- Vollstandige Stats aus Datenbank (LeP, AT, PA, MR, RS, GS, INI, Waffen, Zauber, Fahigkeiten)

### Kreaturen-Sheet
- **Kreatur-Info**: Domane, Grosse, Aktionen/Runde, RS
- **Waffen-Tabelle**: Name, AT, PA, TP, Besonderes
- **Fahigkeiten**: Spezialfahigkeiten der Kreatur
- **Zauber**: Zauber mit ZfW-Werten
- **Dienste**: Damonische Dienste
- **Naturlicher RS** wird auf alle Zonen angewendet

### Token-System
- **LPC Sprite-Sheet Support** mit 4-Richtungen Animation
- Konfigurierbare Frame-Dimensionen, FPS, Skalierung
- Richtungserkennung bei Bewegung
- Idle-Animation
- **67 Damonen-Tokens** (Pixel-Art, Chibi-Stil — alle Erzdamonen-Diener)
- **18 Dschinn/Elementar-Tokens** (6 Elementargeister + 6 Dschinne + 6 Meister-Dschinne)
- **6 Monster-Tokens** (Goblin, Ork, Skelettkrieger, Troll, Oger + mehr)
- **52 Helden/NPC-Tokens** (diverse Varianten, Klassen, Spielercharaktere)
- **137 Token-Dateien** insgesamt
- **Grossen-Presets**: 1x1 bis 4x4 Grid

---

## Charakter-Import

### Helden-Software XML Import
- Importiert direkt aus Helden-Software Export-XML
- Alle 8 Eigenschaften
- Kampf- und regulare Talente
- Zauber mit ZfW
- Vorteile, Nachteile, Sonderfertigkeiten
- Waffen und Rustung
- Aktuelle Ressourcen (LeP, AsP, AuP)

---

## Datenbank-Browser

### Integrierte Nachschlagewerke
7 durchsuchbare Datenbanken direkt im Sheet:
1. **Waffen** — Nahkampf + Fernkampf mit allen Werten
2. **Rustungen** — 70+ Teile mit Zonen-RS
3. **Zauber** — 689 Zauber mit Probe, Kosten, Varianten
4. **Talente** — 86 Talente mit Probe und Kategorie
5. **Alchemika** — Tranke und alchemische Gegenstande
6. **Vorteile/Nachteile** — Charakter-Eigenschaften
7. **Sonderfertigkeiten** — SF-Katalog

- Live-Suche, Kategorie-Filter
- Ein-Klick zum Hinzufugen auf Charakterbogen

---

## Charakterbogen

### Tabs
1. **Werte** — Alle 8 Eigenschaften (wurfbar), Vor-/Nachteile, SF
2. **Talente** — 6 Kategorien, BE-Penalty, sortierbar
3. **Kampf** — Kampftalente, Ausweichen, Waffen, Rustung, Wunden, Zonen-RS
4. **Magie** — Zauberliste, Ritualfertigkeiten (nur bei Zauberer)
5. **Inventar** — Ausrustung, Geld, Datenbank-Browser
6. **Notizen** — Kreatur-Infos, freies Textfeld

### Ressourcen-Leisten
- **LeP, AsP, KaP, AuP** mit farbcodierten Balken
- +/- Buttons und Klick-zum-Bearbeiten
- Regenerations-Buttons: Rast, Meditation, Nachtschlaf, Volle Regeneration

### Abgeleitete Werte (Header)
INI (mit Rustungs-Malus), MR, GS, WS, AT-Basis, PA-Basis, FK-Basis, AW (klickbar)

---

## Design

### Dark Fantasy Aesthetic
- Tiefschwarzer Hintergrund (#07070e)
- Bernstein/Gold-Akzente
- **VT323** Monospace-Font fur Werte
- **Cinzel** Serif-Font fur Titel
- Farbcodierte Ressourcen (LeP grun, AsP blau, AuP orange, KaP lila)
- Hover-Glow-Effekte
- Chat-Nachrichten im einheitlichen Dark-Fantasy-Stil

---

## Technische Details

- **FoundryVTT v12** kompatibel (gdsa-System)
- **PIXI.js v7** fur VFX und Wurfel-Animationen
- **socketlib** fur Multiplayer-VFX-Synchronisation
- **ES Module** Architektur (*.mjs)
- Keine externen Abhangigkeiten ausser FoundryVTT + socketlib
