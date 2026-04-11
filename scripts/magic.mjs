/**
 * DSA Pixel-Art Tokens — Magie-System
 * Zauberprobe mit Spontanmodifikationen, AsP-Berechnung, Zone-Markierung
 */

import { MODULE_ID, SPELL_MODIFICATIONS, SPELL_EFFECT_MAP, resolveProbe, checkCritical, PROBE_SOUNDS, calculateModifications, REPRESENTATIONS } from "./config.mjs";

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
  const baseKosten = parseInt(spellData.kosten) || 0;
  const probeAttrs = (spellData.probe ?? []).map(a => sys[a]?.value ?? 10);

  // Repräsentation des Casters ermitteln
  const rep = actor.system?.repraesentation ?? "gildenmagisch";

  // Modifikations-Selects generieren (ZfP-basiert, WdZ-konform)
  const modSections = Object.entries(SPELL_MODIFICATIONS).map(([key, mod]) => {
    const options = mod.options.map((opt, i) => {
      const cost = opt.zfpCost ? `${opt.zfpCost} ZfP` : "";
      const extra = opt.extraAkt ? `+${opt.extraAkt} Akt` : "";
      const asp = opt.aspExtra ? `+${opt.aspExtra} AsP` : opt.aspMult && opt.aspMult !== 1.0 ? `×${opt.aspMult} AsP` : "";
      const erl = opt.erleichterung ? `+${opt.erleichterung} Erl.` : "";
      const info = [cost, extra, asp, erl].filter(Boolean).join(", ");
      return `<option value="${i}" ${i === 0 ? "selected" : ""}>${opt.label}${info ? ` (${info})` : ""}</option>`;
    }).join("");
    return `
      <div class="mod-section">
        <div class="mod-label">${mod.label} <span style="font-size:11px;color:#666">${mod.desc ?? ""}</span></div>
        <select data-mod="${key}">${options}</select>
      </div>`;
  }).join("");

  return new Promise((resolve) => {
    new Dialog({
      title: `Zauber: ${spellData.name}`,
      content: `
        <div class="dsa-pixel-spell-dialog">
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
              <div class="info-value">${baseKosten}</div>
            </div>
            <div>
              <div class="info-label">Zauberdauer</div>
              <div class="info-value">${spellData.zauberdauer ?? "?"}</div>
            </div>
          </div>

          <div style="font-family:'Press Start 2P',cursive;font-size:9px;color:#4a90d9;margin:8px 0">
            SPONTANE MODIFIKATIONEN
          </div>

          ${modSections}

          <div style="display:flex;gap:12px;align-items:center;justify-content:center;margin:8px 0">
            <label style="font-size:14px;color:#bbb">Zusätzl. Mod:</label>
            <input id="spell-extra-mod" type="number" value="0" style="width:50px;text-align:center;font-size:18px;background:rgba(0,0,0,0.4);border:2px solid #3a3a5e;color:#e0e0e0">
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
              <div class="total-value" id="spell-total-asp">${baseKosten}</div>
            </div>
          </div>
          <div style="text-align:center;font-size:12px;color:#888;margin-top:4px">
            Rep: ${rep} ${rep === "gildenmagisch" ? "(ZfP halbiert)" : rep === "druidisch" ? "(Erzwingen halbe Kosten)" : rep === "hexisch" ? "(Misserfolg: 1/3 AsP)" : ""}
          </div>
        </div>
      `,
      buttons: {
        cast: {
          icon: '<i class="fas fa-magic"></i>',
          label: "Zaubern!",
          callback: (html) => {
            const result = _calculateModificationsFromHTML(html, baseKosten, rep);
            resolve(result);
          },
        },
        cancel: { label: "Abbruch", callback: () => resolve(null) },
      },
      default: "cast",
      render: (html) => {
        // Live-Update bei Modifikationsänderungen (ZfP-basiert)
        html.find("select[data-mod], #spell-extra-mod").on("input change", () => {
          const result = _calculateModificationsFromHTML(html, baseKosten, rep);
          html.find("#spell-total-zfp").text(result.totalZfP);
          html.find("#spell-total-akt").text(`+${result.extraAkt}`);
          html.find("#spell-total-asp").text(result.aspCost);

          // Farbe: rot wenn ZfP-Kosten hoch
          html.find("#spell-total-zfp").css("color", result.totalZfP > 10 ? "#ff3333" : result.totalZfP > 0 ? "#e94560" : "#888");
        });
      },
    }).render(true);
  });
}

function _calculateModificationsFromHTML(html, baseKosten, rep = "gildenmagisch") {
  const selections = {};

  for (const key of Object.keys(SPELL_MODIFICATIONS)) {
    const select = html.find(`select[data-mod="${key}"]`);
    const idx = parseInt(select.val()) || 0;
    if (idx > 0) selections[key] = idx;
  }

  const result = calculateModifications(selections, baseKosten, rep);
  const extraMod = parseInt(html.find("#spell-extra-mod").val()) || 0;

  return {
    totalZfP: result.totalZfP,
    extraAkt: result.totalExtraAkt,
    aspCost: result.finalAsP,
    erleichterung: result.erleichterung - extraMod, // negative extraMod = Erschwernis
    selections,
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
  // 1. Dialog
  const dialogResult = await showSpellDialog(actor, spellData);
  if (!dialogResult) return null;

  const { totalZfP, extraAkt, aspCost, erleichterung, selections } = dialogResult;

  // 2. AsP prüfen
  const currentAsP = actor.system.AsP?.value ?? 0;
  if (currentAsP < aspCost) {
    ui.notifications.warn(`Nicht genug AsP! Benötigt: ${aspCost}, Verfügbar: ${currentAsP}`);
    return null;
  }

  // 3. ZfP-Kosten vom ZfW abziehen (Spontanmodifikationen kosten ZfP, nicht Probe-Mod!)
  const baseZfw = parseInt(spellData.zfw) || 0;
  const effectiveZfw = baseZfw - totalZfP;
  if (effectiveZfw < 0) {
    ui.notifications.warn(`ZfW zu niedrig für diese Modifikationen! ZfW ${baseZfw} - ${totalZfP} ZfP = ${effectiveZfw}`);
    return null;
  }

  // 4. Würfeln
  const roll = new Roll("3d20");
  await roll.evaluate();
  const dice = roll.terms[0].results.map(r => r.result);

  // 5. Probe auswerten (Erleichterung aus Erzwingen wird als negativer Modifikator angewendet)
  const probeAttrs = (spellData.probe ?? []).map(a => actor.system[a]?.value ?? 10);
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

  // 6. AsP abziehen
  // Erfolg: volle Kosten | Misserfolg: halbe Kosten | Hexen: 1/3 bei Misserfolg
  const rep = actor.system?.repraesentation ?? "gildenmagisch";
  let failFraction = 0.5;
  if (rep === "hexisch" || rep === "satuarisch") failFraction = 1/3;
  const actualCost = success ? aspCost : Math.ceil(aspCost * failFraction);
  await actor.update({
    "system.AsP.value": Math.max(0, currentAsP - actualCost),
  });

  // 7. Modifikations-Zusammenfassung
  const modSummary = Object.entries(mods)
    .filter(([, m]) => m.probeMod !== 0 || m.aspMult !== 1.0)
    .map(([key, m]) => `${SPELL_MODIFICATIONS[key]?.label}: ${m.label}`)
    .join(", ");

  // 8. Chat
  const diceHtml = dice.map((d, i) => {
    const attr = probeAttrs[i];
    const cls = d === 1 ? "crit" : d === 20 ? "fumble" : d > attr ? "fail" : "success";
    return `<div class="die ${cls}" title="${(spellData.probe ?? [])[i]} ${attr}">${d}</div>`;
  }).join("");

  const flavor = `<div class="dsa-pixel-chat">
    <div class="chat-title">⚡ ${spellData.name}</div>
    <div class="dice-row">${diceHtml}</div>
    <div class="result-line ${resultClass}">${resultLabel}</div>
    ${success ? `<div class="tap-star">ZfP*: <span>${result.tapStar}</span></div>` : ""}
    <div style="text-align:center;font-size:13px;color:#4a90d9">
      AsP: -${actualCost} ${!success ? "(halbe Kosten)" : ""}
      ${modSummary ? `<br><span style="color:#888">${modSummary}</span>` : ""}
    </div>
    ${success && SPELL_EFFECT_MAP[spellData.name]?.type === "zone" ?
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

  // 9. VFX auto-trigger
  if (success && typeof DSAPixelTokens !== "undefined") {
    const mapping = SPELL_EFFECT_MAP[spellData.name];
    if (mapping) {
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

  return { success, result, crit, aspCost: actualCost };
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
        const mapping = SPELL_EFFECT_MAP[spellName];
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
