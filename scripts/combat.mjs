/**
 * DSA Pixel-Art Tokens — Kampf-Automation
 * Manöver-System, Schaden-Berechnung, Fernkampf-Projektile, Wundschwellen
 */

import { MODULE_ID, COMBAT_MANEUVERS, RANGED_MODIFIERS, getWoundThresholds, PROBE_SOUNDS } from "./config.mjs";

// ─── Passierschlag ───────────────────────────────────────────────────────────

/**
 * Führt einen Passierschlag für den aktiven Spieler aus.
 * AT−4, kein Parieren durch Gegner möglich.
 * Bei Treffer: TP normal + INI des Ziels −1W6.
 * (WdS S.85)
 *
 * @param {Actor} actor - Der Angreifer (der den Passierschlag ausführt)
 */
export async function rollPassierschlag(actor) {
  if (!actor) {
    ui.notifications.warn("Kein Charakter ausgewählt für Passierschlag.");
    return;
  }

  // Hauptwaffen-AT des Actors ermitteln (gdsa: system.skill)
  const sys = actor.system;
  let at = 0, weaponName = "Angriff";

  // system.skill (gdsa) → erste Eintrarag mit atk > 0
  const skillEntries = Object.entries(sys.skill ?? {})
    .filter(([, v]) => v?.atk > 0)
    .sort((a, b) => (b[1].atk ?? 0) - (a[1].atk ?? 0));
  if (skillEntries.length > 0) {
    const [wName, wData] = skillEntries[0];
    weaponName = wName;
    at = parseInt(wData.atk ?? 0) || 0;
  } else {
    // Fallback: ATBasis
    at = parseInt(sys.ATBasis?.value ?? 0) || 0;
    weaponName = "ATBasis";
  }

  // Passierschlag: AT−4 (WdS S.85)
  const effectiveAT = Math.max(1, at - 4);

  const roll = new Roll("1d20");
  await roll.evaluate();
  const die     = roll.total;
  const success = die <= effectiveAT;
  const fumble  = die === 20;

  let resultText, resultCls;
  let extraLine = "";

  if (success) {
    resultText = "PASSIERSCHLAG TRIFFT!";
    resultCls  = "result-success";
    extraLine  = `<div class="dsa-maneuver-effect" style="color:#e94560">
      ⚡ Schaden auswürfeln + Ziel verliert 1W6 INI!<br>
      <span style="font-size:12px;color:#888">Verteidiger darf NICHT parieren (WdS S.85)</span>
    </div>`;

    // INI-Verlust-Würfel direkt anzeigen
    const iniRoll = new Roll("1d6");
    await iniRoll.evaluate();
    extraLine += `<div class="dsa-maneuver-effect" style="color:#ffd700">INI Verlust: −${iniRoll.total}</div>`;

  } else if (fumble) {
    resultText = "PATZER!"; resultCls = "result-fail";
    extraLine  = `<div class="dsa-fumble-outcome">⚠ Patzer beim Passierschlag!</div>`;
  } else {
    resultText = "Passierschlag verfehlt";
    resultCls  = "result-fail";
  }

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="dsa-pixel-chat">
      <div class="chat-title">⚔ Passierschlag: ${weaponName}</div>
      <div class="dice-row">
        <div class="die ${fumble ? "fumble" : success ? "success" : "fail"}">${die}</div>
      </div>
      <div class="dsa-mod-hint">AT ${at} − 4 = Ziel ${effectiveAT} · kein Parieren möglich</div>
      <div class="result-line ${resultCls}">${resultText}</div>
      ${extraLine}
    </div>`,
  });

  // VFX
  if (success && typeof DSAPixelTokens !== "undefined") {
    const srcToken = actor.getActiveTokens?.()?.[0];
    const tgtToken = [...(game.user?.targets ?? [])][0];
    if (srcToken && tgtToken) {
      setTimeout(() => {
        DSAPixelTokens.spawnEffect(tgtToken.center.x, tgtToken.center.y, "schadenflash");
      }, 100);
    }
  }
}

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
          const effective = fkValue + rangeMod + extraMod;
          html.find("#fk-total").text(`Effektiver FK-Wert: ${effective}`);
        };
        html.find("#fk-range, #fk-mod").on("input change", updateTotal);
      },
    }).render(true);
  });
}

// ─── Passierschlag bei Token-Bewegung ────────────────────────────────────────

const _prevPos = new Map(); // tokenId → { x, y }

function _isAdjacent(ax, ay, bx, by, gridSize) {
  const dx = Math.abs(ax - bx) / gridSize;
  const dy = Math.abs(ay - by) / gridSize;
  return dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0);
}

function _registerMovementHook() {
  // Alte Position vor dem Update merken
  Hooks.on("preUpdateToken", (tokenDoc, changes) => {
    if (changes.x !== undefined || changes.y !== undefined) {
      _prevPos.set(tokenDoc.id, { x: tokenDoc.x, y: tokenDoc.y });
    }
  });

  // Nach Update: prüfen ob Token aus Nahkampf-Reichweite verlassen hat
  // WICHTIG: in FoundryVTT v12 hat tokenDoc.x im Hook noch den alten Wert →
  //          neue Position aus changes lesen.
  Hooks.on("updateToken", async (tokenDoc, changes) => {
    if (!game.user.isGM) return;
    // Nur während aktiver Kampf-Session auf der aktuellen Scene
    const scene = tokenDoc.parent;
    // v12: combat.active = im Tracker sichtbar; combat.started = Runde läuft
    const activeCombat = game.combats?.find(c => (c.active || c.started) && c.scene?.id === scene?.id);
    if (!activeCombat) { _prevPos.delete(tokenDoc.id); return; }
    if (!_prevPos.has(tokenDoc.id)) return;
    const { x: oldX, y: oldY } = _prevPos.get(tokenDoc.id);
    _prevPos.delete(tokenDoc.id);

    const newX = changes.x ?? tokenDoc.x;
    const newY = changes.y ?? tokenDoc.y;
    if (oldX === newX && oldY === newY) return;

    if (!scene) return;
    const gridSize = scene.grid?.size ?? 100;

    // Alle Token die an der ALTEN Position angrenzten
    const candidates = scene.tokens.contents.filter(t => {
      if (t.id === tokenDoc.id) return false;
      if (!t.actor) return false;
      return _isAdjacent(t.x, t.y, oldX, oldY, gridSize);
    });
    if (candidates.length === 0) return;

    // Davon nur die, die jetzt NICHT mehr angrenzend sind
    const leaving = candidates.filter(t => !_isAdjacent(t.x, t.y, newX, newY, gridSize));
    if (leaving.length === 0) return;

    // Für jeden betroffenen Token Dialog zeigen
    for (const t of leaving) {
      new Dialog({
        title: "⚔ Passierschlag möglich!",
        content: `
          <div style="font-family:'Cinzel',serif;padding:6px">
            <b>${t.name}</b> darf einen Passierschlag gegen
            <b>${tokenDoc.name}</b> ausführen.<br>
            <span style="font-size:11px;color:#888">(AT−4, kein Parieren möglich · WdS S.85)</span>
          </div>`,
        buttons: {
          roll: {
            icon: "<i class='fas fa-dice-d20'></i>",
            label: "Passierschlag würfeln",
            callback: async () => { await rollPassierschlag(t.actor); },
          },
          skip: { label: "Verzichten", callback: () => {} },
        },
        default: "roll",
      }).render(true);
    }
  });
}

// ─── Exports ────────────────────────────────────────────────────────────────

export function registerCombatHooks() {
  // Chat-Button: Passierschlag (erscheint nach misslugenem Sturmangriff / Todestoß)
  Hooks.on("renderChatMessage", (_msg, html) => {
    html.find("[data-action='passierschlag']").on("click", async (e) => {
      e.preventDefault();
      const actor = game.user?.character
        ?? canvas.tokens?.controlled?.[0]?.actor
        ?? null;
      if (!actor) {
        ui.notifications.warn("Wähle zuerst einen Token aus, um den Passierschlag auszuführen.");
        return;
      }
      await rollPassierschlag(actor);
    });
  });

  _registerMovementHook();

  console.log(`[${MODULE_ID}] ✓ Combat System registriert`);
}
