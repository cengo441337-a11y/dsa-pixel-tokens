/**
 * DSA Pixel Tokens — Zonen-/Dauer-Zauber
 *
 * Implementiert:
 *  - FESSELRANKEN (Einzelziel, Stat-Mali, KK-Probe zur Befreiung)
 *  - AUGE DES LIMBUS (Zone, Sog, KK-Probe pro KR, Schaden im Zentrum)
 *  - SUMPFSTRUDEL (Zone, Talentprobe zur Befreiung, 1W6 SP(A) pro Probe)
 *
 * Gemeinsame Infrastruktur:
 *  - Zone-Platzierung (MeasuredTemplate)
 *  - Popout-Panel (Application)
 *  - Pro-KR-Tick via updateCombat Hook
 *  - Auto-Despawn nach Wirkungsdauer
 */

import { MODULE_ID, HIT_ZONE_TABLE, ZONE_LABELS, getWoundThresholds } from "./config.mjs";

// ─── Constants ──────────────────────────────────────────────────────────────

const FLAG_ZONE     = "zoneSpell";        // Auf MeasuredTemplate
const FLAG_FESSEL   = "fesselrankenState"; // Auf Actor
const FLAG_SUMPF    = "sumpfState";        // Auf Actor (TaP*-Akkumulation)
const CHAT_PANEL    = "zoneSpellPanel";

const _vfxIntervals = new Map();
const _openPanels = new Map();

// ═══════════════════════════════════════════════════════════════════════════
// ─── SHARED: Zone-Template ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

async function _placeZoneTemplate(caster, radius, fillColor = "#4a7c2a", borderColor = "#6bba3a") {
  const targetToken = [...(game.user?.targets ?? [])][0];
  const casterToken = caster.getActiveTokens()[0];
  let cx, cy;
  if (targetToken) { cx = targetToken.center.x; cy = targetToken.center.y; }
  else if (casterToken) { cx = casterToken.center.x; cy = casterToken.center.y; }
  else { cx = canvas.dimensions.width / 2; cy = canvas.dimensions.height / 2; }

  const [template] = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [{
    t: "circle", x: cx, y: cy, distance: radius,
    fillColor, borderColor,
  }]);
  canvas.templates.activate();
  if (template) canvas.templates.get(template.id)?.control({ releaseOthers: true });
  return template;
}

function _tokensInZone(template) {
  if (!template) return [];
  const gridSize = canvas.scene.grid?.size ?? 100;
  const radiusPx = (template.distance ?? 2) * gridSize;
  const cx = template.x, cy = template.y;
  return canvas.scene.tokens.filter(t => {
    if (!t.actor) return false;
    const tcx = t.x + (t.width ?? 1) * gridSize / 2;
    const tcy = t.y + (t.height ?? 1) * gridSize / 2;
    return Math.hypot(tcx - cx, tcy - cy) <= radiusPx;
  });
}

function _getZoneRS(actor, zone) {
  if (!actor) return 0;
  const creatureFlag = actor.getFlag(MODULE_ID, "creature");
  if (creatureFlag?.rs !== undefined) return creatureFlag.rs;
  const armorDb = globalThis.DSAPixelData?.armorZones?.armor ?? [];
  let rs = 0;
  for (const item of actor.items) {
    const sys = item.system ?? {};
    const t = item.type?.toLowerCase();
    if (t === "gegenstand" && sys.type === "armor") {
      const db = armorDb.find(a => a.name.toLowerCase() === item.name.toLowerCase());
      if (zone && db?.zones?.[zone] !== undefined) rs += db.zones[zone];
      else rs += (sys.armor?.rs ?? 0);
    }
  }
  return rs;
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── SHARED: Popout-Panel ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

class ZoneSpellPanel extends Application {
  constructor(templateId, options = {}) {
    super(options);
    this.templateId = templateId;
  }
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["dsa-pixel-sheet", "zone-spell-panel"],
      title: "Zauber-Zone",
      template: null,
      popOut: true,
      width: 420,
      height: "auto",
      minimizable: true,
      resizable: false,
    });
  }
  get id() { return `zsp-panel-${this.templateId}`; }

  async _renderInner(_data) {
    return $(`<div class="window-content">${_renderPanelHTML(this.templateId)}</div>`);
  }
  activateListeners(html) {
    super.activateListeners(html);
    html.find(".zs-btn").on("click", async (e) => {
      e.preventDefault();
      const action = e.currentTarget.dataset.action;
      await _handlePanelAction(this.templateId, action);
      this.render();
    });
  }
  async close(opts = {}) {
    _openPanels.delete(this.templateId);
    return super.close(opts);
  }
}

function _openPanel(templateId) {
  if (_openPanels.has(templateId)) { _openPanels.get(templateId).render(true); return; }
  const p = new ZoneSpellPanel(templateId);
  _openPanels.set(templateId, p);
  p.render(true);
}

function _closePanel(templateId) {
  _openPanels.get(templateId)?.close({ force: true });
}

async function _updatePanel(templateId) {
  const p = _openPanels.get(templateId);
  if (p) p.render();
}

function _renderPanelHTML(templateId) {
  const t = canvas.scene?.templates.get(templateId);
  const meta = t?.getFlag(MODULE_ID, FLAG_ZONE);
  if (!meta) return `<div style="padding:20px;color:#888">Zone nicht gefunden.</div>`;

  const tokensInside = _tokensInZone(t);
  const color = meta.spell === "auge-des-limbus" ? "#6b5b95"
              : meta.spell === "sumpfstrudel"    ? "#4a7c2a"
              : "#8b0000";
  const icon  = meta.spell === "auge-des-limbus" ? "👁"
              : meta.spell === "sumpfstrudel"    ? "🌊"
              : "🌿";
  const title = meta.spell === "auge-des-limbus" ? "AUGE DES LIMBUS"
              : meta.spell === "sumpfstrudel"    ? "SUMPFSTRUDEL"
              : "FESSELRANKEN";

  let specificInfo = "";
  if (meta.spell === "auge-des-limbus") {
    specificInfo = `
      <div style="padding:4px;background:rgba(107,91,149,0.2);border-radius:3px">
        <span style="color:#888;font-size:11px">Zugkraft</span><br>
        <strong>${meta.aspInvested}</strong> (−2/Schritt)
      </div>
      <div style="padding:4px;background:rgba(107,91,149,0.2);border-radius:3px">
        <span style="color:#888;font-size:11px">Zentrum-TP</span><br>
        <strong>${Math.floor(meta.aspInvested / 2)}</strong>
      </div>`;
  } else if (meta.spell === "sumpfstrudel") {
    specificInfo = `
      <div style="padding:4px;background:rgba(74,124,42,0.2);border-radius:3px">
        <span style="color:#888;font-size:11px">Talent-Erschwernis</span><br>
        <strong>+${meta.zfpStar}</strong>
      </div>
      <div style="padding:4px;background:rgba(74,124,42,0.2);border-radius:3px">
        <span style="color:#888;font-size:11px">TaP* Befreiung</span><br>
        <strong>${meta.zfpStar + Math.ceil(meta.radius)}</strong>
      </div>`;
  }

  return `<div style="padding:10px;background:linear-gradient(180deg,#1a1a1a,#0a0a0a);color:#e0c0a0;font-family:'VT323',monospace">
    <div style="font-size:18px;color:${color};text-align:center;margin-bottom:6px">${icon} ${title}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:13px;margin-bottom:8px">
      <div style="padding:4px;background:rgba(100,100,100,0.3);border-radius:3px">
        <span style="color:#888;font-size:11px">Radius</span><br>
        <strong>${meta.radius?.toFixed?.(1) ?? "?"}</strong>
      </div>
      <div style="padding:4px;background:rgba(100,100,100,0.3);border-radius:3px">
        <span style="color:#888;font-size:11px">Verbleibend</span><br>
        <strong style="color:#ffdd44">${meta.remainingRounds}</strong> KR
      </div>
      ${specificInfo}
      <div style="padding:4px;background:rgba(100,100,100,0.3);border-radius:3px;grid-column:span 2">
        <span style="color:#888;font-size:11px">Tokens in Zone</span><br>
        <strong>${tokensInside.length}</strong> ${tokensInside.map(t => t.name).join(", ").slice(0, 80)}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:6px">
      <button class="zs-btn" data-action="round" style="background:#2a2a4a;border:1px solid ${color};color:#ccc;padding:6px;cursor:pointer;border-radius:3px;font-family:'VT323',monospace;font-size:13px">
        ⚔ Runde ausfuehren
      </button>
      <button class="zs-btn" data-action="tick" style="background:#1a2a1a;border:1px solid #4a4a4a;color:#999;padding:6px;cursor:pointer;border-radius:3px;font-family:'VT323',monospace;font-size:13px">
        ⏱ 1 KR abziehen
      </button>
      ${meta.spell === "auge-des-limbus" ? `
      <button class="zs-btn" data-action="pullCheck" style="background:#2a2a4a;border:1px solid ${color};color:#ccc;padding:6px;cursor:pointer;border-radius:3px;font-family:'VT323',monospace;font-size:13px;grid-column:span 2">
        💨 KK-Probe (Sog) fuer ausgewaehltes Ziel
      </button>` : ""}
      ${meta.spell === "sumpfstrudel" ? `
      <button class="zs-btn" data-action="freeCheck" style="background:#2a4a2a;border:1px solid ${color};color:#ccc;padding:6px;cursor:pointer;border-radius:3px;font-family:'VT323',monospace;font-size:13px;grid-column:span 2">
        🏃 Befreiungs-Probe (Talent) fuer ausgewaehltes Ziel
      </button>` : ""}
    </div>
    <button class="zs-btn" data-action="end" style="width:100%;background:#2a2a1a;border:1px solid #8b8b00;color:#ffdd44;padding:6px;cursor:pointer;border-radius:3px;font-family:'VT323',monospace;font-size:13px">
      🛑 Zone vorzeitig beenden
    </button>
    <div style="font-size:10px;color:#666;margin-top:6px;line-height:1.4;border-top:1px solid rgba(255,255,255,0.1);padding-top:4px">
      ℹ "Runde ausfuehren" fuehrt alle Effekte fuer Tokens in Zone aus + zieht 1 KR ab.
    </div>
  </div>`;
}

async function _handlePanelAction(templateId, action) {
  switch (action) {
    case "round":     return _executeRound(templateId);
    case "tick":      return _tickRound(templateId);
    case "pullCheck": return _aolPullCheck(templateId);
    case "freeCheck": return _sumpfFreeCheck(templateId);
    case "end":       return _endZoneSpell(templateId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Runden-Tick ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

async function _tickRound(templateId) {
  const template = canvas.scene?.templates.get(templateId);
  const meta = template?.getFlag(MODULE_ID, FLAG_ZONE);
  if (!meta) return;
  meta.remainingRounds -= 1;
  if (meta.remainingRounds <= 0) { await _endZoneSpell(templateId); return; }
  await template.setFlag(MODULE_ID, FLAG_ZONE, meta);
  await _updatePanel(templateId);
}

async function _executeRound(templateId) {
  const template = canvas.scene?.templates.get(templateId);
  const meta = template?.getFlag(MODULE_ID, FLAG_ZONE);
  if (!meta) return;

  if (meta.spell === "auge-des-limbus") await _aolRound(template, meta);
  else if (meta.spell === "sumpfstrudel") await _sumpfRound(template, meta);
  else if (meta.spell === "fesselranken") await _fesselTick(template, meta);

  await _tickRound(templateId);
}

async function _endZoneSpell(templateId) {
  _stopZoneVFX(templateId);
  _closePanel(templateId);
  const template = canvas.scene?.templates.get(templateId);
  if (!template) return;

  const meta = template.getFlag(MODULE_ID, FLAG_ZONE);
  // Fesselranken: Flags auf Opfern entfernen
  if (meta?.spell === "fesselranken") {
    for (const actor of game.actors) {
      if (actor.getFlag(MODULE_ID, FLAG_FESSEL)?.templateId === templateId) {
        await actor.unsetFlag(MODULE_ID, FLAG_FESSEL);
      }
    }
  }
  // Sumpfstrudel: TaP*-Akkumulation auf Opfern entfernen
  if (meta?.spell === "sumpfstrudel") {
    for (const actor of game.actors) {
      if (actor.getFlag(MODULE_ID, FLAG_SUMPF)?.templateId === templateId) {
        await actor.unsetFlag(MODULE_ID, FLAG_SUMPF);
      }
    }
  }

  await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", [templateId]);

  ChatMessage.create({
    content: `<div class="dsa-pixel-chat"><div class="chat-title">🛑 ${meta?.spellName ?? "Zauber"} aufgeloest</div>
      <div class="result-line result-success">Die Zone loest sich auf.</div></div>`,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Helper: Selected Actor ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function _selectedActor() {
  const tokens = canvas.tokens?.controlled ?? [];
  if (tokens.length === 0) {
    ui.notifications.warn("Bitte zuerst einen Token selektieren.");
    return null;
  }
  return tokens[0].actor;
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── VFX-Loop ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function _startZoneVFX(template, effectName) {
  if (typeof DSAPixelTokens === "undefined") return;
  const id = template.id;
  if (_vfxIntervals.has(id)) return;
  const cx = template.x, cy = template.y;
  const doIt = () => {
    if (!canvas.scene?.templates.get(id)) { _stopZoneVFX(id); return; }
    DSAPixelTokens.spawnEffect?.(cx, cy, effectName);
  };
  doIt();
  _vfxIntervals.set(id, setInterval(doIt, 1800));
}

function _stopZoneVFX(id) {
  const iv = _vfxIntervals.get(id);
  if (iv) { clearInterval(iv); _vfxIntervals.delete(id); }
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── FESSELRANKEN ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export async function castFesselranken(caster, spellData, zfpStar, options = {}) {
  const target = [...(game.user?.targets ?? [])][0]?.actor;
  if (!target) {
    ui.notifications.warn("FESSELRANKEN: Ziel markieren!");
    return;
  }

  const dornen = options.dornen === true; // "Dornenfessel"-Variante
  const stabil = options.stabil === true;  // "Stabile Ranken"-Variante

  const statMali = Math.floor(zfpStar / 2); // -1 pro 2 ZfP*
  const rsBonus  = Math.floor(zfpStar / 3); // +1 pro 3 ZfP*

  await target.setFlag(MODULE_ID, FLAG_FESSEL, {
    zfpStar, statMali, rsBonus,
    dornen, stabil,
    remainingRounds: zfpStar,
    casterId: caster.id,
    initialSP: dornen ? (await new Roll("1d6").evaluate()).total : 0,
  });

  // Initialer Dornen-Schaden
  let initialLine = "";
  if (dornen) {
    const r = new Roll("1d6"); await r.evaluate();
    const sp = r.total;
    const cur = target.system?.LeP?.value ?? 0;
    await target.update({ "system.LeP.value": Math.max(0, cur - sp) });
    initialLine = `<div style="color:#e94560">🌹 Dornen: ${sp} SP initial</div>`;
  }

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: `<div class="dsa-pixel-chat">
      <div class="chat-title">🌿 FESSELRANKEN auf ${target.name}</div>
      <div style="font-size:13px;color:#aaa">
        ZfP*=${zfpStar} · ${zfpStar} KR · Stat-Mali −${statMali} · RS-Bonus +${rsBonus}
        ${stabil ? " · <span style='color:#c09040'>Stabile Ranken (KK+3)</span>" : ""}
        ${dornen ? " · <span style='color:#e94560'>Dornenfessel (1W6 ini + 2 SP/KR)</span>" : ""}
      </div>
      ${initialLine}
      <div style="font-size:11px;color:#888;margin-top:4px">
        Befreiung: KK-Probe pro KR (oder ${zfpStar * 2} Strukturschaden an Ranken).<br>
        Status: <code>DSAFesselKK()</code> fuer KK-Probe des selektierten Opfers.
      </div>
    </div>`,
  });
}

// Fesselranken-Zauber braucht keine Zone — pro-KR-Tick erfolgt ueber Auto-Combat-Hook
// (siehe registerHooks) ODER manuell via DSAFesselTick()

async function _fesselAutoTick(actor) {
  const state = actor.getFlag(MODULE_ID, FLAG_FESSEL);
  if (!state) return;
  state.remainingRounds -= 1;

  // Dornenfessel: +2 SP pro KR wenn Opfer aktiv ist (wir nehmen an: ja, solange gefesselt)
  if (state.dornen) {
    const cur = actor.system?.LeP?.value ?? 0;
    await actor.update({ "system.LeP.value": Math.max(0, cur - 2) });
  }

  if (state.remainingRounds <= 0) {
    await actor.unsetFlag(MODULE_ID, FLAG_FESSEL);
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="dsa-pixel-chat"><div class="chat-title">🌿 FESSELRANKEN loest sich auf</div>
        <div class="result-line result-success">${actor.name} ist frei.</div></div>`,
    });
  } else {
    await actor.setFlag(MODULE_ID, FLAG_FESSEL, state);
  }
}

// KK-Probe zur Befreiung
globalThis.DSAFesselKK = async () => {
  const actor = _selectedActor();
  if (!actor) return;
  const state = actor.getFlag(MODULE_ID, FLAG_FESSEL);
  if (!state) { ui.notifications.info(`${actor.name} ist nicht gefesselt.`); return; }

  const kk = actor.system?.KK?.value ?? 10;
  const erschwernis = state.stabil ? 3 : 0;
  const target = kk - erschwernis;
  const r = new Roll("1d20"); await r.evaluate();
  const success = r.total <= target;
  if (success) await actor.unsetFlag(MODULE_ID, FLAG_FESSEL);

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="dsa-pixel-chat">
      <div class="chat-title">💪 KK-Probe (FESSELRANKEN)</div>
      <div class="dice-row"><div class="die ${success ? "success" : "fail"}">${r.total}</div></div>
      <div class="dsa-mod-hint">KK ${kk}${erschwernis > 0 ? ` − ${erschwernis} (stabil)` : ""} = Ziel ${target}</div>
      <div class="result-line ${success ? "result-success" : "result-fail"}">
        ${success ? "Losgerissen!" : "Ranken halten stand"}
      </div>
    </div>`,
  });
};

// ═══════════════════════════════════════════════════════════════════════════
// ─── AUGE DES LIMBUS ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export async function castAugeDesLimbus(caster, spellData, zfpStar, options = {}) {
  const radius = options.radius ?? 3;
  const aspInvested = (new Roll("3d6").evaluate({async:false})?.total ?? 10) + 3 * radius;

  // AsP abziehen
  const curAsP = caster.system?.AsP?.value ?? 0;
  await caster.update({ "system.AsP.value": Math.max(0, curAsP - aspInvested) });

  const template = await _placeZoneTemplate(caster, radius, "#3a2a5a", "#8b6bd9");
  if (!template) return;

  await template.setFlag(MODULE_ID, FLAG_ZONE, {
    spell: "auge-des-limbus",
    spellName: "Auge des Limbus",
    casterId: caster.id,
    zfpStar,
    radius,
    aspInvested,
    remainingRounds: zfpStar,
  });

  _openPanel(template.id);
  _startZoneVFX(template, "planastral");

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: `<div class="dsa-pixel-chat" style="border:2px solid #6b5b95">
      <div class="chat-title" style="color:#8b6bd9">👁 AUGE DES LIMBUS</div>
      <div style="font-size:13px;color:#aaa">
        Radius ${radius} · ${aspInvested} AsP investiert · Zugkraft ${aspInvested} · ${zfpStar} KR<br>
        Zentrum-Schaden: ${Math.floor(aspInvested / 2)} TP
      </div>
    </div>`,
  });
}

async function _aolRound(template, meta) {
  const tokens = _tokensInZone(template);
  const gridSize = canvas.scene.grid?.size ?? 100;
  const cx = template.x, cy = template.y;

  for (const token of tokens) {
    const actor = token.actor;
    if (!actor) continue;
    // Zugkraft = aspInvested - 2×Schritte vom Zentrum
    const tcx = token.x + (token.width ?? 1) * gridSize / 2;
    const tcy = token.y + (token.height ?? 1) * gridSize / 2;
    const dist = Math.hypot(tcx - cx, tcy - cy) / gridSize; // in Schritten
    const zugkraft = Math.max(0, meta.aspInvested - 2 * dist);

    // Im Zentrum (dist < 1) → Schaden
    if (dist < 1) {
      const schaden = Math.floor(meta.aspInvested / 2);
      const cur = actor.system?.LeP?.value ?? 0;
      await actor.update({ "system.LeP.value": Math.max(0, cur - schaden) });
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="dsa-pixel-chat">
          <div class="chat-title">👁 ${actor.name} im Zentrum!</div>
          <div class="result-line result-fail">${schaden} TP (sphaerischer Schaden, RS ignoriert)</div>
        </div>`,
      });
      continue;
    }

    // KK-Probe erschwert um zugkraft
    const kk = actor.system?.KK?.value ?? 10;
    const target = kk - zugkraft;
    const r = new Roll("1d20"); await r.evaluate();
    const success = r.total <= target;

    let dragLine = "";
    if (!success) {
      // 1W6 Schritt zum Zentrum gezogen
      const pullRoll = new Roll("1d6"); await pullRoll.evaluate();
      const steps = pullRoll.total;
      // Neue Position: dist Schritte naeher zum Zentrum
      const angle = Math.atan2(tcy - cy, tcx - cx);
      const newDist = Math.max(0, dist - steps) * gridSize;
      const newX = cx + Math.cos(angle) * newDist - (token.width ?? 1) * gridSize / 2;
      const newY = cy + Math.sin(angle) * newDist - (token.height ?? 1) * gridSize / 2;
      await token.update({ x: newX, y: newY });
      dragLine = `<div style="color:#e94560">✘ KK ${r.total}>${target} · ${steps} Schritt zum Zentrum gezogen</div>`;
    } else {
      dragLine = `<div style="color:#4caf50">✓ KK ${r.total}≤${target} · haelt stand</div>`;
    }

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="dsa-pixel-chat">
        <div class="chat-title">👁 Sog (Auge des Limbus) — ${actor.name}</div>
        <div class="dsa-mod-hint">Zugkraft ${zugkraft} (${dist.toFixed(1)} Schritt Abstand)</div>
        ${dragLine}
      </div>`,
    });
  }
}

// Manuelle KK-Probe fuer selektiertes Token (wird ueber Panel-Button ausgeloest)
async function _aolPullCheck(templateId) {
  const actor = _selectedActor();
  if (!actor) return;
  const template = canvas.scene?.templates.get(templateId);
  const meta = template?.getFlag(MODULE_ID, FLAG_ZONE);
  if (!meta) return;

  const token = actor.getActiveTokens()[0];
  if (!token) return;
  const gridSize = canvas.scene.grid?.size ?? 100;
  const dist = Math.hypot(
    (token.center.x - template.x),
    (token.center.y - template.y)
  ) / gridSize;
  const zugkraft = Math.max(0, meta.aspInvested - 2 * dist);
  const kk = actor.system?.KK?.value ?? 10;
  const target = kk - zugkraft;
  const r = new Roll("1d20"); await r.evaluate();
  const success = r.total <= target;

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="dsa-pixel-chat">
      <div class="chat-title">👁 KK-Probe (Auge des Limbus) — ${actor.name}</div>
      <div class="dice-row"><div class="die ${success ? "success" : "fail"}">${r.total}</div></div>
      <div class="dsa-mod-hint">KK ${kk} − Zugkraft ${zugkraft.toFixed(1)} = Ziel ${target}</div>
      <div class="result-line ${success ? "result-success" : "result-fail"}">
        ${success ? "Haelt stand" : "Zum Zentrum gezogen (1W6 Schritt — manuell bewegen)"}
      </div>
    </div>`,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── SUMPFSTRUDEL ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export async function castSumpfstrudel(caster, spellData, zfpStar, options = {}) {
  const radius = options.radius ?? 3;
  const aspCost = 3 * radius;
  const erdranken = options.erdranken === true;

  const curAsP = caster.system?.AsP?.value ?? 0;
  await caster.update({ "system.AsP.value": Math.max(0, curAsP - aspCost) });

  const template = await _placeZoneTemplate(caster, radius, "#3a2a1a", "#6b5a3a");
  if (!template) return;

  await template.setFlag(MODULE_ID, FLAG_ZONE, {
    spell: "sumpfstrudel",
    spellName: "Sumpfstrudel",
    casterId: caster.id,
    zfpStar, radius,
    erdranken,
    remainingRounds: 30,
    tapRequired: zfpStar + Math.ceil(radius),
    tapErschwernis: zfpStar + (erdranken ? 5 : 0),
  });

  _openPanel(template.id);
  _startZoneVFX(template, "fesselranken");

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: `<div class="dsa-pixel-chat" style="border:2px solid #4a7c2a">
      <div class="chat-title" style="color:#6bba3a">🌊 SUMPFSTRUDEL</div>
      <div style="font-size:13px;color:#aaa">
        Radius ${radius} · ${aspCost} AsP · 30 KR · Befreiung ${zfpStar + Math.ceil(radius)} TaP* (Talent −${zfpStar})
        ${erdranken ? "<br><span style='color:#e94560'>Erdranken: 1W6+1 TP pro KR, Talent +5 erschwert</span>" : ""}
      </div>
    </div>`,
  });
}

async function _sumpfRound(template, meta) {
  const tokens = _tokensInZone(template);
  for (const token of tokens) {
    const actor = token.actor;
    if (!actor) continue;
    // Bereits befreit?
    const state = actor.getFlag(MODULE_ID, FLAG_SUMPF);
    if (state?.freed) continue;

    // Erdranken: 1W6+1 TP
    if (meta.erdranken) {
      const r = new Roll("1d6+1"); await r.evaluate();
      const rs = _getZoneRS(actor, "bauch"); // Dornen greifen am Koerper
      const sp = Math.max(0, r.total - rs);
      const cur = actor.system?.LeP?.value ?? 0;
      await actor.update({ "system.LeP.value": Math.max(0, cur - sp) });
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="dsa-pixel-chat"><div class="chat-title">🌊 Erdranken greifen ${actor.name}</div>
          <div class="result-line result-fail">${r.total} TP − ${rs} RS = ${sp} SP</div></div>`,
      });
    }
  }
  ui.notifications.info(`Sumpfstrudel: ${tokens.length} Token betroffen. Einzelne muessen "Befreiungs-Probe" Button druecken.`);
}

async function _sumpfFreeCheck(templateId) {
  const actor = _selectedActor();
  if (!actor) return;
  const template = canvas.scene?.templates.get(templateId);
  const meta = template?.getFlag(MODULE_ID, FLAG_ZONE);
  if (!meta) return;

  let state = actor.getFlag(MODULE_ID, FLAG_SUMPF) ?? { templateId, tapAccumulated: 0, freed: false };
  if (state.freed) { ui.notifications.info(`${actor.name} ist bereits befreit.`); return; }

  // Wir simulieren vereinfacht: Koerperbeherrschung (oder KO-Probe als Fallback)
  const skill = actor.system?.skill?.Koerperbeherrschung ??
                actor.system?.skill?.Reiten ??
                actor.system?.skill?.["Fahrzeug Lenken"];
  const taw = Number(skill?.value ?? 5);
  const ko = actor.system?.KO?.value ?? 10;

  // Vereinfachte 3W20-Probe auf KO/KO/KO mit Erschwernis = meta.tapErschwernis
  const d1 = (await new Roll("1d20").evaluate()).total;
  const d2 = (await new Roll("1d20").evaluate()).total;
  const d3 = (await new Roll("1d20").evaluate()).total;
  const t = ko - meta.tapErschwernis;
  let tap = taw;
  for (const d of [d1, d2, d3]) { if (d > t) tap -= (d - t); }
  const success = tap >= 0;

  // 1W6 SP(A) — Ausdauer
  const spRoll = new Roll("1d6"); await spRoll.evaluate();
  const aup = actor.system?.AuP?.value ?? 0;
  const newAuP = Math.max(0, aup - spRoll.total);
  await actor.update({ "system.AuP.value": newAuP });

  if (success) {
    state.tapAccumulated += tap;
  } else {
    const loss = new Roll("1d6"); await loss.evaluate();
    state.tapAccumulated -= loss.total;
  }

  if (state.tapAccumulated >= meta.tapRequired) {
    state.freed = true;
  }
  await actor.setFlag(MODULE_ID, FLAG_SUMPF, state);

  const erstickung = newAuP === 0 ? `<div style="color:#ff0000;font-weight:bold">☠ AuP auf 0 — Erstickung beginnt!</div>` : "";

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="dsa-pixel-chat">
      <div class="chat-title">🌊 Befreiungs-Probe (Sumpfstrudel) — ${actor.name}</div>
      <div class="dice-row">
        <div class="die">${d1}</div><div class="die">${d2}</div><div class="die">${d3}</div>
      </div>
      <div class="dsa-mod-hint">Talent ${taw} gg KO ${ko} − ${meta.tapErschwernis} Erschwernis · TaP: ${tap}</div>
      <div class="result-line ${success ? "result-success" : "result-fail"}">
        ${success ? `+${tap} TaP*` : `Misslungen: −${spRoll.total} TaP*`}
        · Akkumuliert: ${state.tapAccumulated}/${meta.tapRequired}
      </div>
      <div style="font-size:12px;color:#888">1W6 AuP Verlust: ${spRoll.total} → ${newAuP}/${actor.system?.AuP?.max ?? "?"}</div>
      ${state.freed ? `<div style="color:#4caf50;font-weight:bold">✓ BEFREIT!</div>` : ""}
      ${erstickung}
    </div>`,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Fesselranken-Tick (wenn als Zone behandelt) ────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

async function _fesselTick(_template, _meta) {
  // Fesselranken ist ein Einzel-Ziel-Zauber, kein Zone-Zauber. Tick uebernimmt Auto-Combat-Hook.
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Hook-Registrierung ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export function registerZoneSpellHooks() {
  // Template geloescht → VFX + Panel schliessen
  Hooks.on("deleteMeasuredTemplate", (template) => {
    if (!template.getFlag(MODULE_ID, FLAG_ZONE)) return;
    _stopZoneVFX(template.id);
    _closePanel(template.id);
  });

  // Szene-Wechsel → VFX neu aufsetzen
  Hooks.on("canvasReady", () => {
    for (const id of [..._vfxIntervals.keys()]) _stopZoneVFX(id);
    for (const id of [..._openPanels.keys()]) _openPanels.get(id)?.close({ force: true });
    _openPanels.clear();
    const templates = canvas.scene?.templates ?? [];
    for (const t of templates) {
      const meta = t.getFlag(MODULE_ID, FLAG_ZONE);
      if (!meta) continue;
      const fx = meta.spell === "auge-des-limbus" ? "planastral"
              : meta.spell === "sumpfstrudel"    ? "fesselranken" : "brennen";
      _startZoneVFX(t, fx);
    }
  });

  // Auto-Tick pro Kampfrunde fuer alle Zonen-Zauber + Fesselranken
  Hooks.on("updateCombat", async (combat, changes) => {
    if (!game.user.isGM) return;
    if (changes.round === undefined) return;

    // Zonen-Zauber automatisch
    const templates = canvas.scene?.templates.filter(t => t.getFlag(MODULE_ID, FLAG_ZONE)) ?? [];
    for (const template of templates) {
      const meta = template.getFlag(MODULE_ID, FLAG_ZONE);
      if (meta.spell === "auge-des-limbus") await _aolRound(template, meta);
      else if (meta.spell === "sumpfstrudel") await _sumpfRound(template, meta);
      await _tickRound(template.id);
    }

    // Fesselranken auf allen Actors (auch ohne Zone)
    for (const actor of game.actors) {
      if (actor.getFlag(MODULE_ID, FLAG_FESSEL)) {
        await _fesselAutoTick(actor);
      }
    }
  });

  // Helper-Makro: offene Zonen-Panels neu oeffnen
  globalThis.DSAZonenZauber = () => {
    const templates = canvas.scene?.templates.filter(t => t.getFlag(MODULE_ID, FLAG_ZONE)) ?? [];
    if (!templates.length) { ui.notifications.info("Keine aktive Zone."); return; }
    for (const t of templates) _openPanel(t.id);
  };

  console.log(`[${MODULE_ID}] ✓ Zone-Spells (Fesselranken/Auge des Limbus/Sumpfstrudel) registriert`);
}
