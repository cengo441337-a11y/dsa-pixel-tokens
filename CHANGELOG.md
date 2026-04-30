# Changelog

Alle wichtigen Änderungen an diesem Modul werden hier dokumentiert.
Format: [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionen nach
[SemVer](https://semver.org/lang/de/).

---

## [0.5.0] — 2026-04-30

### 🙏 Neues System: Liturgien & Karma

Komplettes Karma-/Liturgien-System für **Geweihte** mit Daten aus
*Liber Liturgium* (Ulisses Spiele GmbH).

**298 Liturgien aus dem Liber Liturgium**
Vollständiger PDF-Import aller 267 Liturgien aus dem Regelbuch + 31
House-Rule-Erweiterungen (Hochschamanen-Pantheons + Petromantie-Reskins).
Pro Liturgie:
- Symbole, Gesten, Gebete (Originaltext mit Litaneien/Gebetsformeln)
- Auswirkung (Detail-Regelmechanik)
- Anmerkungen (Sonderfälle, Einschränkungen)
- Ritualdauer / Wirkungsdauer / Herkunft / Voraussetzung
- KaP-Kosten + pKaP-Anteil nach Grad-Tabelle

**Liturgien-Browser-UI** (`templates/liturgies.hbs` + `scripts/liturgies.mjs`)
- Filter: Gott (alle 12 Götter + Halbgötter + Hochschamanen-Pantheons), Grad I-VIII, Volltextsuche
- Liturgie-Karten mit Klappbereichen für Symbole/Auswirkung/Anmerkungen
- Mirakel-Schnellbuttons (Mirakel+ / ungelistet / Mirakel−) direkt im Header
- Wirken-Button mit Aufstufungs-Dialog (4 Kategorien: Ritualdauer/Reichweite/Wirkungsdauer/Ziel)
- Mitbeter-System mit automatischer LkP-Aggregation
- Modifikator-Tabelle (Notlage/Auftrag/eigener Tempel/Feiertag/Limbus etc.)

**Karma-Mechanik**
- KaP-Probe via `1W20 ≤ LkW − Probenzuschlag(Grad) − Modifikatoren`
- Primäre Segnung mit −2 Erleichterung + 2 KaP für Heimatkult
- Mirakel: 5 KaP fix, 1 Aktion, ±0/+6/+18 je nach Talent-Beziehung
- pKaP-Anteil ab Grad V automatisch (1/3/5/7 nach Grad)
- Misslingen: 1/5 KaP verloren (mind. 1)

**Hochschamanen-Pantheons** (Kamaluq / Tairach / Himmelswölfe)
- 33 Pantheon-spezifische Liturgien aus *Liber Liturgium* S.35-36/43-44/63-64
- Sonderregeln (12 KaP fix, Mirakelprobe via *Geister aufnehmen*, keine primäre Segnung)
- SF "Kontakt zum Großen Geist" (700 AP, 2. Initiation)

### 🪶 Neues System: Schamanen-Rituale & Petromantie

Vier-Geister-Fertigkeiten-System für **Schamanen** aus *Wege der Zauberei* + *Elementare Gewalten*.

**72 Schamanen-Rituale** über 11 Kulturen
- Wdm/Utu/Toc/Niv/Ork/Gob/Gja/Fer/Tzk/Ach/**Wuhl** (Wühlschrate)
- Inkl. Tairach-Spezial-Rituale (Khurkachai/Ergochai), Wolfsruf-Familie
  (8 Varianten Wolf/Wildschwein/Rind/Hai/Oger/Mammut/Schlinger/Seeschlange),
  Reitender Geist, Tiergestalt, Element-Hauch

**18 Petromantie-Rituale** (Erz-Reskins) für Wühlschrat-Schamanen
- Echo der Steine, Erzkraft, Schutz der Höhle, Stimme des Felsens,
  Nähre meine Sippe, Kraft der Berge, Trollruf u.v.m.

**Vier Geister-Fertigkeiten** als eigenständige Talente:
- Geister rufen (MU/IN/CH) — Kontakt + Herbeirufung
- Geister bannen (MU/CH/KK) — Geistkampf, Vertreibung
- Geister binden (KL/IN/CH) — Geist in Objekt halten
- Geister aufnehmen (MU/IN/KO) — Geist als Buff einfahren

**AsP-Würfel pro Grad**: 1W6 → 6W6 (Grad I-VI), ab V mit 1/10 permanent
SF Verbotene Pforten erlaubt LeP-Zahlung bei AsP-Erschöpfung.

**Schamanen-Browser-UI** (`templates/shamanism.hbs` + `scripts/shamanism.mjs`)
- Filter: Kultur (11), Geister-Fertigkeit (4), Volltextsuche
- Petromantie-Rituale optisch hervorgehoben (⛏ Marker, ocker Akzent)
- RkW-Buttons pro Geister-Fertigkeit (klickbar zum Bearbeiten)
- Knochenkeulen-Tabelle (5 Typen mit Kampfwerten) als Detail-Sektion
- Knochenkeulen-Rituale-Tabelle (Bann/Geist/Hilfe/Kraft/Härte/Nähe der Keule)

### 💎 Edelstein-Magie

**Neue `data/edelsteine.json`** mit 38 Edelsteinen aus *Elementare Gewalten* S.154-155
- Pro Edelstein: Merkmal-Affinität (AsP-Ersparnis 10-25%) + Element-Bonus (-1/-2)
- Mapping für SF "Edelsteinmagie" (200 AP, Voraussetzung Merkmalskenntnis Elementar Erz)
- 6-Elemente-Hexalogie: Feuer/Wasser/Luft/Erz/Humus/Eis

### 🌿 Sonderfertigkeiten erweitert (135 → 176)

- **20 Geweihten-SFs**: Liturgiestil, Karmale Senkung, Liturgie-Aufstufung,
  Hausliturgie, Schein des Götterglaubens, Liturgie-Spezialisierung,
  Bannstrahl-Beherrschung, Goldener Bann, Borons Friede, Schwarze Trauer,
  Stählerne Stirn, Schlachtruf, Gabe der Schlange, Schemenhafter Schritt,
  Heimstein-Bindung, Grüne Hand, Schmiedeglut-Bindung, Wilde Jagd,
  Lebensfeuer, Rauschsegen-Bindung
- **13 Schamanen-SFs**: Ritualkenntnis (Schamane), Weihe der Keule,
  Schamanenrituale, Verbotene Pforten, Tabuzone (SF), Geist der Keule,
  Bann/Gespür/Kraft/Härte/Nähe/Hilfe der Keule, Opferkeule
- **5 Petromantie/Element-SFs**: Ritualkenntnis (Petromantie), Edelsteinmagie,
  Glyphe des Elementaren Willens, Bann-/Schutzkreis gegen Element,
  Zusatzzeichen Elementarquellenspeisung
- **4 Hochschamanen-SFs**: Kontakt zum Großen Geist (700 AP),
  Liturgiekenntnis (Kamaluq/Tairach/Himmelswölfe)

### 🔥 Neue Elementare in `data/creatures.json`

5 Eis-/Erz-Elementare aus *Elementare Gewalten*:
- Elementarer Meister des Eises (Boss-Tier, AsP 120, Eishauch-Aura)
- Hagelfalke (fliegender Eis-Elementar)
- Elementarer Meister des Erzes (RS 12, TP 3W20+10)
- Quecksilbergeist (Formlosigkeit, Hartes Schmelze)
- Wühlschrat-Petromant (Schamanen-Spezies-Statblock)

### 🪨 Wühlschrate als spielbare Spezies (House-Rule)

- Spezies-Block: KK +3, KO +2, IN −1, GE −2, CH −3, LeP +20, RS 8 (natürliche Steinhaut), GS 3, MR +5
- Steinfraß III, Lichtempfindlich, Nachtsicht
- Profession Wühlschrat-Schamane (Petromantie automatisch)
- Empfohlene GP-Kosten: 80 (House-Rule, anhand Halbtroll-Vergleich)

### 🎨 UI-Verbesserungen

- **Lesefreundliches Theme** für Liturgien-/Schamanen-Browser
  (Off-White auf dunklem Holz/Stein-Hintergrund, klare Karten-Hierarchie,
  Pills für Ziel/Reichweite/Merkmale, klappbare Detail-Sektionen)
- **Karma-Tab im Sheet** für Geweihte (auto-detected via `isGeweiht`-Logik:
  KaP-Pool ODER Liturgiekenntnis-Item ODER Liturgiekenntnis-Talent ODER
  Profession matcht Gott ODER Vorteil "Geweiht [...]")
- **🪶 Schamane / 🙏 Liturgien Buttons** im Magie-Tab des Sheets
- **Sidebar-Tools** für Liturgien-/Schamanen-Browser (für GM ohne Sheet)
- **Globale Helper**: `DSALiturgien(actor)`, `DSAMirakel(actor)`,
  `DSASchamanen(actor)`, `DSARitual(actor, ritualId)`, `DSAImportXML(filename)`

### 📅 Aventurischer Kalender

`data/calendar.json` + `scripts/calendar.mjs`
- 12 Götter-Monate, 7 Wochentage, Namenlose Tage, 8 Feiertage
- GM-Steuerung (±Tag/Woche/Monat/Jahr) + Datum-Setzen-Dialog
- World-Setting `calendarDate` (Default: 1. Praios 1043 BF)
- Token-Tools-Sidebar-Button

### 👹 Beschwörungs-Magie

`data/daemons.json` + erweiterter Spell-Dialog
- Misslingen-Tabellen für Anrufung (2W6 / 3W6 Blutmagie)
  + Beherrschung (Kontrollprobe-Versagen)
- Pakt-Mechanik: `actor.flags.pakt = {domaene, gpPool}`
  → 3 GP = -1 Erleichterung
- Wahrer-Name-Qualität (Q1/Q2) + "Ohne-Namen"-Toggle (+7 Anrufung)
- Kontroll-Probe nach erfolgreicher Anrufung
- Aufrechterhaltene-Zauber-Counter (persistent)

### 🐛 Fixes

- **isGeweiht-Detection robuster** (sucht jetzt auch in `system.talente`,
  erkennt Profession "Geweihter" allein, Vorteile mit "Geweiht [...]")
- **Variable Liturgie-Grade** ("II-VI", "P (Z)", "P oder G") werden jetzt
  korrekt geparst (V2-Parser für `Liber Liturgium` PDF)
- **pAsP-Berechnung Schamanen** (WdZ S.155): `Math.round(aspKosten × 0.1)`
  statt fester Konstante 1
- **`evaluate({async:true})`-Deprecation** in Foundry v12 entfernt
- **Schattenlarve falsch zugeordnet**: war als Boron-Liturgie eingetragen,
  korrigiert zu Phex (laut *Liber Liturgium* S.262-263)
- **Komma-Splits in Liturgien-Namen** (PDF-Parsing-Artefakte) gefixt
  (z.B. "Phexens wunderbare, Verständigung" → "Phexens wunderbare Verständigung")

### 📊 Stats

- Liturgien: 0 → **298**
- Schamanen-Rituale: 0 → **72** (54 Standard + 18 Petromantie)
- Sonderfertigkeiten: 135 → **176**
- Edelsteine: 0 → **38**
- Creatures: 150 → **155**
- DSA-Daten total: 961 → **1.500+**

---

## [0.4.15] — 2026-04-28

### XML-Parser-Bugs (Aytan/Dunya Re-Import)

**Vor-/Nachteile-Trennung über Datenbank-Lookup**
Helden-Software exportiert ALLE als `<vorteil>`-Tags (auch Nachteile wie
*Arroganz*, *Behäbig*, *Schlechte Regeneration*). Parser unterscheidet jetzt
anhand `disadvantages.json`/`advantages.json` per Namens-Match.

**Inventar-Children-Tags Großschreibung erkannt**
HS schreibt `<Nahkampfwaffe>` und `<Fernkampfwaffe>` mit Großbuchstaben.
Parser suchte case-sensitiv `<waffe>` (klein) → fanden Items nicht und
fielen in falsche Klassifizierung. Jetzt: case-insensitiver Child-Lookup
inkl. beider Schreibweisen.

**Custom-Item-Details (`<modallgemein>`)**
HS-Items mit User-Customization (z.B. Amulett namens „Sonnenscheibe" mit
eigenem Gewicht/Preis) werden jetzt mit ihrem Custom-Anzeigenamen
importiert + Gewicht/Preis übernommen.

**Inventar-Dedup-Bug**
`seenGegenstands.has(name)` verlor 2× „Dolch" oder 2× „Dicke Kleidung".
Jetzt slot-aware Dedup-Key (`name|slot|anzahl`).

**Talent-Kategorisierung über talents.json**
Vorher hardcoded Kurzliste — fehlende Talente landeten in „Handwerk".
Jetzt: Lookup gegen vollständige `data/talents.json` (86 Einträge).

**LeP/AsP/AuP immer voll beim Import**
HS-tracked-states (z.B. Aytan AsP=4/61) wurden 1:1 übernommen — User
erwartet aber vollständig geheilten Charakter. Jetzt: current = max
beim Import. GM kann manuell anpassen.

**MR per Formel statt HS-XML-value**
HS-XML schreibt `value=2` für Aytan obwohl Formel `(MU+KL+KO)/5 + Mods = 5`
ergibt. Jetzt: Formel mit echter Rundung + HS-mod (z.B. −4 von Astralmacht)
als Endwert.

**Ausweichen-Nachteile-Mali**
Sheet liest jetzt Nachteile und subtrahiert AW:
- Behäbig → −1
- Tollpatsch → −1
- Schlechte Reflexe → −2
- Schwerfällig → −1

---

## [0.4.14] — 2026-04-28

### Pass-3-Audit-Fixes

- **Wildcard-Eigenschaft im Spell-Dialog (Attributo-Bug)**: Sprüche wie
  Attributo haben `"*"` als 3. Probe-Eigenschaft (= „die gesteigerte
  Eigenschaft"). Vorher würfelte der dritte W20 immer gegen 10 (Default)
  weil `actor.system["*"]` undefined ist. Jetzt: Spell-Dialog zeigt
  Dropdown zur Eigenschaftswahl, Probe-Wurf nutzt die gewählte
  Eigenschaft. Chat zeigt "KK*" als Label damit klar ist welche
  gerade gewählt wurde.
- **`reps`/`verbreitung`-Doppel-Feld in spells.json bereinigt**: Mein
  Sharisad-Skript hatte 27 Sprüche mit demselben Array unter beiden
  Feldnamen gespeichert (Referenz-Aliasing). `reps` war Dead-Data,
  der Code liest nur `verbreitung`. Konsolidiert: 29 Sprüche mit
  Sharisad-Repräsentation jetzt nur noch in `verbreitung`.
- **Stale Kommentar `// −1 pro Wunde`** in `_prepareCombatTalents`
  korrigiert auf `// −2 pro Wunde` (Code war schon korrekt seit v0.4.9,
  nur Kommentar war veraltet).

### 9 von 12 Audit-Befunden waren falsch-positiv

Verifiziert mit pdftotext und direktem Code-Read:
- atBase/paBase „double application" — intentional für Tooltip-Anzeige
- GS *2 Wundpenalty — kein solcher Code im Modul
- _rollRitual ohne Wundpenalty — bereits seit v0.4.10 implementiert
- Finte SF-Levels — DSA hat nur 1 Stufe Finte
- SF-Mixed-Format — schon defensive normalisiert
- Schelm-MR-Threshold-Fallback — schon `: 3` als Default
- Mehrere defensive nice-to-haves nicht relevant

---

## [0.4.13] — 2026-04-28

### HUD-Effekt-Leiste UNTER den Token-HUD (horizontal)
- v0.4.11/v0.4.12 hatten adaptive Flip-Logik — funktionierte aber in der
  User-Foundry nicht zuverlässig, möglicherweise wegen anderer Layout-
  Konfigurationen.
- Jetzt pragmatisch: Effekt-Buttons sind unterhalb des Token-HUDs
  horizontal aufgereiht (mit flex-wrap auf max 200px Breite). Kein Konflikt
  mehr mit der Foundry-Sidebar, egal wo der Token auf der Karte steht.

---

## [0.4.12] — 2026-04-28

### Token-HUD-Spalte: Bounding-Rect-basierter Flip
- v0.4.11-Heuristik basierte auf PIXI-Canvas-Koordinaten — die stimmten
  nicht mit DOM-Pixel-Position überein. Resultat: Spalte überlappte
  weiterhin mit der Sidebar.
- Jetzt: nach DOM-Append per requestAnimationFrame die echten
  ``getBoundingClientRect``-Werte der Spalte und der Sidebar messen, dann
  bei Überlappung nach links flippen. Funktioniert auch bei zoomed/scrolled
  Canvas und respektiert Sidebar-collapsed-State.

---

## [0.4.11] — 2026-04-28

### Token-HUD-Spalte adaptiv positionieren
- Effekt-/Kreaturen-Buttons rechts neben dem TokenHUD waren mit der
  Foundry-Sidebar (Combat-Tracker etc.) kollidierend wenn der Token nahe
  am rechten Bildschirmrand stand. Jetzt: prüft Position der Sidebar und
  klappt die Spalte LINKS vom HUD aus, wenn rechts nicht genug Platz ist.

### Passierschlag triggert nicht mehr fälschlich
Zwei Bugs in `_registerMovementHook`:
- **Triggerte schon bei "Not Started" Combat** weil `c.active || c.started`
  auch true ist wenn ein Combat-Tracker eingerichtet aber nicht gestartet ist.
  Jetzt: nur `c.started` (Runde läuft tatsächlich) triggert Passierschläge.
- **SC-vs-SC Friendly-Fire**: Spielercharaktere lösten Passierschläge gegen
  andere SCs aus, weil kein Disposition-Filter da war. Jetzt: nur Tokens
  mit unterschiedlicher Gesinnung (Friendly vs. Hostile) lösen einander
  Passierschläge aus. Friendly-vs-Friendly oder Neutral-vs-Beliebig → kein
  Trigger.

---

## [0.4.10] — 2026-04-28

### Vertagte DSA-4.1-Themen aus dem 5-Agent-Audit aufgeräumt

**Ausweichen-System auf WdS-Konformität (WdS S.66)**
- AW = **volle PA-Basis** (vorher PA/2, alte 4.0-Konvention)
- SF **Ausweichen I/II/III** gibt **+3/+6/+9** auf AW (vorher fälschlich +1/+2/+3)
- **Akrobatik-Bonus** auf AW: TaW ≥ 12 gibt +1, dann +1 pro weitere 3 TaP

**Schild-Sonderfertigkeiten kumulieren PA-Boni (WdS S.74-75)**
- Aktiv geführtes Schild + SF **Linkhand** → +1 PA mit Schild
- + SF **Schildkampf I** → weitere +2 PA
- + SF **Schildkampf II** → weitere +2 PA
- Kumulativ also bis +5 PA durch SFs zusätzlich zum Schild-paMod

**Finte mit/ohne SF-Differenzierung (WdS S.62)**
- Ohne SF Finte → halbe Ansage als PA-Erschwernis
- Mit SF Finte → volle Ansage als PA-Erschwernis
- Vorher: immer volle Ansage, SF-Vorteil entfiel

**Ritualkenntnis-Probe rollbar gemacht**
- Click auf Ritualfertigkeit (Gildenmagie/Hexerei/etc.) im Heldenbogen
  würfelt jetzt 1W20 ≤ TaW mit Mod-Dialog und Wund-Penalty
- Vorher: Werte wurden nur angezeigt, nicht würfelbar

**Spell-Dialog erweitert um WdZ-konforme Mechaniken**
- **Ziel-MR-Input** (auto-fill aus markiertem Token), Toggle „Spruch wirkt
  gegen MR" addiert MR als Erschwernis (WdZ S.30)
- **Schelm-MR-Schwelle** wird automatisch abgezogen: Standard 3, mit SF
  *Unbeschwertes Zaubern* 7, mit *Lockeres Zaubern* 12 (WdZ S.327)
- **Religiöse Bedingung verletzt** Toggle für hex/dru/geo/krist/sch:
  +12 ZfP (WdZ S.20)
- **Bevorzugtes Element + Merkmalskenntnis** Toggle für Geoden:
  −2 ZfP auf Einsparen/Reichweite/ZD (WdZ S.314)
- **Aufrechterhaltene Zauber Counter** persistent in Actor-Flags,
  +3 Erschwernis pro aktivem Spruch (WdZ S.13)

**Sharisad/Srl-Repräsentation in spells.json**
- Vorher: 0/298 Sprüche hatten Sharisad-Repräsentation (systematische Lücke)
- Jetzt: 29 Sprüche aus dem Liber Cantiones automatisch identifiziert + manuell
  ergänzt (Plumbumbarum, Visibili, Attributo, Adlerschwinge etc.)

---

## [0.4.9] — 2026-04-28

### DSA-4.1-Regel-Konformität: 5-Agent-Audit-Fixes 📜

Aus systematischem Vergleich des Codes gegen DSA 4.1 WdH/WdS/WdZ und das
Liber Cantiones — die wichtigsten regelwidrigen Stellen behoben.

**Trefferzonen-Tabelle KOMPLETT umgebaut (WdS S.107)**
- Vorher: Kopf 1-2, Brust 3-6, Rücken 7-8, Arme 9-12, Bauch 13-14+19-20,
  Beine 15-18 — komplett invertierte Verteilung mit erfundener „Rücken"-Zone.
- Jetzt regelkonform: Beine 1-6, Bauch 7-8, Arme 9-14 (ungerade Schildarm,
  gerade Schwertarm), Brust 15-18, Kopf 19-20. „Rücken" gibt es nur per
  gezieltem Schlag, nicht in der Zufallstabelle.
- Vorherige Trefferverteilung war vollkommen unrealistisch (fast jeder
  zweite Wurf am Kopf).

**Wundmali korrigiert von −1 auf −2 pro Wunde (WdS S.57)**
- Regel: „AT-, PA-, FK- und INI-Basiswert sowie GE sinken sofort um je
  2 Punkte pro Wunde, die GS um 1 Punkt."
- Code hatte −1 pro Wunde → verwundete Charaktere dramatisch zu kampffähig.

**INI-Rüstungs-Penalty volle BE statt halbiert (WdS S.56)**
- Regel: „der BE-Wert wird von der Initiative abgezogen, nicht der eBE-Wert".
- Code zog `BE/2` ab. Schwer gerüstete Kämpfer hatten doppelt so hohe INI
  wie regelkonform.

**Kampfreflexe respektiert BE≤4-Bedingung (WdS S.75)**
- SF Kampfreflexe gibt nur dann +4 INI, wenn der Kämpfer eine Rüstung mit
  BE ≤ 4 trägt. Vorher griff der Bonus immer.

**Manöver-Effekte korrigiert**
- **Hammerschlag** wirkt jetzt: TP×3 inkl. Ansage (WdS S.62-63). Vorher
  ohne Effekt → keine Schadens-Verdreifachung.
- **Sturmangriff** ignoriert RS NICHT mehr (WdS S.65). Vorher fälschlich
  RS-Ignore → übermäßiger Schaden gegen gepanzerte Gegner.
- **Klingensturm** rechnet AT/2+2 statt AT+2 (WdS S.63). Bei AT 15 jetzt
  korrekt 2× AT 10. Vorher war Klingensturm stärker als ein normaler
  Angriff statt schwächer.

**DERIVED_FORMULAS auf echte Rundung (WdH S.20)**
- Alle abgeleiteten Werte (AT/PA/FK/INI/MR/AuP/AW-Basis) nutzten
  `Math.floor` statt `Math.round`. WdH sagt explizit „echt gerundet" →
  Werte wie `(15+15+13)/5 = 8.6` rundeten auf 8 statt korrekt 9.

**Wunden-Cap auf 3 pro Zone (WdS S.107)**
- Vorher konnte eine Zone unbegrenzt Wunden ansammeln, obwohl sie ab 3
  schon „unbrauchbar" gilt. Jetzt cappen wir auf max 3.

**Halbzauberer-Erkennung erweitert + Elfen-AsP-Tippfehler (WdH/WdZ)**
- Hexen, Druiden, Geoden, Schelme, Schamanen werden jetzt als Zauberer
  erkannt → bekommen AsP-Max nach `MU+IN+CH`-Formel statt 0.
- Elfen-AsP nutzte fälschlich `IN+MR+CH` statt `MU+IN+CH` (Tippfehler:
  MR statt MU).

**Liber-Cantiones-Datenkorrektur**
- Spruch **Attributo**: Probe war `[CH, KO, KK]` — laut Liber korrekt
  `[KL, CH, *dynamisch*]` (dritte Probe-Eigenschaft = die zu steigernde).

---

## [0.4.8] — 2026-04-28

### Aus systematischem Code-Audit gefixt 🔍

- **INI-Wurf am Sheet hatte falsche Rüstungs-Penalty.** Bisheriger Bug:
  `_rollInitiative()` iterierte über `sys.armorZones` — dieses Feld
  existiert aber gar nicht im gdsa-Schema. Resultat: armorIni war immer 0,
  egal welche Rüstung man trug. Jetzt: Penalty wird aus den ausgerüsteten
  Rüstungs-Items berechnet (BE/2 abgerundet, alle Rüstungen summiert).
  Plus: Schild-INI-Penalty kommt jetzt auch dazu.
- **Schild-Auto-Equip überschrieb User-Wahl bei jedem Render.** Bisheriger
  Bug: Beim `getData()` (das passiert bei JEDEM Sheet-Render) wurde
  automatisch das erste Schild als "geführt" markiert wenn keins aktiv
  war. Wer also bewusst ohne Schild kämpfen wollte und das Schild per
  Click weggesteckt hat, sah es beim nächsten Render-Trigger (z.B.
  Datenbank-Browser, Item-Edit) wieder als "geführt". Jetzt: Auto-Equip
  passiert nur einmal beim XML-Import; Render respektiert User-Wahl.

---

## [0.4.7] — 2026-04-28

### Combat-Tracker Initiative-Würfel funktioniert ⚔
- **Würfel-Button im Combat-Tracker reagiert wieder.** Bisheriger Bug:
  `CONFIG.Combat.initiative.formula` war `null` — gdsa-System setzt das
  nicht und Foundry weiß ohne Formel nicht was beim Würfel-Klick gerollt
  werden soll. Jetzt: Modul setzt Default-Formel + libWrapper-Override
  auf `Combatant.prototype.getInitiativeRoll` mit unserer DSA-Logik.
- **Tracker-Würfel berücksichtigt automatisch:**
  - INIBasis aus Actor (`system.INIBasis.value`)
  - SF Kampfreflexe (+4) und Kampfgespür (+2)
  - Rüstungs-Penalty (gBE/2 abgerundet, alle Rüstungen summiert)
  - Schild-INI-Penalty (vom aktiv geführten Schild)
  - Wund-Mali (−1 pro Wunde)
- **Schöner Chat-Output**: Statt nackte Zahl zeigt der Wurf den vollen
  Rechenweg (`1W6 (4) + INI 10 + 4 Kampfreflexe − 1 Rüstung`).

---

## [0.4.6] — 2026-04-28

### XML-Parser: Eigenschaften-Final-Snapshots ignorieren 🎯
- **KK/KO/etc. werden nicht mehr fälschlich aufgepusht.** Helden-Software
  exportiert manche Eigenschaften DOPPELT: erst der Basis-Eintrag mit
  `startwert`+`mod` (z.B. KK 16, gekaufter Wert), dann ein Final-Snapshot
  ohne diese Attribute (z.B. KK 22, mit allen temporären SF/Vorteils-Boni).
  Der Parser nahm bisher den letzten — Alrik landete mit KK 22 / KO 19
  statt 16 / 15. Jetzt: Final-Snapshots an fehlenden `startwert`/`mod`
  erkannt und bei Eigenschaften übersprungen.
- **LeP/AsP/AuP-Max profitiert vom Final-Snapshot.** Wenn HS einen
  Final-Snapshot mit z.B. LeP=58 liefert, wird das als Max-Override
  genutzt — überschreibt unsere Standard-Formel (`KO×2 + KK/2 + Bonus`),
  die nicht alle Vorteile abbildet (z.B. „Hohe Lebenskraft I/II/III").

### Schild-Toggle: Geführt vs. im Gepäck 🛡
- **Click aufs Schild** im Heldenbogen schaltet zwischen „geführt" (gibt
  AT/PA-Boni) und „im Gepäck" (kein Effekt) um. DSA-Regel: nur ein
  Schild gleichzeitig in der Schildhand → Click auf Schild B unequippt
  automatisch Schild A.
- **Beim Import wird das erste Schild automatisch als geführt markiert**,
  damit User sofort die Boni sehen ohne extra Clicks.
- **Schild-AT/PA-Mods nur noch auf Nahkampf-Talente.** Vorher wurden sie
  fälschlich auch auf Fernkampf gerechnet — Quatsch, weil man mit Schild
  eh keinen Bogen führen kann. Jetzt: Bogen/Armbrust/Wurfwaffen ignorieren
  Schild-Mods komplett.
- **Visuelles Feedback**: Aktives Schild grün-glow + „GEFÜHRT"-Label,
  inaktives gegraut + „im Gepäck"-Label.

---

## [0.4.5] — 2026-04-28

### XML-Parser: Schild- und Waffen-Schema-Fixes 🛡
- **Schild AT/PA-Mods werden endlich angezeigt!** Bisheriger Bug: Parser
  schrieb Schild-Boni in `system.weapon.{atMod, paMod}`, das Sheet liest
  aber aus `system.shield.{atMod, paMod, ini, bf}` (gdsa-Schema). Resultat:
  Großschild zeigte nur 0/0 statt +0/+5. Jetzt korrekt nach Type unterschieden.
- **Reichweiten-Felder gefüllt**: Fernkampfwaffen schreiben jetzt
  `range1`–`range5` aus dem `<reichweiten>5/15/40/50/60</reichweiten>`-String,
  statt leer zu lassen. Behebt das `// m`-Anzeige-Problem.
- **Vollständige Waffen-Felder**: `DK`, `bf` (Bruchfaktor), `kk`-Schwelle,
  `ladezeit` werden jetzt mit übernommen — vorher nur damage/type/INI.

### Persistenz-Sicherheitsnetz 💾
- **Force-Set via Dot-Notation**: Manche gdsa-Felder (Dogde als scalar,
  LeP.max etc.) wurden bei partiellen system-Updates nicht persistent
  geschrieben. Nach dem Haupt-`Actor.create()` läuft jetzt ein zweiter
  `actor.update()` mit Dot-Path-Keys, der die kritischen abgeleiteten Werte
  (Dogde, LeP/AsP/AuP value+max, INIBasis, MR, AT/PA/FKBasis) garantiert
  setzt.

### LeP/AsP/AuP-Konsistenz 🩹
- **max ≥ value erzwungen**: Helden-Software liefert manchmal höhere
  current-Werte (z.B. Alrik LeP 58) als unsere Standard-Formel berechnet
  (LeP-max = KO + KK + LE/2 = 49). Resultat war LeP 58/49, was im Sheet
  als „voll überheilt" angezeigt wurde. Jetzt: max wird auf
  `Math.max(formelMax, hsCurrent)` gesetzt — HS-Wert ist die Wahrheit
  bei Diskrepanz.

### Audit-Verifikation ✅
- Alle 6 Test-Helden (Tarion, Tamir, Alrik, Dunya, Aytan, Edo) durchlaufen
  jetzt den Parser-Audit ohne Findings: LeP/AsP/AuP konsistent, alle
  abgeleiteten Werte populiert, Waffen mit korrekten AT/PA/FK-Werten,
  Schilde mit AT-/PA-Mods, Inventar-Items als typisierte Foundry-Items.

---

## [0.4.4] — 2026-04-28

### XML-Parser: Inventar-Komplettüberholung 📦
- **Inventar-Items werden endlich importiert!** Bisheriger Bug: Helden-Software
  XML nutzt `<gegenstände>` mit deutschem Umlaut, mein Selector suchte nach
  `gegenstaende` (ASCII) — keine Treffer. Jetzt via `getElementsByTagName` +
  Parent-Check, fängt beide Schreibvarianten ab.
- **Datenbank-Lookup für unbenannte Items**: Helden-Software speichert nur
  `<gegenstand name="..."/>` ohne TP/RS. Parser sucht jetzt automatisch in
  `weapons.json`/`armor.json` nach Werten und legt typisierte Foundry-Items an
  (melee/range/shield/armor/item).
- **Aliase + Fuzzy-Match**: "Anderthalbhänder" ↔ "Bastardschwert",
  "Großschild" ↔ "Großschild (Reiterschild)", "Kettenhemd, Lang" ↔
  "Kettenhemd, langes". Robust gegen Komma-Suffix-Schreibvarianten.
- **Foundry-Items angelegt**: Nach Import sind Waffen, Rüstungen, Schilde,
  Equipment als typisierte Gegenstand-Items im Sheet sichtbar.

### Wundschwellen mit SF/Vorteils-Boni 🩸
- **WS-Berechnung** berücksichtigt jetzt:
  - Vorteil **Eisern** (+2 auf alle WS)
  - Nachteil **Glasknochen** (−2 auf alle WS)
  - SF **Hartgesotten** (+1, Zwergen-Bonus)
  - SF **Eisenhart** (+2, selten)
- Wund-Mali bleiben −1/Wunde auf alle Proben (WdS S.61 unverändert).

### Initiative-Würfel 🎲
- **INI rollbar**: Klick auf INI im Heldenbogen würfelt 1W6 + INIBasis.
- **Berücksichtigt automatisch**:
  - SF **Kampfreflexe** (+4 INI)
  - SF **Kampfgespür** (+2 INI)
  - Rüstungs-Penalty (gBE/2 abgerundet)
  - Wund-Mali (−1 pro Wunde)
- Manueller Modifikator-Dialog vor Wurf.

### Datenbank-Erweiterung 🗡
- **Anderthalbhänder, Bihänder, Doppelkhunchomer, Khunchomer, Säbel,
  Sichelschwert, Streitaxt, Stoßspeer, Hellebarde, Magierstab, Robbentöter,
  Wurmspieß** in nahkampfwaffen ergänzt.
- **Großschild, Buckler, Rondrakamm** in schilde ergänzt.
- **Lederrüstung, Schuppenpanzer, Brustplatte, Plattenrüstung, Robe** in
  armor.json ergänzt.

---

## [0.4.3] — 2026-04-28

### Datenbank-Erweiterung 🏹
- **13 fehlende Fernkampfwaffen** in `weapons.json` ergänzt — die DB hatte
  bisher nur Wurfwaffen + 2 Armbrüste. Bogenschützen wie Tarion (Bogen TaW 18)
  fanden im DB-Browser keine passende Waffe.
- **Neue Bögen** (8): Kurzbogen, Langbogen, Elfenbogen, Kompositbogen,
  Reflexbogen, Doppelbogen, Hornbogen, Mittellanger Bogen
- **Neue Armbrüste** (5): Leichte Armbrust, Schwere Armbrust, Hetzarmbrust,
  Repetierarmbrust, Wallarmbrust
- Werte nach DSA 4.1 *Wege des Schwertes* S.78ff + Arsenal: TP, Reichweiten,
  KK-Schwelle, Talent (Bogen/Armbrust), Gewicht, Preis, Ladezeit
- Fernkampfwaffen-Total jetzt **36** (vorher 23)

---

## [0.4.2] — 2026-04-28

### Kritischer XML-Parser Schema-Fix 🐛
**Wahre Ursache** der INIBasis/MR/AT/PA/FK = 0 Bugs gefunden und sauber
behoben (kein Workaround mehr):

- **Eigenschaften-Schema:** Parser schrieb `{value, mod}` — das gdsa-Schema
  erwartet aber `{value, temp, baseAnti}`. Folge: `MU.baseAnti = 0` für alle
  Helden, und gdsa's `prepareData` rechnete INIBasis/AT/PA/FK aus `baseAnti`
  und kam auf `0`. Fix: Parser schreibt jetzt schema-konforme
  `{value, temp: 0, baseAnti: 0}` — gdsa rechnet die abgeleiteten Werte
  korrekt aus.
- **Derived-Schema:** Komplette gdsa-Felder bei MR `{value, modi, tempmodi, buy}`,
  INIBasis `{value, modi, tempmodi, sysModi}`, ATBasis/PABasis/FKBasis
  `{value, tempmodi}`. Helden-Software-Boni landen jetzt im korrekten Feld
  (`buy` für MR-Bonus aus AE-Astralenergie etc.).
- **Edo die Eiche** wurde mit alten Stub-Werten gespeichert (MU 10, KL 11 etc.)
  statt aus seiner XML korrekt importiert. Nach v0.4.2 + Re-Import: korrekte
  Werte (MU 16, KL 16, KO 18, KK 18, 73 Talente, 72 Zauber).
- **Tamir's INIBasis** bleibt jetzt 11 (aus Helden-Software) statt 0.

### Audit-Tools 🔍
- Neues internes Audit-Script (`parser-audit.py`) das jede XML-Datei parst,
  mit Foundry-Actor-Werten via MCP-Bridge vergleicht und feldweise alle
  Diskrepanzen meldet. Hat den Schema-Bug gefunden.

---

## [0.4.1] — 2026-04-21

### Bugfixes 🐛
- **XML-Parser**: MR und INI werden jetzt direkt aus dem Helden-Software-`value`
  übernommen (vorher: eigene Formel überschrieb die Helden-Software-Berechnung).
  Die Helden-Software berechnet diese Werte bereits inkl. aller Mods
  (mrmod aus Astralenergie, Rasse-Boni, SF-Boni), deshalb direkt übernehmen.
  Fallback auf Formel nur wenn XML-Wert fehlt oder 0 ist.
- **XML-Parser**: **Fernkampf-Talente** werden jetzt erkannt und als
  `combatTalents` mit `type: "fernkampf"` eingepflegt. Betrifft: Bogen, Armbrust,
  Blasrohr, Wurfmesser, Wurfbeile, Wurfspeer, Diskus, Schleuder, Lanzenreiten.
  Vorher landeten die nur in `talents` und waren im Combat-Tab unsichtbar
  (Tarion Winterklee's Bogen 18 war nicht rollbar).
- **XML-Parser**: AT/PA/FK-Basis nutzen jetzt XML-Werte direkt + Bonus (mod)
  statt nur Formel-Fallback.

---

## [0.4.0] — 2026-04-21

### Rechtliches / Lizenz 📜
- **Ulisses-Rechteeinräumung unter ORC-Lizenz** erhalten (Jan Wagner, Head of
  Digital Games, Ulisses Spiele GmbH, 2026-04-21). Zeitlich/räumlich
  unbeschränkte, nicht-kommerzielle Nutzung von DSA 4.1 Inhalten.
- **Copyright-Footer im Heldenbogen** (Auflage der Rechteeinräumung): Direkt im
  Pixel-Art-Charakterbogen sichtbar, nicht nur in der README.
- **README** komplett überarbeitet mit Liste aller verwendeten Regelwerke und
  voller Rechteeinräumungs-Text.
- **LICENSE-DATA.md** neu: klare Trennung zwischen MIT (Code) und ORC (Daten).
- Fehlerhafte Install-Manifest-URL (Gitea 404) auf GitHub umgestellt.

### Neue Features 🛡️⚡
- **Gardianum Zauberschild** komplett integriert nach Liber Cantiones
  Remastered S.97-98:
  - Auto-Cast-Dialog beim Klick auf `Gardianum Zauberschild` im Sheet
  - Alle 3 Varianten: *Grund*, *vs Dämonen*, *vs Zauber*, *Persönlich*
  - Schild-TP = `AsP + 2×ZfP*` (bzw. `3×ZfP* + AsP` bei Persönlich)
  - Dämonen-Variante: `1 Schildpunkt = 7 TP` Absorption
  - Persistentes Live-Panel mit HP-Bar pro aktivem Schild
  - MeasuredTemplate (3m Halbkugel) folgt dem Zauberer
  - Auto-Expire nach 5 KR
  - „Zauber auflösen"-Button mit Bestätigungs-Dialog
  - Scene-Control-Button zum Öffnen des Panels
- **AGM-Varianten-Erkennung** generell für alle Zauber: `Spellname (agm)` fällt
  auf Basis-Schaden zurück und zeigt Antimagie-Hinweis im Chat.
- **Borbaradianische Repräsentation** erkannt (`(borb)`) mit Kosten-Hinweis
  1W20 AsP / 1W20/2 LeP, Merkmal Dämonisch.
- **Drachenglut / Flammeninferno** Sub-Varianten für *Brenne toter Stoff!*.
- **XML Import-Button** in ActorDirectory-Footer (war vorher versteckt).

### Regeldaten-Korrekturen 🔧
- **Blitz dich find**: macht keinen SP-Schaden. Korrekt als Blendwirkung
  modelliert mit ZfP*-Abzügen auf AT/PA/Talent/Zauber/INI. Immunität:
  Dämonen, Geister, Untote, Golems, Elementare (LCR S.51).
- **Brenne toter Stoff!**: Basis 3W6 SP nur indirekt über Rüstung/Kleidung am
  Träger, nicht direkt gegen Lebewesen. 1W3 SP/KR Folgeschaden durch
  brennende Kleidung. RS-Reduktion bei >10 SP. Drachenglut (ZfP*/2)W6 TP bei
  Berührung, Flammeninferno 2W6 TP/KR in Zone (LCR S.54).
- **21 Untoten-Stat-Blöcke** aus *Von Toten und Untoten* (PDF S.113-152)
  direkt in `creatures.json` eingepflegt: Skelett, Zombie, Knochengarde,
  Mumie, Kriegermumie, Priestermumie, 3 Ghul-Varianten, Ghulkönig,
  Blutbestie, Brandleiche, Eisleiche, Wasserleiche, Oger-Skelett,
  Untoter Troll, Knochenritter, Skelettfürst, Brandbock, Yaq Hai,
  Fleischkoloss — mit AT/PA/LeP/MR/GS/INI/RS + Waffen + Sonderfertigkeiten.
- **28 benannte Elementare** ergänzt: Feuerdrache, Eisdrache, Alagrimm,
  Doryphoros, Firy Sija, Frostfee, Blizzantil, Windfeger, Tornado,
  Blätterwirbel, Truncus, Al Shafeif, Krystall, Sholgothar u.v.m. —
  gruppiert nach Element (Feuer/Wasser/Eis/Luft/Humus/Erz) im
  Creature-Picker.

### Bugfixes 🐛
- **XML-Parser**: INI wurde auf `sys.INI` gesetzt, aber Sheet + Kampf-Engine
  lesen `sys.INIBasis`. Jetzt wird INI korrekt aus Formel `(MU+IN+GE)/5 + mod`
  auf `sys.INIBasis` geschrieben, mit Fallback wenn XML-Wert 0.
- **XML-Parser**: AT-/PA-/FK-Basis bekommen Fallback aus DSA-Formeln wenn
  XML-Wert fehlt oder 0.
- **MR-Werte-Fix für Helden**: Dunya (2→7), Alrik (1→8), Aytan (2→9) —
  vorher aus altem Parser ohne Formel-Berechnung importiert.
- **INI-Basis-Fix für Helden**: Dunya (0→9), Alrik (0→8), Aytan (0→8).
- **Pixel-Sprite-System**: Token wurden unsichtbar wenn Scene-Grid gewechselt.
  `refreshToken`-Hook versteckt Mesh jetzt nur noch wenn tatsächlich ein
  Sprite existiert. Sicherheitsnetz: Mesh immer sichtbar bei nicht-
  konfigurierten Tokens.
- **AudioHelper-Deprecation**: `AudioHelper.play()` → `foundry.audio.AudioHelper.play()`
  (Foundry v12 Deprecated-Warning).
- **Sidebar-XML-Import-Button**: war als 100%-breiter Balken vor die Actor-Liste
  eingehängt, hat diese optisch verdrängt. Jetzt kompakter Footer-Button.

### Content 🎨
- **14 Szenen** aus Backup-Welt `jenseits-des-schweigens` importiert
  (Taverne, Dorf in Selem, Auf See, Khunchom, Kapitänskajüte u.w.),
  Asset-Pfade automatisch umgeschrieben.
- **69 NSC-Portraits** aus SL-Deniz-Backup extrahiert und als Actors angelegt
  mit randomisierten DSA-4.1-Werten.
- **46 NSCs** mit Original-Biografien aus dem Backup (Lazanthor, Mariella,
  Fenn Garlisch, Faizul, Maatin Alrune Neersander, Ha-wa-lu, Kriegsmeister-
  Tipps, ausführliche Charakter-Tiefe).
- **51 NSC-Chibi-Tokens** (Crew + TsD) aus PixelLab-Generation zugewiesen.
- **5 Helden-Chibis** (Alrik, Brandt, Dunya, Edo, Tamir) mit 4 Rotationen.
- **ELF-/ORC-Footer** fix eingebaut in Heldenbogen-Template.

### Ausweichen-Regel 🏃
- **SF Ausweichen I/II/III** geben `+1/+2/+3` Bonus auf AW-Grundwert (WdS S.68).

---

## [0.3.0] — 2026-04

### Hinzugefügt
- Pandaemonium-Zauber als Zonenzauber-Cluster (ZfP* Rechtschritte, separate
  Actor pro Cluster, Krallen/Tentakel/Maul-Attacken).
- Fesselranken / Auge des Limbus / Sumpfstrudel als Zonenzauber.
- Creature-Picker mit 150 Kreaturen aus Tractatus, Elementare Gewalten,
  Von Toten und Untoten.
- Helden-Software XML-Importer mit Live-Preview.
- Taverne-Szenen-Auto-Generator (DSATaverneErstellen).

### Geändert
- Heldenbogen auf 6 Tabs erweitert (Werte/Talente/Kampf/Magie/Inventar/Notizen).
- W20-Dice-Animation im Chat statt W6-Box.

---

## [0.2.0] — 2026-03

Initiale öffentliche Version mit Basiskampf, Proben-Engine, VFX, Pixel-Tokens.

---

[0.4.0]: https://github.com/cengo441337-a11y/dsa-pixel-tokens/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/cengo441337-a11y/dsa-pixel-tokens/releases/tag/v0.3.0
