/**
 * GARDIANUM — Zauberschild nach Liber Cantiones Remastered S.97-98
 *
 * Grund-Gardianum:
 *   - 3 Schritt Radius Schutzkuppel (mit Gefährten nutzbar)
 *   - Mindestens 3 AsP, Magier waehlt Investition
 *   - Absorbiert: Merkmal "Schaden"-Zauber (inkl. daemonische, flammenwolke, flammenschwert)
 *   - NICHT: magisch erhoehte Waffen, Waffen aus magischem Material, physische Attacken von
 *            Daemonen/Elementaren/Geistern/magischen Wesen, Verwandlung, Beherrschung
 *   - Kapazitaet: eingesetzte AsP + 2 × ZfP*
 *   - Dauer: bis AsP aufgezehrt, max. 1 Spielrunde (= 5 KR)
 *   - Appl. Detonationsgeschosse: halbe TP-Kosten zur Friedhofstuer
 *
 * Varianten:
 *   - "daemonen" (+3 AsP, ZfW 7+, +2 Aktionen): Daemonen koennen Kuppel nicht betreten /
 *     durchdringen; daemonische Angriffe ziehen 1 Schildpunkt pro 7 TP
 *   - "zauber" (+3 AsP, ZfW 7+, +2 Aktionen): zusaetzlich Verwandlung/Beherrschung
 *     (Eigenschaften/Einfluss/Form/Herrschaft). 1 AsP Absorption = 1 Schildpunkt-Verlust.
 *     Durchbrechende Zauber: ZfP* -= restliche Schild-AsP.
 *   - "persoenlich" (+5 AsP, ZfW 11+, +2 Aktionen): zweite Haut, nur Zauberer.
 *     Kapazitaet: 3 × ZfP* + eingesetzte AsP.
 */

const MOD = "dsa-pixel-tokens";
const FLAG = "gardianum";
const MAX_KR = 5;              // 1 Spielrunde = 5 KR (Foundry-Standard)
const SCHRITT_METERS = 1;      // 1 Schritt = 1m (Foundry-Grid-Standard)
const DOME_RADIUS_SCHRITT = 3; // Gardianum-Grundradius

// ─── Casting ────────────────────────────────────────────────────────────────

/**
 * @param {Actor}  caster
 * @param {Object} opts
 * @param {"base"|"daemonen"|"zauber"|"persoenlich"} opts.variant
 * @param {number} opts.aspInvest  - vom Zauberer eingesetzte AsP
 * @param {number} opts.zfpStar    - ZfP* aus der Zauberprobe
 * @param {string} [opts.spellName="Gardianum"]
 */
export async function castGardianum(caster, { variant = "base", aspInvest = 3, zfpStar = 0, spellName = "Gardianum" } = {}) {
  if (!caster) { ui.notifications.warn("Gardianum: kein Zauberer gewaehlt"); return null; }

  // Schild-Kapazitaet berechnen
  const shieldHp = variant === "persoenlich"
    ? 3 * zfpStar + aspInvest
    : aspInvest + 2 * zfpStar;

  // Token des Zauberers ermitteln (Template-Anker)
  const casterToken = caster.getActiveTokens()?.[0] ?? canvas.tokens.controlled?.[0];
  let templateId = null;
  if (variant !== "persoenlich" && casterToken) {
    try {
      const grid = canvas.scene.grid.size;
      const distancePerGrid = canvas.scene.grid.distance ?? 1;
      const radiusInGrids = DOME_RADIUS_SCHRITT / distancePerGrid;
      const [t] = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [{
        t: "circle",
        x: casterToken.center.x,
        y: casterToken.center.y,
        distance: DOME_RADIUS_SCHRITT,
        direction: 0,
        angle: 0,
        fillColor: "#8ab4ff",
        borderColor: "#4a90d9",
        texture: null,
        flags: { [MOD]: { gardianum: { casterId: caster.id, variant } } },
      }]);
      templateId = t.id;
    } catch (e) {
      console.warn("[Gardianum] Template creation failed:", e);
    }
  }

  // Flag auf dem Zauberer setzen
  const flag = {
    variant,
    hp: shieldHp,
    maxHp: shieldHp,
    zfpStar,
    aspInvest,
    templateId,
    sceneId: canvas.scene.id,
    castAt: Date.now(),
    krRemaining: MAX_KR,
    casterTokenId: casterToken?.id ?? null,
  };
  console.log("[Gardianum] Setting flag on", caster.name, flag);
  await caster.setFlag(MOD, FLAG, flag);
  // Verify after a microtask
  await Promise.resolve();
  const verify = caster.getFlag(MOD, FLAG);
  console.log("[Gardianum] Verify flag set:", verify ? "OK" : "MISSING", verify);
  if (!verify) {
    ui.notifications.error(`Gardianum: Flag-Set fehlgeschlagen auf ${caster.name}!`);
  }

  // Visual — "armatrutz" Aura
  if (globalThis.DSAPixelTokens?.spawnEffect && casterToken) {
    DSAPixelTokens.spawnEffect(casterToken.center.x, casterToken.center.y, "armatrutz");
  }

  // AsP abziehen (Basis 3 AsP + Invest + Varianten-Mehrkosten)
  const variantExtraAsP = { base: 0, daemonen: 3, zauber: 3, persoenlich: 5 }[variant] ?? 0;
  const totalAsP = Math.max(3, aspInvest) + variantExtraAsP;
  const aspData = _resolveActorAsP(caster);
  if (aspData?.path && aspData.val != null) {
    await caster.update({ [aspData.path]: Math.max(0, aspData.val - totalAsP) });
  }

  // Chat — kurz + kompakt; Details stehen im Panel
  const variantLabel = {
    base:         "Grund-Gardianum",
    daemonen:     "Schild gegen Daemonen",
    zauber:       "Schild gegen Zauber",
    persoenlich:  "Persoenlicher Schild",
  }[variant] ?? variant;

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: `<div class="dsa-pixel-chat">
      <div class="chat-title">🛡 ${spellName} — ${variantLabel}</div>
      <div style="text-align:center;font-size:22px;color:#4a90d9;font-weight:bold">${shieldHp} Schild-${variant === "daemonen" ? "Punkte" : "TP"}</div>
      <div style="text-align:center;font-size:11px;color:#888">−${totalAsP} AsP · max. ${MAX_KR} KR · Details im Gardianum-Panel</div>
    </div>`,
  });

  // Panel oeffnen + refreshen — damit User den Schild dauerhaft sieht
  GardianumPanel.open();
  return flag;
}

function _variantDescription(variant) {
  switch (variant) {
    case "daemonen":    return "Zusaetzlich: Daemonen koennen die Kuppel nicht durchdringen. Daemonische Angriffe ziehen 1 Schildpunkt je 7 TP.";
    case "zauber":      return "Zusaetzlich: Verwandlung + Beherrschung (Eigenschaften/Einfluss/Form/Herrschaft) werden absorbiert. Durchbrechende Zauber: ZfP* − Rest-Schild.";
    case "persoenlich": return "Enganliegende zweite Haut — nur der Zauberer wird geschuetzt. Radius entfaellt.";
    default:            return "Absorbiert direkten TP-Schaden aus Zaubern mit Merkmal Schaden (auch von Daemonen/Elementaren/Geistern).";
  }
}

// ─── Schadens-Absorption ────────────────────────────────────────────────────

/**
 * Prueft ob ein Ziel unter einem aktiven Gardianum steht und absorbiert Schaden.
 * Muss vor LeP-Reduktion in _applySpellDamage aufgerufen werden.
 *
 * @param {Actor}  targetActor  - Ziel des Zaubers
 * @param {Token}  targetToken  - Token des Ziels (fuer Distanzberechnung)
 * @param {Object} damageInfo   - Eintrag aus SPELL_DAMAGE_MAP
 * @param {number} tp           - TP vor RS-Reduktion
 * @param {string} spellName
 * @returns {{ absorbedTP: number, remainingTP: number, note: string }}
 */
export async function tryGardianumAbsorb(targetActor, targetToken, damageInfo, tp, spellName) {
  if (!targetActor || tp <= 0) return { absorbedTP: 0, remainingTP: tp, note: "" };

  // Finde relevanten Schild: Ziel-Actor selbst hat Schild, ODER Ziel befindet sich in einer Kuppel
  const coveringShields = _findShieldsCovering(targetActor, targetToken);
  if (coveringShields.length === 0) return { absorbedTP: 0, remainingTP: tp, note: "" };

  // Variante-basiertes Filter: passt der Zauber ueberhaupt zu dieser Schild-Variante?
  const absorbableShield = coveringShields.find(({ flag }) => _canAbsorb(flag.variant, damageInfo, spellName));
  if (!absorbableShield) {
    return {
      absorbedTP: 0,
      remainingTP: tp,
      note: `<div style="color:#888;font-size:11px;text-align:center">🛡 Gardianum (${coveringShields[0].flag.variant}) — dieser Zauber wird nicht absorbiert</div>`,
    };
  }

  // Absorbiere
  // WICHTIG: die Daemonen-Variante rechnet 1 Schildpunkt = 7 TP (LCR S.97).
  // Shield-HP sind die VERFUEGBAREN PUNKTE, nicht TP — bei Daemonen multipliziert
  // sich die Absorption entsprechend. Fuer alle anderen Varianten gilt 1:1.
  const { caster, flag } = absorbableShield;
  const ratio = (flag.variant === "daemonen" && damageInfo.daemonic) ? 7 : 1;
  // Maximal absorbierbare TP mit dem aktuellen Schild
  const maxAbsorbable = flag.hp * ratio;
  const absorbed = Math.min(tp, maxAbsorbable);
  // Verbrauchte Schildpunkte: TP / ratio, aufgerundet (Teilpunkt kostet vollen Punkt)
  const pointsConsumed = Math.ceil(absorbed / ratio);
  const newHp = Math.max(0, flag.hp - pointsConsumed);

  // Flag updaten oder entfernen wenn leer
  if (newHp === 0) {
    console.log("[Gardianum] UNSET via absorption (hp=0) for", caster.name); await caster.unsetFlag(MOD, FLAG);
    if (flag.templateId) {
      try { await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", [flag.templateId]); } catch {}
    }
  } else {
    await caster.setFlag(MOD, FLAG, { ...flag, hp: newHp });
  }

  const ratioNote = ratio > 1 ? ` <span style="color:#c09040">(${pointsConsumed} Schildpkt × ${ratio} TP)</span>` : "";
  const note = `<div style="margin-top:3px;padding:3px 6px;background:rgba(138,180,255,0.15);border:1px solid rgba(138,180,255,0.4);border-radius:3px;font-size:12px;text-align:center">
    🛡 <strong>${caster.name}</strong>s Gardianum absorbiert <strong style="color:#4a90d9">${absorbed} TP</strong>${ratioNote}
    (Schild: ${flag.hp} → <strong>${newHp}</strong>/${flag.maxHp})
    ${newHp === 0 ? `<div style="color:#e94560;font-weight:bold">💥 SCHILD AUFGEZEHRT</div>` : ""}
  </div>`;

  GardianumPanel.refresh();
  return { absorbedTP: absorbed, remainingTP: tp - absorbed, note };
}

/** @returns {Array<{caster:Actor, flag:object}>} */
function _findShieldsCovering(targetActor, targetToken) {
  const shields = [];
  for (const actor of game.actors) {
    const flag = actor.getFlag(MOD, FLAG);
    if (!flag || flag.hp <= 0) continue;
    if (flag.sceneId && flag.sceneId !== canvas.scene.id) continue;

    // Persönlich: nur Caster selbst ist geschuetzt
    if (flag.variant === "persoenlich") {
      if (actor.id === targetActor.id) shields.push({ caster: actor, flag });
      continue;
    }

    // Andere Varianten: Caster + alle in 3 Schritt Radius
    if (actor.id === targetActor.id) {
      shields.push({ caster: actor, flag });
      continue;
    }
    if (!targetToken) continue;
    const casterToken = actor.getActiveTokens()?.[0];
    if (!casterToken) continue;
    const dx = casterToken.center.x - targetToken.center.x;
    const dy = casterToken.center.y - targetToken.center.y;
    const gridDist = Math.sqrt(dx * dx + dy * dy) / canvas.scene.grid.size;
    const schrittDist = gridDist * (canvas.scene.grid.distance ?? 1);
    if (schrittDist <= DOME_RADIUS_SCHRITT + 0.5) {  // +0.5 Toleranz
      shields.push({ caster: actor, flag });
    }
  }
  return shields;
}

function _canAbsorb(variant, damageInfo, spellName) {
  // Grund-Gardianum + alle anderen: absorbiert immer "Schaden"-Merkmal-TP-Zauber
  // Ausgeschlossen: rein-LeP-Drain wie Ecliptifactus? Die sind trotzdem Merkmal Schaden.
  //   Ausschliessen wuerde ich: magic-weapon-enhanced TP (nicht im damageInfo trackbar)
  // Fuer Persönlichen Schild: nur Caster, gleiche Absorptionsregel
  //
  // Daemonen-Variante: absorbiert zusaetzlich daemonische physische Angriffe
  //   (damageInfo braucht `daemonic: true` in SPELL_DAMAGE_MAP fuer Daemonen-Kreatur-Attacken)
  //
  // Zauber-Variante: absorbiert zusaetzlich Verwandlung/Beherrschung
  //   (die haben i.d.R. aber keinen TP-Wert — das wird per Merkmal-Check via damageInfo abgewickelt)

  // Alle Varianten absorbieren Schaden-Merkmal
  if (damageInfo.element && damageInfo.element !== "unsichtbar") return true;
  if (damageInfo.damageType === "fixedRoll" || damageInfo.damageType === "fixedPlusZfpStar"
      || damageInfo.damageType === "chooseDice" || damageInfo.damageType === "dotPerKR"
      || damageInfo.damageType === "separateCostRoll") return true;
  return false;
}

// ─── Kampfrunden-Tick ───────────────────────────────────────────────────────

Hooks.on("updateCombat", async (combat, changed) => {
  // Nur bei Runden-Wechsel oder neuer Initiative
  if (!("round" in changed) && !("turn" in changed)) return;
  // Nur pro neue KR einmal ticken
  if (!("round" in changed)) return;

  for (const actor of game.actors) {
    const flag = actor.getFlag(MOD, FLAG);
    if (!flag) continue;
    const newKr = (flag.krRemaining ?? MAX_KR) - 1;
    if (newKr <= 0) {
      console.log("[Gardianum] UNSET via combat tick (krRemaining=0) for", actor.name);
      await actor.unsetFlag(MOD, FLAG);
      if (flag.templateId && canvas.scene) {
        try { await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", [flag.templateId]); } catch {}
      }
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="dsa-pixel-chat"><div class="chat-title">🛡 Gardianum von ${actor.name}</div>
          <div style="text-align:center;color:#888">⏳ Wirkungsdauer abgelaufen (1 Spielrunde)</div></div>`,
      });
    } else {
      await actor.setFlag(MOD, FLAG, { ...flag, krRemaining: newKr });
    }
  }
  GardianumPanel.refresh();
});

// Template-Move synchron zu Caster-Bewegung
Hooks.on("updateToken", async (tokenDoc, changes) => {
  if (!("x" in changes) && !("y" in changes)) return;
  const actor = tokenDoc.actor;
  if (!actor) return;
  const flag = actor.getFlag(MOD, FLAG);
  if (!flag?.templateId) return;
  const template = canvas.scene?.templates.get(flag.templateId);
  if (!template) return;
  const tokenObj = tokenDoc.object;
  if (!tokenObj) return;
  try {
    await template.update({ x: tokenObj.center.x, y: tokenObj.center.y });
  } catch {}
});

// Template manuell geloescht → Schild auch weg
Hooks.on("deleteMeasuredTemplate", async (template) => {
  for (const actor of game.actors) {
    const flag = actor.getFlag(MOD, FLAG);
    if (flag?.templateId === template.id) {
      console.log("[Gardianum] UNSET via deleteMeasuredTemplate hook for", actor.name, "template:", template.id);
      console.trace("[Gardianum] TEMPLATE-DELETE-CALLER");
      await actor.unsetFlag(MOD, FLAG);
      GardianumPanel.refresh();
    }
  }
});

// Panel-Refresh bei jeder Gardianum-Flag-Aenderung (set/unset)
Hooks.on("updateActor", (actor, changes) => {
  const ns = changes?.flags?.["dsa-pixel-tokens"];
  if (!ns) return;
  if ("gardianum" in ns || "-=gardianum" in ns) {
    GardianumPanel.refresh();
  }
});

// ─── UI Panel ───────────────────────────────────────────────────────────────

class GardianumPanel extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dsa-gardianum-panel",
      title: "🛡 Aktive Gardiana",
      template: null,
      width: 340,
      height: "auto",
      classes: ["dsa-pixel-panel"],
      resizable: true,
      popOut: true,
    });
  }

  static _instance = null;
  static open() {
    if (!this._instance) this._instance = new this();
    this._instance.render(true);
  }
  static refresh() {
    // Immer force=true — sonst re-renderet Foundry v12 manchmal nicht bei identischer Position
    if (this._instance) this._instance.render(true);
  }

  async _renderInner() {
    const active = game.actors.filter(a => a.getFlag(MOD, FLAG));
    const html = `<div style="padding:10px;background:#1e2a44;color:#e0e0e0;font-family:sans-serif;max-height:70vh;overflow-y:auto;min-width:320px">
      ${active.length === 0
        ? `<div style="text-align:center;color:#888;padding:24px 8px;background:#2a3a5c;border-radius:4px;border:1px dashed #3a4a6c">
            <div style="font-size:28px;margin-bottom:6px">🛡</div>
            <div style="font-size:13px">Keine aktiven Gardiana</div>
            <div style="font-size:11px;color:#666;margin-top:4px">Zauber Gardianum oder klick unten</div>
          </div>`
        : active.map(a => {
            const f = a.getFlag(MOD, FLAG);
            const pct = Math.round((f.hp / f.maxHp) * 100);
            const color = pct > 66 ? "#4caf50" : pct > 33 ? "#ff9800" : "#e94560";
            const variantLabel = { base: "Grund", daemonen: "vs Daemonen", zauber: "vs Zauber", persoenlich: "Persoenlich" }[f.variant] ?? f.variant;
            const unit = f.variant === "daemonen" ? "Pkt" : "TP";
            const maxAbsorbable = f.variant === "daemonen" ? `(max. ${f.hp * 7} TP absorbierbar)` : "";
            const variantIcon = { base: "🛡", daemonen: "👿", zauber: "🔮", persoenlich: "🧍" }[f.variant] ?? "🛡";
            return `<div style="margin:8px 0;padding:8px 10px;background:#2a3a5c;border:2px solid ${color};border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <strong style="font-size:14px">${variantIcon} ${a.name}</strong>
                <span style="font-size:10px;color:${color};background:rgba(0,0,0,0.3);padding:1px 6px;border-radius:8px">${variantLabel}</span>
              </div>
              <div style="height:14px;background:#141c30;border-radius:3px;margin:6px 0;overflow:hidden;border:1px solid #3a4a6c;position:relative">
                <div style="width:${pct}%;height:100%;background:linear-gradient(90deg, ${color}, ${color}dd);transition:width 0.3s"></div>
                <div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;text-shadow:0 0 3px #000">
                  ${f.hp}/${f.maxHp} ${unit}
                </div>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:11px;color:#aaa;margin-bottom:6px">
                <span>⏳ ${f.krRemaining}/${MAX_KR} KR</span>
                <span>${maxAbsorbable}</span>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
                <button data-action="info" data-actor="${a.id}" style="font-size:11px;padding:5px;background:#2a3a5c;border:1px solid #4a90d9;color:#4a90d9;border-radius:3px;cursor:pointer">
                  ℹ Details
                </button>
                <button data-action="drop" data-actor="${a.id}" style="font-size:11px;padding:5px;background:#44262a;border:1px solid #e94560;color:#ff6680;border-radius:3px;cursor:pointer;font-weight:bold">
                  💥 Zauber aufloesen
                </button>
              </div>
            </div>`;
          }).join("")}
      <button id="gardianum-cast" style="width:100%;margin-top:10px;padding:8px;background:linear-gradient(135deg, #4a90d9, #3a7bc8);border:none;color:white;font-weight:bold;border-radius:4px;cursor:pointer;font-size:13px;box-shadow:0 2px 4px rgba(74,144,217,0.4)">
        ⚡ Neues Gardianum wirken
      </button>
      <button id="gardianum-refresh" style="width:100%;margin-top:4px;padding:4px;background:transparent;border:1px solid #3a4a6c;color:#888;border-radius:3px;cursor:pointer;font-size:10px">
        🔄 Panel neu laden
      </button>
    </div>`;
    return $(html);
  }

  async _render(force = false, options = {}) {
    await super._render(force, options);
    this.element.find('button[data-action="drop"]').on("click", async (e) => {
      const id = e.currentTarget.dataset.actor;
      const a = game.actors.get(id);
      if (!a) return;
      const f = a.getFlag(MOD, FLAG);
      // Bestaetigung
      const confirmed = await Dialog.confirm({
        title: "Zauber aufloesen?",
        content: `<p>Gardianum von <strong>${a.name}</strong> jetzt aufloesen?<br>
          <span style="color:#888;font-size:11px">(${f?.hp ?? 0}/${f?.maxHp ?? 0} Schild noch uebrig)</span></p>`,
        yes: () => true, no: () => false, defaultYes: false,
      });
      if (!confirmed) return;
      if (f?.templateId) {
        try { await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", [f.templateId]); } catch {}
      }
      console.log("[Gardianum] UNSET via panel-drop button for", a.name);
      await a.unsetFlag(MOD, FLAG);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: a }),
        content: `<div class="dsa-pixel-chat"><div class="chat-title">🛡 Gardianum aufgeloest</div>
          <div style="text-align:center;color:#888;font-size:12px">${a.name} hat den Zauber manuell aufgeloest</div></div>`,
      });
      GardianumPanel.refresh();
    });
    this.element.find('button[data-action="info"]').on("click", (e) => {
      const id = e.currentTarget.dataset.actor;
      const a = game.actors.get(id);
      const f = a?.getFlag(MOD, FLAG);
      if (!f) return;
      const unit = f.variant === "daemonen" ? "Punkte (1 Pkt = 7 TP)" : "TP";
      const maxAbs = f.variant === "daemonen" ? `<p><strong>Max. absorbierbare TP:</strong> ${f.hp * 7}</p>` : "";
      new Dialog({
        title: `🛡 Gardianum — ${a.name}`,
        content: `<div style="padding:10px;font-size:12px;line-height:1.6">
          <p><strong>Variante:</strong> ${f.variant}</p>
          <p><strong>Schild:</strong> ${f.hp}/${f.maxHp} ${unit}</p>
          ${maxAbs}
          <p><strong>ZfP*:</strong> ${f.zfpStar} · <strong>AsP-Invest:</strong> ${f.aspInvest}</p>
          <p><strong>KR Rest:</strong> ${f.krRemaining}/${MAX_KR}</p>
          <p><strong>Radius:</strong> ${f.variant === "persoenlich" ? "nur Zauberer (zweite Haut)" : DOME_RADIUS_SCHRITT + " Schritt um Zauberer"}</p>
          <hr>
          <p style="color:#888;font-size:11px">${_variantDescription(f.variant)}</p>
        </div>`,
        buttons: { ok: { label: "OK" } },
      }).render(true);
    });
    this.element.find('#gardianum-cast').on("click", () => showGardianumDialog());
    this.element.find('#gardianum-refresh').on("click", () => this.render(false));
  }
}

// ─── Casting Dialog ─────────────────────────────────────────────────────────

export function showGardianumDialog() {
  const caster = canvas.tokens.controlled?.[0]?.actor
              ?? game.user?.character
              ?? [...(game.user?.targets ?? [])][0]?.actor;
  if (!caster) {
    ui.notifications.warn("Gardianum: Erst einen Token ausw aehlen (Zauberer)");
    return;
  }

  const content = `<form>
    <div style="margin:6px 0">
      <label>Variante:</label>
      <select name="variant" style="width:100%">
        <option value="base">Grund-Gardianum (min. 3 AsP)</option>
        <option value="daemonen">Schild gegen Daemonen (+3 AsP, ZfW 7+)</option>
        <option value="zauber">Schild gegen Zauber (+3 AsP, ZfW 7+)</option>
        <option value="persoenlich">Persoenlicher Schild (+5 AsP, ZfW 11+)</option>
      </select>
    </div>
    <div style="margin:6px 0">
      <label>AsP investieren (zusaetzlich zur Basiskost):</label>
      <input type="number" name="aspInvest" value="6" min="3" step="1" style="width:100%">
    </div>
    <div style="margin:6px 0">
      <label>ZfP* (aus Zauberprobe, ab Rest zur AsP):</label>
      <input type="number" name="zfpStar" value="3" min="0" step="1" style="width:100%">
    </div>
    <div style="margin:6px 0;padding:6px;background:rgba(74,144,217,0.1);border-radius:3px;font-size:11px;color:#888">
      Schild-Kapazitaet: AsP + 2 × ZfP* (bzw. 3 × ZfP* + AsP bei Persoenlichem Schild)
    </div>
  </form>`;

  new Dialog({
    title: `🛡 Gardianum — ${caster.name}`,
    content,
    buttons: {
      cast: {
        icon: '<i class="fas fa-shield-alt"></i>',
        label: "Wirken",
        callback: (html) => {
          const variant = html.find('[name="variant"]').val();
          const aspInvest = Number(html.find('[name="aspInvest"]').val() || 3);
          const zfpStar = Number(html.find('[name="zfpStar"]').val() || 0);
          castGardianum(caster, { variant, aspInvest, zfpStar });
        },
      },
      cancel: { label: "Abbrechen" },
    },
    default: "cast",
  }).render(true);
}

// ─── AsP-Pfad Helper ────────────────────────────────────────────────────────

function _resolveActorAsP(actor) {
  const sys = actor.system ?? {};
  if (sys.AsP?.value != null) return { path: "system.AsP.value", val: sys.AsP.value };
  if (sys.asp?.value != null) return { path: "system.asp.value", val: sys.asp.value };
  return null;
}

// ─── Scene-Control-Button (Toolbox links) ───────────────────────────────────

Hooks.on("getSceneControlButtons", (controls) => {
  const tokenControl = controls.find(c => c.name === "token");
  if (!tokenControl) return;
  if (tokenControl.tools.find(t => t.name === "gardianum-panel")) return;
  tokenControl.tools.push({
    name: "gardianum-panel",
    title: "Gardianum-Panel",
    icon: "fas fa-shield-alt",
    button: true,
    onClick: () => GardianumPanel.open(),
  });
});

// Beim Welt-Load: Panel oeffnen wenn bereits aktive Schilde existieren
Hooks.once("canvasReady", () => {
  const anyActive = game.actors.some(a => a.getFlag(MOD, FLAG));
  if (anyActive) GardianumPanel.open();
});

// ─── Globale Helfer ─────────────────────────────────────────────────────────

globalThis.DSAGardianum = () => showGardianumDialog();
globalThis.DSAGardianumPanel = () => GardianumPanel.open();
globalThis.DSAGardianumDebug = () => {
  const list = game.actors.filter(a => a.getFlag(MOD, FLAG)).map(a => ({
    actor: a.name, flag: a.getFlag(MOD, FLAG),
  }));
  console.table(list);
  return list;
};

export { GardianumPanel };
