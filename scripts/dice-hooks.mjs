/**
 * DSA Pixel-Art Tokens — Dice Hooks
 * Fängt gdsa Probenergebnisse im Chat ab und triggert automatisch VFX.
 * Injiziert auch Parade/Schaden-Buttons mit Pixel-Art Styling.
 */

import { MODULE_ID, SPELL_EFFECT_MAP, PROBE_SOUNDS } from "./config.mjs";

// ─── Sound Helper ───────────────────────────────────────────────────────────

async function playSound(soundPath) {
  if (!soundPath) return;
  try {
    const AH = foundry.audio?.AudioHelper ?? AudioHelper;
    const sound = await AH.preloadSound(soundPath);
    sound?.play({ volume: 0.7, loop: false });
  } catch (e) {
    console.warn(`[${MODULE_ID}] Sound error:`, e);
  }
}

// ─── Chat Message Analysis ──────────────────────────────────────────────────

/**
 * Analysiert eine gdsa Chat-Nachricht und erkennt den Probentyp.
 * gdsa verwendet Handlebars-Templates in templates/chat/chatTemplate/
 * Die Chat-HTML enthält Klassen wie .bntChatParry, .bntChatDamage, etc.
 */
function analyzeGDSAChatMessage(message, html) {
  const content = html[0] ?? html;

  // ── Ergebnis-Erkennung über Chat-Template Klassen ──
  const result = {
    type: null,       // "stat" | "skill" | "attack" | "parry" | "damage" | "spell"
    success: null,
    critical: false,
    fumble: false,
    actorId: null,
    tokenId: null,
    dice: [],
  };

  // Versuche Actor-ID aus Message zu extrahieren
  result.actorId = message.speaker?.actor ?? null;
  result.tokenId = message.speaker?.token ?? null;

  // gdsa Chat-Templates haben bestimmte Klassen/Data-Attribute
  const chatEl = content.querySelector?.(".chat-message") ?? content;

  // Ergebnis aus Flags auslesen (wenn gdsa Flags setzt)
  const flags = message.flags?.gdsa ?? message.flags?.GDSA ?? {};
  if (flags.type) result.type = flags.type;
  if (flags.success !== undefined) result.success = flags.success;

  // Fallback: HTML-Analyse
  // gdsa Angriff-Chat hat .bntChatParry Button
  if (content.querySelector?.(".bntChatParry")) {
    result.type = "attack";
    result.success = true; // Parade-Button nur bei erfolgreichem Angriff
  }

  // gdsa Parade-Chat
  if (content.querySelector?.(".bntChatDamage") && !content.querySelector?.(".bntChatParry")) {
    result.type = "parry";
  }

  // gdsa Schaden-Chat
  if (content.querySelector?.(".bntChatDogde")) {
    result.type = "attack"; // Ausweichen-Button bei erfolgreichem Angriff
    result.success = true;
  }

  // Suche nach Würfelergebnissen im Text
  const diceSpans = content.querySelectorAll?.(".die-result, .dice-total, [data-result]") ?? [];
  for (const span of diceSpans) {
    const val = parseInt(span.textContent) || parseInt(span.dataset?.result);
    if (val) result.dice.push(val);
  }

  // Erfolg/Misserfolg aus Text erkennen
  const text = content.textContent?.toLowerCase() ?? "";
  if (text.includes("gelungen") || text.includes("treffer") || text.includes("erfolg")) {
    result.success = true;
  }
  if (text.includes("misslungen") || text.includes("daneben") || text.includes("gescheitert")) {
    result.success = false;
  }
  if (text.includes("patzer") || text.includes("kritischer misserfolg")) {
    result.fumble = true;
    result.success = false;
  }
  if (text.includes("kritisch") && !result.fumble) {
    result.critical = true;
    result.success = true;
  }
  if (text.includes("glücklich") || text.includes("meisterhaft")) {
    result.critical = true;
    result.success = true;
  }

  // Spell-Erkennung
  if (text.includes("zauber") || text.includes("spell") || text.includes("asp")) {
    if (!result.type) result.type = "spell";
  }

  return result;
}

// ─── VFX Trigger ────────────────────────────────────────────────────────────

function triggerVFX(result) {
  if (typeof DSAPixelTokens === "undefined") return;
  if (!canvas?.tokens?.placeables) return;

  // Token des Actors finden
  let actorToken = null;
  if (result.tokenId) {
    actorToken = canvas.tokens.get(result.tokenId);
  } else if (result.actorId) {
    actorToken = canvas.tokens.placeables.find(t => t.actor?.id === result.actorId);
  }

  if (!actorToken) return;

  const { x, y } = actorToken.center;
  const targetToken = [...(game.user?.targets ?? [])][0];

  switch (result.type) {
    case "attack":
      if (result.success) {
        playSound(PROBE_SOUNDS.attack);
        // Treffer-Flash am Ziel
        if (targetToken) {
          setTimeout(() => {
            DSAPixelTokens.spawnEffect(targetToken.center.x, targetToken.center.y, "schadenflash");
          }, 200);
        }
      }
      if (result.fumble) {
        playSound(PROBE_SOUNDS.fumble);
        DSAPixelTokens.spawnEffect(x, y, "schadenflash");
      }
      if (result.critical) {
        playSound(PROBE_SOUNDS.critical);
      }
      break;

    case "parry":
      if (result.success) {
        playSound(PROBE_SOUNDS.success);
      }
      if (result.fumble) {
        playSound(PROBE_SOUNDS.fumble);
        DSAPixelTokens.spawnEffect(x, y, "schadenflash");
      }
      break;

    case "spell":
      if (result.success) {
        playSound(PROBE_SOUNDS.spell);
        // Zaubereffekt via Mapping triggern — erfordert Zaubernamen
        // (wird bei der erweiterten Integration implementiert)
      }
      if (result.fumble) {
        playSound(PROBE_SOUNDS.fumble);
        DSAPixelTokens.spawnEffect(x, y, "schadenflash");
      }
      if (result.critical) {
        playSound(PROBE_SOUNDS.critical);
        DSAPixelTokens.spawnEffect(x, y, "heilung");
      }
      break;

    case "damage":
      if (targetToken) {
        playSound(PROBE_SOUNDS.damage);
      }
      break;

    default:
      // Talentprobe oder Eigenschaftsprobe
      if (result.fumble) {
        playSound(PROBE_SOUNDS.fumble);
        DSAPixelTokens.spawnEffect(x, y, "schadenflash");
      }
      if (result.critical) {
        playSound(PROBE_SOUNDS.critical);
        DSAPixelTokens.spawnEffect(x, y, "heilung");
      }
      break;
  }
}

// ─── Button Enhancement ─────────────────────────────────────────────────────

/**
 * Verbessert gdsa Chat-Buttons mit Pixel-Art Styling und zusätzlicher Funktionalität.
 */
function enhanceChatButtons(html) {
  // Parade-Button stylen
  const parryBtns = html.find(".bntChatParry");
  parryBtns.addClass("dsa-pixel-enhanced");
  parryBtns.css({
    "font-family": "'VT323', monospace",
    "background": "#16213e",
    "border": "2px solid #4a90d9",
    "color": "#4a90d9",
    "cursor": "pointer",
  });

  // Schaden-Button stylen
  const dmgBtns = html.find(".bntChatDamage");
  dmgBtns.addClass("dsa-pixel-enhanced");
  dmgBtns.css({
    "font-family": "'VT323', monospace",
    "background": "#16213e",
    "border": "2px solid #e94560",
    "color": "#e94560",
    "cursor": "pointer",
  });

  // Ausweichen-Button stylen
  const dodgeBtns = html.find(".bntChatDogde");
  dodgeBtns.addClass("dsa-pixel-enhanced");
  dodgeBtns.css({
    "font-family": "'VT323', monospace",
    "background": "#16213e",
    "border": "2px solid #4ad94a",
    "color": "#4ad94a",
    "cursor": "pointer",
  });
}

// ─── Fernkampf Projektil-Automation ─────────────────────────────────────────

/**
 * Erkennt Fernkampf-Angriffe und spielt Projektil-Animation ab.
 * Muss den Waffentyp erkennen (Bogen, Armbrust, etc.)
 */
function handleRangedAttack(result) {
  if (typeof DSAPixelTokens === "undefined") return;
  if (result.type !== "attack" || !result.success) return;

  const actorToken = result.tokenId
    ? canvas.tokens.get(result.tokenId)
    : canvas.tokens.placeables.find(t => t.actor?.id === result.actorId);

  const targetToken = [...(game.user?.targets ?? [])][0];
  if (!actorToken || !targetToken) return;

  // Prüfe ob es ein Fernkampf-Angriff ist (basierend auf Distanz)
  const dist = Math.hypot(
    actorToken.center.x - targetToken.center.x,
    actorToken.center.y - targetToken.center.y
  );
  const gridSize = canvas.grid?.size ?? 100;

  // Wenn Token weiter als 2 Felder entfernt → Fernkampf-Projektil
  if (dist > gridSize * 2.5) {
    // Pfeil-Projektil (nutzt flammenpfeil als Basis, aber ohne Feuer)
    // TODO: Eigenes Pfeil-Sprite hinzufügen
    DSAPixelTokens.spawnProjectile(actorToken, targetToken, "flammenpfeil", "schadenflash");
  }
}

// ─── Hook Registration ──────────────────────────────────────────────────────

export function registerDiceHooks() {
  // Alle neuen Chat-Nachrichten abfangen
  Hooks.on("renderChatMessage", (message, html, data) => {
    // Nur gdsa-Nachrichten verarbeiten (nicht unsere eigenen)
    if (message.flags?.[MODULE_ID]) return;

    const result = analyzeGDSAChatMessage(message, html);

    // VFX triggern
    if (result.type || result.fumble || result.critical) {
      triggerVFX(result);
    }

    // Fernkampf-Projektile
    handleRangedAttack(result);

    // Chat-Buttons aufhübschen
    enhanceChatButtons(html);
  });

  console.log(`[${MODULE_ID}] ✓ Dice Hooks registriert`);
}
