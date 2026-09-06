# Changelog

Alle wichtigen Änderungen an diesem Modul werden hier dokumentiert.
Format: [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionen nach
[SemVer](https://semver.org/lang/de/).

---

## [0.8.0] — 2026-09-06 (Regel-Durchsicht, Sicherheitsnetz, drei neue Systeme)

Die grösste Durchsicht seit Bestehen des Moduls. 22.861 Zeilen JavaScript hatten
bis hierhin keinen einzigen Test und kein Prüfwerkzeug. Beides gibt es jetzt —
und der Weg dahin hat eine Reihe von Fehlern zutage gefördert, die im Spiel nie
aufgefallen wären, weil sie nicht abstürzen, sondern still falsch rechnen.

### Würfel und Regeln

- **Erleichterungen blähten die Qualität eines Zaubers auf.** Ein Zauberer mit
  ZfW 4 und einer Erleichterung von 5 erzielte ZfP* 9 statt 4. Da die ZfP* in
  Schadens- und Wirkungsdauerformeln eingehen, wurde daraus unmittelbar mehr
  Schaden. Die übrig gebliebenen Punkte sind jetzt auf den unmodifizierten
  Talent- bzw. Zauberfertigkeitswert gedeckelt.
- **Ein glücklicher Wurf gelang und richtete nichts aus.** Bei zwei Einsen
  meldete der Chat „GLÜCKLICH! Maximale Wirkung", der Zauber rechnete aber
  weiter mit den ZfP* der rechnerisch misslungenen Probe — also mit 0. Probe und
  Kritischer werden jetzt an einer Stelle verrechnet, für alle fünf Aufrufer.
  Dreifach-Einsen und Dreifach-Zwanzigen gelten dabei erstmals als meisterhafter
  Erfolg bzw. schwerer Patzer.
- **Sieben Kampfmanöver waren unbenutzbar.** Gezielter Stich, Hammerschlag,
  Niederwerfen, Sturmangriff, Todesstoss, Klingensturm und Betäubungsschlag
  brachen beim Auswählen kommentarlos ab — ohne Wurf, ohne Chatmeldung, nur mit
  einem Fehler in der Konsole.
- **Die Trefferzone wurde zweimal gewürfelt, mit zwei verschiedenen Tabellen.**
  Der Angriff meldete bei einer 2 „Kopf", der Schadenswurf traf mit derselben 2
  das rechte Bein. Zonenrüstung und Wunde landeten dadurch auf der falschen
  Zone, und ein gezielter Kopftreffer für AT−8 war reine Dekoration.
- **Stumpfer Schlag und Betäubungsschlag** richteten Lebensenergieschaden an und
  erzeugten Wunden, statt Ausdauer zu kosten — genau das Gegenteil dessen, was
  ihr eigener Chattext ankündigte.
- **Aus „2W6+4" wurde ein 66-seitiger Würfel.** Erwartungswert 71 statt 11. Es
  gab drei Umwandler im Modul; jetzt gibt es einen.
- **Die Magieresistenz wirkte an der falschen Stelle.** Sie floss als
  Probenerschwernis ein statt von den ZfP* abgezogen zu werden. Bei einem
  Zauberfertigkeitswert unter der Magieresistenz wirkte der Zauber trotzdem —
  mit ZfP* 1; ein Ziel konnte sich also nie ganz wehren. Bei hoher
  Magieresistenz misslang die Probe, und der Zauberer zahlte nur die halben
  Astralpunkte, obwohl die vollen fällig sind. „Widerstanden" ist jetzt ein
  eigenes Ergebnis.
- Weiter: Passierschlag wertete ab AT 24 eine 20 als Treffer; bei jedem
  ungeraden Kampftalentwert verfiel ein Verteilungspunkt zwischen Attacke und
  Parade; der Gezielte Stich ignorierte den gesamten Rüstungsschutz statt zwei
  Punkte; und Parade-Manöver liefen ohne Prüfung der Sonderfertigkeit.

### Was der Chat versprach und nicht hielt

- **21 Liturgien meldeten einen Segen, den es nicht gab.** „Goldene Rüstung,
  RS +3" landete in einem Kennfeld, das im ganzen Modul niemand las. Der
  Rüstungsschutz änderte sich um null. Der Segen wirkt jetzt wirklich, auf
  Rüstungsschutz sowie Attacke und Parade.
- **Anhaltende Effekte liefen nie ab.** Eine Liturgie mit Wirkungsdauer
  „LkP* Spielrunden" blieb samt Aura und Token-Symbol bestehen, bis jemand von
  Hand rechtsklickte. Rundeneffekte laufen bewusst nur während eines Kampfes ab,
  damit ein Kampfende nicht alle Segen auf einmal aufhebt.
- **Jeder eigene Effekt feuerte zweimal.** Das Modul stieg bei eigenen
  Chatnachrichten aus, sobald sie ein Kennfeld tragen — nur trug keine der 43
  eines. Es löste also seinen Effekt aus, las danach seine eigene Chatzeile,
  erriet aus dem Text erneut ein Ergebnis und löste denselben Effekt nochmal aus.
- **„Misserfolg" enthält „erfolg".** Jede misslungene Probe eines fremden Moduls
  galt als gelungen, samt Treffer-Effekt und Schadensblitz auf dem Ziel.

### Helden-Import

- **Der Umlaut-Ersetzer zerstörte Rassennamen.** Aus „Auelf" wurde „Aülf", aus
  „Ambosszwerg" wurde „Amboßwerg" — beide standen danach in keiner Rassentabelle
  und bekamen Geschwindigkeit 8 statt 9 bzw. 6.
- **Die Magieresistenz wurde doppelt addiert.** Grog kam auf 25, Tarvas auf 20.
  Solche Werte gibt es in DSA 4.1 nicht.
- **Der Heldenbogen überschrieb importierte Zuschläge.** Die
  Vollzauberer-Senkung von −4 und gekaufte Punkte waren nach dem ersten Öffnen
  des Bogens verschwunden.
- Aberglaube, Pazifismus und Niedrige Geburt landeten unter den Vorteilen. Und
  ein Edelstein namens „Granat (10 Karat)" wurde als „Granatapfel" erkannt und
  zur Wurfwaffe mit 4W6 Schaden.
- Der Keyword-Rater für Zaubereffekte prüfte „eis" als blossen Teilstring —
  enthalten in Geist, Reise, Kreis, Meister. 19 Zauber bekamen den falschen
  Effekt; „Geisterbann" wurde zu einem Eiszauber. Jetzt sind es 4 Treffer, alle
  echte Eiszauber.

### Datenverlust und Rechte

- **Beim Weltstart wurden ungefragt Aktoren gelöscht.** Die Duplikatsuche lief
  bei jedem Start, ohne Rückfrage, ohne Typfilter — Spielercharaktere
  eingeschlossen, und endgültig. Sie meldet jetzt nur noch; gelöscht wird auf
  ausdrückliche Anweisung mit Bestätigung und Namensliste.
- **Helden wanderten nach „DSA Untote".** Der Namensabgleich lief vor der
  Kreatur-Prüfung; jeder Held mit „Schatten", „Knochen" oder „Ghul" im Namen
  wurde einsortiert.
- **Zonenschaden hörte beim ersten fremden Token auf.** Legte ein Spieler die
  Zone, lehnte der Server ab, und alle weiteren Token im Bereich blieben
  stillschweigend unversehrt.
- Vier schreibende Makro-Helfer und die Knöpfe des Pandaemonium-Panels waren für
  jeden Benutzer erreichbar.
- **Der Kalender veränderte seine eigene Vorgabe.** In einer frischen Welt
  verschob ein Klick auf „+1 Tag" den Kampagnenstart 1. Praios 1043 BF für den
  Rest der Sitzung.

### Nichts mehr, das im Hintergrund weiterläuft

- Die Ticker für Schadenszahl und Würfelanimation schrieben nach einem
  Szenenwechsel auf zerstörte Objekte, warfen dabei — und erreichten ihre eigene
  Abmeldezeile nie. Der tote Rückruf lief bis zum Neuladen bei jedem Bild weiter.
- Ein falsch getippter Sprite-Pfad löste einen Ladeversuch pro Bild aus,
  dauerhaft.
- Zwei gleichzeitig gesetzte Statuseffekte hinterliessen einen doppelten
  Symbol-Container am Token.
- Die aktive Szene stand doppelt in der Szenenliste; jeder Cluster-Token wurde
  pro Änderung zweimal abgearbeitet.

### Neu im Spiel

- **Zustände.** Die acht DSA-4.1-Zustände (Schmerz, Betäubung, Verwirrung,
  Furcht, Paralyse, Belastung, Berauschung, Entrückung) in Stufe 0 bis 4. Der
  Abzug wirkt automatisch auf Talentproben — eigenschaftsgenau, Paralyse trifft
  die Körperprobe und nicht die Klugheitsprobe — sowie auf Attacke und Parade.
  Stufe 4 heisst handlungsunfähig. Bedienung: `DSAZustaende(held)`.
- **Sammelproben.** Für alles, was mehr als einen Wurf braucht: Ritual
  vorbereiten, Rüstung schmieden, Bibliothek durchforsten, Verletzten pflegen.
  Das Modul sammelt die TaP* über beliebig viele Versuche, kennt Zielwert,
  Versuchsgrenze und Zeitintervall und zeigt den Fortschritt im Chat. Was bei
  einem Patzer passiert, ist einstellbar — Spielrunden regeln das
  unterschiedlich. Bedienung: `DSASammelprobe(held)`.
- **Kampfübersicht.** Eine Tafel mit allen Kämpfern: Lebensenergie, Ausdauer und
  Astralenergie als Balken, Wunden je Körperzone samt Probenmalus, aktive
  Zustände mit ihren Abzügen, und eine deutliche Zeile, wenn jemand
  handlungsunfähig ist. Sie liest nur und zeigt fremde Werte ausschliesslich dem,
  der sie ohnehin sehen darf. Bedienung: `DSAKampfuebersicht()`.

### Für alle, die am Modul arbeiten

`npm run check` prüft ohne ein einziges Fremdpaket:

- 144 Regeltests gegen die DSA-Rechenwege
- Syntax aller Quelldateien und Lesbarkeit aller Daten-Dateien
- sich selbst zuweisende Deklarationen (`const x = x`)
- Helfer, die vor ihrer Deklaration aufgerufen werden
- Bezeichner, die nirgends deklariert sind
- ob jedes Modul kopflos lädt
- ob Chatnachrichten über `dsaChat()` laufen
- ob neue Bausteine auch wirklich aufgerufen werden

`npm run mutation` baut 19 Fehler absichtlich ein und verlangt, dass die Tests
rot werden. Beim ersten Lauf rutschten zwei durch — daraus wurden ein fehlender
Test und ein echter Fehler in der Schadensformel („2W6+1W4" ergab „2d6+11d4").

### An der Bedienung ändert sich sonst nichts

Wer das Modul bisher benutzt hat, findet alles am gewohnten Platz. Die einzige
sichtbare Änderung ausserhalb der drei neuen Systeme: die Duplikat-Entfernung
läuft nicht mehr von selbst. Wer sie will, ruft `DSADedupActors()` auf und
bekommt vorher die Liste zu sehen.

---

## [0.7.5] — 2026-04-30 (Mirakel/LkW User-Bugfix Praiodun)

User-Bug gemeldet: Praiodun Zornbrecht (Praios-Geweihter, Profession="Geweihter")
zeigte im Sheet korrekt **Kult: Praios + LkW 18**, aber Mirakel-Button warnte
**"Kein Kult gefunden — Mirakel braucht eine geweihte Profession."**

### Bug-Ursache

**Diskrepanz zwischen Sheet-Lookup und liturgies.mjs-Lookup:**

`sheet.mjs::getData` nutzt eine 4-fache Fallback-Kette für den Kult
(Flag → Liturgiekenntnis-Talent in `system.talente` → Liturgiekenntnis-Item
→ Profession-Match). `liturgies.mjs::getActorKult` und `getLkW` schauten
aber nur in **Profession** (für Kult) bzw. nur in **Items** + **Flags**
(für LkW) — nicht im **`system.talente`-Map** wo der XML-Parser die
Liturgiekenntnis als reguläres Talent ablegt.

Praiodun hat `Liturgiekenntnis (Praios)` als Talent in `system.talente`,
nicht als Item, und Profession ist nur generisches `"Geweihter"`. → beide
Lookups schlugen fehl.

### Fix

**`getActorKult(actor)` jetzt mit identischer Lookup-Kette wie sheet.mjs:**
1. Flag (höchste Priorität)
2. `system.talente` "Liturgiekenntnis (Götter-Name)"
3. Item-Liste "Liturgiekenntnis (...)"
4. Profession-String mit Götter-Match
5. Vorteil "Geweiht (XYZ)"

**`getLkW(actor, kult)` jetzt mit `system.talente` als erste Quelle:**
1. `system.talente["Liturgiekenntnis (Kult)"].value`
2. Item-basiert
3. Flag-Map

### Verifiziert

```
Praiodun Zornbrecht → kult: "Praios", lkw: 18 ✅
```

(Vor Fix: kult: null, lkw: 0)

---

## [0.7.4] — 2026-04-30 (Final-Audit Showstopper-Fix + 7 Polish)

3. Audit-Iteration fand 1 Showstopper + 7 Polish-Findings. Alle gefixt:

### 🚨 SHOWSTOPPER

**B-1: NEU-5-Refactor brach Stumpfen Schlag (atBase als Funktion)**
- v0.7.3 hatte `stumpfer_schlag.atBase = (weapon) => -2/-4/-8` als Funktion gesetzt.
- Aber 4 Callsites in sheet.mjs lasen `sf.atBase ?? 0` als Number → JS coerciert
  Function zu String → `effectiveAT = NaN` → Probe `die ≤ NaN` immer false.
- **Stumpfer Schlag schlug seit v0.7.3 IMMER fehl** (Auto-Miss).
- Fix: Helper `getAtBase(sf, weapon)` der Function vs Number unterscheidet,
  alle 4 Callsites umgestellt: `_rollAttack`, `_rollDefense`, Chat-Display,
  Dialog-Hint.

### 🛠 MITTEL

**B-2: Wunden-Display in Schadens-Chat zeigt rohen Count statt ×2**
- Sheet-Display zeigt korrekt `−${woundPenalty * 2}`, aber Chat-Nachrichten
  bei Schadens-Vergabe (magic.mjs, sheet.mjs) zeigten `−${total}`.
- Spieler las "−2" und glaubte das, hatte aber tatsächlich −4 (NEU-2 v0.7.3).
- Fix: `−${total * 2}` in beiden Schadens-Chat-Zeilen.

**B-3: AW-Mali für nicht-existente Nachteile entfernt**
- Konsistenz mit NEU-4-Fix (v0.7.3): "Schlechte Reflexe" und "Schwerfällig"
  existieren in DSA 4.1 nicht. INI-Mali waren entfernt — AW-Mali aber noch da.
- Fix: AW-Logik in `sheet.mjs:172,173` und `xml-parser.mjs:1415-1416` entfernt.
- Behäbig (-1 AW) und Tollpatsch (-1 AW) bleiben (regelkonform per WdH/WdS).

### 🟢 NIEDRIG (Polish)

**B-4: Wuchtschlag-Hint Math.ceil statt Math.floor**
- Dialog-Hint zeigte `+${Math.floor(ansage/2)}`, tatsächlicher Bonus ist
  `Math.ceil(ansage/2)` (NEU-3 v0.7.3). Bei Ansage 5: Hint sagt "+2",
  echter Bonus "+3". Behoben.

**B-5: Stale Comment in xml-parser entfernt**
- Comment "Astralmacht*10" entfernt, durch korrektes "1 GP = 1 AsP, max 6"
  ersetzt (WdH S.247).

**B-7: Init-Log Version dynamisch**
- War: `console.log("DSA Pixel-Art Tokens v0.3.0 — Init")` (statisch).
- Jetzt: `${game.modules.get(MODULE_ID)?.version}` — immer aktuell.

**B-8: Operator-Precedence in `getActorKult` Klammer hinzugefügt**
- `||` und `&&` zusammen ohne Klammer → JS parst korrekt aber Lesbarkeit
  schlecht. Klammer setzt explizit was JS implizit macht.

### Final-Audit-Verdict

3-Iteration-Audit-Quote: **32 Bugs gefunden + alle gefixt** (2 KRITISCH +
9 HOCH + 13 MITTEL + 8 NIEDRIG). Pro Iteration sank die Severity. Die
nächste Iteration sollte realistisch nur noch sub-NIEDRIG-Findings produzieren.

**Module-Code-Status v0.7.4: production-ready.**

---

## [0.7.3] — 2026-04-30 (Re-Audit-Fixes: BE-Lookup, Wunden-Penalty, INI-Mali)

Re-Audit nach v0.7.2 fand 6 weitere Findings (3 HOCH, 3 MITTEL). Alle gefixt:

### 🚨 HOCH

**NEU-1: BE-Lookup für Talente schlug komplett fehl wegen Umlaut-Mismatch**
- `data/armor-zones.json` hatte ASCII-Keys ("Koerperbeherrschung", "Saebel",
  "Staebe", "Anderthalbhaender", "Kettenstabe") aber Talent-Namen aus HS-XML
  und `talents.json` haben Umlaute → `physicalRules[name]` lieferte nie
  einen Wert.
- Fix: alle 6 Keys auf Umlaut-Schreibweise umgestellt (Säbel, Stäbe,
  Anderthalbhänder, Kettenstäbe, Körperbeherrschung).

**NEU-2: Wunden-Penalty halbiert auf allen Sheet-Proben**
- `sheet.mjs::_getWoundPenalty()` lieferte `Σ wounds` statt `Σ wounds × 2`.
  WdS S.57 fordert −2/Wunde auf alle Proben. INI-Tracker (combat.mjs) hatte
  korrektes `wp*2`, Sheet-Proben (Talent/Eigenschaft/Spruch/Initiative/Ritual)
  hatten nur `wp` — also halben Penalty.
- Auswirkung: Held mit 2 Wunden bekam −2 statt −4 auf alle Sheet-Proben.
- Fix: `return totalWounds * 2;`.

**REG-1 (Doku): CHANGELOG-Eintrag v0.7.1 Astralmacht ×10 korrigiert**
- War: "Astralmacht-Bonus IMMER on top, Aytan jetzt 79" (×10 impliziert)
- Jetzt: WdH S.247 — 1 GP = 1 AsP, max 6 AsP. HS-mod enthält Astralmacht-
  Bonus i.d.R. bereits, kein Doppel-Bonus.

### 🛠 MITTEL

**NEU-3: Wuchtschlag-Halbierung Math.ceil statt floor**
- WdS S.65: "Ansage +5 → +3 TP (aufgerundet)". Code hatte `Math.floor(5/2)=2`.
- Fix: `Math.ceil(ansage / 2)`.

**NEU-4: Erfundene INI-Mali entfernt (Behäbig/Tollpatsch/Schwerfällig/Schl. Reflexe)**
- Per WdH: Behäbig gibt nur GS−1 + AW−1 (KEIN INI-Mali). Tollpatsch verschiebt
  nur Patzer-Schwelle auf 19+. "Schwerfällig" und "Schlechte Reflexe" sind
  in DSA 4.1 nicht existent.
- Fix: INI-Tracker (combat.mjs) und Sheet (sheet.mjs `iniNachteilMalus`)
  entfernen die erfundenen Mali. Wer sie als Hausregel will, kann manuell
  über System-Modifikatoren eintragen.

**NEU-5: Stumpfer Schlag atBase als Funktion nach Waffenkategorie**
- WdS S.66: −2 mit Stab/Knüppel, −4 mit stumpfer Seite anderer Hiebwaffen,
  −8 mit allen anderen Waffen.
- Vorher: fix `atBase: -2` für alle Waffen.
- Fix: `atBase` ist jetzt Funktion `(weapon) => weapon.kampftalent`-basiert.

### Re-Audit-Verifikation

Alle 18 Bugs aus v0.6.0/0.7.x wurden vom Background-Agent re-validiert:
**alle korrekt gefixt, keine Regression**. Re-Audit-Quote: 100%.

---

## [0.7.1] — 2026-04-30 (Importer-Audit Fixes #1-#5 + #22)

Background-Agent-Audit fand 25 Importer-Bugs. Top-5 davon waren game-breaking
(Eigenschaften double-Bonus, KaP-Pool fehlte, etc.). Alle gefixt:

### 🚨 KRITISCHE Importer-Fixes

**BUG #1+#2: Eigenschaften + LeP/AsP/AuP doppelt verrechnet**
- Vorher: `attributes[k] = value + mod` → Grog KK=23 (statt 20), KO=20 (statt 18)
- Vorher: `lepBonus = mod + value` → Grog LeP=64 (statt 48)
- Korrigiert: HS-`value` ist bereits FINAL bei Eigenschaften, `mod` ist Max-
  Bonus bei LeP/AsP/AuP (nicht zusätzlich Current-Wert addieren).
- Verifiziert via Live-Test: Grog jetzt MU 17, KK 20, KO 18 ✓; LeP 48 ✓

**BUG #3: KaP-Pool für Geweihte/Schamanen fehlte komplett**
- Tarvas (Boron) hatte KaP=0 statt 58. Grog (Hochschamane) hatte KaP=0 statt 12.
- Neue `istKarmaler`-Detection: Geweiht-Vorteil + Akademische Ausbildung
  (Tempel) + Profession-Match (Geweiht/Priester/Boron-/Praios-/Rondra-).
- KaP-Berechnung: alveranisch 24 + mod, Halbgötter/Hochschamanen 12 + mod.
- istZauberer schließt jetzt Tempel-Akademien aus (Magier/Magie matched).

**BUG #4: Set-Varianten verloren beim Dedup**
- Aytan hatte 2× "Dicke Kleidung" (slot=0 Ritualkleidung, slot=1 Reise) →
  zweite verschwand. Auch 2× Amulett (Sonnenscheibe vs Schutz).
- Dedup-Key erweitert: `name|anzahl|slot|customDisplayName`. Verschiedene
  Custom-Display-Names oder Slots → bleiben getrennt.

**BUG #6: Astralmacht-Vorteil — WdH-konformer 1:1-Bonus**
- Per WdH S.247: Astralmacht = 1 GP für 1 AsP (max 6 AsP), NICHT 1:10.
- Vorher fälschlich `value × 10` angesetzt — komplett falsch.
- HS rechnet den Astralmacht-Bonus i.d.R. bereits in den `mod`-Wert ein,
  daher addieren wir ihn bei Vollzauberern NICHT zusätzlich (sonst doppelt).
- Bei Astralmacht ohne Vollzauberer-Vorteil: 1 AsP/GP wird addiert (selten
  Edge-Case wie Achaz-Geweihte mit Astralmacht).

**BUG #22: Schamanistisch/Liturgie-REP-Map fehlte**
- Grog-Sprüche mit `repraesentation="Schamanistisch"` wurden im REP-Flag
  ignoriert → Schamanen-Sparte im Sheet leer trotz aller Geister-Sprüche.
- REP_MAP erweitert: schamanistisch/schamanisch/schamane → "sha";
  liturgie/boron/praios/rondra → "lit".

### Live-Test-Verifikation (alle 3 Test-XMLs)

| Char | Eigenschaften | LeP | AsP | AuP | KaP | Items |
|------|---------------|-----|-----|-----|-----|-------|
| Aytan (Magier) | MU 15, KL 17, IN 15, CH 15, KO 13, KK 12 | 30 | 79 | 32 | 0 | 69 |
| Grog (Schamane) | MU 17, KK 20, KO 18, GE 10 | 48 | 40 | 23 | **12** | 39 |
| Tarvas (Geweiht) | MU 16, KL 14, IN 17, CH 17 | 19 | 25 | 21 | **58** | 35 |

Vor v0.7.1: KaP überall 0, AsP/LeP off-by-double, Set-Items verloren.

### Verbliebene Audit-Findings (für v0.8.x)

20 weitere Bugs aus dem Importer-Audit dokumentiert (Auswahl-Werte,
Talent-Probe als Array, BOM-Handling, Spezialisierungs-Children etc.).
Alle mit niedriger bis mittlerer Severity, nicht-blockierend.

---

## [0.7.0] — 2026-04-30 (15 TODOs + Importer-Critical-Fixes)

Alle 15 verbleibenden TODOs aus dem v0.6.0 Audit-Report abgearbeitet, plus
3 KRITISCHE Bugs im XML-Importer (User-Bericht: "hat nicht 1 mal richtig
funktioniert") behoben.

### 🚨 XML-Importer KRITISCHE Bugs

**`xml-parser.mjs:822` — `slot is not defined` ReferenceError**
Im equipment-Fallback wurde die Variable `slot` referenziert, aber niemals
deklariert. → JEDER XML-Import schlug komplett fehl mit Parse-Error.
Fix: `slotAttr = el.getAttribute("slot")` korrekt einlesen.

**`xml-parser.mjs:1219` — AuP-Formel komplett falsch**
War: `GE + KO + KK/2` (komplett ohne Halbierung, KK statt MU).
Korrekt per WdH S.46: `(MU + KO + GE) / 2` (echt gerundet).

**`xml-parser.mjs:1208` — AsP-Formel ohne Halbierung**
War: `MU + IN + CH` (volle Summe).
Korrekt per WdH S.46: `(MU + IN + CH) / 2` (echt gerundet). Astralmacht-
Vorteil ergänzt zu Halb-Basis statt komplettem Ersatz.

### 🔧 WdS/WdH Komfort-Fixes

- **WS-F5: `getLepStatus()` mit Eisern/Zäher Hund/Selbstbeherrschung**
  Eisern + Zäher Hund: nicht kampfunfähig bei LeP ≤ 5. Zäher Hund: Tod-
  Schwelle 1.5×KO statt KO. Selbstbeherrschung ≥ 12: nicht kampfunfähig.
- **WS-F9: Stumpfer Schlag + Betäubungsschlag-Manöver** in COMBAT_MANEUVERS
  ergänzt. WS+2 für Wunden, TP→TP(A) (Ausdauerschaden).
- **WS-F22: AW-eBE-Doppelabzug behoben.** Sheet zeigt jetzt rohen AW;
  Dialog zieht eBE situativ ab (½ normal / volle gezielt).
- **WS-F13: Schildkampf I/II nur mit Linkhand-Voraussetzung.** Ohne
  Linkhand greift kein Schildkampf-Bonus mehr (WdS S.121).
- **WS-F18: ZONE_WOUND_EFFECTS + aggregateWoundEffects()** Helper
  in config.mjs. Pro-Zone-Mali (Kopf MU/KL/IN/INI−2; Brust AT/PA/KO/KK−1
  +1W6 SP; Bauch GE/KK−1 +GS−1; Armwunden AT/PA/KK/FF−2; Beinwunde GS−1)
  laut WdS S.110.

### 🙏 Liturgien/Schamanen-Fixes

- **LIT-F1: Mirakel mit Halbe-Mods-Dialog.** Situativer Modifikator
  (Tempel/Feiertag/Notlage) wird halbiert vor Probe-Verrechnung
  (LL S.8 "nur die Hälfte der dort angegebenen Zuschläge").
- **LIT-F5: "Zauber der Keule" Ritual ergänzt** in keule.mjs RITUALE_DEFS
  (WdZ S.167: senkt AsP-Kosten jedes Schamanen-Rituals um Stufe 1/2/3,
  min 1 AsP).
- **shamanism.mjs konsumiert `boni.zauberAspReduktion`** beim Ritual-
  würfeln und reduziert die gewürfelten AsP-Kosten korrekt.

### ⚡ Magie-Fixes

- **MAG-F9: Beschwörung-Kontrollformel-Detection robuster.**
  Statt String-Match auf "MU+IN+CH+CH" jetzt explizites Mapping per
  `beschwoerungKategorie`: elementar* → (MU+IN+CH+CH+ZfW)/5;
  daemon*/untot*/golem* → (MU+MU+KL+CH+ZfW)/5.

### 📋 Status-Tracking

- AUDIT-REPORT v0.7.0: Alle Findings aus dem Komplett-Audit jetzt erledigt
  (außer F8 LO-Probe + F19 Karma-Regen + F22 Weihe-pAsP-Übernahme — als
  v0.7.x-Followups dokumentiert, nicht-blockierend).
- Importer-Audit läuft als Background-Agent für tieferen Stress-Test.

---

## [0.6.0] — 2026-04-30 (Komplett-Audit: Regelkonformität gegen WdH/WdS/WdZ/LCR/LL)

### 🔍 Vollständiger Regel-Audit aller Module

Jedes der 18 Module gegen die offiziellen DSA 4.1-Regelwerke verifiziert
(WdH, WdS, WdZ, LCR, Liber Liturgium). 4 Background-Audit-Agents +
eigene Live-Tests via Foundry-Bridge. **18 Bugs gefixt**, davon 2
**KRITISCH** (game-breaking) + 6 **HOCH** + 10 **MITTEL/NIEDRIG**.

Vollständiger Audit-Report: [`AUDIT-REPORT.md`](AUDIT-REPORT.md)

### 🚨 KRITISCHE Fixes

**`keule.mjs` — Bann der Keule-Mod-Bug** (game-breaking)
War: Bann der Keule erleichterte Geister-Bann-Proben um −9/−12/−15
(quasi Auto-Erfolg). Korrekt per WdZ S.167: −1/−2/−3 Erleichterung
(die +9/+12/+15 sind die *Erschaffungs-Erschwernis*, nicht der
*Wirkungs-Bonus*). Geist-der-Keule-Mechanik jetzt regelkonform.

**`data/liturgien.json` — Primäre Segnungen 5 Götter falsch zugeordnet**
War: Praios=Glückssegen, Rondra=Eidsegen, Travia=Schutzsegen,
Ifirn=Feuersegen, Swafnir=Harmoniesegen (alle falsch).
Korrekt per Liber Liturgium S.9: Praios=Eidsegen, Rondra=Schutzsegen,
Travia=Speisesegen, Ifirn=Heilungssegen, Swafnir=Tranksegen.
`_primaereSegnung`-Map korrigiert + 4 Halbgötter (Angrosch/Gravesh/
H'Szint/Zsahh) ergänzt + 10 Liturgie-`primaer`-Arrays automatisch
umgehängt via Migrations-Script.

### 🔧 HOCH-Severity-Fixes

- **`config.mjs::resolveProbe`** — Negativer effektiver TaW erschwert
  jetzt jede Eigenschafts-Probe um |effTaw| (WdH S.7). Vorher schaffte
  ein Held mit TaW 3 + Erschw 5 die Probe noch leicht; jetzt regelkonform
  schwer.
- **`sheet.mjs`/`magic.mjs` — Kampfunfähig-Schwelle WdS S.78**: Dreistufiger
  Status (KAMPFUNFÄHIG ≤5, LEBENSBEDROHLICH ≤0, UNWIDERRUFLICH TOT
  < −KO). Vorher nur "KAMPFUNFAEHIG" bei LeP=0 — zu spät.
- **`liturgies.mjs`** — Aufgestufte primäre Segnung kostet jetzt einen
  Grad weniger (Liber Liturgium S.9). Praios-Geweihter mit Glückssegen
  Grad I→II zahlt Grad-I-Kosten (5 KaP, +0), nicht Grad-II.
- **`shamanism.mjs`/`keule.mjs`** — "Hilfe der Keule" wirkt jetzt auf
  ALLE Schamanen-Rituale (außer Keulen-Rituale selbst) statt nur auf
  eine gewählte Fertigkeit (WdZ S.167).
- **`magic.mjs`** — Schelm-MR-Default 0 statt 3. Schelm ohne Vorteil
  "Unbeschwertes Zaubern" muss volle MR überwinden (WdH S.76).
- **`config.mjs`** — Erzwingen-AsP-Kosten jetzt 1/2/4/8/16/32 statt
  1/3/7/15/31. Verdopplung pro Stufe (WdZ S.20).
- **`config.mjs`** — Ignisphaero/Igniplano fixedAspCost 21/25 statt
  TP=AsP (LCR S.130/140). Vorher zahlte der Caster ~30 AsP; jetzt
  korrekt fix 21.

### 🛠 MITTEL/NIEDRIG-Severity-Fixes

- **`config.mjs`** — Kristallomant-ZfP-Verdopplung nur ohne passenden
  Kristall (WdZ S.322). Vorher unbedingt verdoppelt.
- **`zone-spells.mjs`** — Sumpfstrudel-Befreiungsprobe jetzt korrekte
  Talent-Probe auf Körperbeherrschung (MU/IN/GE) statt 3× gegen KO
  (LCR S.276).
- **`combat.mjs`** — INI-Tracker berücksichtigt jetzt Behäbig (−1),
  Schwerfällig (−1), Tollpatsch (−1), Schlechte Reflexe (−2). Vorher
  nur in Sheet-Anzeige, nicht im Tracker.
- **`combat.mjs`** — Wunden-Penalty auf INI jetzt −2 pro Wunde
  (WdS S.57), nicht −1. Auch Waffen-INI-Mod (Rapier +1, Streitkolben
  −1 etc.) wird gelesen.
- **`combat.mjs`** — Kampfreflexe-BE-Check nutzt jetzt eBE nach
  Rüstungsgewöhnung. Held mit BE 6 + RG II hat effektiv BE 4 → Kampf-
  reflexe greift.
- **`sheet.mjs`** — Gezielter Stich jetzt mit RS-komplett-Ignore +
  Wundschwelle −2 + auto +1 Wunde (WdS S.65). Vorher nur −2 RS.
- **`zone-spells.mjs`** — `evaluate({async:false})` deprecated-Aufrufe
  durch `await evaluate()` ersetzt (Foundry V12+).
- **`zone-spells.mjs`/`pandaemonium.mjs`** — Direkte `actor.update`
  durch `relayActorUpdate` ersetzt für Player-getriebene Schadens-
  Anwendung auf NSCs ohne Permission.

### 📋 Audit-Findings im Überblick

- **18 Bugs gefixt** (alle KRITISCH + HOCH + Mittel/Niedrig)
- **15 TODOs für v0.6.x** (nicht-blockierend, dokumentiert in AUDIT-REPORT.md)
- **40+ Punkte korrekt verifiziert** (alle Kern-Formeln, Probe-Mechanik, Hit-Zone-Tabelle, Schamanen-AsP-Würfel, Beschwörung, Aufstufung etc.)

---

## [0.5.2] — 2026-04-30 (Multiplayer + Feuerball + Pfeil-Verzauberung)

### 🛡 GM-Relay-Socket für Player-getriebene Updates

Player-Charaktere konnten bislang keinen Schaden auf NSCs anwenden, weil ihnen
Foundry-Schreibrechte fehlen ("User lacks permission"). Behoben durch
Socket-Relay: alle Schaden-/Heilung-/Wunden-/Spawn-Operationen laufen jetzt
über `relayActorUpdate`, das bei fehlendem Ownership transparent an den GM-
Client routet, der die DB-Operation durchführt.

**Betroffene Pfade**:
- `magic.mjs::_applySpellDamage` — direktSchaden + Wunden auf Ziel
- `magic.mjs::_applyAoESpellDamage` — Flächenschaden auf alle Tokens im Radius
- `sheet.mjs` Schaden-Auto-Apply via Chat-Click
- `zone-spells.mjs` Fesselranken/Sumpfstrudel/Auge-des-Limbus DOT-Ticks
- Kreatur-Spawn (`spawnCreature`) — Player können jetzt über GM-Relay spawnen

### 🔥 Ignisphaero Feuerball: korrekter LCR-Flächenschaden

`SPELL_DAMAGE_MAP["Ignisphaero Feuerball"]` jetzt mit `aoeRadius: 8 Schritt` +
`aoeFalloff: "perStepMinusOnePlusMinDie"` (LCR S.140):

- Zentrum: `5W6 + ZfP*/2` TP
- Pro Schritt Entfernung: `−(1 + niedrigster_W6_der_Schadensrolle)` TP
- Trifft alle Tokens im Radius (inkl. Caster wenn er drin steht)
- Pro Token: eigene RS, Element-Immunität, Gardianum-Absorption,
  Wunden-Schwellen
- `perTenTpRSReduction` für RS-Reduktion ab 10+ TP wie bei Ignifaxius

Chat-Output zeigt pro Token: Distanz, raw TP, RS-Abzug, finale SP, neue LeP,
Wunden, Kampfunfähigkeit. Igniplano Flächenbrand bekommt ebenfalls
`aoeRadius: 3` mit linearem Falloff.

### ✨ vfxFireballXXL: 3-Phasen-Cinematic-Animation

Neuer großer Feuerball-Effekt (`feuerball_xxl`), der bei AoE-Cast getriggert
wird:

- **Phase 1 (0-15%)**: Anti-Wave — konzentrische Sog-Linien ziehen sich
  zentral zusammen, ladender Glow.
- **Phase 2 (15-50%)**: Detonation — weißer Flash, 3 zeitlich gestaffelte
  Schockwellen-Ringe, 80 Feuer-Partikel, 12 Lava-Splatter mit Schwerkraft +
  Rotation, Hitze-Verzerrungswellen, dreifacher Screen-Shake (18→10→5).
- **Phase 3 (50-100%)**: Roll-Out — 40 Embers regnen mit Schwerkraft,
  flackern; dunkle Rauchsäule mit ~25 Wolken steigt auf; 18 glühende
  Glut-Punkte bleiben am Boden liegen und flackern.

### 🏹 Pfeil-Verzauberung Multi-Element + Bug-Fix

`_arrowEnchants.set()` war nie aufgerufen — Verzauberung verpuffte ohne
Wirkung. Jetzt:

- `magic.mjs::castSpell` setzt nach erfolgreichem `enchantArrow`-Cast den
  Eintrag in `globalThis.DSAPixelArrowEnchants`
- Sheet konsumiert beim nächsten Fernkampfschuss → richtiger Element-VFX
- Sheet-Banner im Kampf-Tab zeigt aktive Verzauberung mit ✕-Button

`spells.json` "Pfeil des (Elements)" um alle 6 Element-Varianten + 4
Sondervarianten erweitert (LCR S.140):

- Pfeil des Feuers/Eises/Wassers/Erzes/Luft/Humus mit individuellen
  Beschreibungen, Merkmalen und Sonder-Effekten (Pfeil des Erzes hat
  `fkMalus: 4` für die Fernkampfprobe)
- Speer (+7 ZfP) / Bolzen (+3 ZfP) als Trägerwaffen-Variante
- Permanenz (+7 ZfP, +13 AsP, 1 permanent)
- Reversalis (gegensätzliches Element)

`castSpell` nutzt `selectedVariant.spellNameOverride` für den
`lookupSpellEffect()`-Lookup → richtiger Element-VFX (`pfeil_luft` /
`pfeil_feuer` / etc.) wird beim Schuss gefeuert.

### 📋 Probe-Display: Misserfolg mit Aufschlüsselung

Bei misslungener Talent-/Zauber-Probe zeigt der Chat jetzt zusätzlich:
- Roter Header: **N Punkt(e) verfehlt**
- Komplett-Breakdown: `TaW 7 − 4 (Erschw.) − 8 (über) = -5`

Damit ist sofort sichtbar, woran's gescheitert ist.

---

## [0.5.1] — 2026-04-30 (Probe-Mechanik-Hotfix)

### 🎲 Probe-Mechanik auf RAW-Variante A umgestellt

`config.mjs::resolveProbe` setzt jetzt **WdH S.27 / WdZ S.32 "Talent mindern"**
um (statt "Eigenschaft mindern"):

- Erschwernis E wird **vor** der Probe vom TaW/ZfW abgezogen
- Würfel werden gegen die **unveränderten** Eigenschaften verglichen
- Restwert nach Abzug aller Über-Punkte = TaP*/ZfP*
- Numerisch identisch zu *"Erschwernis vom TaP*/ZfP* abziehen"*

**Auswirkung auf Magieresistenz-Sprüche** (`isMR=true`):
- ZfP* wird jetzt automatisch um die Ziel-MR reduziert
- Bei `isMR + targetMR=4`: effektiver ZfW −4, ZfP* zeigt korrekten Endwert
- Schelm-MR-Schwelle (3/7/12) wird wie zuvor abgezogen

**Auswirkung auf Aufstufungen / Erschwernisse**:
- Reichweite/Zauberdauer-Mods: Kosten in ZfP werden vom ZfW abgezogen
  (war schon vorher korrekt)
- Manueller Mod / BE / Aufrechterhaltene Zauber / Pakt-Bonus: gehen jetzt
  als TaW-Reduktion in den ZfP*/TaP* ein (statt Eigenschaft zu mindern)

**Würfel-Farbe im Chat**:
- Rot/Grün referenziert ab jetzt den **nackten Eigenschaftswert**
  (Variante A Konvention) — damit ist sofort sichtbar, wann ein Würfel
  über der Eigenschaft liegt, unabhängig vom Modifikator
- Behebt Display-Bug: Würfel 14 vs MU 15 wird jetzt grün (war vorher rot)

**ZfP*/TaP*-Aufschlüsselung im Chat**:
- Bei aktivem Modifikator wird die Berechnung sichtbar:
  `TaW 12 − 4 (Erschw.) − 2 (über) = TaP* 6`
- Bei MR-Sprüchen: `ZfW 11 − 4 MR − 2 über = ZfP* 5`

### 🔧 Talent-Probe Robustheit

`sheet.mjs::_prepareTalents` + `_rollTalent`:

- **Probe-Fallback-Kette**: HTML data-attribute → `system.talente[name].probe`
  → `talents.json`-DB-Lookup. Behebt fehlende Probe-Daten bei Talenten,
  die aus älteren XML-Imports stammen oder nur als TaW im gdsa-Schema
  vorliegen.
- Probe-Format normalisiert: Array `["MU","IN","CH"]` und String `"MU/IN/CH"`
  werden konsistent zu `MU/IN/CH` für `data-probe`-Attribut.
- Warnung wenn Probe komplett unauffindbar (statt stiller Default-Lookup
  gegen 10/10/10).

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
