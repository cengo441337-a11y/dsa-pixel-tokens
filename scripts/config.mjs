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

  // ─── BLITZ / LUFT ────────────────────────────────────────────────────────
  "Fulminictus":           { effect: "fulminictus",  type: "target" },
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
  "Pfeil des Feuers":      { enchantArrow: true, effect: "flammenpfeil", impact: "feuerball", label: "Feuerpfeil",     color: "#ff6600" },
  "Pfeil des Eises":       { enchantArrow: true, effect: "pfeil",        impact: "eis",       label: "Eispfeil",       color: "#88ccff" },
  "Pfeil des Blitzes":     { enchantArrow: true, effect: "donnerkeil",   impact: "blitz",     label: "Blitzpfeil",     color: "#ffff44" },
  "Pfeil der Luft":        { enchantArrow: true, effect: "donnerkeil",   impact: "blitz",     label: "Luftpfeil",      color: "#aaeeff" },
  "Pfeil des Humus":       { enchantArrow: true, effect: "pfeil",        impact: "gift",      label: "Humuspfeil",     color: "#88aa44" },
  "Pfeil des Giftes":      { enchantArrow: true, effect: "pfeil",        impact: "gift",      label: "Giftpfeil",      color: "#44cc44" },
  "Pfeil des Wassers":     { enchantArrow: true, effect: "aquafaxius",   impact: "wasser",    label: "Wasserpfeil",    color: "#4488ff" },
  "Pfeil der Dunkelheit":  { enchantArrow: true, effect: "pfeil",        impact: "schatten",  label: "Schattenpfeil",  color: "#8844cc" },
  "Pfeil des (Elements)":  { enchantArrow: true, effect: "flammenpfeil", impact: "feuerball", label: "Elementarpfeil", color: "#ff8800" },
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
