# DSA Pixel Tokens — Komplett-Audit-Report v0.6.0

**Datum**: 2026-04-30
**Methodik**: 4 Background-Audit-Agents (WdH/WdS, WdZ/LCR Magie, Liturgien/Schamanen-2x) + eigene Live-Tests via Foundry-Bridge
**Quellen**: WdH, WdS, WdZ, LCR (Liber Cantiones Remastered), LCD (Liber Cantiones), Liber Liturgium S.8-19
**Modul**: 18 Module / ~18.700 LoC / 305 Liturgien / 75 Schamanen-Rituale / 9 Keulen-Rituale / ~1900 Sprüche

---

## 📊 ÜBERSICHT ALLER FINDINGS

### ✅ GEFIXT (kritische + relevante Bugs)

| ID | Severity | Datei | Was war falsch | Fix |
|----|----------|-------|----------------|-----|
| **WS-F1** | HOCH | `config.mjs::resolveProbe` | Negativer TaW erschwerte nicht jede Eigenschafts-Probe (WdH S.7) | `extraEigErschwernis` bei `effTaw<0` auf alle Eigenschaften aufaddiert, buffer auf 0 |
| **WS-F4** | HOCH | `sheet.mjs:2396`, `magic.mjs:1107`+`:1333` | "KAMPFUNFAEHIG" nur bei `LeP === 0`, korrekt ist LeP ≤ 5 (WdS S.78) | 3-stufiger Status: KAMPFUNFÄHIG ≤5, LEBENSBEDROHLICH ≤0, UNWIDERRUFLICH TOT < −KO |
| **LIT-F17** | KRITISCH | `keule.mjs:12,126,230` | Bann der Keule gab +9/+12/+15 Erleichterung statt +1/+2/+3 (Game-Breaker) | mod = -stufe, Beschreibung "Erleichterung -1/-2/-3 auf Kontroll-Proben" |
| **LIT-F16** | KRITISCH | `data/liturgien.json` | 5 primäre Segnungen falsch zugeordnet: Praios=Glücks→Eid, Rondra=Eid→Schutz, Travia=Schutz→Speise, Ifirn=Feuer→Heilung, Swafnir=Harmonie→Trank (Liber Liturgium S.9) | `_primaereSegnung`-Map korrigiert + 4 Halbgötter (Angrosch/Gravesh/H'Szint/Zsahh) ergänzt + 10 `primaer`-Arrays in Liturgie-Einträgen via Script umgehängt |
| **LIT-F2** | HOCH | `liturgies.mjs:362-366` | Aufgestufte primäre Segnung: Grad I→II zahlte Grad-II-Kosten statt Grad-I (Liber Liturgium S.9 "ein Grad niedriger") | bei `isPrimaer` werden Kosten/Erschwernis aus `meta[lowerGrade]` gezogen |
| **LIT-F7** | HOCH | `keule.mjs:230`, `shamanism.mjs:286-294` | "Hilfe der Keule" wirkte nur auf eine gewählte Fertigkeit (WdZ S.167: "sämtliche Rituale") | Bedingung `boni.hilfeFertigkeit === fertigkeit` entfernt |
| **MAG-F1** | HOCH | `magic.mjs:78-87` | Schelm-MR-Default 3 ohne Vorteil (WdH S.76: 0 ohne Unbeschwertes Zaubern) | Default 0, Vorteils- und SF-Lookup separat |
| **MAG-F2** | HOCH | `config.mjs:706-712` | Erzwingen-AsP-Kosten 1/3/7/15/31 (kumulativ) statt 1/2/4/8/16/32 (WdZ S.20) | Tabelle korrigiert + Stufe +6 (32 AsP) ergänzt |
| **MAG-F3** | MITTEL | `config.mjs:765-767` | Kristallomant-ZfP unbedingt verdoppelt (WdZ S.322: nur ohne passenden Kristall) | Bedingung `!extraFlags?.passenderKristall` |
| **MAG-F4** | MITTEL | `zone-spells.mjs:643-657` | Sumpfstrudel-Probe alle 3 Würfel gegen KO statt Talent-Probe (LCR S.276) | Talent-Lookup (Körperbeherrschung MU/IN/GE) + `resolveProbe()` |
| **MAG-F8** | HOCH | `magic.mjs:1167`, `config.mjs:881,886` | Ignisphaero/Igniplano AsP=TP statt fix 21/25 (LCR S.130/140) | `fixedAspCost: 21/25` überschreibt TP-Default |
| **WS-F8** | MITTEL | `sheet.mjs:1768` | Gezielter Stich nur −2 RS, nicht volle WS-Reduktion + RS-Ignore (WdS S.65) | reduceWS:2 + ignoreRS:true + autoWounds:1 |
| **WS-F16** | MITTEL | `combat.mjs:489` | Wunden im INI nur −1 statt −2 pro Wunde (WdS S.57) | `woundIniMali = wp * 2` |
| **WS-F25** | MITTEL | `combat.mjs:491` | INI-Tracker ignorierte Behäbig/Schwerfällig/Tollpatsch/Schlechte-Reflexe | `nachteilMali`-Berechnung analog zu sheet.mjs |
| **WS-F26** | NIEDRIG | `combat.mjs:467` | Kampfreflexe-BE-Check ohne RG-Reduktion (WdS S.75) | `_kfEffectiveBE = max(0, BE - rgLevel)` |
| **WS-F29** | NIEDRIG | `combat.mjs:491` | Waffen-INI-Mod (Rapier +1, Streitkolben −1) im Tracker ignoriert | `weaponIni`-Lookup für equipped Waffe |
| **MAG-F11** | NIEDRIG | `zone-spells.mjs:433` | `evaluate({async:false})` deprecated in Foundry V12+ | `await Roll.evaluate()` |
| **MAG-F12** | MITTEL | `zone-spells.mjs:437,576`, `pandaemonium.mjs:122,624` | Direct `actor.update` statt Relay (Player ohne Permission) | `relayActorUpdate(actor, ...)` |

### ✓ KORREKT (regelkonform verifiziert)

| Punkt | Quelle | Status |
|-------|--------|--------|
| AT-Basis = `round((MU+GE+KK)/5)` | WdH S.46 | ✓ |
| PA-Basis = `round((IN+GE+KK)/5)` | WdH S.46 | ✓ |
| FK-Basis = `round((IN+FF+KK)/5)` | WdH S.46 | ✓ |
| INI-Basis = `round((MU+MU+IN+GE)/5)` | WdH S.46 | ✓ |
| MR = `round((MU+KL+KO)/5)` | WdH S.46 | ✓ |
| AuP = `round((MU+KO+GE)/2)` | WdH S.46 | ✓ |
| AsP = `round((MU+IN+CH)/2)` | WdH S.46 | ✓ |
| LeP = `round((KO+KO+KK)/2)` | WdH S.46 | ✓ (in xml-parser) |
| WS = `KO/2` mit Eisern +2 / Glasknochen −2 | WdS S.57 | ✓ |
| Trefferzonen-Tabelle (1-6 Beine, 7-8 Bauch, 9-14 Arme, 15-18 Brust, 19-20 Kopf) | WdS S.107 | ✓ |
| Schild-PA-Boni: Linkhand +1, +Schildkampf I → +3, +SK II → +5 | WdS S.121 | ✓ |
| AW = volle PA-Basis + SF Ausweichen I/II/III (+3/+6/+9) + Akrobatik | WdS S.66 | ✓ |
| Patzer/Glücklich-Detection (Doppel-1, Doppel-20, Bestätigungswurf) | WdH S.7 | ✓ |
| Variante A (TaW vor Probe um Erschwernis reduziert) | WdH S.27 | ✓ (gefixt v0.5.1) |
| AsP-Halbierung bei Misserfolg (Hexen 1/3, sonst 1/2) | WdZ S.14 | ✓ |
| Gildenmagisch ZfP-Halbierung + ZD-Verdoppeln-Bonus +1 | WdZ S.260 | ✓ |
| Borbaradianisch Reichweite ×7 ZfP | WdZ S.20 | ✓ |
| Elfisch −1 AsP bei augenblicklich/permanent + KL→IN Tausch | WdZ S.322 | ✓ |
| Kristallomant ¾ AsP | WdZ S.322 | ✓ |
| Druiden Erzwingen ½ AsP | WdZ S.319 | ✓ |
| Geoden −2 ZfP bei Bevorzugtem Element | WdZ S.314 | ✓ |
| Beschwörung Anrufung +7 ohne Wahren Namen / +5 Gehörnte / 3W6 Blutmagie | WdZ S.191 | ✓ |
| Pakt-Bonus 3 GP = -1 Erleichterung, max 7 | WdZ Pakt-Regeln | ✓ |
| Karmaprobe Probenzuschlag-Tabelle (I=0, II=+2, ..., VIII=+14) | Liber Liturgium S.10 | ✓ |
| KaP-Tabelle (I=5, II=10, ..., VIII=40) + pKaP V/VI/VII/VIII = 1/3/5/7 | Liber Liturgium S.10 | ✓ |
| Mirakel: 5 KaP, 1 Aktion, 0/+6/+18 Mod | Liber Liturgium S.8 | ✓ |
| Mirakel-Wirkung: LkP*/2+2 (Eigenschaft/MR) bzw. +5 (Talent) | Liber Liturgium S.8 | ✓ |
| Liturgie-Misslingen 1/5 KaP (mind. 1) | Liber Liturgium S.10 | ✓ |
| Aufstufung: 4 Kategorien, +2 Erschwernis pro Stufe, 3×Grad ≤ LkW | Liber Liturgium S.15 | ✓ |
| Hochschamanen 12 KaP fix, kein primäres Segnen | LL S.9 / WdH S.293 | ✓ |
| Schamanen AsP-Würfel-Tabelle (1-6 W6 + Mod 0-10, V/VI mit 1/10 perm) | WdZ S.154-155 | ✓ |
| 4 Geister-Fertigkeiten mit eigenen Probe-Eigenschaften | WdZ S.149 | ✓ |
| Schattenlarve = Phex (nicht Boron) | LCR S.262 | ✓ |
| Ignifaxius `chooseDice` + perTenTpRSReduction + AsP=TP | LCR S.132 | ✓ |
| Fulminictus ignoresRS / onlyLeP / 2W6+ZfP* | LCR S.96 | ✓ |
| Pandämonium Erscheinungs-Cluster (Krallen ZfP*, Tentakel ZfP*/2, 1 Maul) | LCR S.218 | ✓ |
| Foundry V12 Token-Aware-Relay (linked + unlinked Tokens) | Foundry-API | ✓ |
| VFX-Broadcast an alle Clients via game.socket | Foundry-API | ✓ |
| W6-Würfel-Display (clip-path Cube statt Hexagon) | Custom | ✓ |

### ⏸ TODO (für künftige Releases — nicht-blockierend)

| ID | Beschreibung | Aufwand |
|----|--------------|---------|
| WS-F5 | Eisern/Zäher Hund modifizieren Tod/Kampfunfähig-Schwelle nicht | Mittel |
| WS-F9 | Stumpfer Schlag + TP(A)-Mechanik komplett fehlend | Hoch |
| WS-F18 | Pro-Zone-Wundenmali (Kopf MU/KL/IN−2; Bauch GE/KK−2; Beinwunde GS/2 etc.) | Hoch |
| WS-F22 | AW-eBE-Doppel-Abzug bei Gezieltem Ausweichen | Niedrig |
| WS-F13 | Schildkampf I/II ohne Linkhand-Voraussetzungs-Check | Niedrig |
| LIT-F1 | Mirakel-Halbe-Mods-Regel (LL S.8: situative Mods × 0.5) | Mittel |
| LIT-F3 | Boron-Liturgien Count 58 statt 50 (LL S.27) — manuelle Bereinigung | Niedrig |
| LIT-F5 | "Zauber der Keule" Ritual fehlt (WdZ S.167) | Niedrig |
| LIT-F8 | LO-Probe vor jedem Keulen-Ritual (WdZ S.167: ±LO/2) | Mittel |
| LIT-F19 | Karma-Regeneration (Meditation, Morgengebet, Tempel-Bonus) | Mittel |
| LIT-F20 | Hilfsfertigkeiten-Misslingen-Penalty +7 (WdZ S.150) | Niedrig |
| LIT-F22 | Weihe der Keule pAsP-Erschwernis bei Übernahme | Niedrig |
| LIT-F24 | Petromantie-Rituale als Datensätze (4 Stk aus WdZ S.155) | Niedrig |
| MAG-F9 | Kontrollwert-Formel-Detection via String-Match (fragil) | Niedrig |
| MAG-F10 | Aufrechterhaltene Zauber Auto-Increment/Decrement | Mittel |

---

## 🧪 Live-Tests verifiziert (Pass 3)

```
Test 1 — resolveProbe negativer TaW (WdH S.7):
  Würfel 14/14/14 vs 15/15/15, TaW=3, Erschw=5
  → effTaw = -2, jede Eigenschaft -2 → effAttr=13
  → dice 14 vs 13 = +1 over pro Würfel = 3 over total
  → remainder = -2 - 3 = -5 ✓

Test 2 — Erzwingen-AsP-Kosten (WdZ S.20):
  +1=1, +2=2, +3=4, +4=8, +5=16, +6=32 ✓

Test 3 — Ignisphaero AsP-Cost (LCR S.140):
  fixedAspCost: 21 ✓ (statt TP=AsP)
  aoeRadius: 12, falloff: perStepMinusOnePlusMinDie ✓

Test 4 — Primäre Segnungen (LL S.9):
  Praios → Eidsegen ✓
  Rondra → Schutzsegen ✓
  Travia → Speisesegen ✓
  Ifirn → Heilungssegen ✓
  Swafnir → Tranksegen ✓

Test 5 — Token-Aware Relay (Foundry V12):
  Tarion-Token (unlinked, oldLep=11) → relayTokenUpdate(-5) → newLep=6 ✓
```

---

## 🎯 Zusammenfassung

- **Gefunden**: 60+ Findings über 4 Audit-Agents + eigene Live-Tests
- **Gefixt**: 18 (alle KRITISCH + HOCH + Mittel)
- **TODO**: 15 (alle NIEDRIG bis MITTEL, für v0.6.x-FolgeReleases)
- **Korrekt verifiziert**: 40+ Punkte (Probe-Mechanik, Formeln, Schadenslogik, Beschwörung, Aufstufung)

Die größten Findings waren der **Bann-der-Keule-Bug** (-15 statt -3 Erleichterung, Game-Breaker) und die **5 falsch zugeordneten primären Segnungen** der Hauptgötter. Beide jetzt korrigiert.

**Module-Code-Qualität**: Insgesamt erstaunlich regeltreu. Die meisten Kern-Mechaniken (DSA-Probe, AsP-Kosten, Repräsentations-Sonderregeln, Schamanen-Würfel-Tabellen, Hit-Zonen-Verteilung) waren bereits korrekt. Bugs konzentrierten sich auf Edge-Cases (negativer TaW), Tabellen-Tippfehler (Erzwingen, Bann der Keule, primäre Segnungen) und neuere Foundry-V12-Quirks (Token-Delta-Layer, deprecated APIs).
