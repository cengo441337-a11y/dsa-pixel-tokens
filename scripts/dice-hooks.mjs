/**
 * DSA Pixel-Art Tokens — Dice Hooks
 * Fängt gdsa Probenergebnisse im Chat ab und triggert automatisch VFX.
 * Injiziert auch Parade/Schaden-Buttons mit Pixel-Art Styling.
 */

import { MODULE_ID, SPELL_EFFECT_MAP, PROBE_SOUNDS, guessSpellEffect } from "./config.mjs";

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

// ─── Spell Name Extraction ──────────────────────────────────────────────────

/**
 * Extrahiert den Zaubernamen aus einer Chat-Nachricht.
 * Sucht in unserem Format, gdsa-Format, und per Volltext-Abgleich.
 */
function extractSpellName(html) {
  const content = html[0] ?? html;

  // Unser Format: <div class="chat-title">⚡ ZauberName</div>
  const ownTitle = content.querySelector?.(".chat-title");
  if (ownTitle) {
    const text = ownTitle.textContent.replace(/[⚡✨🌟⬡⚔⚗🔮]/g, "").trim();
    if (SPELL_EFFECT_MAP[text]) return text;
    // Teilübereinstimmung
    for (const name of Object.keys(SPELL_EFFECT_MAP)) {
      if (text.includes(name)) return name;
    }
  }

  // gdsa / Foundry Standard: Überschriften und Hervorhebungen
  const selectors = ["h3", "h4", ".card-header", ".item-name", ".flavor-text",
    ".chat-headline", ".spell-name", "[data-spell]", "strong", "b"];
  for (const sel of selectors) {
    const els = content.querySelectorAll?.(sel) ?? [];
    for (const el of els) {
      const text = el.textContent.trim();
      if (SPELL_EFFECT_MAP[text]) return text;
      for (const name of Object.keys(SPELL_EFFECT_MAP)) {
        if (text.includes(name)) return name;
      }
    }
  }

  // Volltext-Fallback: längste Übereinstimmung zuerst (verhindert Fehlmatches)
  const fullText = content.textContent ?? "";
  const sorted = Object.keys(SPELL_EFFECT_MAP).sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    if (fullText.includes(name)) return name;
  }

  return null;
}

// ─── Chat Message Analysis ──────────────────────────────────────────────────

/**
 * Analysiert eine gdsa Chat-Nachricht und erkennt den Probentyp.
 */
function analyzeGDSAChatMessage(message, html) {
  const content = html[0] ?? html;

  const result = {
    type: null,       // "stat" | "skill" | "attack" | "parry" | "damage" | "spell"
    success: null,
    critical: false,
    fumble: false,
    actorId: null,
    tokenId: null,
    spellName: null,
    dice: [],
  };

  result.actorId = message.speaker?.actor ?? null;
  result.tokenId = message.speaker?.token ?? null;

  // Ergebnis aus Flags (gdsa setzt manchmal eigene Flags)
  const flags = message.flags?.gdsa ?? message.flags?.GDSA ?? {};
  if (flags.type)                     result.type    = flags.type;
  if (flags.success !== undefined)    result.success = flags.success;
  if (flags.spellName)                result.spellName = flags.spellName;

  // HTML-Analyse für Typ
  if (content.querySelector?.(".bntChatParry")) {
    result.type = "attack";
    result.success = true;
  }
  if (content.querySelector?.(".bntChatDamage") && !content.querySelector?.(".bntChatParry")) {
    result.type = "parry";
  }
  if (content.querySelector?.(".bntChatDogde")) {
    result.type = "attack";
    result.success = true;
  }

  // Würfelergebnisse aus dem DOM
  const diceSpans = content.querySelectorAll?.(".die-result, .dice-total, [data-result]") ?? [];
  for (const span of diceSpans) {
    const val = parseInt(span.textContent) || parseInt(span.dataset?.result);
    if (val) result.dice.push(val);
  }

  // Erfolg/Misserfolg aus Text
  const text = (content.textContent ?? "").toLowerCase();
  if (text.includes("gelungen")   || text.includes("treffer")   || text.includes("erfolg"))   result.success = true;
  if (text.includes("misslungen") || text.includes("daneben")   || text.includes("gescheitert")) result.success = false;
  if (text.includes("patzer")     || text.includes("kritischer misserfolg")) { result.fumble = true;  result.success = false; }
  if (text.includes("kritisch")   && !result.fumble)            result.critical = true;
  if (text.includes("glücklich")  || text.includes("meisterhaft")) { result.critical = true; result.success = true; }
  if (text.includes("zauber")     || text.includes("asp"))      { if (!result.type) result.type = "spell"; }

  // Zaubernamen extrahieren (unabhängig vom erkannten Typ)
  result.spellName = result.spellName ?? extractSpellName(html);

  // Wenn Zaubername gefunden aber kein Typ erkannt → Zauber
  if (result.spellName && !result.type) result.type = "spell";

  return result;
}

// ─── Mapped Effect Trigger ──────────────────────────────────────────────────

/**
 * Triggert einen gemappten Zauber-VFX basierend auf SPELL_EFFECT_MAP-Eintrag.
 * @param {Token} casterToken
 * @param {Token|null} targetToken
 * @param {object} mapping - SPELL_EFFECT_MAP entry
 */
function _triggerMappedEffect(casterToken, targetToken, mapping) {
  if (typeof DSAPixelTokens === "undefined") return;

  switch (mapping.type) {
    case "projectile":
      if (targetToken && targetToken !== casterToken) {
        DSAPixelTokens.spawnProjectile(casterToken, targetToken, mapping.effect, mapping.impact ?? mapping.effect);
      } else {
        const pos = (targetToken ?? casterToken).center;
        DSAPixelTokens.spawnEffect(pos.x, pos.y, mapping.effect);
      }
      break;
    case "target": {
      const pos = (targetToken ?? casterToken).center;
      DSAPixelTokens.spawnEffect(pos.x, pos.y, mapping.effect);
      break;
    }
    case "aura":
      DSAPixelTokens.spawnEffect(casterToken.center.x, casterToken.center.y, mapping.effect);
      break;
    case "zone":
      // Zonen brauchen ein Template — nur Notification
      ui.notifications.info(`${mapping.effect} gelungen! Template platzieren für Zonen-Effekt.`);
      break;
  }
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
        // Treffer-Flash am Ziel
        if (targetToken) {
          setTimeout(() => {
            DSAPixelTokens.spawnEffect(targetToken.center.x, targetToken.center.y, "schadenflash");
          }, 200);
        }
      }
      if (result.fumble) {
        playSound(PROBE_SOUNDS.fumble ?? null);
        DSAPixelTokens.spawnEffect(x, y, "schadenflash");
      }
      if (result.critical) {
        playSound(PROBE_SOUNDS.critical ?? null);
      }
      break;

    case "parry":
      if (result.success) {
        playSound(PROBE_SOUNDS.success ?? null);
      }
      if (result.fumble) {
        playSound(PROBE_SOUNDS.fumble ?? null);
        DSAPixelTokens.spawnEffect(x, y, "schadenflash");
      }
      break;

    case "spell": {
      // Zaubername → SPELL_EFFECT_MAP → ggf. Keyword-Fallback → VFX
      const mapping = result.spellName
        ? (SPELL_EFFECT_MAP[result.spellName] ?? guessSpellEffect(result.spellName))
        : null;

      if (result.success) {
        playSound(PROBE_SOUNDS.spell ?? null);
        if (mapping && !mapping.enchantArrow) {
          setTimeout(() => _triggerMappedEffect(actorToken, targetToken, mapping), 300);
        }
        // Pfeil-Verzauberung: nur Status-Meldung, kein direkter VFX
        if (mapping?.enchantArrow) {
          ui.notifications.info(
            `✨ ${result.spellName} gewirkt — nächster Schuss fliegt als ${mapping.label}!`,
            { permanent: false }
          );
        }
      }

      if (result.fumble) {
        playSound(PROBE_SOUNDS.fumble ?? null);
        DSAPixelTokens.spawnEffect(x, y, "schadenflash");
      }
      if (result.critical) {
        playSound(PROBE_SOUNDS.critical ?? null);
        // Kritischer Zauber: Bonus-Glanz
        setTimeout(() => DSAPixelTokens.spawnEffect(x, y, "heilung"), 400);
      }
      break;
    }

    default:
      // Talentprobe / Eigenschaftsprobe
      if (result.fumble) {
        playSound(PROBE_SOUNDS.fumble ?? null);
        DSAPixelTokens.spawnEffect(x, y, "schadenflash");
      }
      if (result.critical) {
        playSound(PROBE_SOUNDS.critical ?? null);
        DSAPixelTokens.spawnEffect(x, y, "heilung");
      }
      break;
  }
}

// ─── Button Enhancement ─────────────────────────────────────────────────────

function enhanceChatButtons(html) {
  const style = {
    ".bntChatParry":  { border: "2px solid #4a90d9", color: "#4a90d9" },
    ".bntChatDamage": { border: "2px solid #e94560", color: "#e94560" },
    ".bntChatDogde":  { border: "2px solid #4ad94a", color: "#4ad94a" },
  };
  for (const [sel, css] of Object.entries(style)) {
    html.find(sel).addClass("dsa-pixel-enhanced").css({
      "font-family": "'VT323', monospace",
      "background":  "#16213e",
      "cursor":      "pointer",
      ...css,
    });
  }
}

// ─── Hook Registration ──────────────────────────────────────────────────────

export function registerDiceHooks() {
  Hooks.on("renderChatMessage", (message, html, _data) => {
    // Eigene Nachrichten nicht doppelt verarbeiten
    if (message.flags?.[MODULE_ID]) return;

    const result = analyzeGDSAChatMessage(message, html);

    if (result.type || result.fumble || result.critical) {
      triggerVFX(result);
    }

    enhanceChatButtons(html);
  });

  console.log(`[${MODULE_ID}] ✓ Dice Hooks registriert`);
}
