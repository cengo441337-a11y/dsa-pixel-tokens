/**
 * DSA Fantasy VTT — Pixel-Art Tokens + Dynamic VFX
 * Animated LPC sprite sheet support + PIXI.Graphics spell effects for FoundryVTT
 * v0.4.0 — compatible with FoundryVTT v12
 */

import { hasVFX, hasProjectileVFX, spawnVFX, spawnProjectileVFX } from "./vfx.mjs";

const MODULE_ID = "dsa-pixel-tokens";
const SPRITE_NAME = `${MODULE_ID}-sprite`;
const SPRITE_LAYER_NAME = `${MODULE_ID}-layer`;

// ─── Default Config ───────────────────────────────────────────────────────────

const DEFAULTS = {
  enabled:       false,
  spriteSheet:   "",
  frameWidth:    64,
  frameHeight:   64,
  framesPerDir:  9,
  fps:           8,
  scale:         1.0,
  offsetX:       0,
  offsetY:       0,
  idleFrame:     0,   // LPC: frame 0 = stand pose
  // This sheet: 0=Up, 1=Left, 2=Down, 3=Right
  rowDown:       2,
  rowLeft:       1,
  rowRight:      3,
  rowUp:         0,
};

// Direction constants
const DIR = { DOWN: "down", LEFT: "left", RIGHT: "right", UP: "up" };

// ─── Texture Cache ────────────────────────────────────────────────────────────

/** @type {Map<string, { textures: Map<string, PIXI.Texture[]>, width: number, height: number }>} */
const _sheetCache = new Map();

async function getSheetTextures(src, cfg) {
  const key = `${src}|${cfg.frameWidth}|${cfg.frameHeight}|${cfg.framesPerDir}`;
  if (_sheetCache.has(key)) return _sheetCache.get(key);

  let baseTexture;
  try {
    baseTexture = await loadTexture(src);
  } catch (e) {
    console.error(`[${MODULE_ID}] Failed to load sprite sheet: ${src}`, e);
    return null;
  }
  if (!baseTexture?.baseTexture) return null;

  const bt = baseTexture.baseTexture;
  const { frameWidth: fw, frameHeight: fh, framesPerDir: fpd } = cfg;

  const rowMap = {
    [DIR.DOWN]:  cfg.rowDown,
    [DIR.LEFT]:  cfg.rowLeft,
    [DIR.RIGHT]: cfg.rowRight,
    [DIR.UP]:    cfg.rowUp,
  };

  const textures = new Map();
  for (const [dir, row] of Object.entries(rowMap)) {
    const frames = [];
    for (let col = 0; col < fpd; col++) {
      const rect = new PIXI.Rectangle(col * fw, row * fh, fw, fh);
      frames.push(new PIXI.Texture(bt, rect));
    }
    textures.set(dir, frames);
  }

  const result = { textures, width: fw, height: fh };
  _sheetCache.set(key, result);
  return result;
}

// ─── Direction Math ───────────────────────────────────────────────────────────

function calcDirection(dx, dy) {
  if (dx === 0 && dy === 0) return null;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? DIR.RIGHT : DIR.LEFT;
  }
  return dy > 0 ? DIR.DOWN : DIR.UP;
}

// ─── Sprite Management ────────────────────────────────────────────────────────

function getSprite(token) {
  return token.children?.find(c => c.name === SPRITE_NAME) ?? null;
}

function removeSprite(token) {
  const s = getSprite(token);
  if (s) s.destroy({ children: true });
  // Restore default mesh visibility
  if (token.mesh) token.mesh.visible = true;
}

async function applySprite(token) {
  const cfg = getTokenConfig(token);
  if (!cfg.enabled || !cfg.spriteSheet) {
    removeSprite(token);
    return;
  }

  // Remove stale sprite first
  removeSprite(token);

  const sheet = await getSheetTextures(cfg.spriteSheet, cfg);
  if (!sheet) {
    console.warn(`[${MODULE_ID}] Could not load sheet for token ${token.document?.name}`);
    return;
  }

  const idleFrames = sheet.textures.get(DIR.DOWN);
  if (!idleFrames?.length) return;

  // Create animated sprite
  const sprite = new PIXI.AnimatedSprite(idleFrames);
  sprite.name = SPRITE_NAME;
  sprite.animationSpeed = cfg.fps / 60;
  sprite.loop = true;
  sprite.stop();
  sprite.gotoAndStop(cfg.idleFrame); // frame 0 = stand pose (LPC standard)

  // Scale to token size
  const gridSize = canvas.grid?.size ?? 100;
  const tokenW = (token.document?.width ?? 1) * gridSize;
  const tokenH = (token.document?.height ?? 1) * gridSize;
  const scaleX = (tokenW / sheet.width) * cfg.scale;
  const scaleY = (tokenH / sheet.height) * cfg.scale;
  const uniformScale = Math.min(scaleX, scaleY);

  sprite.scale.set(uniformScale);
  sprite.anchor.set(0.5, 0.5);

  // Center on token
  sprite.x = tokenW / 2 + cfg.offsetX;
  sprite.y = tokenH / 2 + cfg.offsetY;

  // Pixel-perfect rendering
  sprite.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;

  // Hide default token image mesh
  if (token.mesh) token.mesh.visible = false;

  token.addChild(sprite);

  // Store runtime state on the sprite itself (avoids polluting the Token object)
  sprite._pixelMeta = {
    cfg,
    sheet,
    currentDir: DIR.DOWN,
    moving: false,
    moveTimer: null,
  };
}

// ─── Animation State ──────────────────────────────────────────────────────────

function showIdle(token, dir) {
  const sprite = getSprite(token);
  if (!sprite?._pixelMeta) return;
  const { sheet, cfg } = sprite._pixelMeta;
  const direction = dir ?? sprite._pixelMeta.currentDir ?? DIR.DOWN;
  const frames = sheet.textures.get(direction);
  if (!frames) return;
  sprite.textures = frames;
  sprite.stop();
  sprite.gotoAndStop(sprite._pixelMeta.cfg.idleFrame);
  sprite._pixelMeta.currentDir = direction;
  sprite._pixelMeta.moving = false;
}

function showWalk(token, dir) {
  const sprite = getSprite(token);
  if (!sprite?._pixelMeta) return;
  const { sheet } = sprite._pixelMeta;
  const frames = sheet.textures.get(dir);
  if (!frames) return;
  sprite.textures = frames;
  sprite._pixelMeta.currentDir = dir;
  sprite._pixelMeta.moving = true;
  if (!sprite.playing) sprite.play();
}

// ─── Config Helper ────────────────────────────────────────────────────────────

function getTokenConfig(token) {
  const flags = token.document?.getFlag(MODULE_ID, "spriteConfig") ?? {};
  return foundry.utils.mergeObject({ ...DEFAULTS }, flags, { inplace: false });
}

// ─── Movement Tracking ────────────────────────────────────────────────────────

/** Stores last known grid position per tokenDocument id */
const _lastPos = new Map();

// ─── FoundryVTT Hooks ─────────────────────────────────────────────────────────

Hooks.once("init", () => {
  console.log(`[${MODULE_ID}] Initializing DSA Pixel-Art Tokens`);
  game.settings.register(MODULE_ID, "macrosCreated", {
    scope: "world", config: false, type: Boolean, default: false,
  });
});

Hooks.once("ready", async () => {
  console.log(`[${MODULE_ID}] Ready`);
  if (game.user.isGM && !game.settings.get(MODULE_ID, "macrosCreated")) {
    await createEffectMacros();
    await game.settings.set(MODULE_ID, "macrosCreated", true);
  }
});

// Called when a token is fully drawn (placed or scene loaded)
Hooks.on("drawToken", async (token) => {
  await applySprite(token);
});

// Called when token properties are refreshed (selection, visibility, etc.)
Hooks.on("refreshToken", (token) => {
  const sprite = getSprite(token);
  if (!sprite) return;
  // Keep mesh hidden if we have a sprite
  if (token.mesh) token.mesh.visible = false;
});

// Called when token document is updated (movement, flag changes, etc.)
Hooks.on("updateToken", async (tokenDoc, changes, _options, _userId) => {
  const token = tokenDoc.object;
  if (!token) return;

  // Re-apply sprite if our config flags changed
  if (changes.flags?.[MODULE_ID]) {
    // Clear cache for this token's old sheet so fresh textures load
    await applySprite(token);
    return;
  }

  // Handle movement animation
  const sprite = getSprite(token);
  if (!sprite?._pixelMeta) return;

  const movedX = "x" in changes;
  const movedY = "y" in changes;
  if (!movedX && !movedY) return;

  const prev = _lastPos.get(tokenDoc.id) ?? { x: tokenDoc.x, y: tokenDoc.y };
  const newX = changes.x ?? tokenDoc.x;
  const newY = changes.y ?? tokenDoc.y;
  const dx = newX - prev.x;
  const dy = newY - prev.y;

  _lastPos.set(tokenDoc.id, { x: newX, y: newY });

  const dir = calcDirection(dx, dy);
  if (!dir) return;

  // Play walk animation
  showWalk(token, dir);

  // Clear any existing stop timer
  if (sprite._pixelMeta.moveTimer) {
    clearTimeout(sprite._pixelMeta.moveTimer);
  }

  // Calculate approximate movement duration
  const dist = Math.sqrt(dx * dx + dy * dy);
  const moveDuration = Math.max(300, dist * 15); // ~15ms per grid unit

  sprite._pixelMeta.moveTimer = setTimeout(() => {
    showIdle(token, dir);
    sprite._pixelMeta.moveTimer = null;
  }, moveDuration);
});

// Cleanup on token delete
Hooks.on("deleteToken", (tokenDoc) => {
  _lastPos.delete(tokenDoc.id);
});

// ─── Schaden-Reaktionen ───────────────────────────────────────────────────────

/** Liest LP-Wert aus verschiedenen Systemen (gdsa, D&D5e, PF2e, ...) */
function _getActorHP(actor) {
  return actor.system?.LeP?.value
    ?? actor.system?.base?.LeP
    ?? actor.system?.status?.LeP
    ?? actor.system?.attributes?.hp?.value
    ?? actor.system?.hp?.value
    ?? null;
}

Hooks.on("preUpdateActor", (actor, changes) => {
  // ── LeP (HP) change ───────────────────────────────────────────────────────
  const newHP =
    changes.system?.LeP?.value         ??
    changes.system?.base?.LeP          ??
    changes.system?.status?.LeP        ??
    changes.system?.attributes?.hp?.value ??
    changes.system?.hp?.value          ??
    null;

  if (newHP !== null) {
    const oldHP = _getActorHP(actor);
    if (oldHP !== null && newHP < oldHP) {
      const diff = newHP - oldHP;
      const tokens = actor.getActiveTokens?.() ?? [];
      for (const token of tokens) {
        const { x, y } = token.center;
        setTimeout(() => {
          spawnEffect(x, y, "schadenflash");
          _showDamageNumber(token, diff, 0xff3333, "SP");
        }, 50);
        if (newHP <= 0 && oldHP > 0) {
          setTimeout(() => spawnEffect(x, y, "tod_animation"), 150);
        }
      }
    }
  }

  // ── AsP change ────────────────────────────────────────────────────────────
  const newAsP =
    changes.system?.AsP?.value                    ??
    changes.system?.status?.astralenergie?.value  ??
    changes.system?.base?.astralenergie?.value    ??
    changes.system?.status?.AsP                  ??
    changes.system?.base?.AsP                    ??
    changes.system?.mana?.value                  ??
    null;

  if (newAsP !== null) {
    const oldAsP = _getActorAsP(actor)?.val;
    if (oldAsP !== null && oldAsP !== undefined && newAsP < oldAsP) {
      const diff = newAsP - oldAsP;
      const tokens = actor.getActiveTokens?.() ?? [];
      for (const token of tokens) {
        setTimeout(() => _showDamageNumber(token, diff, 0x33aaff, "AsP"), 80);
      }
    }
  }
});

// ─── Token Config UI ──────────────────────────────────────────────────────────

// ─── Status-Indikatoren ───────────────────────────────────────────────────────

const STATUS_LAYER = `${MODULE_ID}-status`;

/** Mappt Foundry Status-IDs auf Icon-Pfade */
const STATUS_ICONS = {
  // Standard Foundry
  dead:        `modules/${MODULE_ID}/assets/status/tot.png`,
  poison:      `modules/${MODULE_ID}/assets/status/vergiftet.png`,
  stun:        `modules/${MODULE_ID}/assets/status/betaeubt.png`,
  unconscious: `modules/${MODULE_ID}/assets/status/betaeubt.png`,
  bless:       `modules/${MODULE_ID}/assets/status/gesegnet.png`,
  paralysis:   `modules/${MODULE_ID}/assets/status/gelaeumt.png`,
  confusion:   `modules/${MODULE_ID}/assets/status/verwirrt.png`,
  blind:       `modules/${MODULE_ID}/assets/status/blind.png`,
  burning:     `modules/${MODULE_ID}/assets/status/brennend.png`,
  // gdsa-spezifische Status-IDs
  vergiftet:   `modules/${MODULE_ID}/assets/status/vergiftet.png`,
  "bet\u00e4ubt": `modules/${MODULE_ID}/assets/status/betaeubt.png`,
  gesegnet:    `modules/${MODULE_ID}/assets/status/gesegnet.png`,
  "gel\u00e4hmt": `modules/${MODULE_ID}/assets/status/gelaeumt.png`,
  verwirrt:    `modules/${MODULE_ID}/assets/status/verwirrt.png`,
};

async function refreshStatusIcons(token) {
  // Alte Icons entfernen
  const old = token.children?.find(c => c.name === STATUS_LAYER);
  if (old) old.destroy({ children: true });

  const statuses = token.document?.statuses ?? new Set();
  if (!statuses.size) return;

  const container = new PIXI.Container();
  container.name = STATUS_LAYER;

  const gridSize = canvas.grid?.size ?? 100;
  const iconSize = Math.max(16, Math.round(gridSize * 0.25));
  const tokenW   = (token.document?.width  ?? 1) * gridSize;

  let col = 0;
  const maxCols = Math.max(1, Math.floor(tokenW / (iconSize + 2)));

  for (const statusId of statuses) {
    const iconPath = STATUS_ICONS[statusId];
    if (!iconPath) continue;
    try {
      const tex = await loadTexture(iconPath);
      if (!tex) continue;
      const icon = new PIXI.Sprite(tex);
      icon.width  = iconSize;
      icon.height = iconSize;
      icon.x = col * (iconSize + 2);
      icon.y = -iconSize - 4;
      icon.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
      container.addChild(icon);
      col++;
      if (col >= maxCols) break;
    } catch { /* Icon fehlt – überspringen */ }
  }

  if (container.children.length > 0) {
    token.addChild(container);
  } else {
    container.destroy();
  }
}

// Status beim Zeichnen eines Tokens setzen
Hooks.on("drawToken", async (token) => {
  await refreshStatusIcons(token);
});

// Status bei Token-Updates aktualisieren (v12: statuses kann direkt oder via effects kommen)
Hooks.on("updateToken", async (tokenDoc, changes) => {
  const relevant = "statuses" in changes || "effects" in changes || "overlayEffect" in changes;
  if (!relevant) return;
  const token = tokenDoc.object;
  if (token) await refreshStatusIcons(token);
});

// v12: Status-Effekte kommen oft als ActiveEffect auf dem Actor an
function _refreshTokensForActor(actor) {
  if (!canvas?.tokens?.placeables) return;
  for (const token of canvas.tokens.placeables) {
    if (token.actor?.id === actor?.id) refreshStatusIcons(token);
  }
}
Hooks.on("createActiveEffect", (effect) => _refreshTokensForActor(effect.parent));
Hooks.on("deleteActiveEffect", (effect) => _refreshTokensForActor(effect.parent));
Hooks.on("updateActiveEffect", (effect) => _refreshTokensForActor(effect.parent));

Hooks.on("renderTokenConfig", (app, html, _data) => {
  const tokenDoc = app.document ?? app.token;
  if (!tokenDoc) return;

  const cfg = getTokenConfig({ document: tokenDoc });

  // Build the Pixel-Art tab content
  const tabHTML = `
    <div class="tab dsa-pixel-tab" data-tab="pixel-art" data-group="main">
      <div class="form-group">
        <label>
          <input type="checkbox"
            name="flags.${MODULE_ID}.spriteConfig.enabled"
            ${cfg.enabled ? "checked" : ""}>
          Pixel-Art Sprite aktivieren
        </label>
      </div>

      <div class="dsa-pixel-settings" ${cfg.enabled ? "" : 'style="display:none"'}>
        <div class="form-group">
          <label>Sprite Sheet</label>
          <div class="form-fields">
            <input type="text"
              name="flags.${MODULE_ID}.spriteConfig.spriteSheet"
              value="${cfg.spriteSheet}"
              placeholder="modules/dsa-pixel-tokens/assets/hero.png">
            <button type="button"
              class="file-picker" data-type="imagevideo"
              data-target="flags.${MODULE_ID}.spriteConfig.spriteSheet"
              title="Datei auswählen">
              <i class="fas fa-file-import"></i>
            </button>
          </div>
          <p class="hint">
            LPC-Format: 4 Reihen, je N Frames pro Richtung.<br>
            Gratis Sheets: <strong>opengameart.org</strong> → LPC Spritesheet
          </p>
        </div>

        <div class="form-group two-col">
          <div>
            <label>Frame-Breite (px)</label>
            <input type="number"
              name="flags.${MODULE_ID}.spriteConfig.frameWidth"
              value="${cfg.frameWidth}" min="8" max="256">
          </div>
          <div>
            <label>Frame-Höhe (px)</label>
            <input type="number"
              name="flags.${MODULE_ID}.spriteConfig.frameHeight"
              value="${cfg.frameHeight}" min="8" max="256">
          </div>
        </div>

        <div class="form-group two-col">
          <div>
            <label>Frames/Richtung</label>
            <input type="number"
              name="flags.${MODULE_ID}.spriteConfig.framesPerDir"
              value="${cfg.framesPerDir}" min="1" max="16">
          </div>
          <div>
            <label>Animations-FPS</label>
            <input type="number"
              name="flags.${MODULE_ID}.spriteConfig.fps"
              value="${cfg.fps}" min="1" max="60">
          </div>
        </div>

        <div class="form-group two-col">
          <div>
            <label>Idle Frame (Index)</label>
            <input type="number"
              name="flags.${MODULE_ID}.spriteConfig.idleFrame"
              value="${cfg.idleFrame}" min="0" max="15">
          </div>
          <div>
            <p class="hint" style="margin-top:20px">LPC: 0 = Standpose</p>
          </div>
        </div>

        <div class="form-group two-col">
          <div>
            <label>Skalierung</label>
            <input type="number"
              name="flags.${MODULE_ID}.spriteConfig.scale"
              value="${cfg.scale}" min="0.1" max="4" step="0.1">
          </div>
          <div>
            <label>X/Y-Versatz</label>
            <div style="display:flex;gap:4px">
              <input type="number"
                name="flags.${MODULE_ID}.spriteConfig.offsetX"
                value="${cfg.offsetX}" style="width:60px" title="X-Versatz">
              <input type="number"
                name="flags.${MODULE_ID}.spriteConfig.offsetY"
                value="${cfg.offsetY}" style="width:60px" title="Y-Versatz">
            </div>
          </div>
        </div>

        <details>
          <summary style="cursor:pointer;font-weight:bold;margin-bottom:6px">
            Reihen-Reihenfolge (Richtungen)
          </summary>
          <div class="form-group two-col">
            <div>
              <label>Unten = Reihe</label>
              <input type="number"
                name="flags.${MODULE_ID}.spriteConfig.rowDown"
                value="${cfg.rowDown}" min="0" max="7">
            </div>
            <div>
              <label>Links = Reihe</label>
              <input type="number"
                name="flags.${MODULE_ID}.spriteConfig.rowLeft"
                value="${cfg.rowLeft}" min="0" max="7">
            </div>
          </div>
          <div class="form-group two-col">
            <div>
              <label>Rechts = Reihe</label>
              <input type="number"
                name="flags.${MODULE_ID}.spriteConfig.rowRight"
                value="${cfg.rowRight}" min="0" max="7">
            </div>
            <div>
              <label>Oben = Reihe</label>
              <input type="number"
                name="flags.${MODULE_ID}.spriteConfig.rowUp"
                value="${cfg.rowUp}" min="0" max="7">
            </div>
          </div>
          <p class="hint">Standard LPC: Unten=0, Links=1, Rechts=2, Oben=3</p>
        </details>
      </div>
    </div>
  `;

  // Insert navigation tab
  const tabNav = html.find('.tabs[data-group="main"]');
  tabNav.append(`
    <a class="item" data-tab="pixel-art" data-group="main">
      <i class="fas fa-gamepad"></i> Pixel-Art
    </a>
  `);

  // Insert tab content after last tab
  html.find('.tab').last().after(tabHTML);

  // Toggle settings visibility on checkbox change
  html.find(`input[name="flags.${MODULE_ID}.spriteConfig.enabled"]`)
    .on("change", function () {
      html.find(".dsa-pixel-settings").toggle(this.checked);
    });

  // File picker button handler (v12 fix)
  html.find(".file-picker[data-target]").on("click", function () {
    const target = this.dataset.target;
    const input = html.find(`input[name="${target}"]`)[0];
    new FilePicker({
      type: "imagevideo",
      current: input?.value ?? "",
      callback: (path) => {
        if (input) input.value = path;
      },
    }).browse("modules/dsa-pixel-tokens/assets/");
  });

  // Re-init tabs to pick up new entry
  app.activateTab?.("identity") ?? app._tabs?.[0]?.bind?.(html[0]);
  app.setPosition({ height: "auto" });
});

// ─── Exports (for potential macro use) ────────────────────────────────────────

// ─── Effect System ────────────────────────────────────────────────────────────

// type:  "target"     → spielt an anvisierten / ausgewählten Token
//        "aura"       → spielt am Caster-Token (1 Token auswählen)
//        "projectile" → fliegt von Token A zu Token B (2 Token auswählen), impact = Einschlag
//        "zone"       → wird an Canvas-Position platziert (Token anvisieren oder Maus)
// duration: ms, wie lange Zone-/Aura-Effekte loopen (0 = einmal abspielen)

const EFFECT_PRESETS = {
  // ── Bestehende ────────────────────────────────────────────────────────────
  explosion:    { src: "modules/dsa-pixel-tokens/assets/fx_explosion.png",    frames: 10, fps: 12, scaleGrid: 5,  sound: "modules/dsa-pixel-tokens/assets/sounds/magic1.wav",  type: "zone"                           },
  eis:          { src: "modules/dsa-pixel-tokens/assets/fx_eis.png",          frames: 8,  fps: 10, scale: 2.0,    sound: "modules/dsa-pixel-tokens/assets/sounds/random1.wav", type: "target"                         },
  blitz:        { src: "modules/dsa-pixel-tokens/assets/fx_blitz.png",        frames: 6,  fps: 14, scale: 2.5,    sound: "modules/dsa-pixel-tokens/assets/sounds/random2.wav", type: "target"                         },
  heilung:      { src: "modules/dsa-pixel-tokens/assets/fx_heilung.png",      frames: 8,  fps: 10, scale: 2.0,    sound: "modules/dsa-pixel-tokens/assets/sounds/bubble.wav",  type: "target"                         },
  gift:         { src: "modules/dsa-pixel-tokens/assets/fx_gift.png",         frames: 8,  fps: 10, scale: 2.0,    sound: "modules/dsa-pixel-tokens/assets/sounds/bubble.wav",  type: "target"                         },
  schatten:     { src: "modules/dsa-pixel-tokens/assets/fx_schatten.png",     frames: 8,  fps: 10, scale: 2.0,    sound: "modules/dsa-pixel-tokens/assets/sounds/spell.wav",   type: "target"                         },
  wasser:       { src: "modules/dsa-pixel-tokens/assets/fx_wasser.png",       frames: 8,  fps: 10, scale: 2.0,    sound: "modules/dsa-pixel-tokens/assets/sounds/random1.wav", type: "target"                         },
  // ── DSA-Zauber Welle 1 ────────────────────────────────────────────────────
  pfeil:        { src: "modules/dsa-pixel-tokens/assets/fx_pfeil.png",        frames: 5,  fps: 16, scale: 2.0,    sound: null,                                                 type: "projectile", impact: "schadenflash" },
  flammenpfeil: { src: "modules/dsa-pixel-tokens/assets/fx_flammenpfeil.png", frames: 7,  fps: 14, scale: 2.0,    sound: "modules/dsa-pixel-tokens/assets/sounds/spell.wav",   type: "projectile", impact: "feuerball" },
  donnerkeil:   { src: "modules/dsa-pixel-tokens/assets/fx_donnerkeil.png",   frames: 10, fps: 14, scaleGrid: 3,  sound: "modules/dsa-pixel-tokens/assets/sounds/random2.wav", type: "projectile", impact: "explosion" },
  armatrutz:    { src: "modules/dsa-pixel-tokens/assets/fx_armatrutz.png",    frames: 10, fps: 8,  scaleGrid: 2,  sound: "modules/dsa-pixel-tokens/assets/sounds/bubble.wav",  type: "aura",       duration: 2000      },
  balsamsal:    { src: "modules/dsa-pixel-tokens/assets/fx_balsamsal.png",    frames: 10, fps: 9,  scale: 2.5,    sound: "modules/dsa-pixel-tokens/assets/sounds/bubble.wav",  type: "target"                         },
  horriphobus:  { src: "modules/dsa-pixel-tokens/assets/fx_horriphobus.png",  frames: 9,  fps: 10, scaleGrid: 2,  sound: "modules/dsa-pixel-tokens/assets/sounds/spell.wav",   type: "target"                         },
  invocatio:    { src: "modules/dsa-pixel-tokens/assets/fx_invocatio.png",    frames: 12, fps: 8,  scaleGrid: 2,  sound: "modules/dsa-pixel-tokens/assets/sounds/magic1.wav",  type: "zone",       duration: 3000      },
  daemonenbann: { src: "modules/dsa-pixel-tokens/assets/fx_daemonenbann.png", frames: 8,  fps: 12, scaleGrid: 2,  sound: "modules/dsa-pixel-tokens/assets/sounds/magic1.wav",  type: "zone",       duration: 2000      },
  motoricus:    { src: "modules/dsa-pixel-tokens/assets/fx_motoricus.png",    frames: 8,  fps: 10, scale: 2.0,    sound: "modules/dsa-pixel-tokens/assets/sounds/random1.wav", type: "target"                         },
  visibili:     { src: "modules/dsa-pixel-tokens/assets/fx_visibili.png",     frames: 8,  fps: 9,  scaleGrid: 2,  sound: "modules/dsa-pixel-tokens/assets/sounds/random1.wav", type: "aura"                           },
  odem:         { src: "modules/dsa-pixel-tokens/assets/fx_odem.png",         frames: 10, fps: 8,  scale: 2.5,    sound: "modules/dsa-pixel-tokens/assets/sounds/random1.wav", type: "projectile", impact: "gift"      },
  // ── DSA-Zauber Welle 2 ────────────────────────────────────────────────────
  brennen:      { src: "modules/dsa-pixel-tokens/assets/fx_brennen.png",      frames: 10, fps: 10, scaleGrid: 1,  sound: "modules/dsa-pixel-tokens/assets/sounds/spell.wav",   type: "aura",       duration: 3000      },
  schattenform: { src: "modules/dsa-pixel-tokens/assets/fx_schattenform.png", frames: 10, fps: 9,  scaleGrid: 2,  sound: "modules/dsa-pixel-tokens/assets/sounds/spell.wav",   type: "aura"                           },
  wind:         { src: "modules/dsa-pixel-tokens/assets/fx_wind.png",         frames: 8,  fps: 10, scaleGrid: 2,  sound: "modules/dsa-pixel-tokens/assets/sounds/random1.wav", type: "zone",       duration: 2000      },
  paralysis:    { src: "modules/dsa-pixel-tokens/assets/fx_paralysis.png",    frames: 9,  fps: 9,  scaleGrid: 1,  sound: "modules/dsa-pixel-tokens/assets/sounds/random2.wav", type: "aura",       duration: 3000      },
  silentium:    { src: "modules/dsa-pixel-tokens/assets/fx_silentium.png",    frames: 9,  fps: 8,  scaleGrid: 2,  sound: "modules/dsa-pixel-tokens/assets/sounds/bubble.wav",  type: "aura",       duration: 2500      },
  portal:       { src: "modules/dsa-pixel-tokens/assets/fx_portal.png",       frames: 12, fps: 10, scaleGrid: 3,  sound: "modules/dsa-pixel-tokens/assets/sounds/magic1.wav",  type: "zone",       duration: 3000      },
  planastral:   { src: "modules/dsa-pixel-tokens/assets/fx_planastral.png",   frames: 14, fps: 8,  scaleGrid: 4,  sound: "modules/dsa-pixel-tokens/assets/sounds/magic1.wav",  type: "zone",       duration: 4000      },
  verwandlung:  { src: "modules/dsa-pixel-tokens/assets/fx_verwandlung.png",  frames: 10, fps: 10, scale: 2.5,    sound: "modules/dsa-pixel-tokens/assets/sounds/magic1.wav",  type: "aura"                           },
  // ── Welle 3 (AOE-Flächeneffekte) ─────────────────────────────────────────
  pandemonium:  { src: "modules/dsa-pixel-tokens/assets/fx_pandemonium.png",  frames: 14, fps: 8,  scaleGrid: 5,  sound: "modules/dsa-pixel-tokens/assets/sounds/magic1.wav",  type: "zone",       duration: 5000      },
  fesselranken: { src: "modules/dsa-pixel-tokens/assets/fx_fesselranken.png", frames: 12, fps: 9,  scaleGrid: 3,  sound: "modules/dsa-pixel-tokens/assets/sounds/random1.wav", type: "zone",       duration: 4000      },
  // ── Welle 4 — Neue DSA-Zauber ─────────────────────────────────────────────
  attributo:    { src: "modules/dsa-pixel-tokens/assets/fx_attributo.png",    frames: 8,  fps: 10, scaleGrid: 2, sound: "modules/dsa-pixel-tokens/assets/sounds/bubble.wav",  type: "aura"                               },
  respondami:   { src: "modules/dsa-pixel-tokens/assets/fx_respondami.png",   frames: 8,  fps: 10, scaleGrid: 2, sound: "modules/dsa-pixel-tokens/assets/sounds/random1.wav", type: "target"                             },
  aquafaxius:   { src: "modules/dsa-pixel-tokens/assets/fx_aquafaxius.png",   frames: 9,  fps: 12, scale: 2.5,   sound: "modules/dsa-pixel-tokens/assets/sounds/random1.wav", type: "projectile", impact: "wasser"       },
  fulminictus:  { src: "modules/dsa-pixel-tokens/assets/fx_fulminictus.png",  frames: 8,  fps: 14, scaleGrid: 2, sound: "modules/dsa-pixel-tokens/assets/sounds/random2.wav", type: "target"                             },
  // ── Elementar-Bälle (Projektil → AOE Explosion, 5 Grid Radius) ────────────
  feuerball:    { src: "modules/dsa-pixel-tokens/assets/fx_feuerball.png",    frames: 8,  fps: 12, scale: 2.0,   sound: "modules/dsa-pixel-tokens/assets/sounds/spell.wav",   type: "projectile", impact: "feuerball",  impactRadius: 5 },
  eisball:      { src: "modules/dsa-pixel-tokens/assets/fx_eis.png",          frames: 8,  fps: 12, scale: 2.0,   sound: "modules/dsa-pixel-tokens/assets/sounds/random1.wav", type: "projectile", impact: "eis",        impactRadius: 5 },
  blitzball:    { src: "modules/dsa-pixel-tokens/assets/fx_blitz.png",        frames: 6,  fps: 14, scale: 2.0,   sound: "modules/dsa-pixel-tokens/assets/sounds/random2.wav", type: "projectile", impact: "blitz",      impactRadius: 5 },
  giftball:     { src: "modules/dsa-pixel-tokens/assets/fx_gift.png",         frames: 8,  fps: 12, scale: 2.0,   sound: "modules/dsa-pixel-tokens/assets/sounds/bubble.wav",  type: "projectile", impact: "gift",       impactRadius: 5 },
  wasserball:   { src: "modules/dsa-pixel-tokens/assets/fx_wasser.png",       frames: 8,  fps: 12, scale: 2.0,   sound: "modules/dsa-pixel-tokens/assets/sounds/random1.wav", type: "projectile", impact: "wasser",     impactRadius: 5 },
  schattenball: { src: "modules/dsa-pixel-tokens/assets/fx_schatten.png",     frames: 8,  fps: 12, scale: 2.0,   sound: "modules/dsa-pixel-tokens/assets/sounds/spell.wav",   type: "projectile", impact: "schatten",   impactRadius: 5 },
  // ── Elementar-Pfeile / Pfeil des Elements (DSA 4.1) ───────────────────────
  pfeil_feuer:  { src: "modules/dsa-pixel-tokens/assets/fx_flammenpfeil.png", frames: 7,  fps: 14, scale: 1.5,   sound: "modules/dsa-pixel-tokens/assets/sounds/spell.wav",   type: "projectile", impact: "feuerball"       },
  pfeil_eis:    { src: "modules/dsa-pixel-tokens/assets/fx_eis.png",          frames: 8,  fps: 14, scale: 1.5,   sound: "modules/dsa-pixel-tokens/assets/sounds/random1.wav", type: "projectile", impact: "eis"             },
  pfeil_erz:    { src: "modules/dsa-pixel-tokens/assets/fx_blitz.png",        frames: 6,  fps: 16, scale: 1.5,   sound: "modules/dsa-pixel-tokens/assets/sounds/random2.wav", type: "projectile", impact: "schadenflash"    },
  pfeil_humus:  { src: "modules/dsa-pixel-tokens/assets/fx_gift.png",         frames: 8,  fps: 14, scale: 1.5,   sound: "modules/dsa-pixel-tokens/assets/sounds/bubble.wav",  type: "projectile", impact: "gift"            },
  pfeil_luft:   { src: "modules/dsa-pixel-tokens/assets/fx_wind.png",         frames: 8,  fps: 14, scale: 1.5,   sound: "modules/dsa-pixel-tokens/assets/sounds/random1.wav", type: "projectile", impact: "wind"            },
  pfeil_wasser: { src: "modules/dsa-pixel-tokens/assets/fx_wasser.png",       frames: 8,  fps: 14, scale: 1.5,   sound: "modules/dsa-pixel-tokens/assets/sounds/random1.wav", type: "projectile", impact: "wasser"          },
  // ── Kampf-Reaktionen (automatisch via Hook) ──────────────────────────────
  schadenflash: { src: "modules/dsa-pixel-tokens/assets/fx_schadenflash.png", frames: 6,  fps: 18, scaleGrid: 2, sound: null,                                                 type: "target"                             },
  tod_animation:{ src: "modules/dsa-pixel-tokens/assets/fx_tod_animation.png",frames: 12, fps: 10, scaleGrid: 2, sound: "modules/dsa-pixel-tokens/assets/sounds/magic1.wav",  type: "target"                             },
};

const ZONE_PRESETS = {
  zone_feuer:   { src: `modules/dsa-pixel-tokens/assets/zone_feuer.png`,   frames: 8, fps: 12, tileSize: 64, zoneType: "fill",    persistent: true,  label: "Feuerzone",   icon: "🔥" },
  zone_eis:     { src: `modules/dsa-pixel-tokens/assets/zone_eis.png`,     frames: 6, fps: 8,  tileSize: 64, zoneType: "fill",    persistent: true,  label: "Eiszone",     icon: "❄️" },
  zone_gift:    { src: `modules/dsa-pixel-tokens/assets/zone_gift.png`,    frames: 8, fps: 10, tileSize: 64, zoneType: "fill",    persistent: true,  label: "Giftzone",    icon: "☠️" },
  zone_heilung: { src: `modules/dsa-pixel-tokens/assets/zone_heilung.png`, frames: 8, fps: 10, tileSize: 64, zoneType: "fill",    persistent: true,  label: "Heilzone",    icon: "✨" },
  zone_sturm:   { src: `modules/dsa-pixel-tokens/assets/zone_sturm.png`,   frames: 8, fps: 14, tileSize: 64, zoneType: "scatter", persistent: false, label: "Sturmzone",   icon: "⚡" },
  zone_dunkel:  { src: `modules/dsa-pixel-tokens/assets/zone_dunkel.png`,  frames: 8, fps: 10, tileSize: 64, zoneType: "fill",    persistent: true,  label: "Dunkelzone",  icon: "🌑" },
};

// templateId → Array of PIXI.AnimatedSprite (persistent zone tiles)
const _zoneSprites = new Map();

/**
 * Spawn a one-shot effect at canvas coordinates.
 * Tries the dynamic PIXI.Graphics VFX engine first; falls back to sprite sheet.
 * @param {number} x - Canvas X position
 * @param {number} y - Canvas Y position
 * @param {string|object} effect - Preset name ("feuerball") or config object
 * @param {object} [opts] - Optional overrides: { frames, fps, scale, frameSize }
 */
async function spawnEffect(x, y, effect, opts = {}) {
  // ── Dynamic VFX first (PIXI.Graphics, no sprite sheet needed) ──────────────
  const effectName = typeof effect === "string" ? effect : null;
  if (effectName && hasVFX(effectName)) {
    await spawnVFX(x, y, effectName, opts);
    return null; // Handled by VFX engine
  }

  const preset = typeof effect === "string" ? EFFECT_PRESETS[effect] : effect;
  if (!preset) { console.warn(`[${MODULE_ID}] Unknown effect: ${effect}`); return; }

  const gridSize = canvas.grid?.size ?? 100;
  // scaleGrid: size in grid fields (e.g. 5 = 5 grid fields wide)
  const autoScale = preset.scaleGrid ? (preset.scaleGrid * gridSize) / 64 : (preset.scale ?? 2.0);
  const cfg = { frameSize: 64, scale: autoScale, ...preset, ...opts };
  if (opts.scaleGrid) cfg.scale = (opts.scaleGrid * gridSize) / 64;
  const baseTexture = await loadTexture(cfg.src);
  if (!baseTexture?.baseTexture) return;

  const bt = baseTexture.baseTexture;
  bt.scaleMode = PIXI.SCALE_MODES.NEAREST;

  // Build frame textures (single row)
  const textures = [];
  for (let i = 0; i < cfg.frames; i++) {
    const rect = new PIXI.Rectangle(i * cfg.frameSize, 0, cfg.frameSize, cfg.frameSize);
    textures.push(new PIXI.Texture(bt, rect));
  }

  const sprite = new PIXI.AnimatedSprite(textures);
  sprite.animationSpeed = cfg.fps / 60;
  sprite.loop = false;
  sprite.anchor.set(0.5, 0.5);
  sprite.scale.set(cfg.scale);
  sprite.x = x;
  sprite.y = y;

  // Add to the interface layer (above tokens)
  const layer = canvas.interface ?? canvas.controls;
  layer.addChild(sprite);

  // Play sound if configured (v12-compatible)
  if (cfg.sound) {
    try {
      const AH = foundry.audio?.AudioHelper ?? AudioHelper;
      const sound = await AH.preloadSound(cfg.sound);
      sound?.play({ volume: 0.8, loop: false });
    } catch(e) {
      console.warn(`[${MODULE_ID}] Sound error:`, e);
    }
  }

  const cleanup = () => {
    if (sprite.destroyed) return;
    layer.removeChild(sprite);
    sprite.destroy({ children: true });
  };

  if (cfg.duration) {
    sprite.loop = true;
    sprite.play();
    setTimeout(() => { if (!sprite.destroyed) { sprite.loop = false; } }, cfg.duration);
  } else {
    sprite.loop = false;
    sprite.play();
  }
  sprite.onComplete = cleanup;

  return sprite;
}

/**
 * Spawn a projectile that travels from token A to token B, then explodes.
 * Tries the dynamic PIXI.Graphics VFX engine first; falls back to sprite sheet.
 * @param {Token} fromToken - Source token
 * @param {Token} toToken   - Target token
 * @param {string} projectile - Effect preset for travel (e.g. "feuerball")
 * @param {string} [impact]   - Effect preset for impact (e.g. "explosion")
 */
async function spawnProjectile(fromToken, toToken, projectile = "feuerball", impact = "explosion") {
  const preset = EFFECT_PRESETS[projectile];

  // ── Dynamic VFX first ───────────────────────────────────────────────────────
  if (hasProjectileVFX(projectile)) {
    await spawnProjectileVFX(fromToken, toToken, projectile, impact);
    // AOE: Impact-Effekt auf alle Tokens im Radius spawnen
    if (preset?.impactRadius && impact) {
      const tx = toToken.center?.x ?? toToken.x;
      const ty = toToken.center?.y ?? toToken.y;
      const radiusPx = preset.impactRadius * canvas.grid.size;
      for (const t of canvas.tokens.placeables) {
        if (t.id === fromToken.id) continue;
        if (t.id === toToken.id) continue; // Impact am Ziel kommt schon von spawnProjectileVFX
        const dx = (t.center?.x ?? t.x) - tx;
        const dy = (t.center?.y ?? t.y) - ty;
        if (Math.hypot(dx, dy) <= radiusPx) {
          spawnEffect(t.center?.x ?? t.x, t.center?.y ?? t.y, impact);
        }
      }
    }
    return;
  }

  const startX = fromToken.center.x;
  const startY = fromToken.center.y;
  const endX   = toToken.center.x;
  const endY   = toToken.center.y;

  const preset = EFFECT_PRESETS[projectile];
  if (!preset) return;

  const baseTexture = await loadTexture(preset.src);
  if (!baseTexture?.baseTexture) return;

  const bt = baseTexture.baseTexture;
  bt.scaleMode = PIXI.SCALE_MODES.NEAREST;
  const fs = preset.frameSize ?? 64;

  const textures = [];
  for (let i = 0; i < preset.frames; i++) {
    textures.push(new PIXI.Texture(bt, new PIXI.Rectangle(i * fs, 0, fs, fs)));
  }

  const sprite = new PIXI.AnimatedSprite(textures);
  sprite.animationSpeed = (preset.fps ?? 10) / 60;
  sprite.loop = true;
  sprite.anchor.set(0.5, 0.5);
  sprite.scale.set(preset.scale ?? 2.0);
  sprite.x = startX;
  sprite.y = startY;

  // Rotate toward target
  sprite.rotation = Math.atan2(endY - startY, endX - startX);

  const layer = canvas.interface ?? canvas.controls;
  layer.addChild(sprite);
  sprite.play();

  // Animate travel
  const dist   = Math.hypot(endX - startX, endY - startY);
  const speed  = 10; // pixels per tick
  const maxTicks = Math.max(Math.ceil(dist / speed), 1);
  let tick = 0;
  let done = false;

  const onTick = () => {
    try {
      if (done) return;
      tick++;
      const t = Math.min(tick / maxTicks, 1);
      sprite.x = startX + (endX - startX) * t;
      sprite.y = startY + (endY - startY) * t;

      if (t >= 1) {
        done = true;
        canvas.app.ticker.remove(onTick);
        layer.removeChild(sprite);
        sprite.destroy({ children: true });
        if (impact) spawnEffect(endX, endY, impact);
      }
    } catch(e) {
      done = true;
      canvas.app.ticker.remove(onTick);
      console.error(`[${MODULE_ID}] Projektil-Fehler:`, e);
      try { layer.removeChild(sprite); sprite.destroy(); } catch(_) {}
    }
  };

  canvas.app.ticker.add(onTick);
}

// ── Zone Spell System ────────────────────────────────────────────────────

function _getGridSquaresInTemplate(templateDoc) {
  const gridSize = canvas.grid.size;
  const { x: tx, y: ty } = templateDoc;
  const tObj = templateDoc.object;
  if (!tObj?.shape) return [];
  const b = tObj.shape.getBounds();
  const squares = [];
  const x0 = Math.floor(b.x / gridSize) * gridSize;
  const y0 = Math.floor(b.y / gridSize) * gridSize;
  const x1 = Math.ceil((b.x + b.width)  / gridSize) * gridSize;
  const y1 = Math.ceil((b.y + b.height) / gridSize) * gridSize;
  for (let ox = x0; ox < x1; ox += gridSize) {
    for (let oy = y0; oy < y1; oy += gridSize) {
      const cx = ox + gridSize / 2;
      const cy = oy + gridSize / 2;
      if (tObj.shape.contains(cx, cy)) {
        squares.push({ x: tx + cx, y: ty + cy });
      }
    }
  }
  return squares;
}

async function _spawnZoneTile(worldX, worldY, preset, templateId) {
  const baseTexture = await loadTexture(preset.src);
  if (!baseTexture?.baseTexture) return null;
  const bt = baseTexture.baseTexture;
  bt.scaleMode = PIXI.SCALE_MODES.NEAREST;
  const fs = preset.tileSize ?? 64;
  const textures = [];
  for (let i = 0; i < preset.frames; i++) {
    textures.push(new PIXI.Texture(bt, new PIXI.Rectangle(i * fs, 0, fs, fs)));
  }
  const sprite = new PIXI.AnimatedSprite(textures);
  sprite.animationSpeed = preset.fps / 60;
  sprite.loop = true;
  sprite.anchor.set(0.5);
  sprite.x = worldX;
  sprite.y = worldY;
  sprite.width  = canvas.grid.size;
  sprite.height = canvas.grid.size;
  sprite.alpha  = 0.85;
  sprite.blendMode = PIXI.BLEND_MODES.ADD;
  canvas.effects.addChild(sprite);
  sprite.play();
  if (!_zoneSprites.has(templateId)) _zoneSprites.set(templateId, []);
  _zoneSprites.get(templateId).push(sprite);
  return sprite;
}

function clearZoneSprites(templateId) {
  const sprites = _zoneSprites.get(templateId) ?? [];
  for (const s of sprites) {
    s.stop();
    s.destroy({ children: true });
  }
  _zoneSprites.delete(templateId);
}

async function spawnZoneEffect(templateDoc, zoneName) {
  const preset = ZONE_PRESETS[zoneName];
  if (!preset) return ui.notifications.warn(`Unbekannter Zonen-Effekt: ${zoneName}`);

  const squares = _getGridSquaresInTemplate(templateDoc);
  if (!squares.length) return ui.notifications.warn("Keine Gitterfelder im Template gefunden.");

  const templateId = templateDoc.id;

  if (preset.zoneType === "fill") {
    for (const sq of squares) {
      await _spawnZoneTile(sq.x, sq.y, preset, templateId);
    }
  } else if (preset.zoneType === "scatter") {
    const shuffled = [...squares].sort(() => Math.random() - 0.5);
    const count = Math.max(1, Math.floor(squares.length * 0.65));
    for (const sq of shuffled.slice(0, count)) {
      spawnEffect(sq.x, sq.y, zoneName.replace("zone_", ""));
    }
  } else if (preset.zoneType === "pulse") {
    const cx = squares.reduce((s, q) => s + q.x, 0) / squares.length;
    const cy = squares.reduce((s, q) => s + q.y, 0) / squares.length;
    spawnEffect(cx, cy, zoneName.replace("zone_", ""));
  }

  // Persist zone ID on the template document so it survives reloads
  if (preset.persistent && game.user.isGM) {
    await templateDoc.setFlag("dsa-pixel-tokens", "zoneEffect", zoneName);
  }

  ui.notifications.info(`Zone: ${preset.label} aktiv (${squares.length} Felder)`);
}

// ─── Zone Damage System ───────────────────────────────────────────────────────

/**
 * Returns all placeable Tokens whose center falls within the given template shape.
 */
function _getTokensInTemplate(templateDoc) {
  if (!canvas.tokens?.placeables) return [];
  const { x: tx, y: ty } = templateDoc;
  const tObj = templateDoc.object;
  if (!tObj?.shape) return [];
  return canvas.tokens.placeables.filter(token => {
    const cx = token.center.x - tx;
    const cy = token.center.y - ty;
    return tObj.shape.contains(cx, cy);
  });
}

/**
 * Spawns a floating damage/cost number that drifts upward and fades out above a token.
 * @param {Token} token
 * @param {number} amount
 * @param {number} [color=0xff3333]  PIXI hex color (red for LeP, blue for AsP)
 */
function _showDamageNumber(token, amount, color = 0xff3333, label = "SP") {
  const isHeal   = amount > 0 && color !== 0x33aaff;
  const sign     = isHeal ? "+" : (amount < 0 ? "" : "-");
  const absAmt   = Math.abs(amount);
  const hexColor = "#" + color.toString(16).padStart(6, "0");

  const mainStyle = new PIXI.TextStyle({
    fontFamily: "'Cinzel', 'Georgia', serif",
    fontSize: 38,
    fontWeight: "bold",
    fill: [hexColor, "#ffffff"],
    fillGradientStops: [0, 1],
    fillGradientType: 0,
    stroke: "#000000",
    strokeThickness: 6,
    dropShadow: true,
    dropShadowBlur: 14,
    dropShadowColor: hexColor,
    dropShadowAlpha: 0.9,
    dropShadowDistance: 0,
    dropShadowAngle: 0,
  });

  const labelStyle = new PIXI.TextStyle({
    fontFamily: "'Cinzel', 'Georgia', serif",
    fontSize: 20,
    fontWeight: "bold",
    fill: hexColor,
    stroke: "#000000",
    strokeThickness: 4,
    dropShadow: true,
    dropShadowBlur: 8,
    dropShadowColor: "#000000",
    dropShadowAlpha: 0.8,
    dropShadowDistance: 1,
  });

  const cx = token.center.x;
  const cy = token.center.y - canvas.grid.size * 0.5;
  const layer = canvas.interface ?? canvas.controls;

  const numStr   = `${sign}${absAmt}`;
  const text     = new PIXI.Text(numStr, mainStyle);
  text.anchor.set(0.5, 1.0);
  text.x = cx;
  text.y = cy;
  layer.addChild(text);

  const labelText = new PIXI.Text(label, labelStyle);
  labelText.anchor.set(0.5, 0.0);
  labelText.x = cx;
  labelText.y = cy - text.height * 0.05;
  layer.addChild(labelText);

  let tick = 0;
  const total = 80;
  const startY = cy;
  const drift = canvas.grid.size * 0.9;

  const onTick = () => {
    tick++;
    const t = tick / total;
    // Zuerst schnell nach oben, dann langsamer (ease-out)
    const eased = 1 - Math.pow(1 - t, 2);
    text.y = startY - drift * eased;
    // Scale-Punch beim Erscheinen, dann langsam schrumpfen
    const scale = t < 0.12 ? 1 + t * 2.5 : 1.3 - (t - 0.12) * 0.4;
    text.scale.set(Math.max(0.7, scale));
    labelText.scale.set(Math.max(0.7, scale));

    // Fade-out in der zweiten Hälfte
    const alpha = t < 0.55 ? 1 : 1 - ((t - 0.55) / 0.45);
    text.alpha      = alpha;
    labelText.alpha = alpha * 0.9;

    // Label folgt der Zahl
    labelText.y = text.y - text.height * text.scale.y * 0.85;

    if (tick >= total) {
      canvas.app.ticker.remove(onTick);
      if (!text.destroyed)      { layer.removeChild(text);      text.destroy(); }
      if (!labelText.destroyed) { layer.removeChild(labelText); labelText.destroy(); }
    }
  };
  canvas.app.ticker.add(onTick);
}

/**
 * Helper: reads an actor's LeP value regardless of system (gdsa / dnd5e / pf2e).
 */
function _getActorLeP(actor) {
  const s = actor.system;
  if (s?.LeP?.value !== undefined)             return { path: "system.LeP.value",            val: s.LeP.value };
  if (s?.base?.LeP !== undefined)              return { path: "system.base.LeP",              val: s.base.LeP };
  if (s?.status?.LeP !== undefined)            return { path: "system.status.LeP",            val: s.status.LeP };
  if (s?.attributes?.hp?.value !== undefined)  return { path: "system.attributes.hp.value",   val: s.attributes.hp.value };
  if (s?.hp?.value !== undefined)              return { path: "system.hp.value",               val: s.hp.value };
  return null;
}

/**
 * Helper: reads an actor's AsP value regardless of system (mirrors resolveActorAsP in config.mjs).
 */
function _getActorAsP(actor) {
  const s = actor?.system;
  if (!s) return null;
  if (s.AsP?.value !== undefined)                   return { path: "system.AsP.value",                   val: s.AsP.value };
  if (s.status?.astralenergie?.value !== undefined) return { path: "system.status.astralenergie.value",  val: s.status.astralenergie.value };
  if (s.base?.astralenergie?.value !== undefined)   return { path: "system.base.astralenergie.value",    val: s.base.astralenergie.value };
  if (s.status?.AsP !== undefined)                  return { path: "system.status.AsP",                  val: s.status.AsP };
  if (s.base?.AsP !== undefined)                    return { path: "system.base.AsP",                    val: s.base.AsP };
  if (s.mana?.value !== undefined)                  return { path: "system.mana.value",                  val: s.mana.value };
  if (s.attributes?.mana?.value !== undefined)      return { path: "system.attributes.mana.value",       val: s.attributes.mana.value };
  return null;
}

/**
 * Applies LeP damage to every token inside the template zone and optionally
 * deducts AsP from the currently selected caster token.
 *
 * @param {MeasuredTemplateDocument} templateDoc
 * @param {number} lepDamage  - LeP to subtract per token in zone (0 = no damage)
 * @param {number} aspCost    - AsP to subtract from caster (0 = no cost)
 * @param {Token|null} casterToken
 */
async function applyZoneDamage(templateDoc, lepDamage = 0, aspCost = 0, casterToken = null) {
  if (lepDamage <= 0 && aspCost <= 0) return;

  const tokens = _getTokensInTemplate(templateDoc);
  let hit = 0;

  if (lepDamage > 0) {
    for (const token of tokens) {
      const actor = token.actor;
      if (!actor) continue;
      const hp = _getActorLeP(actor);
      if (!hp) continue;
      const newVal = Math.max(0, hp.val - lepDamage);
      await actor.update({ [hp.path]: newVal });
      _showDamageNumber(token, -lepDamage, 0xff3333, "SP");
      hit++;
    }
    if (hit > 0) ui.notifications.info(`Zone-Schaden: ${hit} Token × ${lepDamage} LeP`);
  }

  if (aspCost > 0 && casterToken?.actor) {
    const actor = casterToken.actor;
    const asp = _getActorAsP(actor);
    if (asp) {
      await actor.update({ [asp.path]: Math.max(0, asp.val - aspCost) });
      // _showDamageNumber fires automatically via preUpdateActor hook
      ui.notifications.info(`AsP -${aspCost} (${casterToken.name})`);
    }
  }
}

function showZonePicker(templateDoc) {
  const casterToken = canvas.tokens.controlled[0] ?? null;

  const zoneButtonsHtml = Object.entries(ZONE_PRESETS)
    .map(([name, p]) =>
      `<button type="button" data-zone="${name}"
        style="font-size:1.05em;padding:5px 10px;cursor:pointer;min-width:120px">
        ${p.icon} ${p.label}
      </button>`
    ).join("");

  const content = `
    <div style="display:flex;flex-direction:column;gap:10px;padding:4px 0 2px">
      <p style="margin:0;color:#bbb;font-size:0.85em">Wähle den Pixel-Art Effekt für diese Zone:</p>
      <div id="sf-zone-btns" style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center">
        ${zoneButtonsHtml}
      </div>
      <hr style="margin:2px 0;border-color:#555">
      <p style="margin:0;font-size:0.88em;font-weight:bold">⚔ Schaden-Einstellungen</p>
      <div style="display:grid;grid-template-columns:1fr auto;gap:6px 10px;align-items:center">
        <label style="font-size:0.9em">LeP Schaden pro Anwendung:</label>
        <input id="sf-lep" type="number" min="0" value="0" style="width:56px;text-align:right">
        <label style="font-size:0.9em">AsP Kosten (Caster):</label>
        <input id="sf-asp" type="number" min="0" value="0" style="width:56px;text-align:right">
      </div>
      <p style="margin:0;font-size:0.8em;color:${casterToken ? "#7af" : "#f87"}">
        ${casterToken ? `Caster: ${casterToken.name}` : "⚠ Kein Token ausgewählt — AsP-Abzug inaktiv"}
      </p>
    </div>
  `;

  const d = new Dialog({
    title: `Zonen-Effekt — ${templateDoc.t?.toUpperCase() ?? "Zone"}`,
    content,
    buttons: {
      damage: {
        icon: '<i class="fas fa-bolt"></i>',
        label: "Schaden anwenden",
        callback: (html) => {
          const lep = parseInt(html.find("#sf-lep").val()) || 0;
          const asp = parseInt(html.find("#sf-asp").val()) || 0;
          applyZoneDamage(templateDoc, lep, asp, casterToken);
        },
      },
      loeschen: {
        icon: '<i class="fas fa-trash"></i>',
        label: "Zone löschen",
        callback: () => {
          clearZoneSprites(templateDoc.id);
          templateDoc.unsetFlag("dsa-pixel-tokens", "zoneEffect");
          ui.notifications.info("Zone gelöscht.");
        },
      },
      close: {
        label: "Schließen",
      },
    },
    default: "damage",
    render: (html) => {
      html.find("[data-zone]").on("click", (e) => {
        const zoneName = e.currentTarget.dataset.zone;
        spawnZoneEffect(templateDoc, zoneName);
        // Visual feedback: highlight active zone button
        html.find("[data-zone]").css({ background: "", borderColor: "" });
        $(e.currentTarget).css({ background: "rgba(255,200,0,0.25)", borderColor: "#ffcc00" });
      });
    },
  });
  d.render(true);
}

// ─── Auto-Makro Erstellung ────────────────────────────────────────────────────

function _macroCommand(name, preset) {
  switch (preset.type ?? "target") {
    case "projectile":
      return [
        `const src = canvas.tokens.controlled[0];`,
        `const tgt = [...game.user.targets][0];`,
        `if (!src) return ui.notifications.warn("Eigenen Token auswählen!");`,
        `if (!tgt) return ui.notifications.warn("Ziel mit T anvisieren!");`,
        `DSAPixelTokens.spawnProjectile(src, tgt, "${name}", "${preset.impact ?? name}");`,
      ].join("\n");
    case "zone":
      return [
        `const targets = [...game.user.targets];`,
        `const x = targets[0]?.center.x ?? canvas.mousePosition?.x;`,
        `const y = targets[0]?.center.y ?? canvas.mousePosition?.y;`,
        `if (!x || !y) return ui.notifications.warn("Token anvisieren (T) oder Maus auf Zielposition halten!");`,
        `DSAPixelTokens.spawnEffect(x, y, "${name}");`,
      ].join("\n");
    case "aura":
      return [
        `const t = canvas.tokens.controlled[0];`,
        `if (!t) return ui.notifications.warn("Keinen Token ausgewählt!");`,
        `DSAPixelTokens.spawnEffect(t.center.x, t.center.y, "${name}");`,
      ].join("\n");
    default: // "target"
      return [
        `const t = [...game.user.targets][0] ?? canvas.tokens.controlled[0];`,
        `if (!t) return ui.notifications.warn("Token auswählen oder anvisieren (T)!");`,
        `DSAPixelTokens.spawnEffect(t.center.x, t.center.y, "${name}");`,
      ].join("\n");
  }
}

async function createEffectMacros() {
  let folder = game.folders.find(f => f.name === "DSA Pixel Effekte" && f.type === "Macro");
  if (!folder) {
    folder = await Folder.create({ name: "DSA Pixel Effekte", type: "Macro", color: "#8B0000" });
  }

  let count = 0;
  for (const [name, preset] of Object.entries(EFFECT_PRESETS)) {
    if (game.macros.find(m => m.name === `Effekt: ${name}` && m.folder?.id === folder.id)) continue;
    await Macro.create({
      name:    `Effekt: ${name}`,
      type:    "script",
      folder:  folder.id,
      img:     `modules/${MODULE_ID}/assets/icons/${name}_icon.png`,
      command: _macroCommand(name, preset),
    });
    count++;
  }
  if (count > 0) ui.notifications.info(`DSA Pixel Effekte: ${count} Makros erstellt! (Ordner: "DSA Pixel Effekte")`);
}

// ─── Token HUD ───────────────────────────────────────────────────────────────

const HUD_EFFECTS = ["flammenpfeil", "feuerball", "heilung", "blitz", "armatrutz", "pandemonium"];

Hooks.on("renderTokenHUD", (hud, html, _data) => {
  const token = hud.object;
  if (!token) return;

  // Effekt-Spalte rechts neben dem HUD
  const bar = $(`<div class="sf-hud-col" style="
    position:absolute; right:-42px; top:0;
    display:flex; flex-direction:column; gap:2px; z-index:100;
  "></div>`);

  for (const name of HUD_EFFECTS) {
    const preset = EFFECT_PRESETS[name];
    if (!preset) continue;
    const iconSrc = `modules/${MODULE_ID}/assets/icons/${name}_icon.png`;
    const btn = $(`<div class="control-icon sf-hud-btn" title="${name}" style="
      width:36px; height:36px; padding:2px; cursor:pointer;
      background:rgba(0,0,0,0.72); border-radius:4px;
      border:1px solid rgba(255,255,255,0.18);
      display:flex; align-items:center; justify-content:center;
    "><img src="${iconSrc}" width="32" height="32"
      style="image-rendering:pixelated;border-radius:2px;" /></div>`);

    btn.on("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const tgt = [...game.user.targets][0];
      if (preset.type === "projectile") {
        // Projektil: fliegt vom ausgewählten Token zum Ziel
        if (tgt) spawnProjectile(token, tgt, name, preset.impact ?? name);
        else ui.notifications.warn(`Ziel (T) für ${name} anvisieren!`);
      } else if (preset.type === "aura") {
        // Aura: immer am Caster
        spawnEffect(token.center.x, token.center.y, name);
      } else {
        // target / zone: am Ziel wenn vorhanden, sonst am Caster
        const pos = tgt?.center ?? token.center;
        spawnEffect(pos.x, pos.y, name);
      }
    });

    bar.append(btn);
  }

  // "Alle Effekte"-Button
  const allBtn = $(`<div class="control-icon sf-hud-btn" title="Alle Effekte…" style="
    width:36px; height:36px; padding:2px; cursor:pointer;
    background:rgba(10,20,60,0.85); border-radius:4px;
    border:1px solid #4a90d9;
    display:flex; align-items:center; justify-content:center;
    font-size:18px; color:#4a90d9; font-weight:bold;
  ">⚡</div>`);
  allBtn.on("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    showEffectPicker();
  });
  bar.append(allBtn);

  // "Kreaturen spawnen"-Button (nur für GM)
  if (game.user.isGM) {
    const creatureBtn = $(`<div class="control-icon sf-hud-btn" title="Kreaturen spawnen…" style="
      width:36px; height:36px; padding:2px; cursor:pointer;
      background:rgba(20,10,40,0.85); border-radius:4px;
      border:1px solid #c09040;
      display:flex; align-items:center; justify-content:center;
      font-size:18px; color:#c09040; font-weight:bold;
    ">👾</div>`);
    creatureBtn.on("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      showCreaturePicker();
    });
    bar.append(creatureBtn);
  }

  html.append(bar);
});

// Zone: Template angeklickt → Effekt-Picker
Hooks.on("controlMeasuredTemplate", (templateObj, controlled) => {
  if (!controlled || !game.user.isGM) return;
  // Kleiner Button erscheint in der Template-Steuerleiste
  // (wird über renderMeasuredTemplateConfig abgehandelt)
});

// Zone: Template gelöscht → Sprites entfernen
Hooks.on("deleteMeasuredTemplate", (templateDoc) => {
  clearZoneSprites(templateDoc.id);
});

// Zone: Scene geladen → persistente Zonen wiederherstellen
Hooks.on("canvasReady", async () => {
  if (!game.user.isGM) return;
  for (const templateDoc of canvas.scene.templates) {
    const zoneName = templateDoc.getFlag("dsa-pixel-tokens", "zoneEffect");
    if (zoneName) {
      // Kurze Verzögerung damit Canvas vollständig geladen ist
      setTimeout(() => spawnZoneEffect(templateDoc, zoneName), 500);
    }
  }
});

// Zone: Doppelklick auf Template → Zone Picker öffnen
Hooks.on("renderMeasuredTemplateConfig", (app, html, data) => {
  const btn = $(`<button type="button" style="width:100%;margin-top:6px">
    ⬡ Pixel-Art Zonen-Effekt wählen
  </button>`);
  btn.on("click", () => {
    app.close();
    showZonePicker(app.object.document);
  });
  html.find("footer").before(btn);
});

// ─── Effekt-Vorschau-Dialog ───────────────────────────────────────────────────

/**
 * Öffnet einen visuellen Effekt-Picker mit allen EFFECT_PRESETS als Icon-Grid.
 * Klick = Effekt direkt an ausgewähltem Token / anvisiertem Ziel abspielen.
 */
function showEffectPicker() {
  // Nach Typ gruppieren
  const groups = {
    "🎯 Ziel-Effekte":   [],
    "✨ Auren & Buffs":  [],
    "🏹 Projektile":     [],
    "⬡ Zonen":           [],
    "⚡ Kampf-Reaktionen": [],
  };

  for (const [name, preset] of Object.entries(EFFECT_PRESETS)) {
    const iconSrc = `modules/${MODULE_ID}/assets/icons/${name}_icon.png`;
    const btn = { name, preset, iconSrc };
    if (name === "schadenflash" || name === "tod_animation") {
      groups["⚡ Kampf-Reaktionen"].push(btn);
    } else if (preset.type === "target")     groups["🎯 Ziel-Effekte"].push(btn);
    else if (preset.type === "aura")         groups["✨ Auren & Buffs"].push(btn);
    else if (preset.type === "projectile")   groups["🏹 Projektile"].push(btn);
    else if (preset.type === "zone")         groups["⬡ Zonen"].push(btn);
  }

  const groupsHtml = Object.entries(groups).map(([label, effects]) => {
    if (!effects.length) return "";
    const btns = effects.map(({ name, iconSrc }) => `
      <button type="button" class="dsa-fx-btn" data-effect="${name}" title="${name}"
        style="width:80px;height:80px;padding:4px;display:flex;flex-direction:column;
               align-items:center;justify-content:center;gap:3px;cursor:pointer;
               background:rgba(0,0,0,0.45);border:2px solid #2a2a4e;border-radius:3px;
               transition:border-color 0.1s">
        <img src="${iconSrc}" width="44" height="44"
          style="image-rendering:pixelated;border-radius:2px"
          onerror="this.src='icons/svg/mystery-man.svg'">
        <span style="font-size:8px;font-family:'VT323',monospace;color:#aaa;
                     white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
                     max-width:74px;text-align:center">${name}</span>
      </button>
    `).join("");
    return `
      <div style="margin-bottom:10px">
        <div style="font-family:'Press Start 2P',cursive;font-size:8px;color:#4a90d9;
                    margin-bottom:6px;border-bottom:1px solid #2a2a4e;padding-bottom:3px">
          ${label}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">${btns}</div>
      </div>
    `;
  }).join("");

  new Dialog({
    title: "DSA Pixel-Art — Effekte",
    content: `
      <style>
        .dsa-fx-btn:hover { border-color:#4a90d9 !important; background:rgba(74,144,217,0.12) !important; }
        .dsa-fx-btn.active { border-color:#ffd700 !important; background:rgba(255,215,0,0.10) !important; }
      </style>
      <div style="padding:4px;max-height:65vh;overflow-y:auto">
        <div style="font-size:12px;color:#666;margin-bottom:8px">
          Token auswählen / Ziel mit <kbd>T</kbd> anvisieren, dann Effekt klicken
        </div>
        ${groupsHtml}
      </div>
    `,
    buttons: {
      macros: {
        icon: '<i class="fas fa-scroll"></i>',
        label: "Makros neu erstellen",
        callback: () => {
          game.settings.set(MODULE_ID, "macrosCreated", false);
          ui.notifications.info("Makros werden beim nächsten Reload neu erstellt.");
        },
      },
      close: { label: "Schließen" },
    },
    default: "close",
    render: (html) => {
      html.find(".dsa-fx-btn").on("click", (e) => {
        const name    = e.currentTarget.dataset.effect;
        const preset  = EFFECT_PRESETS[name];
        if (!preset) return;

        const srcToken = canvas.tokens.controlled[0];
        const tgtToken = [...(game.user?.targets ?? [])][0];
        const pos = tgtToken?.center ?? srcToken?.center;

        if (!pos) {
          ui.notifications.warn("Token auswählen oder mit T anvisieren!");
          return;
        }

        if (preset.type === "projectile" && srcToken && tgtToken && srcToken !== tgtToken) {
          spawnProjectile(srcToken, tgtToken, name, preset.impact ?? name);
        } else if (preset.type === "aura" && srcToken) {
          spawnEffect(srcToken.center.x, srcToken.center.y, name);
        } else {
          spawnEffect(pos.x, pos.y, name);
        }

        // Visuelles Feedback
        html.find(".dsa-fx-btn").removeClass("active");
        $(e.currentTarget).addClass("active");
        setTimeout(() => $(e.currentTarget).removeClass("active"), 800);
      });
    },
  }).render(true);
}

// ─── Pixel-Würfel Animation ───────────────────────────────────────────────────

/**
 * Zeigt eine animierte Pixel-Art Würfel-Animation auf dem Canvas.
 * Kein externes Sprite-Sheet nötig — wird per PIXI.Graphics gezeichnet.
 *
 * @param {number} x         Canvas X
 * @param {number} y         Canvas Y
 * @param {number} result    Würfelergebnis
 * @param {string} [dieType] "d20" | "d6"
 */
function showDiceAnimation(x, y, result, dieType = "d20") {
  if (!canvas?.interface) return;
  const gs      = canvas.grid?.size ?? 100;
  const size    = Math.round(gs * 0.65);
  const isD20   = dieType !== "d6";
  const layer   = canvas.interface ?? canvas.controls;

  // Farbe je nach Ergebnis
  const borderColor = result === 1      ? 0xe94560
    : (isD20 ? result === 20 : result === 6) ? 0x00ff88
    : 0x4a90d9;

  const container = new PIXI.Container();
  container.x = x;
  container.y = y;
  layer.addChild(container);

  // ── Würfelkörper zeichnen ──
  const body = new PIXI.Graphics();
  container.addChild(body);

  function drawBody(color) {
    body.clear();
    body.lineStyle(2, color, 1);
    body.beginFill(0x0d1117, 0.88);
    if (isD20) {
      // D20: Hexagon
      const r = size * 0.46;
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        pts.push(Math.cos(a) * r, Math.sin(a) * r);
      }
      body.drawPolygon(pts);
    } else {
      // D6: Abgerundetes Rechteck
      const hw = size * 0.38;
      body.drawRoundedRect(-hw, -hw, hw * 2, hw * 2, size * 0.08);
    }
    body.endFill();
    // Label (D20 / D6) ganz klein
    body.lineStyle(0);
    body.beginFill(color, 0.25);
    body.drawCircle(size * 0.28, -size * 0.28, size * 0.12);
    body.endFill();
  }

  drawBody(0x4a90d9);

  // ── Ergebnis-Text ──
  const makeLabelStyle = (col) => new PIXI.TextStyle({
    fontFamily: "'Press Start 2P', 'VT323', monospace",
    fontSize:   size * (isD20 ? 0.30 : 0.38),
    fontWeight: "bold",
    fill:       col,
    stroke:     "#000000",
    strokeThickness: 3,
    dropShadow: true,
    dropShadowBlur: 4,
    dropShadowColor: 0x000000,
    dropShadowAlpha: 0.7,
    dropShadowDistance: 1,
  });

  const label = new PIXI.Text("?", makeLabelStyle("#aaaaaa"));
  label.anchor.set(0.5, 0.5);
  container.addChild(label);

  // ── Zufalls-Faces für Roll-Animation ──
  const faces = Array.from({ length: 12 }, () =>
    isD20 ? 1 + Math.floor(Math.random() * 20) : 1 + Math.floor(Math.random() * 6)
  );

  // ── Ticker ──
  let tick = 0;
  const ROLL_TICKS    = 45;   // Würfel-Phase
  const SETTLE_TICKS  = 30;   // Einrasten + Vergrößern
  const FADE_TICKS    = 30;   // Ausblenden
  const TOTAL         = ROLL_TICKS + SETTLE_TICKS + FADE_TICKS;

  const onTick = () => {
    tick++;

    if (tick <= ROLL_TICKS) {
      // Rotierende Zufallszahlen (werden langsamer)
      const speed  = Math.max(1, Math.floor((ROLL_TICKS - tick) / 6) + 1);
      if (tick % speed === 0) {
        const f = faces[tick % faces.length];
        label.text  = String(f);
        label.style = makeLabelStyle("#cccccc");
      }
      container.rotation = Math.sin(tick * 0.35) * 0.25 * (1 - tick / ROLL_TICKS);
      const bounce = 1 + Math.sin(tick * 0.6) * 0.05;
      container.scale.set(bounce);

    } else if (tick === ROLL_TICKS + 1) {
      // Ergebnis einblenden — kurzer Pop
      const col = result === 1 ? "#ff3333" : borderColor === 0x00ff88 ? "#00ff88" : "#ffffff";
      label.text  = String(result);
      label.style = makeLabelStyle(col);
      drawBody(borderColor);
      container.rotation = 0;
      container.scale.set(1.3);

    } else if (tick <= ROLL_TICKS + SETTLE_TICKS) {
      // Settle: Scale zurück auf 1.0
      const t = (tick - ROLL_TICKS) / SETTLE_TICKS;
      container.scale.set(1.3 - t * 0.3);
      // Leicht nach oben driften
      container.y = y - t * gs * 0.18;

    } else {
      // Ausblenden + weiter nach oben driften
      const t = (tick - ROLL_TICKS - SETTLE_TICKS) / FADE_TICKS;
      container.alpha = 1 - t;
      container.y     = (y - gs * 0.18) - t * gs * 0.35;
    }

    if (tick >= TOTAL) {
      canvas.app.ticker.remove(onTick);
      if (!container.destroyed) {
        layer.removeChild(container);
        container.destroy({ children: true });
      }
    }
  };

  canvas.app.ticker.add(onTick);
}

// ─── Würfel-Hook: Animation bei Chat-Würfelwürfen ─────────────────────────────

Hooks.on("createChatMessage", (message) => {
  // Nur Würfelwürfe mit echten Ergebnissen
  if (!message.isRoll) return;
  if (!canvas?.tokens) return;

  // Nur W20 und W6 visualisieren
  const rolls = message.rolls ?? [];
  for (const roll of rolls) {
    for (const term of roll.terms ?? []) {
      if (!term.results?.length) continue;
      const faces = term.faces;
      if (faces !== 20 && faces !== 6) continue;

      // Token des Würfelnden finden
      const token = canvas.tokens.controlled[0]
        ?? canvas.tokens.placeables.find(t => t.actor?.id === message.speaker?.actor)
        ?? canvas.tokens.placeables.find(t => t.actor?.id === message.speaker?.token);
      if (!token) return;

      const { x, y } = token.center;
      const dieType  = `d${faces}`;
      const results  = term.results.slice(0, 3); // Max 3 Würfel anzeigen

      for (let i = 0; i < results.length; i++) {
        const value   = results[i].result;
        const count   = results.length;
        // Horizontal versetzt wenn mehrere Würfel
        const offsetX = (i - (count - 1) / 2) * (canvas.grid?.size ?? 100) * 0.75;
        setTimeout(() => {
          showDiceAnimation(x + offsetX, y - (canvas.grid?.size ?? 100) * 0.5, value, dieType);
        }, i * 120);
      }
      break; // Pro Roll nur den ersten Dice-Term visualisieren
    }
  }
});

// ─── Größere Kreaturen: Token-Config Tab ──────────────────────────────────────

// Preset-Größen für LPC-Sprites
const TOKEN_SIZE_PRESETS = {
  "1×1 Standard (64px)":  { frameWidth: 64,  frameHeight: 64,  framesPerDir: 9 },
  "1×1 Groß (128px)":     { frameWidth: 128, frameHeight: 128, framesPerDir: 9 },
  "2×2 Kreatur (64px)":   { frameWidth: 64,  frameHeight: 64,  framesPerDir: 9 },
  "2×2 Kreatur (128px)":  { frameWidth: 128, frameHeight: 128, framesPerDir: 9 },
  "3×3 Boss (128px)":     { frameWidth: 128, frameHeight: 128, framesPerDir: 9 },
  "4×4 Riese (256px)":    { frameWidth: 256, frameHeight: 256, framesPerDir: 9 },
};

// Den bestehenden renderTokenConfig-Hook ergänzen (nach dem ersten Hook)
Hooks.on("renderTokenConfig", (app, html, _data) => {
  // Preset-Dropdown in den bestehenden Pixel-Art Tab einbauen
  const pixelTab = html.find('.tab[data-tab="pixel-art"]');
  if (!pixelTab.length) return;

  const presetsHtml = Object.keys(TOKEN_SIZE_PRESETS)
    .map(k => `<option value="${k}">${k}</option>`)
    .join("");

  const presetWidget = $(`
    <div class="form-group" style="margin-bottom:8px">
      <label>Größen-Preset</label>
      <div class="form-fields">
        <select id="dsa-pixel-size-preset" style="flex:1">
          <option value="">— Manuell konfigurieren —</option>
          ${presetsHtml}
        </select>
        <button type="button" id="dsa-pixel-apply-preset" style="flex:0 0 auto">
          Anwenden
        </button>
      </div>
      <p class="hint">Füllt Frame-Größe und Frames/Richtung automatisch aus.</p>
    </div>
  `);

  // Vor das erste form-group in den Pixel-Art Tab einfügen
  pixelTab.find(".dsa-pixel-settings .form-group").first().before(presetWidget);

  // Preset anwenden
  html.find("#dsa-pixel-apply-preset").on("click", () => {
    const key    = html.find("#dsa-pixel-size-preset").val();
    const preset = TOKEN_SIZE_PRESETS[key];
    if (!preset) return;
    html.find(`input[name="flags.${MODULE_ID}.spriteConfig.frameWidth"]`).val(preset.frameWidth);
    html.find(`input[name="flags.${MODULE_ID}.spriteConfig.frameHeight"]`).val(preset.frameHeight);
    html.find(`input[name="flags.${MODULE_ID}.spriteConfig.framesPerDir"]`).val(preset.framesPerDir);
    ui.notifications.info(`Preset "${key}" angewendet — Speichern nicht vergessen!`);
  });
});

// ─── Creature Presets ─────────────────────────────────────────────────────────

const CREATURE_PRESETS = {
  // Elementargeister — Stufe 1
  "Elementargeist Feuer":  { img: "modules/dsa-pixel-tokens/assets/monsters/elementargeist_feuer_token.png",  tokenSize: 1, hp: 12, group: "Elementargeister" },
  "Elementargeist Wasser": { img: "modules/dsa-pixel-tokens/assets/monsters/elementargeist_wasser_token.png", tokenSize: 1, hp: 12, group: "Elementargeister" },
  "Elementargeist Eis":    { img: "modules/dsa-pixel-tokens/assets/monsters/elementargeist_eis_token.png",    tokenSize: 1, hp: 10, group: "Elementargeister" },
  "Elementargeist Luft":   { img: "modules/dsa-pixel-tokens/assets/monsters/elementargeist_luft_token.png",   tokenSize: 1, hp: 10, group: "Elementargeister" },
  "Elementargeist Humus":  { img: "modules/dsa-pixel-tokens/assets/monsters/elementargeist_humus_token.png",  tokenSize: 1, hp: 14, group: "Elementargeister" },
  "Elementargeist Erz":    { img: "modules/dsa-pixel-tokens/assets/monsters/elementargeist_erz_token.png",    tokenSize: 1, hp: 16, group: "Elementargeister" },
  // Dschinne — Stufe 2
  "Dschinn Feuer":         { img: "modules/dsa-pixel-tokens/assets/monsters/dschinn_feuer_token.png",         tokenSize: 1, hp: 30, group: "Dschinne" },
  "Dschinn Wasser":        { img: "modules/dsa-pixel-tokens/assets/monsters/dschinn_wasser_token.png",        tokenSize: 1, hp: 28, group: "Dschinne" },
  "Dschinn Eis":           { img: "modules/dsa-pixel-tokens/assets/monsters/dschinn_eis_token.png",           tokenSize: 1, hp: 26, group: "Dschinne" },
  "Dschinn Luft":          { img: "modules/dsa-pixel-tokens/assets/monsters/dschinn_luft_token.png",          tokenSize: 1, hp: 24, group: "Dschinne" },
  "Dschinn Humus":         { img: "modules/dsa-pixel-tokens/assets/monsters/dschinn_humus_token.png",         tokenSize: 1, hp: 32, group: "Dschinne" },
  "Dschinn Erz":           { img: "modules/dsa-pixel-tokens/assets/monsters/dschinn_erz_token.png",           tokenSize: 1, hp: 35, group: "Dschinne" },
  // Meister-Dschinne — Stufe 3
  "Meister-Dschinn Feuer":  { img: "modules/dsa-pixel-tokens/assets/monsters/meisterdschinn_feuer_token.png",  tokenSize: 2, hp: 60, group: "Meister-Dschinne" },
  "Meister-Dschinn Wasser": { img: "modules/dsa-pixel-tokens/assets/monsters/meisterdschinn_wasser_token.png", tokenSize: 2, hp: 55, group: "Meister-Dschinne" },
  "Meister-Dschinn Eis":    { img: "modules/dsa-pixel-tokens/assets/monsters/meisterdschinn_eis_token.png",    tokenSize: 2, hp: 52, group: "Meister-Dschinne" },
  "Meister-Dschinn Luft":   { img: "modules/dsa-pixel-tokens/assets/monsters/meisterdschinn_luft_token.png",   tokenSize: 2, hp: 48, group: "Meister-Dschinne" },
  "Meister-Dschinn Humus":  { img: "modules/dsa-pixel-tokens/assets/monsters/meisterdschinn_humus_token.png",  tokenSize: 2, hp: 65, group: "Meister-Dschinne" },
  "Meister-Dschinn Erz":    { img: "modules/dsa-pixel-tokens/assets/monsters/meisterdschinn_erz_token.png",    tokenSize: 2, hp: 70, group: "Meister-Dschinne" },
  // Klassische Monster
  "Goblin":        { img: "modules/dsa-pixel-tokens/assets/monsters/goblin.png",        tokenSize: 1, hp: 15, group: "Monster" },
  "Ork":           { img: "modules/dsa-pixel-tokens/assets/monsters/ork.png",           tokenSize: 1, hp: 30, group: "Monster" },
  "Skelettkrieger":{ img: "modules/dsa-pixel-tokens/assets/monsters/skelettkrieger.png",tokenSize: 1, hp: 20, group: "Monster" },
  "Troll":         { img: "modules/dsa-pixel-tokens/assets/monsters/troll.png",         tokenSize: 2, hp: 50, group: "Monster" },
  "Oger":          { img: "modules/dsa-pixel-tokens/assets/monsters/oger.png",          tokenSize: 2, hp: 60, group: "Monster" },
  // Magier / NSC
  "Tamir ibn Malakor": { img: "modules/dsa-pixel-tokens/assets/monsters/tamir_token.png", tokenSize: 1, hp: 37, group: "Helden" },
  "Hexe":          { img: "modules/dsa-pixel-tokens/assets/monsters/hexe_token.png",          tokenSize: 1, hp: 18, group: "NSC" },
  "Kultist":       { img: "modules/dsa-pixel-tokens/assets/monsters/kultist_token.png",        tokenSize: 1, hp: 16, group: "NSC" },
  // Besondere Kreaturen
  "Pfütze":        { img: "modules/dsa-pixel-tokens/assets/monsters/pfuetze_token.png",  tokenSize: 1, hp: 8,  group: "Monster" },
  "Edo die Eiche": { img: "modules/dsa-pixel-tokens/assets/monsters/druide_token.png",   tokenSize: 1, hp: 55, group: "Helden" },
  "Oboro":         { img: "modules/dsa-pixel-tokens/assets/monsters/oboro_token.png",    tokenSize: 1, hp: 37, group: "Helden" },

  // ═══════════════════════════════════════════════════════════════════════════
  // DÄMONEN — Tractatus Contra Daemones + Wege der Zauberei
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Blakharaz-Diener ────────────────────────────────────────────────────
  "Gotongi":        { img: "modules/dsa-pixel-tokens/assets/monsters/gotongi_token.png",        tokenSize: 1, hp: 15,  group: "Blakharaz" },
  "Heshthot":       { img: "modules/dsa-pixel-tokens/assets/monsters/heshthot_token.png",       tokenSize: 1, hp: 35,  group: "Blakharaz" },
  "Asqarath":       { img: "modules/dsa-pixel-tokens/assets/monsters/asqarath_token.png",       tokenSize: 1, hp: 50,  group: "Blakharaz" },
  "Irhiadhzal":     { img: "modules/dsa-pixel-tokens/assets/monsters/irhiadhzal_token.png",     tokenSize: 1, hp: 60,  group: "Blakharaz" },

  // ─── Lolgramoth-Diener ───────────────────────────────────────────────────
  "Dharai":         { img: "modules/dsa-pixel-tokens/assets/monsters/dharai_token.png",         tokenSize: 2, hp: 180, group: "Lolgramoth" },
  "Chuchathabomek": { img: "modules/dsa-pixel-tokens/assets/monsters/chuchathabomek_token.png", tokenSize: 2, hp: 80,  group: "Lolgramoth" },
  "Difar":          { img: "modules/dsa-pixel-tokens/assets/monsters/difar_token.png",          tokenSize: 1, hp: 20,  group: "Lolgramoth" },
  "Karakil":        { img: "modules/dsa-pixel-tokens/assets/monsters/karakil_token.png",        tokenSize: 1, hp: 110, group: "Lolgramoth" },
  "Je-Chrizlayk-Ura": { img: "modules/dsa-pixel-tokens/assets/monsters/je_chrizlayk_ura_token.png", tokenSize: 2, hp: 150, group: "Lolgramoth" },
  "Yel'Arizel":     { img: "modules/dsa-pixel-tokens/assets/monsters/usuzoreel_token.png",      tokenSize: 1, hp: 12,  group: "Lolgramoth" },

  // ─── Thargunitoth-Diener ─────────────────────────────────────────────────
  "Nirraven":       { img: "modules/dsa-pixel-tokens/assets/monsters/nirraven_token.png",       tokenSize: 1, hp: 50,  group: "Thargunitoth" },
  "Braggu":         { img: "modules/dsa-pixel-tokens/assets/monsters/braggu_token.png",         tokenSize: 1, hp: 20,  group: "Thargunitoth" },
  "Nephazz":        { img: "modules/dsa-pixel-tokens/assets/monsters/azamir_token.png",         tokenSize: 1, hp: 20,  group: "Thargunitoth" },

  // ─── Tasfarelel-Diener ───────────────────────────────────────────────────
  "Tasfarelel":     { img: "modules/dsa-pixel-tokens/assets/monsters/tasfarelel_token.png",     tokenSize: 2, hp: 200, group: "Tasfarelel" },
  "Nurumbaal":      { img: "modules/dsa-pixel-tokens/assets/monsters/nurumbaal_token.png",      tokenSize: 1, hp: 30,  group: "Tasfarelel" },
  "Khidma'kha'bulim": { img: "modules/dsa-pixel-tokens/assets/monsters/khidmakhabulim_token.png", tokenSize: 1, hp: 15, group: "Tasfarelel" },
  "Nishkakat":      { img: "modules/dsa-pixel-tokens/assets/monsters/nishkakat_token.png",      tokenSize: 1, hp: 18,  group: "Tasfarelel" },
  "Uridabash":      { img: "modules/dsa-pixel-tokens/assets/monsters/uridabash_token.png",      tokenSize: 1, hp: 25,  group: "Tasfarelel" },
  "Haqoum":         { img: "modules/dsa-pixel-tokens/assets/monsters/haqoum_token.png",         tokenSize: 1, hp: 30,  group: "Tasfarelel" },
  "Uttara'Vha":     { img: "modules/dsa-pixel-tokens/assets/monsters/karunga_token.png",        tokenSize: 1, hp: 10,  group: "Tasfarelel" },
  "Qasaar":         { img: "modules/dsa-pixel-tokens/assets/monsters/qasaar_token.png",         tokenSize: 1, hp: 12,  group: "Tasfarelel" },

  // ─── Charyptoroth-Diener ─────────────────────────────────────────────────
  "Elymelusinias":  { img: "modules/dsa-pixel-tokens/assets/monsters/elymelusinias_token.png",  tokenSize: 1, hp: 45,  group: "Charyptoroth" },
  "Ulchuchu":       { img: "modules/dsa-pixel-tokens/assets/monsters/ulchuchu_token.png",       tokenSize: 1, hp: 55,  group: "Charyptoroth" },
  "Yo'Nahoh":       { img: "modules/dsa-pixel-tokens/assets/monsters/yo_nahoh_token.png",       tokenSize: 2, hp: 180, group: "Charyptoroth" },
  "Amrychoth":      { img: "modules/dsa-pixel-tokens/assets/monsters/amrychoth_token.png",      tokenSize: 2, hp: 90,  group: "Charyptoroth" },

  // ─── Calijnaar-Diener ────────────────────────────────────────────────────
  "Cthllanogog":    { img: "modules/dsa-pixel-tokens/assets/monsters/cthllanogog_token.png",    tokenSize: 1, hp: 30,  group: "Calijnaar" },
  "Trachrhabaar":   { img: "modules/dsa-pixel-tokens/assets/monsters/trachrhabaar_token.png",   tokenSize: 1, hp: 25,  group: "Calijnaar" },

  // ─── Dar-Klajid-Diener ───────────────────────────────────────────────────
  "Laraan":         { img: "modules/dsa-pixel-tokens/assets/monsters/laraan_token.png",         tokenSize: 1, hp: 40,  group: "Dar-Klajid" },
  "Fajlaraan":      { img: "modules/dsa-pixel-tokens/assets/monsters/laraan_token.png",         tokenSize: 1, hp: 40,  group: "Dar-Klajid" },
  "Khelevathan":    { img: "modules/dsa-pixel-tokens/assets/monsters/khelevathan_token.png",    tokenSize: 1, hp: 20,  group: "Dar-Klajid" },
  "Hanaestil":      { img: "modules/dsa-pixel-tokens/assets/monsters/hanaestil_token.png",      tokenSize: 1, hp: 80,  group: "Dar-Klajid" },

  // ─── Mishkhara-Diener ────────────────────────────────────────────────────
  "Bhurkhesch":     { img: "modules/dsa-pixel-tokens/assets/monsters/bhurkhesch_token.png",     tokenSize: 1, hp: 40,  group: "Mishkhara" },
  "Duglum":         { img: "modules/dsa-pixel-tokens/assets/monsters/duglum_token.png",         tokenSize: 1, hp: 25,  group: "Mishkhara" },
  "Tlaluc":         { img: "modules/dsa-pixel-tokens/assets/monsters/tlaluc_token.png",         tokenSize: 1, hp: 30,  group: "Mishkhara" },
  "Khuralthu":      { img: "modules/dsa-pixel-tokens/assets/monsters/khuralthu_token.png",      tokenSize: 2, hp: 50,  group: "Mishkhara" },
  "Hirr'Nirat":     { img: "modules/dsa-pixel-tokens/assets/monsters/hirr_nirat_token.png",     tokenSize: 1, hp: 15,  group: "Mishkhara" },
  "Eugalp":         { img: "modules/dsa-pixel-tokens/assets/monsters/eugalp_token.png",         tokenSize: 1, hp: 80,  group: "Mishkhara" },

  // ─── Agrimoth-Diener ─────────────────────────────────────────────────────
  "Arjunoor":       { img: "modules/dsa-pixel-tokens/assets/monsters/arjunoor_token.png",       tokenSize: 2, hp: 250, group: "Agrimoth" },
  "Arkhobal":       { img: "modules/dsa-pixel-tokens/assets/monsters/arkhobal_token.png",       tokenSize: 2, hp: 80,  group: "Agrimoth" },
  "Kah-Thurak-Arfai": { img: "modules/dsa-pixel-tokens/assets/monsters/kah_thurak_arfai_token.png", tokenSize: 2, hp: 200, group: "Agrimoth" },
  "Gna-Rishaj-Tumar": { img: "modules/dsa-pixel-tokens/assets/monsters/gna_rishaj_tumar_token.png", tokenSize: 2, hp: 100, group: "Agrimoth" },
  "Glaathoyub":     { img: "modules/dsa-pixel-tokens/assets/monsters/glaathoyub_token.png",     tokenSize: 1, hp: 60,  group: "Agrimoth" },
  "Amrifas":        { img: "modules/dsa-pixel-tokens/assets/monsters/amrifas_token.png",        tokenSize: 2, hp: 100, group: "Agrimoth" },

  // ─── Belkelel/Aphasmayra-Diener ──────────────────────────────────────────
  "Aphasmayra":     { img: "modules/dsa-pixel-tokens/assets/monsters/aphasmayra_token.png",     tokenSize: 2, hp: 120, group: "Belkelel" },
  "Chamuyan":       { img: "modules/dsa-pixel-tokens/assets/monsters/chamuyan_token.png",       tokenSize: 1, hp: 65,  group: "Belkelel" },
  "Karmanath":      { img: "modules/dsa-pixel-tokens/assets/monsters/karmanath_token.png",      tokenSize: 1, hp: 25,  group: "Belkelel" },
  "Thaz-Laraanji":  { img: "modules/dsa-pixel-tokens/assets/monsters/thaz_laraanji_token.png",  tokenSize: 1, hp: 25,  group: "Belkelel" },
  "Muwallaraan":    { img: "modules/dsa-pixel-tokens/assets/monsters/muwallaraan_token.png",    tokenSize: 2, hp: 80,  group: "Belkelel" },
  "May'hay'tam":    { img: "modules/dsa-pixel-tokens/assets/monsters/may_hay_tam_token.png",    tokenSize: 2, hp: 150, group: "Belkelel" },

  // ─── Belshirash-Diener ───────────────────────────────────────────────────
  "Pershirash":     { img: "modules/dsa-pixel-tokens/assets/monsters/pershirash_token.png",     tokenSize: 1, hp: 35,  group: "Belshirash" },
  "Umdoreel":       { img: "modules/dsa-pixel-tokens/assets/monsters/umdoreel_token.png",       tokenSize: 2, hp: 70,  group: "Belshirash" },
  "Usuzoreel":      { img: "modules/dsa-pixel-tokens/assets/monsters/usuzoreel_token.png",      tokenSize: 1, hp: 40,  group: "Belshirash" },
  "Thalon":         { img: "modules/dsa-pixel-tokens/assets/monsters/thalon_token.png",         tokenSize: 1, hp: 12,  group: "Belshirash" },

  // ─── Belhalhar-Diener ────────────────────────────────────────────────────
  "Zant":           { img: "modules/dsa-pixel-tokens/assets/monsters/zant_token.png",           tokenSize: 1, hp: 30,  group: "Belhalhar" },
  "Sharbazz":       { img: "modules/dsa-pixel-tokens/assets/monsters/sharbazz_token.png",       tokenSize: 1, hp: 60,  group: "Belhalhar" },
  "Shruuf":         { img: "modules/dsa-pixel-tokens/assets/monsters/shruuf_token.png",         tokenSize: 1, hp: 50,  group: "Belhalhar" },
  "Karmoth":        { img: "modules/dsa-pixel-tokens/assets/monsters/karmoth_token.png",        tokenSize: 2, hp: 400, group: "Belhalhar" },
  "Iltapeth/Istapher": { img: "modules/dsa-pixel-tokens/assets/monsters/iltapeth_istapher_token.png", tokenSize: 1, hp: 35, group: "Belhalhar" },

  // ─── Amazeroth-Diener ────────────────────────────────────────────────────
  "Xamanoth":       { img: "modules/dsa-pixel-tokens/assets/monsters/xamanoth_token.png",       tokenSize: 1, hp: 50,  group: "Amazeroth" },
  "Karunga":        { img: "modules/dsa-pixel-tokens/assets/monsters/karunga_token.png",        tokenSize: 1, hp: 15,  group: "Amazeroth" },
  "Qok'Maloth":     { img: "modules/dsa-pixel-tokens/assets/monsters/qok_maloth_token.png",     tokenSize: 1, hp: 30,  group: "Amazeroth" },
  "Quitslinga":     { img: "modules/dsa-pixel-tokens/assets/monsters/quitslinga_token.png",     tokenSize: 1, hp: 60,  group: "Amazeroth" },
  "Mactans":        { img: "modules/dsa-pixel-tokens/assets/monsters/mactans_token.png",        tokenSize: 1, hp: 70,  group: "Amazeroth" },
  "Isyahadin":      { img: "modules/dsa-pixel-tokens/assets/monsters/isyahadin_rahastes_token.png", tokenSize: 1, hp: 30, group: "Amazeroth" },
  "Rahastes":       { img: "modules/dsa-pixel-tokens/assets/monsters/isyahadin_rahastes_token.png", tokenSize: 1, hp: 30, group: "Amazeroth" },

  // ─── Unabhängige / Sonstige Dämonen ──────────────────────────────────────
  "Aphestadil":     { img: "modules/dsa-pixel-tokens/assets/monsters/aphestadil_token.png",     tokenSize: 1, hp: 80,  group: "Unabhängige" },
  "Shihayazad":     { img: "modules/dsa-pixel-tokens/assets/monsters/shihayazad_token.png",     tokenSize: 2, hp: 200, group: "Unabhängige" },
  "Azamir":         { img: "modules/dsa-pixel-tokens/assets/monsters/azamir_token.png",         tokenSize: 1, hp: 50,  group: "Unabhängige" },
  "Ivash":          { img: "modules/dsa-pixel-tokens/assets/monsters/ivash_token.png",          tokenSize: 1, hp: 30,  group: "Unabhängige" },
  "Yo'ugghatugythot": { img: "modules/dsa-pixel-tokens/assets/monsters/yo_ugghatugythot_token.png", tokenSize: 1, hp: 60, group: "Unabhängige" },
  "Yst-Phogorthu":  { img: "modules/dsa-pixel-tokens/assets/monsters/yst_phogorthu_token.png",  tokenSize: 1, hp: 40,  group: "Unabhängige" },
  "Zazamotl'gnakhyaa": { img: "modules/dsa-pixel-tokens/assets/monsters/zazamotl_gnakhyaa_token.png", tokenSize: 1, hp: 70, group: "Unabhängige" },
  "Yish'Azrhi":     { img: "modules/dsa-pixel-tokens/assets/monsters/yish_azrhi_token.png",     tokenSize: 1, hp: 50,  group: "Unabhängige" },
};

async function spawnCreature(name) {
  const preset = CREATURE_PRESETS[name];
  if (!preset) return;
  if (!game.user.isGM) { ui.notifications.warn("Nur GMs können Kreaturen spawnen."); return; }

  // Existiert der Aktor schon?
  // gdsa system uses "NonPlayer" — documentTypes.Actor is an object, use Object.keys()
  const npcType = Object.keys(game.system.documentTypes?.Actor ?? {}).find(t => t !== "PlayerCharakter" && t !== "LootActor") ?? "NonPlayer";
  const actorType = preset.group === "Helden" ? "PlayerCharakter" : npcType;
  let actor = game.actors.find(a => a.name === name && a.type === actorType);
  if (!actor) {
    actor = await Actor.create({
      name,
      type: actorType,
      img: preset.img,
      system: { LeP: { value: preset.hp, max: preset.hp } },
      prototypeToken: {
        name,
        texture: { src: preset.img },
        width: preset.tokenSize,
        height: preset.tokenSize,
        displayName: CONST.TOKEN_DISPLAY_MODES.HOVER,
      },
    });
  }

  // Token auf aktive Szene droppen
  const scene = game.scenes.active;
  if (!scene) { ui.notifications.warn("Keine aktive Szene gefunden."); return; }
  const gridSize = scene.grid.size ?? 100;
  const cx = Math.floor(scene.width / 2 / gridSize) * gridSize;
  const cy = Math.floor(scene.height / 2 / gridSize) * gridSize;

  await scene.createEmbeddedDocuments("Token", [{
    name,
    actorId: actor.id,
    texture: { src: preset.img },
    x: cx,
    y: cy,
    width: preset.tokenSize,
    height: preset.tokenSize,
  }]);
  ui.notifications.info(`${name} gespawnt!`);
}

function showCreaturePicker() {
  const groups = {};
  for (const [name, p] of Object.entries(CREATURE_PRESETS)) {
    if (!groups[p.group]) groups[p.group] = [];
    groups[p.group].push(name);
  }

  const groupIcons = {
    "Helden":           "⚔️",
    "Elementargeister": "🌿",
    "Dschinne":         "🔮",
    "Meister-Dschinne": "👑",
    "Monster":          "💀",
    "NSC":              "🧙",
    "Blakharaz":        "👿",
    "Lolgramoth":       "👿",
    "Thargunitoth":     "👿",
    "Tasfarelel":       "👿",
    "Charyptoroth":     "👿",
    "Calijnaar":        "👿",
    "Dar-Klajid":       "👿",
    "Mishkhara":        "👿",
    "Agrimoth":         "👿",
    "Belkelel":         "👿",
    "Belshirash":       "👿",
    "Belhalhar":        "👿",
    "Amazeroth":        "👿",
    "Unabhängige":      "👿",
  };

  const groupsHtml = Object.entries(groups).map(([label, names]) => {
    const btns = names.map(name => {
      const p = CREATURE_PRESETS[name];
      return `
        <button class="dsa-creature-btn" data-creature="${name}"
          style="width:80px;height:90px;padding:4px;background:rgba(0,0,0,0.4);
                 border:1px solid #3a3a5e;border-radius:3px;cursor:pointer;
                 display:flex;flex-direction:column;align-items:center;gap:3px">
          <img src="${p.img}" style="width:56px;height:56px;image-rendering:pixelated;object-fit:contain" onerror="this.style.opacity='0.3'">
          <span style="font-size:8px;font-family:'VT323',monospace;color:#ccc;
                       white-space:normal;overflow:hidden;text-overflow:ellipsis;
                       max-width:74px;text-align:center;line-height:1.1">${name}</span>
          <span style="font-size:7px;color:#888">LP: ${p.hp}</span>
        </button>
      `;
    }).join("");
    return `
      <div style="margin-bottom:10px">
        <div style="font-family:'Press Start 2P',cursive;font-size:8px;color:#c09040;
                    margin-bottom:6px;border-bottom:1px solid #3a3a5e;padding-bottom:3px">
          ${groupIcons[label] ?? "⚔️"} ${label}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">${btns}</div>
      </div>
    `;
  }).join("");

  new Dialog({
    title: "DSA — Kreaturen & NSC spawnen",
    content: `
      <style>
        .dsa-creature-btn:hover { border-color:#c09040 !important; background:rgba(192,144,64,0.15) !important; }
      </style>
      <div style="padding:4px;max-height:70vh;overflow-y:auto">
        <div style="font-size:11px;color:#888;margin-bottom:8px">
          Klick = Kreatur als NPC-Aktor anlegen + in aktiver Szene spawnen
        </div>
        ${groupsHtml}
      </div>
    `,
    buttons: { close: { label: "Schließen" } },
    default: "close",
    render: (html) => {
      html.find(".dsa-creature-btn").on("click", async (e) => {
        const name = e.currentTarget.dataset.creature;
        await spawnCreature(name);
      });
    },
  }).render(true);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

globalThis.DSAPixelTokens = {
  applySprite,
  removeSprite,
  showIdle,
  showWalk,
  clearCache: () => _sheetCache.clear(),
  spawnEffect,
  spawnProjectile,
  hasProjectileVFX,
  refreshStatusIcons,
  effects: EFFECT_PRESETS,
  spawnZoneEffect,
  showZonePicker,
  showEffectPicker,
  clearZoneSprites,
  applyZoneDamage,
  showDiceAnimation,
  ZONE_PRESETS,
  showCreaturePicker,
  spawnCreature,
  CREATURE_PRESETS,
};
