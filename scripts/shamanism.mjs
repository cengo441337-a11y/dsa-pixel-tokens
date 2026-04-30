/**
 * DSA 4.1 Schamanen-Rituale
 * Hauptquelle: Wege der Zauberei (DSA 4.1, S.149-168, S.331-342, S.426)
 * Ergänzung: Wege der Helden (Schamanen-Professionen S.234-243)
 *
 * Mechanik-Kern:
 *   - Vier separate Geister-Fertigkeiten: rufen / bannen / binden / aufnehmen
 *     (jede ist ein eigenständiges Talent mit eigenem RkW)
 *   - 1W20-Probe ≤ RkW − Modifikator(Grad) − Mods
 *   - AsP-Kosten: 1W6/Grad (1W6/2W6/.../6W6), erst beim Ritualende bekannt
 *   - Ab Grad V: 1/10 permanente AsP
 *   - Misslingen = halbe AsP-Kosten verloren (niemals permanente AsP)
 *   - Verbotene Pforten (SF): LeP statt fehlender AsP
 */

import { MODULE_ID } from "./config.mjs";

let RITUALE = null;
let RITUALE_META = null;

// ─── Daten laden ────────────────────────────────────────────────────────────

export async function loadSchamanenRituale() {
  try {
    const resp = await fetch(`modules/${MODULE_ID}/data/schamanen-rituale.json`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    RITUALE = data.rituale || [];
    RITUALE_META = data._meta || {};
    RITUALE_META._keulenRituale = data._keulenRituale || [];
    RITUALE_META._knochenkeulen = data._knochenkeulen || [];
    console.log(`[${MODULE_ID}] Schamanen-Rituale geladen: ${RITUALE.length} Einträge`);
    return data;
  } catch (e) {
    console.warn(`[${MODULE_ID}] Schamanen-Rituale laden fehlgeschlagen:`, e.message);
    RITUALE = [];
    RITUALE_META = {};
    return { rituale: [], _meta: {} };
  }
}

export function getRituale() { return RITUALE ?? []; }
export function getRitualeMeta() { return RITUALE_META ?? {}; }

/** Filtert Rituale nach Kultur(en) und Fertigkeit. */
export function getRitualeForKultur(kultur, fertigkeit = null) {
  if (!RITUALE) return [];
  return RITUALE.filter(r => {
    const kulturOK = !kultur || (r.kulturen || []).includes(kultur);
    const fertOK = !fertigkeit || r.fertigkeit === fertigkeit;
    return kulturOK && fertOK;
  });
}

// ─── RkW-Helpers (Geister-Fertigkeiten) ─────────────────────────────────────

const FERTIGKEIT_KEYS = ["geister-rufen", "geister-bannen", "geister-binden", "geister-aufnehmen"];

/** Liest den RkW (Ritualkenntnis-Wert) für eine bestimmte Geister-Fertigkeit. */
export function getRkW(actor, fertigkeit) {
  // Items
  const items = actor?.items ?? [];
  const item = [...items].find(i => {
    const n = (i.name || "").toLowerCase();
    if (fertigkeit === "geister-rufen")     return n.includes("geister") && n.includes("rufen");
    if (fertigkeit === "geister-bannen")    return n.includes("geister") && n.includes("bannen");
    if (fertigkeit === "geister-binden")    return n.includes("geister") && n.includes("binden");
    if (fertigkeit === "geister-aufnehmen") return n.includes("geister") && n.includes("aufnehmen");
    return false;
  });
  if (item) {
    return Number(item.system?.value ?? item.system?.taw ?? item.system?.zfw ?? 0);
  }
  // Flag-Fallback
  const flagMap = actor?.getFlag?.(MODULE_ID, "geisterFertigkeiten") ?? {};
  return Number(flagMap[fertigkeit] ?? 0);
}

/** Setzt RkW per Flag (für manuelle Konfiguration). */
export async function setRkW(actor, fertigkeit, value) {
  const flagMap = { ...(actor?.getFlag?.(MODULE_ID, "geisterFertigkeiten") ?? {}) };
  flagMap[fertigkeit] = Number(value) || 0;
  await actor.setFlag(MODULE_ID, "geisterFertigkeiten", flagMap);
}

/** Hauptkultur des Schamanen (aus profession/flag). */
export function getActorKultur(actor) {
  const flag = actor?.getFlag?.(MODULE_ID, "schamanenKultur");
  if (flag) return flag;
  const prof = String(actor?.system?.profession?.value ?? actor?.system?.profession ?? "").toLowerCase();
  // Heuristik
  if (prof.includes("waldmensch") || prof.includes("moha")) return "Wdm";
  if (prof.includes("utulu")) return "Utu";
  if (prof.includes("tocamuy")) return "Toc";
  if (prof.includes("nives") || prof.includes("kaskju")) return "Niv";
  if (prof.includes("ork") || prof.includes("tairach") || prof.includes("brenoch")) return "Ork";
  if (prof.includes("goblin")) return "Gob";
  if (prof.includes("gjalsker")) return "Gja";
  if (prof.includes("ferkina") || prof.includes("nuransh")) return "Fer";
  if (prof.includes("trollzack") || prof.includes("shochzul")) return "Tzk";
  if (prof.includes("achaz") || prof.includes("h'szint")) return "Ach";
  return null;
}

// ─── AsP-Würfel-Mechanik ────────────────────────────────────────────────────
// WdZ S.154-155: AsP-Wurf 1W6 pro Grad. Misslingen = halbe Kosten, NIE permanent.
// Ab Grad V: 1/10 der GEWÜRFELTEN AsP permanent (NICHT konstant 1).
// Code rechnet pAsP dynamisch aus aspKosten via Math.round(aspKosten/10) wenn permFraction>0.

const GRADE_ASP = {
  "I":   { dice: 1, mod: 0,  permFraction: 0 },
  "II":  { dice: 2, mod: 2,  permFraction: 0 },
  "III": { dice: 3, mod: 4,  permFraction: 0 },
  "IV":  { dice: 4, mod: 6,  permFraction: 0 },
  "V":   { dice: 5, mod: 8,  permFraction: 0.1 }, // 1/10 permanent (z.B. 23 AsP → 2 pAsP)
  "VI":  { dice: 6, mod: 10, permFraction: 0.1 },
};

// AsP-Helpers
export function getActorAsP(actor) {
  const sys = actor?.system ?? {};
  const cur = Number(sys.AsP?.value ?? sys.asp?.value ?? 0);
  const max = Number(sys.AsP?.max ?? sys.asp?.max ?? 0);
  const perm = Number(sys.AsP?.permanent ?? sys.asp?.permanent ?? actor?.getFlag?.(MODULE_ID, "aspPermanent") ?? 0);
  return { current: cur, max, permanent: perm };
}

async function setActorAsP(actor, current, permanent = null) {
  const updates = {};
  updates["system.AsP.value"] = Math.max(0, current);
  if (permanent !== null) updates["system.AsP.permanent"] = permanent;
  try {
    await actor.update(updates);
  } catch (e) {
    await actor.setFlag(MODULE_ID, "aspCurrent", current);
    if (permanent !== null) await actor.setFlag(MODULE_ID, "aspPermanent", permanent);
  }
}

// ─── Ritual-Probe ───────────────────────────────────────────────────────────

const GRADE_ORDER = ["I","II","III","IV","V","VI"];
function gradeIndex(g) { return GRADE_ORDER.indexOf((g || "I").split("-")[0]); }

/**
 * Wirkt ein Schamanen-Ritual.
 * Flow:
 *  1) Modifikatoren-Dialog (inkl. Aufstufung, Hilfsfertigkeit, Rauschmittel)
 *  2) 1W20 ≤ RkW − Mod
 *  3) AsP würfeln (1W6/Grad), abziehen
 *  4) Bei Misslingen: halbe Kosten, ggf. SF Verbotene Pforten (LeP)
 */
export async function castRitual(actor, ritualId) {
  const rit = RITUALE.find(r => r.id === ritualId);
  if (!rit) {
    ui.notifications.warn(`Ritual nicht gefunden: ${ritualId}`);
    return null;
  }
  const fertigkeit = rit.fertigkeit;
  if (!fertigkeit) { ui.notifications.error("Ritual hat keine Fertigkeit."); return null; }

  const rkw = getRkW(actor, fertigkeit);
  if (rkw <= 0) {
    ui.notifications.warn(`Keine Fertigkeit ${RITUALE_META?._fertigkeiten?.[fertigkeit]?.label ?? fertigkeit} gefunden.`);
    return null;
  }

  // Variable Grad-Range (z.B. "II-VI" beim Großen Geisterbann) — UI-Selector
  const gradStr = String(rit.grad || "I");
  const gradVariabel = rit.gradVariabel === true || gradStr.includes("-");
  let availableGrade = [gradStr];
  if (gradVariabel) {
    const parts = gradStr.split("-").map(s => s.trim());
    const startIdx = GRADE_ORDER.indexOf(parts[0]);
    const endIdx = GRADE_ORDER.indexOf(parts[1] ?? parts[0]);
    if (startIdx >= 0 && endIdx >= startIdx) {
      availableGrade = GRADE_ORDER.slice(startIdx, endIdx + 1);
    }
  }
  // baseGrad = niedrigster verfügbarer (User kann im Dialog wechseln)
  const baseGrad = availableGrade[0];
  const fertLabel = RITUALE_META?._fertigkeiten?.[fertigkeit]?.label ?? fertigkeit;
  const probeAttrs = RITUALE_META?._fertigkeiten?.[fertigkeit]?.probe ?? [];

  // Dialog
  const aufstufungOpts = ["ritualdauer","reichweite","wirkungsdauer","ziel"].map(c => `
    <label style="display:flex;gap:6px;align-items:center">
      <input type="checkbox" name="aufstufung-${c}">
      ${c} (+1 Grad, +2 Erschwernis)
    </label>
  `).join("");

  const gradSelectorHtml = gradVariabel ? `
    <hr>
    <label style="display:flex;gap:6px;align-items:center">
      <strong>Wirkungs-Grad wählen:</strong>
      <select name="chosen-grad">
        ${availableGrade.map(g => `<option value="${g}">${g}</option>`).join("")}
      </select>
      <span style="font-size:10px;color:#888">(je höher, desto stärker das Wesen das gebannt/gerufen wird)</span>
    </label>
  ` : "";

  const dlgContent = `
    <div class="dsa-pixel-sham-dialog">
      <style>
        .dsa-pixel-sham-dialog { background: #15181c; color: #e8eef4; padding: 14px; margin: -8px; border-radius: 4px; font-family: "Crimson Text", Georgia, serif; }
        .dsa-pixel-sham-dialog * { color: #e8eef4; }
        .dsa-pixel-sham-dialog .dlg-title { font-size: 16px; font-weight: 700; color: #a0d0e8; margin-bottom: 4px; }
        .dsa-pixel-sham-dialog .dlg-title em { color: #888; font-size: 13px; font-weight: 400; }
        .dsa-pixel-sham-dialog .dlg-meta { font-size: 11px; color: #8090a0; margin-bottom: 4px; }
        .dsa-pixel-sham-dialog .dlg-fert { font-size: 11px; color: #c8e0a0; margin-bottom: 6px; }
        .dsa-pixel-sham-dialog .dlg-effekt { font-size: 12px; color: #b8c8d8; font-style: italic; padding: 6px 10px; background: rgba(0,0,0,0.25); border-left: 2px solid #5078a0; border-radius: 3px; margin-bottom: 8px; }
        .dsa-pixel-sham-dialog hr { border: none; border-top: 1px solid rgba(160,208,232,0.2); margin: 10px 0; }
        .dsa-pixel-sham-dialog .dlg-section-title { font-weight: 700; font-size: 13px; color: #a0d0e8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
        .dsa-pixel-sham-dialog label { display: flex; align-items: center; gap: 8px; padding: 4px 6px; cursor: pointer; border-radius: 3px; }
        .dsa-pixel-sham-dialog label:hover { background: rgba(160,208,232,0.06); }
        .dsa-pixel-sham-dialog input[type="checkbox"] { accent-color: #a0d0e8; }
        .dsa-pixel-sham-dialog input[type="number"], .dsa-pixel-sham-dialog select { background: #1c2530 !important; color: #e8eef4 !important; border: 1px solid #2c3a4a !important; padding: 4px 8px; border-radius: 3px; font-family: inherit; }
      </style>
      <div class="dlg-title">${rit.name}${rit.subtitel ? ` <em>(${rit.subtitel})</em>` : ""}</div>
      <div class="dlg-meta">Grad ${rit.grad} · ${rit.ziel} · ${rit.ritualdauer}</div>
      <div class="dlg-fert">Fertigkeit: ${fertLabel} (${probeAttrs.join("/")})</div>
      <div class="dlg-effekt">${rit.effekt || ""}</div>
      ${gradSelectorHtml}
      <hr>
      <div class="dlg-section-title">Aufstufung</div>
      ${aufstufungOpts}
      <hr>
      <label>Hilfsfertigkeit (Trommel/Tanz/Singen) TaP*: <input type="number" name="hilfs" value="0" min="0" style="width:70px"></label>
      <label>Rauschmittel-Mod (-8 bis +2): <input type="number" name="rausch" value="0" min="-8" max="2" style="width:70px"></label>
      <label>Eigene Modifikation: <input type="number" name="custom" value="0" style="width:70px"></label>
      <hr>
      <label>
        <input type="checkbox" name="verbotene-pforten">
        SF Verbotene Pforten (LeP statt fehlender AsP)
      </label>
      <label>
        <input type="checkbox" name="blutmagie">
        SF Blutmagie (1 LeP für 1 AsP-Erleichterung)
      </label>
    </div>
  `;

  return new Promise((resolve) => {
    new Dialog({
      title: `Schamanen-Ritual: ${rit.name}`,
      content: dlgContent,
      buttons: {
        cast: {
          label: "Ritual durchführen",
          callback: async (html) => {
            const $h = html instanceof jQuery ? html : $(html);
            const hilfsTap = Number($h.find("input[name=hilfs]").val()) || 0;
            const rauschMod = Number($h.find("input[name=rausch]").val()) || 0;
            const customMod = Number($h.find("input[name=custom]").val()) || 0;
            const verbotenePf = $h.find("input[name=verbotene-pforten]").is(":checked");

            // Bei variablem Grad → User-Wahl als Basis nehmen
            const chosenGrad = $h.find("select[name=chosen-grad]").val() || baseGrad;
            const chosenIdx = gradeIndex(chosenGrad);

            let aufstufungCount = 0;
            ["ritualdauer","reichweite","wirkungsdauer","ziel"].forEach(c => {
              if ($h.find(`input[name=aufstufung-${c}]`).is(":checked")) aufstufungCount++;
            });
            const effIdx = chosenIdx + aufstufungCount;
            if (effIdx > 5) {
              ui.notifications.error("Aufstufung überschreitet Grad VI.");
              resolve(null); return;
            }
            const effGrad = GRADE_ORDER[effIdx];
            const effMeta = GRADE_ASP[effGrad];

            // Hilfsfertigkeit halbe TaP* als Erleichterung (gerundet)
            // Misslungen +7 Erschwernis (Spieler kann negativ eingeben)
            const hilfsMod = -Math.floor(hilfsTap / 2);
            const aufstufungMod = aufstufungCount * 2;

            // Keulen-Bonus: wenn aktive Keule "Hilfe der Keule" auf passende Fertigkeit hat
            let keuleMod = 0;
            let keuleNote = "";
            try {
              const { getKeulenBoni } = await import("./keule.mjs");
              const boni = getKeulenBoni(actor);
              // WdZ S.167 "Hilfe der Keule": erleichtert SÄMTLICHE Schamanen-
              // Rituale (außer Keulen-Rituale selbst). Stufe I/II/III → -1/-2/-3.
              if (boni?.hilfeMod) {
                keuleMod += boni.hilfeMod;
                keuleNote = ` · Hilfe der Keule ${boni.hilfeMod >= 0 ? "+" : ""}${boni.hilfeMod}`;
              }
              // WdZ S.167 "Bann der Keule": erleichtert Kontrollproben gegen
              // Geister/Dämonen um -1/-2/-3 (nicht +9/+12/+15 — das war die
              // Erschaffungs-Erschwernis). Wirkt auf Geister-bannen-Probe.
              if (boni?.bannMod && fertigkeit === "geister-bannen") {
                keuleMod += boni.bannMod;  // bannMod ist bereits negativ (-stufe)
                keuleNote += ` · Bann der Keule ${boni.bannMod}`;
              }
            } catch {}

            const totalMod = effMeta.mod + hilfsMod + rauschMod + customMod + aufstufungMod + keuleMod;
            const target = rkw - totalMod;

            // 1W20-Probe
            const roll = await new Roll("1d20").evaluate();
            const wurf = roll.total;
            const erfolg = wurf <= target;
            const rkpStar = erfolg ? Math.max(1, rkw - wurf) : 0;

            // AsP würfeln (1W6 pro Grad)
            const aspRoll = await new Roll(`${effMeta.dice}d6`).evaluate();
            let aspKosten = aspRoll.total;
            // WdZ S.167: Zauber der Keule senkt AsP-Kosten jedes Schamanen-
            // Rituals um die Ritual-Stufe (1/2/3), nie unter 1 AsP gesamt.
            const zauberRed = (() => {
              try {
                // boni wurde oben bereits gelesen; aber falls der Code-Block
                // keinen direkten Zugriff darauf hat, lesen wir hier neu.
                if (typeof boni !== "undefined" && boni?.zauberAspReduktion) {
                  return boni.zauberAspReduktion;
                }
              } catch {}
              return 0;
            })();
            if (zauberRed > 0) {
              aspKosten = Math.max(1, aspKosten - zauberRed);
            }
            // pAsP: 1/10 der GEWÜRFELTEN AsP, NICHT eine Konstante (WdZ S.155).
            // Bei aspKosten=23 → 2 pAsP, bei 8 → 1 pAsP, bei <5 → 0 pAsP.
            const aspPerm = effMeta.permFraction > 0
              ? Math.max(0, Math.round(aspKosten * effMeta.permFraction))
              : 0;

            // AsP abziehen
            const asp = getActorAsP(actor);
            let aspAbzug = erfolg ? aspKosten : Math.max(1, Math.floor(aspKosten / 2));
            let lepAbzug = 0;
            let pAspAbzug = erfolg ? aspPerm : 0;

            if (aspAbzug > asp.current) {
              if (verbotenePf) {
                lepAbzug = aspAbzug - asp.current;
                aspAbzug = asp.current;
              } else {
                ui.notifications.error(`Zu wenig AsP (${asp.current}/${aspAbzug}). Aktiviere SF Verbotene Pforten oder breche ab.`);
                resolve(null); return;
              }
            }
            const aspNeu = Math.max(0, asp.current - aspAbzug);
            const pAspNeu = Math.max(0, asp.permanent - pAspAbzug);
            await setActorAsP(actor, aspNeu, pAspAbzug ? pAspNeu : null);

            if (lepAbzug > 0) {
              const sys = actor.system ?? {};
              const lep = Number(sys.LeP?.value ?? sys.lep?.value ?? 0);
              const lepNeu = Math.max(-30, lep - lepAbzug);
              try { await actor.update({ "system.LeP.value": lepNeu }); }
              catch { await actor.setFlag(MODULE_ID, "lepCurrent", lepNeu); }
            }

            const html2 = `<div class="dsa-pixel-chat">
              <div class="chat-title">🪶 ${rit.name}${rit.subtitel ? ` <em>(${rit.subtitel})</em>` : ""}</div>
              <div class="chat-row" style="font-size:11px;color:#aaa">${fertLabel} · Grad ${effGrad}${aufstufungCount ? ` (Aufstufung +${aufstufungCount})` : ""}${keuleNote}</div>
              <hr>
              <div class="chat-row">RkW ${rkw} − Mod ${totalMod} → Ziel ${target}</div>
              <div class="chat-row"><strong>1W20:</strong> ${wurf} ${erfolg ? "✓" : "✗"}</div>
              <div class="chat-row"><strong>AsP-Wurf (${effMeta.dice}W6):</strong> ${aspKosten}${aspPerm ? ` (davon ${aspPerm} permanent)` : ""}</div>
              ${erfolg
                ? `<div class="result-line result-success">Erfolg — RkP* ${rkpStar}<br>
                   Wirkungsdauer: ${rit.wirkungsdauer}</div>
                   <div class="chat-row" style="font-size:11px">${rit.effekt}</div>`
                : `<div class="result-line result-fail">Fehlschlag — halbe AsP-Kosten</div>`
              }
              <div class="chat-row">AsP: ${asp.current} → ${aspNeu}${lepAbzug ? ` · LeP: -${lepAbzug} (Verbotene Pforten)` : ""}${pAspAbzug ? ` · pAsP: -${pAspAbzug}` : ""}</div>
            </div>`;

            ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor }),
              content: html2,
              rolls: [roll, aspRoll],
              type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            });

            resolve({ erfolg, rkpStar, aspKosten, aspNeu, lepAbzug });
          }
        },
        cancel: { label: "Abbrechen", callback: () => resolve(null) }
      },
      default: "cast",
    }, {
      classes: ["dsa-pixel-dialog"],
      width: 540,
    }).render(true);
  });
}

// ─── Schamanen-Browser-UI ───────────────────────────────────────────────────

export class SchamanenApp extends Application {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this._kulturFilter = getActorKultur(actor) || "";
    this._fertigkeitFilter = "";
    this._search = "";
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dsa-pixel-schamanen",
      title: "DSA Schamanen-Rituale",
      template: `modules/${MODULE_ID}/templates/shamanism.hbs`,
      width: 760,
      height: 620,
      resizable: true,
      classes: ["dsa-pixel-app", "dsa-pixel-shamanism"],
    });
  }

  async getData() {
    const kult = this._kulturFilter;
    const fert = this._fertigkeitFilter;
    const rituale = (RITUALE ?? []).filter(r => {
      if (kult && !(r.kulturen || []).includes(kult)) return false;
      if (fert && r.fertigkeit !== fert) return false;
      if (this._search) {
        const s = this._search.toLowerCase();
        if (!r.name.toLowerCase().includes(s) &&
            !(r.effekt||"").toLowerCase().includes(s) &&
            !(r.auswirkung||"").toLowerCase().includes(s)) return false;
      }
      return true;
    });

    // Gruppierung nach Grad
    const gradOrder = ["I","II","III","IV","V","VI","II-VI","II bis VI"];
    const byGrad = {};
    for (const r of rituale) {
      const g = (r.grad || "?").toString();
      if (!byGrad[g]) byGrad[g] = [];
      byGrad[g].push(r);
    }
    for (const g of Object.keys(byGrad)) {
      byGrad[g].sort((a, b) => a.name.localeCompare(b.name, "de"));
    }
    const gradeMap = RITUALE_META?._grade || {};
    const ritualeByGrad = gradOrder
      .filter(g => byGrad[g] && byGrad[g].length)
      .map(grad => {
        const baseGrad = grad.split("-")[0].split(" ")[0];
        const m = gradeMap[baseGrad] || {};
        return {
          grad,
          rituale: byGrad[grad],
          aspKosten: m.asp || "?",
          perm: m.permanent || null,
        };
      });
    for (const g of Object.keys(byGrad)) {
      if (!gradOrder.includes(g)) {
        ritualeByGrad.push({ grad: g, rituale: byGrad[g], aspKosten: "?", perm: null });
      }
    }

    const fertigkeiten = FERTIGKEIT_KEYS.map(k => ({
      key: k,
      label: RITUALE_META?._fertigkeiten?.[k]?.label ?? k,
      probe: RITUALE_META?._fertigkeiten?.[k]?.probe ?? [],
      rkw: getRkW(this.actor, k),
    }));

    const asp = getActorAsP(this.actor);

    return {
      actorName: this.actor.name,
      kultur: kult,
      kulturen: Object.entries(RITUALE_META?._kulturen ?? {}).map(([code, label]) => ({ code, label })),
      fertigkeitFilter: fert,
      fertigkeiten,
      asp,
      rituale,
      ritualeByGrad,
      keulenRituale: RITUALE_META?._keulenRituale ?? [],
      knochenkeulen: RITUALE_META?._knochenkeulen ?? [],
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    const $h = html instanceof jQuery ? html : $(html);
    $h.find('[data-action="cast-ritual"]').on("click", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const id = ev.currentTarget.dataset.id;
      await castRitual(this.actor, id);
      this.render();
    });
    $h.find('[data-action="show-detail"]').on("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const id = ev.currentTarget.dataset.id;
      const rit = (RITUALE ?? []).find(r => r.id === id);
      if (rit) new SchamanenRitualDetailApp(this.actor, rit, this).render(true);
    });
    $h.find('select[name=kultur]').on("change", (ev) => {
      this._kulturFilter = ev.currentTarget.value;
      this.render();
    });
    $h.find('select[name=fertigkeit]').on("change", (ev) => {
      this._fertigkeitFilter = ev.currentTarget.value;
      this.render();
    });
    $h.find('input[name=search]').on("input", (ev) => {
      this._search = ev.currentTarget.value;
      this.render();
    });
    $h.find('[data-action="set-rkw"]').on("click", async (ev) => {
      const fert = ev.currentTarget.dataset.fertigkeit;
      const cur = getRkW(this.actor, fert);
      const val = await Dialog.prompt({
        title: `RkW setzen — ${RITUALE_META?._fertigkeiten?.[fert]?.label ?? fert}`,
        content: `<p>Aktuell: ${cur}</p><input type="number" name="rkw" value="${cur}" style="width:80px">`,
        callback: (html) => Number($(html).find("input[name=rkw]").val()) || 0,
      }).catch(() => null);
      if (val !== null) {
        await setRkW(this.actor, fert, val);
        this.render();
      }
    });
  }
}

// ─── Detail-Dialog für ein einzelnes Ritual ────────────────────────────────

export class SchamanenRitualDetailApp extends Application {
  constructor(actor, ritual, parentApp = null, options = {}) {
    super(options);
    this.actor = actor;
    this.ritual = ritual;
    this.parentApp = parentApp;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dsa-pixel-ritual-detail",
      title: "Ritual-Details",
      template: `modules/${MODULE_ID}/templates/ritual-detail.hbs`,
      width: 620,
      height: "auto",
      resizable: true,
      classes: ["dsa-pixel-app", "dsa-pixel-ritual-detail"],
    });
  }

  get title() { return this.ritual?.name || "Ritual"; }

  async getData() {
    const r = this.ritual;
    const baseGrad = (r.grad || "I").toString().split("-")[0].split(" ")[0];
    const gradeMap = RITUALE_META?._grade || {};
    const m = gradeMap[baseGrad] || {};
    const fertMeta = RITUALE_META?._fertigkeiten?.[r.fertigkeit];
    return {
      ...r,
      probeAttrs: (fertMeta?.probe || []).join("/"),
      aspKosten: m.asp || "?",
      perm: m.permanent || null,
      probenZuschlag: m.modifikator ?? 0,
      probenZuschlagSigned: (m.modifikator ?? 0) >= 0 ? `+${m.modifikator}` : `${m.modifikator}`,
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    const $h = html instanceof jQuery ? html : $(html);
    $h.find('[data-action="cast-ritual"]').on("click", async (ev) => {
      ev.preventDefault();
      const id = ev.currentTarget.dataset.id;
      await castRitual(this.actor, id);
      this.parentApp?.render?.();
      this.close();
    });
    $h.find('[data-action="close"]').on("click", (ev) => {
      ev.preventDefault();
      this.close();
    });
  }
}

// ─── Init / Sidebar-Button ──────────────────────────────────────────────────

export function registerShamanism() {
  Hooks.on("getSceneControlButtons", (controls) => {
    const tokenCtrl = controls.find(c => c.name === "token");
    if (!tokenCtrl) return;
    if (tokenCtrl.tools.find(t => t.name === "dsa-schamanen")) return;
    tokenCtrl.tools.push({
      name: "dsa-schamanen",
      title: "DSA Schamanen-Rituale",
      icon: "fas fa-feather-alt",
      visible: true,
      onClick: () => {
        const actor = canvas.tokens?.controlled?.[0]?.actor || game.user.character;
        if (!actor) {
          ui.notifications.warn("Bitte einen Schamanen-Token auswählen.");
          return;
        }
        new SchamanenApp(actor).render(true);
      },
      button: true,
    });
  });

  globalThis.DSASchamanen = (actor) => {
    const a = actor || canvas.tokens?.controlled?.[0]?.actor || game.user.character;
    if (!a) { ui.notifications.warn("Kein Actor."); return; }
    new SchamanenApp(a).render(true);
  };
  globalThis.DSARitual = (actor, ritualId) => {
    const a = actor || canvas.tokens?.controlled?.[0]?.actor || game.user.character;
    if (!a || !ritualId) { ui.notifications.warn("Actor oder Ritual-ID fehlt."); return; }
    return castRitual(a, ritualId);
  };
}
