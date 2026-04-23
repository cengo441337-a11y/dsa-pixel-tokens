# Changelog

Alle wichtigen Änderungen an diesem Modul werden hier dokumentiert.
Format: [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionen nach
[SemVer](https://semver.org/lang/de/).

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
