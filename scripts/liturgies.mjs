/**
 * DSA 4.1 Liturgien & Karma-System
 * Hauptquelle: Liber Liturgium (C02), Wege der Götter
 *
 * Mechanik-Kern:
 *   - Geweihter wirft 1W20 ≤ Liturgiekenntnis(Kult) − Probenzuschlag(Grad) − Modifikatoren
 *   - LkP* = LkW − Wurfwert (analog ZfP* bei Magie)
 *   - Mirakel: 5 KaP fix, 1 Aktion, modifiziert nach Mirakel±/ungelistet
 *   - KaP-Tabelle 0/I…VIII, ab Grad V mit pKaP-Anteil
 *   - Aufstufung: 4 Kategorien (Ritualdauer/Reichweite/Wirkungsdauer/Ziel),
 *     je +1 Grad, +2 Erschwernis, max 1×/Kategorie, 3×Grad ≤ LkW
 *   - Wirkungsdauer-Tabelle nach Stufe (1=augenbl.) … 10=permanent)
 */

import { MODULE_ID } from "./config.mjs";

let LITURGIEN = null;
let LITURGIEN_META = null;

// ─── Daten laden ────────────────────────────────────────────────────────────

export async function loadLiturgien() {
  try {
    const resp = await fetch(`modules/${MODULE_ID}/data/liturgien.json`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    LITURGIEN = data.liturgien || [];
    LITURGIEN_META = data._meta || {};
    console.log(`[${MODULE_ID}] Liturgien geladen: ${LITURGIEN.length} Einträge`);
    return data;
  } catch (e) {
    console.warn(`[${MODULE_ID}] Liturgien laden fehlgeschlagen:`, e.message);
    LITURGIEN = [];
    LITURGIEN_META = {};
    return { liturgien: [], _meta: {} };
  }
}

export function getLiturgien() { return LITURGIEN ?? []; }
export function getLiturgienMeta() { return LITURGIEN_META ?? {}; }

/** Filtert Liturgien nach Gott (allgemeine + universelle + Gott-spezifische). */
export function getLiturgienForGod(gottName) {
  if (!LITURGIEN) return [];
  return LITURGIEN.filter(l => {
    if (!l.gott || !Array.isArray(l.gott)) return false;
    // universell + allgemein sind allen Geweihten zugänglich, sofern sie im gott-Array stehen
    if (l.gott.includes(gottName)) return true;
    // universell-only-Liturgien (ohne explizite Gott-Liste) auch zeigen
    if (l.art === "universell" && l.gott.length === 0) return true;
    return false;
  });
}

// ─── Karma-Pool-Helpers ─────────────────────────────────────────────────────

/**
 * Liest die KaP-Werte aus dem Actor.
 * gdsa System speichert Karma typischerweise in system.KaP (current/max).
 * Falls nicht vorhanden, fallback auf Flag.
 */
export function getActorKaP(actor) {
  const sys = actor?.system ?? {};
  // Standard gdsa-Pfade
  const cur = Number(sys.KaP?.value ?? sys.kap?.value ?? sys.karma?.value ?? 0);
  const max = Number(sys.KaP?.max ?? sys.kap?.max ?? sys.karma?.max ?? 0);
  // Permanente KaP
  const perm = Number(sys.KaP?.permanent ?? sys.kap?.permanent ?? actor?.getFlag?.(MODULE_ID, "kapPermanent") ?? 0);
  return { current: cur, max, permanent: perm };
}

/** Schreibt KaP zurück. Versucht erst gdsa-Schema, fallback Flag. */
export async function setActorKaP(actor, current, max = null, permanent = null) {
  const updates = {};
  if (current !== null && current !== undefined) {
    updates["system.KaP.value"] = Math.max(0, current);
  }
  if (max !== null) updates["system.KaP.max"] = max;
  if (permanent !== null) updates["system.KaP.permanent"] = permanent;
  try {
    await actor.update(updates);
  } catch (e) {
    console.warn(`[${MODULE_ID}] KaP update via system failed, falling back to flags`, e);
    if (current !== null) await actor.setFlag(MODULE_ID, "kapCurrent", current);
    if (max !== null) await actor.setFlag(MODULE_ID, "kapMax", max);
    if (permanent !== null) await actor.setFlag(MODULE_ID, "kapPermanent", permanent);
  }
  return { current, max, permanent };
}

/**
 * Karma-Regeneration (Wege der Götter S.40+).
 * Modi:
 *   "meditation":   1 Stunde stilles Gebet → +1 KaP
 *   "morgengebet":  morgendliche Gebete → +eigeneRegenerationsRate (basis 1)
 *   "tempel":       Tempel des eigenen Kults → +1 KaP (Bonus zu Meditation)
 *   "feiertag":     Feiertag des eigenen Kults → +1 KaP zusätzlich (1× pro Tag)
 *   "voll":         volle Tageszyklus → KaP auf max
 *
 * @param {Actor} actor
 * @param {string} modus
 * @param {object} opts - { tempel: bool, feiertag: bool, talentReg: number (Talentwert Religion) }
 * @returns {Promise<object>} { gained, current, max, modus }
 */
export async function regenerateKaP(actor, modus = "meditation", opts = {}) {
  const kap = getActorKaP(actor);
  if (kap.max <= 0) {
    ui.notifications.warn(`${actor.name} hat keinen KaP-Pool — keine Regeneration möglich.`);
    return null;
  }
  let gain = 0;
  let label = "";
  switch (modus) {
    case "meditation": {
      // 1 KaP pro Stunde Meditation, +1 in Tempel, +1 an Feiertag
      gain = 1;
      label = "Meditation (1 Stunde)";
      if (opts.tempel)   { gain += 1; label += " im Tempel +1"; }
      if (opts.feiertag) { gain += 1; label += " an Feiertag +1"; }
      break;
    }
    case "morgengebet": {
      // Morgengebet: regeneration nach Talent Religionskenntnis
      const tw = Number(actor.system?.talente?.["Religion"]?.value ?? 5);
      gain = Math.max(1, Math.floor(tw / 4)); // 1 KaP pro 4 TaW Religion (faustregel)
      label = `Morgengebet (Religion ${tw} → +${gain})`;
      if (opts.tempel)   { gain += 1; label += " im Tempel +1"; }
      if (opts.feiertag) { gain += 2; label += " an Feiertag +2"; }
      break;
    }
    case "tempel": {
      gain = 2;
      label = "Tempelaufenthalt (2 Stunden)";
      break;
    }
    case "voll": {
      gain = kap.max - kap.current;
      label = "Volle Regeneration (Heimreise / Initiationsritus)";
      break;
    }
    default: {
      gain = 1;
      label = modus;
    }
  }
  const newKaP = Math.min(kap.max, kap.current + gain);
  const actuallyGained = newKaP - kap.current;
  await setActorKaP(actor, newKaP);

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="dsa-pixel-chat">
      <div class="chat-title">🙏 Karma-Regeneration — ${label}</div>
      <div class="chat-row">+${actuallyGained} KaP (${kap.current} → ${newKaP} / ${kap.max})</div>
    </div>`,
  });
  return { gained: actuallyGained, current: newKaP, max: kap.max, modus };
}

/** Liturgiekenntnis-Wert (LkW) für einen bestimmten Kult. */
export function getLkW(actor, kult) {
  // Erst Item-basiert (Talent oder SF)
  const items = actor?.items ?? [];
  const item = [...items].find(i => {
    const n = (i.name || "").toLowerCase();
    return n.includes("liturgiekenntnis") && n.includes((kult || "").toLowerCase());
  });
  if (item) {
    return Number(item.system?.value ?? item.system?.taw ?? item.system?.zfw ?? 0);
  }
  // Flag-Fallback (vom XML-Parser gesetzt)
  const flagMap = actor?.getFlag?.(MODULE_ID, "liturgiekenntnisse") ?? {};
  return Number(flagMap[kult] ?? 0);
}

/** Liefert den Hauskult/Gott des Charakters (aus profession/flag). */
export function getActorKult(actor) {
  // 1) Explizit gesetzt im Flag
  const flag = actor?.getFlag?.(MODULE_ID, "kult");
  if (flag) return flag;
  // 2) Aus Profession lesen (gdsa)
  const prof = actor?.system?.profession?.value || actor?.system?.profession || "";
  const lower = String(prof).toLowerCase();
  // Hochschamanen-Pantheons zuerst (wegen Tairach-Match-Konflikt mit Tairach-Priester)
  if (lower.includes("kamaluq") || lower.includes("hochschamane") && (lower.includes("waldmensch") || lower.includes("utulu") || lower.includes("tocamuy"))) return "Kamaluq";
  if (lower.includes("tairach") && (lower.includes("hochschamane") || lower.includes("priester"))) return "Tairach";
  if (lower.includes("himmelswölfe") || lower.includes("himmelswolf") || (lower.includes("hochschamane") && lower.includes("nives"))) return "Himmelswölfe";
  for (const gott of ["Praios","Rondra","Efferd","Travia","Boron","Hesinde","Phex","Peraine","Ingerimm","Rahja","Tsa","Firun","Aves","Ifirn","Kor","Nandus","Swafnir","Marbo","Angrosch","H'Szint","H'Ranga","Gravesh"]) {
    if (lower.includes(gott.toLowerCase())) return gott;
  }
  return null;
}

/** Ist der Actor ein Hochschamane? (zweite Initiation via SF "Kontakt zum Großen Geist") */
export function isHochschamane(actor) {
  const kult = getActorKult(actor);
  if (["Kamaluq","Tairach","Himmelswölfe"].includes(kult)) return true;
  // Über SF prüfen
  const items = actor?.items ?? [];
  return [...items].some(i => /kontakt zum großen geist/i.test(i.name || ""));
}

/** Liefert für Hochschamanen den "Geister aufnehmen"-Wert als Mirakelprobe-Basis. */
function getHochschamaneMirakelTalent(actor) {
  const items = actor?.items ?? [];
  const item = [...items].find(i => /geister.*aufnehmen/i.test(i.name || ""));
  if (item) return Number(item.system?.value ?? item.system?.taw ?? 0);
  // Flag-Fallback
  const flagMap = actor?.getFlag?.(MODULE_ID, "geisterFertigkeiten") ?? {};
  return Number(flagMap["geister-aufnehmen"] ?? 0);
}

// ─── Mirakel ────────────────────────────────────────────────────────────────

/**
 * Wirft eine Mirakel-Probe: 1W20 ≤ LkW + Modifikator.
 * Mod aus Meta: mirakelPlus=0, ungelistet=+6, mirakelMinus=+18.
 */
export async function rollMirakel(actor, modKey = "mirakelPlus") {
  const kult = getActorKult(actor);
  if (!kult) {
    ui.notifications.warn("Kein Kult gefunden — Mirakel braucht eine geweihte Profession.");
    return null;
  }
  // Hochschamanen-Sonderfall: Mirakelprobe = Geister aufnehmen, NICHT Liturgiekenntnis
  // (WdH S.293 SF "Kontakt zum Großen Geist")
  const istHoch = isHochschamane(actor);
  const lkw = istHoch ? getHochschamaneMirakelTalent(actor) : getLkW(actor, kult);
  const probeBezeichnung = istHoch ? "Geister aufnehmen" : `Liturgiekenntnis (${kult})`;
  if (lkw <= 0) {
    ui.notifications.warn(`Kein Wert für ${probeBezeichnung} gefunden.`);
    return null;
  }
  const kap = getActorKaP(actor);
  const cost = LITURGIEN_META?._mirakel?.kosten ?? 5;
  if (kap.current < cost) {
    ui.notifications.warn(`Zu wenig KaP: ${kap.current}/${cost}`);
    return null;
  }
  const mods = LITURGIEN_META?._mirakel?.modifikatoren ?? { mirakelPlus: 0, ungelistet: 6, mirakelMinus: 18 };
  const baseMod = mods[modKey] ?? 0;

  // LL S.8: "Bei Mirakeln gelten jedoch nur die Hälfte der dort angegebenen
  // Zuschläge." Situative Mods (Tempel, Feiertag, Notlage) werden halbiert.
  // Mirakel±-Modifikator (0/+6/+18) bleibt voll.
  const situativ = await new Promise((resolve) => {
    new Dialog({
      title: "Mirakel — Situativer Modifikator",
      content: `<div class="dsa-mod-dialog" style="padding:10px;color-scheme:dark">
        <div style="margin-bottom:6px">Optionaler situativer Modifikator (Tempel, Feiertag, Notlage):</div>
        <div style="margin-bottom:8px"><label>Mod (Roh, wird halbiert): <input type="number" id="mir-mod" value="0" style="width:60px;background:#0d1b2e;color:#fff;border:1px solid #3a3a5e"/></label></div>
        <div style="font-size:11px;color:#779">LL S.8: Bei Mirakeln zählen Tabellen-Mods nur zur Hälfte (gerundet).</div>
      </div>`,
      buttons: {
        ok: { label: "Wirken", callback: (h) => resolve(parseInt(h.find("#mir-mod").val()) || 0) },
        cancel: { label: "Ohne Mod", callback: () => resolve(0) },
      },
      default: "ok",
      close: () => resolve(0),
    }).render(true);
  });
  const halbierterSituativ = Math.round(situativ / 2);
  const mod = baseMod + halbierterSituativ;
  const target = lkw - mod;

  const roll = await new Roll("1d20").evaluate();
  const wurf = roll.total;
  const erfolg = wurf <= target;
  const lkpStar = erfolg ? Math.max(1, lkw - wurf) : 0;
  const aspNeu = erfolg ? Math.max(0, kap.current - cost) : Math.max(0, kap.current - 1);
  await setActorKaP(actor, aspNeu);

  const html = `<div class="dsa-pixel-chat">
    <div class="chat-title">🙏 Mirakel — ${kult}${istHoch ? " (Hochschamane)" : ""}</div>
    <div class="chat-row">${probeBezeichnung} ${lkw} − Mod ${mod} → Ziel ${target}</div>
    <div class="chat-row"><strong>1W20:</strong> ${wurf} ${erfolg ? "✓" : "✗"}</div>
    ${erfolg
      ? `<div class="result-line result-success">Erfolg — LkP* ${lkpStar}<br>
         Effekt: +${Math.floor(lkpStar/2)+2} auf Eigenschaft/MR ODER +${Math.floor(lkpStar/2)+5} auf Talent/Gabe (1 Probe)</div>
         <div class="chat-row">KaP-Kosten: ${cost} (${kap.current} → ${aspNeu})</div>`
      : `<div class="result-line result-fail">Fehlschlag — 1 KaP verloren (${kap.current} → ${aspNeu})</div>`
    }
  </div>`;

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: html,
    rolls: [roll],
    type: CONST.CHAT_MESSAGE_TYPES.ROLL,
  });

  return { roll: wurf, erfolg, lkpStar, kapCost: cost };
}

// ─── Liturgie-Probe ─────────────────────────────────────────────────────────

const GRADE_ORDER = ["0","I","II","III","IV","V","VI","VII","VIII"];
function gradeIndex(g) { return Math.max(0, GRADE_ORDER.indexOf(g)); }
function gradeAtIndex(i) { return GRADE_ORDER[Math.max(0, Math.min(GRADE_ORDER.length-1, i))]; }

/**
 * Wirkt eine Liturgie. Öffnet Dialog mit Aufstufungs-Toggles + Mod-Eingabe.
 */
export async function castLiturgie(actor, liturgieId) {
  const lit = LITURGIEN.find(l => l.id === liturgieId);
  if (!lit) {
    ui.notifications.warn(`Liturgie nicht gefunden: ${liturgieId}`);
    return null;
  }
  const kult = getActorKult(actor);
  if (!kult) { ui.notifications.warn("Kein Kult gefunden."); return null; }
  const lkw = getLkW(actor, kult);
  if (lkw <= 0) { ui.notifications.warn(`Keine Liturgiekenntnis (${kult}).`); return null; }

  const isPrimaer = Array.isArray(lit.primaer) && lit.primaer.includes(kult);
  // Variable Grad-Range bei z.B. Exorzismus oder Schutzsegen ("I-III"/"III-VI")
  const gradStr = String(lit.grad || "I");
  const gradVariabel = lit.gradVariabel === true || gradStr.includes("-");
  let availableGrade = [gradStr];
  if (gradVariabel) {
    const parts = gradStr.split("-").map(s => s.trim());
    const startIdx = GRADE_ORDER.indexOf(parts[0]);
    const endIdx = GRADE_ORDER.indexOf(parts[1] ?? parts[0]);
    if (startIdx >= 0 && endIdx >= startIdx) {
      availableGrade = GRADE_ORDER.slice(startIdx, endIdx + 1);
    }
  }
  const baseGrad = availableGrade[0]; // erstmal niedrigster Grad als Default
  const meta = LITURGIEN_META?._kapKosten ?? {};

  // Dialog
  const opts = [
    { key: "Notlage",     label: "Notlage (-3)",          val: -3 },
    { key: "Auftrag",     label: "Göttl. Auftrag (-5)",   val: -5 },
    { key: "Eigensueltig",label: "Eigensucht (+5)",       val: 5 },
    { key: "Eidbrecher",  label: "Eidbrecher (+3)",       val: 3 },
    { key: "Magie",       label: "magischer Zwang (+12)", val: 12 },
    { key: "Heimat",      label: "eig. zweifach geweiht (-3)", val: -3 },
    { key: "Heiligtum",   label: "Heiligtum (-4)",        val: -4 },
    { key: "Limbus",      label: "Limbus (+7)",           val: 7 },
    { key: "Feiertag",    label: "Feiertag (-3)",         val: -3 },
    { key: "Namenlose",   label: "Namenlose Tage (+7)",   val: 7 },
  ];

  const optionsHtml = opts.map(o => `
    <label class="dsa-pixel-row" style="display:flex;gap:6px;align-items:center">
      <input type="checkbox" name="mod-${o.key}" data-val="${o.val}">
      ${o.label}
    </label>
  `).join("");

  const aufstufungOpts = ["ritualdauer","reichweite","wirkungsdauer","ziel"].map(c => `
    <label class="dsa-pixel-row" style="display:flex;gap:6px;align-items:center">
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
        <span style="font-size:10px;color:#888">(höherer Grad = stärkere Wirkung, mehr KaP)</span>
      </label>
  ` : "";

  const dlgContent = `
    <div class="dsa-pixel-dialog">
      <style>
        .dsa-pixel-dialog { background: #1a1612; color: #f0e8d8; padding: 14px; margin: -8px; border-radius: 4px; font-family: "Crimson Text", Georgia, serif; }
        .dsa-pixel-dialog * { color: #f0e8d8; }
        .dsa-pixel-dialog .dlg-title { font-size: 16px; font-weight: 700; color: #ffd770; margin-bottom: 4px; }
        .dsa-pixel-dialog .dlg-meta { font-size: 11px; color: #aaa080; margin-bottom: 8px; }
        .dsa-pixel-dialog .dlg-effekt { font-size: 12px; color: #d8c898; font-style: italic; padding: 6px 10px; background: rgba(0,0,0,0.25); border-left: 2px solid #b8841c; border-radius: 3px; margin-bottom: 8px; }
        .dsa-pixel-dialog hr { border: none; border-top: 1px solid rgba(255,215,112,0.2); margin: 10px 0; }
        .dsa-pixel-dialog .dlg-section-title { font-weight: 700; font-size: 13px; color: #ffd770; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
        .dsa-pixel-dialog label { display: flex; align-items: center; gap: 8px; padding: 4px 6px; cursor: pointer; border-radius: 3px; }
        .dsa-pixel-dialog label:hover { background: rgba(255,215,112,0.06); }
        .dsa-pixel-dialog input[type="checkbox"] { accent-color: #ffd770; }
        .dsa-pixel-dialog input[type="number"], .dsa-pixel-dialog select { background: #2a2018 !important; color: #f0e8d8 !important; border: 1px solid #4a3525 !important; padding: 4px 8px; border-radius: 3px; font-family: inherit; }
        .dsa-pixel-dialog .primaer-banner { background: linear-gradient(180deg, #b8841c 0%, #8a5f12 100%); color: #1a1612 !important; padding: 6px 10px; border-radius: 3px; font-weight: 700; margin: 8px 0; }
        .dsa-pixel-dialog .primaer-banner strong { color: #1a1612 !important; }
        .dsa-pixel-dialog .lkw-info { font-size: 11px; color: #999080; margin-bottom: 4px; }
      </style>
      <div class="dlg-title">${lit.name}</div>
      <div class="dlg-meta">Grad ${lit.grad} · Ziel ${lit.ziel} · ${lit.reichweite}</div>
      <div class="dlg-effekt">${lit.effekt || ""}</div>
      ${gradSelectorHtml}
      <hr>
      <div class="dlg-section-title">Modifikatoren</div>
      ${optionsHtml}
      ${isPrimaer ? `<div class="primaer-banner"><strong>★ Primäre Segnung</strong> — -2 Erleichterung, 2 KaP</div>` : ""}
      <hr>
      <div class="dlg-section-title">Aufstufung</div>
      <div class="lkw-info">3×Grad ≤ LkW = ${lkw}</div>
      ${aufstufungOpts}
      <hr>
      <label>Eigene Modifikation: <input type="number" name="custom-mod" value="0" style="width:70px"></label>
      <label>Mitbeter: <input type="number" name="mitbeter" value="0" style="width:70px"></label>
    </div>
  `;

  return new Promise((resolve) => {
    new Dialog({
      title: `Liturgie wirken: ${lit.name}`,
      content: dlgContent,
      buttons: {
        cast: {
          label: "Wirken",
          callback: async (html) => {
            const $h = html instanceof jQuery ? html : $(html);
            let modSum = 0;
            $h.find("input[type=checkbox][data-val]").each((_, el) => {
              if (el.checked) modSum += Number(el.getAttribute("data-val"));
            });
            const customMod = Number($h.find("input[name=custom-mod]").val()) || 0;
            const mitbeter  = Number($h.find("input[name=mitbeter]").val()) || 0;

            // Bei variablem Grad → User-Wahl als Basis nehmen
            const chosenGrad = $h.find("select[name=chosen-grad]").val() || baseGrad;

            // Aufstufung zählen
            let aufstufungCount = 0;
            ["ritualdauer","reichweite","wirkungsdauer","ziel"].forEach(c => {
              if ($h.find(`input[name=aufstufung-${c}]`).is(":checked")) aufstufungCount++;
            });

            // Mitbeter-Mod
            let mitbeterMod = 0;
            if (mitbeter >= 60) mitbeterMod = -5;
            else if (mitbeter >= 13) mitbeterMod = -3;
            else if (mitbeter >= 7) mitbeterMod = -2;
            else if (mitbeter >= 1) mitbeterMod = -1;

            // Effektiver Grad (nach Aufstufung)
            const baseIdx = gradeIndex(chosenGrad);
            const effIdx = baseIdx + aufstufungCount;
            const effGrad = gradeAtIndex(effIdx);

            // 3×Grad ≤ LkW Constraint
            if (effIdx * 3 > lkw) {
              ui.notifications.error(`Aufstufung nicht möglich: 3×${effIdx} = ${effIdx*3} > LkW ${lkw}.`);
              resolve(null); return;
            }

            const kapEntry = meta[effGrad] ?? meta["I"];
            let kapCost = kapEntry?.kap ?? 5;
            let pkapCost = kapEntry?.pkap ?? 0;
            let probenZuschlag = kapEntry?.probenZuschlag ?? 0;

            // Primäre Segnung (Liber Liturgium S.9): "Auch Aufstufungen sind
            // in Kosten und Probenerschwernis, nicht aber in ihrer Wirkung
            // und Wirkungsdauer, als ein Grad niedriger anzunehmen."
            // → Bei einer Aufstufung von Grad I auf II zahlt der Geweihte die
            // Kosten/Erschwernis von Grad I; bei Grad II→III die von Grad II
            // usw. Auf Grad I ohne Aufstufung gilt Grad 0 (2 KaP, −2 Mod).
            if (isPrimaer) {
              const grades = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
              const currentIdx = grades.indexOf(effGrad);
              if (currentIdx >= 0) {
                const lowerGrade = currentIdx === 0 ? "0" : grades[currentIdx - 1];
                const lowerEntry = meta[lowerGrade];
                if (lowerEntry) {
                  kapCost = lowerEntry.kap ?? kapCost;
                  pkapCost = lowerEntry.pkap ?? pkapCost;
                  probenZuschlag = lowerEntry.probenZuschlag ?? probenZuschlag;
                } else if (currentIdx === 0) {
                  // Fallback wenn meta["0"] fehlt
                  kapCost = 2;
                  probenZuschlag = -2;
                }
              }
            }

            // Aufstufungs-Erschwernis (+2 pro Kategorie)
            const aufstufungMod = aufstufungCount * 2;
            const totalMod = probenZuschlag + modSum + customMod + mitbeterMod + aufstufungMod;
            const target = lkw - totalMod;

            // KaP prüfen
            const kap = getActorKaP(actor);
            if (kap.current < kapCost) {
              ui.notifications.error(`Zu wenig KaP: ${kap.current}/${kapCost}`);
              resolve(null); return;
            }
            if (pkapCost > 0 && kap.permanent < pkapCost) {
              ui.notifications.error(`Zu wenig pKaP: ${kap.permanent}/${pkapCost}`);
              resolve(null); return;
            }

            // 1W20-Probe
            const roll = await new Roll("1d20").evaluate();
            const wurf = roll.total;
            const erfolg = wurf <= target;
            const lkpStar = erfolg ? Math.max(1, lkw - wurf) : 0;

            // KaP abziehen
            let aspNeu = kap.current;
            if (erfolg) {
              aspNeu = Math.max(0, kap.current - kapCost);
            } else {
              // Misslingen = 1/5 Kosten, mind. 1
              aspNeu = Math.max(0, kap.current - Math.max(1, Math.floor(kapCost / 5)));
            }
            await setActorKaP(actor, aspNeu, null,
              erfolg && pkapCost > 0 ? Math.max(0, kap.permanent - pkapCost) : null
            );

            const wirkungsdauerMap = LITURGIEN_META?._wirkungsdauer ?? {};
            const wirkungsstaerkeMap = LITURGIEN_META?._wirkungsstaerke ?? {};

            const html2 = `<div class="dsa-pixel-chat">
              <div class="chat-title">${isPrimaer ? "★ " : ""}🙏 ${lit.name} (${effGrad})</div>
              <div class="chat-row" style="font-size:11px;color:#aaa">${kult} · ${lit.ziel} · ${lit.reichweite}</div>
              <hr>
              <div class="chat-row">LkW ${lkw} − Mod ${totalMod} → Ziel ${target}</div>
              <div class="chat-row"><strong>1W20:</strong> ${wurf} ${erfolg ? "✓" : "✗"}</div>
              ${aufstufungCount ? `<div class="chat-row">Aufstufung: ${aufstufungCount} Kategorie(n) → Grad ${effGrad}</div>` : ""}
              ${erfolg
                ? `<div class="result-line result-success">Erfolg — LkP* ${lkpStar}<br>
                   Wirkungsstärke: ${wirkungsstaerkeMap[lit.grad] ?? lit.grad}<br>
                   Wirkungsdauer: ${lit.wirkungsdauer}</div>
                   <div class="chat-row" style="font-size:11px">${lit.effekt}</div>
                   <div class="chat-row">KaP: ${kapCost} (${kap.current} → ${aspNeu})${pkapCost ? ` · pKaP: -${pkapCost}` : ""}</div>`
                : `<div class="result-line result-fail">Fehlschlag — ${Math.max(1, Math.floor(kapCost/5))} KaP verloren (${kap.current} → ${aspNeu})</div>`
              }
            </div>`;

            ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor }),
              content: html2,
              rolls: [roll],
              type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            });

            resolve({ erfolg, lkpStar, kapCost, pkapCost });
          }
        },
        cancel: { label: "Abbrechen", callback: () => resolve(null) }
      },
      default: "cast",
    }, {
      classes: ["dsa-pixel-dialog"],
      width: 520,
    }).render(true);
  });
}

// ─── Liturgien-Browser-UI ───────────────────────────────────────────────────

export class LiturgienApp extends Application {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this._kultFilter = getActorKult(actor) || "";
    this._gradFilter = "";
    this._search = "";
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dsa-pixel-liturgien",
      title: "DSA Liturgien & Karma",
      template: `modules/${MODULE_ID}/templates/liturgies.hbs`,
      width: 720,
      height: 600,
      resizable: true,
      classes: ["dsa-pixel-app", "dsa-pixel-liturgies"],
    });
  }

  async getData() {
    const kult = this._kultFilter;
    const liturgien = (LITURGIEN ?? []).filter(l => {
      if (kult && !(l.gott?.includes(kult) || l.art === "universell")) return false;
      if (this._search) {
        const s = this._search.toLowerCase();
        if (!l.name.toLowerCase().includes(s) &&
            !(l.effekt||"").toLowerCase().includes(s) &&
            !(l.auswirkung||"").toLowerCase().includes(s)) return false;
      }
      return true;
    });

    // Gruppierung nach Grad
    const meta = LITURGIEN_META?._kapKosten ?? {};
    const gradOrder = ["0","I","II","III","IV","V","VI","VII","VIII","II-VI","II bis VI","I-V"];
    const byGrad = {};
    for (const l of liturgien) {
      const g = l.grad || "?";
      if (!byGrad[g]) byGrad[g] = [];
      byGrad[g].push(l);
    }
    // Sort innerhalb Grad nach Name
    for (const g of Object.keys(byGrad)) {
      byGrad[g].sort((a, b) => a.name.localeCompare(b.name, "de"));
    }
    // Array-Form mit KaP-Kosten
    const liturgienByGrad = gradOrder
      .filter(g => byGrad[g] && byGrad[g].length)
      .map(grad => {
        const kapEntry = meta[grad] || meta[grad.split("-")[0]] || {};
        return {
          grad,
          liturgien: byGrad[grad],
          kapKosten: kapEntry.kap ?? "?",
          pkap: kapEntry.pkap || 0,
          probenZuschlag: kapEntry.probenZuschlag ?? 0,
        };
      });
    // Auch Liturgien mit unbekanntem Grad anhängen
    for (const g of Object.keys(byGrad)) {
      if (!gradOrder.includes(g)) {
        liturgienByGrad.push({ grad: g, liturgien: byGrad[g], kapKosten: "?", pkap: 0 });
      }
    }

    const kap = getActorKaP(this.actor);
    const lkw = getLkW(this.actor, kult);
    return {
      actorName: this.actor.name,
      kult,
      lkw,
      kap,
      liturgien,
      liturgienByGrad,
      isPrimaerMap: Object.fromEntries(liturgien.map(l => [l.id, Array.isArray(l.primaer) && l.primaer.includes(kult)])),
      goetter: ["Praios","Rondra","Efferd","Travia","Boron","Hesinde","Phex","Peraine","Ingerimm","Rahja","Tsa","Firun","Aves","Ifirn","Kor","Nandus","Swafnir","Marbo","Kamaluq","Tairach","Himmelswölfe"],
      grade: ["I","II","III","IV","V","VI","VII","VIII"],
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    const $h = html instanceof jQuery ? html : $(html);
    $h.find('[data-action="cast"]').on("click", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const id = ev.currentTarget.dataset.id;
      await castLiturgie(this.actor, id);
      this.render();
    });
    $h.find('[data-action="show-detail"]').on("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const id = ev.currentTarget.dataset.id;
      const lit = (LITURGIEN ?? []).find(l => l.id === id);
      if (lit) new LiturgieDetailApp(this.actor, lit, this).render(true);
    });
    $h.find('[data-action="mirakel"]').on("click", async (ev) => {
      const mod = ev.currentTarget.dataset.mod || "mirakelPlus";
      await rollMirakel(this.actor, mod);
      this.render();
    });
    $h.find('select[name=kult]').on("change", (ev) => {
      this._kultFilter = ev.currentTarget.value;
      this.render();
    });
    $h.find('input[name=search]').on("input", (ev) => {
      this._search = ev.currentTarget.value;
      this.render();
    });
  }
}

// ─── Detail-Dialog für eine einzelne Liturgie ──────────────────────────────

export class LiturgieDetailApp extends Application {
  constructor(actor, liturgie, parentApp = null, options = {}) {
    super(options);
    this.actor = actor;
    this.liturgie = liturgie;
    this.parentApp = parentApp;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dsa-pixel-liturgie-detail",
      title: "Liturgie-Details",
      template: `modules/${MODULE_ID}/templates/liturgie-detail.hbs`,
      width: 620,
      height: "auto",
      resizable: true,
      classes: ["dsa-pixel-app", "dsa-pixel-liturgie-detail"],
    });
  }

  get title() {
    return this.liturgie?.name || "Liturgie";
  }

  async getData() {
    const lit = this.liturgie;
    const kult = getActorKult(this.actor);
    const meta = LITURGIEN_META?._kapKosten ?? {};
    const baseGrad = (lit.grad || "I").split("-")[0].split(" ")[0];
    const kapEntry = meta[baseGrad] || meta["I"];
    const isPrimaer = Array.isArray(lit.primaer) && lit.primaer.includes(kult);
    const probenZuschlag = kapEntry?.probenZuschlag ?? 0;
    return {
      ...lit,
      isPrimaer,
      kapKosten: isPrimaer && lit.grad === "I" ? 2 : (kapEntry?.kap ?? "?"),
      pkap: kapEntry?.pkap || 0,
      probenZuschlag,
      probenZuschlagSigned: probenZuschlag >= 0 ? `+${probenZuschlag}` : `${probenZuschlag}`,
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    const $h = html instanceof jQuery ? html : $(html);
    $h.find('[data-action="cast"]').on("click", async (ev) => {
      ev.preventDefault();
      const id = ev.currentTarget.dataset.id;
      await castLiturgie(this.actor, id);
      this.parentApp?.render?.();
      this.close();
    });
    $h.find('[data-action="close"]').on("click", (ev) => {
      ev.preventDefault();
      this.close();
    });
  }
}

// ─── Sidebar-Button & Init-Hook ─────────────────────────────────────────────

export function registerLiturgies() {
  // Sidebar-Button für GM und Geweihte
  Hooks.on("getSceneControlButtons", (controls) => {
    const tokenCtrl = controls.find(c => c.name === "token");
    if (!tokenCtrl) return;
    if (tokenCtrl.tools.find(t => t.name === "dsa-liturgien")) return;
    tokenCtrl.tools.push({
      name: "dsa-liturgien",
      title: "DSA Liturgien & Karma",
      icon: "fas fa-praying-hands",
      visible: true,
      onClick: () => {
        const actor = canvas.tokens?.controlled?.[0]?.actor || game.user.character;
        if (!actor) {
          ui.notifications.warn("Bitte einen geweihten Token auswählen oder einen Charakter zugewiesen haben.");
          return;
        }
        new LiturgienApp(actor).render(true);
      },
      button: true,
    });
  });

  // Globaler Helper
  globalThis.DSALiturgien = (actor) => {
    const a = actor || canvas.tokens?.controlled?.[0]?.actor || game.user.character;
    if (!a) { ui.notifications.warn("Kein Actor ausgewählt."); return; }
    new LiturgienApp(a).render(true);
  };
  globalThis.DSAMirakel = (actor, mod = "mirakelPlus") => {
    const a = actor || canvas.tokens?.controlled?.[0]?.actor || game.user.character;
    if (!a) { ui.notifications.warn("Kein Actor."); return; }
    return rollMirakel(a, mod);
  };
}
