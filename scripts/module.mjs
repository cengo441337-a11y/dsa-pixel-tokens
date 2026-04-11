/**
 * DSA Pixel-Art Tokens — Modul Entry Point
 * Registriert Sheet-Override, Hooks, und lädt Datenbanken
 */

import { MODULE_ID } from "./config.mjs";
import { PixelArtCharacterSheet } from "./sheet.mjs";
import { registerDiceHooks } from "./dice-hooks.mjs";
import { registerCombatHooks } from "./combat.mjs";
import { registerMagicHooks } from "./magic.mjs";
import { registerXMLImporter } from "./xml-parser.mjs";

// ─── Datenbanken (werden in ready geladen) ──────────────────────────────────

const DATA = {
  spells: [],
  talents: [],
  weapons: [],
  armor: [],
  advantages: [],
  disadvantages: [],
  specialAbilities: [],
  effectMappings: {},
};

async function loadDataFiles() {
  const base = `modules/${MODULE_ID}/data`;
  const files = [
    ["spells",           "spells.json"],
    ["talents",          "talents.json"],
    ["weapons",          "weapons.json"],
    ["armor",            "armor.json"],
    ["advantages",       "advantages.json"],
    ["disadvantages",    "disadvantages.json"],
    ["specialAbilities", "special-abilities.json"],
    ["effectMappings",   "effect-mappings.json"],
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

    // Registriere Pixel-Art Sheet als Alternative zum gdsa Standard
    Actors.registerSheet(MODULE_ID, PixelArtCharacterSheet, {
      types: ["PlayerCharakter"],
      makeDefault: false, // User kann selbst wählen; auf true setzen wenn stable
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
});

// ─── Ready Hook ─────────────────────────────────────────────────────────────

Hooks.once("ready", async () => {
  console.log(`[${MODULE_ID}] Ready — Loading data...`);

  await registerPartials();
  await loadDataFiles();

  registerSheetOverride();
  registerDiceHooks();
  registerCombatHooks();
  registerMagicHooks();
  registerXMLImporter();

  // Exportiere Datenbanken für andere Module / Makros
  globalThis.DSAPixelData = DATA;

  console.log(`[${MODULE_ID}] ✓ Fully loaded`);
});
