#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Extrahiert Talente, Vorteile, Nachteile und Sonderfertigkeiten
aus "DSA 4.1 - Wege der Helden.pdf" und speichert sie als JSON.

Struktur des PDFs:
- Talente-Tabelle: Anhang 4, S.315-317 (Tab-getrennte Spalten, Zeile pro Talent)
- Vorteile-Tabelle: S.14-15 (Name\t auf Zeile N, GP auf Zeile N+1)
- Nachteile-Tabelle: S.15-16 (gleiche Struktur, negative GP mit − Zeichen)
- SF-Tabelle: S.17-18 (Name\t auf Zeile N, AP auf Zeile N+1)
- Detail-Beschreibungen: Vorteile S.247-259, Nachteile S.260-275, SF S.276-294
"""

import fitz  # PyMuPDF
import json
import re
import os
import sys

PDF_PATH = r"E:\Downloads\RPG\DSA\DSA 4.1 - Wege der Helden.pdf"
OUTPUT_DIR = r"E:\Dev\foundry-modules\dsa-pixel-tokens\data"


def get_page_lines(doc, page_num_1based):
    """Gibt Zeilen einer Seite zurück (1-basiert)."""
    page = doc[page_num_1based - 1]
    return page.get_text().split("\n")


def get_pages_text(doc, start, end):
    """Gibt kombinierten Text von Seiten zurück (1-basiert, inklusiv)."""
    text = ""
    for i in range(start - 1, end):
        text += doc[i].get_text() + "\n"
    return text


def clean_name(s):
    """Bereinigt einen Namen: entfernt Tabs, Markierungen, Whitespace."""
    s = s.strip().rstrip("\t").strip()
    # Magische Markierungen entfernen: M(Z), M(ZH), M(ZHV), M(V), M(H), etc.
    s = re.sub(r'\s*M\s*\([^)]*\)\s*', ' ', s)
    s = re.sub(r'\s*\(Gabe\)\s*', '', s)
    s = re.sub(r'\s*OR\s*', ' ', s)
    s = re.sub(r'\s*Rituale\s*', ' ', s)
    s = re.sub(r'\s*G\s*$', '', s)
    s = re.sub(r'\s*SE\s*$', '', s)
    s = re.sub(r'\s*\*\s*$', '', s)
    s = re.sub(r'\s*1\)\s*$', '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


# ============================================================
# 1. TALENTE (Anhang 4, Seiten 315-317)
# ============================================================

def extract_talents(doc):
    """Parst die Talent-Tabellen aus dem Anhang.

    Format im PDF: JEDE Tabellenzelle ist eine eigene Zeile!
    Zeile N:   Name \t
    Zeile N+1: (EIG/EIG/EIG) \t
    Zeile N+2: Typ \t
    Zeile N+3: Voraussetzungen \t
    Zeile N+4: eBE \t
    Zeile N+5: ersatzweise verwendbares Talent
    """
    talents = []

    # Eigenschafts-Pattern
    probe_pattern = re.compile(r'^\(([A-Z]{2})/([A-Z]{2})/([A-Z]{2})\)')

    # Kategorien und ihre Steigerungsspalten
    kategorie_map = {
        "KÖRPERLICHE TALENTE": ("koerper", "D"),
        "GESELLSCHAFTLICHE TALENTE": ("gesellschaft", "B"),
        "NATUR-TALENTE": ("natur", "B"),
        "WISSENSTALENTE": ("wissen", "B"),
        "SPRACHEN UND SCHRIFTEN": ("sprachen", "A-C"),
        "HANDWERKSTALENTE": ("handwerk", "B"),
    }

    current_kat = None
    current_steig = None

    for page_num in [316, 317]:
        lines = get_page_lines(doc, page_num)

        i = 0
        while i < len(lines):
            line = lines[i].strip()
            if not line:
                i += 1
                continue

            # Kategorie-Header erkennen
            line_upper = line.upper()
            for header, (kat, steig) in kategorie_map.items():
                if header in line_upper:
                    current_kat = kat
                    current_steig = steig
                    break

            if current_kat is None:
                i += 1
                continue

            # Überschrift-Zeilen überspringen
            if line.startswith("Name") or line.startswith("Eigenschaften"):
                i += 1
                continue

            # Name-Zeile erkennen: endet mit \t und nächste Zeile ist (EIG/EIG/EIG)
            raw_line = lines[i]
            if raw_line.rstrip().endswith("\t") and i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                match = probe_pattern.match(next_line)
                if match:
                    name = line.rstrip("\t").strip()
                    probe = [match.group(1), match.group(2), match.group(3)]

                    if name and len(name) > 1 and name != "Name":
                        talents.append({
                            "name": name,
                            "probe": probe,
                            "kategorie": current_kat,
                            "steigerung": current_steig,
                        })
                    # Skip past all cells of this row (6 cells typically)
                    i += 6
                    continue

            # Auch Pattern: Name auf einer Zeile OHNE \t, Probe auf nächster
            # (kommt bei mehrzeiligen Namen vor z.B. "Sprachen [Muttersprache]")
            if i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                match = probe_pattern.match(next_line)
                if match and not line.startswith("(") and not line.startswith("Name"):
                    name = line.rstrip("\t").strip()
                    probe = [match.group(1), match.group(2), match.group(3)]
                    if name and len(name) > 1:
                        # Prüfe ob Name kein Tabellen-Header / Fußnote ist
                        if not any(x in name.upper() for x in ["TALENTE", "SPALTE", "SCHRIFTEN"]):
                            talents.append({
                                "name": name,
                                "probe": probe,
                                "kategorie": current_kat,
                                "steigerung": current_steig,
                            })
                    i += 6
                    continue

            i += 1

    # Duplikate entfernen
    seen = set()
    unique = []
    for t in talents:
        if t["name"] not in seen:
            seen.add(t["name"])
            unique.append(t)
    return unique


# ============================================================
# 2. VORTEILE (Übersichtstabelle S.14-15)
# ============================================================

def extract_advantages(doc):
    """Parst Vorteile: Zeilen-Paare Name\\t / GP-Wert."""
    advantages = []

    # Sammle alle Zeilen von S.14-15
    all_lines = []
    for p in [14, 15]:
        all_lines.extend(get_page_lines(doc, p))

    # Finde Start der Vorteile-Liste und Ende (= "Nachteile" oder erster negativer GP)
    in_vorteile = False
    i = 0

    while i < len(all_lines):
        line = all_lines[i].strip()

        # Start-Marker: "Vorteile" als eigenständige Zeile
        if line == "Vorteile":
            in_vorteile = True
            i += 1
            continue

        if not in_vorteile:
            i += 1
            continue

        # Nachteile-Sektion beginnt mit negativen GP (−X GP)
        # Aber auf S.15 sind zuerst die restlichen Vorteile, dann "Nachteile"
        if line == "Nachteile":
            break

        # Prüfe ob diese Zeile ein Name ist (endet mit \t oder ist gefolgt von GP-Zeile)
        # Name-Zeilen enden typischerweise mit \t
        raw_line = all_lines[i]

        if raw_line.rstrip().endswith("\t") or "\t" in raw_line:
            name_line = line
            # Nächste Zeile sollte GP-Wert sein
            if i + 1 < len(all_lines):
                gp_line = all_lines[i + 1].strip()

                # Ist es ein negativer GP? Dann ist es ein Nachteil -> Stop
                if re.match(r'^[−–\-]', gp_line) and "GP" in gp_line:
                    break

                # GP-Wert extrahieren
                gp_match = re.search(r'(\d+)\s*GP', gp_line)
                if gp_match:
                    gp_val = int(gp_match.group(1))
                    name = clean_name(name_line)

                    if name and len(name) > 1:
                        advantages.append({
                            "name": name,
                            "gp": gp_val,
                            "voraussetzung": "",
                            "effekt": "",
                        })
                    i += 2
                    continue
            # Fallback: Zeile mit eingebettetem GP (z.B. Begabung für [Merkmal] M(ZH)\t 8 / 12 / 16 GP)
            gp_match = re.search(r'(\d+)\s*(?:/\s*\d+)*\s*GP', name_line)
            if gp_match:
                name_part = name_line[:gp_match.start()].strip()
                name_part = clean_name(name_part)
                gp_val = int(gp_match.group(1))
                if name_part and len(name_part) > 1:
                    advantages.append({
                        "name": name_part,
                        "gp": gp_val,
                        "voraussetzung": "",
                        "effekt": "",
                    })
                i += 1
                continue

        i += 1

    # S.15 hat auch noch Vorteile am Anfang (vor "Nachteile"), die kommen schon durch obige Logik
    # aber einige Vorteile auf S.15 vor dem Nachteile-Header sind noch Vorteile (Schutzgeist etc.)
    # Diese werden korrekt erkannt weil sie positive GP haben

    # Duplikate entfernen
    seen = set()
    unique = []
    for a in advantages:
        if a["name"] not in seen:
            seen.add(a["name"])
            unique.append(a)

    # Detail-Infos aus S.247-259 ergänzen
    detail_text = get_pages_text(doc, 247, 259)
    for adv in unique:
        name_esc = re.escape(adv["name"].split(",")[0].split("[")[0].strip())
        if len(name_esc) < 3:
            continue
        # Suche "Name ... GP): Beschreibung"
        pattern = re.compile(
            name_esc + r'.{0,100}?GP\)?:\s*(.{10,300}?)(?:\.\s)',
            re.DOTALL
        )
        match = pattern.search(detail_text)
        if match:
            effekt = re.sub(r'\s+', ' ', match.group(1)).strip()
            sentences = re.split(r'(?<=[.!])\s', effekt)
            if sentences:
                adv["effekt"] = sentences[0][:200]

    return unique


# ============================================================
# 3. NACHTEILE (Übersichtstabelle S.15-16)
# ============================================================

def extract_disadvantages(doc):
    """Parst Nachteile: Zeilen-Paare mit negativen GP."""
    disadvantages = []

    all_lines = []
    for p in [14, 15, 16]:
        all_lines.extend(get_page_lines(doc, p))

    in_nachteile = False
    i = 0

    while i < len(all_lines):
        line = all_lines[i].strip()
        raw_line = all_lines[i]

        # Suche den Nachteil-Beginn: erstes "−X GP" nach Name\t
        # Alternativ: expliziter "Nachteile" Header
        if not in_nachteile:
            # Auf S.15: Nach den letzten Vorteilen kommt die "Nachteile"-Liste
            # Erster negativer GP-Wert (mit − Zeichen) markiert den Start
            if raw_line.rstrip().endswith("\t") or "\t" in raw_line:
                if i + 1 < len(all_lines):
                    next_line = all_lines[i + 1].strip()
                    if re.match(r'^[−–]', next_line) and "GP" in next_line:
                        in_nachteile = True
                        # Nicht weiter springen, diese Zeile ist der erste Nachteil

            if not in_nachteile:
                i += 1
                continue

        # Stop-Condition: Fußnoten oder "Abkürzungen"
        if "1) mit Ausnahme" in line or "Abkürzungen bedeuten" in line or "benutzten Abk" in line:
            break
        if line.startswith("Die oben benutzten"):
            break

        # Nachteil-Zeile: Name\t gefolgt von −X GP
        if raw_line.rstrip().endswith("\t") or "\t" in raw_line:
            name_line = line

            if i + 1 < len(all_lines):
                gp_line = all_lines[i + 1].strip()

                # GP-Wert extrahieren (mit oder ohne − Zeichen)
                gp_match = re.search(r'[−–\-]?\s*(\d+)\s*GP', gp_line)
                if gp_match:
                    gp_val = int(gp_match.group(1))
                    # Nachteile sind immer negativ
                    if re.search(r'[−–\-]', gp_line):
                        gp_val = -gp_val

                    is_se = "SE" in name_line
                    name = clean_name(name_line)

                    if name and len(name) > 1:
                        disadvantages.append({
                            "name": name,
                            "gp": gp_val,
                            "effekt": "",
                            "stufe": is_se,
                        })
                    i += 2
                    continue
                elif "unterschiedliche" in gp_line or "je nach" in gp_line or "idR" in gp_line:
                    # Variable Kosten
                    is_se = "SE" in name_line
                    name = clean_name(name_line)
                    if name and len(name) > 1:
                        disadvantages.append({
                            "name": name,
                            "gp": 0,
                            "effekt": gp_line,
                            "stufe": is_se,
                        })
                    i += 2
                    continue

            # Eingebetteter GP-Wert in Name-Zeile
            gp_inline = re.search(r'[−–\-]\s*(\d+)\s*(?:/\s*\d+)*\s*GP', name_line)
            if gp_inline:
                name_part = name_line[:gp_inline.start()].strip()
                name_part = clean_name(name_part)
                gp_val = -int(gp_inline.group(1))
                is_se = "SE" in name_line
                if name_part and len(name_part) > 1:
                    disadvantages.append({
                        "name": name_part,
                        "gp": gp_val,
                        "effekt": "",
                        "stufe": is_se,
                    })
                i += 1
                continue

        # Mehrzeilige Namen (z.B. "Begabung Talentgruppen Natur, Gesellschaft,\n   Wissen, Handwerk\t")
        # -> Zeilen ohne \t die Teil eines Multi-Line-Namens sind, überspringen
        i += 1

    # Duplikate entfernen
    seen = set()
    unique = []
    for d in disadvantages:
        if d["name"] not in seen:
            seen.add(d["name"])
            unique.append(d)

    # Detail-Infos aus S.260-275
    detail_text = get_pages_text(doc, 260, 275)
    for dis in unique:
        name_esc = re.escape(dis["name"].split(",")[0].split("[")[0].strip())
        if len(name_esc) < 3:
            continue
        pattern = re.compile(
            name_esc + r'.{0,100}?GP\)?:\s*(.{10,300}?)(?:\.\s)',
            re.DOTALL
        )
        match = pattern.search(detail_text)
        if match:
            effekt = re.sub(r'\s+', ' ', match.group(1)).strip()
            sentences = re.split(r'(?<=[.!])\s', effekt)
            if sentences and not dis["effekt"]:
                dis["effekt"] = sentences[0][:200]

    return unique


# ============================================================
# 4. SONDERFERTIGKEITEN (Übersicht S.17-18)
# ============================================================

def extract_special_abilities(doc):
    """Parst Sonderfertigkeiten: Zeilen-Paare Name\\t / AP-Wert."""
    abilities = []

    # Sammle Zeilen von S.17 und S.18
    all_lines = []
    for p in [17, 18]:
        all_lines.extend(get_page_lines(doc, p))

    current_kat = "kampf"  # S.17 startet mitten in der Kampf-SF-Tabelle
    i = 0

    while i < len(all_lines):
        line = all_lines[i].strip()
        raw_line = all_lines[i]

        # Stop: "Schritt 7"
        if "Schritt 7" in line:
            break

        # Kategorie-Header erkennen
        if line in ["Allgemeine", "Allgemein"]:
            current_kat = "allgemein"
            i += 1
            continue
        elif line == "Kampf":
            current_kat = "kampf"
            i += 1
            continue
        elif line in ["Magische", "Magisch"]:
            current_kat = "magisch"
            i += 1
            continue
        elif line in ["Geweihte", "Geweiht"]:
            current_kat = "geweiht"
            i += 1
            continue

        # SF mit \t: Name\t auf Zeile N, AP auf Zeile N+1
        if "\t" in raw_line:
            name_line = line

            if i + 1 < len(all_lines):
                ap_line = all_lines[i + 1].strip()

                # AP-Wert extrahieren
                ap_match = re.search(r'(\d+)\s*AP', ap_line)
                if ap_match:
                    ap_val = int(ap_match.group(1))
                    name = clean_name(name_line)
                    if name and len(name) > 1 and not name.startswith("Schritt"):
                        abilities.append({
                            "name": name,
                            "ap": ap_val,
                            "voraussetzung": "",
                            "effekt": "",
                            "kategorie": current_kat,
                        })
                    i += 2
                    continue
                elif "je nach" in ap_line:
                    name = clean_name(name_line)
                    if name and len(name) > 1:
                        abilities.append({
                            "name": name,
                            "ap": 0,
                            "voraussetzung": "",
                            "effekt": ap_line,
                            "kategorie": current_kat,
                        })
                    i += 2
                    continue
                elif "nach Spalte" in ap_line or "Spalte" in ap_line:
                    name = clean_name(name_line)
                    if name and len(name) > 1:
                        abilities.append({
                            "name": name,
                            "ap": 0,
                            "voraussetzung": "",
                            "effekt": ap_line,
                            "kategorie": current_kat,
                        })
                    i += 2
                    continue

            # Eingebetteter AP-Wert
            ap_inline = re.search(r'(\d+)\s*AP', name_line)
            if ap_inline:
                name_part = name_line[:ap_inline.start()].strip()
                name_part = clean_name(name_part)
                ap_val = int(ap_inline.group(1))
                if name_part and len(name_part) > 1:
                    abilities.append({
                        "name": name_part,
                        "ap": ap_val,
                        "voraussetzung": "",
                        "effekt": "",
                        "kategorie": current_kat,
                    })
                i += 1
                continue

        i += 1

    # Duplikate entfernen
    seen = set()
    unique = []
    for a in abilities:
        if a["name"] not in seen:
            seen.add(a["name"])
            unique.append(a)

    # Detail-Infos aus S.276-294
    detail_text = get_pages_text(doc, 276, 294)
    for sf in unique:
        name_esc = re.escape(sf["name"].split("[")[0].strip())
        if len(name_esc) < 3:
            continue

        # Voraussetzungen
        pattern = re.compile(
            name_esc + r'.{0,300}?Voraussetzung(?:en)?:\s*(.+?)(?:Verbreitung|Kosten)',
            re.DOTALL
        )
        match = pattern.search(detail_text)
        if match:
            voraus = re.sub(r'\s+', ' ', match.group(1)).strip()
            sf["voraussetzung"] = voraus[:200]

        # Effekt
        if not sf["effekt"]:
            pattern2 = re.compile(
                name_esc + r'[^:]*?:\s*(.{15,300}?)(?:\.\s|Voraussetzung)',
                re.DOTALL
            )
            match2 = pattern2.search(detail_text)
            if match2:
                effekt = re.sub(r'\s+', ' ', match2.group(1)).strip()
                sentences = re.split(r'(?<=[.!])\s', effekt)
                if sentences:
                    sf["effekt"] = sentences[0][:200]

    return unique


# ============================================================
# Hauptprogramm
# ============================================================

def save_json(data, filename):
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  -> {filepath} ({len(data)} Einträge)")


def main():
    if not os.path.exists(PDF_PATH):
        print(f"FEHLER: PDF nicht gefunden: {PDF_PATH}")
        sys.exit(1)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print(f"Öffne PDF: {PDF_PATH}")
    doc = fitz.open(PDF_PATH)
    print(f"  Seiten: {doc.page_count}")

    print("\n[1/4] Extrahiere Talente...")
    talents = extract_talents(doc)
    save_json(talents, "talents.json")

    print("\n[2/4] Extrahiere Vorteile...")
    advantages = extract_advantages(doc)
    save_json(advantages, "advantages.json")

    print("\n[3/4] Extrahiere Nachteile...")
    disadvantages = extract_disadvantages(doc)
    save_json(disadvantages, "disadvantages.json")

    print("\n[4/4] Extrahiere Sonderfertigkeiten...")
    special_abilities = extract_special_abilities(doc)
    save_json(special_abilities, "special-abilities.json")

    doc.close()

    print("\n" + "=" * 50)
    print("ZUSAMMENFASSUNG:")
    print(f"  Talente:              {len(talents)}")
    print(f"  Vorteile:             {len(advantages)}")
    print(f"  Nachteile:            {len(disadvantages)}")
    print(f"  Sonderfertigkeiten:   {len(special_abilities)}")
    print(f"  GESAMT:               {len(talents) + len(advantages) + len(disadvantages) + len(special_abilities)}")
    print("=" * 50)

    # Beispiel-Einträge ausgeben
    print("\nBeispiel-Talente:")
    for t in talents[:3]:
        print(f"  {t}")
    print("\nBeispiel-Vorteile:")
    for a in advantages[:3]:
        print(f"  {a}")
    print("\nBeispiel-Nachteile:")
    for d in disadvantages[:3]:
        print(f"  {d}")
    print("\nBeispiel-Sonderfertigkeiten:")
    for s in special_abilities[:3]:
        print(f"  {s}")


if __name__ == "__main__":
    main()
