/**
 * Persistent Effects Manager — Liturgien & Zauber mit Wirkungsdauer
 *
 * Ablauf:
 *   1) addPersistentEffect(actor, lit, vfx, duration) erstellt
 *      a) eine Foundry ActiveEffect auf dem Actor (Token-Status-Icon, Round-Counter)
 *      b) eine persistente Aura via spawnPersistentAura(token, vfx)
 *      c) registriert den VFX-Handle in einer In-Memory-Map (effectId → handle)
 *   2) Token-Status-Icon erscheint automatisch via Foundry's Standard-System
 *   3) Rechtsklick auf das Icon im Token-HUD löscht die ActiveEffect
 *      → Hook 'deleteActiveEffect' destroyt die zugehörige Aura
 *   4) Auf Scene-Wechsel: Aura wird auto-destroyed (Token weg). Beim
 *      Re-Render des Tokens läuft 'createToken' → wir spawnen Aura neu falls AE
 *      noch aktiv.
 *
 * Wirkungsdauer-Parsing (vereinfacht):
 *   "augenblicklich" → kein persistent effect (one-shot VFX in liturgy-effects.mjs)
 *   "LkP* SR" / "LkP* KR" / "LkP*x10 KR" → rounds: lkpStar (* faktor)
 *   "LkP* Stunden" → seconds: lkpStar * 3600
 *   "LkP* Tag(e)" → seconds: lkpStar * 86400
 *   "permanent" / "bis ..." → no auto-expire (manual end only)
 */

import { MODULE_ID } from "./config.mjs";
import { spawnPersistentAura } from "./vfx.mjs";

// In-Memory-Map: effectId → { handle, actorId, tokenId }
const ACTIVE_AURAS = new Map();

// Mapping VFX-Name → Token-Icon-Pfad (Foundry-builtin Pfade)
const ICON_FOR_VFX = {
  holy_aura:    "icons/magic/holy/yin-yang-gold.webp",
  holy_seal:    "icons/magic/holy/saint-glass-portrait-gold.webp",
  rondra_aura:  "icons/skills/melee/strike-sword-fire-orange.webp",
  boron_seal:   "icons/magic/death/skull-horned-gold.webp",
  hesinde_glow: "icons/magic/light/orb-shadow-blue.webp",
  travia_warm:  "icons/magic/fire/flame-burning-fire-yellow.webp",
  phex_dark:    "icons/magic/perception/eye-ringed-glow-angry-green.webp",
  peraine_heal: "icons/magic/nature/leaf-glow-green.webp",
  ingerimm_forge:"icons/skills/trades/smithing-anvil-silver-red.webp",
  rahja_love:   "icons/magic/life/heart-glowing-red.webp",
  efferd_wave:  "icons/magic/water/wave-water-blue.webp",
  firun_ice:    "icons/magic/water/ice-shard-snowflake-blue.webp",
  tsa_rainbow:  "icons/magic/holy/yin-yang-rainbow.webp",
  shaman_smoke: "icons/magic/control/silhouette-grow-shrink-blue.webp",
  curse_dark:   "icons/magic/unholy/silhouette-evil-horned-grin-yellow.webp",
  divine_command:"icons/magic/control/voice-shout-orange.webp",
  namenloser_void: "icons/magic/unholy/silhouette-robe-evil-power.webp",
};

// ─── Wirkungsdauer-Parser ────────────────────────────────────────────────────

/**
 * Berechnet Foundry-ActiveEffect-duration aus Liturgie-Wirkungsdauer + LkP*.
 * @returns {object|null} { rounds: N } oder { seconds: N } oder null (permanent)
 */
export function parseDuration(wirkungsdauer, lkpStar) {
  if (!wirkungsdauer || typeof wirkungsdauer !== "string") return null;
  const w = wirkungsdauer.toLowerCase().trim();

  // augenblicklich = keine Wirkungsdauer (handled in caller)
  if (w.includes("augenblicklich")) return null;

  // permanent / dauerhaft = no auto-expire
  if (w.includes("permanent") || w.includes("dauerhaft")) return null;

  // LkP*x10 KR = lkpStar * 10 Kampfrunden (~Combat-Rounds)
  const krX10Match = w.match(/lkp\*?\s*[x×*]\s*10/);
  if (krX10Match && (w.includes("kr") || w.includes("kampfrunden"))) {
    return { rounds: Math.max(1, lkpStar * 10) };
  }

  // LkP* SR / KR / Spielrunden / Kampfrunden
  if (/lkp\*?/.test(w) && (w.includes("sr") || w.includes("kr") ||
      w.includes("spielrunden") || w.includes("kampfrunden"))) {
    return { rounds: Math.max(1, lkpStar) };
  }

  // LkP* Stunden
  if (/lkp\*?/.test(w) && (w.includes("stunden") || w.includes("stunde"))) {
    return { seconds: lkpStar * 3600 };
  }

  // LkP* Tage
  if (/lkp\*?/.test(w) && (w.includes("tag"))) {
    return { seconds: lkpStar * 86400 };
  }

  // LkP* Minuten
  if (/lkp\*?/.test(w) && (w.includes("minuten") || w.includes("minute"))) {
    return { seconds: lkpStar * 60 };
  }

  // Default: 1 Stunde wenn keine Einheit erkannt
  return { seconds: 3600 };
}

// ─── Token-Finder ────────────────────────────────────────────────────────────

function findToken(actor) {
  if (!actor) return null;
  const ctrl = canvas.tokens?.controlled?.find(t => t.actor?.id === actor.id);
  if (ctrl) return ctrl;
  return canvas.tokens?.placeables?.find(t => t.actor?.id === actor.id) ?? null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fügt einem Actor einen persistenten Effekt hinzu (ActiveEffect + VFX-Aura).
 *
 * @param {Actor} actor
 * @param {object} opts - { name, vfx, duration: { rounds?, seconds? }, lit, lkpStar }
 * @returns {Promise<string|null>} effectId (für späteres remove) oder null
 */
/**
 * Rechnet eine Wirkungsdauer in einen Ablaufzeitpunkt um, der sich später ohne
 * Foundry-Interna prüfen lässt.
 *
 * WARUM EIGENE BUCHFÜHRUNG: Foundry zeigt abgelaufene Effekte zwar ausgegraut an,
 * löscht sie aber nicht. Bis v0.7.18 gab es hier gar keinen Ablauf — eine
 * Liturgie mit "LkP* SR" blieb samt Aura und Token-Symbol bestehen, bis jemand
 * von Hand rechtsklickte. Nach einem Spielabend hingen an einem Geweihten
 * beliebig viele davon.
 *
 * @param {object|null} duration - { rounds } oder { seconds }, wie parseDuration liefert
 * @returns {{ runde?: number, zeit?: number }|null} null = laeuft nie ab
 */
export function ablaufBerechnen(duration) {
  if (!duration) return null;
  if (Number.isFinite(duration.rounds)) {
    const jetzt = game.combat?.round ?? 0;
    return { runde: jetzt + duration.rounds };
  }
  if (Number.isFinite(duration.seconds)) {
    const jetzt = game.time?.worldTime ?? 0;
    return { zeit: jetzt + duration.seconds };
  }
  return null;
}

/**
 * Ist dieser Ablaufzeitpunkt erreicht?
 *
 * @param {{ runde?: number, zeit?: number }|null} ablauf
 * @param {{ runde?: number, zeit?: number }} jetzt
 * @returns {boolean} false bei null — was nie ablaeuft, laeuft auch jetzt nicht ab
 */
export function istAbgelaufen(ablauf, jetzt = {}) {
  if (!ablauf) return false;
  if (Number.isFinite(ablauf.runde)) {
    // Rundenzaehler laeuft nur, solange ein Kampf laeuft. Ohne Kampf bleibt der
    // Effekt stehen — sonst verschwaende ein Kampfende alle Segen auf einmal.
    if (!Number.isFinite(jetzt.runde)) return false;
    return jetzt.runde >= ablauf.runde;
  }
  if (Number.isFinite(ablauf.zeit)) {
    if (!Number.isFinite(jetzt.zeit)) return false;
    return jetzt.zeit >= ablauf.zeit;
  }
  return false;
}

export async function addPersistentEffect(actor, opts) {
  if (!actor) return null;
  const { name, vfx, duration, lit, lkpStar } = opts;
  const icon = ICON_FOR_VFX[vfx] ?? "icons/magic/holy/yin-yang-gold.webp";

  const aeData = {
    name: name ?? lit?.name ?? "Liturgie-Effekt",
    img: icon,   // Foundry v12 uses 'img' (was 'icon' in v10/v11)
    icon,        // Keep for backward-compat with older Foundry
    duration: duration ?? {},
    description: `${lit?.name ?? "Liturgie"} (LkP* ${lkpStar}). Rechts-Klick auf Icon im Token-HUD zum Beenden.`,
    flags: {
      [MODULE_ID]: {
        liturgyId: lit?.id ?? null,
        liturgyName: lit?.name ?? null,
        vfx: vfx ?? "holy_aura",
        lkpStar: lkpStar ?? 0,
        managedAura: true,
        ablauf: ablaufBerechnen(duration),
      },
    },
    changes: [],
    transfer: false,
    statuses: [`liturgy-${vfx}`],  // markiert als Status (Foundry-Token-HUD zeigt es)
  };

  // Dieselbe Liturgie zweimal wirken heisst erneuern, nicht stapeln. Vorher
  // legte jeder Wurf einen weiteren Effekt an: derselbe Segen hing am Ende
  // fuenfmal am Token, mit fuenf Auren uebereinander.
  const gleicher = (actor.effects ?? []).find(e => {
    const k = e.flags?.[MODULE_ID];
    if (!k?.managedAura) return false;
    return (lit?.id && k.liturgyId === lit.id) || (e.name && e.name === aeData.name);
  });
  if (gleicher) {
    await removePersistentEffect(actor, gleicher.id);
  }

  let effect;
  try {
    if (actor.isOwner || game.user.isGM) {
      const created = await actor.createEmbeddedDocuments("ActiveEffect", [aeData]);
      effect = created?.[0];
    } else {
      // GM-Relay
      ui.notifications.info(`${actor.name}: ActiveEffect "${aeData.name}" wird über GM-Relay angelegt — kann kurz dauern.`);
      // For now require GM to do it manually
      console.warn(`[${MODULE_ID}] addPersistentEffect: kein Owner — Player muss SL bitten`);
      return null;
    }
  } catch (e) {
    console.warn(`[${MODULE_ID}] ActiveEffect-create fehlgeschlagen:`, e);
    return null;
  }

  if (!effect) return null;

  // Aura spawnen
  const token = findToken(actor);
  if (token && vfx) {
    const handle = spawnPersistentAura(token, vfx);
    ACTIVE_AURAS.set(effect.id, { handle, actorId: actor.id, tokenId: token.id });
  }

  return effect.id;
}

/**
 * Entfernt einen persistenten Effekt (löscht ActiveEffect + destroy VFX).
 */
export async function removePersistentEffect(actor, effectId) {
  if (!actor || !effectId) return;
  // VFX-Handle destroyen
  const entry = ACTIVE_AURAS.get(effectId);
  entry?.handle?.destroy?.();
  ACTIVE_AURAS.delete(effectId);
  // ActiveEffect löschen
  try {
    const ae = actor.effects.get(effectId);
    if (ae) {
      if (actor.isOwner || game.user.isGM) {
        await ae.delete();
      }
    }
  } catch (e) {
    console.warn(`[${MODULE_ID}] AE-delete fehlgeschlagen:`, e);
  }
}

/**
 * Beendet ALLE persistenten Effekte eines Actors.
 */
export async function endAllPersistentEffects(actor) {
  if (!actor) return;
  const ours = actor.effects.filter(e => e.flags?.[MODULE_ID]?.managedAura);
  for (const ae of ours) {
    await removePersistentEffect(actor, ae.id);
  }
}

/**
 * Re-spawnt die Aura für einen Token, falls AE bereits existiert (Scene-Reload).
 */
export function rehydrateAurasForToken(token) {
  if (!token?.actor) return;
  for (const ae of token.actor.effects) {
    const flag = ae.flags?.[MODULE_ID];
    if (!flag?.managedAura || !flag.vfx) continue;
    if (ACTIVE_AURAS.has(ae.id)) continue; // schon aktiv
    const handle = spawnPersistentAura(token, flag.vfx);
    ACTIVE_AURAS.set(ae.id, { handle, actorId: token.actor.id, tokenId: token.id });
  }
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Entfernt alle abgelaufenen Effekte dieses Moduls.
 *
 * Läuft nur bei der Spielleitung: das Löschen fremder Effekte lehnt der Server
 * bei Spielern ohnehin ab, und zwei Clients, die gleichzeitig aufräumen,
 * erzeugen nur Fehler in der Konsole.
 *
 * @returns {Promise<number>} Anzahl der entfernten Effekte
 */
export async function abgelaufeneEffekteEntfernen() {
  if (!game.user?.isGM) return 0;
  const jetzt = {
    runde: game.combat ? (game.combat.round ?? 0) : undefined,
    zeit: game.time?.worldTime ?? 0,
  };

  let entfernt = 0;
  for (const actor of game.actors ?? []) {
    const faellig = [];
    for (const effekt of actor.effects ?? []) {
      const kennfeld = effekt.flags?.[MODULE_ID];
      if (!kennfeld?.managedAura) continue;
      if (istAbgelaufen(kennfeld.ablauf, jetzt)) faellig.push(effekt.id);
    }
    for (const id of faellig) {
      await removePersistentEffect(actor, id);
      entfernt++;
    }
  }
  return entfernt;
}

export function registerPersistentEffectHooks() {
  // Ablauf prüfen, wenn die Zeit weiterläuft — beim Rundenwechsel im Kampf und
  // wenn die Spielleitung die Weltzeit verstellt.
  Hooks.on("updateCombat", async (_combat, changed) => {
    if (changed?.round === undefined && changed?.turn === undefined) return;
    await abgelaufeneEffekteEntfernen();
  });
  Hooks.on("updateWorldTime", async () => {
    await abgelaufeneEffekteEntfernen();
  });

  // Wenn AE gelöscht wird (UI-Klick auf Token-HUD oder anderswo) → Aura killen
  Hooks.on("deleteActiveEffect", (effect, options, userId) => {
    const flag = effect.flags?.[MODULE_ID];
    if (!flag?.managedAura) return;
    const entry = ACTIVE_AURAS.get(effect.id);
    if (entry) {
      entry.handle?.destroy?.();
      ACTIVE_AURAS.delete(effect.id);
    }
  });

  // Wenn neuer Token gerendert (Scene-Wechsel, Refresh) → Auras rehydratisieren
  Hooks.on("drawToken", (token) => {
    setTimeout(() => rehydrateAurasForToken(token), 100);
  });

  // Wenn Token gelöscht/von Scene entfernt → Aura cleanup
  Hooks.on("destroyToken", (token) => {
    for (const [effectId, entry] of ACTIVE_AURAS) {
      if (entry.tokenId === token.id) {
        entry.handle?.destroy?.();
        ACTIVE_AURAS.delete(effectId);
      }
    }
  });

  // Chat-Button-Handler für 🔚 Beenden
  Hooks.on("renderChatMessage", (message, html, data) => {
    html.find(".dsa-end-effect-btn").on("click", async (ev) => {
      ev.preventDefault();
      const btn = ev.currentTarget;
      const actorId = btn.dataset.actorId;
      const effectId = btn.dataset.effectId;
      const actor = game.actors.get(actorId);
      if (!actor) {
        ui.notifications.warn("Actor nicht gefunden");
        return;
      }
      await removePersistentEffect(actor, effectId);
      btn.closest(".dsa-pixel-chat")?.querySelector(".dsa-active-effect-line")
         ?.classList?.add("ended");
      btn.disabled = true;
      btn.textContent = "✓ Beendet";
    });
  });

  console.log(`[${MODULE_ID}] Persistent-Effects hooks registered`);
}
