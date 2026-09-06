/**
 * WOZU
 * ----
 * Notdürftiger Ersatz für die Foundry-VTT-Laufzeitumgebung, damit sich die
 * Modul-Dateien in einem nackten Node-Prozess importieren und ihre reinen
 * Rechenfunktionen prüfen lassen. Ohne diesen Ersatz scheitert schon der
 * Import: `class DSACalendarApp extends Application` wirft, weil `Application`
 * ein Foundry-Global ist, das es in Node nicht gibt.
 *
 * WO IM AUFBAU
 * ------------
 * Wird als ALLERERSTES importiert — vor jeder Modul-Datei. Node wertet
 * `import`-Anweisungen in Reihenfolge aus, deshalb steht in jeder Testdatei
 * `import "./foundry-stub.mjs";` ganz oben. Ein `import` weiter unten käme zu
 * spät, weil Node alle Importe vor dem ersten Anweisungsschritt auflöst —
 * darum setzt diese Datei ihre Globals als Seiteneffekt beim Laden.
 *
 * WORAUF ACHTEN
 * -------------
 * Das hier ist KEIN Foundry-Nachbau. Es ist gerade genug, damit der Import
 * durchläuft. Alles, was echtes Verhalten braucht (Würfeln, Datenbank,
 * Canvas), ist bewusst leer oder wirft. Wer eine Funktion testen will, die
 * echtes Foundry-Verhalten braucht, muss dieses Verhalten im Test selbst
 * setzen — nicht hier heimlich hineinbauen, sonst prüft der Test am Ende den
 * Ersatz statt das Modul.
 */

/** Basisklasse für alles, was in Foundry von Application abstammt. */
class StubApplication {
  static get defaultOptions() { return {}; }
  constructor(options = {}) { this.options = options; }
  render() { return this; }
  close() { return Promise.resolve(); }
  getData() { return {}; }
  activateListeners() {}
}

/** Minimaler Dokument-Ersatz: merkt sich Daten, kann sie flach lesen. */
class StubDocument {
  constructor(data = {}) { Object.assign(this, data); }
  static create(data) { return Promise.resolve(new this(data)); }
  update(changes) { Object.assign(this, changes); return Promise.resolve(this); }
  delete() { return Promise.resolve(this); }
  getFlag(scope, key) { return this.flags?.[scope]?.[key]; }
  setFlag(scope, key, value) {
    this.flags ??= {};
    this.flags[scope] ??= {};
    this.flags[scope][key] = value;
    return Promise.resolve(this);
  }
  unsetFlag(scope, key) { delete this.flags?.[scope]?.[key]; return Promise.resolve(this); }
}

/**
 * Pfad-Zugriff wie foundry.utils.getProperty: "system.LeP.value".
 * Bewusst nachgebaut statt weggelassen — mehrere Modul-Dateien rechnen damit,
 * dass der Zugriff wirklich funktioniert, nicht bloss undefined liefert.
 */
function getProperty(object, path) {
  if (!object || !path) return undefined;
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), object);
}

function setProperty(object, path, value) {
  if (!object || !path) return false;
  const keys = path.split(".");
  const last = keys.pop();
  let target = object;
  for (const k of keys) {
    if (typeof target[k] !== "object" || target[k] === null) target[k] = {};
    target = target[k];
  }
  target[last] = value;
  return true;
}

/** Flache Kopie in die Tiefe — reicht für reine Datenobjekte ohne Klassen. */
function deepClone(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(deepClone);
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = deepClone(v);
  return out;
}

function mergeObject(original, other = {}) {
  const out = deepClone(original ?? {});
  for (const [k, v] of Object.entries(other)) {
    if (v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object") {
      out[k] = mergeObject(out[k], v);
    } else {
      out[k] = deepClone(v);
    }
  }
  return out;
}

/** Sammelt registrierte Hooks, damit Tests prüfen können, was registriert wurde. */
const hookRegistry = new Map();
const Hooks = {
  on(event, fn) {
    if (!hookRegistry.has(event)) hookRegistry.set(event, []);
    hookRegistry.get(event).push(fn);
    return hookRegistry.get(event).length;
  },
  once(event, fn) { return Hooks.on(event, fn); },
  off(event, fn) {
    const list = hookRegistry.get(event);
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  },
  call() { return true; },
  callAll() { return true; },
  /** Nur für Tests: welche Rückrufe hängen an diesem Ereignis? */
  _registry: hookRegistry,
};

const noop = () => {};
const asyncNoop = async () => {};

/** PIXI wird nur konstruiert, nie gezeichnet — daher reichen leere Hüllen. */
class StubPixiObject {
  constructor() {
    this.children = [];
    this.position = { set: noop, x: 0, y: 0 };
    this.scale = { set: noop, x: 1, y: 1 };
    this.anchor = { set: noop };
    this.destroyed = false;
  }
  addChild(c) { this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; }
  destroy() { this.destroyed = true; }
  on() { return this; }
  off() { return this; }
  clear() { return this; }
  beginFill() { return this; }
  endFill() { return this; }
  lineStyle() { return this; }
  drawCircle() { return this; }
  drawRect() { return this; }
  drawPolygon() { return this; }
  moveTo() { return this; }
  lineTo() { return this; }
}

const PIXI = {
  Container: StubPixiObject,
  Graphics: StubPixiObject,
  Sprite: class extends StubPixiObject { static from() { return new PIXI.Sprite(); } },
  AnimatedSprite: class extends StubPixiObject { play() {} stop() {} },
  Text: StubPixiObject,
  Texture: { from: () => ({}), WHITE: {} },
  Rectangle: class { constructor(x, y, w, h) { Object.assign(this, { x, y, width: w, height: h }); } },
  BlurFilter: class {},
  ColorMatrixFilter: class { constructor() { this.matrix = []; } },
  filters: {},
  Ticker: class { add() {} remove() {} },
};

/** Alles, was die Modul-Dateien beim Laden als Global erwarten. */
const globals = {
  Application: StubApplication,
  FormApplication: StubApplication,
  DocumentSheet: StubApplication,
  ActorSheet: StubApplication,
  ItemSheet: StubApplication,
  Dialog: class extends StubApplication {
    static confirm() { return Promise.resolve(false); }
    static prompt() { return Promise.resolve(null); }
  },
  Hooks,
  PIXI,
  Actor: StubDocument,
  Item: StubDocument,
  Token: StubDocument,
  TokenDocument: StubDocument,
  Scene: StubDocument,
  Folder: StubDocument,
  Macro: StubDocument,
  Combat: StubDocument,
  Combatant: StubDocument,
  ActiveEffect: StubDocument,
  ChatMessage: Object.assign(StubDocument, {
    getSpeaker: () => ({ alias: "Test" }),
    create: (d) => Promise.resolve(new StubDocument(d)),
  }),
  MeasuredTemplate: StubDocument,
  Roll: class {
    constructor(formula) { this.formula = formula; this.total = 0; this.terms = []; }
    async evaluate() { return this; }
    async toMessage() { return null; }
    static async create(f) { return new globals.Roll(f); }
  },
  CONST: {
    TEXT_ANCHOR_POINTS: { CENTER: 0, BOTTOM: 1, TOP: 2, LEFT: 3, RIGHT: 4 },
    DOCUMENT_OWNERSHIP_LEVELS: { NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 },
    CHAT_MESSAGE_STYLES: { OTHER: 0, OOC: 1, IC: 2, EMOTE: 3 },
    CHAT_MESSAGE_TYPES: { OTHER: 0, OOC: 1, IC: 2, EMOTE: 3, ROLL: 5 },
    GRID_TYPES: { GRIDLESS: 0, SQUARE: 1 },
  },
  Handlebars: { registerHelper: noop, registerPartial: noop, compile: () => () => "" },
  FilePicker: class { static browse() { return Promise.resolve({ files: [] }); } },
  AudioHelper: { preloadSound: asyncNoop, play: asyncNoop },
  TextEditor: { enrichHTML: async (s) => s },
  loadTemplates: asyncNoop,
  renderTemplate: async () => "",
  getProperty,
  setProperty,
  mergeObject,
  duplicate: deepClone,
  randomID: () => Math.random().toString(36).slice(2, 18),
  fromUuid: async () => null,
  isNewerVersion: (a, b) => String(a) > String(b),
  debounce: (fn) => fn,
  libWrapper: { register: noop, WRAPPER: "WRAPPER", MIXED: "MIXED", OVERRIDE: "OVERRIDE" },
  socketlib: { registerModule: () => ({ register: noop, executeAsGM: asyncNoop }) },
};

globals.foundry = {
  utils: {
    getProperty, setProperty, mergeObject, duplicate: deepClone, deepClone,
    randomID: globals.randomID,
    isNewerVersion: globals.isNewerVersion,
    debounce: globals.debounce,
    expandObject: (o) => o,
    flattenObject: (o) => o,
  },
  audio: { AudioHelper: globals.AudioHelper },
  applications: { api: { ApplicationV2: StubApplication, HandlebarsApplicationMixin: (c) => c } },
  documents: {},
};

/**
 * Frischer Spielzustand. Tests, die `game` verbiegen, rufen das am Anfang auf,
 * damit sie sich nicht gegenseitig beeinflussen — genau die Falle, die schon
 * einmal zehn Testdateien heimlich dieselbe Datenbank teilen liess.
 */
export function resetGameState() {
  globalThis.game = {
    user: { isGM: true, id: "gm", name: "Testleiter", targets: new Set() },
    users: { get: () => null, filter: () => [], find: () => null },
    actors: Object.assign([], { get: () => null, find: () => null, filter: () => [], contents: [] }),
    items: Object.assign([], { get: () => null, find: () => null, filter: () => [] }),
    scenes: { current: null, get: () => null },
    macros: Object.assign([], { get: () => null, find: () => null, filter: () => [] }),
    folders: Object.assign([], { get: () => null, find: () => null, filter: () => [] }),
    messages: Object.assign([], { get: () => null, filter: () => [] }),
    combat: null,
    combats: Object.assign([], { get: () => null }),
    modules: new Map(),
    system: { id: "gdsa", version: "0.0.0" },
    version: "12.331",
    i18n: { localize: (k) => k, format: (k) => k },
    settings: {
      _store: new Map(),
      register() {},
      registerMenu() {},
      get(scope, key) { return globalThis.game.settings._store.get(`${scope}.${key}`); },
      set(scope, key, value) { globalThis.game.settings._store.set(`${scope}.${key}`, value); return Promise.resolve(value); },
    },
    socket: { on: noop, emit: noop },
    audio: { pending: [] },
    keybindings: { register: noop },
    time: { worldTime: 0 },
  };

  globalThis.canvas = {
    ready: true,
    tokens: { get: () => null, placeables: [], controlled: [], placeablesByName: {} },
    scene: null,
    grid: { size: 100, type: 1 },
    app: { ticker: { add: noop, remove: noop } },
    stage: new StubPixiObject(),
    interface: { createScrollingText: noop },
    effects: new StubPixiObject(),
  };

  globalThis.ui = {
    notifications: { info: noop, warn: noop, error: noop },
    actors: { render: noop },
    chat: { render: noop },
    windows: {},
  };

  globalThis.CONFIG = {
    Actor: { documentClass: StubDocument },
    Item: { documentClass: StubDocument },
    statusEffects: [],
    sounds: {},
  };
}

for (const [name, value] of Object.entries(globals)) {
  globalThis[name] = value;
}
resetGameState();

export { StubApplication, StubDocument, StubPixiObject, Hooks, PIXI };
