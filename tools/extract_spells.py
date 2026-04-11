"""
Extrahiert ALLE Zauber aus Liber Cantiones Remastered PDF.
Liest jede Zauber-Seite und parst Probe, Kosten, Dauer, Reichweite, etc.
Output: data/spells.json
"""
import pymupdf
import json
import re
import sys

PDF_PATH = r"E:\Downloads\RPG\DSA\Liber_Cantiones-Remastered.pdf"
OUTPUT_PATH = r"E:\Dev\foundry-modules\dsa-pixel-tokens\data\spells.json"

def extract_spells():
    doc = pymupdf.open(PDF_PATH)
    toc = doc.get_toc()

    # Zauber-Seiten identifizieren (ab Seite 12, TOC Level 2+)
    spell_pages = []
    for i, entry in enumerate(toc):
        level, title, page = entry
        if page < 12:
            continue
        # Skip section headers (single letters like "A", "B", etc.)
        if len(title.strip()) <= 2:
            continue
        # Skip non-spell entries
        if title in ("Liber Cantiones", "Inhalt", "Aventurische Zauberformeln",
                      "Erläuterung der verwendeten Begriffe", "Repräsentationen",
                      "Spontane Modifikation"):
            continue
        # Skip appendix and index sections
        if title.startswith("Anhang") or title.startswith("Weitere Zauber"):
            continue

        next_page = toc[i+1][2] if i+1 < len(toc) else page + 2
        spell_pages.append({
            "title": title.strip(),
            "start": page - 1,  # 0-indexed
            "end": min(next_page - 1, len(doc) - 1),
        })

    print(f"Gefunden: {len(spell_pages)} Zauber-Einträge")

    spells = []
    errors = []

    for sp in spell_pages:
        try:
            # Text aller Seiten des Zaubers sammeln
            text = ""
            for p in range(sp["start"], sp["end"] + 1):
                if p < len(doc):
                    text += doc[p].get_text() + "\n"

            # Rejoin hyphenated line breaks from PDF layout (e.g. "Ver-\nbreitung" -> "Verbreitung")
            text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)

            spell = parse_spell_text(sp["title"], text)
            if spell:
                spells.append(spell)
        except Exception as e:
            errors.append(f"{sp['title']}: {e}")

    print(f"Erfolgreich geparst: {len(spells)} Zauber")
    if errors:
        print(f"Fehler bei {len(errors)} Zaubern:")
        for e in errors[:10]:
            print(f"  - {e}")

    # Ausgabe
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(spells, f, ensure_ascii=False, indent=2)

    print(f"Gespeichert: {OUTPUT_PATH}")
    return spells


def parse_spell_text(title, text):
    """Parst den Volltext einer Zauber-Seite und extrahiert alle relevanten Felder."""
    spell = {"name": clean_title(title)}

    # Probe extrahieren: "Probe: MU / KL / KL" (PDF hat Leerzeichen um die Slashes)
    # Auch Varianten: "Probe: KL / CH / KO (+MR)" oder "(+Mod.)"
    probe_match = re.search(
        r"Probe[:\s]+\(?([A-Z]{2})\s*/\s*([A-Z]{2})\s*/\s*([A-Z]{2})\)?",
        text
    )
    if probe_match:
        spell["probe"] = [probe_match.group(1), probe_match.group(2), probe_match.group(3)]
    else:
        spell["probe"] = []

    # Wirkung: Text zwischen "Wirkung:" und dem nächsten Feld
    spell["wirkung"] = extract_field(text, "Wirkung")

    # AsP-Kosten
    kosten = extract_field(text, "Kosten", "AsP[- ]?Kosten", "Astralkost")
    spell["kosten"] = clean_kosten(kosten)

    # Zauberdauer
    spell["zauberdauer"] = extract_field(text, "Zauberdauer", "Dauer")

    # Reichweite
    spell["reichweite"] = extract_field(text, "Reichweite")

    # Wirkungsdauer
    spell["wirkungsdauer"] = extract_field(text, "Wirkungsdauer", "Wirkdauer")

    # Verbreitung / Repräsentation (PDF: "Repräsentationen und Verbreitung:")
    verbreitung = extract_field(
        text,
        r"Repr\u00e4sentationen und Verbreitung",
        r"Repr\u00e4sentationen",
        "Verbreitung",
        r"Repr\u00e4sentation"
    )
    spell["verbreitung"] = parse_verbreitung(verbreitung)

    # Komplexität / Stufe
    komplex = extract_field(text, u"Komplexit\u00e4t", "Stufe")
    spell["komplexitaet"] = komplex.strip()[:2] if komplex else ""

    # Merkmale (PDF nutzt Plural "Merkmale:")
    spell["merkmal"] = extract_field(text, "Merkmale", "Merkmal")

    return spell


# All known field labels that can appear in spell text (used as stop-words)
FIELD_BOUNDARIES = (
    "Probe:", "Technik:", "Zauberdauer:", "Wirkung:", "Kosten:",
    "Zielobjekt:", "Reichweite:", "Wirkungsdauer:",
    r"Modifikationen\b", r"Varianten?\b",
    "Reversalis:", "Antimagie:",
    "Merkmale:", "Merkmal:",
    r"Komplexit\u00e4t:",
    r"Repr\u00e4sentationen",
    "Verbreitung:",
    "Anmerkung:", "Beispiel:",
    # Variant markers (PDF uses  symbol for variants)
    r"\uf075",
)
# Build a combined boundary pattern
_BOUNDARY_RE = "|".join(rf"(?:{b})" for b in FIELD_BOUNDARIES)


def extract_field(text, *field_names):
    """Extrahiert den Wert eines Feldes aus dem Zauber-Text.

    Field labels in the PDF always appear at the start of a line and are
    followed by a colon. We require the colon to distinguish real field labels
    from the same word appearing in running text (e.g. "Wirkungsdauer" mid-paragraph).
    """
    for name in field_names:
        # Primary: field label at start of line followed by colon
        pattern = rf"^{name}:\s*(.+?)(?=\n\s*(?:{_BOUNDARY_RE})|\Z)"
        match = re.search(pattern, text, re.DOTALL | re.IGNORECASE | re.MULTILINE)
        if match:
            val = match.group(1).strip()
            val = re.sub(r"\s+", " ", val)
            return val[:500]
    # Fallback: field label at start of line, maybe without colon (rare)
    for name in field_names:
        pattern = rf"^{name}\s+(.+?)(?=\n\s*(?:{_BOUNDARY_RE})|\Z)"
        match = re.search(pattern, text, re.DOTALL | re.IGNORECASE | re.MULTILINE)
        if match:
            val = match.group(1).strip()
            val = re.sub(r"\s+", " ", val)
            return val[:500]
    return ""


def clean_title(title):
    """Bereinigt den Zaubernamen."""
    # HTML-Entities decodieren
    title = title.replace("&uuml;", "ü").replace("&ouml;", "ö").replace("&auml;", "ä")
    title = title.replace("&Uuml;", "Ü").replace("&Ouml;", "Ö").replace("&Auml;", "Ä")
    title = title.replace("&szlig;", "ß")
    # Encoding-Artefakte bereinigen
    title = title.replace("�", "ä")  # Common PDF encoding issue
    return title.strip()


def clean_kosten(kosten_str):
    """Extrahiert die Kernkosten aus dem Kosten-String."""
    if not kosten_str:
        return ""
    # Versuche Zahl zu extrahieren
    match = re.search(r"(\d+)\s*(?:AsP|AE|Asp)", kosten_str)
    if match:
        return match.group(1)
    # Variabel
    match2 = re.search(r"(\d+(?:\+|\s*bis\s*\d+))", kosten_str)
    if match2:
        return match2.group(1)
    return kosten_str[:50]


def parse_verbreitung(text):
    """Parst die Verbreitungs-Angabe in eine Liste.

    The PDF format for Verbreitung looks like:
      "Elf, Mag je 6; Hex 3; Dru 2"
      "Ach6, Mag5, Dru(Mag)2"
      "Bor 7; Ach, Mag je 3"
    We use word-boundary-aware regex to avoid false positives.
    """
    if not text:
        return []

    reps = []
    # Use regex with word boundaries to avoid false substring matches
    # Each tuple: (regex_pattern, canonical_name)
    rep_patterns = [
        (r'\bMag\b', "gildenmagisch"),
        (r'\bGilden', "gildenmagisch"),
        (r'\bElf\b', "elfisch"),
        (r'\bHex\b', "hexisch"),
        (r'\bDru\b', "druidisch"),
        (r'\bSch\b', "schelm"),
        (r'\bSchelm', "schelm"),
        (r'\bGeo\b', "geoden"),
        (r'\bGeode', "geoden"),
        (r'\bBor\b', "borbaradianer"),
        (r'\bBorbarad', "borbaradianer"),
        (r'\bAch\b', "kristallomant"),
        (r'\bKristall', "kristallomant"),
        (r'\bScharla', "scharlatanerie"),
        # Seltenere Traditionen
        (r'\bGro\b', "grolme"),
        (r'\bSat\b', "satuarisch"),
        (r'\bKob\b', "koboldisch"),
        (r'\bDurro', "durro-dun"),
        (r'\bFer\b', "ferkina"),
        (r'\bKop\b', "kophtanisch"),
        (r'\bMud\b', "mudramulisch"),
        (r'\bG\u00fcl\b', "gueldenland"),
        (r'\bSrl\b', "sharisad"),
        (r'\bAlh\b', "alhanisch"),
    ]

    for pattern, val in rep_patterns:
        if re.search(pattern, text, re.IGNORECASE) and val not in reps:
            reps.append(val)

    return reps


if __name__ == "__main__":
    spells = extract_spells()
    # Statistik
    with_probe = sum(1 for s in spells if s.get("probe"))
    with_kosten = sum(1 for s in spells if s.get("kosten"))
    print(f"\nStatistik:")
    print(f"  Mit Probe: {with_probe}/{len(spells)}")
    print(f"  Mit Kosten: {with_kosten}/{len(spells)}")
    print(f"  Verbreitungen: {set(r for s in spells for r in s.get('verbreitung', []))}")
