/**
 * DSA Pixel-Art Character Sheet
 * Überschreibt das gdsa Standard-Sheet mit Pixel-Art Theme
 */

import { MODULE_ID, ATTRIBUTES, SPELL_EFFECT_MAP, resolveProbe, checkCritical } from "./config.mjs";

// Akteur-ID → aktive Pfeilverzauberung { effect, impact, label, color }
const _arrowEnchants = new Map();

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

    // ── Talente nach Kategorien gruppieren ──
    data.talentCategories = this._prepareTalents();

    // ── Kampftalente ──
    data.combatTalents = this._prepareCombatTalents();

    // ── Zauber ──
    data.spells = this._prepareSpells();

    // ── Waffen, Rüstung, Gegenstände ──
    const { weapons, armor, items } = this._prepareItems();
    data.weapons = weapons;
    data.armor   = armor;
    data.items   = items;
    data.totalRS = armor.reduce((sum, a) => sum + (a.rs ?? 0), 0);
    data.totalBE = armor.reduce((sum, a) => sum + (a.be ?? 0), 0);

    // ── Vorteile, Nachteile, SF — aus system direkt (gdsa hat keinen Item-Typ dafür) ──
    data.advantages       = this._prepareVorteile("vorteile");
    data.disadvantages    = this._prepareVorteile("nachteile");
    data.specialAbilities = this._prepareSF();

    // ── Ritualfertigkeiten ──
    data.rituals = this._prepareRituals();

    return data;
  }

  // ─── Talente vorbereiten ──────────────────────────────────────────────

  _prepareTalents() {
    const categories = {
      koerper:      { label: "Körpertalente",       talents: [] },
      gesellschaft: { label: "Gesellschaftstalente", talents: [] },
      natur:        { label: "Naturtalente",         talents: [] },
      wissen:       { label: "Wissenstalente",       talents: [] },
      handwerk:     { label: "Handwerkstalente",     talents: [] },
      sprachen:     { label: "Sprachen & Schriften", talents: [] },
    };

    // Talente aus system.talente (importiert per XML-Parser)
    const talente = this.actor.system?.talente ?? {};
    for (const [name, data] of Object.entries(talente)) {
      const cat = data.cat ?? "wissen";
      const target = categories[cat] ?? categories.wissen;
      target.talents.push({
        name,
        probe: data.probe ?? "",
        probeDisplay: data.probe ?? "",
        taw: data.value ?? 0,
      });
    }

    // Sort alphabetically within each category
    for (const cat of Object.values(categories)) {
      cat.talents.sort((a, b) => a.name.localeCompare(b.name, "de"));
    }

    return categories;
  }

  // ─── Kampftalente vorbereiten ─────────────────────────────────────────

  _prepareCombatTalents() {
    const sys = this.actor.system;
    const talents = [];
    const atBase = sys.ATBasis?.value ?? 10;
    const paBase = sys.PABasis?.value ?? 10;
    const fkBase = sys.FKBasis?.value ?? 9;   // FK-Basis für Fernkampf

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
      const at = data.atk !== "" && data.atk != null
        ? Number(data.atk)
        : isRanged
          ? fkBase + taw                      // FK: volles TAW addieren
          : atBase + Math.floor(taw / 2);     // NK: halbes TAW
      const pa = isRanged ? "-"
        : data.def !== "" && data.def != null
          ? Number(data.def)
          : paBase + Math.floor(taw / 2);

      talents.push({ name, taw, at, pa });
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
        kosten: sys.costs ?? sys.kosten ?? sys.cost ?? "?",
        hasEffect: item.name in SPELL_EFFECT_MAP,
        effectType: SPELL_EFFECT_MAP[item.name]?.type ?? null,
      });
    }

    return spells.sort((a, b) => a.name.localeCompare(b.name));
  }

  // ─── Items nach Typ ───────────────────────────────────────────────────

  _prepareItems() {
    const weapons = [];
    const armor   = [];
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
        } else if (itemType === "armor" || itemType === "shield") {
          const armor_data = sys.armor ?? {};
          armor.push({
            id: item.id,
            name: item.name,
            rs: armor_data.rs ?? 0,
            be: armor_data.be ?? 0,
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

    return { weapons, armor, items };
  }

  _prepareVorteile(key) {
    const data = this.actor.system?.[key] ?? {};
    return Object.entries(data).map(([name, val]) => ({
      name,
      value: (val !== null && val !== "" && val !== 0) ? val : null,
    })).sort((a, b) => a.name.localeCompare(b.name, "de"));
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

  async _onRoll(event) {
    event.preventDefault();
    const el   = event.currentTarget;
    const type = el.dataset.roll;

    switch (type) {
      case "attribute": return this._rollAttribute(el.dataset.attr);
      case "talent":    return this._rollTalent(el.dataset);
      case "attack":    return this._rollAttack(el.dataset);
      case "parry":     return this._rollParry(el.dataset);
      case "spell":     return this._rollSpell(el.dataset);
      case "damage":    return this._rollDamage(el.dataset);
    }
  }

  // ─── Eigenschaftsprobe (1W20) ─────────────────────────────────────────

  async _rollAttribute(attrKey) {
    const val = this.actor.system[attrKey]?.value ?? 10;
    const label = ATTRIBUTES[attrKey]?.label ?? attrKey;

    // Dialog für Modifikator
    const mod = await this._askModifier(`Probe auf ${label} (${val})`);
    if (mod === null) return; // Abbruch

    const roll = new Roll("1d20");
    await roll.evaluate();
    const die = roll.total;
    const target = val - mod;
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

  async _rollTalent(dataset) {
    const name = dataset.talent;
    const taw  = parseInt(dataset.taw) || 0;
    const probeStr = dataset.probe || "";
    const probeAttrs = probeStr.split("/").map(a => a.trim());

    // Eigenschaftswerte auslesen
    const attrs = probeAttrs.map(a => this.actor.system[a]?.value ?? 10);

    // Dialog
    const mod = await this._askModifier(`${name} (${probeStr}) — TaW ${taw}`);
    if (mod === null) return;

    const roll = new Roll("3d20");
    await roll.evaluate();
    const dice = roll.terms[0].results.map(r => r.result);

    // Probe auswerten
    const result = resolveProbe(dice, attrs, taw, mod);
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

    const flavor = `<div class="dsa-pixel-chat">
      <div class="chat-title">${name}</div>
      <div class="dice-row">${diceHtml}</div>
      <div class="result-line ${resultClass}">${resultText}</div>
      ${result.success ? `<div class="tap-star">TaP*: <span>${result.tapStar}</span></div>` : ""}
      ${mod !== 0 ? `<div style="text-align:center;font-size:13px;color:#888">Mod: ${mod >= 0 ? "+" : ""}${mod}</div>` : ""}
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
    const isRanged = PixelArtCharacterSheet.RANGED_TALENTS.has(talent);
    const icon     = isRanged ? "🏹" : "⚔";

    const opts = await this._askAttackOptions(`${icon} ${talent}`, at);
    if (opts === null) return;
    const { mod, targetZone } = opts;

    const zonePenalty  = targetZone ? (PixelArtCharacterSheet.ZONE_PENALTIES[targetZone] ?? 0) : 0;
    const effectiveAT  = at - mod - zonePenalty;

    // ── Erster Wurf ──────────────────────────────────────────────────
    const roll = new Roll("1d20");
    await roll.evaluate();
    const die    = roll.total;
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

    const modLine   = (mod !== 0 || zonePenalty !== 0)
      ? `<div class="dsa-mod-hint">${mod !== 0 ? `Mod ${mod >= 0 ? "+" : ""}${mod}` : ""}${zonePenalty > 0 ? ` · Zone -${zonePenalty}` : ""} · Ziel ${effectiveAT}</div>`
      : "";
    const confirmLine = confirmDie !== null
      ? `<div class="dsa-confirm-row">Bestätigung: <span class="die ${confirmClass}" style="font-size:0.8em">${confirmDie}</span> ${confirmedCrit ? "✓ Bestätigt" : confirmedFumble ? "✗ Bestätigt" : "– nicht bestätigt"}</div>`
      : "";
    const zoneLine  = hitZone
      ? `<div class="dsa-zone-badge ${targetZone ? "zone-gezielt" : ""}">${targetZone ? "🎯" : "🎲"} ${hitZone}</div>`
      : "";
    const fumbleLine = fumbleOutcome
      ? `<div class="dsa-fumble-outcome">⚠ ${fumbleOutcome}</div>`
      : "";

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="dsa-pixel-chat">
        <div class="chat-title">${icon} ${talent}</div>
        <div class="dice-row"><div class="die ${dieClass}">${die}</div></div>
        ${modLine}${confirmLine}
        <div class="result-line ${resultCls}">${resultText}</div>
        ${zoneLine}${fumbleLine}
      </div>`,
    });

    // ── Sound + VFX ──────────────────────────────────────────────────
    const SND = (f, vol = 0.7) => AudioHelper.play({
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
    const pa = parseInt(dataset.pa) || 0;

    const roll = new Roll("1d20");
    await roll.evaluate();
    const die = roll.total;
    const success = die <= pa;

    const flavor = `<div class="dsa-pixel-chat">
      <div class="chat-title">Parade: ${talent}</div>
      <div class="dice-row">
        <div class="die ${die === 1 ? "crit" : die === 20 ? "fumble" : success ? "success" : "fail"}">${die}</div>
      </div>
      <div class="result-line ${success ? "result-success" : "result-fail"}">
        ${die === 1 ? "MEISTERPARADE!" : die === 20 ? "PATZER!" : success ? "Pariert!" : "Nicht pariert!"}
      </div>
    </div>`;

    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor,
    });
  }

  // ─── Zauberprobe (3W20 + Modifikations-Dialog) ────────────────────────

  async _rollSpell(dataset) {
    const name  = dataset.spell;
    const zfw   = parseInt(dataset.zfw) || 0;
    const kosten = dataset.kosten || "?";
    const probeStr = dataset.probe || "";
    const probeAttrs = probeStr.split(",").map(a => a.trim());
    const attrs = probeAttrs.map(a => this.actor.system[a]?.value ?? 10);

    const mod = await this._askSpellModifier(name, probeStr, zfw, kosten);
    if (mod === null) return;

    const roll = new Roll("3d20");
    await roll.evaluate();
    const dice = roll.terms[0].results.map(r => r.result);

    const result = resolveProbe(dice, attrs, zfw, mod);
    const crit   = checkCritical(dice);

    const diceHtml = dice.map((d, i) => {
      const over = d > attrs[i];
      const cls = d === 1 ? "crit" : d === 20 ? "fumble" : over ? "fail" : "success";
      return `<div class="die ${cls}" title="${probeAttrs[i]} ${attrs[i]}">${d}</div>`;
    }).join("");

    let resultText, resultClass;
    if (crit.patzer) { resultText = "PATZER!"; resultClass = "result-fail"; }
    else if (crit.gluecklich) { resultText = "GLÜCKLICH!"; resultClass = "result-crit"; }
    else if (result.success) { resultText = "Gelungen"; resultClass = "result-success"; }
    else { resultText = "Misslungen"; resultClass = "result-fail"; }

    const flavor = `<div class="dsa-pixel-chat">
      <div class="chat-title">⚡ ${name}</div>
      <div class="dice-row">${diceHtml}</div>
      <div class="result-line ${resultClass}">${resultText}</div>
      ${result.success ? `<div class="tap-star">ZfP*: <span>${result.tapStar}</span></div>` : ""}
      <div style="text-align:center;font-size:13px;color:#4a90d9">Kosten: ${kosten} AsP</div>
    </div>`;

    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor,
    });

    // VFX: Auto-trigger Zaubereffekt
    if (result.success && typeof DSAPixelTokens !== "undefined") {
      const mapping = SPELL_EFFECT_MAP[name];
      if (mapping) {
        // Pfeilverzauberung: kein sofortiger VFX, nächster Pfeil wird elementar
        if (mapping.enchantArrow) {
          _arrowEnchants.set(this.actor.id, { effect: mapping.effect, impact: mapping.impact, label: mapping.label, color: mapping.color });
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: `<div class="dsa-pixel-chat">
              <div class="chat-title">✨ ${mapping.label}</div>
              <div class="result-line result-success" style="color:${mapping.color}">
                Nächster Pfeil ist ein <b>${mapping.label}</b>!
              </div>
            </div>`,
          });
        } else {
          const casterToken = this.actor.getActiveTokens()[0];
          const targetToken = [...game.user.targets][0] ?? casterToken;

          if (mapping.type === "projectile" && casterToken && targetToken) {
            DSAPixelTokens.spawnProjectile(casterToken, targetToken, mapping.effect, mapping.impact ?? mapping.effect);
          } else if (mapping.type === "aura" && casterToken) {
            DSAPixelTokens.spawnEffect(casterToken.center.x, casterToken.center.y, mapping.effect);
          } else if (mapping.type === "target" && targetToken) {
            DSAPixelTokens.spawnEffect(targetToken.center.x, targetToken.center.y, mapping.effect);
          } else if (mapping.type === "zone") {
            this._placeZoneTemplate(name, mapping, casterToken);
          }
        }
      }
    }

    // AsP abziehen bei Erfolg
    if (result.success) {
      const aspNum = parseInt(kosten);
      if (!isNaN(aspNum) && aspNum > 0) {
        const currentAsP = this.actor.system.AsP?.value ?? 0;
        await this.actor.update({ "system.AsP.value": Math.max(0, currentAsP - aspNum) });
      }
    }
  }

  // ─── Schadenswurf ─────────────────────────────────────────────────────

  async _rollDamage(dataset) {
    const weaponName = dataset.weapon;
    const tp = dataset.tp || "1d6";

    const roll = new Roll(tp);
    await roll.evaluate();

    const flavor = `<div class="dsa-pixel-chat">
      <div class="chat-title">⚔ Schaden: ${weaponName}</div>
      <div class="result-line"><span style="font-size:22px;color:var(--px-accent)">${roll.total} TP</span></div>
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
  async _askAttackOptions(title, at) {
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

    return new Promise((resolve) => {
      const dlg = new Dialog({
        title: "Angriff",
        content: `
          <div class="dsa-mod-dialog dsa-attack-dialog">
            <div class="dsa-mod-title">${title} (AT ${at})</div>
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
              const mod  = parseInt(html.find("#dsa-mod").val()) || 0;
              const zone = html.find(".dsa-zone-btn.selected").data("zone") ?? null;
              resolve({ mod, targetZone: zone });
            }
          },
          cancel: { label: "Abbruch", callback: () => resolve(null) },
        },
        default: "roll",
        close: () => resolve(null),
        render: (html) => {
          html.find(".dsa-preset").on("click", e => {
            html.find("#dsa-mod").val(parseInt(e.currentTarget.dataset.val));
            html.find(".dsa-preset").removeClass("active");
            $(e.currentTarget).addClass("active");
          });
          html.find("#dsa-minus").on("click", () => {
            html.find("#dsa-mod").val((parseInt(html.find("#dsa-mod").val()) || 0) - 1);
            html.find(".dsa-preset").removeClass("active");
          });
          html.find("#dsa-plus").on("click", () => {
            html.find("#dsa-mod").val((parseInt(html.find("#dsa-mod").val()) || 0) + 1);
            html.find(".dsa-preset").removeClass("active");
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

  async _askSpellModifier(spellName, probeDisplay, zfw, kosten) {
    return new Promise((resolve) => {
      const SPMODS = [
        { label: "Zauberdauer ×2",   mod: -1, group: "zd" },
        { label: "Zauberdauer ×4",   mod: -2, group: "zd" },
        { label: "Zauberdauer ×8",   mod: -3, group: "zd" },
        { label: "Reichweite ×2",    mod: +2, group: "rw" },
        { label: "Reichweite ×4",    mod: +4, group: "rw" },
        { label: "Ohne Geste",       mod: +1, group: "gs" },
        { label: "Ohne Formel",      mod: +2, group: "fo" },
        { label: "Ohne Geste+Form.", mod: +4, group: "gf" },
        { label: "Wirkung ×2",       mod: +2, group: "wk" },
        { label: "Wirkung ×½",       mod: -2, group: "wk" },
      ];

      const spmodHtml = SPMODS.map((m, i) => {
        const sign = m.mod >= 0 ? `+${m.mod}` : `${m.mod}`;
        const cls  = m.mod > 0 ? "spmod-hard" : "spmod-easy";
        return `<button class="dsa-spmod ${cls}" data-idx="${i}" data-mod="${m.mod}" data-group="${m.group}">
          <span class="spmod-label">${m.label}</span>
          <span class="spmod-val">${sign}</span>
        </button>`;
      }).join("");

      const dlg = new Dialog({
        title: spellName,
        content: `
          <div class="dsa-mod-dialog dsa-spell-dialog">
            <div class="dsa-mod-title">${spellName}</div>
            <div class="dsa-spell-info">
              <span class="si-probe">${probeDisplay}</span>
              <span class="si-zfw">ZfW ${zfw}</span>
              <span class="si-asp">${kosten} AsP</span>
            </div>

            <div class="dsa-spmod-label">Zaubermodifikation</div>
            <div class="dsa-spmod-grid">${spmodHtml}</div>

            <div class="dsa-mod-divider">Sonstige Erschwernis</div>
            <div class="dsa-mod-presets">
              <button class="dsa-preset" data-val="-5">-5</button>
              <button class="dsa-preset" data-val="-3">-3</button>
              <button class="dsa-preset" data-val="-1">-1</button>
              <button class="dsa-preset dsa-preset-zero active" data-val="0">0</button>
              <button class="dsa-preset" data-val="+1">+1</button>
              <button class="dsa-preset" data-val="+3">+3</button>
              <button class="dsa-preset" data-val="+5">+5</button>
            </div>
            <div class="dsa-mod-row">
              <button class="dsa-step" id="dsa-minus">−</button>
              <input type="number" id="dsa-mod" value="0" />
              <button class="dsa-step" id="dsa-plus">+</button>
            </div>
            <div class="dsa-spmod-total">Gesamt: <span id="dsa-total">0</span></div>
          </div>
        `,
        buttons: {
          roll: { icon: '<i class="fas fa-magic"></i>', label: "Zauber wirken",
            callback: (html) => {
              const base  = parseInt(html.find("#dsa-mod").val()) || 0;
              const spSum = html.find(".dsa-spmod.active").toArray()
                              .reduce((s, el) => s + parseInt(el.dataset.mod), 0);
              resolve(base + spSum);
            }
          },
          cancel: { label: "Abbruch", callback: () => resolve(null) },
        },
        default: "roll",
        close: () => resolve(null),
        render: (html) => {
          const updateTotal = () => {
            const base  = parseInt(html.find("#dsa-mod").val()) || 0;
            const spSum = html.find(".dsa-spmod.active").toArray()
                            .reduce((s, el) => s + parseInt(el.dataset.mod), 0);
            const total = base + spSum;
            const el = html.find("#dsa-total");
            el.text((total >= 0 ? "+" : "") + total);
            el.css("color", total > 0 ? "#ff6644" : total < 0 ? "#44cc66" : "#ddeeff");
          };

          html.find(".dsa-spmod").on("click", e => {
            const btn   = $(e.currentTarget);
            const group = btn.data("group");
            if (btn.hasClass("active")) {
              btn.removeClass("active");
            } else {
              // Deactivate others in same group
              html.find(`.dsa-spmod[data-group="${group}"]`).removeClass("active");
              btn.addClass("active");
            }
            updateTotal();
          });
          html.find(".dsa-preset").on("click", e => {
            const v = parseInt(e.currentTarget.dataset.val);
            html.find("#dsa-mod").val(v);
            html.find(".dsa-preset").removeClass("active");
            $(e.currentTarget).addClass("active");
            updateTotal();
          });
          html.find("#dsa-minus").on("click", () => {
            html.find("#dsa-mod").val((parseInt(html.find("#dsa-mod").val()) || 0) - 1);
            html.find(".dsa-preset").removeClass("active");
            updateTotal();
          });
          html.find("#dsa-plus").on("click", () => {
            html.find("#dsa-mod").val((parseInt(html.find("#dsa-mod").val()) || 0) + 1);
            html.find(".dsa-preset").removeClass("active");
            updateTotal();
          });
          html.find("#dsa-mod").on("input", updateTotal);
          html.find("#dsa-mod").on("keydown", e => { if (e.key === "Enter") html.find(".dialog-button.roll").click(); });
        }
      });
      dlg.render(true);
    });
  }

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
