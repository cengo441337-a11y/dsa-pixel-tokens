# Changelog

Alle wichtigen Änderungen an diesem Modul werden hier dokumentiert.
Format: [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionen nach
[SemVer](https://semver.org/lang/de/).

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
