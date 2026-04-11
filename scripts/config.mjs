/**
 * DSA Pixel-Art Tokens — Konfiguration & Datenbanken
 * Enthält alle Konstanten, Effekt-Mappings, und Regel-Referenzen
 */

export const MODULE_ID = "dsa-pixel-tokens";

// ─── DSA 4.1 Eigenschaften ──────────────────────────────────────────────────

export const ATTRIBUTES = {
  MU: { label: "Mut",           short: "MU" },
  KL: { label: "Klugheit",     short: "KL" },
  IN: { label: "Intuition",    short: "IN" },
  CH: { label: "Charisma",     short: "CH" },
  FF: { label: "Fingerfertigkeit", short: "FF" },
  GE: { label: "Gewandtheit",  short: "GE" },
  KO: { label: "Konstitution", short: "KO" },
  KK: { label: "Körperkraft",  short: "KK" },
};

// ─── Abgeleitete Werte — Formeln ────────────────────────────────────────────

export const DERIVED_FORMULAS = {
  ATBasis:  (a) => Math.floor((a.MU + a.GE + a.KK) / 5),
  PABasis:  (a) => Math.floor((a.IN + a.GE + a.KK) / 5),
  FKBasis:  (a) => Math.floor((a.IN + a.FF + a.KK) / 5),
  INIBasis: (a) => Math.floor((a.MU + a.MU + a.IN + a.GE) / 5),
  MR:       (a) => Math.floor((a.MU + a.KL + a.KO) / 5),
  AuP:      (a) => Math.floor((a.MU + a.KO + a.GE) / 2),
  AW:       (a) => Math.floor(Math.floor((a.IN + a.GE + a.KK) / 5) / 2), // PA-Basis / 2
  GS:       ()  => 8, // Standard Mensch
};

// ─── Talentprobe-Zuordnungen ────────────────────────────────────────────────

export const TALENT_CATEGORIES = {
  koerper:       "Körpertalente",
  gesellschaft:  "Gesellschaftstalente",
  natur:         "Naturtalente",
  wissen:        "Wissenstalente",
  handwerk:      "Handwerkstalente",
  sprachen:      "Sprachen & Schriften",
};

// Talente werden aus data/talents.json geladen (Phase 6)
// Format: { name, probe: [attr1, attr2, attr3], category, steigerung: "A"-"H" }

// ─── Kampfmanöver ───────────────────────────────────────────────────────────

export const COMBAT_MANEUVERS = {
  normal:       { label: "Normaler Angriff", atMod: 0,  paMod: 0,  effect: "none" },
  wuchtschlag:  { label: "Wuchtschlag",      atMod: 0,  paMod: -2, effect: "tpBonus",  tpBonus: "ansage", desc: "Ansagewert als AT-Erschwernis und TP-Bonus" },
  finte:        { label: "Finte",            atMod: -4, paMod: 0,  effect: "paReduce", paReduce: "ansage", desc: "Ansagewert als AT-Erschwernis, PA des Gegners um Ansage erschwert" },
  gezielterStich:{ label: "Gezielter Stich", atMod: -4, paMod: 0,  effect: "ignoreRS", rsIgnore: 2, requires: "SF:Gezielter Stich" },
  meisterparade:{ label: "Meisterparade",    atMod: 0,  paMod: 0,  effect: "parryAll", requires: "SF:Meisterparade", desc: "Kann alle Angriffe parieren" },
  ausweichen:   { label: "Ausweichen",       atMod: 0,  paMod: 0,  effect: "dodge",    requires: "SF:Ausweichen", useStat: "AW" },
};

// ─── Fernkampf-Modifikatoren ────────────────────────────────────────────────

export const RANGED_MODIFIERS = {
  nah:      { label: "Nah",       mod: +2  },
  mittel:   { label: "Mittel",    mod:  0  },
  fern:     { label: "Fern",      mod: -2  },
  sehrfern: { label: "Sehr fern", mod: -4  },
};

// ─── Wundschwellen ──────────────────────────────────────────────────────────

export function getWoundThresholds(ko) {
  return {
    ws1: Math.ceil(ko / 2),   // 1 Wunde
    ws2: ko,                   // 2 Wunden
    ws3: Math.ceil(ko * 1.5),  // 3 Wunden
  };
}

export const WOUND_PENALTIES = {
  1: -1,  // 1 Wunde: -1 auf alle Proben
  2: -2,
  3: -3,
  4: -4,  // etc.
};

// ─── Zauber → VFX Effekt-Mapping ────────────────────────────────────────────
// Verknüpft Zaubernamen mit pixel-tokens.mjs EFFECT_PRESETS

export const SPELL_EFFECT_MAP = {
  // Kampfzauber
  "Ignifaxius":       { effect: "flammenpfeil", type: "projectile", impact: "feuerball" },
  "Fulminictus":      { effect: "fulminictus",  type: "target" },
  "Plumbumbarum":     { effect: "blitz",        type: "target" },
  "Horriphobus":      { effect: "horriphobus",  type: "target" },
  "Respondami":       { effect: "respondami",   type: "target" },
  "Motoricus":        { effect: "motoricus",    type: "target" },

  // Projektile
  "Aquafaxius":       { effect: "aquafaxius",   type: "projectile", impact: "wasser" },
  "Donnerkeil":       { effect: "donnerkeil",   type: "projectile", impact: "explosion" },
  "Odem Arcanum":     { effect: "odem",         type: "projectile", impact: "gift" },

  // Auren / Buff
  "Armatrutz":        { effect: "armatrutz",    type: "aura" },
  "Visibili":         { effect: "visibili",     type: "aura" },
  "Attributo":        { effect: "attributo",    type: "aura" },
  "Schattenform":     { effect: "schattenform", type: "aura" },
  "Verwandlung":      { effect: "verwandlung",  type: "aura" },

  // Heilung
  "Balsam Salabunde": { effect: "balsamsal",    type: "target" },
  "Ruhe Körper":      { effect: "heilung",      type: "target" },

  // Zonen / Fläche
  "Invocatio":        { effect: "invocatio",    type: "zone" },
  "Pandemonium":      { effect: "pandemonium",  type: "zone" },
  "Fesselranken":     { effect: "fesselranken", type: "zone" },
  "Planastral":       { effect: "planastral",   type: "zone" },

  // Kontroll
  "Paralysis":        { effect: "paralysis",    type: "aura" },
  "Silentium":        { effect: "silentium",    type: "aura" },
  "Daemonenbann":     { effect: "daemonenbann", type: "zone" },

  // Elementar
  "Brennen":          { effect: "brennen",      type: "aura" },
  "Wind":             { effect: "wind",         type: "zone" },
  "Portal":           { effect: "portal",       type: "zone" },
};

// ─── Probe → Sound-Mapping ──────────────────────────────────────────────────

export const PROBE_SOUNDS = {
  success:   `modules/${MODULE_ID}/assets/sounds/bubble.wav`,
  failure:   null, // kein Sound bei Misserfolg
  critical:  `modules/${MODULE_ID}/assets/sounds/magic1.wav`,
  fumble:    `modules/${MODULE_ID}/assets/sounds/random2.wav`,
  attack:    `modules/${MODULE_ID}/assets/sounds/swing.wav`,
  spell:     `modules/${MODULE_ID}/assets/sounds/spell.wav`,
  heal:      `modules/${MODULE_ID}/assets/sounds/bubble.wav`,
  damage:    `modules/${MODULE_ID}/assets/sounds/random1.wav`,
};

// ─── Spontane Modifikationen (Zauber) ───────────────────────────────────────
// Wird aus WdZ PDF verfeinert, hier Basiswerte

export const SPELL_MODIFICATIONS = {
  reichweite: {
    label: "Reichweite",
    options: [
      { label: "Normal",         probeMod: 0,  aspMult: 1.0 },
      { label: "Verdoppelt",     probeMod: +3, aspMult: 1.5 },
      { label: "Verdreifacht",   probeMod: +6, aspMult: 2.0 },
      { label: "Halbiert",       probeMod: -3, aspMult: 0.75 },
    ],
  },
  zauberdauer: {
    label: "Zauberdauer",
    options: [
      { label: "Normal",         probeMod: 0,  aspMult: 1.0 },
      { label: "Halbiert",       probeMod: +3, aspMult: 1.5 },
      { label: "Verdoppelt",     probeMod: -3, aspMult: 0.75 },
    ],
  },
  wirkungsdauer: {
    label: "Wirkungsdauer",
    options: [
      { label: "Normal",         probeMod: 0,  aspMult: 1.0 },
      { label: "Verdoppelt",     probeMod: +3, aspMult: 1.5 },
      { label: "Verdreifacht",   probeMod: +6, aspMult: 2.0 },
      { label: "Halbiert",       probeMod: -3, aspMult: 0.75 },
    ],
  },
  kosten: {
    label: "AsP-Kosten",
    options: [
      { label: "Normal",         probeMod: 0,  aspMult: 1.0 },
      { label: "-25%",           probeMod: +3, aspMult: 0.75 },
      { label: "-50%",           probeMod: +6, aspMult: 0.50 },
      { label: "+50%",           probeMod: -3, aspMult: 1.5 },
    ],
  },
  erzwingen: {
    label: "Erzwingen",
    options: [
      { label: "Nicht erzwingen", probeMod: 0,  aspMult: 1.0 },
      { label: "Erzwingen (+3)",  probeMod: +3, aspMult: 1.0 },
      { label: "Erzwingen (+6)",  probeMod: +6, aspMult: 1.0 },
    ],
  },
};

// ─── Steigerungstabelle (AP-Kosten) ─────────────────────────────────────────

export const ADVANCEMENT_COSTS = {
  // Spalte → [Kosten pro Stufe 0→1, 1→2, 2→3, ...]
  // Vereinfacht: Spalte bestimmt AP pro TaW-Stufe
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 10,
  G: 15,
  H: 20,
};

// ─── Repräsentationen ───────────────────────────────────────────────────────

export const REPRESENTATIONS = {
  gildenmagisch: { label: "Gildenmagisch",  leitEig: "KL", short: "mag" },
  elfisch:       { label: "Elfisch",        leitEig: "IN", short: "elf" },
  hexisch:       { label: "Hexisch",        leitEig: "CH", short: "hex" },
  druidisch:     { label: "Druidisch",      leitEig: "IN", short: "dru" },
  geoden:        { label: "Geoden",         leitEig: "IN", short: "geo" },
  schelm:        { label: "Schelm",         leitEig: "IN", short: "sch" },
  borbaradianer: { label: "Borbaradianer",  leitEig: "KL", short: "bor" },
  kristallomant: { label: "Kristallomant",  leitEig: "KL", short: "kri" },
  durro_dun:     { label: "Durro-Dûn",      leitEig: "IN", short: "dur" },
};

// ─── Patzer / Glücklich Regeln ───────────────────────────────────────────────

/**
 * Prüft ein 3W20-Ergebnis auf Patzer/Glücklich
 * @param {number[]} dice - Array von 3 Würfelergebnissen
 * @returns {{ patzer: boolean, gluecklich: boolean, confirm: string|null }}
 */
export function checkCritical(dice) {
  const ones   = dice.filter(d => d === 1).length;
  const twenties = dice.filter(d => d === 20).length;

  // Doppel-20 = automatischer Patzer
  if (twenties >= 2) return { patzer: true, gluecklich: false, confirm: null };
  // Doppel-1 = automatisches Gelingen
  if (ones >= 2)     return { patzer: false, gluecklich: true, confirm: null };
  // Einfache 20 → Bestätigungswurf nötig
  if (twenties === 1) return { patzer: false, gluecklich: false, confirm: "patzer" };
  // Einfache 1 → Bestätigungswurf nötig
  if (ones === 1)     return { patzer: false, gluecklich: false, confirm: "gluecklich" };

  return { patzer: false, gluecklich: false, confirm: null };
}

/**
 * Berechnet Talentprobe / Zauberprobe (3W20)
 * @param {number[]} dice     - [d1, d2, d3]
 * @param {number[]} attrs    - [eigenschaft1, eigenschaft2, eigenschaft3]
 * @param {number}   taw      - Talentwert / Zauberfertigkeit
 * @param {number}   modifier - Erschwernis (+) oder Erleichterung (-)
 * @returns {{ success: boolean, tapStar: number, remainder: number, details: object }}
 */
export function resolveProbe(dice, attrs, taw, modifier = 0) {
  const effectiveTaw = taw - modifier;
  let remaining = Math.max(0, effectiveTaw);

  const details = dice.map((d, i) => {
    const attr = attrs[i];
    const over = d - attr;
    if (over > 0) {
      remaining -= over;
      return { die: d, attr, over, consumed: over };
    }
    return { die: d, attr, over: 0, consumed: 0 };
  });

  const success = remaining >= 0;
  const tapStar = success ? Math.max(1, remaining) : 0;

  return { success, tapStar, remainder: remaining, details };
}
