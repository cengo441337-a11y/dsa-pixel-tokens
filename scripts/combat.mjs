/**
 * DSA Pixel-Art Tokens — Kampf-Automation
 * Manöver-System, Schaden-Berechnung, Fernkampf-Projektile, Wundschwellen
 */

import { MODULE_ID, COMBAT_MANEUVERS, RANGED_MODIFIERS, getWoundThresholds, PROBE_SOUNDS } from "./config.mjs";

// ─── Angriffs-Dialog mit Manöver-Auswahl ────────────────────────────────────

/**
 * Öffnet einen Angriffs-Dialog mit Manöver-Auswahl und Modifikator-Eingabe.
 * @param {Actor} actor
 * @param {string} talentName - Name des Kampftalents
 * @param {number} atValue - AT-Wert
 * @returns {Promise<{maneuver: string, mod: number, ansage: number}|null>}
 */
export async function showAttackDialog(actor, talentName, atValue) {
  const maneuverButtons = Object.entries(COMBAT_MANEUVERS).map(([key, m]) => {
    const modStr = [];
    if (m.atMod !== 0) modStr.push(`AT${m.atMod >= 0 ? "+" : ""}${m.atMod}`);
    if (m.paMod !== 0) modStr.push(`PA${m.paMod >= 0 ? "+" : ""}${m.paMod}`);
    const reqStr = m.requires ? ` <span style="color:#888;font-size:12px">[${m.requires}]</span>` : "";
    return `
      <div class="maneuver-btn" data-maneuver="${key}">
        <span>${m.label}${reqStr}</span>
        <span class="maneuver-mods">${modStr.join(", ") || "—"}</span>
      </div>`;
  }).join("");

  return new Promise((resolve) => {
    new Dialog({
      title: `Angriff: ${talentName} (AT ${atValue})`,
      content: `
        <div class="dsa-pixel-attack-dialog">
          <div style="text-align:center;margin-bottom:8px;color:#ffd700;font-family:'Press Start 2P',cursive;font-size:10px">
            ANGRIFF
          </div>
          <div class="maneuver-list">${maneuverButtons}</div>
          <hr style="border-color:#3a3a5e;margin:8px 0">
          <div style="display:flex;gap:12px;align-items:center;justify-content:center">
            <label style="font-family:'VT323',monospace;font-size:15px;color:#bbb">Mod:</label>
            <input id="atk-mod" type="number" value="0" style="width:50px;text-align:center;font-family:'VT323',monospace;font-size:18px;background:rgba(0,0,0,0.4);border:2px solid #3a3a5e;color:#e0e0e0">
            <label style="font-family:'VT323',monospace;font-size:15px;color:#bbb">Ansage:</label>
            <input id="atk-ansage" type="number" value="0" min="0" style="width:50px;text-align:center;font-family:'VT323',monospace;font-size:18px;background:rgba(0,0,0,0.4);border:2px solid #3a3a5e;color:#e0e0e0">
          </div>
        </div>
      `,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d20"></i>',
          label: "Angriff!",
          callback: (html) => {
            const selected = html.find(".maneuver-btn.selected").data("maneuver") ?? "normal";
            const mod = parseInt(html.find("#atk-mod").val()) || 0;
            const ansage = parseInt(html.find("#atk-ansage").val()) || 0;
            resolve({ maneuver: selected, mod, ansage });
          },
        },
        cancel: { label: "Abbruch", callback: () => resolve(null) },
      },
      default: "roll",
      close: () => resolve(null),
      render: (html) => {
        // Manöver-Auswahl (Radio-Button Style)
        html.find(".maneuver-btn").on("click", function () {
          html.find(".maneuver-btn").removeClass("selected");
          $(this).addClass("selected");
        });
        // Default: Normal
        html.find('[data-maneuver="normal"]').addClass("selected");
      },
    }).render(true);
  });
}

// ─── Schaden-Dialog ─────────────────────────────────────────────────────────

/**
 * Öffnet einen Schaden-Dialog mit TP, KK-Bonus und RS-Eingabe.
 * @param {string} weaponName
 * @param {string} tpFormula - z.B. "1W+4"
 * @param {number} kkBonus - KK-Bonus des Angreifers
 * @param {boolean} isCritical - Doppelter Schaden?
 * @returns {Promise<{tp: number, rs: number, sp: number}|null>}
 */
export async function showDamageDialog(weaponName, tpFormula, kkBonus = 0, isCritical = false) {
  // TP-Formel umwandeln: "1W+4" → "1d6+4"
  const rollFormula = tpFormula
    .replace(/(\d*)W(\+?\d*)/gi, (_, count, bonus) => {
      const c = count || "1";
      return `${c}d6${bonus}`;
    });

  // Würfeln
  const roll = new Roll(rollFormula);
  await roll.evaluate();
  let baseDmg = roll.total + kkBonus;
  if (isCritical) baseDmg *= 2;

  return new Promise((resolve) => {
    new Dialog({
      title: `Schaden: ${weaponName}`,
      content: `
        <div class="dsa-pixel-probe-dialog">
          <div style="text-align:center;margin:8px 0">
            <div style="font-family:'Press Start 2P',cursive;font-size:9px;color:#e94560;margin-bottom:6px">
              ${isCritical ? "KRITISCHER TREFFER!" : "SCHADEN"}
            </div>
            <div style="font-size:14px;color:#888">${tpFormula} ${kkBonus > 0 ? `+ ${kkBonus} KK` : ""} ${isCritical ? "(×2)" : ""}</div>
            <div style="font-size:28px;font-weight:bold;color:#e94560;margin:6px 0">${baseDmg} TP</div>
          </div>
          <div style="display:flex;gap:12px;align-items:center;justify-content:center;margin:8px 0">
            <label style="font-size:15px;color:#bbb">RS des Ziels:</label>
            <input id="dmg-rs" type="number" value="0" min="0" style="width:50px;text-align:center;font-size:18px;background:rgba(0,0,0,0.4);border:2px solid #3a3a5e;color:#e0e0e0">
          </div>
          <div id="dmg-result" style="text-align:center;font-size:20px;font-weight:bold;color:#ffd700;margin:8px 0">
            SP: ${baseDmg}
          </div>
        </div>
      `,
      buttons: {
        apply: {
          icon: '<i class="fas fa-heart-broken"></i>',
          label: "Schaden anwenden",
          callback: (html) => {
            const rs = parseInt(html.find("#dmg-rs").val()) || 0;
            const sp = Math.max(0, baseDmg - rs);
            resolve({ tp: baseDmg, rs, sp });
          },
        },
        cancel: { label: "Abbruch", callback: () => resolve(null) },
      },
      default: "apply",
      render: (html) => {
        // Live-Update des SP-Werts
        html.find("#dmg-rs").on("input", function () {
          const rs = parseInt(this.value) || 0;
          const sp = Math.max(0, baseDmg - rs);
          html.find("#dmg-result").text(`SP: ${sp}`);
          html.find("#dmg-result").css("color", sp > 0 ? "#e94560" : "#4ad94a");
        });
      },
    }).render(true);
  });
}

// ─── Schaden auf Token anwenden ─────────────────────────────────────────────

/**
 * Wendet Schadenspunkte auf einen Actor an und prüft Wundschwellen.
 * @param {Actor} actor
 * @param {number} sp - Schadenspunkte (nach RS-Abzug)
 */
export async function applyDamageToActor(actor, sp) {
  if (sp <= 0) return;

  const sys = actor.system;
  const currentLeP = sys.LeP?.value ?? sys.base?.LeP ?? 0;
  const newLeP = Math.max(0, currentLeP - sp);

  // LeP-Update
  const lepPath = sys.LeP?.value !== undefined ? "system.LeP.value" : "system.base.LeP";
  await actor.update({ [lepPath]: newLeP });

  // Wundschwellen prüfen
  const ko = sys.KO?.value ?? 10;
  const ws = getWoundThresholds(ko);
  let wounds = 0;
  if (sp >= ws.ws3)      wounds = 3;
  else if (sp >= ws.ws2) wounds = 2;
  else if (sp >= ws.ws1) wounds = 1;

  // Chat-Nachricht
  let woundText = "";
  if (wounds > 0) {
    woundText = `<div style="color:#ff3333;font-weight:bold;margin-top:4px">
      ${"💀".repeat(wounds)} ${wounds} Wunde${wounds > 1 ? "n" : ""} erlitten! (WS: ${ws.ws1}/${ws.ws2}/${ws.ws3})
    </div>`;
  }

  if (newLeP <= 0) {
    woundText += `<div style="color:#ff0000;font-weight:bold;font-size:18px;margin-top:4px">
      ☠ KAMPFUNFÄHIG!
    </div>`;
  }

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="dsa-pixel-chat">
      <div class="chat-title">Schaden erlitten</div>
      <div style="text-align:center">
        <span style="font-size:22px;color:#e94560;font-weight:bold">-${sp} LeP</span>
        <span style="font-size:14px;color:#888">(${newLeP}/${sys.LeP?.max ?? "?"})</span>
      </div>
      ${woundText}
    </div>`,
  });

  // VFX: Schadenflash wird automatisch via preUpdateActor Hook getriggert (pixel-tokens.mjs)
}

// ─── Fernkampf-Modifikator Dialog ───────────────────────────────────────────

/**
 * Dialog für Fernkampf-Modifikatoren (Reichweite, Bewegung, Sicht, etc.)
 */
export async function showRangedDialog(actor, talentName, fkValue) {
  return new Promise((resolve) => {
    const rangeOptions = Object.entries(RANGED_MODIFIERS)
      .map(([key, r]) => `<option value="${r.mod}">${r.label} (${r.mod >= 0 ? "+" : ""}${r.mod})</option>`)
      .join("");

    new Dialog({
      title: `Fernkampf: ${talentName} (FK ${fkValue})`,
      content: `
        <div class="dsa-pixel-probe-dialog">
          <div style="text-align:center;font-family:'Press Start 2P',cursive;font-size:10px;color:#ffd700;margin-bottom:8px">
            FERNKAMPF
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0">
            <div>
              <label style="font-size:13px;color:#888">Reichweite</label>
              <select id="fk-range" style="width:100%;font-family:'VT323',monospace;font-size:15px;background:rgba(0,0,0,0.4);border:2px solid #3a3a5e;color:#e0e0e0">
                ${rangeOptions}
              </select>
            </div>
            <div>
              <label style="font-size:13px;color:#888">Zusätzl. Mod</label>
              <input id="fk-mod" type="number" value="0" style="width:100%;text-align:center;font-size:18px;background:rgba(0,0,0,0.4);border:2px solid #3a3a5e;color:#e0e0e0">
            </div>
          </div>
          <div id="fk-total" style="text-align:center;font-size:16px;color:#ffd700;margin:8px 0">
            Effektiver FK-Wert: ${fkValue}
          </div>
        </div>
      `,
      buttons: {
        roll: {
          icon: '<i class="fas fa-bullseye"></i>',
          label: "Schießen!",
          callback: (html) => {
            const rangeMod = parseInt(html.find("#fk-range").val()) || 0;
            const extraMod = parseInt(html.find("#fk-mod").val()) || 0;
            resolve({ rangeMod, extraMod, totalMod: rangeMod + extraMod });
          },
        },
        cancel: { label: "Abbruch", callback: () => resolve(null) },
      },
      default: "roll",
      render: (html) => {
        const updateTotal = () => {
          const rangeMod = parseInt(html.find("#fk-range").val()) || 0;
          const extraMod = parseInt(html.find("#fk-mod").val()) || 0;
          const effective = fkValue + rangeMod - extraMod;
          html.find("#fk-total").text(`Effektiver FK-Wert: ${effective}`);
        };
        html.find("#fk-range, #fk-mod").on("input change", updateTotal);
      },
    }).render(true);
  });
}

// ─── Exports ────────────────────────────────────────────────────────────────

export function registerCombatHooks() {
  console.log(`[${MODULE_ID}] ✓ Combat System registriert`);
}
