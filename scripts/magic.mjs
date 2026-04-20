/**
 * DSA Pixel-Art Tokens — Magie-System
 * Zauberprobe mit Spontanmodifikationen, AsP-Berechnung, Zone-Markierung
 */

import { MODULE_ID, SPELL_MODIFICATIONS, resolveProbe, checkCritical, calculateModifications, lookupSpellEffect, resolveActorAsP, SPELL_DAMAGE_MAP, rollSpellDamage, HIT_ZONE_TABLE, ZONE_LABELS, getWoundThresholds } from "./config.mjs";
import { castPandaemonium } from "./pandaemonium.mjs";
import { castFesselranken, castAugeDesLimbus, castSumpfstrudel } from "./zone-spells.mjs";
import { tryGardianumAbsorb, castGardianum, showGardianumDialog } from "./gardianum.mjs";

// ─── AsP-Kosten parsen ───────────────────────────────────────────────────────

/**
 * Parst den AsP-Kosten-String aus spells.json.
 * Gibt null zurück wenn die Kosten variabel/unbekannt sind — dann zeigt
 * der Dialog "?" und zieht keine AsP ab.
 *
 * Unterstützt:
 *   "8"          → 8
 *   "8 AsP"      → 8
 *   "2W6"        → würfelt sofort (Erwartungswert 7)
 *   "2W6+4"      → würfelt sofort
 *   "2W20"       → würfelt sofort
 *   alles andere → null (variabel, kein Abzug)
 */
function _parseAspKosten(kosten) {
  if (!kosten || kosten === "?") return null;
  const s = String(kosten).trim();
  // Würfelformel zuerst prüfen (vor parseInt, da "2W20" sonst als 2 fehlinterpretiert wird)
  // Formate: "2W20", "W6", "3W6+4", "2W6 AsP (...)"
  const m = s.match(/^(\d*)W(\d+)([+-]\d+)?/i);
  if (m) {
    const count  = parseInt(m[1] || "1");
    const sides  = parseInt(m[2]);
    const bonus  = parseInt(m[3] || "0");
    // Erwartungswert: count * (sides+1)/2 + bonus
    return Math.round(count * (sides + 1) / 2 + bonus);
  }
  // Einfache Zahl oder "N AsP" / "N AsP/SR" / "N + X AsP"
  const simple = parseInt(s, 10);
  if (!isNaN(simple)) return simple;
  return null; // variabel
}

// ─── Zauberprobe-Dialog mit Spontanmodifikationen ───────────────────────────

/**
 * Öffnet den vollständigen Zauber-Dialog mit allen Spontanmodifikationen.
 * Berechnet live die effektiven AsP-Kosten und Probe-Erschwernisse.
 *
 * @param {Actor} actor - Der Zaubernde
 * @param {object} spellData - { name, probe: [attr1,attr2,attr3], zfw, kosten, reichweite, ... }
 * @returns {Promise<{mod: number, aspCost: number, mods: object}|null>}
 */
export async function showSpellDialog(actor, spellData) {
  const sys = actor.system;
  // AsP-Kosten aus spellData.kosten parsen
  // Unterstützte Formate: "8", "8 AsP", "2W6", "2W6+4", variable → null
  const rawKosten = _parseAspKosten(spellData.kosten);

  // Repräsentation des Casters ermitteln (gdsa speichert in actor.system.Reps als Boolean-Flags)
  const reps = actor.system?.Reps ?? {};
  let rep = "gildenmagisch";
  if      (reps.elf)  rep = "elfisch";
  else if (reps.hex)  rep = "hexisch";
  else if (reps.dru)  rep = "druidisch";
  else if (reps.sch)  rep = "schelmisch";
  else if (reps.bor)  rep = "borbaradianisch";
  else if (reps.geo)  rep = "geoden";
  else if (reps.kri)  rep = "kristallomant";
  else if (reps.mag)  rep = "gildenmagisch";

  // Borbaradianer mit gildenmagischer Repräsentation: ZfP-Zuschläge halbiert (WdZ S.260)
  const borMitGildenmagisch = rep === "borbaradianisch" && !!reps.mag;
  const extraFlags = { borMitGildenmagisch };

  // Repräsentations-spezifische Einschränkungen (WdZ S.21-22)
  const noErzwingen    = rep === "schelmisch";
  const noZDVerdoppeln = rep === "schelmisch" || rep === "borbaradianisch";

  // Elfisch: 1 AsP Rabatt bei augenblicklicher/permanenter Wirkungsdauer (WdZ S.322)
  const wirkungsdauer = (spellData.wirkungsdauer ?? "").toLowerCase();
  const elfAspDiscount = rep === "elfisch" && /augenblicklich|permanent/.test(wirkungsdauer) ? 1 : 0;
  // null = variable Kosten (kein Abzug, Dialog zeigt Rohstring)
  const variableKosten = rawKosten === null;
  const baseKosten = variableKosten ? null : Math.max(1, rawKosten - elfAspDiscount);

  // Elfisch: KL↔IN in Probe tauschbar (WdZ S.322)
  const probeArr = spellData.probe ?? [];
  const canElfSwap = rep === "elfisch" && probeArr.includes("KL") &&
    probeArr.filter(a => a === "IN").length < 2; // nicht alle 3 auf IN

  // ── Varianten-Dropdown (aus Liber Cantiones) ────────────────────────
  const varianten = spellData.varianten ?? [];
  const OPT = (val, text, disabled = false) =>
    `<option value="${val}" style="background:#0d1b2e;color:${disabled ? '#666' : '#e0e0e0'}" ${disabled ? 'disabled' : ''}>${text}</option>`;

  const variantenHtml = varianten.length > 0 ? (() => {
    const opts = [OPT("-1", "Keine Variante")];
    for (let i = 0; i < varianten.length; i++) {
      const v = varianten[i];
      const zfw = parseInt(spellData.zfw) || 0;
      const disabled = !!(v.minZfw && zfw < v.minZfw);
      const label = `${v.name} (${v.zfpKosten > 0 ? '+' : ''}${v.zfpKosten} ZfP${v.minZfw ? `, ab ZfW ${v.minZfw}` : ''})`;
      const aspHint = v.aspKosten ? ` | ${v.aspKosten}` : '';
      opts.push(OPT(i, label + aspHint + (disabled ? ' — ZfW zu niedrig' : ''), disabled));
    }
    return `
      <div style="font-family:'Press Start 2P',cursive;font-size:9px;color:#ffd700;margin:8px 0 4px">
        ZAUBERVARIANTE
      </div>
      <div class="mod-section">
        <select id="spell-variante" style="width:100%;background:#0d1b2e;color:#e0e0e0;border:2px solid #3a3a5e;color-scheme:dark">${opts.join('')}</select>
      </div>`;
  })() : "";

  // ── Effektive ZfP-Kosten pro Option (rep-spezifisch) ─────────────────
  const repZfpCost = (opt, modKey) => {
    let cost = opt.zfpCost ?? 0;
    // Elfisch: WD-Verdoppeln nur 4 ZfP (WdZ S.322)
    if (rep === "elfisch" && modKey === "wirkungsdauer" && opt.wdVerdoppelt) cost = 4;
    // Borbaradianisch: Reichweite +7 ZfP/Stufe (WdZ S.23)
    if (rep === "borbaradianisch" && opt.reichweiteSteps) cost = opt.reichweiteSteps * 7;
    // Kristallomantisch: alle Kosten ×2 (WdZ S.324)
    if (rep === "kristallomant" && cost > 0) cost = cost * 2;
    // Gildenmagisch / Borb+Gild: Kosten halbiert — Hinweis beim Total, nicht pro Option
    return cost;
  };

  // ── Modifikations-Selects (ZfP-basiert, WdZ-konform) ────────────────
  const modSections = Object.entries(SPELL_MODIFICATIONS).map(([key, mod]) => {
    if (key === "erzwingen" && noErzwingen) return "";
    const options = mod.options.map((opt, i) => {
      if (opt.zdVerdoppelt && noZDVerdoppeln) return "";
      const displayCost = repZfpCost(opt, key);
      const cost = displayCost ? `${displayCost} ZfP` : "";
      const extra = opt.extraAkt ? `+${opt.extraAkt} Akt` : "";
      const asp = opt.aspExtra ? `+${opt.aspExtra} AsP` : opt.aspMult && opt.aspMult !== 1.0 ? `×${opt.aspMult} AsP` : "";
      const zfpHalbiert = rep === "gildenmagisch" || borMitGildenmagisch;
      const erlVal = (opt.erleichterung ?? 0) + (opt.zdVerdoppelt && zfpHalbiert ? 1 : 0);
      const erl = erlVal ? `−${erlVal} Erschwer.` : "";
      const info = [cost, extra, asp, erl].filter(Boolean).join(", ");
      return OPT(i, `${opt.label}${info ? ` (${info})` : ""}`);
    }).join("");
    return `
      <div class="mod-section">
        <div class="mod-label">${mod.label} <span style="font-size:11px;color:#666">${mod.desc ?? ""}</span></div>
        <select data-mod="${key}" style="background:#0d1b2e;color:#e0e0e0;border:2px solid #3a3a5e;color-scheme:dark;width:100%">${options}</select>
      </div>`;
  }).join("");

  return new Promise((resolve) => {
    new Dialog({
      title: `Zauber: ${spellData.name}`,
      content: `
        <div class="dsa-pixel-spell-dialog" style="color-scheme:dark">
          <div class="spell-info">
            <div>
              <div class="info-label">Probe</div>
              <div class="info-value">${(spellData.probe ?? []).join("/")}</div>
            </div>
            <div>
              <div class="info-label">ZfW</div>
              <div class="info-value">${spellData.zfw}</div>
            </div>
            <div>
              <div class="info-label">Basis-AsP</div>
              <div class="info-value">${variableKosten ? `<span title="${spellData.kosten}" style="color:#ffd700">variabel</span>` : baseKosten}</div>
            </div>
            <div>
              <div class="info-label">Zauberdauer</div>
              <div class="info-value">${spellData.zauberdauer ?? "?"}</div>
            </div>
          </div>

          ${variantenHtml}

          <div style="font-family:'Press Start 2P',cursive;font-size:9px;color:#4a90d9;margin:8px 0 4px">
            SPONTANE MODIFIKATIONEN
          </div>

          ${modSections}

          ${canElfSwap ? `
          <div style="margin:6px 0;padding:6px 8px;background:rgba(0,180,120,0.1);border-left:3px solid #0b6;border-radius:0 4px 4px 0">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#9de">
              <input type="checkbox" id="elf-kl-in" style="margin:0;cursor:pointer">
              KL durch IN ersetzen (elfisch, WdZ S.322)
            </label>
          </div>` : ""}

          ${rep === "elfisch" ? `
          <div style="font-size:11px;color:#7a9;padding:4px 6px;background:rgba(0,0,0,0.2);border-radius:4px;margin:4px 0">
            ✦ Elfisch: WD automatisch ×2 kostenlos · Misserfolg-Wdh. +5 (statt +3) · Antimagie ×2
            ${elfAspDiscount ? ` · −1 AsP (${wirkungsdauer})` : ""}
          </div>` : ""}

          ${rep === "schelmisch" ? (() => {
            const sfRaw = sys?.sonderfertigkeiten ?? sys?.sf ?? [];
            const hasSFSchelm = (n) => Array.isArray(sfRaw)
              ? sfRaw.some(e => (typeof e === "string" ? e : e?.name ?? "").toLowerCase() === n.toLowerCase())
              : Object.keys(sfRaw).some(k => k.toLowerCase() === n.toLowerCase());
            const mrIgnore = hasSFSchelm("Lockeres Zaubern") ? 12 : hasSFSchelm("Unbeschwertes Zaubern") ? 7 : 3;
            return `<div style="font-size:11px;color:#9b7;padding:4px 6px;background:rgba(0,0,0,0.2);border-radius:4px;margin:4px 0">
              ✦ Schelmisch: MR bis ${mrIgnore} ignorieren · Mehrere Ziele: ×2 Opfer-Anzahl
            </div>`;
          })() : ""}

          ${rep === "kristallomant" ? `
          <div style="font-size:11px;color:#b9d;padding:4px 6px;background:rgba(0,0,0,0.2);border-radius:4px;margin:4px 0">
            ✦ Kristallomantisch: AsP ×¾ · Mods ×2 ZfP (ohne passende Kristalle)
          </div>` : ""}

          ${rep === "geoden" ? `
          <div style="font-size:11px;color:#ca8;padding:4px 6px;background:rgba(0,0,0,0.2);border-radius:4px;margin:4px 0">
            ✦ Geodisch: Bei bev. Element+Merkmalskenntnis: Einsparen/Reichweite/ZD je −2 ZfP
          </div>` : ""}

          <div style="display:flex;gap:12px;align-items:center;justify-content:center;margin:8px 0">
            <label style="font-size:14px;color:#bbb">Zusätzl. Mod:</label>
            <input id="spell-extra-mod" type="number" value="0" style="width:50px;text-align:center;font-size:18px;background:#0d1b2e;border:2px solid #3a3a5e;color:#e0e0e0">
          </div>

          <div class="cost-summary" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
            <div>
              <div class="total-label">ZfP-Kosten:</div>
              <div class="probe-mod-display" id="spell-total-zfp" style="color:#e94560">0</div>
            </div>
            <div>
              <div class="total-label">Extra Aktionen:</div>
              <div class="probe-mod-display" id="spell-total-akt" style="color:#ffd700">+0</div>
            </div>
            <div>
              <div class="total-label">AsP-Kosten:</div>
              <div class="total-value" id="spell-total-asp">${variableKosten ? "variabel" : baseKosten}</div>
            </div>
          </div>
          <div style="text-align:center;font-size:12px;color:#888;margin-top:4px">
            Rep: ${rep}${elfAspDiscount ? ` · −1 AsP (${wirkungsdauer})` : ""}
          </div>
        </div>
      `,
      buttons: {
        cast: {
          icon: '<i class="fas fa-magic"></i>',
          label: "Zaubern!",
          callback: (html) => {
            const result = _calculateModificationsFromHTML(html, baseKosten, rep, varianten, extraFlags);
            resolve(result);
          },
        },
        cancel: { label: "Abbruch", callback: () => resolve(null) },
      },
      default: "cast",
      render: (html) => {
        const refresh = () => {
          const result = _calculateModificationsFromHTML(html, baseKosten, rep, varianten);
          html.find("#spell-total-zfp").text(result.totalZfP);
          html.find("#spell-total-akt").text(`+${result.extraAkt}`);
          html.find("#spell-total-asp").text(result.aspCost);
          html.find("#spell-total-zfp").css("color", result.totalZfP > 10 ? "#ff3333" : result.totalZfP > 0 ? "#e94560" : "#888");
        };
        html.find("select[data-mod], #spell-extra-mod, #spell-variante").on("input change", refresh);
      },
    }).render(true);
  });
}

function _calculateModificationsFromHTML(html, baseKosten, rep = "gildenmagisch", varianten = [], extraFlags = {}) {
  const selections = {};

  for (const key of Object.keys(SPELL_MODIFICATIONS)) {
    const select = html.find(`select[data-mod="${key}"]`);
    const idx = parseInt(select.val()) || 0;
    if (idx > 0) selections[key] = idx;
  }

  // variable Kosten (null) → keine Modifikation durch Mods, aspCost bleibt null
  if (baseKosten === null) {
    const extraMod0 = parseInt(html.find("#spell-extra-mod").val()) || 0;
    const varIdx0 = parseInt(html.find("#spell-variante").val() ?? "-1");
    return {
      totalZfP: 0, extraAkt: 0, aspCost: null,
      erleichterung: -extraMod0,
      selections, selectedVariant: varIdx0 >= 0 ? (varianten[varIdx0] ?? null) : null,
      elfKlInTausch: html.find("#elf-kl-in").prop("checked") ?? false,
    };
  }
  const result = calculateModifications(selections, baseKosten, rep, extraFlags);
  const extraMod = parseInt(html.find("#spell-extra-mod").val()) || 0;

  // Variante: ZfP-Zuschlag und zusätzliche AsP-Kosten addieren
  const varIdx = parseInt(html.find("#spell-variante").val() ?? "-1");
  const varZfp = (varIdx >= 0 && varianten[varIdx]) ? (varianten[varIdx].zfpKosten ?? 0) : 0;
  const selectedVariant = varIdx >= 0 ? (varianten[varIdx] ?? null) : null;
  // Varianten können eigene AsP-Kosten haben (aspKosten als Zahl oder String)
  let varAsp = 0;
  if (selectedVariant?.aspKosten) {
    const parsed = parseInt(selectedVariant.aspKosten);
    if (!isNaN(parsed)) varAsp = parsed;
  }

  const elfKlInTausch = html.find("#elf-kl-in").prop("checked") ?? false;

  return {
    totalZfP: result.totalZfP + varZfp,
    extraAkt: result.totalExtraAkt,
    aspCost: result.finalAsP + varAsp,
    erleichterung: result.erleichterung - extraMod,
    selections,
    selectedVariant,
    elfKlInTausch,
  };
}

// ─── Zauberprobe ausführen ──────────────────────────────────────────────────

/**
 * Führt eine vollständige Zauberprobe durch:
 * 1. Öffnet Modifikations-Dialog
 * 2. Würfelt 3W20
 * 3. Berechnet Ergebnis
 * 4. Zieht AsP ab
 * 5. Triggert VFX
 * 6. Bietet Zone-Markierung an (bei Zonenzaubern)
 */
export async function castSpell(actor, spellData) {
  // 1. Repräsentation des Casters (für rep-spezifische Regeln in castSpell)
  const repsC = actor.system?.Reps ?? {};
  let repC = "gildenmagisch";
  if      (repsC.elf)  repC = "elfisch";
  else if (repsC.hex)  repC = "hexisch";
  else if (repsC.dru)  repC = "druidisch";
  else if (repsC.sch)  repC = "schelmisch";
  else if (repsC.bor)  repC = "borbaradianisch";
  else if (repsC.geo)  repC = "geoden";
  else if (repsC.kri)  repC = "kristallomant";
  else if (repsC.mag)  repC = "gildenmagisch";

  // 2. Dialog
  const dialogResult = await showSpellDialog(actor, spellData);
  if (!dialogResult) return null;

  const { totalZfP, extraAkt, aspCost, erleichterung, selections, selectedVariant, elfKlInTausch } = dialogResult;

  // 3. AsP prüfen (null = variable Kosten → kein automatischer Abzug)
  const aspData = resolveActorAsP(actor);
  const currentAsP = aspData?.val ?? 0;
  if (aspCost !== null && currentAsP < aspCost) {
    ui.notifications.warn(`Nicht genug AsP! Benötigt: ${aspCost}, Verfügbar: ${currentAsP}`);
    return null;
  }

  // 4. ZfP-Kosten vom ZfW abziehen (Spontanmodifikationen kosten ZfP, nicht Probe-Mod!)
  const baseZfw = parseInt(spellData.zfw) || 0;
  const effectiveZfw = baseZfw - totalZfP;
  if (effectiveZfw < 0) {
    ui.notifications.warn(`ZfW zu niedrig für diese Modifikationen! ZfW ${baseZfw} - ${totalZfP} ZfP = ${effectiveZfw}`);
    return null;
  }

  // 5. Würfeln
  const roll = new Roll("3d20");
  await roll.evaluate();
  const dice = roll.terms[0].results.map(r => r.result);

  // 5. Probe auswerten (Erleichterung aus Erzwingen wird als negativer Modifikator angewendet)
  const probeAttrs = (spellData.probe ?? []).map((a, idx) => {
    // Elfisch: KL kann durch IN ersetzt werden (WdZ S.322)
    if (elfKlInTausch && a === "KL") {
      const probe = spellData.probe ?? [];
      const inCount = probe.filter(x => x === "IN").length;
      const isFirstKl = probe.indexOf("KL") === idx;
      // Ersten KL durch IN ersetzen, wenn nicht alle 3 auf IN wären
      if (isFirstKl && (inCount + 1) < 3) {
        return actor.system["IN"]?.value ?? 10;
      }
    }
    return actor.system[a]?.value ?? 10;
  });
  const probeMod = -erleichterung; // Negativ = Erleichterung
  const result = resolveProbe(dice, probeAttrs, effectiveZfw, probeMod);
  const crit = checkCritical(dice);

  // 5. Ergebnis-Flags
  let success = result.success;
  let resultLabel, resultClass;

  if (crit.patzer) {
    success = false;
    resultLabel = "PATZER! Spruchstörung!";
    resultClass = "result-fail";
  } else if (crit.gluecklich) {
    success = true;
    resultLabel = "GLÜCKLICH! Maximale Wirkung!";
    resultClass = "result-crit";
  } else if (success) {
    resultLabel = "Gelungen";
    resultClass = "result-success";
  } else {
    resultLabel = "Misslungen";
    resultClass = "result-fail";
  }

  // 6. AsP abziehen — Hexisch: 1/3 bei Misserfolg (WdZ S.310); sonst: Hälfte (WdZ S.14)
  //    null = variable Kosten → kein Abzug, GM macht das manuell
  const failDivisor = repC === "hexisch" ? 3 : 2;
  const actualCost = aspCost === null ? null
    : success ? aspCost
    : Math.ceil(aspCost / failDivisor);
  if (aspData && actualCost !== null) {
    await actor.update({ [aspData.path]: Math.max(0, currentAsP - actualCost) });
  }

  // 7. Modifikations-Zusammenfassung (selections = { modKey: optionIndex })
  const modSummary = Object.entries(selections ?? {})
    .filter(([, idx]) => idx > 0)
    .map(([key, idx]) => {
      const mod = SPELL_MODIFICATIONS[key];
      const opt = mod?.options?.[idx];
      return opt ? `${mod.label}: ${opt.label}` : null;
    })
    .filter(Boolean)
    .join(", ");

  // 8. Chat
  // Probe-Labels für Chat (zeigt ersetztes Attribut an)
  const probeLabels = (spellData.probe ?? []).map((a, idx) => {
    if (elfKlInTausch && a === "KL" && (spellData.probe ?? []).indexOf("KL") === idx) return "IN*";
    return a;
  });

  const diceHtml = dice.map((d, i) => {
    const attr = probeAttrs[i];
    const cls = d === 1 ? "crit" : d === 20 ? "fumble" : d > attr ? "fail" : "success";
    return `<div class="die ${cls}" title="${probeLabels[i]} ${attr}">${d}</div>`;
  }).join("");

  const variantLine = selectedVariant
    ? `<div style="text-align:center;font-size:13px;color:#ffd700">Variante: ${selectedVariant.name}</div>`
    : "";

  const flavor = `<div class="dsa-pixel-chat">
    <div class="chat-title">⚡ ${spellData.name}</div>
    ${variantLine}
    <div class="dice-row">${diceHtml}</div>
    <div class="result-line ${resultClass}">${resultLabel}</div>
    ${success ? `<div class="tap-star">ZfP*: <span>${result.tapStar}</span></div>` : ""}
    <div style="text-align:center;font-size:13px;color:#4a90d9">
      ${actualCost === null
        ? `<span style="color:#ffd700">AsP: variabel — manuell abziehen! (${spellData.kosten})</span>`
        : `AsP: -${actualCost} ${!success ? `(${repC === "hexisch" ? "⅓" : "halbe"} Kosten)` : ""}`
      }
      ${modSummary ? `<br><span style="color:#888">${modSummary}</span>` : ""}
    </div>
    ${success && lookupSpellEffect(spellData.name)?.type === "zone" ?
      `<div class="chat-buttons">
        <button class="chat-btn" data-action="mark-zone" data-spell="${spellData.name}">
          ⬡ Zone markieren
        </button>
      </div>` : ""}
  </div>`;

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor,
  });

  // 9. VFX auto-trigger (SPELL_EFFECT_MAP → Varianten → Keyword-Fallback)
  if (success && typeof DSAPixelTokens !== "undefined") {
    const mapping = lookupSpellEffect(spellData.name);
    if (mapping && !mapping.enchantArrow) {
      _triggerSpellEffect(actor, mapping, spellData);
    }
  }

  // 10. Patzer-VFX
  if (crit.patzer && typeof DSAPixelTokens !== "undefined") {
    const token = actor.getActiveTokens()[0];
    if (token) {
      DSAPixelTokens.spawnEffect(token.center.x, token.center.y, "schadenflash");
    }
  }

  // 11a. Spezial-Zauber mit eigenem Ablauf (Zone/Duration)
  if (success && !crit.patzer) {
    const spellLow = spellData.name.toLowerCase();
    if (/pandaemonium|pandämonium/.test(spellLow)) {
      const borVariant = /borbaradian/.test(spellLow) || spellData.rep === "borbaradianisch";
      await castPandaemonium(actor, spellData, result.tapStar ?? 0, borVariant);
      return { success, result, crit, aspCost: actualCost };
    }
    if (/fesselranken/.test(spellLow)) {
      const dornen = /dornen/.test(spellLow);
      const stabil = /stabil/.test(spellLow);
      await castFesselranken(actor, spellData, result.tapStar ?? 0, { dornen, stabil });
      return { success, result, crit, aspCost: actualCost };
    }
    if (/auge.*limbus|limbusauge/.test(spellLow)) {
      await castAugeDesLimbus(actor, spellData, result.tapStar ?? 0, { radius: 3 });
      return { success, result, crit, aspCost: actualCost };
    }
    if (/sumpfstrudel|sumpf-strudel/.test(spellLow)) {
      const erdranken = /erdranken/.test(spellLow);
      await castSumpfstrudel(actor, spellData, result.tapStar ?? 0, { radius: 3, erdranken });
      return { success, result, crit, aspCost: actualCost };
    }
    if (/^gardianum/i.test(spellData.name) || /gardianum/i.test(spellLow)) {
      // Variante aus dem Namen inferieren — sonst Dialog
      const nameLow = spellData.name.toLowerCase();
      let variant = "base";
      if (/daemon|dämon/.test(nameLow))        variant = "daemonen";
      else if (/zauber/.test(nameLow))         variant = "zauber";
      else if (/persoenlich|persönlich/.test(nameLow)) variant = "persoenlich";

      // Dialog fuer AsP-Invest (ZfP* kommt aus der Probe)
      const zfpStar = result.tapStar ?? 0;
      return new Promise((resolve) => {
        new Dialog({
          title: `🛡 Gardianum — ${actor.name}`,
          content: `<form>
            <div style="margin:6px 0">
              <label>Variante:</label>
              <select name="variant" style="width:100%">
                <option value="base" ${variant==="base"?"selected":""}>Grund-Gardianum</option>
                <option value="daemonen" ${variant==="daemonen"?"selected":""}>Schild gegen Daemonen (+3 AsP, ZfW 7+)</option>
                <option value="zauber" ${variant==="zauber"?"selected":""}>Schild gegen Zauber (+3 AsP, ZfW 7+)</option>
                <option value="persoenlich" ${variant==="persoenlich"?"selected":""}>Persoenlicher Schild (+5 AsP, ZfW 11+)</option>
              </select>
            </div>
            <div style="margin:6px 0">
              <label>AsP investieren (min. 3):</label>
              <input type="number" name="aspInvest" value="6" min="3" style="width:100%">
            </div>
            <div style="margin:6px 0;padding:6px;background:rgba(74,144,217,0.1);border-radius:3px;font-size:11px;color:#888">
              ZfP* aus Probe: <strong>${zfpStar}</strong><br>
              Schild = AsP + 2×ZfP* (Persönlich: 3×ZfP* + AsP)
            </div>
          </form>`,
          buttons: {
            cast: {
              label: "Wirken",
              callback: async (html) => {
                const v = html.find('[name="variant"]').val();
                const asp = Number(html.find('[name="aspInvest"]').val() || 3);
                await castGardianum(actor, { variant: v, aspInvest: asp, zfpStar, spellName: spellData.name });
                resolve({ success, result, crit, aspCost: actualCost });
              },
            },
            cancel: { label: "Abbrechen", callback: () => resolve({ success, result, crit, aspCost: actualCost }) },
          },
          default: "cast",
        }).render(true);
      });
    }
  }

  // 11b. Schaden bei Zaubern mit Merkmal "Schaden" — Auto-Abzug auf Ziel
  if (success && !crit.patzer) {
    const damageInfo = _lookupSpellDamageFuzzy(spellData.name);
    if (damageInfo) {
      await _applySpellDamage(actor, spellData, damageInfo, actualCost ?? 0, result.tapStar ?? 0);
    }
  }

  return { success, result, crit, aspCost: actualCost };
}

// ─── Schadens-Zauber: Lookup mit Fuzzy-Match ────────────────────────────────

function _lookupSpellDamageFuzzy(spellName) {
  if (!spellName) return null;
  if (SPELL_DAMAGE_MAP[spellName]) return SPELL_DAMAGE_MAP[spellName];
  // Erstes Wort matchen (z.B. "IGNIFAXIUS" matched "Ignifaxius Flammenstrahl")
  const firstWord = spellName.split(/\s+/)[0].toLowerCase();
  for (const [key, val] of Object.entries(SPELL_DAMAGE_MAP)) {
    if (key.split(/\s+/)[0].toLowerCase() === firstWord) return val;
  }
  return null;
}

// ─── Schaden auf Ziel anwenden (Auto-LeP + Wunden + Immunitaet) ─────────────

async function _applySpellDamage(caster, spellData, damageInfo, alreadyPaidAsP, zfpStar) {
  // Ziel pruefen
  const targetToken = [...(game.user?.targets ?? [])][0];
  if (!targetToken && damageInfo.needsTarget !== false) {
    ui.notifications.warn(`${spellData.name}: Kein Ziel markiert — Schaden wird nicht angewendet.`);
    return;
  }
  const targetActor = targetToken?.actor;

  // ZfW des Zauberers
  const zfw = Number(
    actorFindSkill(caster, spellData.name)?.value ??
    spellData.zfw ?? 0
  );

  // Max AsP = aktuelle AsP des Zauberers + bereits bezahlte (falls Formel mehr will)
  const aspData = resolveActorAsP(caster);
  const currentAsP = aspData?.val ?? 0;
  const aspMax = currentAsP + (alreadyPaidAsP || 0);

  // Schaden wuerfeln (inkl. ZfP* fuer fixedPlusZfpStar / dotPerKR)
  const dmg = await rollSpellDamage(spellData.name, damageInfo, {
    zfw,
    zfpStar: zfpStar || 0,
    aspMax,
    aspBaseCost: alreadyPaidAsP || 0,
  });
  if (!dmg) return; // Abbruch

  // Zusaetzliche AsP-Kosten (falls chooseDice/aspDice mehr kostet als bereits bezahlt)
  const extraAsP = Math.max(0, dmg.aspCost - (alreadyPaidAsP || 0));
  if (extraAsP > 0 && aspData?.path) {
    const newAsP = Math.max(0, currentAsP - extraAsP);
    await caster.update({ [aspData.path]: newAsP });
  }

  // Elementare Immunitaet pruefen (nimmt evt. geaendertes Element aus Variante)
  const effectiveElement = dmg.element ?? damageInfo.element;
  let immunity = _checkElementalImmunity(targetActor, effectiveElement);
  let tp = dmg.tp;
  if (immunity.immune) tp = 0;
  else if (immunity.resistant) tp = Math.floor(tp / 2);
  else if (immunity.vulnerable) tp = Math.floor(tp * 1.5);

  // Gardianum-Absorption VOR RS/LeP — Schild schluckt TP direkt (LCR S.97)
  let gardianumNote = "";
  if (tp > 0) {
    const absorb = await tryGardianumAbsorb(targetActor, targetToken, damageInfo, tp, spellData.name);
    if (absorb.absorbedTP > 0) {
      tp = absorb.remainingTP;
    }
    gardianumNote = absorb.note || "";
  }

  // Trefferzone (falls nicht Flaechenschaden)
  let hitZone = null, hitZoneLabel = "";
  if (!damageInfo.ignoreZones) {
    const zoneRoll = new Roll("1d20");
    await zoneRoll.evaluate();
    hitZone = HIT_ZONE_TABLE[zoneRoll.total] ?? "brust";
    hitZoneLabel = ZONE_LABELS[hitZone] ?? hitZone;
  }

  // RS des Ziels — inkl. perTenTpRSReduction (FAXIUS-Regel: pro 10 TP -1 RS)
  let targetRS = 0;
  let rsReductionNote = "";
  if (!damageInfo.ignoresRS && tp > 0) {
    targetRS = _getTargetRS(targetActor, hitZone);
    if (damageInfo.perTenTpRSReduction && targetRS > 0) {
      const reduction = Math.floor(tp / 10);
      if (reduction > 0) {
        const before = targetRS;
        targetRS = Math.max(0, targetRS - reduction);
        rsReductionNote = `<div style="color:#c09040;font-size:11px">⚠ Pro 10 TP −1 RS: ${before}→${targetRS}</div>`;
      }
    }
  }

  const sp = Math.max(0, tp - targetRS);

  // LeP oder AuP abziehen
  let resourceLine = "";
  if (damageInfo.onlyAuP) {
    const oldAuP = targetActor.system?.AuP?.value ?? 0;
    const newAuP = Math.max(0, oldAuP - sp);
    await targetActor.update({ "system.AuP.value": newAuP });
    resourceLine = `💤 ${targetActor.name}: ${oldAuP} → <strong style="color:#ff9800">${newAuP}</strong> AuP`;
  } else if (sp > 0) {
    const oldLeP = targetActor.system?.LeP?.value ?? 0;
    const newLeP = Math.max(0, oldLeP - sp);
    await targetActor.update({ "system.LeP.value": newLeP });
    resourceLine = `💔 ${targetActor.name}: ${oldLeP} → <strong style="color:#e94560">${newLeP}</strong> LeP
      ${newLeP === 0 ? `<span style="color:#ff4444;font-weight:bold"> — KAMPFUNFAEHIG!</span>` : ""}`;
  }

  // Wunden pruefen (nur wenn kein onlyLeP und echter Schaden)
  let woundLine = "";
  if (!damageInfo.onlyLeP && !damageInfo.onlyAuP && sp > 0 && hitZone) {
    const ko = targetActor.system?.KO?.value ?? 10;
    const ws = getWoundThresholds(ko);
    let newWounds = 0;
    if (sp >= ws.ws3)      newWounds = 3;
    else if (sp >= ws.ws2) newWounds = 2;
    else if (sp >= ws.ws1) newWounds = 1;

    if (newWounds > 0) {
      const wounds = targetActor.getFlag("dsa-pixel-tokens", "wounds") ?? {};
      wounds[hitZone] = (wounds[hitZone] ?? 0) + newWounds;
      await targetActor.setFlag("dsa-pixel-tokens", "wounds", wounds);
      const total = Object.values(wounds).reduce((s, w) => s + (w || 0), 0);
      woundLine = `<div style="color:#ff4444;margin-top:3px">💀 +${newWounds} Wunde${newWounds>1?"n":""} (${hitZoneLabel}) · Gesamt: ${total} · alle Proben −${total}</div>`;
    }
  }

  // Chat-Nachricht
  const immunityLine = immunity.immune ? `<div style="color:#888">🛡 Immun gegen ${damageInfo.element}!</div>`
    : immunity.resistant ? `<div style="color:#888">🛡 Resistent gegen ${damageInfo.element} — halber Schaden</div>`
    : immunity.vulnerable ? `<div style="color:#e94560">⚠ Verwundbar gegen ${damageInfo.element} — 1.5x Schaden</div>`
    : "";

  const rsLine = targetRS > 0
    ? `<div style="color:#888;font-size:12px">${tp} TP − ${targetRS} RS ${hitZoneLabel ? `(${hitZoneLabel})` : ""} = ${sp} SP</div>`
    : damageInfo.ignoresRS ? `<div style="color:#888;font-size:12px">${tp} TP (RS ignoriert) = ${sp} SP</div>`
    : `<div style="color:#888;font-size:12px">${tp} TP ${hitZoneLabel ? `(${hitZoneLabel})` : ""} = ${sp} SP</div>`;

  const aspNote = extraAsP > 0 ? `<div style="color:#4a90d9;font-size:12px">−${extraAsP} AsP (zusaetzlich)</div>` : "";

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: `<div class="dsa-pixel-chat">
      <div class="chat-title">⚡ ${spellData.name} — Schaden</div>
      ${dmg.rollHTML || ""}
      <div style="text-align:center;font-size:13px;color:#c09040">${dmg.formulaLabel}</div>
      ${dmg.variantNote || ""}
      ${aspNote}
      ${immunityLine}
      ${gardianumNote}
      <div style="font-size:20px;color:#e94560;font-weight:bold;text-align:center;margin-top:4px">
        = ${sp} ${damageInfo.onlyAuP ? "AuP" : "SP"}
      </div>
      ${rsLine}
      ${rsReductionNote}
      <div style="margin-top:4px;padding:3px 6px;background:rgba(233,69,96,0.15);border:1px solid rgba(233,69,96,0.3);border-radius:3px;text-align:center;font-size:13px">
        ${resourceLine}
      </div>
      ${woundLine}
    </div>`,
  });

  // VFX: Schadenflash am Ziel
  if (sp > 0 && typeof DSAPixelTokens !== "undefined" && targetToken) {
    DSAPixelTokens.spawnEffect(targetToken.center.x, targetToken.center.y, "schadenflash");
  }
}

// ─── Elementare Immunitaet pruefen ──────────────────────────────────────────

function _checkElementalImmunity(targetActor, element) {
  if (!targetActor || !element) return { immune: false, resistant: false, vulnerable: false };

  const creatureFlag = targetActor.getFlag("dsa-pixel-tokens", "creature");
  const abilities = [
    ...(creatureFlag?.abilities ?? []),
    ...(Array.isArray(targetActor.system?.sf) ? targetActor.system.sf : Object.keys(targetActor.system?.sf ?? {})),
  ].map(a => (typeof a === "string" ? a : (a?.name ?? "")).toLowerCase());

  const elementLow = element.toLowerCase();
  const joined = abilities.join(" | ");

  // Immun
  if (joined.match(new RegExp(`immun[^|]*${elementLow}|immunit[aä]t[^|]*${elementLow}`))) {
    return { immune: true, resistant: false, vulnerable: false };
  }
  // Verwundbar / Empfindlich
  if (joined.match(new RegExp(`verwundbar[^|]*${elementLow}|empfindlich[^|]*${elementLow}`))) {
    return { immune: false, resistant: false, vulnerable: true };
  }
  // Resistent
  if (joined.match(new RegExp(`resisten[tz][^|]*${elementLow}|widerstand[^|]*${elementLow}`))) {
    return { immune: false, resistant: true, vulnerable: false };
  }
  return { immune: false, resistant: false, vulnerable: false };
}

// ─── Zonen-RS des Ziels ermitteln ───────────────────────────────────────────

function _getTargetRS(actor, zone) {
  if (!actor) return 0;
  // Kreatur: natuerlicher RS (alle Zonen gleich)
  const creatureFlag = actor.getFlag("dsa-pixel-tokens", "creature");
  if (creatureFlag?.rs !== undefined) return creatureFlag.rs;
  // Spieler: Zonen-RS aus Ruestungs-Items
  const armorDb = globalThis.DSAPixelData?.armorZones?.armor ?? [];
  let zoneRS = 0;
  for (const item of actor.items) {
    const sys = item.system ?? {};
    const t = item.type?.toLowerCase();
    if (t === "gegenstand" && sys.type === "armor") {
      const dbEntry = armorDb.find(a => a.name.toLowerCase() === item.name.toLowerCase());
      if (zone && dbEntry?.zones?.[zone] !== undefined) {
        zoneRS += dbEntry.zones[zone];
      } else {
        zoneRS += (sys.armor?.rs ?? 0);
      }
    }
  }
  return zoneRS;
}

// Helper: Zauberfertigkeit auf Actor finden
function actorFindSkill(actor, spellName) {
  const skills = actor.system?.skill ?? {};
  return skills[spellName] ?? null;
}

// ─── Zauber-VFX triggern ────────────────────────────────────────────────────

function _triggerSpellEffect(actor, mapping, spellData) {
  const casterToken = actor.getActiveTokens()[0];
  const targetToken = [...(game.user?.targets ?? [])][0];

  if (!casterToken) return;

  switch (mapping.type) {
    case "projectile":
      if (targetToken && targetToken !== casterToken) {
        DSAPixelTokens.spawnProjectile(casterToken, targetToken, mapping.effect, mapping.impact ?? mapping.effect);
      } else if (targetToken) {
        DSAPixelTokens.spawnEffect(targetToken.center.x, targetToken.center.y, mapping.effect);
      }
      break;

    case "target":
      if (targetToken) {
        DSAPixelTokens.spawnEffect(targetToken.center.x, targetToken.center.y, mapping.effect);
      }
      break;

    case "aura":
      DSAPixelTokens.spawnEffect(casterToken.center.x, casterToken.center.y, mapping.effect);
      break;

    case "zone":
      // Zone: Notification — User muss Template platzieren, dann Zone-Picker
      ui.notifications.info(`${spellData.name} gelungen! Platziere ein Mess-Template und wähle den Zonen-Effekt.`);
      break;
  }
}

// ─── Zone-Markierung nach Zauber ────────────────────────────────────────────

/**
 * Hook für Chat-Buttons: Wenn "Zone markieren" geklickt wird,
 * aktiviert den Template-Platzierungs-Modus.
 */
export function registerMagicChatHooks() {
  Hooks.on("renderChatMessage", (message, html) => {
    html.find('[data-action="mark-zone"]').on("click", async (e) => {
      const spellName = e.currentTarget.dataset.spell;
      ui.notifications.info(`Platziere ein Template (Kreis/Kegel) auf der Karte, dann klicke darauf für den Zonen-Effekt.`);

      // Automatisch den passenden Zone-Effekt vorschlagen wenn Template erstellt wird
      Hooks.once("createMeasuredTemplate", async (templateDoc) => {
        if (typeof DSAPixelTokens === "undefined") return;

        // Finde passenden Zone-Preset
        const mapping = lookupSpellEffect(spellName);
        if (!mapping) return;

        // Zone-Presets durchsuchen nach passendem Effekt
        const zonePresets = DSAPixelTokens.ZONE_PRESETS ?? {};
        const matchingZone = Object.entries(zonePresets).find(([name, preset]) => {
          // Feuer-Zauber → zone_feuer, Eis → zone_eis, etc.
          const spellLower = spellName.toLowerCase();
          if (spellLower.includes("feuer") || spellLower.includes("igni") || spellLower.includes("flamm")) return name === "zone_feuer";
          if (spellLower.includes("eis") || spellLower.includes("frost")) return name === "zone_eis";
          if (spellLower.includes("gift") || spellLower.includes("odem")) return name === "zone_gift";
          if (spellLower.includes("heil") || spellLower.includes("balsa")) return name === "zone_heilung";
          if (spellLower.includes("sturm") || spellLower.includes("wind") || spellLower.includes("blitz")) return name === "zone_sturm";
          if (spellLower.includes("dunkel") || spellLower.includes("schatten")) return name === "zone_dunkel";
          return false;
        });

        if (matchingZone) {
          const [zoneName] = matchingZone;
          await DSAPixelTokens.spawnZoneEffect(templateDoc, zoneName);
        } else {
          // Kein Match → Zone-Picker öffnen
          DSAPixelTokens.showZonePicker(templateDoc);
        }
      });
    });
  });
}

// ─── Hook Registration ──────────────────────────────────────────────────────

export function registerMagicHooks() {
  registerMagicChatHooks();
  console.log(`[${MODULE_ID}] ✓ Magic System registriert`);
}
