#!/usr/bin/env python3
"""
Extracts all weapons, armor, shields, and combat maneuver data from
"DSA 4.1 - Wege des Schwertes.pdf" and writes them to JSON files.

Usage:
    python extract_wds.py
"""

import json
import re
import sys
import fitz  # PyMuPDF

PDF_PATH = r"E:\Downloads\RPG\DSA\DSA 4.1 - Wege des Schwertes.pdf"
WEAPONS_OUT = r"E:\Dev\foundry-modules\dsa-pixel-tokens\data\weapons.json"
ARMOR_OUT = r"E:\Dev\foundry-modules\dsa-pixel-tokens\data\armor.json"

# ---- Talent categories as they appear in the PDF ----
MELEE_TALENT_NAMES = [
    "Anderthalbhänder",
    "Dolche",
    "Fechtwaffen",
    "Hiebwaffen",
    "Infanteriewaffen",
    "Kettenstäbe",
    "Kettenwaffen",
    "Peitsche",
    "Säbel",
    "Schwerter",
    "Speere",
    "Stäbe",
    "Zweihandflegel",
    "Zweihand-Hiebwaffen",
    "Zweihandschwerter/-säbel",
    "Handgemenge-Waffen (Raufen)",
]

# TP regex: matches "1W6+5", "2W6+2", "1W6", "1W6-1", "3W6+5", "1W6+2(A)", "1W6+2 (A)", "1W6+2+"
TP_RE = re.compile(r"^\d+W\d+(?:[+-]\d+)?(?:\+)?(?:\s*\(A\))?$")

# TP/KK regex: matches "11/4", "12/3", "20/1"
TPKK_RE = re.compile(r"^\d+/\d+$")

# WM regex: matches "0/0", "+1/-1", "-2/+3", "0/-1", "-1/+3"
WM_RE = re.compile(r"^[+-]?\d+/[+-]?\d+$")

# DK regex: matches H, N, S, P, HN, NS, HNS, etc.
DK_RE = re.compile(r"^[HNSP]+$")

# Page number regex
PAGENUM_RE = re.compile(r"^\d{2,3}$")

# Preis can be a number, "uvk.", number with "+"
PREIS_RE = re.compile(r"^(?:\d+[+]?|uvk\.?|0,5|\u2013|-)$")


def fix_encoding(s: str) -> str:
    """Fix common encoding artifacts from PDF extraction."""
    return s.replace("\u2013", "-").replace("\u2212", "-").replace("\ufffd", "")


def parse_int(s: str) -> int | None:
    """Parse an integer from string."""
    s = s.strip().rstrip("+")
    s = fix_encoding(s)
    if s in ("", "-", "uvk.", "uvk", "\u2014"):
        return None
    try:
        return int(s)
    except ValueError:
        m = re.search(r"[+-]?\d+", s)
        return int(m.group()) if m else None


def parse_wm(wm_str: str) -> tuple[int, int]:
    """Parse WM string like '0/-1' into (atMod, paMod)."""
    wm_str = fix_encoding(wm_str.strip())
    if "/" not in wm_str:
        return (0, 0)
    parts = wm_str.split("/")
    if len(parts) != 2:
        return (0, 0)
    at_mod = parse_int(parts[0])
    pa_mod = parse_int(parts[1])
    return (at_mod or 0, pa_mod or 0)


def extract_melee_weapons(doc) -> list[dict]:
    """
    Extract melee weapons from pages 124-127 (0-indexed 123-126).

    The PDF text is extracted line-by-line. Each weapon occupies exactly
    11 consecutive lines (after the category header):
      0: Name
      1: TP
      2: TP/KK
      3: Gewicht
      4: Länge
      5: BF
      6: INI
      7: Preis
      8: WM
      9: Bemerkung
     10: DK

    Category headers appear as standalone lines matching known talent names.
    """
    weapons = []
    current_talent = ""

    # Collect all lines from weapon table pages
    all_lines = []
    for page_num in range(123, 127):
        page = doc[page_num]
        text = fix_encoding(page.get_text())
        for line in text.split("\n"):
            stripped = line.strip()
            if stripped:
                all_lines.append(stripped)

    # Filter out known noise lines
    skip_prefixes = [
        "Kampfregeln", "Aventurische Nahkampfwaffen",
        "Typ", "TP", "TP/KK", "Gewicht", "Länge", "BF", "INI", "Preis", "WM", "Bem.", "DK",
        "Anmerkungen", "*)", "**)", "TP:", "BF:", "WM:", "Bem:", "DK:",
        "Gewichtsangabe", "Preis:", "i:", "(i):", "w:", "(w):", "z:", "p:",
    ]

    i = 0
    while i < len(all_lines):
        line = all_lines[i]

        # Skip page numbers
        if PAGENUM_RE.match(line):
            i += 1
            continue

        # Skip noise
        skip = False
        for prefix in skip_prefixes:
            if line.startswith(prefix):
                skip = True
                break
        if skip:
            i += 1
            continue

        # Check for category header
        is_category = False
        for talent_name in MELEE_TALENT_NAMES:
            if line == talent_name:
                current_talent = talent_name
                is_category = True
                break
        if is_category:
            i += 1
            continue

        # Check if this line is a weapon name by looking ahead for TP pattern
        if i + 10 < len(all_lines) and TP_RE.match(all_lines[i + 1]):
            name = line
            tp = all_lines[i + 1]
            tp_kk = all_lines[i + 2]
            gewicht_str = all_lines[i + 3]
            laenge_str = all_lines[i + 4]
            bf_str = all_lines[i + 5]
            ini_str = all_lines[i + 6]
            preis_str = all_lines[i + 7]
            wm_str = all_lines[i + 8]
            bemerkung = all_lines[i + 9]
            dk = all_lines[i + 10]

            # Validate: TP/KK should match pattern
            if not TPKK_RE.match(tp_kk):
                i += 1
                continue

            # Validate DK
            if not DK_RE.match(dk):
                # Sometimes DK is at position 9 and bemerkung is missing
                # or the structure is shifted. Try alternate positions.
                if DK_RE.match(all_lines[i + 9]):
                    dk = all_lines[i + 9]
                    bemerkung = ""
                    wm_str = all_lines[i + 8]
                else:
                    i += 1
                    continue

            # Parse WM
            at_mod, pa_mod = parse_wm(wm_str)

            # Parse TP/KK -> KK-Schwelle
            kk_parts = tp_kk.split("/")
            kk_schwelle = parse_int(kk_parts[0]) if len(kk_parts) == 2 else None

            weapon = {
                "name": name,
                "tp": tp.replace(" ", ""),
                "gewicht": parse_int(gewicht_str),
                "laenge": parse_int(laenge_str),
                "bf": parse_int(bf_str) or 0,
                "atMod": at_mod,
                "paMod": pa_mod,
                "kkSchwelle": kk_schwelle,
                "talent": current_talent,
                "reichweite": dk,
                "typ": "nahkampf",
            }
            weapons.append(weapon)
            i += 11  # Skip past this weapon's data
            continue

        i += 1

    return weapons


def extract_ranged_weapons(doc) -> list[dict]:
    """
    Extract ranged weapons from page 131 (0-indexed 130).

    Ranged weapon lines also come one-field-per-line but the structure is different:
      0: Name (may include ** or *)
      1: TP
      2: Reichweiten (e.g. "2/5/10/20/40")
      3: TP+ modifiers (e.g. "(0/0/0/0/-2)")
      4: Gewicht
      5: Laden
      6: Preis

    Talent headers are lines starting with "Talent "
    """
    weapons = []
    current_talent = ""

    page = doc[130]
    text = fix_encoding(page.get_text())
    all_lines = [line.strip() for line in text.split("\n") if line.strip()]

    # Reichweiten pattern: "2/5/10/20/40"
    RW_RE = re.compile(r"^\d+/\d+/\d+/\d+/\d+$")
    # TP+ pattern: "(0/0/0/0/-2)" or "(-/0/0/0/-1)"
    TPP_RE = re.compile(r"^\([^)]+\)$")
    # Talent header
    TALENT_RE = re.compile(r"^Talent\s+(.+?)(?:\s*\(.*\))?\s*$")

    i = 0
    while i < len(all_lines):
        line = all_lines[i]

        # Skip noise
        if PAGENUM_RE.match(line) or line in ("Kampfregeln", "Aventurische Schuss- und Wurfwaffen", "Bezeichnung"):
            i += 1
            continue

        # Check for talent header
        tm = TALENT_RE.match(line)
        if tm:
            current_talent = tm.group(1).strip()
            if "(" in current_talent:
                current_talent = current_talent.split("(")[0].strip()
            i += 1
            continue

        # Check for "Improvisiert" header
        if line == "Improvisiert":
            current_talent = "Improvisiert"
            i += 1
            continue

        # Look for weapon: Name, then TP, then Reichweiten
        if (i + 5 < len(all_lines) and
                TP_RE.match(all_lines[i + 1]) and
                RW_RE.match(all_lines[i + 2])):

            name = line.rstrip(" *").rstrip("*")
            tp = all_lines[i + 1].replace(" ", "")
            reichweiten = all_lines[i + 2]

            # TP+ should be next
            tp_plus = ""
            offset = 3
            if offset < len(all_lines) - i and TPP_RE.match(all_lines[i + offset]):
                tp_plus = all_lines[i + offset]
                offset += 1

            # Gewicht
            gewicht_str = all_lines[i + offset] if (i + offset) < len(all_lines) else "0"
            offset += 1

            # Laden
            offset += 1

            # Preis
            offset += 1

            # Parse weight - handle "200 + 8" as two separate lines or "30 + 60"
            gewicht = parse_int(gewicht_str.split("+")[0].strip())

            weapon = {
                "name": name,
                "tp": tp,
                "gewicht": gewicht,
                "reichweiten": reichweiten,
                "tpPlus": tp_plus,
                "talent": current_talent,
                "typ": "fernkampf",
            }
            weapons.append(weapon)
            i += offset
            continue

        i += 1

    return weapons


def extract_shields(doc) -> list[dict]:
    """Extract shields and parry weapons from the table on page 133."""
    # Hardcoded from direct PDF text extraction - table is clearly readable
    shield_data = [
        {"name": "Einfacher Holzschild", "typ": "S", "gewicht": 3500, "wm": "-1/+3", "ini": -1, "bf": 3},
        {"name": "Verstärkter Holzschild", "typ": "S", "gewicht": 4000, "wm": "-2/+3", "ini": -1, "bf": 0},
        {"name": "Lederschild", "typ": "S", "gewicht": 2000, "wm": "-1/+3", "ini": 0, "bf": 5},
        {"name": "Mattenschild", "typ": "S", "gewicht": 2500, "wm": "-1/+4", "ini": 0, "bf": 6},
        {"name": "Großer Lederschild", "typ": "S", "gewicht": 3000, "wm": "-1/+4", "ini": -1, "bf": 6},
        {"name": "Thorwalerschild", "typ": "S", "gewicht": 4500, "wm": "-2/+4", "ini": -1, "bf": 3},
        {"name": "Großschild (Reiterschild)", "typ": "S", "gewicht": 5000, "wm": "-2/+5", "ini": -2, "bf": 2},
        {"name": "Turmschild", "typ": "S", "gewicht": 7000, "wm": "-5/+7", "ini": -3, "bf": 1},
        {"name": "Buckler", "typ": "SP", "gewicht": 1000, "wm": "0/+1", "ini": 0, "bf": 0},
        {"name": "Vollmetallbuckler", "typ": "SP", "gewicht": 1500, "wm": "0/+2", "ini": 0, "bf": -2},
        {"name": "Panzerarm", "typ": "SP", "gewicht": 5500, "wm": "-2/+1", "ini": 0, "bf": -2},
        {"name": "Drachenklaue", "typ": "SP", "gewicht": 5000, "wm": "-2/+1", "ini": 0, "bf": 0},
        {"name": "Bock", "typ": "SP", "gewicht": 3000, "wm": "-1/+1", "ini": 0, "bf": 0},
        {"name": "Hakendolch", "typ": "P", "gewicht": 1250, "wm": "-1/+3", "ini": 0, "bf": -2},
        {"name": "Kriegsfächer", "typ": "P", "gewicht": 1250, "wm": "0/+2", "ini": 1, "bf": 3},
        {"name": "Linkhand", "typ": "P", "gewicht": 750, "wm": "0/+2", "ini": 1, "bf": 0},
        {"name": "Langdolch", "typ": "P", "gewicht": 750, "wm": "0/+1", "ini": 0, "bf": 1},
    ]

    shields = []
    for s in shield_data:
        at_mod, pa_mod = parse_wm(s["wm"])
        shields.append({
            "name": s["name"],
            "schildtyp": s["typ"],
            "gewicht": s["gewicht"],
            "atMod": at_mod,
            "paMod": pa_mod,
            "ini": s["ini"],
            "bf": s["bf"],
        })
    return shields


def extract_armor(doc) -> list[dict]:
    """Extract armor from the armor table on pages 137-138."""
    armor_data = [
        # Torsorüstungen
        {"name": "Bronzeharnisch", "rs": 3, "be": 3, "gewicht": 6000},
        {"name": "Brustplatte", "rs": 1, "be": 1, "gewicht": 2000},
        {"name": "Brustschalen", "rs": 1, "be": 0, "gewicht": 500},
        {"name": "Dicke Kleidung", "rs": 1, "be": 1, "gewicht": 3000},
        {"name": "Eisenmantel", "rs": 4, "be": 3, "gewicht": 6000},
        {"name": "Fünflagenharnisch", "rs": 3, "be": 2, "gewicht": 7000},
        {"name": "Garether Platte", "rs": 6, "be": 4, "gewicht": 14000},
        {"name": "Gladiatorenschulter", "rs": 2, "be": 1, "gewicht": 4000},
        {"name": "Iryanrüstung", "rs": 3, "be": 2, "gewicht": 3500},
        {"name": "Kettenhemd", "rs": 3, "be": 3, "gewicht": 6500},
        {"name": "Kettenhemd, langes", "rs": 4, "be": 4, "gewicht": 10000},
        {"name": "Kettenmantel", "rs": 5, "be": 5, "gewicht": 12000},
        {"name": "Kettenweste", "rs": 2, "be": 2, "gewicht": 5000},
        {"name": "Krötenhaut", "rs": 3, "be": 2, "gewicht": 4000},
        {"name": "Kürass", "rs": 3, "be": 2, "gewicht": 4000},
        {"name": "Kusliker Lamellar", "rs": 4, "be": 3, "gewicht": 7500},
        {"name": "Lederharnisch", "rs": 3, "be": 3, "gewicht": 4500},
        {"name": "Leichte Platte", "rs": 4, "be": 3, "gewicht": 7500},
        {"name": "Mammutonpanzer", "rs": 5, "be": 3, "gewicht": 6000},
        {"name": "Maraskanischer Hartholzharnisch", "rs": 4, "be": 2, "gewicht": 7000},
        {"name": "Ringelpanzer", "rs": 4, "be": 3, "gewicht": 7000},
        {"name": "Schuppenpanzer", "rs": 5, "be": 5, "gewicht": 12000},
        {"name": "Spiegelpanzer", "rs": 5, "be": 4, "gewicht": 10000},
        {"name": "Tuchrüstung", "rs": 2, "be": 2, "gewicht": 2500},
        {"name": "Wattierte Unterkleidung", "rs": 1, "be": 1, "gewicht": 2500},
        {"name": "Wattierter Waffenrock", "rs": 2, "be": 2, "gewicht": 3000},
        # Rüstungsergänzungen (Helme, Zeug)
        {"name": "Baburiner Hut", "rs": 2, "be": 1, "gewicht": 3000, "addon": True},
        {"name": "Drachenhelm", "rs": 2, "be": 1, "gewicht": 3000, "addon": True},
        {"name": "Kettenhaube", "rs": 1, "be": 1, "gewicht": 3500, "addon": True},
        {"name": "Kettenzeug", "rs": 1, "be": 1, "gewicht": 12000, "addon": True},
        {"name": "Lederhelm", "rs": 1, "be": 1, "gewicht": 1500, "addon": True},
        {"name": "Lederzeug", "rs": 1, "be": 1, "gewicht": 2000, "addon": True},
        {"name": "Morion", "rs": 2, "be": 1, "gewicht": 4000, "addon": True},
        {"name": "Plattenzeug", "rs": 2, "be": 2, "gewicht": 9500, "addon": True},
        {"name": "Schaller (mit Bart)", "rs": 2, "be": 1, "gewicht": 5000, "addon": True},
        {"name": "Streifenschurz", "rs": 1, "be": 0, "gewicht": 3000, "addon": True},
        {"name": "Sturmhaube", "rs": 2, "be": 1, "gewicht": 3500, "addon": True},
        {"name": "Tellerhelm", "rs": 1, "be": 1, "gewicht": 1500, "addon": True},
        {"name": "Topfhelm", "rs": 2, "be": 2, "gewicht": 4500, "addon": True},
        # Komplettrüstungen
        {"name": "Amazonenrüstung", "rs": 5, "be": 3, "gewicht": 8000, "komplett": True},
        {"name": "Gestechrüstung", "rs": 12, "be": 10, "gewicht": 30000, "komplett": True},
        {"name": "Horasischer Reiterharnisch", "rs": 8, "be": 5, "gewicht": 17000, "komplett": True},
    ]

    result = []
    for a in armor_data:
        entry = {
            "name": a["name"],
            "rs": a["rs"],
            "be": a["be"],
            "gewicht": a["gewicht"],
        }
        if a.get("addon"):
            entry["addon"] = True
        if a.get("komplett"):
            entry["komplett"] = True
        result.append(entry)
    return result


def extract_combat_maneuvers() -> list[dict]:
    """Extract combat maneuver modifiers from appendix tables (pages 198-200)."""
    maneuvers = []

    # Distanzklassen
    maneuvers.append({"kategorie": "Distanzklassen", "name": "Waffe 2+ Kategorien zu kurz", "atMod": None, "paMod": 0, "note": "AT unmoeglich"})
    maneuvers.append({"kategorie": "Distanzklassen", "name": "Waffe 1 Kategorie zu kurz", "atMod": -6, "paMod": 0})
    maneuvers.append({"kategorie": "Distanzklassen", "name": "Waffe 1 Kategorie zu lang", "atMod": -6, "paMod": -6})
    maneuvers.append({"kategorie": "Distanzklassen", "name": "Waffe 2+ Kategorien zu lang", "atMod": None, "paMod": None, "note": "AT und PA unmoeglich"})

    # Sicht
    maneuvers.append({"kategorie": "Sicht", "name": "Mondlicht", "atMod": 3, "paMod": 3})
    maneuvers.append({"kategorie": "Sicht", "name": "Sternenlicht", "atMod": 5, "paMod": 5})
    maneuvers.append({"kategorie": "Sicht", "name": "Vollstaendige Dunkelheit", "atMod": 8, "paMod": 8})
    maneuvers.append({"kategorie": "Sicht", "name": "Gegen Unsichtbare", "atMod": 6, "paMod": 6})

    # Umgebung
    maneuvers.append({"kategorie": "Umgebung", "name": "Knietiefes Wasser", "atMod": 0, "paMod": 2})
    maneuvers.append({"kategorie": "Umgebung", "name": "Huefttiefes Wasser", "atMod": 2, "paMod": 4})
    maneuvers.append({"kategorie": "Umgebung", "name": "Schultertiefes Wasser", "atMod": 4, "paMod": 6})
    maneuvers.append({"kategorie": "Umgebung", "name": "Unter Wasser", "atMod": 6, "paMod": 6})
    maneuvers.append({"kategorie": "Umgebung", "name": "Beengt, lange Schwungwaffe", "atMod": 6, "paMod": 2})
    maneuvers.append({"kategorie": "Umgebung", "name": "Beengt, kurze Schwungwaffe", "atMod": 2, "paMod": 0})
    maneuvers.append({"kategorie": "Umgebung", "name": "Beengt, Stangenwaffe", "atMod": 2, "paMod": 2})

    # Position
    maneuvers.append({"kategorie": "Position", "name": "Gegen am Boden Liegenden", "atMod": -3, "paMod": -5})
    maneuvers.append({"kategorie": "Position", "name": "Aus liegender Position", "atMod": 3, "paMod": 3})
    maneuvers.append({"kategorie": "Position", "name": "Gegen Knienden", "atMod": -1, "paMod": -3})
    maneuvers.append({"kategorie": "Position", "name": "Aus kniender Position", "atMod": 1, "paMod": 1})
    maneuvers.append({"kategorie": "Position", "name": "Gegen fliegende Wesen", "atMod": 2, "paMod": 4})
    maneuvers.append({"kategorie": "Position", "name": "Falsche Hand", "atMod": 9, "paMod": 9})
    maneuvers.append({"kategorie": "Position", "name": "Falsche Hand (SF Linkhand)", "atMod": 6, "paMod": 6})
    maneuvers.append({"kategorie": "Position", "name": "Falsche Hand (Beidhaendiger Kampf I)", "atMod": 3, "paMod": 3})
    maneuvers.append({"kategorie": "Position", "name": "Verteidiger ueberrumpelt", "atMod": -5, "paMod": None, "note": "Keine Parade moeglich"})
    maneuvers.append({"kategorie": "Position", "name": "Verteidiger schlafend/bewusstlos/gefesselt", "atMod": -8, "paMod": None})
    maneuvers.append({"kategorie": "Position", "name": "Ziel vollkommen unbeweglich", "atMod": -10, "paMod": None})
    maneuvers.append({"kategorie": "Position", "name": "Gegner in Ueberzahl", "atMod": 0, "paMod": 1, "note": "+1 PA pro zusaetzlichem Gegner, max +2"})
    maneuvers.append({"kategorie": "Position", "name": "Freunde in Ueberzahl", "atMod": -1, "paMod": 0})

    # Ausweichen
    maneuvers.append({"kategorie": "Ausweichen", "name": "DK Handgemenge", "mod": 4})
    maneuvers.append({"kategorie": "Ausweichen", "name": "DK Nahkampf", "mod": 2})
    maneuvers.append({"kategorie": "Ausweichen", "name": "DK Stangenwaffe", "mod": 1})
    maneuvers.append({"kategorie": "Ausweichen", "name": "DK Pike", "mod": 0})
    maneuvers.append({"kategorie": "Ausweichen", "name": "Gezieltes Ausweichen", "mod": None, "note": "DK-Mod x 2"})
    maneuvers.append({"kategorie": "Ausweichen", "name": "Pro zusaetzlichem Gegner", "mod": 2})
    maneuvers.append({"kategorie": "Ausweichen", "name": "Umstellt (4+ Gegner)", "mod": None, "note": "unmoeglich"})
    maneuvers.append({"kategorie": "Ausweichen", "name": "Behinderung", "mod": None, "note": "+BE"})
    maneuvers.append({"kategorie": "Ausweichen", "name": "SF Ausweichen I", "mod": -3})
    maneuvers.append({"kategorie": "Ausweichen", "name": "SF Ausweichen II", "mod": -6})
    maneuvers.append({"kategorie": "Ausweichen", "name": "SF Ausweichen III", "mod": -9})

    # Trefferzonen (Gezielter Schlag)
    maneuvers.append({"kategorie": "Trefferzonen", "name": "Kopf", "gezielterSchlag": 4, "zufall": "19-20"})
    maneuvers.append({"kategorie": "Trefferzonen", "name": "Brust", "gezielterSchlag": 6, "zufall": "15-18"})
    maneuvers.append({"kategorie": "Trefferzonen", "name": "Schwertarm", "gezielterSchlag": 4, "zufall": "9-14"})
    maneuvers.append({"kategorie": "Trefferzonen", "name": "Schildarm", "gezielterSchlag": 6, "zufall": "9-14"})
    maneuvers.append({"kategorie": "Trefferzonen", "name": "Bauch", "gezielterSchlag": 4, "zufall": "7-8"})
    maneuvers.append({"kategorie": "Trefferzonen", "name": "Beine", "gezielterSchlag": 2, "zufall": "1-6"})

    return maneuvers


def deduplicate_weapons(weapons: list[dict]) -> list[dict]:
    """Remove exact duplicates (same name + talent + tp)."""
    seen = set()
    deduped = []
    for w in weapons:
        key = (w["name"], w.get("talent", ""), w["tp"])
        if key not in seen:
            seen.add(key)
            deduped.append(w)
    return deduped


def main():
    print(f"Opening PDF: {PDF_PATH}")
    doc = fitz.open(PDF_PATH)
    print(f"PDF has {doc.page_count} pages")

    # Extract melee weapons
    print("\n--- Extracting melee weapons ---")
    melee = extract_melee_weapons(doc)
    print(f"  Raw melee entries: {len(melee)}")
    melee = deduplicate_weapons(melee)
    print(f"  After dedup: {len(melee)}")

    # Show talent distribution
    talent_counts = {}
    for w in melee:
        t = w["talent"]
        talent_counts[t] = talent_counts.get(t, 0) + 1
    for t, c in sorted(talent_counts.items()):
        print(f"    {t}: {c}")

    # Extract ranged weapons
    print("\n--- Extracting ranged weapons ---")
    ranged = extract_ranged_weapons(doc)
    ranged = deduplicate_weapons(ranged)
    print(f"  Ranged weapons: {len(ranged)}")

    # Extract shields
    print("\n--- Extracting shields ---")
    shields = extract_shields(doc)
    print(f"  Shields: {len(shields)}")

    # Extract armor
    print("\n--- Extracting armor ---")
    armor_list = extract_armor(doc)
    print(f"  Armor pieces: {len(armor_list)}")

    # Extract combat maneuvers
    print("\n--- Extracting combat maneuvers ---")
    maneuvers = extract_combat_maneuvers()
    print(f"  Combat maneuver entries: {len(maneuvers)}")

    print(f"\n=== TOTALS ===")
    print(f"  Melee weapons: {len(melee)}")
    print(f"  Ranged weapons: {len(ranged)}")
    print(f"  Shields/Parry weapons: {len(shields)}")
    print(f"  Armor pieces: {len(armor_list)}")
    print(f"  Combat maneuvers: {len(maneuvers)}")

    # Build output
    weapons_output = {
        "nahkampfwaffen": melee,
        "fernkampfwaffen": ranged,
        "schilde": shields,
        "kampfmanoever": maneuvers,
    }

    # Write JSON files
    print(f"\nWriting {WEAPONS_OUT}")
    with open(WEAPONS_OUT, "w", encoding="utf-8") as f:
        json.dump(weapons_output, f, ensure_ascii=False, indent=2)

    print(f"Writing {ARMOR_OUT}")
    with open(ARMOR_OUT, "w", encoding="utf-8") as f:
        json.dump(armor_list, f, ensure_ascii=False, indent=2)

    print("\nDone!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
