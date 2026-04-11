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

// ─── Spontane Modifikationen (Zauber) — WdZ-konform ────────────────────────
// Modifikationen kosten ZfP (Zauberfertigkeit-Punkte), NICHT Proben-Modifikatoren!
// Gildenmagier: Zuschläge werden HALBIERT (erst aufsummieren, dann halbieren)
// Max gleichzeitige Mods: Leiteigenschaft - 12 (min 1)
// Max ZfP für Mods: ZfW

export const SPELL_MODIFICATIONS = {
  reichweite: {
    label: "Reichweite",
    desc: "Vergrößert oder verkleinert die Zauber-Reichweite um eine Stufe",
    options: [
      { label: "Normal",              zfpCost: 0, extraAkt: 0 },
      { label: "Vergrößern (+1 Stufe)", zfpCost: 5, extraAkt: 1 },
      { label: "Vergrößern (+2 Stufen)", zfpCost: 10, extraAkt: 2 },
      { label: "Verkleinern (-1 Stufe)", zfpCost: 3, extraAkt: 1 },
    ],
  },
  zauberdauer: {
    label: "Zauberdauer",
    desc: "Halbiert oder verdoppelt die Zauberdauer",
    options: [
      { label: "Normal",              zfpCost: 0, extraAkt: 0 },
      { label: "Halbiert",            zfpCost: 5, extraAkt: 0, durationMult: 0.5 },
      { label: "Verdoppelt (Bonus)",   zfpCost: 0, extraAkt: 0, durationMult: 2.0, erleichterung: 3 },
    ],
  },
  wirkungsdauer: {
    label: "Wirkungsdauer",
    desc: "Verlängert oder verkürzt die Wirkungsdauer des Zaubers",
    options: [
      { label: "Normal",              zfpCost: 0, extraAkt: 0 },
      { label: "Verdoppelt",          zfpCost: 7, extraAkt: 1 },
      { label: "Halbiert",            zfpCost: 3, extraAkt: 1 },
      { label: "Aufrechterhaltend → fest", zfpCost: 7, extraAkt: 1 },
    ],
  },
  kosten: {
    label: "AsP einsparen",
    desc: "Reduziert die AsP-Kosten des Zaubers",
    options: [
      { label: "Normal",              zfpCost: 0, extraAkt: 0, aspMult: 1.0 },
      { label: "-10% AsP",            zfpCost: 3, extraAkt: 1, aspMult: 0.9 },
      { label: "-20% AsP",            zfpCost: 6, extraAkt: 2, aspMult: 0.8 },
      { label: "-30% AsP",            zfpCost: 9, extraAkt: 3, aspMult: 0.7 },
      { label: "-40% AsP",            zfpCost: 12, extraAkt: 4, aspMult: 0.6 },
      { label: "-50% AsP",            zfpCost: 15, extraAkt: 5, aspMult: 0.5 },
    ],
  },
  erzwingen: {
    label: "Erzwingen",
    desc: "Erleichtert die Probe durch zusätzliche AsP (Kosten verdoppeln sich pro Stufe!)",
    options: [
      { label: "Nicht erzwingen",      zfpCost: 0, extraAkt: 0, aspExtra: 0 },
      { label: "+1 Erleichterung",     zfpCost: 0, extraAkt: 1, aspExtra: 1,  erleichterung: 1 },
      { label: "+2 Erleichterung",     zfpCost: 0, extraAkt: 2, aspExtra: 3,  erleichterung: 2 },
      { label: "+3 Erleichterung",     zfpCost: 0, extraAkt: 3, aspExtra: 7,  erleichterung: 3 },
      { label: "+4 Erleichterung",     zfpCost: 0, extraAkt: 4, aspExtra: 15, erleichterung: 4 },
      { label: "+5 Erleichterung",     zfpCost: 0, extraAkt: 5, aspExtra: 31, erleichterung: 5 },
    ],
  },
  technik: {
    label: "Veränderte Technik",
    desc: "Weglassen von Zauberkomponenten (Geste, Formel, etc.)",
    options: [
      { label: "Normal",              zfpCost: 0, extraAkt: 0 },
      { label: "1 Komponente fehlt",   zfpCost: 7, extraAkt: 3 },
      { label: "Zentrale Komp. fehlt", zfpCost: 12, extraAkt: 3 },
    ],
  },
};

/**
 * Berechnet die Gesamt-ZfP-Kosten und AsP-Änderungen für gewählte Modifikationen.
 * @param {object} selections - { reichweite: 0, zauberdauer: 1, ... } (Index in options-Array)
 * @param {number} baseAsP - Basis-AsP-Kosten des Zaubers
 * @param {string} rep - Repräsentation ("gildenmagisch", "hexisch", etc.)
 * @returns {{ totalZfP, totalExtraAkt, finalAsP, erleichterung, errors }}
 */
export function calculateModifications(selections, baseAsP, rep = "gildenmagisch") {
  let totalZfP = 0;
  let totalExtraAkt = 0;
  let aspMultiplier = 1.0;
  let aspExtra = 0;
  let erleichterung = 0;

  for (const [modKey, optionIdx] of Object.entries(selections)) {
    const mod = SPELL_MODIFICATIONS[modKey];
    if (!mod) continue;
    const opt = mod.options[optionIdx];
    if (!opt || optionIdx === 0) continue; // 0 = Normal, skip

    totalZfP += opt.zfpCost ?? 0;
    totalExtraAkt += opt.extraAkt ?? 0;
    if (opt.aspMult) aspMultiplier *= opt.aspMult;
    aspExtra += opt.aspExtra ?? 0;
    erleichterung += opt.erleichterung ?? 0;
  }

  // Gildenmagier: ZfP-Kosten halbiert (erst aufsummieren, dann halbieren)
  if (rep === "gildenmagisch") {
    totalZfP = Math.ceil(totalZfP / 2);
  }

  // Druiden: Erzwingen zu halben Kosten
  if (rep === "druidisch") {
    aspExtra = Math.ceil(aspExtra / 2);
  }

  const finalAsP = Math.max(1, Math.round(baseAsP * aspMultiplier) + aspExtra);

  return { totalZfP, totalExtraAkt, finalAsP, erleichterung };
}

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
