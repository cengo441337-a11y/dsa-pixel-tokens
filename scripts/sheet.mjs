/**
 * DSA Pixel-Art Character Sheet
 * Überschreibt das gdsa Standard-Sheet mit Pixel-Art Theme
 */

import { MODULE_ID, ATTRIBUTES, DERIVED_FORMULAS, RACE_GS, SPELL_EFFECT_MAP, COMBAT_MANEUVERS, resolveProbe, checkCritical, resolveActorAsP, lookupSpellEffect, parseAspCost, ALL_ZONES, ZONE_LABELS, ZONE_KEY_MAP, HIT_ZONE_TABLE, parseBeFormula, getRuestungsgewoehnung, calcIniPenalty, getWoundThresholds } from "./config.mjs";
import { castSpell } from "./magic.mjs";
import { openDatabaseBrowser } from "./db-browser.mjs";

// Akteur-ID → aktive Pfeilverzauberung { effect, impact, label, color }
const _arrowEnchants = new Map();

// Akteur-ID → ausstehender TP-Bonus (Wuchtschlag) für nächsten Schadenswurf
const _pendingTpBonus = new Map();

// Liste der DSA 4.1 Nachteile (Helden-Software exportiert alles als <vorteil>,
// wir muessen anhand der Namen unterscheiden)
const DSA_DISADVANTAGES = new Set([
  // Schlechte Eigenschaften (wuerfelbar)
  "Aberglaube", "Arroganz", "Eitelkeit", "Feigheit", "Geiz", "Goldgier",
  "Groessenwahn", "Größenwahn", "Jaehzorn", "Jähzorn", "Neid", "Neugier",
  "Rachsucht", "Streitsucht", "Totenangst", "Verschwendungssucht", "Verzehrer",
  "Weltfremd",
  // Koerperliche Nachteile
  "Einaeugig", "Einäugig", "Einarmig", "Einbeinig", "Blind", "Taub", "Stumm",
  "Kurzsichtig", "Kleinwuechsig", "Kleinwüchsig", "Kleinwuechsigkeit", "Kleinwüchsigkeit",
  "Zwergenwuchs", "Behaarung", "Haesslich", "Hässlich", "Lahm", "Glasknochen",
  "Blutrausch", "Chaosanfaellig", "Chaosanfällig", "Elfische Weltsicht",
  "Krankheitsanfaellig", "Krankheitsanfällig", "Schlafstoerung", "Schlafstörung",
  "Schlechter Geruchssinn", "Schlechtes Gedaechtnis", "Schlechtes Gedächtnis",
  "Schwaches Gehoer", "Schwaches Gehör", "Tollpatsch", "Unstet",
  // Soziale Nachteile
  "Niedrige Geburt", "Unfrei", "Randgruppe", "Schulden",
  "Moralkodex", "Ehrenkodex", "Prinzipientreue", "Pazifismus",
  "Sippenlos", "Persoenlichkeitsstoerung", "Persönlichkeitsstörung",
  // Mentale Nachteile
  "Angst vor [etwas]", "Angst vor", "Raumangst", "Hoehenangst", "Höhenangst",
  "Platzangst", "Wasserangst", "Moralkodex", "Vorurteile gegen",
  "Unheilig", "Weltfremd", "Stigma", "Verpflichtungen",
  // Magische Nachteile
  "Magieresistenz gesenkt", "Schwacher Astralkoerper", "Schwacher Astralkörper",
  "Keine Magie", "Zauberpause", "Unstete Magie", "Instabiler Geist",
  "Lichtscheu", "Wahrer Name",
  // Sonstige
  "Hohe Astralkraft verleugnet", "Unfaehigkeit fuer", "Unfähigkeit für",
  "Prinzipientreue",
]);

// Case-insensitive Check mit partial match (z.B. "Angst vor [Dunkelheit]" → matches "Angst vor")
function _isDisadvantage(name) {
  if (!name) return false;
  const nLow = name.toLowerCase().trim();
  // Exact match
  for (const d of DSA_DISADVANTAGES) {
    if (d.toLowerCase() === nLow) return true;
  }
  // Prefix match (fuer parametrisierte Nachteile wie "Angst vor [X]")
  const prefixes = ["angst vor", "vorurteile gegen", "unfaehigkeit fuer", "unfähigkeit für",
                    "behinderung", "schulden", "moralkodex"];
  for (const p of prefixes) {
    if (nLow.startsWith(p)) return true;
  }
  return false;
}

export class PixelArtCharacterSheet extends ActorSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["dsa-pixel-sheet", "sheet", "actor"],
      template: `modules/${MODULE_ID}/templates/sheet/character-sheet.hbs`,
      width: 740,
      height: 760,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "attributes" }],
      dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }],
      resizable: true,
    });
  }

  /** @override */
  async getData(options) {
    const data = await super.getData(options);
    const system = this.actor.system;

    // Foundry v12 super.getData() doesn't expose system at top level — set it explicitly
    data.system = system;
    data.actor  = this.actor;

    // ── Eigenschaften mit Labels ──
    data.attributes = {};
    for (const [key, meta] of Object.entries(ATTRIBUTES)) {
      data.attributes[key] = {
        ...meta,
        value: system[key]?.value ?? 0,
        temp:  system[key]?.temp ?? 0,
      };
    }

    // ── Abgeleitete Werte (INI, MR, WS, AT, PA, FK, AW, GS) ───────────────────
    // gdsa aktualisiert diese Felder nicht automatisch nach XML-Import oder
    // manueller Eigenschafts-Änderung. Wir berechnen sie aus den Attributen
    // und benutzen sie als Fallback, falls der Actor-Wert 0 ist — so bleibt
    // ein vom GM bewusst überschriebener Wert (z.B. SF-Boni) erhalten.
    const rawAttrs = {
      MU: data.attributes.MU.value, KL: data.attributes.KL.value,
      IN: data.attributes.IN.value, CH: data.attributes.CH.value,
      FF: data.attributes.FF.value, GE: data.attributes.GE.value,
      KO: data.attributes.KO.value, KK: data.attributes.KK.value,
    };
    // Race-based GS override (Waldelf = 9, Zwerg = 6, etc.)
    const raceGS = RACE_GS[system.race?.trim?.()] ?? RACE_GS[system.rasse?.trim?.()] ?? 8;
    // SF Ausweichen I/II/III geben +1/+2/+3 auf AW (WdS S.68)
    const sfList = system.sf ?? [];
    const awSFBonus = sfList.includes("Ausweichen III") ? 3
      : sfList.includes("Ausweichen II") ? 2
      : sfList.includes("Ausweichen I") ? 1 : 0;
    const computed = {
      INIBasis: DERIVED_FORMULAS.INIBasis(rawAttrs),
      MR:       DERIVED_FORMULAS.MR(rawAttrs),
      WS:       DERIVED_FORMULAS.WS(rawAttrs),
      ATBasis:  DERIVED_FORMULAS.ATBasis(rawAttrs),
      PABasis:  DERIVED_FORMULAS.PABasis(rawAttrs),
      FKBasis:  DERIVED_FORMULAS.FKBasis(rawAttrs),
      AW:       DERIVED_FORMULAS.AW(rawAttrs) + awSFBonus,
      GS:       raceGS,
    };
    // Clone + override so we don't mutate the live actor.system reference.
    const sysClone = foundry.utils.deepClone(system);
    // Object-shaped fields (gdsa: { value, mod }) — fallback when stored <= 0
    for (const key of ["INIBasis", "MR", "ATBasis", "PABasis", "FKBasis"]) {
      const existing = sysClone[key]?.value ?? 0;
      if (existing <= 0 && computed[key] > 0) {
        sysClone[key] = { ...(sysClone[key] ?? {}), value: computed[key] };
      }
    }
    // Scalar fields WS / Dogde — gdsa stores these as plain numbers and
    // misspells "Dodge" as "Dogde".
    if (!sysClone.WS || sysClone.WS <= 0) sysClone.WS = computed.WS;
    if (!sysClone.Dogde || sysClone.Dogde <= 0) sysClone.Dogde = computed.AW;
    // GS: gdsa always stores 8 (Mensch default) even for non-human races.
    // Override with the race-specific value whenever the stored GS matches
    // the default AND the race-lookup disagrees (so GMs who deliberately
    // hand-edit the field to non-8 keep their override).
    const storedGS = sysClone.GS?.value ?? 0;
    if (storedGS <= 0 || (storedGS === 8 && raceGS !== 8)) {
      sysClone.GS = { ...(sysClone.GS ?? {}), value: raceGS };
    }
    data.system = sysClone;
    data.derivedComputed = computed; // exposed for debug / tooltip display

    // ── Waffen, Rüstung, Schilde, Gegenstände ──
    const { weapons, armor, shields, items } = this._prepareItems();
    data.weapons = weapons;
    data.armor   = armor;
    data.shields = shields;
    data.items   = items;
    data.totalRS = armor.reduce((sum, a) => sum + (a.rs ?? 0), 0);
    data.totalBE = armor.reduce((sum, a) => sum + (a.be ?? 0), 0);  // raw BE (Anzeige)

    // ── Schild-Modifikatoren ──
    const shieldAtMod  = shields.reduce((s, sh) => s + (sh.atMod ?? 0), 0);
    const shieldPaMod  = shields.reduce((s, sh) => s + (sh.paMod ?? 0), 0);
    const shieldIniMod = shields.reduce((s, sh) => s + (sh.ini   ?? 0), 0);
    data.shieldAtMod = shieldAtMod;
    data.shieldPaMod = shieldPaMod;

    // ── Rüstungszonen-System (eBE auf gBE-Basis, Zonen-RS, INI-Malus) ──
    const armorCalc = this._prepareArmorZones(armor);
    data.eBE        = armorCalc.eBE;       // dezimal (z.B. 1.7)
    data.totalGBE   = armorCalc.totalGBE;  // dezimal gBE-Summe
    // Formatierte Anzeige (Dezimal nur wenn nötig, z.B. "2.1" statt "2.0999...")
    const _fmt = v => v % 1 === 0 ? String(v) : v.toFixed(1);
    data.totalGBEDisplay = _fmt(armorCalc.totalGBE);
    data.eBEDisplay      = _fmt(armorCalc.eBE);
    data.rg         = armorCalc.rg;
    data.zoneRS     = armorCalc.zoneRS;
    // INI-Malus: Rüstung + Schild (shieldIniMod ist negativ, z.B. -1)
    data.iniPenalty = armorCalc.iniPenalty + (shieldIniMod < 0 ? -shieldIniMod : 0);
    data.zoneLabels = ZONE_LABELS;
    data.allZones   = ALL_ZONES;

    // ── Wunden-System (persistent in Actor-Flags) ──
    const wounds = this.actor.getFlag("dsa-pixel-tokens", "wounds") ?? {};
    data.wounds     = wounds;                                                     // { kopf: 0, brust: 1, ... }
    data.totalWounds = Object.values(wounds).reduce((s, w) => s + (w || 0), 0);  // Summe aller Wunden
    data.woundPenalty = data.totalWounds;                                          // −1 pro Wunde auf alle Proben
    const ko = system.KO?.value ?? 10;
    const ws = getWoundThresholds(ko);
    data.woundThresholds = ws;   // { ws1, ws2, ws3 }

    // ── Talente nach Kategorien gruppieren (mit BE-Penalty für körperliche Talente) ──
    data.talentCategories = this._prepareTalents(data.eBE, data.woundPenalty);

    // ── Kampftalente (mit eBE-Penalty + Schild AT/PA-Mods + Wund-Penalty) ──
    data.combatTalents = this._prepareCombatTalents(data.eBE, shieldAtMod, shieldPaMod, data.woundPenalty);

    // ── Zauber ──
    data.spells = this._prepareSpells();

    // ── Vorteile, Nachteile, SF — aus system direkt (gdsa hat keinen Item-Typ dafür) ──
    data.advantages       = this._prepareVorteile("vorteile");
    data.disadvantages    = this._prepareVorteile("nachteile");
    data.specialAbilities = this._prepareSF();

    // ── Ritualfertigkeiten ──
    data.rituals = this._prepareRituals();

    // ── Kreatur-Daten aus Flags (abilities, spells, services etc. — nicht im gdsa-Schema) ──
    data.creature = this.actor.getFlag("dsa-pixel-tokens", "creature") ?? null;

    // ── Waffen-Ergänzung für Kreaturen: Flag-Waffen in weapons-Array einspeisen wenn leer ──
    if (data.creature?.weapons?.length && !data.weapons.length) {
      data.weapons = data.creature.weapons.map(w => ({
        name: w.name, tp: w.tp ?? "", reichweite: "—", talent: w.name,
      }));
    }

    // ── Natürlicher RS aus Flags (Kreatur-Naturpanzer) ──
    data.creatureRS = data.creature?.rs ?? 0;

    // ── totalRS und zoneRS um Naturpanzer ergänzen ──
    if (data.creatureRS > 0) {
      data.totalRS += data.creatureRS;
      for (const z of Object.keys(data.zoneRS)) {
        data.zoneRS[z] = (data.zoneRS[z] ?? 0) + data.creatureRS;
      }
    }

    return data;
  }

  // ─── Talente vorbereiten ──────────────────────────────────────────────

  _prepareTalents(eBE = 0, woundPenalty = 0) {
    const categories = {
      koerper:      { label: "Körpertalente",       talents: [] },
      gesellschaft: { label: "Gesellschaftstalente", talents: [] },
      natur:        { label: "Naturtalente",         talents: [] },
      wissen:       { label: "Wissenstalente",       talents: [] },
      handwerk:     { label: "Handwerkstalente",     talents: [] },
      sprachen:     { label: "Sprachen & Schriften", talents: [] },
    };

    // BE-Regeln für körperliche Talente aus armor-zones.json
    const physicalRules = globalThis.DSAPixelData?.armorZones?.beRules?.physicalTalents ?? {};

    // Talente aus system.talente (importiert per XML-Parser)
    const talente = this.actor.system?.talente ?? {};
    for (const [name, data] of Object.entries(talente)) {
      const cat = data.cat ?? "wissen";
      const target = categories[cat] ?? categories.wissen;

      // BE-Penalty für körperliche Talente berechnen
      let bePenalty = 0;
      if (cat === "koerper" && eBE > 0) {
        const formula = physicalRules[name];
        if (formula) {
          bePenalty = parseBeFormula(formula, eBE);
        }
      }

      target.talents.push({
        name,
        probe: data.probe ?? "",
        probeDisplay: data.probe ?? "",
        taw: data.value ?? 0,
        bePenalty,
      });
    }

    // Sort alphabetically within each category
    for (const cat of Object.values(categories)) {
      cat.talents.sort((a, b) => a.name.localeCompare(b.name, "de"));
    }

    return categories;
  }

  // ─── Kampftalente vorbereiten ─────────────────────────────────────────

  _prepareCombatTalents(eBE = 0, shieldAtMod = 0, shieldPaMod = 0, woundPenalty = 0) {
    const sys = this.actor.system;
    const talents = [];
    const atBase = sys.ATBasis?.value ?? 10;
    const paBase = sys.PABasis?.value ?? 10;
    const fkBase = sys.FKBasis?.value ?? 9;   // FK-Basis für Fernkampf

    // BE-Regeln für Kampftalente aus armor-zones.json
    const combatBeRules = globalThis.DSAPixelData?.armorZones?.beRules?.combatTalents ?? {};

    // gdsa speichert Kampftalente in system.skill[name]
    const RANGED = new Set(["Armbrust", "Blasrohr", "Bogen", "Diskus", "Schleuder",
                            "Wurfbeile", "Wurfmesser", "Wurfspeere"]);
    const skillMap = sys.skill ?? {};

    for (const [name, data] of Object.entries(skillMap)) {
      // Skip ritual keys
      if (name.startsWith("rit") || name === "liturgy") continue;
      if (!data || typeof data !== "object") continue;
      const taw = data.value === "" ? 0 : (Number(data.value) || 0);
      if (taw === 0) continue; // nur Talente mit echtem Wert

      const isRanged = RANGED.has(name);

      // DSA 4.1: Fernkampf AT = FK-Basis + TAW (voll), Nahkampf AT/PA = Basis + TAW/2
      // DSA 4.1: Explizite AT/PA-Werte nur verwenden wenn > 0,
      // sonst Basiswert + halber TAW berechnen (WdS S.61)
      const explicitAt = data.atk !== "" && data.atk != null && Number(data.atk) > 0;
      let at = explicitAt
        ? Number(data.atk)
        : isRanged
          ? fkBase + taw                      // FK: volles TAW addieren
          : atBase + Math.floor(taw / 2);     // NK: halbes TAW
      const explicitPa = data.def !== "" && data.def != null && Number(data.def) > 0;
      let pa = isRanged ? "-"
        : explicitPa
          ? Number(data.def)
          : paBase + Math.floor(taw / 2);

      // ── eBE-Penalty auf AT/PA anwenden (WdS Rüstungsbehinderung) ──
      // Berechne talent-spezifische eBE aus beRules
      const beFormula = combatBeRules[name];
      const talentEBE = beFormula ? parseBeFormula(beFormula, eBE) : eBE;

      let atPenalty = 0;
      let paPenalty = 0;
      // talentEBE kann dezimal sein (gBE-System) → erst abrunden, dann splitten
      const intEBE = Math.floor(talentEBE);
      if (intEBE > 0) {
        // eBE wird auf AT und PA aufgeteilt.
        // Bei ungerader eBE geht der größere Anteil auf PA (WdS S.63)
        atPenalty = Math.floor(intEBE / 2);
        paPenalty = Math.ceil(intEBE / 2);
        at -= atPenalty;
        if (typeof pa === "number") pa -= paPenalty;
      }

      // Schild-Modifikatoren anwenden (atMod typisch negativ, paMod positiv)
      at += shieldAtMod;
      if (typeof pa === "number") pa += shieldPaMod;

      // Wund-Penalty: −1 pro Wunde auf AT und PA (WdS Wundregeln)
      at -= woundPenalty;
      if (typeof pa === "number") pa -= woundPenalty;

      talents.push({
        name, taw,
        at, pa,
        // atBase/paBase = Wert ohne eBE-Penalty und ohne Schild-Mod (reiner Basiswert)
        atBase: at + atPenalty - shieldAtMod + woundPenalty,
        paBase: typeof pa === "number" ? pa + paPenalty - shieldPaMod + woundPenalty : pa,
        atPenalty, paPenalty,
        woundPenalty,
        shieldAtMod, shieldPaMod,
        eBE: talentEBE,
        tp:      data.tp      ?? "",   // Trefferpunkte/Schaden (Kreaturwaffen)
        special: data.special ?? "",   // Sondereigenschaften
      });
    }

    return talents.sort((a, b) => a.name.localeCompare(b.name, "de"));
  }

  // ─── Zauber vorbereiten ───────────────────────────────────────────────

  _prepareSpells() {
    const spells = [];

    for (const item of this.actor.items) {
      if (item.type !== "spell" && item.type !== "zauber") continue;
      const sys = item.system ?? {};

      const probe = [sys.att1, sys.att2, sys.att3].filter(Boolean);
      spells.push({
        id: item.id,
        name: item.name,
        probe,
        probeDisplay: probe.join("/"),
        zfw: Number(sys.zfw ?? sys.value ?? 0),
        kosten: sys.costs || sys.kosten || sys.cost
          || (globalThis.DSAPixelData?.spells?.find(s => s.name === item.name)?.kosten)
          || "?",
        hasEffect: true,
        effectType: lookupSpellEffect(item.name)?.type ?? null,
      });
    }

    return spells.sort((a, b) => a.name.localeCompare(b.name));
  }

  // ─── Items nach Typ ───────────────────────────────────────────────────

  _prepareItems() {
    const weapons = [];
    const armor   = [];
    const shields = [];
    const items   = [];

    for (const item of this.actor.items) {
      const sys = item.system ?? {};
      const type = item.type?.toLowerCase();

      // gdsa: all equipment is type "Gegenstand" (lowercase: "gegenstand")
      if (type === "gegenstand") {
        const itemType = sys.type ?? "";   // "melee", "range", "armor", "shield"
        const wep = sys.weapon ?? {};

        if (itemType === "melee" || itemType === "range") {
          weapons.push({
            id: item.id,
            name: item.name,
            tp: wep.damage ?? "",
            reichweite: itemType === "range"
              ? `${wep.range1 ?? ""}/${wep.range2 ?? ""}/${wep.range3 ?? ""} m`
              : (wep.DK ?? ""),
            talent: wep.type ?? "",
          });
        } else if (itemType === "armor") {
          const armor_data = sys.armor ?? {};
          armor.push({
            id: item.id,
            name: item.name,
            rs: armor_data.rs ?? 0,
            be: armor_data.be ?? 0,
          });
        } else if (itemType === "shield") {
          const shData = sys.shield ?? {};
          shields.push({
            id:    item.id,
            name:  item.name,
            atMod: shData.atMod ?? 0,
            paMod: shData.paMod ?? 0,
            ini:   shData.ini   ?? 0,
            bf:    shData.bf    ?? 0,
          });
        } else {
          items.push({
            id: item.id,
            name: item.name,
            quantity: sys.quantity ?? 1,
            weight: sys.weight ?? 0,
          });
        }
      } else if (type === "weapon" || type === "waffe") {
        weapons.push({
          id: item.id, name: item.name,
          tp: sys.tp ?? sys.damage ?? "",
          reichweite: sys.reichweite ?? sys.range ?? "",
          talent: sys.talent ?? "",
        });
      } else if (type === "armor" || type === "rüstung" || type === "ruestung") {
        armor.push({
          id: item.id, name: item.name,
          rs: sys.rs ?? sys.protection ?? 0,
          be: sys.be ?? sys.encumbrance ?? 0,
        });
      }
      // spells, rituals etc. are handled elsewhere — skip
    }

    return { weapons, armor, shields, items };
  }

  // ─── Rüstungszonen berechnen ────────────────────────────────────────

  /**
   * Berechnet Zonen-RS, eBE, und INI-Penalty aus ausgerüsteter Rüstung.
   * Matcht Rüstungsstücke des Characters gegen armor-zones.json Datenbank.
   * @param {Array} equippedArmor - Array aus _prepareItems() mit { name, rs, be }
   * @param {number} totalBE - Summe aller BE
   * @returns {{ eBE, rg, zoneRS, iniPenalty }}
   */
  _prepareArmorZones(equippedArmor) {
    const armorDb = globalThis.DSAPixelData?.armorZones?.armor ?? [];
    const rg = getRuestungsgewoehnung(this.actor);

    // gBE aus Datenbank auslesen und summieren (WdS: gewichtete BE, nicht rohe BE)
    // Fallback auf rohe BE wenn kein DB-Eintrag gefunden wird
    let totalGBE = 0;
    for (const piece of equippedArmor) {
      const dbEntry = armorDb.find(a => a.name.toLowerCase() === piece.name.toLowerCase());
      totalGBE += dbEntry?.gBE ?? piece.be ?? 0;
    }
    // gBE bleibt dezimal (z.B. 2.1) — NICHT runden!
    // eBE = gBE - Rüstungsgewöhnung (min 0), ebenfalls dezimal
    const eBE = Math.max(0, totalGBE - rg.beReduction);

    // Zonen-RS: Summiere RS pro Zone über alle ausgerüsteten Rüstungsteile
    const zoneRS = {};
    for (const z of ALL_ZONES) zoneRS[z] = 0;

    for (const piece of equippedArmor) {
      // Suche in armor-zones.json Datenbank nach dem Rüstungsnamen
      const dbEntry = armorDb.find(a =>
        a.name.toLowerCase() === piece.name.toLowerCase()
      );

      if (dbEntry?.zones) {
        // Zonen-RS aus Datenbank addieren
        for (const [zone, rs] of Object.entries(dbEntry.zones)) {
          if (zoneRS[zone] !== undefined) zoneRS[zone] += rs;
        }
      } else {
        // Fallback: Kein Eintrag in DB → flachen RS auf Brust/Bauch/Rücken verteilen
        zoneRS.brust   += piece.rs ?? 0;
        zoneRS.bauch   += piece.rs ?? 0;
        zoneRS.ruecken += piece.rs ?? 0;
      }
    }

    // INI-Penalty berechnen (auf Basis dezimaler gBE, floor intern)
    const iniPenalty = calcIniPenalty(totalGBE, rg);

    return { eBE, rg, zoneRS, iniPenalty, totalGBE };
  }

  _prepareVorteile(key) {
    const data = this.actor.system?.[key] ?? {};
    const entries = Object.entries(data).map(([name, val]) => ({
      name,
      value: (val !== null && val !== "" && val !== 0) ? val : null,
    }));

    // Helden-Software exportiert ALLES als <vorteil> — wir muessen Nachteile
    // anhand der bekannten DSA-Nachteil-Namen herausfiltern.
    const filtered = key === "vorteile"
      ? entries.filter(e => !_isDisadvantage(e.name))
      : entries.filter(e => _isDisadvantage(e.name));

    // Bei "nachteile"-Aufruf: falls data leer ist, aus vorteile die Nachteile extrahieren
    if (key === "nachteile" && filtered.length === 0) {
      const vorteile = this.actor.system?.vorteile ?? {};
      return Object.entries(vorteile).filter(([n]) => _isDisadvantage(n)).map(([name, val]) => ({
        name,
        value: (val !== null && val !== "" && val !== 0) ? val : null,
      })).sort((a, b) => a.name.localeCompare(b.name, "de"));
    }

    return filtered.sort((a, b) => a.name.localeCompare(b.name, "de"));
  }

  _prepareSF() {
    const sf = this.actor.system?.sf ?? [];
    if (Array.isArray(sf)) return sf.map(name => ({ name })).sort((a, b) => a.name.localeCompare(b.name, "de"));
    return Object.keys(sf).map(name => ({ name })).sort((a, b) => a.name.localeCompare(b.name, "de"));
  }

  _getItemsByType(...types) {
    return this.actor.items
      .filter(i => types.includes(i.type?.toLowerCase()))
      .map(i => ({ name: i.name, value: i.system?.value ?? i.system?.stufe ?? null }));
  }

  // ─── Ritualfertigkeiten ───────────────────────────────────────────────

  _prepareRituals() {
    const sys = this.actor.system;
    const skillMap = sys.skill ?? {};
    const ritualNames = {
      ritgild: "Gildenmagie", ritscha: "Scharlatanerie", ritalch: "Alchimie",
      ritkris: "Kristallomantie", rithexe: "Hexerei", ritdrui: "Druidenritual",
      ritgeod: "Geodenritual", ritzibi: "Zibilja", ritdurr: "Durrorkhum",
      ritderw: "Derwische", rittanz: "Tanzteufel", ritbard: "Bardenmusik",
      ritgruf: "Grüffelo", ritgban: "Geisterbanner", ritgbin: "Geisterbindung",
      ritgauf: "Geisteraufruf", ritpetr: "Petrificatus", liturgy: "Liturgien",
    };
    const rituals = [];
    for (const [key, name] of Object.entries(ritualNames)) {
      const data = skillMap[key];
      if (!data) continue;
      const val = data.value === "" ? 0 : (Number(data.value) || 0);
      if (val > 0) rituals.push({ name, value: val });
    }
    return rituals;
  }

  // ─── Hilfsfunktionen ──────────────────────────────────────────────────

  _formatProbe(probe) {
    if (!probe) return "";
    if (Array.isArray(probe)) return probe.join("/");
    return String(probe);
  }

  // ─── Event Listeners ──────────────────────────────────────────────────

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    if (!this.isEditable) return;

    // Rollable elements
    html.find(".rollable[data-roll]").on("click", this._onRoll.bind(this));

    // Resource bar click (on text) → edit dialog
    html.find(".clickable-bar").on("click", this._onResourceClick.bind(this));

    // +/- buttons on resource bars
    html.find(".res-btn").on("click", this._onResourceStep.bind(this));

    // Regeneration buttons
    html.find(".regen-btn").on("click", this._onRegen.bind(this));

    // Datenbank-Browser öffnen (⚔️/🛡️/✨/⚗️ Buttons)
    html.find("[data-action='open-db']").on("click", this._onOpenDbBrowser.bind(this));

    // Wund-Reset Button
    html.find(".wound-reset-btn").on("click", async (e) => {
      e.preventDefault();
      await this.actor.setFlag("dsa-pixel-tokens", "wounds", {});
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div class="dsa-pixel-chat"><div class="chat-title">✚ Wunden geheilt</div>
          <div class="result-line result-success">Alle Wunden vollständig geheilt.</div></div>`,
      });
      this.render();
    });
  }

  _onOpenDbBrowser(event) {
    event.preventDefault();
    const tab = event.currentTarget.dataset.dbTab ?? "waffen";
    openDatabaseBrowser(this.actor, tab);
  }

  _onResourceStep(event) {
    event.preventDefault();
    const btn  = event.currentTarget;
    const path = btn.dataset.path;
    const max  = parseInt(btn.dataset.max) || 999;
    const step = btn.classList.contains("res-plus") ? 1 : -1;
    const cur  = foundry.utils.getProperty(this.actor, path) ?? 0;
    this.actor.update({ [path]: Math.max(0, Math.min(max, cur + step)) });
  }

  async _onRegen(event) {
    event.preventDefault();
    const action = event.currentTarget.dataset.action;
    const sys = this.actor.system;
    const regen = sys.regen ?? {};

    // ── Kurze Rast (10 min) ──────────────────────────────────────────
    if (action === "regen-rast") {
      const roll = new Roll("1d6");
      await roll.evaluate();
      const newAuP = Math.min(sys.AuP.max, (sys.AuP.value ?? 0) + roll.total);
      await this.actor.update({ "system.AuP.value": newAuP });
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div class="dsa-pixel-chat">
          <div class="chat-title">⏸ Kurze Rast</div>
          <div class="dice-row"><div class="die success">${roll.total}</div></div>
          <div class="result-line result-success">+${roll.total} AuP → ${newAuP}/${sys.AuP.max}</div>
        </div>`,
        rolls: [roll],
      });

    // ── Nachtschlaf ──────────────────────────────────────────────────
    } else if (action === "regen-nacht") {
      // AuP: voll
      const newAuP = sys.AuP.max;
      const updates = { "system.AuP.value": newAuP };
      let chatLines = `<div class="result-line result-success">AuP voll → ${newAuP}/${sys.AuP.max}</div>`;

      // AsP: 1W6 + Astrale Regeneration Stufe
      if (sys.AsP?.max) {
        const astraleBonus = regen.astraleReg ?? 0;
        const formula = astraleBonus > 0 ? `1d6+${astraleBonus}` : "1d6";
        const aspRoll = new Roll(formula);
        await aspRoll.evaluate();
        const newAsP = Math.min(sys.AsP.max, (sys.AsP.value ?? 0) + aspRoll.total);
        updates["system.AsP.value"] = newAsP;
        const dieVal = aspRoll.terms[0].total ?? aspRoll.terms[0].results?.[0]?.result ?? aspRoll.total;
        chatLines += `<div class="result-line result-success">
          +${aspRoll.total} AsP (1W6${astraleBonus > 0 ? `+${astraleBonus} Astr.Reg.` : ""})
          → ${newAsP}/${sys.AsP.max}
        </div>`;
      }

      // KaP: 1W6 (falls vorhanden)
      if (sys.KaP?.max) {
        const kapRoll = new Roll("1d6");
        await kapRoll.evaluate();
        const newKaP = Math.min(sys.KaP.max, (sys.KaP.value ?? 0) + kapRoll.total);
        updates["system.KaP.value"] = newKaP;
        chatLines += `<div class="result-line result-success">+${kapRoll.total} KaP → ${newKaP}/${sys.KaP.max}</div>`;
      }

      await this.actor.update(updates);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div class="dsa-pixel-chat"><div class="chat-title">🌙 Nachtschlaf</div>${chatLines}</div>`,
      });

    // ── Meditation (Große Meditation / Regeneration I-III) ───────────
    } else if (action === "regen-meditation") {
      if (!sys.AsP?.max) {
        ui.notifications.warn("Keine AsP vorhanden.");
        return;
      }
      const regStufe = regen.regStufe ?? 0;
      if (regStufe === 0) {
        ui.notifications.warn("Keine Regenerations-SF vorhanden.");
        return;
      }

      // Meditation-Probe: KL/IN/CH (Selbstbeherrschung-ähnlich)
      const stufeName = regStufe >= 3 ? "Meisterliche Regeneration"
                      : regStufe === 2 ? "Regeneration II" : "Regeneration I";
      const formula = `${regStufe}d6`;

      // Probe würfeln (KL/IN/CH, TaW aus Selbstbeherrschung)
      const klVal = sys.KL?.value ?? 10;
      const inVal = sys.IN?.value ?? 10;
      const chVal = sys.CH?.value ?? 10;
      const attrs = [klVal, inVal, chVal];

      const probeRoll = new Roll("3d20");
      await probeRoll.evaluate();
      const dice = probeRoll.terms[0].results.map(r => r.result);

      // TaP*-Berechnung (vereinfacht: TaW = 14 Selbstbeherrschung als Basis)
      const selfTaW = sys.talente?.Selbstbeherrschung?.value ?? 14;
      let tap = selfTaW;
      for (let i = 0; i < 3; i++) {
        if (dice[i] > attrs[i]) tap -= (dice[i] - attrs[i]);
      }
      const success = tap >= 0;

      let chatLines = "";
      const diceHtml = dice.map((d, i) => {
        const over = d > attrs[i];
        const cls = d === 1 ? "crit" : d === 20 ? "fumble" : over ? "fail" : "success";
        return `<div class="die ${cls}" title="KL/IN/CH ${attrs[i]}">${d}</div>`;
      }).join("");
      chatLines += `<div class="dice-row">${diceHtml}</div>`;

      if (success) {
        const aspRoll = new Roll(formula);
        await aspRoll.evaluate();
        const newAsP = Math.min(sys.AsP.max, (sys.AsP.value ?? 0) + aspRoll.total);
        await this.actor.update({ "system.AsP.value": newAsP });
        chatLines += `<div class="result-line result-success">Meditation gelungen (TaP* ${tap})</div>`;
        chatLines += `<div class="result-line result-success">+${aspRoll.total} AsP (${formula}) → ${newAsP}/${sys.AsP.max}</div>`;
      } else {
        chatLines += `<div class="result-line result-fail">Meditation misslungen (TaP* ${tap})</div>`;
      }

      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div class="dsa-pixel-chat">
          <div class="chat-title">🧘 ${stufeName}</div>
          ${chatLines}
        </div>`,
      });

    // ── Vollständige Regeneration ────────────────────────────────────
    } else if (action === "regen-voll") {
      const updates = {
        "system.LeP.value": sys.LeP.max,
        "system.AuP.value": sys.AuP.max,
      };
      if (sys.AsP?.max) updates["system.AsP.value"] = sys.AsP.max;
      if (sys.KaP?.max) updates["system.KaP.value"] = sys.KaP.max;
      await this.actor.update(updates);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div class="dsa-pixel-chat"><div class="chat-title">★ Vollständige Regeneration</div>
          <div class="result-line result-crit">Alle Ressourcen vollständig wiederhergestellt!</div></div>`,
      });
    }
  }

  /** Aktuelle Wund-Penalty berechnen (Summe aller Wunden, −1 pro Wunde) */
  _getWoundPenalty() {
    const wounds = this.actor.getFlag("dsa-pixel-tokens", "wounds") ?? {};
    return Object.values(wounds).reduce((s, w) => s + (w || 0), 0);
  }

  /** Zeigt die Pixel-Wuerfel-Animation ueber dem Actor-Token. */
  _animateDice(values, faces = 20) {
    if (typeof DSAPixelTokens === "undefined" || !DSAPixelTokens.showDiceAnimation) return;
    const token = this.actor.getActiveTokens()[0];
    if (!token) return;
    const { x, y } = token.center;
    const grid = canvas.grid?.size ?? 100;
    const arr = Array.isArray(values) ? values : [values];
    const dieType = `d${faces}`;
    for (let i = 0; i < arr.length; i++) {
      const offsetX = (i - (arr.length - 1) / 2) * grid * 0.75;
      setTimeout(() => {
        DSAPixelTokens.showDiceAnimation(x + offsetX, y - grid * 0.5, arr[i], dieType);
      }, i * 120);
    }
  }

  async _onRoll(event) {
    event.preventDefault();
    const el   = event.currentTarget;
    const type = el.dataset.roll;

    switch (type) {
      case "attribute":     return this._rollAttribute(el.dataset.attr);
      case "talent":        return this._rollTalent(el.dataset);
      case "attack":        return this._rollAttack(el.dataset);
      case "parry":         return this._rollParry(el.dataset);
      case "dodge":         return this._rollDodge(el.dataset);
      case "spell":         return this._rollSpell(el.dataset);
      case "damage":        return this._rollDamage(el.dataset);
      case "disadvantage":  return this._rollDisadvantage(el.dataset);
    }
  }

  // ─── Eigenschaftsprobe (1W20) ─────────────────────────────────────────

  async _rollAttribute(attrKey) {
    const val = this.actor.system[attrKey]?.value ?? 10;
    const label = ATTRIBUTES[attrKey]?.label ?? attrKey;

    // Wund-Penalty automatisch dazu
    const wp = this._getWoundPenalty();
    const wpHint = wp > 0 ? ` [Wunden +${wp}]` : "";

    // Dialog für Modifikator
    const mod = await this._askModifier(`Probe auf ${label} (${val})${wpHint}`);
    if (mod === null) return; // Abbruch

    const roll = new Roll("1d20");
    await roll.evaluate();
    const die = roll.total;
    this._animateDice(die, 20);
    const target = val - mod - wp;
    const success = die <= target;
    const crit = die === 1;
    const fumble = die === 20;

    // Chat
    const flavor = `<div class="dsa-pixel-chat">
      <div class="chat-title">${label}-Probe</div>
      <div class="dice-row">
        <div class="die ${crit ? "crit" : fumble ? "fumble" : success ? "success" : "fail"}">${die}</div>
      </div>
      <div class="result-line ${crit ? "result-crit" : success ? "result-success" : "result-fail"}">
        ${crit ? "KRITISCH!" : fumble ? "PATZER!" : success ? "Bestanden" : "Misslungen"}
        ${mod !== 0 ? ` (Mod: ${mod >= 0 ? "+" : ""}${mod})` : ""}
      </div>
    </div>`;

    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor,
    });

    // VFX
    if (typeof DSAPixelTokens !== "undefined") {
      const token = this.actor.getActiveTokens()[0];
      if (token) {
        if (crit) DSAPixelTokens.spawnEffect(token.center.x, token.center.y, "heilung");
        else if (fumble) DSAPixelTokens.spawnEffect(token.center.x, token.center.y, "schadenflash");
      }
    }
  }

  // ─── Talentprobe (3W20) ───────────────────────────────────────────────

  // ─── Schlechte Eigenschaft / Nachteil (1W20 ≤ Wert = triggert) ────────

  async _rollDisadvantage(dataset) {
    const name  = dataset.name ?? "Nachteil";
    const value = parseInt(dataset.value) || 0;

    // Modifikator-Dialog (Schlechte Eigenschaften koennen durch SL-Entscheidung +/- modifiziert sein)
    const mod = await this._askModifier(`${name} (${value}) — Probe auf schlechte Eigenschaft`);
    if (mod === null) return;

    const target = value + mod; // +Mod = leichter triggern (entspricht schlechter fuer Held)
    const roll = new Roll("1d20");
    await roll.evaluate();
    const die = roll.total;
    this._animateDice(die, 20);
    const triggers = die <= target;
    const autoTrigger = die === 1;
    const autoResist  = die === 20;

    let resultText, resultCls;
    if (autoTrigger) {
      resultText = "KRITISCH! Nachteil triggert heftig";
      resultCls  = "result-fail";
    } else if (autoResist) {
      resultText = "Held widersteht!";
      resultCls  = "result-success";
    } else if (triggers) {
      resultText = `Nachteil triggert — ${name} greift`;
      resultCls  = "result-fail";
    } else {
      resultText = `Held widersteht — ${name} greift nicht`;
      resultCls  = "result-success";
    }

    const dieClass = autoTrigger ? "fumble" : autoResist ? "crit" : triggers ? "fail" : "success";
    const modLine = mod !== 0
      ? `<div class="dsa-mod-hint">Wert ${value}${mod >= 0 ? " +" : " "}${mod} = Ziel ${target}</div>`
      : `<div class="dsa-mod-hint">Ziel ${value}</div>`;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="dsa-pixel-chat">
        <div class="chat-title">⚠ ${name} (Schlechte Eigenschaft)</div>
        <div class="dice-row"><div class="die ${dieClass}">${die}</div></div>
        ${modLine}
        <div class="result-line ${resultCls}">${resultText}</div>
      </div>`,
    });
  }

  async _rollTalent(dataset) {
    const name = dataset.talent;
    const taw  = parseInt(dataset.taw) || 0;
    const probeStr = dataset.probe || "";
    const probeAttrs = probeStr.split("/").map(a => a.trim());

    // Eigenschaftswerte auslesen
    const attrs = probeAttrs.map(a => this.actor.system[a]?.value ?? 10);

    // BE-Penalty für körperliche Talente automatisch ermitteln
    const physicalRules = globalThis.DSAPixelData?.armorZones?.beRules?.physicalTalents ?? {};
    const armorData = this._prepareItems();
    const totalBE = armorData.armor.reduce((sum, a) => sum + (a.be ?? 0), 0);
    const rg = getRuestungsgewoehnung(this.actor);
    const currentEBE = Math.max(0, totalBE - rg.beReduction);
    const beFormula = physicalRules[name];
    const bePenalty = beFormula ? parseBeFormula(beFormula, currentEBE) : 0;

    // Dialog (zeige BE + Wund-Penalty im Titel)
    const wp = this._getWoundPenalty();
    const beHint = bePenalty > 0 ? ` [BE +${bePenalty}]` : "";
    const wpHint = wp > 0 ? ` [Wunden +${wp}]` : "";
    const mod = await this._askModifier(`${name} (${probeStr}) — TaW ${taw}${beHint}${wpHint}`);
    if (mod === null) return;

    // Gesamtmodifikator = User-Mod + automatischer BE-Malus + Wund-Penalty
    const totalMod = mod + bePenalty + wp;

    const roll = new Roll("3d20");
    await roll.evaluate();
    const dice = roll.terms[0].results.map(r => r.result);
    this._animateDice(dice, 20);

    // Probe auswerten (mit BE-Penalty als Erschwernis)
    const result = resolveProbe(dice, attrs, taw, totalMod);
    const crit   = checkCritical(dice);

    // Chat
    const diceHtml = dice.map((d, i) => {
      const over = d > attrs[i];
      const is1 = d === 1;
      const is20 = d === 20;
      const cls = is1 ? "crit" : is20 ? "fumble" : over ? "fail" : "success";
      return `<div class="die ${cls}" title="${probeAttrs[i]} ${attrs[i]}">${d}</div>`;
    }).join("");

    let resultText, resultClass;
    if (crit.patzer) {
      resultText = "PATZER!";
      resultClass = "result-fail";
    } else if (crit.gluecklich) {
      resultText = "GLÜCKLICH!";
      resultClass = "result-crit";
    } else if (result.success) {
      resultText = "Bestanden";
      resultClass = "result-success";
    } else {
      resultText = "Misslungen";
      resultClass = "result-fail";
    }

    const modParts = [];
    if (mod !== 0) modParts.push(`Mod: ${mod >= 0 ? "+" : ""}${mod}`);
    if (bePenalty > 0) modParts.push(`BE: +${bePenalty}`);
    if (wp > 0) modParts.push(`Wunden: +${wp}`);
    const modLine = modParts.length > 0
      ? `<div style="text-align:center;font-size:13px;color:#888">${modParts.join(" · ")}</div>`
      : "";

    const flavor = `<div class="dsa-pixel-chat">
      <div class="chat-title">${name}</div>
      <div class="dice-row">${diceHtml}</div>
      <div class="result-line ${resultClass}">${resultText}</div>
      ${result.success ? `<div class="tap-star">TaP*: <span>${result.tapStar}</span></div>` : ""}
      ${modLine}
    </div>`;

    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor,
    });

    // VFX
    if (typeof DSAPixelTokens !== "undefined") {
      const token = this.actor.getActiveTokens()[0];
      if (token) {
        if (crit.patzer) DSAPixelTokens.spawnEffect(token.center.x, token.center.y, "schadenflash");
        else if (crit.gluecklich) DSAPixelTokens.spawnEffect(token.center.x, token.center.y, "heilung");
      }
    }
  }

  // ─── Angriff (1W20 vs AT) ─────────────────────────────────────────────

  static RANGED_TALENTS = new Set([
    "Armbrust","Blasrohr","Bogen","Diskus","Schleuder",
    "Wurfbeile","Wurfmesser","Wurfspeere"
  ]);

  // DSA 4.1 Trefferzone (W20)
  static ZONE_TABLE = [
    "", "Kopf","Kopf","Kopf",
    "Brust","Brust","Brust","Brust","Brust",
    "Bauch","Bauch","Bauch","Bauch",
    "r. Arm","r. Arm","l. Arm","l. Arm",
    "r. Bein","r. Bein","l. Bein","l. Bein"
  ];

  // AT-Erschwernis für gezielte Angriffe
  static ZONE_PENALTIES = {
    "Kopf": 8, "Brust": 0, "Bauch": 0,
    "r. Arm": 4, "l. Arm": 4, "r. Bein": 4, "l. Bein": 4
  };

  // DSA 4.1 Patzer-Tabelle (W6)
  static FUMBLE_TABLE = [
    "",
    "Waffe verloren / fallen gelassen",
    "Waffe verloren / fallen gelassen",
    "Gestolpert – nächste Runde -2 auf AT/PA",
    "Gestolpert – nächste Runde -2 auf AT/PA",
    "Selbst verletzt – 1W6 SP",
    "Waffenbruch oder schwere Handverletzung",
  ];

  async _rollAttack(dataset) {
    const talent   = dataset.talent;
    const at       = parseInt(dataset.at) || 0;
    const taw      = parseInt(dataset.taw) || 0;
    const isRanged = PixelArtCharacterSheet.RANGED_TALENTS.has(talent);
    const icon     = isRanged ? "🏹" : "⚔";

    const opts = await this._askAttackOptions(`${icon} ${talent}`, at, taw);
    if (opts === null) return;
    const { maneuver = "normal", ansage = 0, mod, targetZone } = opts;

    const sf          = COMBAT_MANEUVERS[maneuver] ?? COMBAT_MANEUVERS.normal;

    // SF-Validierung: Prüfen ob nötige Sonderfertigkeit vorhanden (WdS)
    if (sf.requiresSF && !hasSF(sf.requiresSF)) {
      ui.notifications.warn(`${sf.label} benötigt SF "${sf.requiresSF}"! Manöver nicht verfügbar.`);
      return;
    }

    const zonePenalty = targetZone ? (PixelArtCharacterSheet.ZONE_PENALTIES[targetZone] ?? 0) : 0;
    const effectiveAT = at + (sf.atBase ?? 0) - ansage - mod - zonePenalty;

    // ── Erster Wurf ──────────────────────────────────────────────────
    const roll = new Roll("1d20");
    await roll.evaluate();
    const die    = roll.total;
    this._animateDice(die, 20);
    const success = die <= effectiveAT;
    const crit   = die === 1;
    const fumble = die === 20;

    // ── Bestätigungswurf (Krit / Patzer) ─────────────────────────────
    let confirmDie = null, confirmedCrit = false, confirmedFumble = false;
    if (crit || fumble) {
      const confirmRoll = new Roll("1d20");
      await confirmRoll.evaluate();
      confirmDie     = confirmRoll.total;
      confirmedCrit  = crit   && confirmDie <= effectiveAT;
      confirmedFumble = fumble && confirmDie > effectiveAT;
    }

    // ── Trefferzone ──────────────────────────────────────────────────
    const hit = (success && !fumble) || confirmedCrit;
    let hitZone = null;
    if (hit) {
      if (targetZone) {
        hitZone = targetZone; // Gezielter Angriff: Zone gesetzt
      } else {
        const zoneRoll = new Roll("1d20");
        await zoneRoll.evaluate();
        hitZone = PixelArtCharacterSheet.ZONE_TABLE[zoneRoll.total];
      }
    }

    // ── Patzer-Tabelle ───────────────────────────────────────────────
    let fumbleOutcome = null;
    if (confirmedFumble) {
      const fRoll = new Roll("1d6");
      await fRoll.evaluate();
      fumbleOutcome = PixelArtCharacterSheet.FUMBLE_TABLE[fRoll.total];
    }

    // ── Manöver-Effekt berechnen ─────────────────────────────────────
    const sfRaw = this.actor.system?.sonderfertigkeiten ?? this.actor.system?.sf ?? [];
    const hasSF = (name) => {
      if (!name) return true;
      const sfLow = name.toLowerCase();
      if (Array.isArray(sfRaw)) {
        return sfRaw.some(entry => {
          const val = typeof entry === "string" ? entry : (entry?.name ?? "");
          return val.toLowerCase() === sfLow;
        });
      }
      return Object.keys(sfRaw).some(k => k.toLowerCase() === sfLow);
    };

    let maneuverLine = "";
    if (hit && maneuver !== "normal" && sf.effect !== "none") {
      switch (sf.effect) {
        case "tp_bonus": {
          // Wuchtschlag: +½Ansage TP (ohne SF), +Ansage TP (mit SF Wuchtschlag) — WdS S.66
          const full = hasSF("Wuchtschlag");
          const bonus = full ? ansage : Math.floor(ansage / 2);
          if (bonus > 0) {
            const bLabel = full ? `+${bonus} TP Wuchtschlag` : `+${bonus} TP Wuchtschlag (½, keine SF)`;
            _pendingTpBonus.set(this.actor.id, { bonus, label: bLabel });
            maneuverLine = `<div class="dsa-maneuver-effect" style="color:#ffd700">⚡ ${bLabel} → wird auf nächsten Schadenswurf angerechnet</div>`;
          }
          break;
        }
        case "pa_reduce": {
          // Finte: gegnerische PA −Ansage
          if (ansage > 0)
            maneuverLine = `<div class="dsa-maneuver-effect" style="color:#4ad94a">🗡 Finte: Gegner PA −${ansage} für diese Abwehr</div>`;
          break;
        }
        case "gezielter_stich": {
          _pendingTpBonus.set(this.actor.id, { bonus: 0, label: "Gezielter Stich", ignoreRS: 2, autoWounds: 1 });
          maneuverLine = `<div class="dsa-maneuver-effect" style="color:#e94560">🎯 Gezielter Stich: −2 RS, auto +1 Wunde! → nächster Schadenswurf</div>`;
          break;
        }
        case "knockdown": {
          if (ansage > 0)
            maneuverLine = `<div class="dsa-maneuver-effect" style="color:#4ad94a">💥 Niederwerfen: Gegner KK-Probe +${ansage} Erschwernis</div>`;
          else
            maneuverLine = `<div class="dsa-maneuver-effect" style="color:#4ad94a">💥 Niederwerfen: Gegner KK-Probe ablegen!</div>`;
          break;
        }
        case "rush_damage": {
          // Sturmangriff: TP + ½GS + 4 + Ansage; RS ignoriert (WdS S.65)
          const gs = this.actor.system?.GS?.value ?? this.actor.system?.gs ?? 8;
          const bonus = Math.floor(gs / 2) + 4 + ansage;
          _pendingTpBonus.set(this.actor.id, { bonus, label: `+${bonus} TP Sturmangriff`, ignoreRS: true });
          maneuverLine = `<div class="dsa-maneuver-effect" style="color:#ffd700">⚡ Sturmangriff: +${bonus} TP, RS ignoriert! → nächster Schadenswurf</div>`;
          break;
        }
        case "todessto": {
          _pendingTpBonus.set(this.actor.id, { bonus: 0, label: "Todesstoß", ignoreRS: true, autoWounds: 2, reduceWS: 2 });
          maneuverLine = `<div class="dsa-maneuver-effect" style="color:#e94560">☠ Todesstoß: RS ignoriert, WS−2, +2 auto Wunden! → nächster Schadenswurf</div>`;
          break;
        }
        case "split_at": {
          maneuverLine = `<div class="dsa-maneuver-effect" style="color:#4a90d9">⚔⚔ Klingensturm: Schaden auf 2 Gegner</div>`;
          break;
        }
      }
    }

    // Passierschlag-Button bei fehlgeschlagenem Manöver (Sturmangriff/Todestoß)
    const failed = !hit || confirmedFumble;
    let passierschlagBtn = "";
    if (failed && sf.passierschlagOnFail) {
      passierschlagBtn = `<div style="margin-top:6px">
        <button class="dsa-pixel-btn" data-action="passierschlag" data-attacker="${this.actor.id}"
          style="background:#16213e;border:2px solid #e94560;color:#e94560;font-family:'VT323',monospace;font-size:14px;padding:3px 10px;cursor:pointer">
          ⚔ Passierschlag (Verteidiger)
        </button>
      </div>`;
    }

    // ── Manöver-Label für Titel ───────────────────────────────────────
    const maneuverLabel = maneuver !== "normal" ? ` [${sf.label}${ansage > 0 ? ` +${ansage}` : ""}]` : "";

    // ── Chat-Nachricht bauen ─────────────────────────────────────────
    const dieClass  = crit ? "crit" : fumble ? "fumble" : success ? "success" : "fail";
    const confirmClass = confirmedCrit ? "crit" : confirmedFumble ? "fumble" : "fail";

    let resultText, resultCls;
    if (confirmedCrit)    { resultText = "KRITISCHER TREFFER! (Schaden ×2)"; resultCls = "result-crit"; }
    else if (crit)        { resultText = "Krit nicht bestätigt – normaler Treffer"; resultCls = "result-success"; }
    else if (confirmedFumble) { resultText = "PATZER BESTÄTIGT!"; resultCls = "result-fail"; }
    else if (fumble)      { resultText = "Patzer nicht bestätigt – Daneben"; resultCls = "result-fail"; }
    else if (success)     { resultText = "Treffer!"; resultCls = "result-success"; }
    else                  { resultText = "Daneben!"; resultCls = "result-fail"; }

    const modParts = [];
    if (sf.atBase) modParts.push(`${sf.label} ${sf.atBase}`);
    if (ansage > 0) modParts.push(`Ansage −${ansage}`);
    if (mod !== 0)  modParts.push(`Mod ${mod >= 0 ? "+" : ""}${mod}`);
    if (zonePenalty > 0) modParts.push(`Zone −${zonePenalty}`);
    const modLine = modParts.length
      ? `<div class="dsa-mod-hint">${modParts.join(" · ")} · Ziel ${effectiveAT}</div>`
      : "";

    const confirmLine = confirmDie !== null
      ? `<div class="dsa-confirm-row">Bestätigung: <span class="die ${confirmClass}" style="font-size:0.8em">${confirmDie}</span> ${confirmedCrit ? "✓ Bestätigt" : confirmedFumble ? "✗ Bestätigt" : "– nicht bestätigt"}</div>`
      : "";
    // Zonen-RS des Ziels ermitteln (falls Ziel selektiert)
    let zoneRSHint = "";
    if (hitZone) {
      const zoneKey = ZONE_KEY_MAP[hitZone];
      if (zoneKey) {
        const tgtActor = [...game.user.targets][0]?.actor;
        if (tgtActor) {
          // Zonen-RS aus Ziel-Actor berechnen
          const tgtArmorDb = globalThis.DSAPixelData?.armorZones?.armor ?? [];
          let tgtZoneRS = 0;
          for (const item of tgtActor.items) {
            const iSys = item.system ?? {};
            const iType = iSys.type ?? item.type?.toLowerCase() ?? "";
            if (iType === "armor" || iType === "shield" || iType === "rüstung" || iType === "ruestung") {
              const dbEntry = tgtArmorDb.find(a => a.name.toLowerCase() === item.name.toLowerCase());
              if (dbEntry?.zones?.[zoneKey]) tgtZoneRS += dbEntry.zones[zoneKey];
              else tgtZoneRS += (iSys.armor?.rs ?? iSys.rs ?? 0);
            }
          }
          if (tgtZoneRS > 0) zoneRSHint = ` (RS ${tgtZoneRS})`;
        }
      }
    }
    const zoneLine  = hitZone
      ? `<div class="dsa-zone-badge ${targetZone ? "zone-gezielt" : ""}">${targetZone ? "🎯" : "🎲"} ${hitZone}${zoneRSHint}</div>`
      : "";
    const fumbleLine = fumbleOutcome
      ? `<div class="dsa-fumble-outcome">⚠ ${fumbleOutcome}</div>`
      : "";

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="dsa-pixel-chat">
        <div class="chat-title">${icon} ${talent}${maneuverLabel}</div>
        <div class="dice-row"><div class="die ${dieClass}">${die}</div></div>
        ${modLine}${confirmLine}
        <div class="result-line ${resultCls}">${resultText}</div>
        ${zoneLine}${maneuverLine}${fumbleLine}${passierschlagBtn}
      </div>`,
    });

    // ── Sound + VFX ──────────────────────────────────────────────────
    const _AudioHelper = foundry.audio?.AudioHelper ?? AudioHelper;
    const SND = (f, vol = 0.7) => _AudioHelper.play({
      src: `modules/dsa-pixel-tokens/assets/sounds/${f}`, volume: vol, loop: false
    });

    const srcToken = this.actor.getActiveTokens()[0];
    const tgtToken = [...game.user.targets][0];
    const enchant  = isRanged ? _arrowEnchants.get(this.actor.id) : null;
    if (enchant) _arrowEnchants.delete(this.actor.id);

    if (confirmedFumble) {
      // Patzer-Sound sofort
      SND("fumble.wav", 0.8);
      if (srcToken && typeof DSAPixelTokens !== "undefined")
        DSAPixelTokens.spawnEffect(srcToken.center.x, srcToken.center.y, "schadenflash");

    } else if (isRanged && srcToken && tgtToken) {
      // Fernkampf: Abschuss-Sound sofort, Einschlag-Sound verzögert nach Flugzeit
      SND("arrow_release.wav", 0.6);
      const dist      = Math.hypot(tgtToken.center.x - srcToken.center.x, tgtToken.center.y - srcToken.center.y);
      const travelMs  = Math.max(120, Math.round((dist / 10) * (1000 / 60)));
      if (hit) {
        setTimeout(() => SND(confirmedCrit ? "hit_armor.wav" : "hit_impact.wav", 0.8), travelMs);
      }
      // VFX
      if (typeof DSAPixelTokens !== "undefined") {
        const projEffect = enchant?.effect ?? "pfeil";
        const hitImpact  = hit ? (enchant?.impact ?? "schadenflash") : null;
        DSAPixelTokens.spawnProjectile(srcToken, tgtToken, projEffect, hitImpact);
        if (confirmedCrit) setTimeout(() =>
          DSAPixelTokens.spawnEffect(tgtToken.center.x, tgtToken.center.y, "blitz"), travelMs + 50);
      }

    } else if (!isRanged) {
      // Nahkampf: Sound sofort
      if (hit) {
        SND(confirmedCrit ? "hit_armor.wav" : "hit_impact.wav", 0.8);
      } else {
        SND("miss.wav", 0.5);
      }
      if (typeof DSAPixelTokens !== "undefined") {
        if (hit && tgtToken) DSAPixelTokens.spawnEffect(tgtToken.center.x, tgtToken.center.y, "schadenflash");
        if (confirmedCrit && srcToken) DSAPixelTokens.spawnEffect(srcToken.center.x, srcToken.center.y, "heilung");
      }
    }
  }

  // ─── Parade (1W20 vs PA) ──────────────────────────────────────────────

  async _rollParry(dataset) {
    const talent = dataset.talent;
    const pa     = parseInt(dataset.pa) || 0;

    // Manöver-Auswahl für Parade (Meisterparade, Binden, Gegenhalten)
    const paManeuvers = Object.entries(COMBAT_MANEUVERS)
      .filter(([, m]) => m.paOnly)
      .map(([k, m]) => {
        const sfNote = m.requiresSF ? ` [SF nötig]` : "";
        return `<option value="${k}" style="background:#0d1b2e;color:#e0e0e0">${m.label}${sfNote}</option>`;
      }).join("");

    // Schild prüfen (für "Sehr großer Gegner"-Regel)
    const hasShield = this.actor.items.some(i => (i.system?.type ?? "").toLowerCase() === "shield");

    const paResult = await new Promise((resolve) => {
      new Dialog({
        title: `Parade: ${talent}`,
        content: `
          <div class="dsa-mod-dialog" style="padding:10px;color-scheme:dark">
            <div class="dsa-mod-title">Parade: ${talent} (PA ${pa})</div>
            <div style="margin:6px 0">
              <label style="font-family:'VT323',monospace;font-size:15px;color:#bbb">Variante:</label>
              <select id="pa-maneuver" style="font-family:'VT323',monospace;font-size:15px;background:#0d1b2e;border:2px solid #3a3a5e;color:#e0e0e0;width:100%;color-scheme:dark">
                <option value="normal" style="background:#0d1b2e;color:#e0e0e0">Normale Parade</option>
                ${paManeuvers}
              </select>
            </div>
            <div id="pa-ansage-row" style="display:none;margin:6px 0">
              <div style="display:flex;align-items:center;gap:8px">
                <label style="font-family:'VT323',monospace;font-size:15px;color:#4a90d9">Ansage (0–${pa}):</label>
                <input type="number" id="pa-ansage" value="0" min="0" max="${pa}"
                  style="width:50px;text-align:center;font-family:'VT323',monospace;font-size:18px;background:rgba(0,0,0,0.4);border:2px solid #4a90d9;color:#4a90d9" />
              </div>
            </div>
            <div id="pa-maneuver-desc" style="font-size:12px;color:#888;font-family:'VT323',monospace;margin-top:4px"></div>
            <div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.08)">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-family:'VT323',monospace;font-size:14px;color:#bbb">
                <input type="checkbox" id="pa-big-enemy" style="width:14px;height:14px" />
                Sehr großer Gegner (GK II+)
              </label>
              <div id="pa-big-enemy-warn" style="display:none;margin-top:4px;padding:4px 6px;background:rgba(233,69,96,0.15);border:1px solid #e94560;border-radius:3px;font-size:12px;color:#e94560;font-family:'VT323',monospace">
                ${hasShield
                  ? "⚠ Schild vorhanden — Parade möglich (WdH S.160)"
                  : "⛔ Kein Schild! Parade gegen sehr große Gegner nicht möglich. → Ausweichen verwenden!"}
              </div>
            </div>
          </div>
        `,
        buttons: {
          roll: { icon: '<i class="fas fa-shield-alt"></i>', label: "Parieren",
            callback: (html) => resolve({
              paManeuver: html.find("#pa-maneuver").val() ?? "normal",
              paAnsage:   parseInt(html.find("#pa-ansage").val()) || 0,
              bigEnemy:   html.find("#pa-big-enemy").is(":checked"),
            })
          },
          cancel: { label: "Abbruch", callback: () => resolve(null) },
        },
        default: "roll",
        close: () => resolve(null),
        render: (html) => {
          html.find("#pa-maneuver").on("change", () => {
            const key = html.find("#pa-maneuver").val();
            const m   = COMBAT_MANEUVERS[key];
            html.find("#pa-maneuver-desc").text(m?.desc ?? "");
            html.find("#pa-ansage-row").toggle(!!(m?.ansage));
          });
          html.find("#pa-big-enemy").on("change", () => {
            html.find("#pa-big-enemy-warn").toggle(html.find("#pa-big-enemy").is(":checked"));
          });
        }
      }).render(true);
    });

    if (!paResult) return; // Abbruch
    const { paManeuver, paAnsage, bigEnemy } = paResult;

    // Sehr großer Gegner + kein Schild → Parade verboten
    if (bigEnemy && !hasShield) {
      ui.notifications.warn("Parade gegen sehr große Gegner ohne Schild nicht möglich! Nutze Ausweichen.");
      return;
    }

    const sfPA = COMBAT_MANEUVERS[paManeuver];
    const effectivePA = pa - paAnsage + (sfPA?.atBase ?? 0);

    const roll = new Roll("1d20");
    await roll.evaluate();
    const die     = roll.total;
    this._animateDice(die, 20);
    const success = die <= effectivePA;
    const luckyPA = die === 1; // Glückliche Parade: bestätigen nötig

    // Bestätigung für Glückliche Parade (WdS S.85)
    let confirmedLucky = false;
    if (luckyPA) {
      const confirmRoll = new Roll("1d20");
      await confirmRoll.evaluate();
      confirmedLucky = confirmRoll.total <= effectivePA;
    }

    let resultText = success ? "Pariert!" : "Nicht pariert!";
    let resultCls  = success ? "result-success" : "result-fail";
    let extraLine  = "";

    if (die === 20) {
      resultText = "PATZER!"; resultCls = "result-fail";
    } else if (confirmedLucky) {
      resultText = "GLÜCKLICHE PARADE! (Freie Aktion)";
      resultCls  = "result-crit";
      extraLine  = `<div class="dsa-maneuver-effect" style="color:#ffd700">✨ Freie Aktion bleibt erhalten!</div>`;
    } else if (luckyPA) {
      resultText = "1 gewürfelt – aber nicht bestätigt, normaler Erfolg";
    }

    // Meisterparade-Effekt bei Erfolg
    if (success && paManeuver === "meisterparade" && paAnsage > 0) {
      extraLine += `<div class="dsa-maneuver-effect" style="color:#4a90d9">🛡 Meisterparade: nächste Aktion +${paAnsage}</div>`;
    }
    if (success && paManeuver === "binden" && paAnsage > 0) {
      extraLine += `<div class="dsa-maneuver-effect" style="color:#4a90d9">⛓ Binden: eigene AT+${paAnsage}, gegn. PA−${paAnsage}</div>`;
    }
    if (success && paManeuver === "gegenhalten") {
      extraLine += `<div class="dsa-maneuver-effect" style="color:#4ad94a">↩ Gegenhalten: Gegenangriff AT−4 sofort möglich</div>`;
    }

    const modHint = paAnsage > 0
      ? `<div class="dsa-mod-hint">Meisterparade Ansage −${paAnsage} · Ziel ${effectivePA}</div>`
      : "";

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="dsa-pixel-chat">
        <div class="chat-title">🛡 Parade: ${talent}${paManeuver !== "normal" ? ` [${sfPA?.label ?? ""}]` : ""}</div>
        <div class="dice-row">
          <div class="die ${die === 1 ? "crit" : die === 20 ? "fumble" : success ? "success" : "fail"}">${die}</div>
        </div>
        ${modHint}
        <div class="result-line ${resultCls}">${resultText}</div>
        ${extraLine}
      </div>`,
    });
  }

  // ─── Ausweichen (1W20 vs AW) ─────────────────────────────────────────

  async _rollDodge(dataset) {
    const sys    = this.actor.system;
    // AW-Wert: aus System (gdsa: system.Dogde) oder manuell berechnen
    const awBase = parseInt(dataset.aw) || (sys.Dogde ?? Math.floor((sys.PABasis?.value ?? 10) / 2));

    // eBE aus Rüstung berechnen (Dezimalwert)
    const { armor } = this._prepareItems();
    const armorCalc = this._prepareArmorZones(armor);
    const eBE = armorCalc.eBE;

    // eBE-Penalty:
    //   Normales Ausweichen (Freie Aktion):  eBE/2 abgerundet — WdH S.182
    //   Gezieltes Ausweichen (Volle Aktion): volle eBE abgerundet
    const eBEPenaltyNormal  = Math.floor(eBE / 2);
    const eBEPenaltyGezielt = Math.floor(eBE);

    // Default-Modus aus Klick-Kontext (normaler Button vs. gezielter Button)
    const defaultMode = dataset.dodgeMode ?? "normal";

    const result = await new Promise((resolve) => {
      new Dialog({
        title: "Ausweichen",
        content: `
          <div class="dsa-mod-dialog" style="padding:10px;color-scheme:dark">
            <div class="dsa-mod-title">Ausweichen (AW ${awBase}${eBE > 0 ? ` · eBE ${eBE % 1 === 0 ? eBE : eBE.toFixed(1)}` : ""})</div>
            <div style="margin:6px 0">
              <label style="font-family:'VT323',monospace;font-size:15px;color:#bbb">Variante:</label>
              <select id="dodge-mode" style="font-family:'VT323',monospace;font-size:15px;background:#0d1b2e;border:2px solid #3a3a5e;color:#e0e0e0;width:100%;color-scheme:dark">
                <option value="normal" ${defaultMode === "normal" ? "selected" : ""}>Normales Ausweichen (Freie Aktion) — Ziel ${Math.max(0, awBase - eBEPenaltyNormal)}</option>
                <option value="gezielt" ${defaultMode === "gezielt" ? "selected" : ""}>Gezieltes Ausweichen (Volle Aktion) — +Ansage</option>
              </select>
            </div>
            <div id="dodge-ansage-row" style="display:${defaultMode === "gezielt" ? "block" : "none"};margin:6px 0">
              <div style="display:flex;align-items:center;gap:8px">
                <label style="font-family:'VT323',monospace;font-size:15px;color:#4a90d9">Ansage (0–${awBase}):</label>
                <input type="number" id="dodge-ansage" value="0" min="0" max="${awBase}"
                  style="width:50px;text-align:center;font-family:'VT323',monospace;font-size:18px;background:rgba(0,0,0,0.4);border:2px solid #4a90d9;color:#4a90d9" />
              </div>
              <div style="font-size:12px;color:#888;font-family:'VT323',monospace;margin-top:2px">
                Effektiver AW = ${awBase} + Ansage − eBE (${eBEPenaltyGezielt})
              </div>
            </div>
            <div style="margin-top:8px;font-size:12px;color:#667;font-family:'VT323',monospace;line-height:1.5">
              Normal: AW − ½eBE (freie Aktion) · Gezielt: AW + Ansage − eBE (volle Aktion)<br>
              <span style="color:#e94560">Sehr große Gegner (GK II+): Parade ohne Schild nicht möglich → nur Ausweichen!</span>
            </div>
          </div>
        `,
        buttons: {
          roll: { icon: '<i class="fas fa-person-running"></i>', label: "Ausweichen",
            callback: (html) => resolve({
              mode:   html.find("#dodge-mode").val() ?? "normal",
              ansage: parseInt(html.find("#dodge-ansage").val()) || 0,
            })
          },
          cancel: { label: "Abbruch", callback: () => resolve(null) },
        },
        default: "roll",
        close: () => resolve(null),
        render: (html) => {
          html.find("#dodge-mode").on("change", () => {
            const m = html.find("#dodge-mode").val();
            html.find("#dodge-ansage-row").toggle(m === "gezielt");
          });
        }
      }).render(true);
    });

    if (!result) return; // Abbruch
    const { mode, ansage } = result;
    const isGezielt = mode === "gezielt";

    // Effektiver AW
    const eBEPenalty = isGezielt ? eBEPenaltyGezielt : eBEPenaltyNormal;
    const effectiveAW = Math.max(0, awBase - eBEPenalty + (isGezielt ? ansage : 0));

    // ── Würfelwurf ────────────────────────────────────────────────────
    const roll = new Roll("1d20");
    await roll.evaluate();
    const die     = roll.total;
    this._animateDice(die, 20);
    const success = die <= effectiveAW;
    const crit    = die === 1;
    const fumble  = die === 20;

    // Bestätigungswurf (Glückliches Ausweichen / Patzer)
    let confirmDie = null, confirmedLucky = false, confirmedFumble = false;
    if (crit || fumble) {
      const confirmRoll = new Roll("1d20");
      await confirmRoll.evaluate();
      confirmDie      = confirmRoll.total;
      confirmedLucky  = crit   && confirmDie <= effectiveAW;
      confirmedFumble = fumble && confirmDie >  effectiveAW;
    }

    // ── Ergebnis ──────────────────────────────────────────────────────
    let resultText, resultCls;
    if (confirmedLucky) {
      resultText = "GLÜCKLICHES AUSWEICHEN! (Freie Aktion bleibt erhalten)";
      resultCls  = "result-crit";
    } else if (crit) {
      resultText = "1 — nicht bestätigt, normales Ausweichen";
      resultCls  = "result-success";
    } else if (confirmedFumble) {
      resultText = "PATZER BESTÄTIGT!";
      resultCls  = "result-fail";
    } else if (fumble) {
      resultText = "20 — nicht bestätigt, Daneben!";
      resultCls  = "result-fail";
    } else if (success) {
      resultText = "Ausgewichen!";
      resultCls  = "result-success";
    } else {
      resultText = "Nicht ausgewichen!";
      resultCls  = "result-fail";
    }

    // ── Chat ──────────────────────────────────────────────────────────
    const modeLabel = isGezielt
      ? `Gezieltes Ausweichen${ansage > 0 ? ` [+${ansage}]` : ""}`
      : "Ausweichen";

    const actionNote = isGezielt
      ? `<div class="dsa-maneuver-effect" style="color:#aaa">Volle Aktion verbraucht</div>`
      : confirmedLucky
        ? `<div class="dsa-maneuver-effect" style="color:#ffd700">✨ Freie Aktion — nächste Aktion bleibt erhalten!</div>`
        : `<div class="dsa-maneuver-effect" style="color:#88aacc">Freie Aktion</div>`;

    const modParts = [];
    if (eBEPenalty > 0) modParts.push(`eBE −${eBEPenalty}`);
    if (isGezielt && ansage > 0) modParts.push(`Ansage +${ansage}`);
    const modLine = `<div class="dsa-mod-hint">${[...modParts, `Ziel ${effectiveAW}`].join(" · ")}</div>`;

    const confirmLine = confirmDie !== null
      ? `<div class="dsa-confirm-row">Bestätigung: <span class="die ${confirmedLucky ? "crit" : confirmedFumble ? "fumble" : "fail"}" style="font-size:0.8em">${confirmDie}</span> ${confirmedLucky ? "✓ Bestätigt" : confirmedFumble ? "✗ Bestätigt" : "– nicht bestätigt"}</div>`
      : "";

    const dieClass = crit ? "crit" : fumble ? "fumble" : success ? "success" : "fail";

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="dsa-pixel-chat">
        <div class="chat-title">🏃 ${modeLabel}</div>
        <div class="dice-row"><div class="die ${dieClass}">${die}</div></div>
        ${modLine}${confirmLine}
        <div class="result-line ${resultCls}">${resultText}</div>
        ${actionNote}
      </div>`,
    });

    // Sound
    const SND = (f, vol = 0.6) => AudioHelper.play({
      src: `modules/dsa-pixel-tokens/assets/sounds/${f}`, volume: vol, loop: false,
    });
    if (success || confirmedLucky) SND("miss.wav", 0.5);
  }

  // ─── Zauberprobe (vollständiger Ablauf via castSpell) ─────────────────

  async _rollSpell(dataset) {
    const name     = dataset.spell;
    const zfw      = parseInt(dataset.zfw) || 0;
    const kosten   = dataset.kosten || "?";
    const probeStr = dataset.probe || "";
    const probe    = probeStr.split(",").map(a => a.trim()).filter(Boolean);

    // Varianten aus globalen Daten (geladen via loadDataFiles in module.mjs)
    const spellDb = globalThis.DSAPixelData?.spells ?? [];
    const spellEntry = spellDb.find(s => s.name === name);

    await castSpell(this.actor, {
      name,
      probe,
      zfw,
      kosten,
      varianten: spellEntry?.varianten ?? [],
      zauberdauer: spellEntry?.zauberdauer ?? null,
      wirkungsdauer: spellEntry?.wirkungsdauer ?? null,
    });
  }

  // (Legacy _rollSpellLegacy + _placeZoneTemplate entfernt — castSpell in magic.mjs übernimmt)

  // ─── Schadenswurf ─────────────────────────────────────────────────────

  async _rollDamage(dataset) {
    const weaponName = dataset.weapon;
    const rawTp = dataset.tp || "1d6";
    // DSA "3W6+8" → Foundry "3d6+8", "1W+4" → "1d6+4", "2W20" → "2d20"
    const tp = rawTp.replace(/(\d*)W(\d*)([+-]\d+)?/gi, (_, count, sides, bonus) =>
      `${count || "1"}d${sides || "6"}${bonus || ""}`);

    // Ausstehenden TP-Bonus (Wuchtschlag, Sturmangriff, Todesstoß etc.) verbrauchen
    const pending = _pendingTpBonus.get(this.actor.id);
    if (pending) _pendingTpBonus.delete(this.actor.id);
    const bonusTP = pending?.bonus ?? 0;

    const roll = new Roll(tp);
    await roll.evaluate();
    const total = roll.total + bonusTP;

    // ── Trefferzone würfeln (1W20) ──────────────────────────────────────
    const zoneRoll = new Roll("1d20");
    await zoneRoll.evaluate();
    const hitZone = HIT_ZONE_TABLE[zoneRoll.total] ?? "brust";
    const hitZoneLabel = ZONE_LABELS[hitZone] ?? hitZone;

    // ── RS des Ziels: Zonen-RS der getroffenen Zone ─────────────────────
    const _getTargetZoneRS = (actor, zone) => {
      if (!actor) return 0;
      // Kreatur: RS aus Flags (alle Zonen gleich = natürlicher RS)
      const creatureFlag = actor.getFlag("dsa-pixel-tokens", "creature");
      if (creatureFlag?.rs !== undefined) return creatureFlag.rs;
      // Spielercharakter: Zonen-RS aus Rüstungs-Items berechnen
      const armorDb = globalThis.DSAPixelData?.armorZones?.armor ?? [];
      let zoneRS = 0;
      for (const item of actor.items) {
        const t = item.type?.toLowerCase();
        const sys = item.system ?? {};
        let armorName = null;
        if (t === "gegenstand" && sys.type === "armor") armorName = item.name;
        else if (t === "armor" || t === "rüstung" || t === "ruestung") armorName = item.name;
        if (!armorName) continue;
        // In armor-zones.json nachschlagen für Zonen-RS
        const dbEntry = armorDb.find(a => a.name.toLowerCase() === armorName.toLowerCase());
        if (dbEntry?.zones?.[zone] !== undefined) {
          zoneRS += dbEntry.zones[zone];
        } else {
          // Fallback: roher RS auf Brust/Bauch/Rücken
          const rs = sys.armor?.rs ?? sys.rs ?? 0;
          if (["brust", "bauch", "ruecken"].includes(zone)) zoneRS += rs;
        }
      }
      return zoneRS;
    };

    // Ziel: erstes markiertes Token, sonst kein RS-Abzug
    const targetToken = game.user.targets.first();
    const targetActor = targetToken?.actor ?? null;
    let targetRS = _getTargetZoneRS(targetActor, hitZone);

    // ignoreRS-Manöver berücksichtigen
    if (pending?.ignoreRS === true)  targetRS = 0;
    if (typeof pending?.ignoreRS === "number") targetRS = Math.max(0, targetRS - pending.ignoreRS);

    const sp = Math.max(0, total - targetRS);

    // ── Auto-SP-Abzug: LeP des Ziels reduzieren + Wunden prüfen ────────
    let lepLine = "";
    if (targetActor && sp > 0) {
      const oldLeP = targetActor.system?.LeP?.value ?? 0;
      const newLeP = Math.max(0, oldLeP - sp);
      await targetActor.update({ "system.LeP.value": newLeP });

      // ── Wunden-Check (WdS Wundregeln) ──────────────────────────────
      const ko = targetActor.system?.KO?.value ?? 10;
      const ws = getWoundThresholds(ko);
      // Manöver-Modifikation: Todesstoß → WS−2
      const wsReduce = pending?.reduceWS ?? 0;
      const effWS1 = Math.max(1, ws.ws1 - wsReduce);
      const effWS2 = Math.max(2, ws.ws2 - wsReduce);
      const effWS3 = Math.max(3, ws.ws3 - wsReduce);

      let newWounds = 0;
      if (sp >= effWS3)      newWounds = 3;
      else if (sp >= effWS2) newWounds = 2;
      else if (sp >= effWS1) newWounds = 1;

      // Auto-Wunden aus Manövern (Gezielter Stich +1, Todesstoß +2)
      newWounds += pending?.autoWounds ?? 0;

      // Wunden persistent auf Actor-Flag speichern (pro Zone)
      let woundLine = "";
      if (newWounds > 0) {
        const existingWounds = targetActor.getFlag("dsa-pixel-tokens", "wounds") ?? {};
        const zoneKey = hitZone;
        const oldZoneWounds = existingWounds[zoneKey] ?? 0;
        existingWounds[zoneKey] = oldZoneWounds + newWounds;
        await targetActor.setFlag("dsa-pixel-tokens", "wounds", existingWounds);

        const totalWounds = Object.values(existingWounds).reduce((s, w) => s + (w || 0), 0);
        const zoneTotal = existingWounds[zoneKey];

        woundLine = `<div style="font-size:13px;text-align:center;margin-top:3px;padding:3px 6px;background:rgba(255,51,51,0.15);border:1px solid rgba(255,51,51,0.4);border-radius:3px;color:#ff4444">
          ${"💀".repeat(newWounds)} +${newWounds} Wunde${newWounds > 1 ? "n" : ""} (${hitZoneLabel})
          <span style="color:#aaa;font-size:11px">· Zone ${zoneTotal} · Gesamt ${totalWounds} · WS ${ws.ws1}/${ws.ws2}/${ws.ws3}</span>
          ${zoneTotal >= 3 ? `<div style="color:#ff0000;font-weight:bold;margin-top:2px">⛔ ${hitZoneLabel} UNBRAUCHBAR!</div>` : ""}
          <div style="color:#e94560;font-size:11px;margin-top:1px">Alle Proben −${totalWounds}</div>
        </div>`;
      }

      lepLine = `<div style="font-size:13px;text-align:center;margin-top:4px;padding:3px 6px;background:rgba(233,69,96,0.15);border:1px solid rgba(233,69,96,0.3);border-radius:3px">
        💔 ${targetActor.name}: ${oldLeP} → <strong style="color:#e94560">${newLeP}</strong> LeP
        ${newLeP === 0 ? `<span style="color:#ff4444;font-weight:bold"> — KAMPFUNFÄHIG!</span>` : ""}
      </div>${woundLine}`;
    }

    // ── Chat zusammenstellen ─────────────────────────────────────────────
    const effects = [];
    if (bonusTP > 0) effects.push(`${pending.label}`);
    if (pending?.ignoreRS === true) effects.push("RS ignoriert!");
    if (typeof pending?.ignoreRS === "number") effects.push(`−${pending.ignoreRS} RS`);
    if (pending?.autoWounds) effects.push(`+${pending.autoWounds} auto Wunden`);
    if (pending?.reduceWS) effects.push(`WS −${pending.reduceWS}`);

    const bonusLine = effects.length > 0
      ? `<div style="font-size:13px;color:#ffd700;text-align:center">${effects.join(" · ")}</div>
         ${bonusTP > 0 ? `<div style="text-align:center;color:#888;font-size:12px">${roll.total} + ${bonusTP} = ${total} TP</div>` : ""}`
      : "";

    // Trefferzone + RS-Zeile
    const zoneLine = `<div style="font-size:13px;text-align:center;margin-top:4px">
      🎯 <span style="color:#7eb8ff;font-weight:bold">${hitZoneLabel}</span>
      <span style="color:#556;font-size:11px">(${zoneRoll.total})</span>
    </div>`;

    const rsLine = targetActor
      ? `<div style="font-size:12px;color:#888;text-align:center;margin-top:2px">
           ${total} TP − ${targetRS} RS
           <span style="color:#7eb8ff">${hitZoneLabel}</span>
           <span style="color:#aaa">(${targetActor.name})</span>
         </div>
         <div style="font-size:20px;color:#e94560;font-weight:bold;text-align:center">
           = ${sp} SP
         </div>`
      : `<div style="font-size:11px;color:#556;text-align:center;margin-top:2px">
           Kein Ziel markiert — RS nicht abgezogen
         </div>`;

    const flavor = `<div class="dsa-pixel-chat">
      <div class="chat-title">⚔ Schaden: ${weaponName}</div>
      <div class="result-line"><span style="font-size:22px;color:var(--fx-accent-red)">${total} TP</span></div>
      ${bonusLine}
      ${zoneLine}
      ${rsLine}
      ${lepLine}
    </div>`;

    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor,
    });
  }

  // ─── Modifikator-Dialog ───────────────────────────────────────────────

  // ─── Zonen-Template platzieren ───────────────────────────────────────

  async _placeZoneTemplate(spellName, mapping, casterToken) {
    // Farbe aus effect-mapping (0xRRGGBB → #RRGGBB)
    const rawColor = mapping?.color;
    const hexColor = rawColor
      ? "#" + rawColor.toString(16).padStart(6, "0")
      : "#4488ff";

    // Vorschlagswerte je Mapping
    const defaultRadius = mapping?.radius ?? 4;
    const defaultShape  = mapping?.shape  ?? "circle";

    const opts = await new Promise(resolve => {
      const dlg = new Dialog({
        title: `Zone: ${spellName}`,
        content: `
          <div class="dsa-mod-dialog">
            <div class="dsa-mod-title">${spellName}</div>
            <div class="dsa-spell-info">
              <span class="si-probe" style="border-color:${hexColor};color:${hexColor}">Zoneneffekt</span>
            </div>

            <div class="dsa-spmod-label">Form</div>
            <div class="dsa-mod-presets" style="justify-content:center">
              <button class="dsa-preset zone-shape ${defaultShape==="circle"?"active":""}" data-shape="circle">⬤ Kreis</button>
              <button class="dsa-preset zone-shape ${defaultShape==="cone"?"active":""}"   data-shape="cone">◥ Kegel</button>
              <button class="dsa-preset zone-shape ${defaultShape==="ray"?"active":""}"    data-shape="ray">→ Strahl</button>
              <button class="dsa-preset zone-shape ${defaultShape==="rect"?"active":""}"   data-shape="rect">■ Feld</button>
            </div>

            <div class="dsa-spmod-label" style="margin-top:8px">Radius / Länge (Meter)</div>
            <div class="dsa-mod-row">
              <button class="dsa-step" id="z-minus">−</button>
              <input type="number" id="z-radius" value="${defaultRadius}" min="1" max="50" />
              <button class="dsa-step" id="z-plus">+</button>
            </div>

            <div class="dsa-mod-hint">Klick auf Canvas zum Platzieren</div>
          </div>
        `,
        buttons: {
          place:  { icon: '<i class="fas fa-map-marker-alt"></i>', label: "Platzieren",
            callback: (html) => resolve({
              shape:  html.find(".zone-shape.active").data("shape") || "circle",
              radius: parseInt(html.find("#z-radius").val()) || 4,
            })
          },
          cancel: { label: "Abbruch", callback: () => resolve(null) },
        },
        default: "place",
        close: () => resolve(null),
        render: (html) => {
          html.find(".zone-shape").on("click", e => {
            html.find(".zone-shape").removeClass("active");
            $(e.currentTarget).addClass("active");
          });
          html.find("#z-minus").on("click", () =>
            html.find("#z-radius").val(Math.max(1, (parseInt(html.find("#z-radius").val())||4) - 1)));
          html.find("#z-plus").on("click", () =>
            html.find("#z-radius").val(Math.min(50, (parseInt(html.find("#z-radius").val())||4) + 1)));
        }
      });
      dlg.render(true);
    });

    if (!opts) return;

    // Template-Startposition: Mitte des Caster-Tokens, oder Canvas-Mitte
    const cx = casterToken?.center?.x ?? canvas.dimensions.width  / 2;
    const cy = casterToken?.center?.y ?? canvas.dimensions.height / 2;

    // Foundry-Einheit (grid = Meter in DSA)
    const gridSize = canvas.dimensions.distance; // z.B. 1 (1 Grid = 1m)

    const templateData = {
      t:           opts.shape,
      x:           cx,
      y:           cy,
      distance:    opts.radius,
      angle:       opts.shape === "cone" ? 60 : undefined,
      width:       opts.shape === "ray"  ? 2  : undefined,
      fillColor:   hexColor,
      borderColor: hexColor,
      flags: { "dsa-pixel-tokens": { spell: spellName } },
    };

    // Template erstellen
    const [template] = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [templateData]);

    // Template-Layer aktivieren und das neue Template selektieren damit User es verschieben kann
    canvas.templates.activate();
    if (template) {
      const placeable = canvas.templates.get(template.id);
      if (placeable) placeable.control({ releaseOthers: true });
    }

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="dsa-pixel-chat">
        <div class="chat-title">🔮 ${spellName}</div>
        <div class="result-line result-success">
          Zone platziert — ${opts.shape === "circle" ? "Kreis" : opts.shape === "cone" ? "Kegel" : opts.shape === "ray" ? "Strahl" : "Feld"}
          ${opts.radius}m
        </div>
        <div style="text-align:center;font-size:7px;color:#556688;margin-top:4px">
          Template selektiert — ziehen zum Verschieben, Entf zum Löschen
        </div>
      </div>`,
    });
  }

  // ─── Angriffs-Dialog mit Modifier + Gezielter Angriff ────────────────────
  async _askAttackOptions(title, at, taw = 0) {
    const zones = [
      { name: "Kopf",   penalty: 8,  icon: "👤" },
      { name: "Brust",  penalty: 0,  icon: "🫀" },
      { name: "Bauch",  penalty: 0,  icon: "🟤" },
      { name: "r. Arm", penalty: 4,  icon: "💪" },
      { name: "l. Arm", penalty: 4,  icon: "💪" },
      { name: "r. Bein",penalty: 4,  icon: "🦵" },
      { name: "l. Bein",penalty: 4,  icon: "🦵" },
    ];
    const zoneHtml = zones.map(z => {
      const eff = at - z.penalty;
      const cls = z.penalty === 0 ? "zone-normal" : z.penalty <= 4 ? "zone-medium" : "zone-hard";
      return `<button class="dsa-zone-btn ${cls}" data-zone="${z.name}" title="AT ${eff} (−${z.penalty})">
        <span class="zone-icon">${z.icon}</span>
        <span class="zone-name">${z.name}</span>
        <span class="zone-penalty">${z.penalty > 0 ? `−${z.penalty}` : "±0"}</span>
      </button>`;
    }).join("");

    // Nur AT-Manöver (kein paOnly), kein Passierschlag im normalen Dialog
    const maneuvers = Object.entries(COMBAT_MANEUVERS)
      .filter(([k, m]) => !m.paOnly && k !== "passierschlag")
      .map(([key, m]) => {
        const sfNote = m.requiresSF ? ` [SF nötig]` : "";
        return `<option value="${key}" style="background:#0d1b2e;color:#e0e0e0">${m.label}${sfNote}</option>`;
      }).join("");

    return new Promise((resolve) => {
      const dlg = new Dialog({
        title: "Angriff",
        content: `
          <div class="dsa-mod-dialog dsa-attack-dialog" style="color-scheme:dark">
            <div class="dsa-mod-title">${title} (AT ${at})</div>

            <div class="dsa-maneuver-row" style="margin:6px 0">
              <label style="font-family:'VT323',monospace;font-size:15px;color:#bbb;margin-right:6px">Manöver:</label>
              <select id="dsa-maneuver" style="font-family:'VT323',monospace;font-size:15px;background:#0d1b2e;border:2px solid #3a3a5e;color:#e0e0e0;flex:1;color-scheme:dark">${maneuvers}</select>
            </div>
            <div id="dsa-maneuver-desc" style="font-size:12px;color:#888;margin:4px 0 6px;font-family:'VT323',monospace;min-height:18px"></div>

            <div id="dsa-ansage-row" style="display:none;margin:4px 0 6px">
              <div style="display:flex;align-items:center;gap:8px">
                <label style="font-family:'VT323',monospace;font-size:15px;color:#e94560">Ansage (max <span id="dsa-ansage-max">?</span>):</label>
                <button class="dsa-step" id="dsa-ansage-minus">−</button>
                <input type="number" id="dsa-ansage" value="0" min="0" style="width:50px;text-align:center;font-family:'VT323',monospace;font-size:18px;background:rgba(0,0,0,0.4);border:2px solid #e94560;color:#e94560" />
                <button class="dsa-step" id="dsa-ansage-plus">+</button>
              </div>
              <div id="dsa-ansage-hint" style="font-size:12px;color:#888;font-family:'VT323',monospace;margin-top:2px"></div>
            </div>

            <div class="dsa-mod-presets">
              <button class="dsa-preset" data-val="-7">-7</button>
              <button class="dsa-preset" data-val="-5">-5</button>
              <button class="dsa-preset" data-val="-3">-3</button>
              <button class="dsa-preset" data-val="-1">-1</button>
              <button class="dsa-preset dsa-preset-zero" data-val="0">0</button>
              <button class="dsa-preset" data-val="+1">+1</button>
              <button class="dsa-preset" data-val="+3">+3</button>
              <button class="dsa-preset" data-val="+5">+5</button>
              <button class="dsa-preset" data-val="+7">+7</button>
            </div>
            <div class="dsa-mod-row">
              <button class="dsa-step" id="dsa-minus">−</button>
              <input type="number" id="dsa-mod" value="0" />
              <button class="dsa-step" id="dsa-plus">+</button>
            </div>
            <div style="font-family:'VT323',monospace;font-size:12px;color:#888;text-align:center;margin:2px 0 6px">
              Zusatz-Erschwernis (+) · Erleichterung (−)
            </div>
            <div class="dsa-mod-divider">
              <label class="dsa-gezielt-toggle">
                <input type="checkbox" id="dsa-gezielt" />
                🎯 Gezielter Angriff
              </label>
            </div>
            <div class="dsa-zone-grid" id="dsa-zone-grid" style="display:none">${zoneHtml}</div>
          </div>
        `,
        buttons: {
          roll: { icon: '<i class="fas fa-dice-d20"></i>', label: "Würfeln",
            callback: (html) => {
              const maneuver  = html.find("#dsa-maneuver").val() ?? "normal";
              const ansage    = parseInt(html.find("#dsa-ansage").val()) || 0;
              const mod       = parseInt(html.find("#dsa-mod").val()) || 0;
              const zone      = html.find(".dsa-zone-btn.selected").data("zone") ?? null;
              resolve({ maneuver, ansage, mod, targetZone: zone });
            }
          },
          cancel: { label: "Abbruch", callback: () => resolve(null) },
        },
        default: "roll",
        close: () => resolve(null),
        render: (html) => {
          const updateManeuver = () => {
            const key = html.find("#dsa-maneuver").val();
            const m   = COMBAT_MANEUVERS[key] ?? COMBAT_MANEUVERS.normal;
            html.find("#dsa-maneuver-desc").html(m.desc ?? "");
            if (m.ansage) {
              const maxAnsage = m.ansageMax ? m.ansageMax(at, taw) : at;
              html.find("#dsa-ansage-max").text(maxAnsage);
              html.find("#dsa-ansage-row").show();
              // Live-Hint für effektive AT
              updateHint();
            } else {
              html.find("#dsa-ansage-row").hide();
              html.find("#dsa-ansage").val(0);
            }
          };
          const updateHint = () => {
            const key    = html.find("#dsa-maneuver").val();
            const m      = COMBAT_MANEUVERS[key] ?? COMBAT_MANEUVERS.normal;
            const ansage = parseInt(html.find("#dsa-ansage").val()) || 0;
            const mod    = parseInt(html.find("#dsa-mod").val()) || 0;
            const effAT  = at + (m.atBase ?? 0) - ansage - mod;
            let hint = `Effektive AT: ${effAT}`;
            if (m.effect === "tp_bonus")  hint += ` | TP +${ansage} (od. +${Math.floor(ansage/2)} o. SF)`;
            if (m.effect === "pa_reduce") hint += ` | gegn. PA −${ansage}`;
            if (m.effect === "knockdown") hint += ` | KK-Probe Erschwernis +${ansage}`;
            html.find("#dsa-ansage-hint").text(hint);
          };

          html.find("#dsa-maneuver").on("change", updateManeuver);
          html.find("#dsa-ansage").on("input", updateHint);
          html.find("#dsa-mod").on("input", updateHint);

          html.find(".dsa-preset").on("click", e => {
            html.find("#dsa-mod").val(parseInt(e.currentTarget.dataset.val));
            html.find(".dsa-preset").removeClass("active");
            $(e.currentTarget).addClass("active");
            updateHint();
          });
          html.find("#dsa-minus").on("click", () => {
            html.find("#dsa-mod").val((parseInt(html.find("#dsa-mod").val()) || 0) - 1);
            html.find(".dsa-preset").removeClass("active");
            updateHint();
          });
          html.find("#dsa-plus").on("click", () => {
            html.find("#dsa-mod").val((parseInt(html.find("#dsa-mod").val()) || 0) + 1);
            html.find(".dsa-preset").removeClass("active");
            updateHint();
          });
          html.find("#dsa-ansage-minus").on("click", () => {
            const cur = parseInt(html.find("#dsa-ansage").val()) || 0;
            if (cur > 0) { html.find("#dsa-ansage").val(cur - 1); updateHint(); }
          });
          html.find("#dsa-ansage-plus").on("click", () => {
            const key = html.find("#dsa-maneuver").val();
            const m   = COMBAT_MANEUVERS[key] ?? COMBAT_MANEUVERS.normal;
            const max = m.ansageMax ? m.ansageMax(at, taw) : at;
            const cur = parseInt(html.find("#dsa-ansage").val()) || 0;
            if (cur < max) { html.find("#dsa-ansage").val(cur + 1); updateHint(); }
          });
          html.find("#dsa-mod").on("keydown", e => { if (e.key === "Enter") html.find(".dialog-button.roll").click(); });
          html.find(".dsa-preset-zero").addClass("active");
          html.find("#dsa-gezielt").on("change", e => {
            html.find("#dsa-zone-grid").toggle(e.target.checked);
            if (!e.target.checked) html.find(".dsa-zone-btn").removeClass("selected");
          });
          html.find(".dsa-zone-btn").on("click", e => {
            html.find(".dsa-zone-btn").removeClass("selected");
            $(e.currentTarget).addClass("selected");
          });
          // Init
          updateManeuver();
        }
      });
      dlg.render(true);
    });
  }

  async _askModifier(title) {
    return new Promise((resolve) => {
      const dlg = new Dialog({
        title: "Probe",
        content: `
          <div class="dsa-mod-dialog">
            <div class="dsa-mod-title">${title}</div>
            <div class="dsa-mod-presets">
              <button class="dsa-preset" data-val="-7">-7</button>
              <button class="dsa-preset" data-val="-5">-5</button>
              <button class="dsa-preset" data-val="-3">-3</button>
              <button class="dsa-preset" data-val="-1">-1</button>
              <button class="dsa-preset dsa-preset-zero" data-val="0">0</button>
              <button class="dsa-preset" data-val="+1">+1</button>
              <button class="dsa-preset" data-val="+3">+3</button>
              <button class="dsa-preset" data-val="+5">+5</button>
              <button class="dsa-preset" data-val="+7">+7</button>
            </div>
            <div class="dsa-mod-row">
              <button class="dsa-step" id="dsa-minus">−</button>
              <input type="number" id="dsa-mod" value="0" />
              <button class="dsa-step" id="dsa-plus">+</button>
            </div>
            <div class="dsa-mod-hint">Erschwernis (+) · Erleichterung (−)</div>
          </div>
        `,
        buttons: {
          roll: { icon: '<i class="fas fa-dice-d20"></i>', label: "Würfeln",
            callback: (html) => resolve(parseInt(html.find("#dsa-mod").val()) || 0) },
          cancel: { label: "Abbruch", callback: () => resolve(null) },
        },
        default: "roll",
        close: () => resolve(null),
        render: (html) => {
          html.find(".dsa-preset").on("click", e => {
            const v = parseInt(e.currentTarget.dataset.val);
            html.find("#dsa-mod").val(v);
            html.find(".dsa-preset").removeClass("active");
            $(e.currentTarget).addClass("active");
          });
          html.find("#dsa-minus").on("click", () => {
            const cur = parseInt(html.find("#dsa-mod").val()) || 0;
            html.find("#dsa-mod").val(cur - 1);
            html.find(".dsa-preset").removeClass("active");
          });
          html.find("#dsa-plus").on("click", () => {
            const cur = parseInt(html.find("#dsa-mod").val()) || 0;
            html.find("#dsa-mod").val(cur + 1);
            html.find(".dsa-preset").removeClass("active");
          });
          html.find("#dsa-mod").on("keydown", e => { if (e.key === "Enter") html.find(".dialog-button.roll").click(); });
          // Preset 0 starts active
          html.find(".dsa-preset-zero").addClass("active");
        }
      });
      dlg.render(true);
    });
  }

  // (Legacy _askSpellModifier entfernt — showSpellDialog in magic.mjs übernimmt)

  // ─── Ressourcen-Klick (LeP/AsP/AuP bearbeiten) ───────────────────────

  _onResourceClick(event) {
    event.preventDefault();
    const el   = event.currentTarget;
    const path = el.dataset.path;
    const max  = parseInt(el.dataset.max) || 999;
    const res  = el.dataset.res?.toUpperCase() ?? "Ressource";
    const current = foundry.utils.getProperty(this.actor, path) ?? 0;

    new Dialog({
      title: `${res} ändern`,
      content: `
        <div class="dsa-mod-dialog" style="padding:12px">
          <div class="dsa-mod-title">${res}: ${current} / ${max}</div>
          <div class="dsa-mod-row">
            <button class="dsa-step" id="res-minus">−</button>
            <input type="number" id="dsa-res" value="${current}" min="0" max="${max}" />
            <button class="dsa-step" id="res-plus">+</button>
          </div>
          <div class="dsa-mod-hint">Min 0 · Max ${max}</div>
        </div>
      `,
      buttons: {
        save: { label: "Speichern",
          callback: (html) => {
            const val = parseInt(html.find("#dsa-res").val()) ?? current;
            this.actor.update({ [path]: Math.max(0, Math.min(max, val)) });
          }
        },
      },
      default: "save",
      render: (html) => {
        html.find("#res-minus").on("click", () => html.find("#dsa-res").val(Math.max(0, (parseInt(html.find("#dsa-res").val())||0)-1)));
        html.find("#res-plus").on("click",  () => html.find("#dsa-res").val(Math.min(max,(parseInt(html.find("#dsa-res").val())||0)+1)));
        html.find("#dsa-res").on("keydown", e => { if (e.key === "Enter") html.find(".dialog-button.save").click(); });
      }
    }).render(true);
  }
}
