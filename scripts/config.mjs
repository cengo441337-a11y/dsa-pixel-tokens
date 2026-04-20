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
  WS:       (a) => Math.floor((a.KO ?? 10) / 2),                         // Wundschwelle = KO/2 (WdH S.46)
  GS:       ()  => 8, // Standard Mensch. Elfen: 9, Zwerge: 6 — Override über Rasse-Flag wenn gesetzt.
};

/** Rassen-spezifische GS-Overrides (DSA 4.1, WdH S.28ff). */
export const RACE_GS = {
  "Mensch": 8, "Thorwaler": 8, "Nivese": 8, "Norbarde": 8, "Maraskaner": 8,
  "Waldelf": 9, "Firnelf": 9, "Auelf": 9, "Halbelf": 9,
  "Zwerg": 6, "Angroschim": 6, "Ambosszwerg": 6, "Hügelzwerg": 6, "Erzzwerg": 6,
  "Orkn": 8, "Ork": 8, "Goblin": 7,
  "Achaz": 7,
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

/**
 * Kampf-Sonderfertigkeiten und Manöver nach WdS.
 *
 * Felder:
 *  label       – Anzeigename
 *  atBase      – fester AT-Abzug (vor Ansage)
 *  ansage      – true wenn Ansage nötig, false/undefined = kein Ansage-Feld
 *  ansageMax   – Funktion (at, taw) → Max-Ansage
 *  effect      – Schlüssel für _applyManeuverEffect in sheet.mjs
 *  desc        – Regeltext-Kurzfassung
 *  requiresSF  – Name der benötigten SF (string), oder null
 *  parryable   – false = Verteidiger darf nicht parieren (Passierschlag)
 *  passierschlagOnFail – true = bei Misserfolg Passierschlag für Verteidiger
 *  paOnly / atOnly – ob nur als PA oder AT einsetzbar
 */
export const COMBAT_MANEUVERS = {

  // ── Angriff ──────────────────────────────────────────────────────────────

  normal: {
    label: "Normaler Angriff",
    atBase: 0, ansage: false,
    effect: "none",
    desc: "Standardangriff ohne Modifikation.",
  },

  wuchtschlag: {
    label: "Wuchtschlag",
    atBase: 0, ansage: true,
    ansageMax: (at, taw) => Math.min(at, taw),
    effect: "tp_bonus",   // TP + halbe Ansage (ohne SF); volle Ansage mit SF
    desc: "AT−Ansage; Treffer: +½Ansage TP (mit SF Wuchtschlag: +Ansage TP). WdS S.66",
    requiresSF: null,     // Wuchtschlag ist ein Basis-Manöver, keine SF nötig
  },

  finte: {
    label: "Finte",
    atBase: 0, ansage: true,
    ansageMax: (at, taw) => Math.min(at, taw),
    effect: "pa_reduce",  // Gegnerische PA−Ansage
    maxBE: 4,
    desc: "AT−Ansage; bei Treffer: PA des Gegners−Ansage für diese Abwehr. WdS S.62",
    requiresSF: null,     // Finte ist Basis-Manöver
  },

  gezielterStich: {
    label: "Gezielter Stich",
    atBase: -4, ansage: false,
    effect: "gezielter_stich", // ignoriert 2 RS, erzeugt auto 1 Wunde
    desc: "AT−4; ignoriert 2 RS; erzeugt automatisch 1 Wunde. SF Finte Voraussetzung. WdS S.62",
    requiresSF: "Gezielter Stich",
  },

  hammerschlag: {
    label: "Hammerschlag",
    atBase: -8, ansage: true,
    ansageMax: (at, taw) => Math.min(at, taw),
    effect: "none",       // nur schwerer Treffer, kein Sonder-TP-Effekt
    allActions: true,     // verbraucht alle Aktionen der KR
    desc: "AT−8−Ansage; verbraucht alle Aktionen der KR. WdS S.63",
    requiresSF: "Hammerschlag",
  },

  niederwerfen: {
    label: "Niederwerfen",
    atBase: -4, ansage: true,
    ansageMax: (at, taw) => Math.min(at, taw),
    effect: "knockdown",  // Gegner muss KK-Probe ablegen
    desc: "AT−4−Ansage; Gegner muss KK-Probe (Erschwernis = Ansage). WdS S.63",
    requiresSF: "Niederwerfen",
  },

  sturmangriff: {
    label: "Sturmangriff",
    atBase: 0, ansage: true,
    ansageMax: (at, taw) => Math.min(at, taw),
    effect: "rush_damage", // TP + ½GS + 4 + Ansage; PA−4 für Gegner
    passierschlagOnFail: true,
    desc: "AT−Ansage; Treffer: TP+½GS+4+Ansage, RS ignoriert; miss → Passierschlag! WdS S.65",
    requiresSF: "Sturmangriff",
  },

  todessto: {
    label: "Todesstoß",
    atBase: -8, ansage: true,
    ansageMax: (at, taw) => Math.min(at, taw),
    effect: "todessto",   // RS ignoriert, WS−2, +2 auto Wunden
    passierschlagOnFail: true,
    desc: "AT−8−½RS−Ansage; RS ignoriert; WS−2; +2 auto Wunden; miss → Passierschlag! WdS S.65",
    requiresSF: "Todesstoß",
  },

  klingensturm: {
    label: "Klingensturm",
    atBase: 2, ansage: false,
    effect: "split_at",   // AT+2, auf 2 Gegner aufteilen
    desc: "AT+2, auf 2 Gegner aufteilen (min. 6 pro Ziel). WdS S.63",
    requiresSF: "Klingensturm",
  },

  // ── Passierschlag (Freie Aktion / Reaktion) ──────────────────────────────

  passierschlag: {
    label: "Passierschlag",
    atBase: -4, ansage: false,
    effect: "passierschlag", // keine Parade möglich, INI−1W6 bei Treffer
    parryable: false,
    desc: "AT−4; Verteidiger darf NICHT parieren; Treffer: TP + INI−1W6. WdS S.85",
    requiresSF: null,
  },

  // ── Abwehr ───────────────────────────────────────────────────────────────

  meisterparade: {
    label: "Meisterparade",
    atBase: 0, ansage: true,
    paOnly: true,
    ansageMax: (pa) => pa,
    effect: "meisterparade", // PA−Ansage; nächste AT/PA +Ansage
    desc: "PA−Ansage; gelingt → nächste Aktion +Ansage. WdS S.76",
    requiresSF: "Meisterparade",
  },

  gegenhalten: {
    label: "Gegenhalten",
    atBase: 0, ansage: false,
    paOnly: true,
    effect: "gegenhalten", // Gegenangriff in feindlichen Angriff hinein
    desc: "Gegenangriff: PA+AT gleichzeitig; AT−4. SF Meisterparade Voraussetzung. WdS S.68",
    requiresSF: "Gegenhalten",
  },

  binden: {
    label: "Binden",
    atBase: 0, ansage: true,
    paOnly: true,
    ansageMax: (pa) => pa,
    effect: "binden", // PA−Ansage; eigene AT +Ansage, gegnerische PA −Ansage
    desc: "PA−Ansage; eigene nächste AT+Ansage, gegnerische PA−Ansage. WdS S.67",
    requiresSF: "Binden",
  },
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
// Verknüpft DSA 4.1 Zaubernamen mit pixel-tokens.mjs EFFECT_PRESETS.
// Abgedeckt: Gildenmagie, Hexen, Elfen, Druiden, Geodenzauber, Segen.
// Unbekannte Zauber → guessSpellEffect() per Keyword-Fallback.

export const SPELL_EFFECT_MAP = {

  // ─── FEUER ────────────────────────────────────────────────────────────────
  "Ignifaxius":            { effect: "flammenpfeil", type: "projectile", impact: "feuerball" },
  "Ignimorpho":            { effect: "feuerball",    type: "target" },
  "Flammenschwert":        { effect: "brennen",      type: "aura" },
  "Flammenwall":           { effect: "brennen",      type: "zone" },
  "Zorn der Salamander":   { effect: "explosion",    type: "zone" },
  "Eldrakonstrukt":        { effect: "feuerball",    type: "target" },
  "Zunder":                { effect: "brennen",      type: "target" },
  "Flammenkörper":         { effect: "brennen",      type: "aura" },
  "Feuersturm":            { effect: "explosion",    type: "zone" },
  "Feuerball":             { effect: "feuerball",    type: "target" },
  "Brennen":               { effect: "brennen",      type: "aura" },

  // ─── KRAFT / TELEKINESE ──────────────────────────────────────────────────
  // Fulminictus = unsichtbare magische Kraftwelle, KEIN Blitz (Liber Cantiones S.91)
  "Fulminictus":           { effect: "motoricus",    type: "projectile" },

  // ─── BLITZ / LUFT ────────────────────────────────────────────────────────
  "Plumbumbarum":          { effect: "blitz",        type: "target" },
  "Donnerkeil":            { effect: "donnerkeil",   type: "projectile", impact: "explosion" },
  "Blitz Dich Find":       { effect: "blitz",        type: "target" },
  "Windgeister rufen":     { effect: "wind",         type: "zone" },
  "Sturm der See":         { effect: "wind",         type: "zone" },
  "Wind":                  { effect: "wind",         type: "zone" },
  "Orcanofaxius":          { effect: "explosion",    type: "zone" },
  "Sturmwind":             { effect: "wind",         type: "zone" },
  "Blitzstrahl":           { effect: "blitz",        type: "projectile", impact: "explosion" },

  // ─── EIS / WASSER ────────────────────────────────────────────────────────
  "Aquafaxius":            { effect: "aquafaxius",   type: "projectile", impact: "wasser" },
  "Kältestrom":            { effect: "aquafaxius",   type: "projectile", impact: "eis" },
  "Vereisungsfluch":       { effect: "eis",          type: "target" },
  "Eissturm":              { effect: "eis",          type: "zone" },
  "Blizzard":              { effect: "eis",          type: "zone" },
  "Wellengang":            { effect: "wasser",       type: "zone" },
  "Meeresboden":           { effect: "wasser",       type: "zone" },
  "Wasserball":            { effect: "wasser",       type: "target" },
  "Gefrierbrand":          { effect: "eis",          type: "target" },
  "Eismantel":             { effect: "eis",          type: "aura" },

  // ─── SCHATTEN / DUNKEL ───────────────────────────────────────────────────
  "Auge des Limbus":       { effect: "schatten",     type: "target" },
  "Dunkelheit":            { effect: "schatten",     type: "zone" },
  "Finsternis":            { effect: "schatten",     type: "zone" },
  "Seelenraub":            { effect: "schatten",     type: "target" },
  "Schattengriff":         { effect: "schatten",     type: "target" },
  "Schleier des Vergessens":{ effect: "schattenform",type: "aura" },
  "Nachtauge":             { effect: "schatten",     type: "aura" },
  "Schattenform":          { effect: "schattenform", type: "aura" },
  "Düsteres Mal":          { effect: "schatten",     type: "target" },

  // ─── GIFT / FLUCH ────────────────────────────────────────────────────────
  "Odem Arcanum":          { effect: "odem",         type: "projectile", impact: "gift" },
  "Gift der Natter":       { effect: "gift",         type: "target" },
  "Gärender Fluch":        { effect: "gift",         type: "target" },
  "Eisenrost":             { effect: "gift",         type: "target" },
  "Schlechtes Omen":       { effect: "gift",         type: "target" },
  "Dumpfer Schmerz":       { effect: "horriphobus",  type: "target" },
  "Böses Auge":            { effect: "horriphobus",  type: "target" },
  "Siecher Leib":          { effect: "gift",         type: "target" },
  "Pest der Geister":      { effect: "gift",         type: "target" },

  // ─── ANGST / KONTROLLE ───────────────────────────────────────────────────
  "Horriphobus":           { effect: "horriphobus",  type: "target" },
  "Sanftmut":              { effect: "respondami",   type: "target" },
  "Respondami":            { effect: "respondami",   type: "target" },
  "Motoricus":             { effect: "motoricus",    type: "target" },
  "Somnigravis":           { effect: "paralysis",    type: "target" },
  "Böser Blick":           { effect: "horriphobus",  type: "target" },
  "Guttural":              { effect: "horriphobus",  type: "target" },
  "Zwingtanz":             { effect: "motoricus",    type: "target" },
  "Puppettenspiel":        { effect: "motoricus",    type: "target" },
  "Geistesgestört":        { effect: "horriphobus",  type: "target" },
  "Verwirrung":            { effect: "horriphobus",  type: "target" },
  "Paralysis":             { effect: "paralysis",    type: "aura" },
  "Bannbaladin":           { effect: "daemonenbann", type: "target" },
  "Beherrschung brechen":  { effect: "daemonenbann", type: "target" },
  "Geistes Bann":          { effect: "daemonenbann", type: "target" },
  "Nekrophobie":           { effect: "horriphobus",  type: "target" },
  "Hexenblick":            { effect: "horriphobus",  type: "target" },
  "Krähenruf":             { effect: "respondami",   type: "target" },
  "Tierbeherrschung":      { effect: "respondami",   type: "target" },

  // ─── HEILUNG / BUFF ──────────────────────────────────────────────────────
  "Balsam Salabunde":      { effect: "balsamsal",    type: "target" },
  "Ruhe Körper":           { effect: "heilung",      type: "target" },
  "Klarum Purum":          { effect: "heilung",      type: "target" },
  "Armatrutz":             { effect: "armatrutz",    type: "aura" },
  "Attributo":             { effect: "attributo",    type: "aura" },
  "Gardianum":             { effect: "armatrutz",    type: "aura" },
  "Krötenhaut":            { effect: "armatrutz",    type: "aura" },
  "Adlerauge":             { effect: "attributo",    type: "aura" },
  "Luchsenohr":            { effect: "attributo",    type: "aura" },
  "Adlerauge Luchsenohr":  { effect: "attributo",    type: "aura" },
  "Unitatio Gremii":       { effect: "attributo",    type: "aura" },
  "Verständigung":         { effect: "attributo",    type: "aura" },
  "Körper glätten":        { effect: "armatrutz",    type: "aura" },
  "Blick des Phex":        { effect: "attributo",    type: "target" },
  "Analüs":                { effect: "visibili",     type: "target" },
  "Blick aufs Wesen":      { effect: "visibili",     type: "target" },
  "Hellsicht":             { effect: "attributo",    type: "target" },
  "Licht":                 { effect: "heilung",      type: "target" },
  "Favilludo":             { effect: "heilung",      type: "zone" },
  "Fulminictus Ignatius":  { effect: "attributo",    type: "aura" },
  "Herrschaft der Elemente":{ effect: "attributo",   type: "aura" },
  "Motoricus (WdZ)":       { effect: "motoricus",    type: "target" },

  // ─── ILLUSION / TÄUSCHUNG ────────────────────────────────────────────────
  "Visibili":              { effect: "visibili",     type: "aura" },
  "Blendwerk":             { effect: "visibili",     type: "target" },
  "Duplicatus":            { effect: "visibili",     type: "aura" },
  "Flim Flam Funkel":      { effect: "visibili",     type: "target" },
  "Nebelwand":             { effect: "wind",         type: "zone" },
  "Zauberspiegel":         { effect: "armatrutz",    type: "aura" },
  "Illusionen":            { effect: "visibili",     type: "target" },
  "Große Illusionen":      { effect: "visibili",     type: "zone" },

  // ─── STILLE / ZEIT ───────────────────────────────────────────────────────
  "Silentium":             { effect: "silentium",    type: "aura" },
  "Tempus Stasis":         { effect: "silentium",    type: "target" },
  "Zauberschloß":          { effect: "silentium",    type: "aura" },

  // ─── TELEPORTATION / RAUM ────────────────────────────────────────────────
  "Portal":                { effect: "portal",       type: "zone" },
  "Transversalis":         { effect: "portal",       type: "target" },
  "Foramen":               { effect: "portal",       type: "zone" },
  "Objektreise":           { effect: "portal",       type: "target" },
  "Hexensprung":           { effect: "portal",       type: "aura" },
  "Pentagramma":           { effect: "planastral",   type: "zone" },
  "Sphärenklopfen":        { effect: "planastral",   type: "zone" },
  "Planastral":            { effect: "planastral",   type: "zone" },

  // ─── BESCHWÖRUNG / BANN ──────────────────────────────────────────────────
  "Invocatio":             { effect: "invocatio",    type: "zone" },
  "Daemonenbann":          { effect: "daemonenbann", type: "zone" },
  "Geister bannen":        { effect: "daemonenbann", type: "target" },
  "Manifesto":             { effect: "invocatio",    type: "zone" },
  "Monstrum mortis":       { effect: "invocatio",    type: "target" },
  "Reversalis":            { effect: "schadenflash", type: "target" },
  "Desintegration":        { effect: "explosion",    type: "target" },
  "Zorn Gottes":           { effect: "explosion",    type: "target" },

  // ─── DSCHINN-BESCHWÖRUNG ─────────────────────────────────────────────────
  "Invocatio Maximus":         { effect: "planastral",   type: "zone" },
  "Dschinnenruf":              { effect: "invocatio",    type: "zone" },
  "Feuer rufen":               { effect: "feuerball",    type: "zone" },
  "Wasser rufen":              { effect: "wasser",       type: "zone" },
  "Luft rufen":                { effect: "wind",         type: "zone" },
  "Erde rufen":                { effect: "explosion",    type: "zone" },
  "Elementar herbeirufen":     { effect: "invocatio",    type: "zone" },
  "Elementargeister rufen":    { effect: "invocatio",    type: "zone" },
  "Salamander rufen":          { effect: "brennen",      type: "zone" },
  "Undine rufen":              { effect: "wasser",       type: "zone" },
  "Sylphe rufen":              { effect: "wind",         type: "zone" },
  "Gnome rufen":               { effect: "fesselranken", type: "zone" },

  // ─── NATUR / BINDUNG ─────────────────────────────────────────────────────
  "Fesselranken":          { effect: "fesselranken", type: "zone" },
  "Spinnennetz":           { effect: "fesselranken", type: "target" },
  "Pflanzenruf":           { effect: "fesselranken", type: "aura" },

  // ─── VERWANDLUNG ─────────────────────────────────────────────────────────
  "Verwandlung":           { effect: "verwandlung",  type: "aura" },
  "Tier werden":           { effect: "verwandlung",  type: "aura" },
  "Körper formen":         { effect: "verwandlung",  type: "aura" },

  // ─── CHAOS / PANDÄMONIUM ─────────────────────────────────────────────────
  "Pandemonium":           { effect: "pandemonium",  type: "zone" },
  "Chaosfeld":             { effect: "pandemonium",  type: "zone" },

  // ─── GEODENZAUBER (Erd/Stein) ────────────────────────────────────────────
  "Steinwand":             { effect: "explosion",    type: "zone" },
  "Erdbeben":              { effect: "explosion",    type: "zone" },
  "Gesteinsform":          { effect: "verwandlung",  type: "target" },
  "Lavastrom":             { effect: "feuerball",    type: "zone" },

  // ─── ELFENZAUBER ─────────────────────────────────────────────────────────
  "Eins mit der Natur":    { effect: "heilung",      type: "aura" },
  "Tierfreund":            { effect: "respondami",   type: "target" },
  "Naturverbundenheit":    { effect: "attributo",    type: "aura" },
  "Elfenlied":             { effect: "attributo",    type: "zone" },

  // ─── HEXENZAUBER ─────────────────────────────────────────────────────────
  "Hexenauge":             { effect: "horriphobus",  type: "target" },
  "Böser Blick (Hexe)":    { effect: "horriphobus",  type: "target" },
  "Sieche":                { effect: "gift",         type: "target" },
  "Alptraum":              { effect: "horriphobus",  type: "target" },
  "Versteinern":           { effect: "paralysis",    type: "target" },
  "Verhexen":              { effect: "gift",         type: "target" },

  // ─── PFEIL-VERZAUBERUNGEN ────────────────────────────────────────────────
  "Pfeil des Feuers":      { enchantArrow: true, effect: "pfeil_feuer",  impact: "feuerball",   label: "Feuerpfeil",     color: "#ff6600" },
  "Pfeil des Eises":       { enchantArrow: true, effect: "pfeil_eis",    impact: "eis",         label: "Eispfeil",       color: "#88ccff" },
  "Pfeil des Erzes":       { enchantArrow: true, effect: "pfeil_erz",    impact: "schadenflash",label: "Erzpfeil",       color: "#aa8844" },
  "Pfeil des Blitzes":     { enchantArrow: true, effect: "pfeil_feuer",  impact: "blitz",       label: "Blitzpfeil",     color: "#ffff44" },
  "Pfeil der Luft":        { enchantArrow: true, effect: "pfeil_luft",   impact: "wind",        label: "Luftpfeil",      color: "#aaeeff" },
  "Pfeil des Humus":       { enchantArrow: true, effect: "pfeil_humus",  impact: "gift",        label: "Humuspfeil",     color: "#88aa44" },
  "Pfeil des Giftes":      { enchantArrow: true, effect: "pfeil_humus",  impact: "gift",        label: "Giftpfeil",      color: "#44cc44" },
  "Pfeil des Wassers":     { enchantArrow: true, effect: "pfeil_wasser", impact: "wasser",      label: "Wasserpfeil",    color: "#4488ff" },
  "Pfeil der Dunkelheit":  { enchantArrow: true, effect: "schattenball", impact: "schatten",    label: "Schattenpfeil",  color: "#8844cc" },
  "Pfeil des (Elements)":  { enchantArrow: true, effect: "pfeil_feuer",  impact: "feuerball",   label: "Elementarpfeil", color: "#ff8800" },
};

// ─── Keyword-Fallback für unbekannte Zauber ──────────────────────────────────
// Wenn ein Zaubername nicht in SPELL_EFFECT_MAP steht, versucht diese Funktion
// anhand von Schlüsselwörtern im Namen einen passenden Effekt zu raten.

export function guessSpellEffect(spellName) {
  const s = spellName.toLowerCase();

  // Feuer
  if (/feuer|flamm|igni|brand|glut|infern|pyro|zund/.test(s))
    return { effect: "feuerball",    type: "target" };
  // Eis / Frost
  if (/eis|frost|kält|gefrior|blizzard|cryo/.test(s))
    return { effect: "eis",          type: "target" };
  // Blitz / Luft
  if (/blitz|donner|sturm|wind|fulmin|orcan|luft|elektr/.test(s))
    return { effect: "blitz",        type: "target" };
  // Wasser
  if (/wasser|aqua|meer|welle|regen|flut/.test(s))
    return { effect: "wasser",       type: "target" };
  // Gift / Fluch
  if (/gift|fluch|pest|sieche|vergift|nekro|tod|leichen/.test(s))
    return { effect: "gift",         type: "target" };
  // Schatten / Dunkel
  if (/schatten|dunkel|finster|nacht|limbus|seelen|dämon/.test(s))
    return { effect: "schatten",     type: "target" };
  // Heilung / Licht
  if (/heil|balsam|ruhe|licht|segn|klaru|gesund|regenerat/.test(s))
    return { effect: "heilung",      type: "target" };
  // Schutz / Panzer
  if (/schutz|armatur|panz|gardia|schild|kröten|körper glät/.test(s))
    return { effect: "armatrutz",    type: "aura" };
  // Buff / Stärken
  if (/attribut|stärk|buff|adler|luchsen|einheit|verständ|herrschaft/.test(s))
    return { effect: "attributo",    type: "aura" };
  // Unsichtbar / Illusion
  if (/unsicht|visibil|illusion|blendwerk|duplic|nebelwand|flim/.test(s))
    return { effect: "visibili",     type: "aura" };
  // Kontrolle / Angst
  if (/horri|schreck|angst|furcht|böser blick|panik|verwirrung|guttural/.test(s))
    return { effect: "horriphobus",  type: "target" };
  // Schlaf / Lähmung
  if (/schlaf|somni|paralys|lähmung|versteinern|stasis/.test(s))
    return { effect: "paralysis",    type: "target" };
  // Stille / Zeit
  if (/silenti|stille|schloß|schloss|stumm/.test(s))
    return { effect: "silentium",    type: "aura" };
  // Teleport / Raum
  if (/portal|transvers|foramen|hexensprung|teleport|reise/.test(s))
    return { effect: "portal",       type: "zone" };
  // Beschwörung
  if (/invoc|beschwör|manifest|monstrum|ruf/.test(s))
    return { effect: "invocatio",    type: "zone" };
  // Bannen
  if (/bann|daemon|geister|teufel/.test(s))
    return { effect: "daemonenbann", type: "target" };
  // Bewegung
  if (/motoric|puppet|zwingtanz|telekinese/.test(s))
    return { effect: "motoricus",    type: "target" };
  // Verwandlung
  if (/verwandl|transform|tier werden|körper formen/.test(s))
    return { effect: "verwandlung",  type: "aura" };
  // Pflanzen / Bindung
  if (/ranken|fesselranken|spinnen|pflanzen/.test(s))
    return { effect: "fesselranken", type: "zone" };
  // Astral / Sphären
  if (/planastral|sphären|astral|pentagramm/.test(s))
    return { effect: "planastral",   type: "zone" };
  // Chaos
  if (/pandemon|chaos|chaos/.test(s))
    return { effect: "pandemonium",  type: "zone" };

  // Letzter Fallback: allgemeiner Magie-Flash
  return { effect: "schadenflash",   type: "target" };
}

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
      { label: "Normal",                  zfpCost: 0,  extraAkt: 0 },
      { label: "Vergrößern (+1 Stufe)",   zfpCost: 5,  extraAkt: 1, reichweiteSteps: 1 },
      { label: "Vergrößern (+2 Stufen)",  zfpCost: 10, extraAkt: 2, reichweiteSteps: 2 },
      { label: "Verkleinern (-1 Stufe)",  zfpCost: 3,  extraAkt: 1 },
    ],
  },
  zauberdauer: {
    label: "Zauberdauer",
    desc: "Halbiert oder verdoppelt die Zauberdauer",
    options: [
      { label: "Normal",              zfpCost: 0, extraAkt: 0 },
      { label: "Halbiert",            zfpCost: 5, extraAkt: 0, durationMult: 0.5 },
      { label: "Verdoppelt",  zfpCost: 0, extraAkt: 0, durationMult: 2.0, erleichterung: 3, zdVerdoppelt: true },
    ],
  },
  wirkungsdauer: {
    label: "Wirkungsdauer",
    desc: "Verlängert oder verkürzt die Wirkungsdauer des Zaubers",
    options: [
      { label: "Normal",                   zfpCost: 0, extraAkt: 0 },
      { label: "Verdoppelt",               zfpCost: 7, extraAkt: 1, wdVerdoppelt: true },
      { label: "Halbiert",                 zfpCost: 3, extraAkt: 1 },
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
 * @param {object} extraFlags - { borMitGildenmagisch: bool }
 * @returns {{ totalZfP, totalExtraAkt, finalAsP, erleichterung }}
 */
export function calculateModifications(selections, baseAsP, rep = "gildenmagisch", extraFlags = {}) {
  const { borMitGildenmagisch = false } = extraFlags;
  const zfpHalbiert = rep === "gildenmagisch" || borMitGildenmagisch;

  let totalZfP = 0;
  let totalExtraAkt = 0;
  let aspMultiplier = 1.0;
  let aspExtra = 0;
  let erleichterung = 0;

  for (const [modKey, optionIdx] of Object.entries(selections)) {
    const mod = SPELL_MODIFICATIONS[modKey];
    if (!mod) continue;
    const opt = mod.options[optionIdx];
    if (!opt || optionIdx === 0) continue;

    let zfpCost = opt.zfpCost ?? 0;

    // Elfisch: WD-Verdoppeln kostet nur 4 ZfP statt 7 (WdZ S.322)
    if (rep === "elfisch" && modKey === "wirkungsdauer" && opt.wdVerdoppelt) {
      zfpCost = 4;
    }

    // Borbaradianisch: Reichweite vergrößern kostet 7 ZfP/Stufe statt 5 (WdZ S.23)
    if (rep === "borbaradianisch" && opt.reichweiteSteps) {
      zfpCost = opt.reichweiteSteps * 7;
    }

    // Kristallomantisch: alle ZfP-Kosten verdoppelt (ohne passende Kristalle, WdZ S.324)
    if (rep === "kristallomant" && zfpCost > 0) {
      zfpCost = zfpCost * 2;
    }

    totalZfP += zfpCost;
    totalExtraAkt += opt.extraAkt ?? 0;
    if (opt.aspMult) aspMultiplier *= opt.aspMult;
    if (modKey === "erzwingen") {
      // Druiden: Erzwingen immer möglich, halbe AsP-Kosten (WdZ S.319)
      const rawExtra = opt.aspExtra ?? 0;
      aspExtra += rep === "druidisch" ? Math.ceil(rawExtra / 2) : rawExtra;
    } else {
      aspExtra += opt.aspExtra ?? 0;
    }
    let erl = opt.erleichterung ?? 0;

    // Gildenmagier (inkl. Borbaradianer mit Gildenmagisch): ZD-Verdoppeln Bonus +1 (WdZ S.260)
    if (opt.zdVerdoppelt && zfpHalbiert) erl += 1;

    erleichterung += erl;
  }

  // Gildenmagier (inkl. Borbaradianer mit Gildenmagisch): alle ZfP-Zuschläge halbiert (WdZ S.260)
  if (zfpHalbiert && totalZfP > 0) {
    totalZfP = Math.ceil(totalZfP / 2);
  }

  // Kristallomantisch: Basis-AsP nur 3/4 (WdZ S.324)
  const effectiveBase = rep === "kristallomant" ? Math.max(1, Math.ceil(baseAsP * 0.75)) : baseAsP;
  const finalAsP = Math.max(1, Math.round(effectiveBase * aspMultiplier) + aspExtra);

  return { totalZfP, totalExtraAkt, finalAsP, erleichterung };
}

// ─── AsP-Pfad-Resolver (gdsa / dnd5e / pf2e) ────────────────────────────────

/**
 * Finds the current AsP value and update path for any supported system.
 * Returns { path: string, val: number } or null if no AsP field found.
 */
export function resolveActorAsP(actor) {
  const s = actor?.system;
  if (!s) return null;
  // gdsa 5e primary
  if (s.AsP?.value !== undefined)                   return { path: "system.AsP.value",                   val: s.AsP.value };
  // gdsa 5e alternate (German astralenergie)
  if (s.status?.astralenergie?.value !== undefined) return { path: "system.status.astralenergie.value",  val: s.status.astralenergie.value };
  if (s.base?.astralenergie?.value !== undefined)   return { path: "system.base.astralenergie.value",    val: s.base.astralenergie.value };
  // flat status value (some gdsa versions)
  if (s.status?.AsP !== undefined)                  return { path: "system.status.AsP",                  val: s.status.AsP };
  if (s.base?.AsP !== undefined)                    return { path: "system.base.AsP",                    val: s.base.AsP };
  // generic fallbacks
  if (s.mana?.value !== undefined)                  return { path: "system.mana.value",                  val: s.mana.value };
  if (s.attributes?.mana?.value !== undefined)      return { path: "system.attributes.mana.value",       val: s.attributes.mana.value };
  return null;
}

// ─── Spell-Lookup mit Varianten-Unterstützung ────────────────────────────────

/**
 * Maps element keywords found in a variant name to specific VFX overrides.
 * e.g. "Fulminictus (Feuer)" → variant "feuer" → fire projectile
 */
function _elementFromVariant(v) {
  if (/feuer|flamm|glut|brand|infern|pyro/.test(v))  return { effect: "feuerball",  type: "projectile", impact: "feuerball" };
  if (/eis|frost|kält|gefrior/.test(v))               return { effect: "eis",        type: "projectile" };
  if (/blitz|donner|elektr/.test(v))                  return { effect: "blitz",      type: "projectile" };
  if (/wasser|aqua|regen|meer/.test(v))               return { effect: "aquafaxius", type: "projectile" };
  if (/gift|säure|seuche|nekro/.test(v))              return { effect: "gift",       type: "target" };
  if (/schatten|dunkel|finster|limbus/.test(v))       return { effect: "schatten",   type: "target" };
  if (/licht|heilig|divino|lebe/.test(v))             return { effect: "heilung",    type: "target" };
  return null;
}

// ─── Zauber-Schadensformeln ─────────────────────────────────────────────────
// Fuer Zauber mit Merkmal "Schaden" — wird nach erfolgreicher Probe automatisch
// auf das markierte Ziel angewendet.
//
// In DSA 4.1 gilt meistens: Spieler waehlt Wuerfel/AsP-Einsatz → wuerfeln →
// TP = Wurf → AsP-Kosten = TP. Also ERST wuerfeln, DANN bezahlen.
//
// Formel-Typen (damageType):
//   "chooseDice"   - Spieler waehlt N Wuerfel (max. maxDice, default ZfW), rollt NxW6,
//                    TP = Summe. AsP = TP (IGNIFAXIUS-Stil)
//   "fixedRoll"    - Feste Wuerfelformel (z.B. "1W6+4"), AsP aus kosten-Feld (FULMINICTUS)
//   "aspDirect"    - Spieler zahlt X AsP, jede AsP = 1 TP (KULMINATIO)
//   "aspDice"      - Pro 4 AsP: 1W6 TP. Spieler waehlt AsP-Einsatz (IGNISPHAERO)
//   "aspPerDice"   - Spieler waehlt Wuerfel, pro Wuerfel N AsP, gewuerfelt W6
//   "manual"       - TP und AsP manuell eingeben (CORPOFESSO, HOELLENPEIN)
//
// Weitere Felder:
//   element     - Feuer/Eis/Blitz/Wasser/Humus/Erz/Luft/Geist/Saeure (fuer Immunitaet)
//   ignoresRS   - RS wird ignoriert (ja/nein)
//   maxDice     - Max. Wuerfelzahl (bei chooseDice), "zfw" = ZfW des Zauberers
//   diceSize    - W-Groesse (default 6)
//   aspPerDie   - AsP-Kosten pro Wuerfel (default: = TP-Summe)
//   onlyLeP     - Nur LeP-Schaden (keine Wunden, kein WS-Check)
//   onlyAuP     - AuP-Schaden statt LeP (Betaeubung)
//   ignoreZones - Keine Trefferzone (Flaechenschaden)
//   needsTarget - Braucht markiertes Ziel (default true)
// damageType-Typen (alle Werte aus Liber Cantiones Remastered extrahiert):
//   "chooseDice"        - Spieler waehlt N Wuerfel (max ZfW), rollt NxW6, TP=Summe, AsP=TP
//                         (IGNIFAXIUS, FRIGIFAXIUS, AQUAFAXIUS, ARCHOFAXIUS)
//   "fixedPlusZfpStar"  - Feste Formel + ZfP* (aus Probe), z.B. "2W6+ZfP*"
//                         (FULMINICTUS, IGNIFLUMEN, IGNIPLANO, ZORN DER ELEMENTE)
//   "fixedRoll"         - Feste Formel (1W6+4), AsP aus kosten-Feld
//                         (ECLIPTIFACTUS fix-Varianten)
//   "aspDirect"         - Spieler zahlt X AsP, TP=X (kein Wurf)
//                         (HEXENGALLE: 1 TP pro AsP, max ZfW AsP)
//   "separateCostRoll"  - TP und AsP werden GETRENNT gewuerfelt
//                         (KULMINATIO: 1W20+5 TP, 1W20 AsP)
//   "manual"            - User gibt TP ein (Varianten-Zauber)
//   "dotPerKR"          - Schaden pro Kampfrunde (AQUAQUERIS)
//
// perTenTpRSReduction: true → pro 10 TP sinkt RS um 1 (WdZ-FAXIUS-Regel)
export const SPELL_DAMAGE_MAP = {
  // ─── Feuer ─────────────────────────────────────────────────────────────
  "Ignifaxius Flammenstrahl":  { damageType: "chooseDice", maxDice: "zfw", element: "Feuer", perTenTpRSReduction: true },
  "Igniflumen Flammenspur":    { damageType: "fixedPlusZfpStar", formula: "2W6", element: "Feuer", perTenTpRSReduction: true },
  "Igniplano Flaechenbrand":   { damageType: "fixedPlusZfpStar", formula: "3W6", element: "Feuer", ignoreZones: true, perTenTpRSReduction: true },
  "Ignisphaero Feuerball":     { damageType: "fixedPlusZfpStar", formula: "5W6", zfpDivisor: 2, element: "Feuer", ignoreZones: true, perTenTpRSReduction: true },
  "Brenne Sal'Hanamkha":       { damageType: "fixedRoll", formula: "1W6+2", element: "Feuer" },
  // BRENNE TOTER STOFF (LCR S.54): kein Direkt-Schaden auf Lebewesen — nur ueber Ruestung/Kleidung
  // Basis: 3W6 SP am Traeger der gezauberten Ruestung (borbaradianisch: 1 SP/Aktion)
  // Folge: 1W3 SP/KR durch brennende Kleidung, RS sinkt um 1 ab >10 SP
  // Drachenglut-Variante (+5): (ZfP*/2)W6 TP bei Beruehrung
  // Flammeninferno-Variante (+5, ZfW 11+): 2W6 TP/KR in Zone
  // AGM-Variante: nur mit OBJEKT ENTZAUBERN loeschbar (Merkmal Antimagie)
  "Brenne toter Stoff!":       { damageType: "fixedRoll", formula: "3W6", element: "Feuer",
                                  note: "Nur indirekt an Traeger (Ruestung/Kleidung). 1W3 SP/KR Folgeschaden. Nicht direkt gegen Lebewesen!" },
  "Brenne toter Stoff":        { damageType: "fixedRoll", formula: "3W6", element: "Feuer",
                                  note: "Nur indirekt an Traeger (Ruestung/Kleidung). 1W3 SP/KR Folgeschaden. Nicht direkt gegen Lebewesen!" },
  "Flammenschwert":            { damageType: "fixedRoll", formula: "1W6+4", element: "Feuer" },
  "Flammenwand":               { damageType: "fixedRoll", formula: "1W6", element: "Feuer", ignoreZones: true },
  "Zorn der Salamander":       { damageType: "fixedRoll", formula: "2W6+4", element: "Feuer", ignoreZones: true },

  // ─── Blitz / Kraft (unsichtbar) ────────────────────────────────────────
  "Fulminictus Donnerkeil":    { damageType: "fixedPlusZfpStar", formula: "2W6", element: "Kraft", ignoresRS: true, onlyLeP: true },
  // Blitz dich find macht KEINEN SP-Schaden — grelles Lichtblitz im Geist (LCR S.51).
  // Opfer wird ZfW/2 Aktionen geblendet: AT/PA -ZfP*, Talent/Zauber/FK +ZfP* erschwert, INI -ZfP*.
  // Immun: Daemonen, Geister, Untote, Golems, Elementarwesen.
  "Blitz dich find":           { damageType: "manual", element: "Blitz", note: "Kein SP. Blendwirkung ZfW/2 KR: AT/PA -ZfP* (ungerade: erst AT), Talent-/Zauber-/FK-Proben +ZfP* erschwert, INI -ZfP*. Immun gegen: Daemonen, Geister, Untote, Golems, Elementare." },
  // KULMINATIO: TP = 1W20+5 (Schaden), AsP = 1W20 (zufaellige Kosten — GETRENNT gewuerfelt!)
  "Kulminatio Kugelblitz":     { damageType: "separateCostRoll", damageFormula: "1W20+5", aspFormula: "1W20", element: "Blitz" },

  // ─── Eis ───────────────────────────────────────────────────────────────
  "Frigisto Eishauch":         { damageType: "fixedRoll", formula: "1W6+2", element: "Eis" },
  "Frigifaxius Eislanze":      { damageType: "chooseDice", maxDice: "zfw", element: "Eis", perTenTpRSReduction: true },

  // ─── Wasser / Saeure ───────────────────────────────────────────────────
  "Aquafaxius Wasserstrahl":   { damageType: "chooseDice", maxDice: "zfw", element: "Wasser", perTenTpRSReduction: true },
  "Aquaqueris Wasserfluch":    { damageType: "dotPerKR", formula: "1W6", element: "Wasser", ignoresRS: true, baseAspCost: 10, perKrAspCost: 3 },

  // ─── Archo-Zauber (maechtige Varianten der FAXIUS/SPHAERO) ─────────────
  "Archofaxius":               { damageType: "chooseDice", maxDice: "zfw", element: "Feuer", perTenTpRSReduction: true },
  "Archosphaero":              { damageType: "fixedPlusZfpStar", formula: "5W6", zfpDivisor: 2, element: "Feuer", ignoreZones: true, perTenTpRSReduction: true },

  // ─── Fluch-Zauber ──────────────────────────────────────────────────────
  "Schwarz und Rot":           { damageType: "manual", element: "Fluch", ignoresRS: true, onlyLeP: true },
  "Iribaars Hand":             { damageType: "fixedRoll", formula: "1W20", element: "Daemonisch", ignoresRS: true, onlyLeP: true },
  "Tlalucs Odem":              { damageType: "manual", element: "Daemonisch", ignoresRS: true, onlyAuP: true, ignoreZones: true },

  // ─── Hexerei / Saeure ──────────────────────────────────────────────────
  "Hexengalle":                { damageType: "aspDirect", maxAsp: "zfw", element: "Saeure" },

  // ─── Elementar-Sphaeren ────────────────────────────────────────────────
  "Zorn der Elemente":         { damageType: "fixedPlusZfpStar", formula: "2W6", element: "variabel" },

  // ─── Geist/Seele (direkt auf LeP/AuP) ──────────────────────────────────
  "Corpofesso Schmerz":        { damageType: "manual", element: "Geist", ignoresRS: true, onlyLeP: true },
  "Hoellenpein":               { damageType: "manual", element: "Geist", ignoresRS: true, onlyLeP: true },

  // ─── AuP-Schaden (Betaeubung) ──────────────────────────────────────────
  "Plumbumbarum":              { damageType: "manual", onlyAuP: true },
  "Bannbaladin":               { damageType: "fixedRoll", formula: "1W6", onlyAuP: true },
};

/**
 * Findet die Schadensformel fuer einen Zauber.
 * Case-insensitive, ignoriert " (Variante)"-Suffix.
 */
export function lookupSpellDamage(name) {
  if (!name) return null;
  if (SPELL_DAMAGE_MAP[name]) return SPELL_DAMAGE_MAP[name];

  // Variant suffix "(Feuer)" etc. entfernen
  const baseName = name.replace(/\s*\([^)]+\)\s*$/, "").trim();
  if (SPELL_DAMAGE_MAP[baseName]) return SPELL_DAMAGE_MAP[baseName];

  // Case-insensitive Lookup
  const lower = baseName.toLowerCase();
  for (const [key, val] of Object.entries(SPELL_DAMAGE_MAP)) {
    if (key.toLowerCase() === lower) return val;
    // Match nur auf erstes Wort (z.B. "Ignifaxius" matched "Ignifaxius Flammenstrahl")
    const firstWord = key.split(" ")[0].toLowerCase();
    if (firstWord === lower) return val;
  }

  return null;
}

// ─── Element-Parsing aus Varianten-Name ──────────────────────────────────
// z.B. "Zorn der Elemente (Feuer)" → element = "Feuer"
//      "Ignifaxius Flammenstrahl (Mehrere Ziele)" → multiTarget = true
//      "Ignifaxius (agm)" → antimagie = true, gleicher Schaden wie Basis
//      "Brenne toter Stoff (borbaradianisch)" → borbaradian = true (andere Kosten/Dauer)
function _parseVariantFromName(spellName) {
  const m = spellName.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (!m) return { baseName: spellName, variant: null };
  const variant = m[2].trim().toLowerCase();
  const elementMap = {
    "feuer":  "Feuer",  "eis":    "Eis",    "blitz":  "Blitz",
    "wasser": "Wasser", "humus":  "Humus",  "erz":    "Erz",
    "luft":   "Luft",   "saeure": "Saeure", "säure":  "Saeure",
  };
  const antimagie = /\b(agm|antimagie|anti-magie)\b/.test(variant);
  const borbaradian = /\b(borb|borbaradian)/i.test(variant);
  const drachenglut = /drachenglut/.test(variant);
  const flammeninf  = /flammeninf|inferno/.test(variant);
  return {
    baseName: m[1].trim(),
    variant: m[2].trim(),
    element: elementMap[variant] ?? null,
    multiTarget: variant.includes("mehrere ziele"),
    doubleShot: variant.includes("doppelschuss") || variant.includes("doppelstrahl"),
    antimagie,
    borbaradian,
    drachenglut,
    flammeninferno: flammeninf,
  };
}

/**
 * Zeigt einen Dialog fuer Schadens-Eingabe und wuerfelt den Zauberschaden.
 * Gibt { tp, aspCost, rollHTML, formulaLabel, element, variantInfo } zurueck — oder null bei Abbruch.
 *
 * @param {string} spellName    - Name des Zaubers (inkl. optional "(Variante)")
 * @param {object} damageInfo   - Eintrag aus SPELL_DAMAGE_MAP
 * @param {object} context      - { zfw, zfpStar, aspMax, aspBaseCost }
 */
export async function rollSpellDamage(spellName, damageInfo, context = {}) {
  const { zfw = 0, zfpStar = 0, aspMax = 999, aspBaseCost = 0 } = context;
  const diceSize = damageInfo.diceSize ?? 6;
  const maxDice = damageInfo.maxDice === "zfw" ? zfw : (damageInfo.maxDice ?? zfw);
  const maxAsp  = damageInfo.maxAsp  === "zfw" ? zfw : (damageInfo.maxAsp  ?? aspMax);

  // Varianten-Parsing: Element-Overrides + Multi-Target-Warnung
  const variantInfo = _parseVariantFromName(spellName);
  const effectiveElement = variantInfo.element ?? damageInfo.element;

  // Dialog-Inhalt je nach damageType
  let dialogContent = "";
  const type = damageInfo.damageType;

  if (type === "chooseDice") {
    // IGNIFAXIUS: Spieler waehlt 1-ZfW Wuerfel, Summe = TP, AsP = TP
    dialogContent = `
      <div class="dsa-mod-dialog" style="padding:10px;color-scheme:dark">
        <div class="dsa-mod-title">⚡ ${spellName} — Schaden</div>
        <div style="font-size:13px;color:#888;margin-bottom:6px">
          Waehle die Anzahl Wuerfel (max. ${maxDice} = ZfW). Jeder 1W${diceSize} gibt TP,
          <strong>AsP-Kosten = gewuerfelte TP</strong>.
          ${damageInfo.perTenTpRSReduction ? `<br><span style="color:#c09040">Pro 10 TP sinkt RS um 1 (nicht bei nat./magischer Ruestung)</span>` : ""}
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin:6px 0">
          <label style="font-family:'VT323',monospace;font-size:15px">Wuerfel:</label>
          <input type="number" id="sd-dice" value="${Math.min(maxDice, 5)}" min="1" max="${maxDice}"
            style="width:60px;text-align:center;font-family:'VT323',monospace;font-size:18px;background:rgba(0,0,0,0.4);border:2px solid #e94560;color:#e94560" />
          <span style="color:#666">von ${maxDice}</span>
        </div>
      </div>`;
  } else if (type === "fixedPlusZfpStar") {
    // FULMINICTUS/IGNIFLUMEN/IGNIPLANO: Feste Formel + ZfP*
    const fmlStr = damageInfo.formula ?? "1W6";
    const divisor = damageInfo.zfpDivisor ?? 1;
    const zfpAdd = divisor > 1 ? Math.floor(zfpStar / divisor) : zfpStar;
    const zfpLabel = divisor > 1 ? `+ZfP*/${divisor} (+${zfpAdd})` : `+ZfP* (+${zfpAdd})`;
    dialogContent = `
      <div class="dsa-mod-dialog" style="padding:10px;color-scheme:dark">
        <div class="dsa-mod-title">⚡ ${spellName} — Schaden</div>
        <div style="font-size:13px;color:#888;margin-bottom:6px">
          Formel: <strong style="color:#e94560">${fmlStr} ${zfpLabel}</strong><br>
          ZfP* = <strong>${zfpStar}</strong>. AsP-Kosten sind separat ausgewiesen.
          ${damageInfo.perTenTpRSReduction ? `<br><span style="color:#c09040">Pro 10 TP sinkt RS um 1</span>` : ""}
        </div>
      </div>`;
  } else if (type === "separateCostRoll") {
    // KULMINATIO: TP und AsP werden GETRENNT gewuerfelt
    dialogContent = `
      <div class="dsa-mod-dialog" style="padding:10px;color-scheme:dark">
        <div class="dsa-mod-title">⚡ ${spellName} — Schaden (getrennte Wuerfel)</div>
        <div style="font-size:13px;color:#888;margin-bottom:6px">
          Schaden: <strong style="color:#e94560">${damageInfo.damageFormula}</strong><br>
          AsP-Kosten (zufaellig): <strong style="color:#4a90d9">${damageInfo.aspFormula}</strong><br>
          <span style="color:#c09040">Beide werden getrennt gewuerfelt!</span>
        </div>
      </div>`;
  } else if (type === "aspDirect") {
    // HEXENGALLE: Spieler zahlt X AsP, X = TP direkt (kein Wurf)
    dialogContent = `
      <div class="dsa-mod-dialog" style="padding:10px;color-scheme:dark">
        <div class="dsa-mod-title">⚡ ${spellName} — Schaden</div>
        <div style="font-size:13px;color:#888;margin-bottom:6px">
          Jeder eingesetzte AsP = 1 TP (kein Wurf). Max ${maxAsp} AsP.
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin:6px 0">
          <label style="font-family:'VT323',monospace;font-size:15px">AsP einsetzen:</label>
          <input type="number" id="sd-asp" value="${Math.min(maxAsp, 5)}" min="1" max="${maxAsp}"
            style="width:60px;text-align:center;font-family:'VT323',monospace;font-size:18px;background:rgba(0,0,0,0.4);border:2px solid #4a90d9;color:#4a90d9" />
          <span style="color:#666">max ${maxAsp}</span>
        </div>
      </div>`;
  } else if (type === "dotPerKR") {
    // AQUAQUERIS: Schaden pro KR fuer ZfP* Runden
    const fmlStr = damageInfo.formula ?? "1W6";
    dialogContent = `
      <div class="dsa-mod-dialog" style="padding:10px;color-scheme:dark">
        <div class="dsa-mod-title">💧 ${spellName} — Dauerschaden</div>
        <div style="font-size:13px;color:#888;margin-bottom:6px">
          <strong style="color:#4a90d9">${fmlStr} SP pro KR</strong> fuer <strong>${zfpStar}</strong> KR (ZfP*)<br>
          Basiskosten: ${damageInfo.baseAspCost} AsP + ${damageInfo.perKrAspCost} AsP/KR<br>
          <span style="color:#c09040">Aktuelle Runde wird gewuerfelt + voller Kostenaufwand</span>
        </div>
      </div>`;
  } else if (type === "fixedRoll") {
    // Feste Wuerfelformel, AsP sind separat (aus kosten-Feld des Zaubers)
    const fmlStr = damageInfo.formula ?? "1W6";
    dialogContent = `
      <div class="dsa-mod-dialog" style="padding:10px;color-scheme:dark">
        <div class="dsa-mod-title">⚡ ${spellName} — Schaden</div>
        <div style="font-size:13px;color:#888;margin-bottom:6px">
          Feste Formel: <strong style="color:#e94560">${fmlStr}</strong>
          ${damageInfo.separateAspCost ? `<br>AsP-Kosten werden separat berechnet (${aspBaseCost} AsP)` : ""}
        </div>
      </div>`;
  } else if (type === "manual") {
    // Alles manuell (CORPOFESSO, HOELLENPEIN)
    dialogContent = `
      <div class="dsa-mod-dialog" style="padding:10px;color-scheme:dark">
        <div class="dsa-mod-title">⚡ ${spellName} — Schaden</div>
        <div style="font-size:13px;color:#888;margin-bottom:6px">
          Manuelle Eingabe.
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin:6px 0">
          <label style="font-family:'VT323',monospace;font-size:15px">TP:</label>
          <input type="number" id="sd-tp" value="0" min="0"
            style="width:60px;text-align:center;font-family:'VT323',monospace;font-size:18px;background:rgba(0,0,0,0.4);border:2px solid #e94560;color:#e94560" />
        </div>
      </div>`;
  }

  // Dialog anzeigen
  const result = await new Promise(resolve => {
    new Dialog({
      title: `Schaden: ${spellName}`,
      content: dialogContent,
      buttons: {
        roll: {
          icon: '<i class="fas fa-bolt"></i>',
          label: type === "manual" || type === "aspDirect" ? "Anwenden" : "Wuerfeln!",
          callback: (html) => {
            if (type === "chooseDice") {
              resolve({ dice: parseInt(html.find("#sd-dice").val()) || 1 });
            } else if (type === "aspDirect") {
              resolve({ asp: parseInt(html.find("#sd-asp").val()) || 1 });
            } else if (type === "manual") {
              resolve({ tp: parseInt(html.find("#sd-tp").val()) || 0 });
            } else {
              resolve({});
            }
          },
        },
        cancel: { label: "Abbruch", callback: () => resolve(null) },
      },
      default: "roll",
      close: () => resolve(null),
    }).render(true);
  });

  if (result === null) return null;

  // Wurf durchfuehren
  let tp = 0, aspCost = aspBaseCost, formulaLabel = "", rollHTML = "";

  if (type === "chooseDice") {
    const n = Math.min(result.dice, maxDice);
    const roll = new Roll(`${n}d${diceSize}`);
    await roll.evaluate();
    tp = roll.total;
    aspCost = tp; // AsP = TP!
    formulaLabel = `${n}W${diceSize} = ${tp} TP (${tp} AsP)`;
    rollHTML = `<div class="dice-row">${roll.dice[0].results.map(r => `<div class="die success">${r.result}</div>`).join("")}</div>`;
  } else if (type === "fixedPlusZfpStar") {
    // FULMINICTUS-Stil: Feste Formel + ZfP*
    const fml = (damageInfo.formula ?? "1W6").replace(/W/gi, "d");
    const roll = new Roll(fml);
    await roll.evaluate();
    const divisor = damageInfo.zfpDivisor ?? 1;
    const zfpAdd = divisor > 1 ? Math.floor(zfpStar / divisor) : zfpStar;
    tp = roll.total + zfpAdd;
    aspCost = tp; // bei FAXIUS/FULMINICTUS: AsP = TP (alle haben diese Regel)
    formulaLabel = `${fml}${divisor > 1 ? `+ZfP*/${divisor}` : "+ZfP*"} = ${roll.total}+${zfpAdd} = ${tp} TP (${tp} AsP)`;
    rollHTML = roll.dice[0]
      ? `<div class="dice-row">${roll.dice[0].results.map(r => `<div class="die success">${r.result}</div>`).join("")}</div>`
      : "";
  } else if (type === "separateCostRoll") {
    // KULMINATIO: TP und AsP GETRENNT wuerfeln
    const dmgFml = (damageInfo.damageFormula ?? "1W6").replace(/W/gi, "d");
    const aspFml = (damageInfo.aspFormula ?? "1W6").replace(/W/gi, "d");
    const dmgRoll = new Roll(dmgFml);
    const aspRoll = new Roll(aspFml);
    await dmgRoll.evaluate();
    await aspRoll.evaluate();
    tp = dmgRoll.total;
    aspCost = aspRoll.total;
    formulaLabel = `Schaden: ${dmgFml}=${tp} · AsP: ${aspFml}=${aspCost}`;
    rollHTML = `<div class="dice-row">
      ${dmgRoll.dice[0]?.results.map(r => `<div class="die success" title="Schaden">${r.result}</div>`).join("") ?? ""}
      <span style="color:#666;margin:0 6px">|</span>
      ${aspRoll.dice[0]?.results.map(r => `<div class="die" style="background:#1a3a6e" title="AsP">${r.result}</div>`).join("") ?? ""}
    </div>`;
  } else if (type === "aspDirect") {
    tp = result.asp;
    aspCost = result.asp;
    formulaLabel = `${result.asp} AsP = ${tp} TP (kein Wurf)`;
  } else if (type === "dotPerKR") {
    // AQUAQUERIS: Schaden pro KR fuer ZfP* Runden
    const fml = (damageInfo.formula ?? "1W6").replace(/W/gi, "d");
    const roll = new Roll(fml);
    await roll.evaluate();
    tp = roll.total;
    // Voller AsP-Aufwand: base + perKR * ZfP*
    aspCost = (damageInfo.baseAspCost ?? 0) + (damageInfo.perKrAspCost ?? 0) * zfpStar;
    formulaLabel = `${fml}/KR = ${tp} SP · fuer ${zfpStar} KR · ${aspCost} AsP`;
    rollHTML = roll.dice[0]
      ? `<div class="dice-row">${roll.dice[0].results.map(r => `<div class="die success">${r.result}</div>`).join("")}</div>`
      : "";
  } else if (type === "fixedRoll") {
    const fml = (damageInfo.formula ?? "1W6").replace(/W/gi, "d");
    const roll = new Roll(fml);
    await roll.evaluate();
    tp = roll.total;
    // aspCost bleibt aspBaseCost (aus kosten-Feld)
    formulaLabel = `${fml} = ${tp} TP${damageInfo.separateAspCost ? ` (${aspCost} AsP separat)` : ""}`;
    rollHTML = roll.dice[0]
      ? `<div class="dice-row">${roll.dice[0].results.map(r => `<div class="die success">${r.result}</div>`).join("")}</div>`
      : "";
  } else if (type === "manual") {
    tp = result.tp;
    // aspCost bleibt aspBaseCost
    formulaLabel = `manuell: ${tp} TP`;
  }

  // Multi-Target-Hinweis (z.B. "Mehrere Ziele" bei IGNIFAXIUS)
  let variantNote = "";
  if (variantInfo.multiTarget) {
    variantNote = `<div style="color:#c09040;font-size:12px;margin-top:2px">⚠ Variante "Mehrere Ziele": Schaden auf ${tp} TP wird manuell auf Gegner verteilt (Meister entscheidet)</div>`;
  } else if (variantInfo.doubleShot) {
    variantNote = `<div style="color:#c09040;font-size:12px;margin-top:2px">⚠ Variante "Doppelschuss": zweiter Schadenswurf nach dem ersten erforderlich</div>`;
  }

  // AGM-Variante: gleicher Schaden, aber zusaetzliches Merkmal Antimagie
  if (variantInfo.antimagie) {
    variantNote += `<div style="color:#a67fc9;font-size:12px;margin-top:2px;background:rgba(166,127,201,0.12);padding:3px 6px;border-radius:3px">
      🔮 <strong>AGM-Variante</strong> — zusaetzliches Merkmal <strong>Antimagie</strong>.
      Wirkung ist identisch zur Basis-Version; das Merkmal gilt fuer Bann-/Entzauber-Interaktionen,
      Zonen-Antimagie, magische Ziele.
    </div>`;
  }
  // Borbaradianische Repraesentation: oft andere Kosten (1W20 AsP / 1W20/2 LeP)
  if (variantInfo.borbaradian) {
    variantNote += `<div style="color:#e94560;font-size:12px;margin-top:2px;background:rgba(233,69,96,0.12);padding:3px 6px;border-radius:3px">
      💀 <strong>Borbaradianische Repraesentation</strong> — abweichende Kosten (1W20 AsP oder 1W20/2 LeP),
      abweichende Wirkungsdauer (1 Aktion pro AsP), Merkmal Daemonisch.
    </div>`;
  }
  // Drachenglut / Flammeninferno — fuer Brenne toter Stoff!
  if (variantInfo.drachenglut) {
    const zfpHalf = Math.floor((context.zfpStar || 0) / 2);
    variantNote += `<div style="color:#c09040;font-size:12px;margin-top:2px;background:rgba(192,144,64,0.12);padding:3px 6px;border-radius:3px">
      🔥 <strong>Drachenglut</strong> (+5 AsP): heisseste Flamme — schmilzt Stein/Metall.
      Beruehrungsschaden: <strong>(ZfP*/2)W6 TP = ${zfpHalf}W6 TP</strong>
    </div>`;
  }
  if (variantInfo.flammeninferno) {
    variantNote += `<div style="color:#e94560;font-size:12px;margin-top:2px;background:rgba(233,69,96,0.12);padding:3px 6px;border-radius:3px">
      🌋 <strong>Flammeninferno</strong> (+5 AsP, ZfW 11+, 22 AsP): Zone waechst 1 Schritt/KR.
      Zonenschaden: <strong>2W6 TP pro KR</strong> fuer alle im Bereich.
    </div>`;
  }

  return {
    tp, aspCost, formulaLabel, rollHTML,
    element: effectiveElement,
    variantInfo,
    variantNote,
  };
}

/**
 * Resolves the VFX mapping for any spell name, including variants:
 * 1. Exact match in SPELL_EFFECT_MAP
 * 2. Variant keyword → element-specific override (e.g. "(Feuer)" → feuerball)
 * 3. Base name without variant → SPELL_EFFECT_MAP lookup
 * 4. Keyword fallback via guessSpellEffect
 *
 * Always returns an object (never null).
 */
export function lookupSpellEffect(name) {
  if (!name) return { effect: "schadenflash", type: "target" };

  // 1. Exact match
  if (SPELL_EFFECT_MAP[name]) return SPELL_EFFECT_MAP[name];

  // 2+3. Handle "(Variante)" suffix
  const m = name.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (m) {
    const baseName    = m[1].trim();
    const variantText = m[2].toLowerCase();

    // Element override from variant keyword
    const elementOverride = _elementFromVariant(variantText);
    if (elementOverride) {
      const base = SPELL_EFFECT_MAP[baseName] ?? {};
      // keep base type if element has no stronger opinion, otherwise element wins
      return { type: base.type ?? "projectile", ...elementOverride };
    }

    // No element → use base spell mapping
    if (SPELL_EFFECT_MAP[baseName]) return SPELL_EFFECT_MAP[baseName];
  }

  // 4. Keyword fallback on full name
  return guessSpellEffect(name);
}

// ─── Rüstungszonen & Behinderung (WdS Kapitel Rüstung) ────────────────────

/**
 * Trefferzone-Namen → armor-zones.json Key-Mapping.
 * Die ZONE_TABLE im Sheet liefert z.B. "Kopf", "r. Arm" etc.
 * armor-zones.json benutzt "kopf", "rArm" etc.
 */
export const ZONE_KEY_MAP = {
  "Kopf":    "kopf",
  "Brust":   "brust",
  "Bauch":   "bauch",
  "r. Arm":  "rArm",
  "l. Arm":  "lArm",
  "r. Bein": "rBein",
  "l. Bein": "lBein",
};

/** Alle Zonen-Keys in Reihenfolge */
export const ALL_ZONES = ["kopf", "brust", "ruecken", "bauch", "lArm", "rArm", "lBein", "rBein"];

/** Zone-Labels für Anzeige */
export const ZONE_LABELS = {
  kopf:    "Kopf",
  brust:   "Brust",
  ruecken: "Rücken",
  bauch:   "Bauch",
  lArm:    "L. Arm",
  rArm:    "R. Arm",
  lBein:   "L. Bein",
  rBein:   "R. Bein",
};

/**
 * Trefferzone per 1W20 (WdS Erweiterte Kampfregeln).
 * Schlüssel: Würfelergebnis 1-20 → Zonen-Key
 */
export const HIT_ZONE_TABLE = {
  1:  "kopf",    2:  "kopf",
  3:  "brust",   4:  "brust",   5:  "brust",   6:  "brust",
  7:  "ruecken", 8:  "ruecken",
  9:  "lArm",   10:  "lArm",
  11: "rArm",   12:  "rArm",
  13: "bauch",  14:  "bauch",
  15: "lBein",  16:  "lBein",
  17: "rBein",  18:  "rBein",
  19: "bauch",  20:  "bauch",
};

/**
 * Parst eine BE-Regel-Formel aus armor-zones.json.
 * Formeln: "BE", "BE-1", "BE-5", "BEx2", "BE-2"
 * Gibt den effektiven Malus zurück (min 0).
 * @param {string} formula - z.B. "BE-2" oder "BEx2"
 * @param {number} be - Total-BE nach Rüstungsgewöhnung
 * @returns {number} eBE (effektive Behinderung, >= 0)
 */
export function parseBeFormula(formula, be) {
  if (!formula || typeof formula !== "string") return be;
  const f = formula.trim();

  // "BEx2" → BE * 2
  const multMatch = f.match(/^BE\s*[xX*]\s*(\d+)$/i);
  if (multMatch) return Math.max(0, be * parseInt(multMatch[1]));

  // "BE-3" → BE - 3
  const subMatch = f.match(/^BE\s*-\s*(\d+)$/i);
  if (subMatch) return Math.max(0, be - parseInt(subMatch[1]));

  // "BE+2" → BE + 2 (rare but handle it)
  const addMatch = f.match(/^BE\s*\+\s*(\d+)$/i);
  if (addMatch) return Math.max(0, be + parseInt(addMatch[1]));

  // "BE" → just BE
  if (f.toUpperCase() === "BE") return Math.max(0, be);

  return Math.max(0, be);
}

/**
 * Berechnet die Rüstungsgewöhnung-Stufe eines Actors.
 * Prüft system.sf / system.sonderfertigkeiten nach "Rüstungsgewöhnung I/II/III".
 * @param {Actor} actor
 * @returns {{ level: number, beReduction: number, iniReduction: number }}
 */
export function getRuestungsgewoehnung(actor) {
  const sfRaw = actor.system?.sonderfertigkeiten ?? actor.system?.sf ?? [];
  const sfList = Array.isArray(sfRaw)
    ? sfRaw.map(e => typeof e === "string" ? e : (e?.name ?? ""))
    : Object.keys(sfRaw);

  const hasRG = (suffix) => sfList.some(s => {
    const lower = s.toLowerCase();
    return lower.includes("rüstungsgewöhnung") && lower.includes(suffix.toLowerCase())
      || lower.includes("rustungsgewohnung") && lower.includes(suffix.toLowerCase())
      || lower.includes("ruestungsgewoehnung") && lower.includes(suffix.toLowerCase());
  });

  // WdH S.281-282: RG I = -1 BE (spezifisch), RG II = -1 BE (alle, ersetzt RG I),
  // RG III = -2 BE (alle, ersetzt I+II). Stacken NICHT untereinander.
  if (hasRG("III") || hasRG("3")) return { level: 3, beReduction: 2, iniReduction: 0 };
  if (hasRG("II")  || hasRG("2")) return { level: 2, beReduction: 1, iniReduction: 0 };
  if (hasRG("I")   || hasRG("1")) return { level: 1, beReduction: 1, iniReduction: 0 };
  return { level: 0, beReduction: 0, iniReduction: 0 };
}

/**
 * Berechnet den INI-Malus durch Rüstung.
 * - Standard: INI -= BE (volle BE, NICHT eBE)
 * - RG II: INI -= max(0, BE - 2)
 * - RG III: INI -= max(0, Math.floor((BE - 2) / 2))
 * @param {number} totalBE - Gesamt-BE aller Rüstungsteile
 * @param {{ level: number }} rg - Rüstungsgewöhnung-Ergebnis
 * @returns {number} INI-Malus (positive Zahl = Abzug)
 */
export function calcIniPenalty(totalBE, rg) {
  if (totalBE <= 0) return 0;
  // totalBE kann Dezimal sein (gBE-Summe) → erst rechnen, dann abrunden
  if (rg.level >= 3) return Math.max(0, Math.floor((totalBE - 2) / 2));
  if (rg.level >= 2) return Math.max(0, Math.floor(totalBE - 2));
  return Math.floor(totalBE);
}

// ─── AsP-Kosten-Parser ────────────────────────────────────────────────────────

/**
 * Parses a DSA spell cost string into a number.
 * Returns the number if cost is a plain integer ("4", "4 AsP", "8 (W)").
 * Returns null for formulas ("QS×2", "W6+2", "KR", "Variable") that can't be evaluated
 * without runtime context — caller should display raw string and skip deduction.
 */
export function parseAspCost(kosten) {
  if (!kosten || kosten === "?" || /^variable$/i.test(kosten)) return null;
  const num = parseInt(kosten, 10);
  // parseInt("4 AsP") = 4 ✓, parseInt("QS×2") = NaN ✗, parseInt("W6") = NaN ✗
  return isNaN(num) ? null : num;
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
  gildenmagisch:    { label: "Gildenmagisch",    leitEig: "KL", short: "mag" },
  elfisch:          { label: "Elfisch",          leitEig: "IN", short: "elf" },
  hexisch:          { label: "Hexisch",          leitEig: "CH", short: "hex" },
  druidisch:        { label: "Druidisch",        leitEig: "IN", short: "dru" },
  geoden:           { label: "Geoden",           leitEig: "IN", short: "geo" },
  schelmisch:       { label: "Schelmisch",       leitEig: "IN", short: "sch" },
  borbaradianisch:  { label: "Borbaradianisch",  leitEig: "KL", short: "bor" },
  kristallomant:    { label: "Kristallomant",    leitEig: "KL", short: "kri" },
  scharlatanisch:   { label: "Scharlatanisch",   leitEig: "KL", short: "sha" },
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
