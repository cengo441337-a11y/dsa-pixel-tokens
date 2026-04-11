/**
 * DSA Pixel-Art Tokens — Helden-Software XML Parser
 * Importiert DSA 4.1 Charaktere aus Helden-Software XML-Exports
 */

import { MODULE_ID, ATTRIBUTES } from "./config.mjs";

// ─── XML Import Dialog ──────────────────────────────────────────────────────

/**
 * Öffnet einen Datei-Upload Dialog für Helden-Software XML.
 * Parst die XML und erstellt/aktualisiert einen Actor.
 */
export function showImportDialog() {
  new Dialog({
    title: "Helden-Software XML Import",
    content: `
      <div class="dsa-pixel-probe-dialog" style="min-width:400px">
        <div style="text-align:center;font-family:'Press Start 2P',cursive;font-size:10px;color:#ffd700;margin-bottom:12px">
          HELDEN-SOFTWARE IMPORT
        </div>
        <div style="margin:10px 0">
          <label style="font-size:14px;color:#bbb">XML-Datei auswählen:</label>
          <input type="file" id="xml-file" accept=".xml,.XML"
            style="width:100%;margin-top:6px;font-family:'VT323',monospace;background:rgba(0,0,0,0.4);border:2px solid #3a3a5e;color:#e0e0e0;padding:6px">
        </div>
        <div style="margin:10px 0">
          <label style="font-size:14px;color:#bbb">
            <input type="checkbox" id="xml-update" /> Bestehenden Held aktualisieren (statt neu erstellen)
          </label>
        </div>
        <div id="xml-preview" style="margin:10px 0;padding:8px;background:#16213e;border:2px solid #3a3a5e;border-radius:2px;display:none;max-height:200px;overflow-y:auto;font-size:13px">
        </div>
      </div>
    `,
    buttons: {
      import: {
        icon: '<i class="fas fa-file-import"></i>',
        label: "Importieren",
        callback: async (html) => {
          const file = html.find("#xml-file")[0]?.files?.[0];
          if (!file) return ui.notifications.warn("Keine Datei ausgewählt!");

          const text = await file.text();
          try {
            const heroData = parseHeldenXML(text);
            await createActorFromImport(heroData, html.find("#xml-update").is(":checked"));
            ui.notifications.info(`✓ ${heroData.name} erfolgreich importiert!`);
          } catch (e) {
            console.error(`[${MODULE_ID}] XML Import Error:`, e);
            ui.notifications.error(`Import fehlgeschlagen: ${e.message}`);
          }
        },
      },
      cancel: { label: "Abbruch" },
    },
    default: "import",
    render: (html) => {
      // Preview bei Dateiauswahl
      html.find("#xml-file").on("change", async function () {
        const file = this.files?.[0];
        if (!file) return;
        const text = await file.text();
        try {
          const data = parseHeldenXML(text);
          const preview = html.find("#xml-preview");
          preview.show().html(`
            <div style="color:#ffd700;font-weight:bold">${data.name}</div>
            <div style="color:#888">${data.race ?? "?"} / ${data.culture ?? "?"} / ${data.profession ?? "?"}</div>
            <div style="margin-top:4px">
              ${Object.entries(data.attributes).map(([k, v]) =>
                `<span style="color:#4a90d9">${k}:${v}</span>`
              ).join(" ")}
            </div>
            <div style="color:#4ad94a;margin-top:4px">
              ${data.talents?.length ?? 0} Talente,
              ${data.spells?.length ?? 0} Zauber,
              ${data.advantages?.length ?? 0} Vorteile
            </div>
          `);
        } catch (e) {
          html.find("#xml-preview").show().html(`<span style="color:#e94560">Parse-Fehler: ${e.message}</span>`);
        }
      });
    },
  }).render(true);
}

// ─── XML Parser ─────────────────────────────────────────────────────────────

/**
 * Parst Helden-Software XML und extrahiert alle relevanten Daten.
 * Unterstützt verschiedene Helden-Software Versionen.
 *
 * @param {string} xmlString - Der XML-Inhalt
 * @returns {object} Strukturierte Helden-Daten
 */
export function parseHeldenXML(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "text/xml");

  // Parse-Fehler prüfen
  const parseError = doc.querySelector("parsererror");
  if (parseError) throw new Error("Ungültiges XML: " + parseError.textContent.slice(0, 100));

  // Root-Element finden: <hpirzugriffvzd>, <daten>, <held>, etc.
  const held = doc.querySelector("held") ?? doc.querySelector("Held") ?? doc.documentElement;
  if (!held) throw new Error("Kein <held> Element gefunden");

  const result = {
    name: _getText(held, "name") || held.getAttribute("name") || "Unbekannt",
    race: _getText(held, "rasse") || _getAttr(held, "rasse", "string") || "",
    culture: _getText(held, "kultur") || _getAttr(held, "kultur", "string") || "",
    profession: _getText(held, "profession") || _getAttr(held, "ausbildung", "string") || "",
    attributes: {},
    derivedValues: {},
    talents: [],
    combatTalents: [],
    spells: [],
    advantages: [],
    disadvantages: [],
    specialAbilities: [],
    equipment: [],
    ap: { total: 0, free: 0, spent: 0 },
  };

  // ── Eigenschaften ──
  _parseAttributes(held, result);

  // ── Abgeleitete Werte ──
  _parseDerivedValues(held, result);

  // ── Talente ──
  _parseTalents(held, result);

  // ── Kampftalente ──
  _parseCombatTalents(held, result);

  // ── Zauber ──
  _parseSpells(held, result);

  // ── Vorteile / Nachteile ──
  _parseAdvantages(held, result);

  // ── Sonderfertigkeiten ──
  _parseSpecialAbilities(held, result);

  // ── Ausrüstung ──
  _parseEquipment(held, result);

  // ── AP ──
  _parseAP(held, result);

  return result;
}

// ─── Eigenschafts-Parser ────────────────────────────────────────────────────

function _parseAttributes(held, result) {
  // Format 1: <eigenschaft name="MU" value="13" mod="0" />
  const eigenschaftEls = held.querySelectorAll("eigenschaft, Eigenschaft");
  for (const el of eigenschaftEls) {
    const name = el.getAttribute("name");
    if (name && name in ATTRIBUTES) {
      const value = parseInt(el.getAttribute("value") ?? el.getAttribute("akt")) || 0;
      const mod = parseInt(el.getAttribute("mod")) || 0;
      result.attributes[name] = value + mod;
    }
  }

  // Format 2: <eigenschaften><MU>13</MU>...
  if (Object.keys(result.attributes).length === 0) {
    for (const attr of Object.keys(ATTRIBUTES)) {
      const el = held.querySelector(attr);
      if (el) {
        result.attributes[attr] = parseInt(el.textContent) || 0;
      }
    }
  }

  // Format 3: Direkte Attribute am held-Element
  if (Object.keys(result.attributes).length === 0) {
    for (const attr of Object.keys(ATTRIBUTES)) {
      const val = held.getAttribute(attr.toLowerCase());
      if (val) result.attributes[attr] = parseInt(val) || 0;
    }
  }
}

// ─── Abgeleitete Werte ──────────────────────────────────────────────────────

function _parseDerivedValues(held, result) {
  const fields = {
    "LeP":   ["grundwerte lep", "lp", "lebenspunkte"],
    "AsP":   ["grundwerte asp", "ae", "astralpunkte"],
    "AuP":   ["grundwerte aup", "au", "ausdauer"],
    "MR":    ["grundwerte mr", "magieresistenz"],
    "INI":   ["grundwerte ini", "initiative"],
  };

  for (const [key, selectors] of Object.entries(fields)) {
    for (const sel of selectors) {
      const el = held.querySelector(sel.replace(/ /g, " > "));
      if (el) {
        result.derivedValues[key] = {
          value: parseInt(el.getAttribute("akt") ?? el.getAttribute("value") ?? el.textContent) || 0,
          max: parseInt(el.getAttribute("max") ?? el.getAttribute("grundwert")) || 0,
        };
        break;
      }
    }
  }
}

// ─── Talente ────────────────────────────────────────────────────────────────

function _parseTalents(held, result) {
  // <talent name="Klettern" value="5" probe="MU/GE/KK" />
  const talentEls = held.querySelectorAll("talent, Talent");
  for (const el of talentEls) {
    const name = el.getAttribute("name");
    if (!name) continue;

    // Kampftalente separat behandeln
    const lehrmeister = el.getAttribute("lehrmeister");
    if (lehrmeister === "kampf" || el.getAttribute("typ") === "kampf") continue;

    const probe = el.getAttribute("probe") || "";
    const taw = parseInt(el.getAttribute("value") ?? el.getAttribute("taw")) || 0;

    result.talents.push({
      name,
      probe: probe.split("/").map(s => s.trim()),
      taw,
      category: _guessTalentCategory(name),
    });
  }
}

function _guessTalentCategory(name) {
  const lower = name.toLowerCase();
  const koerper = ["klettern", "schwimmen", "reiten", "schleichen", "sinnenschärfe",
    "körperbeherrschung", "selbstbeherrschung", "zechen", "akrobatik", "athletik",
    "fliegen", "gaukeleien", "tanzen", "taschendiebstahl"];
  const gesellschaft = ["menschenkenntnis", "überreden", "überzeugen", "etikette",
    "gassenwissen", "lehren", "betören", "einschüchtern", "bekehren"];
  const natur = ["fährtensuchen", "fallenstellen", "fischen", "orientierung",
    "wettervorhersage", "wildnisleben", "tierkunde", "pflanzenkunde"];
  const wissen = ["götter", "sagen", "rechnen", "geografie", "geschichtswissen",
    "magiekunde", "anatomie", "alchimie", "mechanik", "rechtskunde"];

  if (koerper.some(k => lower.includes(k))) return "koerper";
  if (gesellschaft.some(k => lower.includes(k))) return "gesellschaft";
  if (natur.some(k => lower.includes(k))) return "natur";
  if (wissen.some(k => lower.includes(k))) return "wissen";
  return "handwerk";
}

// ─── Kampftalente ───────────────────────────────────────────────────────────

function _parseCombatTalents(held, result) {
  const els = held.querySelectorAll("kampftalent, Kampftalent");
  for (const el of els) {
    result.combatTalents.push({
      name: el.getAttribute("name") || "",
      at: parseInt(el.getAttribute("at") ?? el.getAttribute("atk")) || 0,
      pa: parseInt(el.getAttribute("pa") ?? el.getAttribute("def")) || 0,
      taw: parseInt(el.getAttribute("value") ?? el.getAttribute("taw")) || 0,
    });
  }

  // Fallback: Talente mit typ="kampf"
  if (result.combatTalents.length === 0) {
    const talentEls = held.querySelectorAll("talent[typ='kampf'], talent[lehrmeister='kampf']");
    for (const el of talentEls) {
      result.combatTalents.push({
        name: el.getAttribute("name") || "",
        at: parseInt(el.getAttribute("at")) || 0,
        pa: parseInt(el.getAttribute("pa")) || 0,
        taw: parseInt(el.getAttribute("value")) || 0,
      });
    }
  }
}

// ─── Zauber ─────────────────────────────────────────────────────────────────

function _parseSpells(held, result) {
  const els = held.querySelectorAll("zauber, Zauber, spell");
  for (const el of els) {
    const name = el.getAttribute("name") || el.textContent?.trim();
    if (!name) continue;

    const probe = el.getAttribute("probe") || "";
    const zfw = parseInt(el.getAttribute("value") ?? el.getAttribute("zfw")) || 0;
    const kosten = el.getAttribute("kosten") || el.getAttribute("asp") || "";
    const rep = el.getAttribute("repraesentation") ?? el.getAttribute("rep") ?? "";

    result.spells.push({
      name,
      probe: probe.split("/").map(s => s.trim()),
      zfw,
      kosten,
      repraesentation: rep,
      reichweite: el.getAttribute("reichweite") || "",
      zauberdauer: el.getAttribute("zauberdauer") || "",
      wirkungsdauer: el.getAttribute("wirkungsdauer") || "",
    });
  }
}

// ─── Vorteile / Nachteile ───────────────────────────────────────────────────

function _parseAdvantages(held, result) {
  // <vorteil name="Gutaussehend" value="1" />
  for (const el of held.querySelectorAll("vorteil, Vorteil")) {
    result.advantages.push({
      name: el.getAttribute("name") || el.textContent?.trim() || "",
      value: el.getAttribute("value") || null,
    });
  }
  for (const el of held.querySelectorAll("nachteil, Nachteil")) {
    result.disadvantages.push({
      name: el.getAttribute("name") || el.textContent?.trim() || "",
      value: el.getAttribute("value") || null,
    });
  }
}

// ─── Sonderfertigkeiten ─────────────────────────────────────────────────────

function _parseSpecialAbilities(held, result) {
  const els = held.querySelectorAll("sonderfertigkeit, Sonderfertigkeit, sf");
  for (const el of els) {
    result.specialAbilities.push({
      name: el.getAttribute("name") || el.textContent?.trim() || "",
    });
  }
}

// ─── Ausrüstung ─────────────────────────────────────────────────────────────

function _parseEquipment(held, result) {
  for (const el of held.querySelectorAll("gegenstand, Gegenstand, ausruestung > *")) {
    result.equipment.push({
      name: el.getAttribute("name") || el.textContent?.trim() || "",
      quantity: parseInt(el.getAttribute("anzahl") ?? el.getAttribute("quantity")) || 1,
      weight: parseFloat(el.getAttribute("gewicht") ?? el.getAttribute("weight")) || 0,
    });
  }
}

// ─── AP ─────────────────────────────────────────────────────────────────────

function _parseAP(held, result) {
  const apEl = held.querySelector("abenteuerpunkte, ap, AP");
  if (apEl) {
    result.ap.total = parseInt(apEl.getAttribute("value") ?? apEl.getAttribute("gesamt") ?? apEl.textContent) || 0;
    result.ap.free = parseInt(apEl.getAttribute("frei") ?? apEl.getAttribute("free")) || 0;
    result.ap.spent = result.ap.total - result.ap.free;
  }
}

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

function _getText(el, tagName) {
  const child = el.querySelector(tagName);
  return child?.textContent?.trim() ?? null;
}

function _getAttr(el, tagName, attrName) {
  const child = el.querySelector(tagName);
  return child?.getAttribute(attrName) ?? null;
}

// ─── Actor erstellen / aktualisieren ────────────────────────────────────────

/**
 * Erstellt einen neuen Actor oder aktualisiert einen bestehenden aus geparsten XML-Daten.
 */
export async function createActorFromImport(heroData, updateExisting = false) {
  let actor = null;

  if (updateExisting) {
    actor = game.actors.find(a => a.name === heroData.name);
    if (!actor) {
      ui.notifications.warn(`Held "${heroData.name}" nicht gefunden — erstelle neu.`);
    }
  }

  // Basis-Actor-Daten für gdsa
  const actorData = {
    name: heroData.name,
    type: "PlayerCharakter",
    system: {},
  };

  // Eigenschaften setzen
  for (const [attr, value] of Object.entries(heroData.attributes)) {
    actorData.system[attr] = { value };
  }

  // Abgeleitete Werte
  if (heroData.derivedValues.LeP) {
    actorData.system.LeP = heroData.derivedValues.LeP;
  }
  if (heroData.derivedValues.AsP) {
    actorData.system.AsP = heroData.derivedValues.AsP;
  }
  if (heroData.derivedValues.AuP) {
    actorData.system.AuP = heroData.derivedValues.AuP;
  }

  // Kampftalente direkt im System-Objekt (gdsa-Format)
  for (const ct of heroData.combatTalents) {
    actorData.system[ct.name] = {
      value: ct.taw,
      atk: ct.at,
      def: ct.pa,
    };
  }

  // Meta-Daten
  actorData.system.race = heroData.race;
  actorData.system.culture = heroData.culture;
  actorData.system.profession = heroData.profession;
  actorData.system.AP = {
    value: heroData.ap.total,
    free: heroData.ap.free,
    spent: heroData.ap.spent,
  };

  if (actor) {
    // Update
    await actor.update(actorData);
  } else {
    // Create
    actor = await Actor.create(actorData);
  }

  // Items erstellen: Talente, Zauber, V/N/SF
  const items = [];

  for (const talent of heroData.talents) {
    items.push({
      name: talent.name,
      type: "talent",
      system: {
        probe: talent.probe.join("/"),
        value: talent.taw,
        taw: talent.taw,
        category: talent.category,
      },
    });
  }

  for (const spell of heroData.spells) {
    items.push({
      name: spell.name,
      type: "spell",
      system: {
        att1: spell.probe[0] || "",
        att2: spell.probe[1] || "",
        att3: spell.probe[2] || "",
        zfw: spell.zfw,
        kosten: spell.kosten,
        reichweite: spell.reichweite,
        zauberdauer: spell.zauberdauer,
        wirkungsdauer: spell.wirkungsdauer,
        repraesentation: spell.repraesentation,
      },
    });
  }

  for (const adv of heroData.advantages) {
    items.push({ name: adv.name, type: "vorteil", system: { value: adv.value } });
  }

  for (const dis of heroData.disadvantages) {
    items.push({ name: dis.name, type: "nachteil", system: { value: dis.value } });
  }

  for (const sf of heroData.specialAbilities) {
    items.push({ name: sf.name, type: "sonderfertigkeit", system: {} });
  }

  // Items bulk-create
  if (items.length > 0) {
    await actor.createEmbeddedDocuments("Item", items);
  }

  return actor;
}

// ─── Registrierung ──────────────────────────────────────────────────────────

export function registerXMLImporter() {
  // Button in den Foundry Settings-Bereich injizieren
  Hooks.on("renderSettings", (app, html) => {
    const btn = $(`
      <button type="button" style="margin:4px 0;width:100%" id="dsa-pixel-import">
        <i class="fas fa-file-import"></i> Helden-Software Import (Pixel-Art)
      </button>
    `);
    btn.on("click", showImportDialog);
    html.find("#settings-game").append(btn);
  });

  console.log(`[${MODULE_ID}] ✓ XML-Importer registriert`);
}
