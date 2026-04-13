/**
 * DSA Pixel-Art Tokens — Helden-Software XML Parser
 * Importiert DSA 4.1 Charaktere aus Helden-Software XML-Exports
 */

import { MODULE_ID } from "./config.mjs";

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
            const update   = html.find("#xml-update").is(":checked");

            ui.notifications.info(`⏳ Importiere ${heroData.name}…`);
            const actor = await createActorFromImport(heroData, update);

            const summary = [
              `✓ <b>${heroData.name}</b> ${update ? "aktualisiert" : "erstellt"}`,
              `${Object.keys(heroData.attributes).length} Eigenschaften`,
              `${heroData.combatTalents.length} Kampftalente`,
              `${heroData.talents.length} Talente`,
              `${heroData.spells.length} Zauber`,
              `${heroData.advantages.length} Vorteile / ${heroData.disadvantages.length} Nachteile`,
              `${heroData.specialAbilities.length} SF`,
            ].join(" · ");
            ui.notifications.info(summary, { permanent: false });
            actor.sheet.render(true);
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
          const esc = s => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
          preview.show().html(`
            <div style="color:#ffd700;font-weight:bold">${esc(data.name)}</div>
            <div style="color:#888">${esc(data.race ?? "?")} / ${esc(data.culture ?? "?")} / ${esc(data.profession ?? "?")}</div>
            <div style="margin-top:4px">
              ${Object.entries(data.attributes).map(([k, v]) =>
                `<span style="color:#4a90d9">${esc(k)}:${esc(v)}</span>`
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
    name: held.getAttribute("name") || _getText(held, "name") || "Unbekannt",
    race:       _deJavaName(held.querySelector("basis > rasse, rasse")?.getAttribute("name")) || "",
    culture:    _deJavaName(held.querySelector("basis > kultur, kultur")?.getAttribute("name")) || "",
    profession: _deJavaName(held.querySelector("basis ausbildung[art='Hauptprofession'], ausbildung")?.getAttribute("name")) || "",
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

  // ── Talente ──
  _parseTalents(held, result);

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

// ─── Helden-Software Eigenschafts-Namen → DSA Kürzel ───────────────────────

const EIGENSCHAFT_MAP = {
  "Mut": "MU", "Klugheit": "KL", "Intuition": "IN", "Charisma": "CH",
  "Fingerfertigkeit": "FF", "Gewandtheit": "GE", "Konstitution": "KO",
  "Körperkraft": "KK", "Koerperkraft": "KK",
  // abgeleitete
  "Lebensenergie": "_LeP", "Ausdauer": "_AuP",
  "Astralenergie": "_AsP", "Karmaenergie": "_KaP",
  "Magieresistenz": "_MR", "ini": "_INI",
  "at": "_AT", "pa": "_PA", "fk": "_FK",
};

// ─── Eigenschafts-Parser ────────────────────────────────────────────────────

function _parseAttributes(held, result) {
  const eigenschaftEls = held.querySelectorAll("eigenschaft");
  for (const el of eigenschaftEls) {
    const rawName = el.getAttribute("name");
    if (!rawName) continue;
    const mapped = EIGENSCHAFT_MAP[rawName];
    if (!mapped) continue;

    const value     = parseInt(el.getAttribute("value"))     || 0;
    const mod       = parseInt(el.getAttribute("mod"))       || 0;
    const permanent = parseInt(el.getAttribute("permanent")) || 0;

    if (mapped.startsWith("_")) {
      // Abgeleitete Werte in Helden-Software XML:
      //   value     = aktuell verbleibender Wert (0 = nicht getrackt oder leer)
      //   mod       = gekaufter Bonus (erhöht Max)
      //   permanent = permanent verbrauchte Punkte, z.B. durch Rituale (negativ → reduziert Max)
      const key = mapped.slice(1);
      result.derivedValues[key] = { value, mod, permanent };
    } else {
      // Eigenschaft: value = aktueller Gesamtwert
      result.attributes[mapped] = value;
    }
  }
}

// ─── Talente ────────────────────────────────────────────────────────────────

function _parseTalents(held, result) {
  // Kampftalent-Namen aus <kampf> sammeln, um sie zu trennen
  const kampfNamen = new Set();
  for (const kw of held.querySelectorAll("kampf > kampfwerte")) {
    kampfNamen.add(kw.getAttribute("name"));
  }

  // Alle Talente aus <talentliste>
  for (const el of held.querySelectorAll("talentliste > talent")) {
    const name = el.getAttribute("name");
    if (!name) continue;

    // Probe: " (GE/FF/KK)" → ["GE","FF","KK"]
    const probeRaw = el.getAttribute("probe") || "";
    const probe = probeRaw.replace(/[()]/g, "").trim().split("/").map(s => s.trim()).filter(Boolean);
    const taw = parseInt(el.getAttribute("value")) || 0;

    if (kampfNamen.has(name)) {
      // Kampftalent — AT/PA aus <kampf>
      const kw = held.querySelector(`kampf > kampfwerte[name="${CSS.escape(name)}"]`);
      const at = parseInt(kw?.querySelector("attacke")?.getAttribute("value")) || 0;
      const pa = parseInt(kw?.querySelector("parade")?.getAttribute("value")) || 0;
      result.combatTalents.push({ name, at, pa, taw, probe });
    } else {
      result.talents.push({ name, probe, taw, category: _guessTalentCategory(name) });
    }
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

// ─── Zauber ─────────────────────────────────────────────────────────────────

function _parseSpells(held, result) {
  // Doppelte vermeiden (Helden-Software hat manchmal mehrere Varianten)
  const seen = new Set();
  for (const el of held.querySelectorAll("zauberliste > zauber")) {
    const name = el.getAttribute("name");
    if (!name) continue;

    // Probe: " (KL/KL/FF)" → ["KL","KL","FF"]
    const probeRaw = el.getAttribute("probe") || "";
    const probe = probeRaw.replace(/[()]/g, "").trim().split("/").map(s => s.trim()).filter(Boolean);
    const zfw = parseInt(el.getAttribute("value")) || 0;
    const rep = el.getAttribute("repraesentation") || "";
    const variante = el.getAttribute("variante") || "";
    const key = `${name}|${variante}`;
    if (seen.has(key)) continue;
    seen.add(key);

    result.spells.push({
      name: variante ? `${name} (${variante})` : name,
      probe,
      zfw,
      kosten: el.getAttribute("kosten") || "",
      repraesentation: rep,
      hauszauber: el.getAttribute("hauszauber") === "true",
    });
  }
}

// ─── Vorteile / Nachteile ───────────────────────────────────────────────────

function _parseAdvantages(held, result) {
  for (const el of held.querySelectorAll("vt > vorteil")) {
    result.advantages.push({
      name: el.getAttribute("name") || "",
      value: el.getAttribute("value") || null,
    });
  }
  for (const el of held.querySelectorAll("vt > nachteil")) {
    result.disadvantages.push({
      name: el.getAttribute("name") || "",
      value: el.getAttribute("value") || null,
    });
  }
}

// ─── Sonderfertigkeiten ─────────────────────────────────────────────────────

function _parseSpecialAbilities(held, result) {
  for (const el of held.querySelectorAll("sf > sonderfertigkeit")) {
    result.specialAbilities.push({
      name: el.getAttribute("name") || "",
    });
  }
}

// ─── Ausrüstung ─────────────────────────────────────────────────────────────

function _parseEquipment(held, result) {
  for (const el of held.querySelectorAll("gegenstaende > gegenstand, ausruestungen gegenstand")) {
    const name = el.getAttribute("name");
    if (!name) continue;
    result.equipment.push({
      name,
      quantity: parseInt(el.getAttribute("anzahl")) || 1,
      weight: parseFloat(el.getAttribute("gewicht")) || 0,
    });
  }
}

// ─── AP ─────────────────────────────────────────────────────────────────────

function _parseAP(held, result) {
  const apEl = held.querySelector("basis > abenteuerpunkte");
  const freeEl = held.querySelector("basis > freieabenteuerpunkte");
  if (apEl) {
    result.ap.total = parseInt(apEl.getAttribute("value")) || 0;
    result.ap.free  = parseInt(freeEl?.getAttribute("value")) || 0;
    result.ap.spent = result.ap.total - result.ap.free;
  }
}

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

function _getText(el, tagName) {
  const child = el.querySelector(tagName);
  return child?.textContent?.trim() ?? null;
}

/**
 * Bereinigt Helden-Software Java-Klassennamen zu lesbaren deutschen Namen.
 * "helden.model.rasse.Mittellaender" → "Mittelländer"
 * "helden.model.kultur.Mittelreich"  → "Mittelreich"
 */
function _deJavaName(str) {
  if (!str) return str;
  // Kein Java-Klassenname → unverändert zurück
  if (!str.includes(".")) return str;
  // Letztes Segment extrahieren
  let name = str.split(".").pop();
  // ASCII-Umlaute → echte Umlaute
  name = name
    .replace(/Ae([a-z])/g, "Ä$1").replace(/Oe([a-z])/g, "Ö$1").replace(/Ue([a-z])/g, "Ü$1")
    .replace(/ae/g, "ä").replace(/oe/g, "ö").replace(/ue/g, "ü")
    .replace(/sz/g, "ß");
  // CamelCase → Leerzeichen
  name = name.replace(/([a-zäöüß])([A-ZÄÖÜ])/g, "$1 $2");
  return name;
}

// ─── Token / Portrait Zuweisung ─────────────────────────────────────────────

const BASE = `modules/${MODULE_ID}/assets`;

/** Bekannte Helden → eigene Token-Art (Name → Datei in assets/monsters/) */
const HERO_TOKEN_MAP = {
  oboro:                     `${BASE}/monsters/oboro_token.png`,
  tamir:                     `${BASE}/monsters/tamir_token.png`,
  "edo die eiche":           `${BASE}/monsters/edo_token.png`,
  edo:                       `${BASE}/monsters/edo_token.png`,
  "alrik von bärenstein":    `${BASE}/monsters/alrik_token.png`,
  alrik:                     `${BASE}/monsters/alrik_token.png`,
  "brand thorboldson":       `${BASE}/monsters/brand_token.png`,
  brand:                     `${BASE}/monsters/brand_token.png`,
  aytan:                     `${BASE}/monsters/aytan_token.png`,
  dunya:                     `${BASE}/monsters/dunya_token.png`,
};

/** Dämonen aus dem Tractatus Contra Daemones → Token-Art */
const DEMON_TOKEN_MAP = {
  // Blakharaz-Gefolgschaft
  gotongi:                   `${BASE}/monsters/gotongi_token.png`,
  heshthot:                  `${BASE}/monsters/heshthot_token.png`,
  asqarath:                  `${BASE}/monsters/asqarath_token.png`,
  asqarathi:                 `${BASE}/monsters/asqarath_token.png`,
  irhiadhzal:                `${BASE}/monsters/irhiadhzal_token.png`,
  // Lolgramoth-Gefolgschaft
  dharai:                    `${BASE}/monsters/dharai_token.png`,
  dharayim:                  `${BASE}/monsters/dharai_token.png`,
  chuchathabomek:            `${BASE}/monsters/chuchathabomek_token.png`,
  difar:                     `${BASE}/monsters/difar_token.png`,
  // Thargunitoth-Gefolgschaft
  nirraven:                  `${BASE}/monsters/nirraven_token.png`,
  braggu:                    `${BASE}/monsters/braggu_token.png`,
  // Tasfarelel-Gefolgschaft
  tasfarelel:                `${BASE}/monsters/tasfarelel_token.png`,
  nurumbaal:                 `${BASE}/monsters/nurumbaal_token.png`,
  nurumbaalim:               `${BASE}/monsters/nurumbaal_token.png`,
  "balkha'bul":              `${BASE}/monsters/nurumbaal_token.png`,
  "khidma'kha'bul":          `${BASE}/monsters/khidmakhabulim_token.png`,
  khidmakhabulim:            `${BASE}/monsters/khidmakhabulim_token.png`,
  // Charyptoroth-Gefolgschaft
  elymelusinias:             `${BASE}/monsters/elymelusinias_token.png`,
  ulchuchu:                  `${BASE}/monsters/ulchuchu_token.png`,
  "yo'nahoh":                `${BASE}/monsters/yo_nahoh_token.png`,
  yo_nahoh:                  `${BASE}/monsters/yo_nahoh_token.png`,
  // Calijnaar-Gefolgschaft
  cthllanogog:               `${BASE}/monsters/cthllanogog_token.png`,
  trachrhabaar:              `${BASE}/monsters/trachrhabaar_token.png`,
  // Dar-Klajid-Gefolgschaft
  laraan:                    `${BASE}/monsters/laraan_token.png`,
  fajlaraan:                 `${BASE}/monsters/laraan_token.png`,
  khelevathan:               `${BASE}/monsters/khelevathan_token.png`,
  nishkakat:                 `${BASE}/monsters/nishkakat_token.png`,
  uridabash:                 `${BASE}/monsters/uridabash_token.png`,
  // Mishkara-Gefolgschaft
  bhurkhesch:                `${BASE}/monsters/bhurkhesch_token.png`,
  duglum:                    `${BASE}/monsters/duglum_token.png`,
  tlaluc:                    `${BASE}/monsters/tlaluc_token.png`,
  tlalucya:                  `${BASE}/monsters/tlaluc_token.png`,
  khuralthu:                 `${BASE}/monsters/khuralthu_token.png`,
  khuralthi:                 `${BASE}/monsters/khuralthu_token.png`,
  // Agrimoth-Gefolgschaft
  arjunoor:                  `${BASE}/monsters/arjunoor_token.png`,
  arkhobal:                  `${BASE}/monsters/arkhobal_token.png`,
  arkhobalim:                `${BASE}/monsters/arkhobal_token.png`,
  "kah-thurak-arfai":        `${BASE}/monsters/kah_thurak_arfai_token.png`,
  "gna-rishaj-tumar":        `${BASE}/monsters/gna_rishaj_tumar_token.png`,
  "glaa-tho-yub":            `${BASE}/monsters/glaathoyub_token.png`,
  glaathoyub:                `${BASE}/monsters/glaathoyub_token.png`,
  // Belkelel/Aphasmayra-Gefolgschaft
  chamuyan:                  `${BASE}/monsters/chamuyan_token.png`,
  aphasmayra:                `${BASE}/monsters/aphasmayra_token.png`,
  "aphasmayras atem":        `${BASE}/monsters/aphasmayra_token.png`,
  // Widharcal-Gefolgschaft
  karmanath:                 `${BASE}/monsters/karmanath_token.png`,
  karmanathi:                `${BASE}/monsters/karmanath_token.png`,
  umdoreel:                  `${BASE}/monsters/umdoreel_token.png`,
  // Belshirash-Gefolgschaft
  pershirash:                `${BASE}/monsters/pershirash_token.png`,
  pershirashi:               `${BASE}/monsters/pershirash_token.png`,
  // Belhalhar-Gefolgschaft
  zant:                      `${BASE}/monsters/zant_token.png`,
  zantim:                    `${BASE}/monsters/zant_token.png`,
  sharbazz:                  `${BASE}/monsters/sharbazz_token.png`,
  shruuf:                    `${BASE}/monsters/shruuf_token.png`,
  shruufya:                  `${BASE}/monsters/shruuf_token.png`,
  // Amazeroth-Gefolgschaft
  xamanoth:                  `${BASE}/monsters/xamanoth_token.png`,
  // Unabhängige Dämonen
  "yo'ugghatugythot":        `${BASE}/monsters/yo_ugghatugythot_token.png`,
  yo_ugghatugythot:          `${BASE}/monsters/yo_ugghatugythot_token.png`,
  "glaa-tho-yub":            `${BASE}/monsters/glaathoyub_token.png`,
  // Yst-Phogorthu (Dämonenpferde)
  "yst-phogorthu":           `${BASE}/monsters/yst_phogorthu_token.png`,
  yst_phogorthu:             `${BASE}/monsters/yst_phogorthu_token.png`,
  nachtmähre:                `${BASE}/monsters/yst_phogorthu_token.png`,
  // Zazamotl'gnakhyaa (Dämonenjäger)
  "zazamotl'gnakhyaa":       `${BASE}/monsters/zazamotl_gnakhyaa_token.png`,
  zazamotl_gnakhyaa:         `${BASE}/monsters/zazamotl_gnakhyaa_token.png`,
  zazamotl:                  `${BASE}/monsters/zazamotl_gnakhyaa_token.png`,
  // Yish'Azrhi
  "yish'azrhi":              `${BASE}/monsters/yish_azrhi_token.png`,
  yish_azrhi:                `${BASE}/monsters/yish_azrhi_token.png`,
  // ─── Wege der Zauberei Dämonen ───────────────────────────────────────────
  // Aphestadil (Schlaf/Trägheit-Dämonin)
  aphestadil:                `${BASE}/monsters/aphestadil_token.png`,
  // Eugalp (Seuchendämon, Mishkhara-Gefolge)
  eugalp:                    `${BASE}/monsters/eugalp_token.png`,
  // Hanaestil (Verführerin, Dar-Klajid)
  hanaestil:                 `${BASE}/monsters/hanaestil_token.png`,
  // Hirr'Nirat (dämonische Rattenfürsten, Mishkhara)
  "hirr'nirat":              `${BASE}/monsters/hirr_nirat_token.png`,
  "hirr'niratim":            `${BASE}/monsters/hirr_nirat_token.png`,
  hirr_nirat:                `${BASE}/monsters/hirr_nirat_token.png`,
  // Ivash (Feuerzunge, Dienst des Namenlosen)
  ivash:                     `${BASE}/monsters/ivash_token.png`,
  ivashim:                   `${BASE}/monsters/ivash_token.png`,
  // May'hay'tam (Pflanzendämon)
  "may'hay'tam":             `${BASE}/monsters/may_hay_tam_token.png`,
  may_hay_tam:               `${BASE}/monsters/may_hay_tam_token.png`,
  "ma'hay'tam":              `${BASE}/monsters/may_hay_tam_token.png`,
  // Qok'Maloth (verkrüppelter Geier, Amazeroth)
  "qok'maloth":              `${BASE}/monsters/qok_maloth_token.png`,
  qok_maloth:                `${BASE}/monsters/qok_maloth_token.png`,
  // Quitslinga (viergehörnter Gestaltwandler, Amazeroth)
  quitslinga:                `${BASE}/monsters/quitslinga_token.png`,
  // Shihayazad (7-gehörnter Sphärenspalter)
  shihayazad:                `${BASE}/monsters/shihayazad_token.png`,
  // Thaz-Laraanji (Traumbesucher, Belkelel)
  "thaz-laraanji":           `${BASE}/monsters/thaz_laraanji_token.png`,
  "thaz-laraanjinim":        `${BASE}/monsters/thaz_laraanji_token.png`,
  thaz_laraanji:             `${BASE}/monsters/thaz_laraanji_token.png`,
  // Thalon (schwarzes Wiesel, Belshirash)
  thalon:                    `${BASE}/monsters/thalon_token.png`,
  thalone:                   `${BASE}/monsters/thalon_token.png`,
  // Amrychoth (Dunkelrochen, Charyptoroth)
  amrychoth:                 `${BASE}/monsters/amrychoth_token.png`,
  amrychothim:               `${BASE}/monsters/amrychoth_token.png`,
  // Amrifas (Erderschütterer, Agrimoth)
  amrifas:                   `${BASE}/monsters/amrifas_token.png`,
  // Haqoum (Tasfarelel/Amazeroth)
  haqoum:                    `${BASE}/monsters/haqoum_token.png`,
  heqoumi:                   `${BASE}/monsters/haqoum_token.png`,
  // Qasaar / Cha'Shahr (Aphasmayra-Kätzchen)
  qasaar:                    `${BASE}/monsters/qasaar_token.png`,
  qasaarim:                  `${BASE}/monsters/qasaar_token.png`,
  "cha'shahr":               `${BASE}/monsters/qasaar_token.png`,
  // Je-Chrizlayk-Ura (Schleimklumpen, Agrimoth/Lolgramoth)
  "je-chrizlayk-ura":        `${BASE}/monsters/je_chrizlayk_ura_token.png`,
  "je-chrizlayk-uraya":      `${BASE}/monsters/je_chrizlayk_ura_token.png`,
  je_chrizlayk_ura:          `${BASE}/monsters/je_chrizlayk_ura_token.png`,
  // Mactans (Spinnen-Tentakel-Dämon)
  mactans:                   `${BASE}/monsters/mactans_token.png`,
  // Iltapeth und Istapher (siamesische Zwillings-Dämonen, Aphestadil)
  iltapeth:                  `${BASE}/monsters/iltapeth_istapher_token.png`,
  istapher:                  `${BASE}/monsters/iltapeth_istapher_token.png`,
  // Muwallaraan (Höllenpferd, Belkelel)
  muwallaraan:               `${BASE}/monsters/muwallaraan_token.png`,
  muwallaraanim:             `${BASE}/monsters/muwallaraan_token.png`,
  // Karunga (grünes Etwas, Amazeroth)
  karunga:                   `${BASE}/monsters/karunga_token.png`,
  karungai:                  `${BASE}/monsters/karunga_token.png`,
  // Karmoth der Vernichter (Belhalhar-Warlord)
  karmoth:                   `${BASE}/monsters/karmoth_token.png`,
  // Usuzoreel (Wild Hunt Treiber, Belshirash)
  usuzoreel:                 `${BASE}/monsters/usuzoreel_token.png`,
  usuzoreelya:               `${BASE}/monsters/usuzoreel_token.png`,
  // Azamir (unerbittlicher Verfolger, 7-gehörnt)
  azamir:                    `${BASE}/monsters/azamir_token.png`,
  // Isyahadin & Rahastes (Zwillings-Nebel-Dämonen)
  isyahadin:                 `${BASE}/monsters/isyahadin_rahastes_token.png`,
  rahastes:                  `${BASE}/monsters/isyahadin_rahastes_token.png`,
};

/** Rasse/Profession-basierte Fallbacks (Keyword → Datei in token-art/) */
const TOKEN_FALLBACKS = [
  { keywords: ["elf", "elfe"],                   file: `${BASE}/../token-art/waldelfe_bogenschuetze.png` },
  { keywords: ["magier", "akademie", "zauberer"], file: `${BASE}/../token-art/mensch_magier.png` },
  { keywords: ["krieger", "söldner", "ritter"],   file: `${BASE}/../token-art/mensch_kriegerin.png` },
  { keywords: ["zwerg"],                          file: `${BASE}/../token-art/zwerg_krieger.png` },
  { keywords: ["thorwal"],                        file: `${BASE}/../token-art/thorwaler.png` },
  { keywords: ["druide"],                         file: `${BASE}/../token-art/mensch_magier.png` },
  { keywords: ["hexe"],                           file: `${BASE}/../token-art/mensch_magier.png` },
  { keywords: ["ork"],                            file: `${BASE}/../token-art/ork_krieger.png` },
  { keywords: ["goblin"],                         file: `${BASE}/../token-art/goblin_schurke.png` },
];

/**
 * Ermittelt das passende Token-Bild für einen importierten Helden.
 * 1. Exakter Name-Match (Oboro, Tamir, …)
 * 2. Keyword-Match auf Rasse + Profession
 * 3. Fallback: Standard mystery-man
 */
function _resolveTokenImage(heroData) {
  const nameLower = heroData.name.toLowerCase();
  if (HERO_TOKEN_MAP[nameLower]) return HERO_TOKEN_MAP[nameLower];
  if (DEMON_TOKEN_MAP[nameLower]) return DEMON_TOKEN_MAP[nameLower];

  // Partial name match for demons (e.g. "Asqarath der Feurige" → asqarath)
  for (const [key, path] of Object.entries(DEMON_TOKEN_MAP)) {
    if (nameLower.includes(key)) return path;
  }

  const haystack = `${heroData.race} ${heroData.profession} ${heroData.culture}`.toLowerCase();
  for (const fb of TOKEN_FALLBACKS) {
    if (fb.keywords.some(kw => haystack.includes(kw))) return fb.file;
  }
  return "icons/svg/mystery-man.svg";
}

// ─── Actor erstellen / aktualisieren ────────────────────────────────────────

/**
 * Erstellt einen neuen Actor oder aktualisiert einen bestehenden aus geparsten XML-Daten.
 * Schreibt alle Daten in die korrekten gdsa-Systempfade.
 */
export async function createActorFromImport(heroData, updateExisting = false) {
  let actor = null;

  if (updateExisting) {
    actor = game.actors.find(a => a.name === heroData.name);
    if (!actor) ui.notifications.warn(`Held "${heroData.name}" nicht gefunden — erstelle neu.`);
  }

  const dv  = heroData.derivedValues;
  const sys = {};

  // ── 1. Eigenschaften (MU, KL, IN, ...) ──────────────────────────────────
  for (const [attr, val] of Object.entries(heroData.attributes)) {
    sys[attr] = { value: val, mod: 0 };
  }

  // ── 2. Abgeleitete Werte ─────────────────────────────────────────────────
  const attr = heroData.attributes;  // Kurzreferenz
  // Helden-Software XML:
  //   mod       = gekaufter Bonus (erhöht Max)
  //   permanent = permanent verbrauchte Punkte, z.B. Ritualobjekte (negativ → reduziert Max)
  //   value     = aktuell verbleibender Wert (0 = komplett aufgebraucht, nicht "kein Bonus")
  const lepBonus = dv.LeP?.mod ?? 0;
  const aspBonus = (dv.AsP?.mod ?? 0) + (dv.AsP?.permanent ?? 0);
  const aupBonus = dv.AuP?.mod ?? 0;
  const lepMax = (attr.KO ?? 10) * 2 + Math.ceil((attr.KK ?? 10) / 2) + lepBonus;
  // AsP: abhängig vom Charaktertyp
  // Vollzauberer/Magier: MU+IN+CH; Elfen: IN+MR+CH; Sonstige: IN + Astralmacht*10
  const astralmacht   = heroData.advantages.find(a => a.name === "Astralmacht");
  const istVollzauber = heroData.advantages.some(a => a.name === "Vollzauberer")
    || heroData.advantages.some(a => a.name?.includes("Akademische Ausbildung"))
    || heroData.specialAbilities.some(s => s.name?.includes("Akademische Ausbildung"));
  const istElf = heroData.race?.toLowerCase().includes("elf")
    || heroData.race?.toLowerCase().includes("elfe");
  const aspMax = istVollzauber ? (attr.MU ?? 10) + (attr.IN ?? 10) + (attr.CH ?? 10) + aspBonus
    : istElf        ? (attr.IN ?? 10) + (attr.MR ?? 10) + (attr.CH ?? 10) + aspBonus
    : astralmacht   ? (attr.IN ?? 10) + (parseInt(astralmacht.value) || 0) * 10 + aspBonus
    : aspBonus > 0  ? aspBonus : 0;
  // AuP: GE + KO + KK/2 (rund) + Bonus
  const aupMax = (attr.GE ?? 10) + (attr.KO ?? 10) + Math.ceil((attr.KK ?? 10) / 2) + aupBonus;
  // Aktueller Wert: XML-Wert wenn > 0, sonst Max (0 = aufgebraucht oder nicht getrackt)
  const lepCurrent = (dv.LeP?.value > 0) ? dv.LeP.value : lepMax;
  const aspCurrent = (dv.AsP?.value > 0) ? dv.AsP.value : aspMax;
  const aupCurrent = (dv.AuP?.value > 0) ? dv.AuP.value : aupMax;
  sys.LeP = { value: lepCurrent, max: lepMax };
  sys.AsP = { value: aspCurrent, max: aspMax };
  sys.AuP = { value: aupCurrent, max: aupMax };
  if (dv.MR)  sys.MR  = { value: dv.MR.value,  tempmodi: 0 };
  if (dv.INI) sys.INI = { value: dv.INI.value,  tempmodi: 0 };
  // Kampf-Basiswerte (ATBasis, PABasis, FKBasis)
  if (dv.AT)  sys.ATBasis = { value: dv.AT.value,  tempmodi: 0 };
  if (dv.PA)  sys.PABasis = { value: dv.PA.value,  tempmodi: 0 };
  if (dv.FK)  sys.FKBasis = { value: dv.FK.value,  tempmodi: 0 };

  // ── 3. Kampftalente → system.skill ──────────────────────────────────────
  sys.skill = {};
  for (const ct of heroData.combatTalents) {
    sys.skill[ct.name] = { value: ct.taw, atk: ct.at || "", def: ct.pa || "" };
  }

  // ── 4. Talente → system.talente ──────────────────────────────────────────
  sys.talente = {};
  for (const t of heroData.talents) {
    sys.talente[t.name] = { value: t.taw, probe: t.probe, cat: t.category };
  }

  // ── 5. Vorteile / Nachteile → system.vorteile / nachteile ───────────────
  sys.vorteile  = {};
  sys.nachteile = {};
  for (const adv of heroData.advantages) {
    sys.vorteile[adv.name]  = adv.value != null ? (parseInt(adv.value) || adv.value) : null;
  }
  for (const dis of heroData.disadvantages) {
    sys.nachteile[dis.name] = dis.value != null ? (parseInt(dis.value) || dis.value) : null;
  }

  // ── 6. Sonderfertigkeiten → system.sf (String-Array) ────────────────────
  sys.sf = heroData.specialAbilities.map(s => s.name);

  // ── 6b. Repräsentationen → system.Reps (Boolean-Flags für gdsa) ──────────
  const REP_MAP = {
    gildenmagisch: "mag", mag: "mag",
    elfisch: "elf", elf: "elf",
    hexisch: "hex", hex: "hex",
    druidisch: "dru", dru: "dru",
    schelmisch: "sch", sch: "sch",
    borbaradianisch: "bor", bor: "bor",
    geoden: "geo", geo: "geo",
    kristallomant: "kri", kri: "kri",
    scharlatanisch: "sha",
  };
  const repsFlags = { mag: false, elf: false, hex: false, dru: false, sch: false, bor: false, geo: false, kri: false };
  // Aus Zaubern ableiten
  for (const spell of heroData.spells) {
    const key = REP_MAP[spell.repraesentation?.toLowerCase()];
    if (key) repsFlags[key] = true;
  }
  // Auch aus SF ableiten (z.B. "Repräsentation: Elfisch", "Repräsentation (Elfisch)")
  for (const sf of heroData.specialAbilities) {
    const m = sf.name.match(/Repr.sentation[:\s(]+(\w+)/i);
    if (m) {
      const key = REP_MAP[m[1].toLowerCase()];
      if (key) repsFlags[key] = true;
    }
  }
  sys.Reps = repsFlags;

  // ── 7. Regen-Werte aus SF/Vorteilen ableiten ─────────────────────────────
  const sfNames = sys.sf;
  const regStufe = sfNames.includes("Meisterliche Regeneration") ? 3
    : sfNames.includes("Regeneration II")                        ? 2
    : sfNames.includes("Regeneration I")                         ? 1 : 0;
  const astraleRegVorteil = heroData.advantages.find(a => a.name === "Astrale Regeneration");
  sys.regen = {
    regStufe,
    astraleReg: astraleRegVorteil ? (parseInt(astraleRegVorteil.value) || 0) : 0,
    hasMeditation: sfNames.some(s => s.toLowerCase().includes("meditation")),
  };

  // ── 8. Meta ──────────────────────────────────────────────────────────────
  sys.race       = heroData.race;    // gdsa-Feld heißt 'race', nicht 'rasse'
  sys.kultur     = heroData.culture;
  sys.profession = heroData.profession;
  sys.AP         = { value: heroData.ap.total, free: heroData.ap.free, spent: heroData.ap.spent };

  // ── Actor erstellen / aktualisieren ──────────────────────────────────────
  const tokenImg = _resolveTokenImage(heroData);
  const actorData = {
    name: heroData.name,
    type: "PlayerCharakter",
    system: sys,
    img: tokenImg,
    prototypeToken: {
      texture: { src: tokenImg },
      name: heroData.name,
      displayName: 20,  // OWNER
    },
  };
  if (actor) {
    await actor.update(actorData);
    // Alte Spell-Items löschen vor Re-Import
    const oldSpells = actor.items.filter(i => i.type === "spell");
    if (oldSpells.length) await actor.deleteEmbeddedDocuments("Item", oldSpells.map(i => i.id));
  } else {
    actor = await Actor.create(actorData);
  }

  // ── 9. Zauber als spell-Items ────────────────────────────────────────────
  // gdsa: type="spell", system.att1/att2/att3, system.costs (nicht kosten), system.value
  const spellItems = heroData.spells.map(spell => ({
    name: spell.name,
    type: "spell",
    system: {
      att1:            spell.probe[0] || "",
      att2:            spell.probe[1] || "",
      att3:            spell.probe[2] || "",
      value:           spell.zfw,        // ZfW
      costs:           spell.kosten,     // gdsa nutzt 'costs', nicht 'kosten'
      repraesentation: spell.repraesentation || "",
      hauszauber:      spell.hauszauber ?? false,
    },
  }));

  if (spellItems.length > 0) {
    await actor.createEmbeddedDocuments("Item", spellItems);
  }

  return actor;
}

// ─── Registrierung ──────────────────────────────────────────────────────────

export function registerXMLImporter() {
  // ── Button im Actors-Panel (Sidebar) ──────────────────────────────────────
  Hooks.on("renderActorDirectory", (_app, html) => {
    if (html.find("#dsa-xml-import-btn").length) return; // nicht doppelt einfügen
    const btn = $(`
      <button type="button" id="dsa-xml-import-btn"
        style="width:100%;margin:4px 0;font-size:11px;padding:4px 8px;
               background:#16213e;border:1px solid #3a5e8a;color:#88ccff;cursor:pointer;border-radius:2px">
        <i class="fas fa-file-import"></i> Helden-Software XML importieren
      </button>
    `);
    btn.on("click", showImportDialog);
    // Vor der Actor-Liste einfügen
    const header = html.find(".directory-header, .directory-list").first();
    header.before(btn);
  });

  // ── Button in den Settings ────────────────────────────────────────────────
  Hooks.on("renderSettings", (_app, html) => {
    if (html.find("#dsa-pixel-import").length) return;
    const btn = $(`
      <button type="button" id="dsa-pixel-import" style="margin:4px 0;width:100%">
        <i class="fas fa-file-import"></i> Helden-Software Import (DSA Pixel-Art)
      </button>
    `);
    btn.on("click", showImportDialog);
    const target = html.find("#settings-game, .settings-list, section").last();
    target.append(btn);
  });

  console.log(`[${MODULE_ID}] ✓ XML-Importer registriert`);
}
