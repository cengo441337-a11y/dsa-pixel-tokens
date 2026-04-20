/**
 * DSA Pixel-Art Tokens — Modul Entry Point
 * Registriert Sheet-Override, Hooks, und lädt Datenbanken
 */

import { MODULE_ID } from "./config.mjs";
import { PixelArtCharacterSheet } from "./sheet.mjs";
import { registerDiceHooks } from "./dice-hooks.mjs";
import { registerCombatHooks, rollPassierschlag } from "./combat.mjs";
import { registerMagicHooks } from "./magic.mjs";
import { registerPandaemoniumHooks } from "./pandaemonium.mjs";
import { registerZoneSpellHooks } from "./zone-spells.mjs";
import { migrateActorFolders, deduplicateActors, moveActorToCategoryFolder } from "./actor-folders.mjs";
import { registerXMLImporter, showImportDialog } from "./xml-parser.mjs";
import { openDatabaseBrowser } from "./db-browser.mjs";

// ─── Datenbanken (werden in ready geladen) ──────────────────────────────────

const DATA = {
  spells: [],
  talents: [],
  weapons: [],
  armor: [],
  alchemika: [],
  advantages: [],
  disadvantages: [],
  specialAbilities: [],
  effectMappings: {},
  armorZones: {},
};

async function loadDataFiles() {
  const base = `modules/${MODULE_ID}/data`;
  const files = [
    ["spells",           "spells.json"],
    ["talents",          "talents.json"],
    ["weapons",          "weapons.json"],
    ["armor",            "armor.json"],
    ["alchemika",        "alchemika.json"],
    ["advantages",       "advantages.json"],
    ["disadvantages",    "disadvantages.json"],
    ["specialAbilities", "special-abilities.json"],
    ["effectMappings",   "effect-mappings.json"],
    ["armorZones",       "armor-zones.json"],
  ];

  for (const [key, file] of files) {
    try {
      const resp = await fetch(`${base}/${file}`);
      if (resp.ok) {
        DATA[key] = await resp.json();
        console.log(`[${MODULE_ID}] Loaded ${file}: ${Array.isArray(DATA[key]) ? DATA[key].length + " entries" : "OK"}`);
      }
    } catch (e) {
      console.warn(`[${MODULE_ID}] Could not load ${file}:`, e.message);
    }
  }
}

// ─── Handlebars Partials ────────────────────────────────────────────────────

async function registerPartials() {
  const partials = [
    "header", "attributes", "resources",
    "talents", "combat", "magic",
    "equipment", "notes",
  ];

  for (const name of partials) {
    const path = `modules/${MODULE_ID}/templates/sheet/partials/${name}.hbs`;
    try {
      const resp = await fetch(path);
      if (resp.ok) {
        const tpl = await resp.text();
        Handlebars.registerPartial(`dsa-pixel-${name}`, tpl);
      }
    } catch (e) {
      console.warn(`[${MODULE_ID}] Partial ${name}.hbs not found`);
    }
  }
}

// ─── Handlebars Helpers ─────────────────────────────────────────────────────

function registerHelpers() {
  // Wiederholt X mal (für Wund-Marker etc.)
  Handlebars.registerHelper("times", function (n, block) {
    let out = "";
    for (let i = 0; i < n; i++) out += block.fn(i);
    return out;
  });

  // Prozent-Berechnung (für Balken)
  Handlebars.registerHelper("percent", function (value, max) {
    if (!max || max <= 0) return 0;
    return Math.min(100, Math.round((value / max) * 100));
  });

  // Vorzeichenbehaftete Zahl (+3, -2, 0)
  Handlebars.registerHelper("signed", function (value) {
    const n = Number(value) || 0;
    return n >= 0 ? `+${n}` : `${n}`;
  });

  // Gleichheits-Check
  Handlebars.registerHelper("eq", (a, b) => a === b);
  Handlebars.registerHelper("gt", (a, b) => a > b);
  Handlebars.registerHelper("lt", (a, b) => a < b);

  // Objekt-Iteration (für ATTRIBUTES etc.)
  Handlebars.registerHelper("eachObj", function (obj, block) {
    let out = "";
    for (const [key, val] of Object.entries(obj ?? {})) {
      out += block.fn({ key, val, ...val });
    }
    return out;
  });
}

// ─── Sheet Override ─────────────────────────────────────────────────────────

function registerSheetOverride() {
  try {
    const gdsaSystem = game.system?.id === "gdsa";
    if (!gdsaSystem) {
      console.warn(`[${MODULE_ID}] gdsa System nicht aktiv — Sheet Override übersprungen`);
      return;
    }

    // Registriere Pixel-Art Sheet als Default für PlayerCharakter (ersetzt gdsa Standard-Bogen)
    Actors.registerSheet(MODULE_ID, PixelArtCharacterSheet, {
      types: ["PlayerCharakter"],
      makeDefault: true,
      label: "DSA Pixel-Art Heldenbogen",
    });

    console.log(`[${MODULE_ID}] ✓ Pixel-Art Character Sheet registriert`);
  } catch (e) {
    console.error(`[${MODULE_ID}] Sheet Override Fehler:`, e);
  }
}

// ─── Dice Hooks ─────────────────────────────────────────────────────────────

// registerDiceHooks is imported from dice-hooks.mjs

// ─── Init Hook ──────────────────────────────────────────────────────────────

Hooks.once("init", () => {
  console.log(`[${MODULE_ID}] ═══════════════════════════════════════════`);
  console.log(`[${MODULE_ID}] DSA Pixel-Art Tokens v0.3.0 — Init`);
  console.log(`[${MODULE_ID}] ═══════════════════════════════════════════`);

  registerHelpers();
  registerSheetOverride(); // Actors.registerSheet() muss in init laufen
});

// ─── Ready Hook ─────────────────────────────────────────────────────────────

Hooks.once("ready", async () => {
  console.log(`[${MODULE_ID}] Ready — Loading data...`);

  await registerPartials();
  await loadDataFiles();

  registerDiceHooks();
  registerCombatHooks();
  registerMagicHooks();
  registerPandaemoniumHooks();
  registerZoneSpellHooks();
  registerXMLImporter();

  // One-shot-Migration: Alte Spell-Items (system.value) auf gdsa-Schema (system.zfw) umstellen
  if (game.user.isGM) {
    await _migrateSpellItems();
  }

  // Globale Shortcuts für Makros / Konsole
  globalThis.DSAPixelData       = DATA;
  globalThis.DSAHeldImport      = showImportDialog;                               // DSAHeldImport()
  globalThis.DSAEffekte         = () => DSAPixelTokens?.showEffectPicker?.();    // DSAEffekte()
  globalThis.DSAKreaturen       = () => DSAPixelTokens?.showCreaturePicker?.();  // DSAKreaturen()
  globalThis.DSAPassierschlag   = rollPassierschlag;                             // DSAPassierschlag(actor)
  globalThis.DSADatenbank       = openDatabaseBrowser;                           // DSADatenbank(actor, "waffen")

  // Effekt-Picker in den Settings integrieren
  Hooks.on("renderSettings", (_app, html) => {
    if (html.find("#dsa-pixel-fx-picker").length) return;
    const btn = $(`
      <button type="button" id="dsa-pixel-fx-picker" style="margin:4px 0;width:100%">
        <i class="fas fa-magic"></i> Pixel Effekte (Vorschau & Test)
      </button>
    `);
    btn.on("click", () => DSAPixelTokens?.showEffectPicker?.());
    const creatureBtn = $(`
      <button type="button" id="dsa-pixel-creature-picker" style="margin:4px 0;width:100%">
        <i class="fas fa-dragon"></i> Kreaturen spawnen (Dschinne, Monster, NSC)
      </button>
    `);
    creatureBtn.on("click", () => DSAPixelTokens?.showCreaturePicker?.());
    const target = html.find("#settings-game, .settings-list, section").last();
    target.append(btn);
    target.append(creatureBtn);
  });

  // Actor-Cleanup: Duplikate entfernen + in Ordner einsortieren
  if (game.user.isGM) {
    try {
      const dedupCount = await deduplicateActors();
      if (dedupCount > 0) console.log(`[${MODULE_ID}] ✓ ${dedupCount} Duplikate entfernt`);
      await migrateActorFolders();
    } catch (err) {
      console.warn(`[${MODULE_ID}] Actor-Cleanup-Fehler:`, err);
    }

    // Empfohlene Module checken
    await _checkRecommendedModules();
  }

  // Taverne-Szenen: einmaliges Auto-Setup beim ersten Start
  if (game.user.isGM) {
    await _autoSetupTavernScenes();
  }

  console.log(`[${MODULE_ID}] ✓ Fully loaded`);
});

// ─── Taverne-Szenen Setup ───────────────────────────────────────────────────

const TAVERN_SETUP_FLAG = "tavernScenesV3"; // v3: neue Namen (aventurisch)

const TAVERN_VARIANTS = {
  v1: {
    name: "Zur durstigen Distel",
    img:  "modules/dsa-pixel-tokens/assets/scenes/tavern_v1.png",
    description: "Gemuetliche Schenke — kompakt, 1 Raum mit zentralem Feuer und L-Theke",
    width: 400, height: 400, gridSize: 25,
  },
  v2: {
    name: "Zum schwarzen Eber",
    img:  "modules/dsa-pixel-tokens/assets/scenes/tavern_v2.png",
    description: "Traditionsreiches Gasthaus — Multi-Raum mit Kueche und Schlafbereich",
    width: 400, height: 400, gridSize: 25,
  },
  big: {
    name: "Zum goldenen Kelch",
    img:  "modules/dsa-pixel-tokens/assets/scenes/tavern_big.png",
    description: "Grosses Gasthaus — Bar-Eingang, Kueche, Hauptraum mit Langtischen, Treppe/Kamin (32x32 Felder)",
    width: 800, height: 800, gridSize: 25,
  },
};

async function _createTavernScene(variant) {
  const v = TAVERN_VARIANTS[variant];
  if (!v) throw new Error(`Unbekannte Taverne-Variante: ${variant}`);

  const existing = game.scenes.find(s => s.name === v.name);
  if (existing) {
    ui.notifications.info(`"${v.name}" existiert bereits.`);
    return existing;
  }

  const scene = await Scene.create({
    name: v.name,
    img:  v.img,
    background: { src: v.img },
    width:  v.width  ?? 400,
    height: v.height ?? 400,
    padding: 0.1,
    grid: { type: 1, size: v.gridSize ?? 25, color: "#ffffff", alpha: 0.15 },
    backgroundColor: "#000000",
    tokenVision: true,
    globalLight: true,
    darkness: 0,
  });
  ui.notifications.info(`"${v.name}" erstellt (${v.width ?? 400}x${v.height ?? 400}, ${Math.floor((v.width ?? 400) / (v.gridSize ?? 25))}x${Math.floor((v.height ?? 400) / (v.gridSize ?? 25))} Felder).`);
  return scene;
}

async function _autoSetupTavernScenes() {
  try {
    game.settings.register(MODULE_ID, TAVERN_SETUP_FLAG, {
      scope: "world", config: false, type: Boolean, default: false,
    });
  } catch {}
  let done = false;
  try { done = game.settings.get(MODULE_ID, TAVERN_SETUP_FLAG) === true; } catch {}
  if (done) return;

  // Nur einmal pro World anbieten
  const proceed = await Dialog.confirm({
    title: "DSA Pixel Tokens — Taverne-Szenen",
    content: `<div style="padding:10px;color:#ddd">
      <p>Moechtest du die <strong>drei Taverne-Szenen</strong> automatisch in dieser Welt erstellen?</p>
      <ul style="color:#aaa;font-size:13px">
        <li>🌿 <strong>Zur durstigen Distel</strong> — kompakte Schenke mit zentralem Feuer (400×400, 16×16)</li>
        <li>🐗 <strong>Zum schwarzen Eber</strong> — Multi-Raum-Gasthaus mit Kueche + Schlafbereich (400×400, 16×16)</li>
        <li>🍷 <strong>Zum goldenen Kelch</strong> — grosses Gasthaus mit Bar, Kueche, Hauptraum, Treppe/Kamin (800×800, 32×32)</li>
      </ul>
      <p style="font-size:12px;color:#888">Spaeter ueber Makro: <code>DSATaverneErstellen("v1")</code> / <code>"v2"</code> / <code>"big"</code></p>
    </div>`,
    yes: () => true,
    no: () => false,
    defaultYes: true,
  });

  if (!proceed) {
    try { await game.settings.set(MODULE_ID, TAVERN_SETUP_FLAG, true); } catch {}
    return;
  }

  await _createTavernScene("v1");
  await _createTavernScene("v2");
  await _createTavernScene("big");
  try { await game.settings.set(MODULE_ID, TAVERN_SETUP_FLAG, true); } catch {}

  ChatMessage.create({
    content: `<div class="dsa-pixel-chat">
      <div class="chat-title">🏰 Taverne-Szenen erstellt</div>
      <div class="result-line result-success">Beide Taverne-Szenen sind im Scene-Tab verfuegbar!</div>
      <div style="font-size:11px;color:#888;margin-top:4px">Tipp: Walls-Layer aktivieren um Mauern einzuzeichnen. Lighting-Layer fuer Feuer/Kerzen.</div>
    </div>`,
  });
}

// Globaler Helper — jederzeit manuell aufrufbar
globalThis.DSATaverneErstellen = async (variant = "v1") => {
  await _createTavernScene(variant);
};

// ─── Migration: altes Spell-Schema (system.value) → gdsa-Schema (system.zfw) ──

const MIGRATION_FLAG_KEY = "spellSchemaV1";

async function _migrateSpellItems() {
  // Setting registrieren falls noch nicht da
  try {
    game.settings.register(MODULE_ID, MIGRATION_FLAG_KEY, {
      scope: "world", config: false, type: Boolean, default: false,
    });
  } catch { /* schon registriert */ }

  // Nur einmal pro World ausfuehren
  let done = false;
  try { done = game.settings.get(MODULE_ID, MIGRATION_FLAG_KEY) === true; } catch {}
  if (done) return;

  let migrated = 0;
  const reps = ["Magier", "Druiden", "Borbaradianer", "Scharlatan", "Hexen", "Elfen"];

  for (const actor of game.actors) {
    const spellItems = actor.items.filter(i => i.type === "spell");
    if (!spellItems.length) continue;

    const updates = [];
    for (const item of spellItems) {
      const sys = item.system ?? {};
      const update = { _id: item.id };
      let needs = false;

      // Alt: system.value = ZfW → gdsa will system.zfw
      if ((sys.zfw === 0 || sys.zfw === undefined) && Number(sys.value) > 0) {
        update["system.zfw"] = Number(sys.value);
        needs = true;
      }
      // Alt: system.costs → gdsa will system.cost
      if (!sys.cost && sys.costs) {
        update["system.cost"] = sys.costs;
        needs = true;
      }
      // Alt: system.repraesentation → gdsa will system.rep
      if (!sys.rep && sys.repraesentation) {
        update["system.rep"] = sys.repraesentation;
        needs = true;
      }
      // Verbreitungs-Flags setzen basierend auf rep
      const rep = sys.rep || sys.repraesentation;
      if (rep) {
        const shouldBe = {
          vMag: rep === "Magier"         ? 1 : 0,
          vDru: rep === "Druiden"        ? 1 : 0,
          vBor: rep === "Borbaradianer"  ? 1 : 0,
          vSrl: rep === "Scharlatan"     ? 1 : 0,
          vHex: rep === "Hexen"          ? 1 : 0,
          vElf: rep === "Elfen"          ? 1 : 0,
        };
        for (const [k, v] of Object.entries(shouldBe)) {
          if (sys[k] !== v && v === 1) { update[`system.${k}`] = v; needs = true; }
        }
      }

      if (needs) updates.push(update);
    }

    if (updates.length) {
      await actor.updateEmbeddedDocuments("Item", updates);
      migrated += updates.length;
    }
  }

  if (migrated > 0) {
    ui.notifications.info(`[DSA Pixel] Spell-Schema migriert: ${migrated} Zauber-Items aktualisiert.`);
    console.log(`[${MODULE_ID}] ✓ Migrated ${migrated} spell items to gdsa schema`);
  }

  // Flag setzen damit Migration nicht nochmal laeuft
  try { await game.settings.set(MODULE_ID, MIGRATION_FLAG_KEY, true); } catch {}
}

// Globaler Shortcut zum manuellen Neu-Triggern der Migration
// (falls jemand importiert ohne dass Migration schon lief)
globalThis.DSASpellMigrate = async () => {
  try { await game.settings.set(MODULE_ID, MIGRATION_FLAG_KEY, false); } catch {}
  await _migrateSpellItems();
};

// ─── Empfohlene Module checken ──────────────────────────────────────────────

const RECOMMENDED_CHECK_FLAG = "recommendedModulesCheckedV1";

async function _checkRecommendedModules() {
  try {
    game.settings.register(MODULE_ID, RECOMMENDED_CHECK_FLAG, {
      scope: "world", config: false, type: Boolean, default: false,
    });
  } catch {}
  let done = false;
  try { done = game.settings.get(MODULE_ID, RECOMMENDED_CHECK_FLAG) === true; } catch {}
  if (done) return;

  const mod = game.modules.get(MODULE_ID);
  const recommends = mod?.relationships?.recommends ?? [];
  if (!recommends.size && !recommends.length) return;

  const missing = [];
  for (const r of recommends) {
    const id = r.id ?? r;
    const installed = game.modules.get(id);
    if (!installed) missing.push(r);
  }

  if (missing.length === 0) {
    try { await game.settings.set(MODULE_ID, RECOMMENDED_CHECK_FLAG, true); } catch {}
    return;
  }

  // Chat-Nachricht mit Liste und Hinweis auf Install
  const lines = missing.map(r => {
    const id = r.id ?? r;
    const reason = r.reason ? `<br><span style="color:#888;font-size:11px">${r.reason}</span>` : "";
    return `<li><strong>${id}</strong>${reason}</li>`;
  }).join("");

  ChatMessage.create({
    whisper: [game.user.id],
    content: `<div class="dsa-pixel-chat" style="border:1px solid #c09040">
      <div class="chat-title" style="color:#c09040">📦 Empfohlene Module</div>
      <div style="font-size:12px;color:#aaa;padding:4px">
        Folgende empfohlene Module sind noch nicht installiert (fuer vollstaendige DSA-Erfahrung):
      </div>
      <ul style="font-size:13px;color:#ddd;padding-left:20px">${lines}</ul>
      <div style="font-size:11px;color:#888;padding:4px;border-top:1px solid rgba(255,255,255,0.1);margin-top:6px">
        Installation: Setup → Add-on Modules → Install Module → Package Name / Manifest URL suchen.<br>
        Diese Nachricht erscheint nur einmal. Erneut pruefen: <code>DSACheckModule()</code>
      </div>
    </div>`,
  });

  try { await game.settings.set(MODULE_ID, RECOMMENDED_CHECK_FLAG, true); } catch {}
}

globalThis.DSACheckModule = async () => {
  try { await game.settings.set(MODULE_ID, RECOMMENDED_CHECK_FLAG, false); } catch {}
  await _checkRecommendedModules();
};
