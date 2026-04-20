/**
 * DSA Pixel-Art Tokens — PANDAEMONIUM Zauber (Token-basiert v2)
 *
 * Liber Cantiones Remastered S.218 — Hexischer D-Komplexitaets-Zauber.
 *
 * Neue Architektur:
 *  - Pro Zauberung wird ein temporaerer Cluster-Actor erstellt (abhaengig von ZfPStern)
 *    mit 3 Skills (Krallen/Tentakel/Maul) und gebuendelten LeP
 *  - Pro Rechtschritt Zonenflaeche wird EIN unlinked Cluster-Token gespawnt
 *    (= 1 Token = ZfPStern Krallen + ZfPStern-halbe Tentakel + 1 Maul)
 *  - Jedes Token hat eigene LeP (max = (ZfPStern + ZfPStern-halbe + 1) x 10)
 *  - Pro 10 LeP Verlust stirbt 1 Erscheinung (Reihenfolge: Krallen → Tentakel → Maul)
 *  - Cluster bei 0 LeP → Token wird geloescht (Schneise geschlagen!)
 *  - Reichweite = Token-Nachbarschaft (Foundry-nativ)
 *  - Wirkungsdauer ZfP* Kampfrunden → alle Cluster-Tokens + Zone despawn
 *  - Geweihte Waffen: 2x Schaden (Standard DSA-Waffenkampf ueber Counter-Angriff)
 */

import { MODULE_ID, HIT_ZONE_TABLE, ZONE_LABELS, getWoundThresholds } from "./config.mjs";
import { moveActorToCategoryFolder } from "./actor-folders.mjs";

// ─── Constants ──────────────────────────────────────────────────────────────

const FLAG_TEMPLATE       = "pandaemoniumZone";     // Auf MeasuredTemplate
const FLAG_CLUSTER_TOKEN  = "pandaemoniumCluster";  // Auf Token (Counts, templateId)
const FLAG_ACTOR_MARKER   = "pandaemoniumActor";    // Auf Actor (isPdCluster + zfpStar)
const FLAG_GRAPPLE        = "pandaemoniumGrapple";  // Auf Actor (Held ist festgehalten)
const CHAT_PANEL_FLAG     = "pandaemoniumPanel";    // Auf ChatMessage

const PLACEHOLDER_IMG = "modules/dsa-pixel-tokens/assets/monsters/pandaemonium_cluster.png";

// Laufzeit-Map: templateId → intervalId fuer VFX-Loop
const _vfxIntervals = new Map();

// Laufzeit-Map: templateId → PandaemoniumPanel instance
const _openPanels = new Map();

// ═══════════════════════════════════════════════════════════════════════════
// ─── Pandaemonium Control Panel (Popout Application) ───────────────────────
// ═══════════════════════════════════════════════════════════════════════════

class PandaemoniumPanel extends Application {
  constructor(templateId, options = {}) {
    super(options);
    this.templateId = templateId;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["dsa-pixel-sheet", "pandaemonium-panel"],
      title: "🔥 PANDAEMONIUM",
      template: null,
      popOut: true,
      width: 420,
      height: "auto",
      minimizable: true,
      resizable: false,
    });
  }

  get id() { return `pd-panel-${this.templateId}`; }

  async _renderInner(_data) {
    return $(`<div class="window-content">${_renderPanelHTML(this.templateId)}</div>`);
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find(".pd-btn").on("click", async (e) => {
      e.preventDefault();
      const action = e.currentTarget.dataset.action;
      switch (action) {
        case "mut":    await _handleMutProbe(this.templateId); break;
        case "attack": await _rollClusterAttacksForRound(this.templateId); break;
        case "kk":     await _handleKK(this.templateId); break;
        case "tick":   await _handleTick(this.templateId); break;
        case "end":    await _endZone(this.templateId); return; // Fenster wird in _endZone geschlossen
      }
      this.render(); // re-render nach Aktion (Token-Counter updaten etc.)
    });
  }

  // Ueberschreibe close: nur schliessen, nicht die Zone zerstoeren
  async close(options = {}) {
    _openPanels.delete(this.templateId);
    return super.close(options);
  }
}

function _openControlPanel(templateId) {
  if (_openPanels.has(templateId)) {
    _openPanels.get(templateId).render(true);
    return;
  }
  const panel = new PandaemoniumPanel(templateId);
  _openPanels.set(templateId, panel);
  panel.render(true);
}

function _closeControlPanel(templateId) {
  const panel = _openPanels.get(templateId);
  if (panel) {
    panel.close({ force: true });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Haupt-Entry ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export async function castPandaemonium(caster, spellData, zfpStar, borVariant = false) {
  if (zfpStar <= 0) return;

  const zoneOpts = await _showZoneDialog(caster, zfpStar, borVariant);
  if (!zoneOpts) return;

  const { rechtschritt, aspCost, lepCost, radius } = zoneOpts;

  // AsP/LeP abziehen
  if (aspCost > 0) {
    const cur = caster.system?.AsP?.value ?? 0;
    await caster.update({ "system.AsP.value": Math.max(0, cur - aspCost) });
  }
  if (lepCost > 0) {
    const cur = caster.system?.LeP?.value ?? 0;
    await caster.update({ "system.LeP.value": Math.max(0, cur - lepCost) });
  }

  // Cluster-Actor vorbereiten (einer pro ZfP*-Wert)
  const clusterActor = await _getOrCreateClusterActor(zfpStar);

  // Zone-Template platzieren
  const template = await _placeZoneTemplate(caster, radius);
  if (!template) return;

  // Template-Flag: Zone-Metadata
  await template.setFlag(MODULE_ID, FLAG_TEMPLATE, {
    casterId:        caster.id,
    spellName:       spellData.name,
    zfpStar:         zfpStar,
    rechtschritt:    rechtschritt,
    remainingRounds: zfpStar,
    clusterActorId:  clusterActor.id,
  });

  // Cluster-Tokens spawnen (1 pro Rechtschritt)
  const spawnedTokens = await _spawnClusterTokens(template, clusterActor, zfpStar, rechtschritt);

  // Popout-Fenster oeffnen (statt Chat)
  _openControlPanel(template.id);
  // Kurze Info-Nachricht im Chat (ohne die ganzen Buttons)
  await _postChatInfo(template.id, {
    zfpStar, rechtschritt, remainingRounds: zfpStar,
    totalTokens: spawnedTokens.length,
    spellName: spellData.name,
  }, caster);

  // Loopender VFX
  _startZoneVFX(template);
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Cluster-Actor (einmal pro ZfP*-Wert) ───────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

async function _getOrCreateClusterActor(zfpStar) {
  const name = `Pandaemonium-Cluster (ZfP* ${zfpStar})`;
  const existing = game.actors.find(a => a.getFlag(MODULE_ID, FLAG_ACTOR_MARKER)?.zfpStar === zfpStar);
  if (existing) return existing;

  const nKrallen  = zfpStar;
  const nTentakel = Math.floor(zfpStar / 2);
  const nMaul     = 1;
  const maxLeP    = (nKrallen + nTentakel + nMaul) * 10;

  const actor = await Actor.create({
    name,
    type: "PlayerCharakter",
    img: PLACEHOLDER_IMG,
    system: {
      MU: 0, KL: 0, IN: 0, CH: 0, FF: 0, GE: 0, KO: 10, KK: 0,
      LeP: { value: maxLeP, max: maxLeP },
      AuP: { value: 0, max: 0 },
      AsP: { value: 0, max: 0 },
      KaP: { value: 0, max: 0 },
      GS:  { value: 0, modi: 0, temp: 0, pen: 0 },
      MR:  { value: 10, modi: 0, tempmodi: 0, buy: 0 },
      RS: 2,
      Dogde: 0,
      INIBasis: { value: 5, modi: 0, tempmodi: 0, sysModi: 0 },
      INIDice: "1d6",
      ATBasis: { value: 7, tempmodi: 0 },
      PABasis: { value: 0, tempmodi: 0 },
      FKBasis: { value: 0, tempmodi: 0 },
    },
    prototypeToken: {
      name: `Pandaemonium (${nKrallen}🪝 ${nTentakel}🐙 ${nMaul}👹)`,
      texture: { src: PLACEHOLDER_IMG },
      width: 1, height: 1,
      actorLink: false, // WICHTIG: unlinked → jeder Cluster hat eigene LeP
      disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
      displayName: CONST.TOKEN_DISPLAY_MODES.HOVER,
      displayBars: CONST.TOKEN_DISPLAY_MODES.ALWAYS,
      bar1: { attribute: "LeP" },
    },
    flags: {
      [MODULE_ID]: {
        [FLAG_ACTOR_MARKER]: { isPdCluster: true, zfpStar, nKrallen, nTentakel, nMaul, maxLeP },
        creature: {
          abilities: [
            `Erscheinungs-Cluster: ${nKrallen} Krallenhaende + ${nTentakel} Tentakel + ${nMaul} Maul`,
            "Keine Parade — nur 10 LeP pro Erscheinung",
            "Geweihte Waffen verursachen 2x Schaden",
            "Bei natuerlicher 1 auf Angriff: Held wird festgehalten (KK-Probe zum Loesen)",
          ],
          weapons: [
            { name: "Krallen", atk: 7, def: 0, tp: "1W6",   special: "" },
            { name: "Tentakel", atk: 7, def: 0, tp: "1W6+2", special: "" },
            { name: "Maul",    atk: 7, def: 0, tp: "2W6",   special: "" },
          ],
          actionsPerRound: nKrallen + nTentakel + nMaul,
          size: "mittel",
          domain: "Pandaemonium",
          rs: 2,
        },
      },
    },
  });

  // Skills (Kampftalente) nachtragen via update (damit das Sheet sie sieht)
  await actor.update({
    "system.skill.Krallen":  { value: 7, atk: 7, def: 0, tp: "1W6",   special: "Nahkampf H" },
    "system.skill.Tentakel": { value: 7, atk: 7, def: 0, tp: "1W6+2", special: "Reichweite 2m" },
    "system.skill.Maul":     { value: 7, atk: 7, def: 0, tp: "2W6",   special: "Verbeissen auf 1" },
  });

  // In Pandaemonium-Ordner einsortieren
  try { await moveActorToCategoryFolder(actor); } catch {}

  return actor;
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Zone-Dialog ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

async function _showZoneDialog(caster, zfpStar, borVariant) {
  const content = `
    <div class="dsa-mod-dialog" style="padding:10px;color-scheme:dark">
      <div class="dsa-mod-title">🔥 PANDAEMONIUM — Zone platzieren</div>
      <div style="font-size:13px;color:#888;margin:6px 0">
        ZfP* = <strong style="color:#e94560">${zfpStar}</strong> · Wirkungsdauer: <strong>${zfpStar} Kampfrunden</strong>
      </div>
      <div style="margin:8px 0">
        <label style="font-family:'VT323',monospace;font-size:14px;color:#bbb">Zonen-Groesse (Rechtschritt):</label>
        <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
          <input type="number" id="pd-rs" value="9" min="1" max="200"
            style="width:80px;text-align:center;font-family:'VT323',monospace;font-size:18px;background:rgba(0,0,0,0.4);border:2px solid #e94560;color:#e94560" />
          <span style="color:#666;font-size:12px">= <span id="pd-radius">?</span> Schritt Radius · <span id="pd-tokens">?</span> Cluster-Tokens</span>
        </div>
      </div>
      <div style="margin:8px 0;padding:6px;background:rgba(233,69,96,0.1);border:1px solid rgba(233,69,96,0.3);border-radius:3px;font-size:12px">
        <div id="pd-cost" style="color:#e94560"></div>
        <div id="pd-stats" style="color:#c09040;margin-top:2px"></div>
        ${borVariant ? `<div style="color:#a855f7;margin-top:2px">Borbaradianische Variante: LeP-Kosten-Option</div>` : ""}
      </div>
    </div>`;

  return new Promise(resolve => {
    new Dialog({
      title: "PANDAEMONIUM",
      content,
      buttons: {
        place: {
          icon: '<i class="fas fa-magic"></i>', label: "Zone + Tokens platzieren",
          callback: html => {
            const rs = parseInt(html.find("#pd-rs").val()) || 10;
            resolve(_calcZoneOpts(rs, zfpStar, borVariant));
          },
        },
        cancel: { label: "Abbruch", callback: () => resolve(null) },
      },
      default: "place",
      close: () => resolve(null),
      render: (html) => {
        const update = () => {
          const rs = parseInt(html.find("#pd-rs").val()) || 10;
          const opts = _calcZoneOpts(rs, zfpStar, borVariant);
          html.find("#pd-radius").text(opts.radius.toFixed(1));
          html.find("#pd-tokens").text(rs);
          html.find("#pd-cost").html(
            borVariant
              ? `Kosten (Bor): ${opts.aspCost} AsP oder ${opts.lepCost} LeP`
              : `Kosten: <strong>${opts.aspCost} AsP</strong> · Probe-Erschwernis: +${Math.ceil(rs/10)}`
          );
          const perCluster = zfpStar + Math.floor(zfpStar/2) + 1;
          html.find("#pd-stats").html(
            `Pro Cluster: ${zfpStar}🪝 ${Math.floor(zfpStar/2)}🐙 1👹 = ${perCluster} Erscheinungen · ${perCluster*10} LeP`
          );
        };
        html.find("#pd-rs").on("input change", update);
        update();
      },
    }).render(true);
  });
}

function _calcZoneOpts(rechtschritt, zfpStar, borVariant) {
  let aspCost, lepCost = 0;
  if (borVariant) {
    aspCost = Math.ceil(rechtschritt / 10) + 3;
    lepCost = Math.ceil(aspCost / 2);
  } else {
    aspCost = 11 + Math.ceil(rechtschritt / 10);
  }
  const radius = Math.max(1, Math.sqrt(rechtschritt / Math.PI));
  return { rechtschritt, aspCost, lepCost, radius };
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Zone-Template ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

async function _placeZoneTemplate(caster, radius) {
  const targetToken = [...(game.user?.targets ?? [])][0];
  const casterToken = caster.getActiveTokens()[0];

  let cx, cy;
  if (targetToken) {
    cx = targetToken.center.x; cy = targetToken.center.y;
  } else if (casterToken) {
    cx = casterToken.center.x; cy = casterToken.center.y;
    ui.notifications.info("Kein Ziel — Zone startet beim Zauberer. Zum Zielort ziehen.");
  } else {
    cx = canvas.dimensions.width / 2; cy = canvas.dimensions.height / 2;
  }

  const [template] = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [{
    t: "circle", x: cx, y: cy, distance: radius,
    fillColor: "#8b0000", borderColor: "#ff0000",
  }]);

  canvas.templates.activate();
  if (template) {
    const placeable = canvas.templates.get(template.id);
    if (placeable) placeable.control({ releaseOthers: true });
  }
  return template;
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Cluster-Token im Raster spawnen ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

async function _spawnClusterTokens(template, clusterActor, zfpStar, rechtschritt) {
  const scene = canvas.scene;
  const gridSize = scene.grid?.size ?? 100;
  const positions = _generateGridPositions(template, rechtschritt, gridSize);

  const nKrallen  = zfpStar;
  const nTentakel = Math.floor(zfpStar / 2);
  const nMaul     = 1;
  const maxLeP    = (nKrallen + nTentakel + nMaul) * 10;

  const tokenData = positions.map((pos, idx) => ({
    name: `Pandaemonium #${idx + 1}`,
    x: pos.x, y: pos.y,
    width: 1, height: 1,
    actorId: clusterActor.id,
    actorLink: false, // unlinked = individuelle LeP pro Token
    texture: { src: PLACEHOLDER_IMG },
    disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
    displayName: CONST.TOKEN_DISPLAY_MODES.HOVER,
    displayBars: CONST.TOKEN_DISPLAY_MODES.ALWAYS,
    bar1: { attribute: "LeP" },
    flags: {
      [MODULE_ID]: {
        [FLAG_CLUSTER_TOKEN]: {
          templateId: template.id,
          zfpStar,
          krallenCount:  nKrallen,
          tentakelCount: nTentakel,
          maulCount:     nMaul,
          initialKrallen:  nKrallen,
          initialTentakel: nTentakel,
          initialMaul:     nMaul,
          maxLeP,
        },
      },
    },
    // Individuelle LeP fuer jedes Token (unlinked delta)
    delta: {
      system: { LeP: { value: maxLeP, max: maxLeP } },
    },
  }));

  return await scene.createEmbeddedDocuments("Token", tokenData);
}

// Generiere N Grid-Positionen innerhalb des Kreis-Templates
function _generateGridPositions(template, count, gridSize) {
  const cx = template.x;
  const cy = template.y;
  const radiusPx = (template.distance ?? 2) * gridSize;
  const positions = [];

  // Spiral-Ausbreitung vom Zentrum
  const maxRing = Math.ceil(Math.sqrt(count / Math.PI)) + 2;
  for (let ring = 0; ring <= maxRing && positions.length < count; ring++) {
    if (ring === 0) {
      if (positions.length < count) positions.push({ x: cx - gridSize / 2, y: cy - gridSize / 2 });
      continue;
    }
    // Ring-Positionen: Schachbrett um das Zentrum
    for (let dy = -ring; dy <= ring && positions.length < count; dy++) {
      for (let dx = -ring; dx <= ring && positions.length < count; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const px = cx + dx * gridSize;
        const py = cy + dy * gridSize;
        const dist = Math.hypot(px - cx, py - cy);
        if (dist <= radiusPx + gridSize * 0.5) {
          positions.push({ x: px - gridSize / 2, y: py - gridSize / 2 });
        }
      }
    }
  }
  return positions;
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── LeP-Hook: Wenn LeP sinkt, Counts anpassen ──────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

async function _onClusterTokenDamaged(tokenDoc, oldLeP, newLeP) {
  const clusterFlag = tokenDoc.getFlag(MODULE_ID, FLAG_CLUSTER_TOKEN);
  if (!clusterFlag) return;

  const { initialKrallen, initialTentakel, initialMaul, maxLeP } = clusterFlag;
  const totalInitial = initialKrallen + initialTentakel + initialMaul;

  // Total Erscheinungen verbleibend = aufgerundet(currentLeP / 10)
  const totalRemaining = Math.max(0, Math.ceil(newLeP / 10));
  const lost = totalInitial - totalRemaining;

  // Sterbe-Reihenfolge: Krallen → Tentakel → Maul (schwaechste zuerst)
  const krallenLost  = Math.min(initialKrallen, lost);
  const tentakelLost = Math.min(initialTentakel, Math.max(0, lost - initialKrallen));
  const maulLost     = Math.max(0, lost - initialKrallen - initialTentakel);

  const newKrallen  = Math.max(0, initialKrallen  - krallenLost);
  const newTentakel = Math.max(0, initialTentakel - tentakelLost);
  const newMaul     = Math.max(0, initialMaul     - maulLost);

  await tokenDoc.setFlag(MODULE_ID, FLAG_CLUSTER_TOKEN, {
    ...clusterFlag,
    krallenCount: newKrallen,
    tentakelCount: newTentakel,
    maulCount: newMaul,
  });

  // Token-Name aktualisieren (zeigt Restanzahl)
  const newName = `Pandaemonium (${newKrallen}🪝 ${newTentakel}🐙 ${newMaul}👹)`;
  await tokenDoc.update({ name: newName });

  // Panel re-rendern (Cluster-Count aktualisieren)
  await _updatePanel(clusterFlag.templateId);

  // Wenn alle Erscheinungen tot → Token loeschen
  if (newKrallen + newTentakel + newMaul === 0) {
    ChatMessage.create({
      content: `<div class="dsa-pixel-chat">
        <div class="chat-title">💀 Cluster zerschlagen</div>
        <div class="result-line result-success">Ein Pandaemonium-Cluster wurde vollstaendig vernichtet.</div>
      </div>`,
    });
    await canvas.scene.deleteEmbeddedDocuments("Token", [tokenDoc.id]);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Multi-Attack pro Kampfrunde ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

async function _rollClusterAttacksForRound(templateId) {
  const template = canvas.scene?.templates.get(templateId);
  if (!template) return;

  const tokens = canvas.scene.tokens.filter(t =>
    t.getFlag(MODULE_ID, FLAG_CLUSTER_TOKEN)?.templateId === templateId
  );
  if (tokens.length === 0) return;

  const gridSize = canvas.scene.grid?.size ?? 100;

  // Pro Cluster-Token: finde angrenzende feindliche Tokens (Helden)
  let attacksTotal = 0;
  const chatLines = [];
  for (const clusterToken of tokens) {
    const cluster = clusterToken.getFlag(MODULE_ID, FLAG_CLUSTER_TOKEN);
    if (!cluster || cluster.krallenCount + cluster.tentakelCount + cluster.maulCount === 0) continue;

    // Cluster-Zentrum berechnen (Token.x/y ist top-left)
    const cW = (clusterToken.width ?? 1) * gridSize;
    const cH = (clusterToken.height ?? 1) * gridSize;
    const cCx = clusterToken.x + cW / 2;
    const cCy = clusterToken.y + cH / 2;

    const neighbors = canvas.scene.tokens.filter(t => {
      if (t.id === clusterToken.id) return false;
      if (t.getFlag(MODULE_ID, FLAG_CLUSTER_TOKEN)) return false; // andere Cluster ignorieren
      if (!t.actor) return false;
      // Disposition-Filter: Pandaemonium trifft ALLE Wesen (auch feindliche NPCs).
      // Wir filtern nichts — nur andere Cluster + Token ohne Actor.

      // Center-zu-Center Distanz (Toleranz: 1.5 Grid-Felder = angrenzend + Buffer)
      const tW = (t.width ?? 1) * gridSize;
      const tH = (t.height ?? 1) * gridSize;
      const tCx = t.x + tW / 2;
      const tCy = t.y + tH / 2;
      // Distanz minus halbe Token-Groessen → effektiver Rand-zu-Rand-Abstand
      const dx = Math.abs(tCx - cCx) - (tW + cW) / 2;
      const dy = Math.abs(tCy - cCy) - (tH + cH) / 2;
      const edgeDx = Math.max(0, dx);
      const edgeDy = Math.max(0, dy);
      // Angrenzend wenn beide Rand-Abstaende <= 1 Grid-Feld (mit kleinem Buffer)
      return edgeDx <= gridSize * 1.1 && edgeDy <= gridSize * 1.1;
    });

    if (neighbors.length === 0) continue;

    // Fuer jeden angrenzenden Held: alle Cluster-Attacken rollen
    for (const heroToken of neighbors) {
      const result = await _rollClusterAttacksOnHero(clusterToken, cluster, heroToken.actor);
      attacksTotal += result.attackCount;
      chatLines.push(result.html);
    }
  }

  if (chatLines.length > 0) {
    ChatMessage.create({
      content: `<div class="dsa-pixel-chat">
        <div class="chat-title">⚔ PANDAEMONIUM — Cluster-Angriffe (Runde)</div>
        <div style="font-size:12px;color:#888;text-align:center;margin:4px 0">${attacksTotal} Angriffe insgesamt</div>
        ${chatLines.join("")}
      </div>`,
    });
  } else {
    ui.notifications.info("Keine Helden angrenzend — keine Cluster-Angriffe.");
  }
}

// Zonen-RS eines Helden/Targets berechnen (Ruestung + Kreatur-Naturpanzer)
function _getZoneRS(actor, zone) {
  if (!actor) return 0;
  // Kreatur: Flag-RS (alle Zonen gleich)
  const creatureFlag = actor.getFlag(MODULE_ID, "creature");
  if (creatureFlag?.rs !== undefined) return creatureFlag.rs;
  // Spielercharakter: Zonen-RS aus angelegten Ruestungs-Items
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
    } else if (t === "armor" || t === "rüstung" || t === "ruestung") {
      const dbEntry = armorDb.find(a => a.name.toLowerCase() === item.name.toLowerCase());
      if (zone && dbEntry?.zones?.[zone] !== undefined) {
        zoneRS += dbEntry.zones[zone];
      } else {
        zoneRS += (sys.rs ?? 0);
      }
    }
  }
  return zoneRS;
}

async function _rollClusterAttacksOnHero(clusterToken, cluster, heroActor) {
  const grappled = heroActor.getFlag(MODULE_ID, FLAG_GRAPPLE) === true;
  const types = [
    { name: "krallenhand", count: cluster.krallenCount, label: "🪝 Krallen", tpF: "1d6",   at: 7, atG: 9 },
    { name: "tentakel",    count: cluster.tentakelCount, label: "🐙 Tentakel", tpF: "1d6+2", at: 7, atG: 9 },
    { name: "maul",        count: cluster.maulCount,     label: "👹 Maul",     tpF: "2d6",   at: 7, atG: 9 },
  ];

  let totalSP = 0;
  let newGrapple = grappled;
  const lines = [];
  let attackCount = 0;

  for (const t of types) {
    for (let i = 0; i < t.count; i++) {
      attackCount++;
      const atVal = grappled ? t.atG : t.at;
      const r = new Roll("1d20"); await r.evaluate();
      const die = r.total;
      const hit = die <= atVal;
      const grappleNow = die === 1 && hit;
      if (hit) {
        const tp = new Roll(t.tpF); await tp.evaluate();
        // Pro Attacke: eigene Trefferzone wuerfeln + dort Ruestung verwenden
        const zR = new Roll("1d20"); await zR.evaluate();
        const zoneKey = HIT_ZONE_TABLE[zR.total] ?? "brust";
        const zoneLabel = ZONE_LABELS[zoneKey] ?? zoneKey;
        const heroRS = _getZoneRS(heroActor, zoneKey);
        const sp = Math.max(0, tp.total - heroRS);
        totalSP += sp;
        if (grappleNow) newGrapple = true;
        lines.push(`<div style="font-size:11px">${t.label}: AT ${die}≤${atVal} ✓ · ${tp.total} TP → <span style="color:#7eb8ff">${zoneLabel}</span> (RS ${heroRS}) = <strong style="color:#e94560">${sp} SP</strong>${grappleNow ? ' · <span style="color:#ffdd44">FESTHALTEN</span>' : ''}</div>`);
      } else {
        lines.push(`<div style="font-size:11px;color:#555">${t.label}: AT ${die}>${atVal} ✗</div>`);
      }
    }
  }

  if (totalSP > 0) {
    const oldLeP = heroActor.system?.LeP?.value ?? 0;
    const newLeP = Math.max(0, oldLeP - totalSP);
    await heroActor.update({ "system.LeP.value": newLeP });

    // Wund-Check
    const ko = heroActor.system?.KO?.value ?? 10;
    const ws = getWoundThresholds(ko);
    if (totalSP >= ws.ws1) {
      const nw = totalSP >= ws.ws3 ? 3 : totalSP >= ws.ws2 ? 2 : 1;
      const zR = new Roll("1d20"); await zR.evaluate();
      const z = HIT_ZONE_TABLE[zR.total] ?? "brust";
      const wounds = heroActor.getFlag(MODULE_ID, "wounds") ?? {};
      wounds[z] = (wounds[z] ?? 0) + nw;
      await heroActor.setFlag(MODULE_ID, "wounds", wounds);
    }
  }

  if (newGrapple !== grappled) {
    await heroActor.setFlag(MODULE_ID, FLAG_GRAPPLE, newGrapple);
  }

  return {
    attackCount,
    html: `<div style="margin:6px 0;padding:4px;background:rgba(139,0,0,0.15);border-radius:3px">
      <div style="font-size:12px;color:#ffaaaa"><strong>${clusterToken.name}</strong> → <strong>${heroActor.name}</strong></div>
      ${lines.join("")}
      <div class="result-line result-fail" style="font-size:12px">Gesamt: ${totalSP} SP</div>
    </div>`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Kontroll-Panel ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// Kurze Info-Nachricht im Chat (ohne Buttons — die sind im Popout-Panel)
async function _postChatInfo(templateId, info, caster) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: `<div class="dsa-pixel-chat" style="border:2px solid #8b0000;background:linear-gradient(180deg,#1a0505,#0a0202)">
      <div class="chat-title" style="color:#ff4444">🔥 PANDAEMONIUM gewirkt</div>
      <div style="padding:4px 6px;font-size:12px;text-align:center;color:#c09040">
        ${info.rechtschritt} Rechtschritt · ZfP* ${info.zfpStar} · ${info.remainingRounds} KR · ${info.totalTokens} Cluster
        <div style="margin-top:4px;font-size:11px;color:#ffdd88">
          ⚙ Kontroll-Fenster geoeffnet — falls geschlossen: <code style="color:#ffeb99">DSAPandaemonium()</code> im Makro-Fenster
        </div>
      </div>
    </div>`,
  });
}

// HTML-Inhalt des Popout-Panels
function _renderPanelHTML(templateId) {
  const template = canvas.scene?.templates.get(templateId);
  const meta = template?.getFlag(MODULE_ID, FLAG_TEMPLATE);
  if (!meta) {
    return `<div style="padding:20px;text-align:center;color:#888">Zone nicht gefunden (evtl. bereits aufgeloest).</div>`;
  }
  const tokenCount = canvas.scene.tokens.filter(t =>
    t.getFlag(MODULE_ID, FLAG_CLUSTER_TOKEN)?.templateId === templateId
  ).length;

  return `<div class="pandaemonium-panel-inner" style="padding:10px;background:linear-gradient(180deg,#1a0505,#0a0202);color:#e0c0a0;font-family:'VT323',monospace">
    <div style="font-size:18px;color:#ff4444;text-align:center;margin-bottom:6px">🔥 PANDAEMONIUM</div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:13px;margin-bottom:8px">
      <div style="padding:4px;background:rgba(139,0,0,0.3);border-radius:3px">
        <span style="color:#888;font-size:11px">Zone</span><br>
        <strong>${meta.rechtschritt}</strong> Rechtschritt
      </div>
      <div style="padding:4px;background:rgba(139,0,0,0.3);border-radius:3px">
        <span style="color:#888;font-size:11px">ZfP*</span><br>
        <strong>${meta.zfpStar}</strong>
      </div>
      <div style="padding:4px;background:rgba(139,0,0,0.3);border-radius:3px">
        <span style="color:#888;font-size:11px">Verbleibend</span><br>
        <strong style="color:#ffdd44">${meta.remainingRounds}</strong> KR
      </div>
      <div style="padding:4px;background:rgba(139,0,0,0.3);border-radius:3px">
        <span style="color:#888;font-size:11px">Cluster</span><br>
        <strong>${tokenCount}</strong> Tokens
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:6px">
      <button class="pd-btn" data-action="mut"
        style="background:#2a1a2a;border:1px solid #8b0000;color:#ff9999;font-family:'VT323',monospace;font-size:13px;padding:6px;cursor:pointer;border-radius:3px">
        🧠 Mut-Probe
      </button>
      <button class="pd-btn" data-action="attack"
        style="background:#2a1a2a;border:1px solid #8b0000;color:#ff9999;font-family:'VT323',monospace;font-size:13px;padding:6px;cursor:pointer;border-radius:3px">
        ⚔ Cluster greifen an
      </button>
      <button class="pd-btn" data-action="kk"
        style="background:#2a1a2a;border:1px solid #8b0000;color:#ff9999;font-family:'VT323',monospace;font-size:13px;padding:6px;cursor:pointer;border-radius:3px">
        💪 KK loesen
      </button>
      <button class="pd-btn" data-action="tick"
        style="background:#1a2a1a;border:1px solid #4a4a4a;color:#999;font-family:'VT323',monospace;font-size:13px;padding:6px;cursor:pointer;border-radius:3px">
        ⏱ 1 KR abziehen
      </button>
    </div>

    <button class="pd-btn" data-action="end"
      style="width:100%;background:#2a2a1a;border:1px solid #8b8b00;color:#ffdd44;font-family:'VT323',monospace;font-size:13px;padding:6px;cursor:pointer;border-radius:3px">
      🛑 Zone vorzeitig beenden
    </button>

    <div style="font-size:10px;color:#666;margin-top:8px;line-height:1.4;border-top:1px solid rgba(255,255,255,0.1);padding-top:6px">
      ℹ Cluster sind normale Tokens auf der Karte. Helden koennen sie mit Waffen angreifen (Kampf-Tab).<br>
      ℹ Geweihte Waffen: 2x Schaden beim Schadenswurf-Dialog eingeben.<br>
      ℹ Fuer Aktion: Ziel-Token selektieren, dann Button klicken.
    </div>
  </div>`;
}

// Panel aktualisieren (nach Schaden / KR-Aenderung / Token-Anzahl)
async function _updatePanel(templateId) {
  const panel = _openPanels.get(templateId);
  if (panel) panel.render();
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Button-Handler ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function _getSelectedActor() {
  const tokens = canvas.tokens?.controlled ?? [];
  if (tokens.length === 0) {
    ui.notifications.warn("Bitte zuerst einen Token selektieren.");
    return null;
  }
  return tokens[0].actor;
}

async function _handleMutProbe(templateId) {
  const actor = _getSelectedActor();
  if (!actor) return;
  const template = canvas.scene?.templates.get(templateId);
  const meta = template?.getFlag(MODULE_ID, FLAG_TEMPLATE);
  if (!meta) return;

  const mu = actor.system?.MU?.value ?? 10;
  const target = mu - meta.zfpStar;
  const roll = new Roll("1d20"); await roll.evaluate();
  const die = roll.total;
  const success = die <= target;

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="dsa-pixel-chat">
      <div class="chat-title">🧠 Mut-Probe (PANDAEMONIUM, Erschw +${meta.zfpStar})</div>
      <div class="dice-row"><div class="die ${success ? "success" : "fail"}">${die}</div></div>
      <div class="dsa-mod-hint">MU ${mu} − ZfP* ${meta.zfpStar} = Ziel ${target}</div>
      <div class="result-line ${success ? "result-success" : "result-fail"}">
        ${success ? "Bestanden" : "Misslungen — Held flieht oder zoegert"}
      </div>
    </div>`,
  });
}

async function _handleKK(templateId) {
  const actor = _getSelectedActor();
  if (!actor) return;
  if (!actor.getFlag(MODULE_ID, FLAG_GRAPPLE)) {
    ui.notifications.info(`${actor.name} ist nicht festgehalten.`);
    return;
  }
  const kk = actor.system?.KK?.value ?? 10;
  const roll = new Roll("1d20"); await roll.evaluate();
  const success = roll.total <= kk;
  if (success) await actor.setFlag(MODULE_ID, FLAG_GRAPPLE, false);
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="dsa-pixel-chat">
      <div class="chat-title">💪 KK-Probe (Festhalten loesen)</div>
      <div class="dice-row"><div class="die ${success ? "success" : "fail"}">${roll.total}</div></div>
      <div class="dsa-mod-hint">KK ${kk}</div>
      <div class="result-line ${success ? "result-success" : "result-fail"}">
        ${success ? "Losgerissen! (1 Aktion)" : "Immer noch festgehalten"}
      </div>
    </div>`,
  });
}

async function _handleTick(templateId) {
  const template = canvas.scene?.templates.get(templateId);
  const meta = template?.getFlag(MODULE_ID, FLAG_TEMPLATE);
  if (!meta) return;

  meta.remainingRounds -= 1;
  if (meta.remainingRounds <= 0) {
    await _endZone(templateId);
    return;
  }
  await template.setFlag(MODULE_ID, FLAG_TEMPLATE, meta);
  await _updatePanel(templateId);
}

async function _endZone(templateId) {
  _stopZoneVFX(templateId);
  _closeControlPanel(templateId);
  const template = canvas.scene?.templates.get(templateId);
  if (!template) return;

  // Alle Cluster-Tokens loeschen
  const tokens = canvas.scene.tokens.filter(t =>
    t.getFlag(MODULE_ID, FLAG_CLUSTER_TOKEN)?.templateId === templateId
  );
  if (tokens.length > 0) {
    await canvas.scene.deleteEmbeddedDocuments("Token", tokens.map(t => t.id));
  }

  // Template loeschen
  await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", [templateId]);

  // Grapple-Flags saeubern
  for (const actor of game.actors) {
    if (actor.getFlag(MODULE_ID, FLAG_GRAPPLE)) {
      await actor.setFlag(MODULE_ID, FLAG_GRAPPLE, false);
    }
  }

  ChatMessage.create({
    content: `<div class="dsa-pixel-chat"><div class="chat-title">🛑 PANDAEMONIUM aufgeloest</div>
      <div class="result-line result-success">Die daemonische Zone loest sich auf. Alle Erscheinungen verschwinden.</div></div>`,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── VFX ────────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function _startZoneVFX(template) {
  if (typeof DSAPixelTokens === "undefined") return;
  const id = template.id;
  if (_vfxIntervals.has(id)) return;

  const cx = template.x, cy = template.y;
  const gridSize = canvas.scene?.grid?.size ?? 100;
  const radiusPx = (template.distance ?? 2) * gridSize;

  _burst(cx, cy, radiusPx);
  const interval = setInterval(() => {
    if (!canvas.scene?.templates.get(id)) { _stopZoneVFX(id); return; }
    _burst(cx, cy, radiusPx);
  }, 1800);
  _vfxIntervals.set(id, interval);
}

function _stopZoneVFX(id) {
  const interval = _vfxIntervals.get(id);
  if (interval) { clearInterval(interval); _vfxIntervals.delete(id); }
}

function _burst(cx, cy, radiusPx) {
  if (typeof DSAPixelTokens === "undefined") return;
  DSAPixelTokens.spawnEffect?.(cx, cy, "pandemonium");
  const effects = ["schatten", "brennen", "schadenflash", "gift", "schattenform"];
  const count = Math.min(6, Math.max(3, Math.floor(radiusPx / 80)));
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * radiusPx * 0.85;
    setTimeout(() => DSAPixelTokens.spawnEffect?.(cx + Math.cos(a) * d, cy + Math.sin(a) * d, effects[Math.floor(Math.random() * effects.length)]), i * 200);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Hooks ──────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export function registerPandaemoniumHooks() {
  // LeP-Aenderung bei Cluster-Token → Counts anpassen
  Hooks.on("updateActor", async (actor, changes, _opts, _userId) => {
    if (!game.user.isGM) return;
    const newLeP = foundry.utils.getProperty(changes, "system.LeP.value");
    if (newLeP === undefined) return;
    // Finde Token das zu diesem (unlinked) Actor gehoert
    const scenes = [canvas.scene, ...game.scenes].filter(Boolean);
    for (const scene of scenes) {
      for (const t of scene.tokens) {
        if (t.actor?.id !== actor.id) continue;
        if (!t.getFlag(MODULE_ID, FLAG_CLUSTER_TOKEN)) continue;
        const oldLeP = actor.system?.LeP?.value ?? newLeP;
        await _onClusterTokenDamaged(t, oldLeP, newLeP);
      }
    }
  });

  // Template loeschen → VFX stoppen + Cluster-Tokens saeubern
  Hooks.on("deleteMeasuredTemplate", async (template) => {
    if (!template.getFlag(MODULE_ID, FLAG_TEMPLATE)) return;
    _stopZoneVFX(template.id);
    const scene = template.parent;
    const tokens = scene.tokens.filter(t =>
      t.getFlag(MODULE_ID, FLAG_CLUSTER_TOKEN)?.templateId === template.id
    );
    if (tokens.length > 0 && game.user.isGM) {
      await scene.deleteEmbeddedDocuments("Token", tokens.map(t => t.id));
    }
  });

  // Scene ready → VFX fuer bestehende Zonen restarten (Popout bleibt manuell zu oeffnen)
  Hooks.on("canvasReady", () => {
    for (const id of [..._vfxIntervals.keys()]) _stopZoneVFX(id);
    for (const id of [..._openPanels.keys()]) {
      _openPanels.get(id)?.close({ force: true }); // alte Panels anderer Szenen schliessen
    }
    _openPanels.clear();
    const templates = canvas.scene?.templates ?? [];
    for (const t of templates) {
      if (t.getFlag(MODULE_ID, FLAG_TEMPLATE)) _startZoneVFX(t);
    }
  });

  // Globaler Helper: Kontroll-Fenster fuer aktive Zone(n) oeffnen
  globalThis.DSAPandaemonium = () => {
    const templates = canvas.scene?.templates.filter(t => t.getFlag(MODULE_ID, FLAG_TEMPLATE)) ?? [];
    if (templates.length === 0) {
      ui.notifications.info("Keine aktive PANDAEMONIUM-Zone gefunden.");
      return;
    }
    for (const t of templates) _openControlPanel(t.id);
  };

  // Auto-Tick pro Kampfrunde
  Hooks.on("updateCombat", async (combat, changes) => {
    if (!game.user.isGM) return;
    if (changes.round === undefined) return;
    const templates = canvas.scene?.templates.filter(t => t.getFlag(MODULE_ID, FLAG_TEMPLATE)) ?? [];
    for (const template of templates) {
      // Erst angreifen, dann Tick
      await _rollClusterAttacksForRound(template.id);
      await _handleTick(template.id);
    }
  });

  console.log(`[${MODULE_ID}] ✓ Pandaemonium v2 (Token-basiert) registriert`);
}
