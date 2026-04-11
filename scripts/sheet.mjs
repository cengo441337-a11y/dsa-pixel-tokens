/**
 * DSA Pixel-Art Character Sheet
 * Überschreibt das gdsa Standard-Sheet mit Pixel-Art Theme
 */

import { MODULE_ID, ATTRIBUTES, SPELL_EFFECT_MAP, resolveProbe, checkCritical } from "./config.mjs";

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

    // ── Vorteile, Nachteile, SF ──
    data.advantages       = this._getItemsByType("advantage", "vorteil");
    data.disadvantages    = this._getItemsByType("disadvantage", "nachteil");
    data.specialAbilities = this._getItemsByType("specialAbility", "sonderfertigkeit", "sf");

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

    // Talente aus Actor Items
    for (const item of this.actor.items) {
      if (item.type !== "talent" && item.type !== "skill") continue;
      const cat = item.system?.category ?? "wissen";
      const target = categories[cat] ?? categories.wissen;
      target.talents.push({
        name: item.name,
        probe: item.system?.probe ?? "",
        probeDisplay: this._formatProbe(item.system?.probe),
        taw: item.system?.taw ?? item.system?.value ?? 0,
      });
    }

    // Wenn keine Item-basierten Talente: aus system.talents auslesen (gdsa-Struktur)
    if (Object.values(categories).every(c => c.talents.length === 0)) {
      this._extractSystemTalents(categories);
    }

    return categories;
  }

  _extractSystemTalents(categories) {
    // gdsa speichert manche Talente direkt im system-Objekt
    const sys = this.actor.system;
    if (!sys) return;

    // Versuche bekannte gdsa-Talentfelder zu lesen
    const talentKeys = Object.keys(sys).filter(k =>
      typeof sys[k] === "object" && sys[k] !== null && "value" in sys[k] &&
      !["MU","KL","IN","CH","FF","GE","KO","KK","LeP","AsP","AuP","KaP","MR","GS","AP",
        "ATBasis","PABasis","FKBasis","INIBasis","BE","WS","Dodge"].includes(k)
    );

    for (const key of talentKeys) {
      const val = sys[key];
      if (typeof val?.value !== "number") continue;
      categories.wissen.talents.push({
        name: key,
        probe: "",
        probeDisplay: "",
        taw: val.value,
      });
    }
  }

  // ─── Kampftalente vorbereiten ─────────────────────────────────────────

  _prepareCombatTalents() {
    const sys = this.actor.system;
    const talents = [];

    // gdsa speichert 33 Kampftalente direkt im System mit .value, .atk, .def
    const combatNames = [
      "Anderthalbhänder", "Armbrust", "Belagerungswaffen", "Blasrohr", "Bogen",
      "Diskus", "Dolche", "Fechtwaffen", "Hiebwaffen", "Infanteriewaffen",
      "Kettenstäbe", "Kettenwaffen", "Lanzenreiten", "Peitsche", "Raufen",
      "Ringen", "Säbel", "Schleuder", "Schwerter", "Speere",
      "Stäbe", "Wurfbeile", "Wurfmesser", "Wurfspeere", "Zweihandflegel",
      "Zweihandhiebwaffen", "Zweihandschwerter",
    ];

    for (const name of combatNames) {
      const data = sys[name];
      if (!data || typeof data !== "object") continue;
      if ((data.value ?? 0) === 0 && (data.atk ?? 0) === 0 && (data.def ?? 0) === 0) continue;

      talents.push({
        name,
        taw: data.value ?? 0,
        at:  data.atk ?? (sys.ATBasis?.value ?? 0),
        pa:  data.def ?? (sys.PABasis?.value ?? 0),
      });
    }

    // Fallback: Aus Items
    if (talents.length === 0) {
      for (const item of this.actor.items) {
        if (item.type !== "combatTalent" && item.type !== "kampftalent") continue;
        talents.push({
          name: item.name,
          taw: item.system?.value ?? 0,
          at:  item.system?.atk ?? item.system?.at ?? 0,
          pa:  item.system?.def ?? item.system?.pa ?? 0,
        });
      }
    }

    return talents;
  }

  // ─── Zauber vorbereiten ───────────────────────────────────────────────

  _prepareSpells() {
    const spells = [];

    for (const item of this.actor.items) {
      if (item.type !== "spell" && item.type !== "zauber") continue;
      const sys = item.system ?? {};

      spells.push({
        id: item.id,
        name: item.name,
        probe: [sys.att1, sys.att2, sys.att3].filter(Boolean),
        probeDisplay: this._formatProbe([sys.att1, sys.att2, sys.att3].filter(Boolean)),
        zfw: sys.zfw ?? sys.value ?? 0,
        kosten: sys.kosten ?? sys.cost ?? "?",
        reichweite: sys.reichweite ?? sys.range ?? "",
        zauberdauer: sys.zauberdauer ?? sys.castTime ?? "",
        wirkungsdauer: sys.wirkungsdauer ?? sys.duration ?? "",
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

      if (type === "weapon" || type === "waffe") {
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
      } else if (!["spell","zauber","talent","skill","combatTalent","kampftalent",
                   "advantage","vorteil","disadvantage","nachteil",
                   "specialAbility","sonderfertigkeit","sf","wonder","objektRitual"].includes(type)) {
        items.push({
          id: item.id, name: item.name,
          quantity: sys.quantity ?? 1,
          weight: sys.weight ?? 0,
        });
      }
    }

    return { weapons, armor, items };
  }

  _getItemsByType(...types) {
    return this.actor.items
      .filter(i => types.includes(i.type?.toLowerCase()))
      .map(i => ({ name: i.name, value: i.system?.value ?? i.system?.stufe ?? null }));
  }

  // ─── Ritualfertigkeiten ───────────────────────────────────────────────

  _prepareRituals() {
    const sys = this.actor.system;
    const ritualKeys = ["gild","scha","alch","kris","hexe","drui","geod","schn","bard"];
    const ritualNames = {
      gild: "Gildenmagie", scha: "Scharlatanerie", alch: "Alchimie",
      kris: "Kristallomantie", hexe: "Hexerei", drui: "Druidenritual",
      geod: "Geodenritual", schn: "Schelmenzauber", bard: "Bardenmusik",
    };
    const rituals = [];
    for (const key of ritualKeys) {
      const val = sys[key]?.value ?? sys[key];
      if (val && typeof val === "number" && val > 0) {
        rituals.push({ name: ritualNames[key] ?? key, value: val });
      }
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

    // Resource bar click → edit value
    html.find(".resource-bar .bar-track").on("click", this._onResourceClick.bind(this));
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

  async _rollAttack(dataset) {
    const talent = dataset.talent;
    const at = parseInt(dataset.at) || 0;

    const mod = await this._askModifier(`Angriff: ${talent} (AT ${at})`);
    if (mod === null) return;

    const roll = new Roll("1d20");
    await roll.evaluate();
    const die = roll.total;
    const target = at - mod;
    const success = die <= target;
    const crit = die === 1;
    const fumble = die === 20;

    const flavor = `<div class="dsa-pixel-chat">
      <div class="chat-title">Angriff: ${talent}</div>
      <div class="dice-row">
        <div class="die ${crit ? "crit" : fumble ? "fumble" : success ? "success" : "fail"}">${die}</div>
      </div>
      <div class="result-line ${crit ? "result-crit" : success ? "result-success" : "result-fail"}">
        ${crit ? "KRITISCHER TREFFER!" : fumble ? "PATZER!" : success ? "Treffer!" : "Daneben!"}
      </div>
      ${success ? `<div class="chat-buttons">
        <button class="chat-btn damage" data-action="roll-damage">⚔ Schaden</button>
      </div>` : ""}
    </div>`;

    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor,
    });

    // VFX: Treffer/Verfehlung
    if (typeof DSAPixelTokens !== "undefined") {
      const token = this.actor.getActiveTokens()[0];
      const target_token = [...game.user.targets][0];

      if (success && target_token) {
        // Schwing-Sound + Treffer-Flash am Ziel
        DSAPixelTokens.spawnEffect(target_token.center.x, target_token.center.y, "schadenflash");
      } else if (fumble && token) {
        DSAPixelTokens.spawnEffect(token.center.x, token.center.y, "schadenflash");
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

    // Zaubermodifikations-Dialog (Phase 5 — für jetzt: einfacher Mod-Dialog)
    const mod = await this._askModifier(`Zauber: ${name} (${probeStr}) — ZfW ${zfw}, ${kosten} AsP`);
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
        const casterToken = this.actor.getActiveTokens()[0];
        const targetToken = [...game.user.targets][0] ?? casterToken;

        if (mapping.type === "projectile" && casterToken && targetToken) {
          DSAPixelTokens.spawnProjectile(casterToken, targetToken, mapping.effect, mapping.impact ?? mapping.effect);
        } else if (mapping.type === "aura" && casterToken) {
          DSAPixelTokens.spawnEffect(casterToken.center.x, casterToken.center.y, mapping.effect);
        } else if (mapping.type === "target" && targetToken) {
          DSAPixelTokens.spawnEffect(targetToken.center.x, targetToken.center.y, mapping.effect);
        } else if (mapping.type === "zone") {
          // Zone: Template-Platzierung anbieten
          ui.notifications.info(`${name} gelungen! Platziere ein Template für den Zoneneffekt.`);
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

  async _askModifier(title) {
    return new Promise((resolve) => {
      new Dialog({
        title,
        content: `
          <div class="dsa-pixel-probe-dialog">
            <div class="probe-header">
              <div class="probe-title">${title}</div>
            </div>
            <div class="probe-mod">
              <label>Erschwernis (+) / Erleichterung (-):</label>
              <input type="number" id="dsa-mod" value="0" autofocus />
            </div>
          </div>
        `,
        buttons: {
          roll: {
            icon: '<i class="fas fa-dice-d20"></i>',
            label: "Würfeln",
            callback: (html) => {
              const mod = parseInt(html.find("#dsa-mod").val()) || 0;
              resolve(mod);
            },
          },
          cancel: {
            label: "Abbruch",
            callback: () => resolve(null),
          },
        },
        default: "roll",
        close: () => resolve(null),
      }).render(true);
    });
  }

  // ─── Ressourcen-Klick (LeP/AsP/AuP bearbeiten) ───────────────────────

  _onResourceClick(event) {
    event.preventDefault();
    const bar = event.currentTarget.closest(".resource-bar");
    if (!bar) return;

    let path, label;
    if (bar.classList.contains("lep")) { path = "system.LeP.value"; label = "LeP"; }
    else if (bar.classList.contains("asp")) { path = "system.AsP.value"; label = "AsP"; }
    else if (bar.classList.contains("aup")) { path = "system.AuP.value"; label = "AuP"; }
    else return;

    const current = foundry.utils.getProperty(this.actor, path) ?? 0;
    const max = foundry.utils.getProperty(this.actor, path.replace(".value", ".max")) ?? current;

    new Dialog({
      title: `${label} ändern`,
      content: `
        <div class="dsa-pixel-probe-dialog">
          <div style="text-align:center;margin:8px 0">
            <span style="font-size:14px;color:#888">${label}:</span>
            <input type="number" id="dsa-res" value="${current}" min="0" max="${max}" style="width:80px;font-size:20px;text-align:center" autofocus />
            <span style="font-size:14px;color:#888">/ ${max}</span>
          </div>
        </div>
      `,
      buttons: {
        save: {
          label: "Speichern",
          callback: (html) => {
            const val = parseInt(html.find("#dsa-res").val()) ?? current;
            this.actor.update({ [path]: Math.max(0, Math.min(max, val)) });
          },
        },
      },
      default: "save",
    }).render(true);
  }
}
