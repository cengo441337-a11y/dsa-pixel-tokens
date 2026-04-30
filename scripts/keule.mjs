/**
 * DSA 4.1 Beseelte Knochenkeule — Manager-App
 * Verwaltung aller 9 Keulen-Rituale, LO-Pool, gespeicherte Sprüche.
 *
 * Quellen: Wege der Zauberei S.166-168
 */

import { MODULE_ID } from "./config.mjs";

const RITUALE_DEFS = {
  "weihe-der-keule":   { name: "Weihe der Keule", vor: "—", kosten: "Mondmonat-Zyklus", beschreibung: "Pflicht-Ritual. Voraussetzung für alle weiteren Keulen-Rituale. Zeremonie von Neumond zu Neumond." },
  "bann-der-keule":    { name: "Bann der Keule",    vor: "Geister binden 11", kosten: "3W6 AsP (1/2/3 perm pro Stufe), Erschaffung +9/+12/+15", stufen: 3, beschreibung: "Erleichterung -1/-2/-3 auf alle Kontroll-Proben gegen Geister/Dämonen (Stufe I/II/III, kumulativ max 3×). Erschaffungs-Probenzuschlag +9/+12/+15." },
  "geist-der-keule":   { name: "Geist der Keule",   vor: "Geister binden 11 + Beschwörung des Geistes", kosten: "4W6 AsP (beliebig perm)", beschreibung: "Bindet einen Elementar/Ahn/(selten) Dämon dauerhaft in die Keule. Geist kann Sprüche speichern und auf Befehl wirken." },
  "gespuer-der-keule": { name: "Gespür der Keule",  vor: "Geister binden 5", kosten: "3W6 AsP (1 perm)", beschreibung: "Magiegespür-Wert RkP*/2 (max 18). Keule rasselt bei magischer Präsenz / Artefakten / Kraftlinien. Tarn-/Antimagie senkt um deren ZfP*." },
  "haerte-der-keule":  { name: "Härte der Keule",   vor: "Ritualkenntnis (Schamane)", kosten: "speziell", beschreibung: "Erhöht den BF (Bruchfaktor) der Keule." },
  "hilfe-der-keule":   { name: "Hilfe der Keule",   vor: "Geister binden 7", kosten: "3W6 AsP (1/3/5 perm)", stufen: 3, beschreibung: "Erleichterung -1/-2/-3 auf eine gewählte Geister-Fertigkeit beim Wirken mit der Keule (Stufe I/II/III)." },
  "kraft-der-keule":   { name: "Kraft der Keule",   vor: "Geister binden 7", kosten: "3W6 AsP (beliebig perm)", beschreibung: "Erhöht modifizierten TP (mTP) der Keule um beliebigen Wert." },
  "naehe-zur-natur":   { name: "Nähe zur Natur",    vor: "Geister binden 7", kosten: "3W6 AsP (2 perm)", stufen: 3, beschreibung: "Wirkt wie Druiden-Stab auf Tiere/Pflanzen. Sympathie-Boni mit Tieren, Tierkommunikation, Pflanzen reagieren." },
  "opferkeule":        { name: "Opferkeule",        vor: "Ritualkenntnis (Schamane), SF Blutmagie", kosten: "4W6 AsP", beschreibung: "Erlaubt das Tränken der Keule mit Blut: 1 LeP-Opfer = 1 AsP-Erleichterung in laufenden Ritualen." }
};

export class KeulenManagerApp extends Application {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dsa-pixel-keulen-manager",
      title: "Beseelte Knochenkeule",
      template: `modules/${MODULE_ID}/templates/keule-manager.hbs`,
      width: 720,
      height: 720,
      resizable: true,
      classes: ["dsa-pixel-app", "dsa-pixel-keule"],
    });
  }

  get title() {
    const k = this._getKeule();
    return k ? `Keule: ${k.name}` : "Beseelte Keule";
  }

  _getKeule() {
    return this.actor.items.contents.find(i => /keule/i.test(i.name) && i.flags?.[MODULE_ID]?.beseelt);
  }

  async getData() {
    const keule = this._getKeule();
    if (!keule) {
      return { error: "Keine beseelte Knochenkeule gefunden", hasKeule: false, actorName: this.actor.name };
    }
    const flags = keule.flags[MODULE_ID] || {};
    const rituale = flags.rituale || {};

    const ritualList = Object.entries(RITUALE_DEFS).map(([id, def]) => {
      const state = rituale[id] || {};
      return {
        id,
        name: def.name,
        vor: def.vor,
        kosten: def.kosten,
        beschreibung: def.beschreibung,
        stufen: def.stufen,
        aktiv: state.aktiv === true,
        stufe: state.stufe || (def.stufen ? 1 : null),
        mod: state.mod,
        fertigkeit: state.fertigkeit,
        bfBonus: state.bfBonus,
        mTP: state.mTP,
        magiegespuer: state.magiegespuer,
      };
    });

    return {
      hasKeule: true,
      actorName: this.actor.name,
      keuleName: keule.name,
      keuleId: keule.id,
      keuleType: keule.system.weapon?.type || "Hiebwaffen",
      damage: keule.system.weapon?.damage || "—",
      bf: keule.system.weapon?.bf || 0,
      LO: flags.LO || 0,
      LOcurrent: flags.LOcurrent ?? flags.LO ?? 0,
      LOpercent: flags.LO ? Math.round(((flags.LOcurrent ?? flags.LO) / flags.LO) * 100) : 0,
      geistType: flags.geistType || "—",
      weihe: flags.weihe === true,
      gespeicherteSprueche: flags.rituale?.["geist-der-keule"]?.gespeicherteSprueche || [],
      mTPbonus: flags.mTPbonus || 0,
      bfBonus: flags.bfBonus || 0,
      magiegespuer: flags.magiegespuerBonus || 0,
      rituale: ritualList,
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    const $h = html instanceof jQuery ? html : $(html);

    // Toggle Ritual aktiv/inaktiv
    $h.find('[data-action="toggle-ritual"]').on("click", async (ev) => {
      const id = ev.currentTarget.dataset.id;
      const keule = this._getKeule();
      if (!keule) return;
      const flags = foundry.utils.deepClone(keule.flags[MODULE_ID] || {});
      flags.rituale = flags.rituale || {};
      flags.rituale[id] = flags.rituale[id] || {};
      flags.rituale[id].aktiv = !flags.rituale[id].aktiv;
      await keule.update({ [`flags.${MODULE_ID}`]: flags });
      this.render();
    });

    // Stufe ändern (Bann/Hilfe/Nähe-Stufe I/II/III)
    $h.find('select[data-action="set-stufe"]').on("change", async (ev) => {
      const id = ev.currentTarget.dataset.id;
      const stufe = Number(ev.currentTarget.value);
      const keule = this._getKeule();
      if (!keule) return;
      const flags = foundry.utils.deepClone(keule.flags[MODULE_ID] || {});
      flags.rituale = flags.rituale || {};
      flags.rituale[id] = flags.rituale[id] || {};
      flags.rituale[id].stufe = stufe;
      // Auto-Mod für Hilfe/Bann (WdZ S.167):
      //   Hilfe der Keule: -1/-2/-3 Erleichterung auf gewählte Geister-Fertigkeit
      //   Bann der Keule:  -1/-2/-3 Erleichterung auf Geister-Bannen
      // Die +9/+12/+15 sind die Erschaffungs-Erschwernis (wie schwer das Ritual
      // auf die Keule zu legen ist), NICHT der Wirkungs-Bonus.
      if (id === "hilfe-der-keule") flags.rituale[id].mod = -stufe;
      if (id === "bann-der-keule")  flags.rituale[id].mod = -stufe;
      await keule.update({ [`flags.${MODULE_ID}`]: flags });
      this.render();
    });

    // Hilfe-der-Keule: gewählte Fertigkeit ändern
    $h.find('select[data-action="set-hilfe-fertigkeit"]').on("change", async (ev) => {
      const fert = ev.currentTarget.value;
      const keule = this._getKeule();
      if (!keule) return;
      const flags = foundry.utils.deepClone(keule.flags[MODULE_ID] || {});
      flags.rituale = flags.rituale || {};
      flags.rituale["hilfe-der-keule"] = flags.rituale["hilfe-der-keule"] || {};
      flags.rituale["hilfe-der-keule"].fertigkeit = fert;
      await keule.update({ [`flags.${MODULE_ID}`]: flags });
      this.render();
    });

    // LO-Pool aktualisieren (current verbrauchen/regenerieren)
    $h.find('[data-action="lo-step"]').on("click", async (ev) => {
      const step = Number(ev.currentTarget.dataset.step);
      const keule = this._getKeule();
      if (!keule) return;
      const flags = foundry.utils.deepClone(keule.flags[MODULE_ID] || {});
      const max = flags.LO || 0;
      flags.LOcurrent = Math.max(0, Math.min(max, (flags.LOcurrent ?? max) + step));
      await keule.update({ [`flags.${MODULE_ID}`]: flags });
      this.render();
    });

    // Spruch aus Keule wirken
    $h.find('[data-action="cast-stored"]').on("click", async (ev) => {
      const idx = Number(ev.currentTarget.dataset.idx);
      const keule = this._getKeule();
      if (!keule) return;
      const sprueche = keule.flags[MODULE_ID]?.rituale?.["geist-der-keule"]?.gespeicherteSprueche || [];
      const spell = sprueche[idx];
      if (!spell) return;
      const flags = foundry.utils.deepClone(keule.flags[MODULE_ID] || {});
      flags.LOcurrent = Math.max(0, (flags.LOcurrent ?? flags.LO ?? 0) - 1);
      await keule.update({ [`flags.${MODULE_ID}`]: flags });
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div class="dsa-pixel-chat">
          <div class="chat-title">🦴 Geist der Keule wirkt</div>
          <div class="chat-row"><strong>Spruch:</strong> ${spell}</div>
          <div class="chat-row" style="font-size:11px;color:#888">Gewirkt vom Erz-Elementargeist in der Keule (1 pAsP aus LO-Pool).</div>
        </div>`
      });
      this.render();
    });

    // Spruch hinzufügen
    $h.find('[data-action="add-spell"]').on("click", async (ev) => {
      const name = await Dialog.prompt({
        title: "Spruch in Keule speichern",
        content: `<p>Spruchname:</p><input type="text" name="spell" style="width:100%">`,
        callback: (h) => $(h).find("input[name=spell]").val(),
      }).catch(() => null);
      if (!name) return;
      const keule = this._getKeule();
      const flags = foundry.utils.deepClone(keule.flags[MODULE_ID] || {});
      flags.rituale = flags.rituale || {};
      flags.rituale["geist-der-keule"] = flags.rituale["geist-der-keule"] || {};
      flags.rituale["geist-der-keule"].gespeicherteSprueche = [...(flags.rituale["geist-der-keule"].gespeicherteSprueche || []), name];
      await keule.update({ [`flags.${MODULE_ID}`]: flags });
      this.render();
    });

    // Spruch entfernen
    $h.find('[data-action="remove-spell"]').on("click", async (ev) => {
      const idx = Number(ev.currentTarget.dataset.idx);
      const keule = this._getKeule();
      const flags = foundry.utils.deepClone(keule.flags[MODULE_ID] || {});
      const arr = flags.rituale?.["geist-der-keule"]?.gespeicherteSprueche || [];
      arr.splice(idx, 1);
      await keule.update({ [`flags.${MODULE_ID}`]: flags });
      this.render();
    });
  }
}

// ─── Globale Hilfsfunktionen für Hooks ──────────────────────────────────────

/**
 * Liefert aktuelle Keulen-Boni für Würfel-Hooks.
 * @returns { mTP, bfBonus, magiegespuer, hilfeFertigkeit, hilfeMod, opferkeuleAktiv, naturAktiv }
 */
export function getKeulenBoni(actor) {
  const keule = actor?.items?.contents?.find(i => /keule/i.test(i.name) && i.flags?.[MODULE_ID]?.beseelt);
  if (!keule) return null;
  const flags = keule.flags[MODULE_ID] || {};
  const r = flags.rituale || {};
  return {
    keuleId: keule.id,
    keuleName: keule.name,
    LO: flags.LO || 0,
    LOcurrent: flags.LOcurrent ?? flags.LO ?? 0,
    geistType: flags.geistType,
    mTPbonus: r["kraft-der-keule"]?.aktiv ? (r["kraft-der-keule"].mTP || flags.mTPbonus || 0) : 0,
    bfBonus: r["haerte-der-keule"]?.aktiv ? (r["haerte-der-keule"].bfBonus || flags.bfBonus || 0) : 0,
    magiegespuer: r["gespuer-der-keule"]?.aktiv ? (r["gespuer-der-keule"].magiegespuer || flags.magiegespuerBonus || 0) : 0,
    hilfeFertigkeit: r["hilfe-der-keule"]?.aktiv ? r["hilfe-der-keule"].fertigkeit : null,
    hilfeMod: r["hilfe-der-keule"]?.aktiv ? (r["hilfe-der-keule"].mod || -(r["hilfe-der-keule"].stufe || 1)) : 0,
    // WdZ S.167: Bann der Keule erleichtert Kontroll-/Bann-Proben um -1/-2/-3
    // (NICHT um -9/-12/-15 — das war die Erschaffungs-Erschwernis)
    bannMod: r["bann-der-keule"]?.aktiv ? (r["bann-der-keule"].mod || -(r["bann-der-keule"].stufe || 1)) : 0,
    naturAktiv: r["naehe-zur-natur"]?.aktiv === true,
    opferkeuleAktiv: r["opferkeule"]?.aktiv === true,
  };
}

export function registerKeule() {
  globalThis.DSAKeule = (actor) => {
    const a = actor || canvas.tokens?.controlled?.[0]?.actor || game.user.character;
    if (!a) { ui.notifications.warn("Kein Actor."); return; }
    new KeulenManagerApp(a).render(true);
  };
}
