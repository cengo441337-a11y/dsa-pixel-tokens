/**
 * DSA Pixel-Art Tokens
 * Animated LPC sprite sheet support for FoundryVTT tokens
 * v0.1.0 — compatible with FoundryVTT v11/v12
 */

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
  const newHP =
    changes.system?.LeP?.value         ??
    changes.system?.base?.LeP          ??
    changes.system?.status?.LeP        ??
    changes.system?.attributes?.hp?.value ??
    changes.system?.hp?.value          ??
    null;

  if (newHP === null) return;

  const oldHP = _getActorHP(actor);
  if (oldHP === null || newHP >= oldHP) return;

  const tokens = actor.getActiveTokens?.() ?? [];
  for (const token of tokens) {
    const { x, y } = token.center;
    // Kurzer Delay damit das HP-Update schon gesetzt ist
    setTimeout(() => spawnEffect(x, y, "schadenflash"), 50);
    if (newHP <= 0 && oldHP > 0) {
      setTimeout(() => spawnEffect(x, y, "tod_animation"), 150);
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
  feuerball:    { src: "modules/dsa-pixel-tokens/assets/fx_feuerball.png",    frames: 8,  fps: 12, scale: 2.0,    sound: "modules/dsa-pixel-tokens/assets/sounds/spell.wav",   type: "target"                         },
  explosion:    { src: "modules/dsa-pixel-tokens/assets/fx_explosion.png",    frames: 10, fps: 12, scaleGrid: 5,  sound: "modules/dsa-pixel-tokens/assets/sounds/magic1.wav",  type: "zone"                           },
  eis:          { src: "modules/dsa-pixel-tokens/assets/fx_eis.png",          frames: 8,  fps: 10, scale: 2.0,    sound: "modules/dsa-pixel-tokens/assets/sounds/random1.wav", type: "target"                         },
  blitz:        { src: "modules/dsa-pixel-tokens/assets/fx_blitz.png",        frames: 6,  fps: 14, scale: 2.5,    sound: "modules/dsa-pixel-tokens/assets/sounds/random2.wav", type: "target"                         },
  heilung:      { src: "modules/dsa-pixel-tokens/assets/fx_heilung.png",      frames: 8,  fps: 10, scale: 2.0,    sound: "modules/dsa-pixel-tokens/assets/sounds/bubble.wav",  type: "target"                         },
  gift:         { src: "modules/dsa-pixel-tokens/assets/fx_gift.png",         frames: 8,  fps: 10, scale: 2.0,    sound: "modules/dsa-pixel-tokens/assets/sounds/bubble.wav",  type: "target"                         },
  schatten:     { src: "modules/dsa-pixel-tokens/assets/fx_schatten.png",     frames: 8,  fps: 10, scale: 2.0,    sound: "modules/dsa-pixel-tokens/assets/sounds/spell.wav",   type: "target"                         },
  wasser:       { src: "modules/dsa-pixel-tokens/assets/fx_wasser.png",       frames: 8,  fps: 10, scale: 2.0,    sound: "modules/dsa-pixel-tokens/assets/sounds/random1.wav", type: "target"                         },
  // ── DSA-Zauber Welle 1 ────────────────────────────────────────────────────
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
  // ── Kampf-Reaktionen (automatisch via Hook) ──────────────────────────────
  schadenflash: { src: "modules/dsa-pixel-tokens/assets/fx_schadenflash.png", frames: 6,  fps: 18, scaleGrid: 2, sound: null,                                                 type: "target"                             },
  tod_animation:{ src: "modules/dsa-pixel-tokens/assets/fx_tod_animation.png",frames: 12, fps: 10, scaleGrid: 2, sound: "modules/dsa-pixel-tokens/assets/sounds/magic1.wav",  type: "target"                             },
};

/**
 * Spawn a one-shot effect at canvas coordinates.
 * @param {number} x - Canvas X position
 * @param {number} y - Canvas Y position
 * @param {string|object} effect - Preset name ("feuerball") or config object
 * @param {object} [opts] - Optional overrides: { frames, fps, scale, frameSize }
 */
async function spawnEffect(x, y, effect, opts = {}) {
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
 * @param {Token} fromToken - Source token
 * @param {Token} toToken   - Target token
 * @param {string} projectile - Effect preset for travel (e.g. "feuerball")
 * @param {string} [impact]   - Effect preset for impact (e.g. "explosion")
 */
async function spawnProjectile(fromToken, toToken, projectile = "feuerball", impact = "explosion") {
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
        spawnEffect(endX, endY, impact);
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

  html.append(bar);
});

// ─── Exports ──────────────────────────────────────────────────────────────────

globalThis.DSAPixelTokens = {
  applySprite,
  removeSprite,
  showIdle,
  showWalk,
  clearCache: () => _sheetCache.clear(),
  spawnEffect,
  spawnProjectile,
  refreshStatusIcons,
  effects: EFFECT_PRESETS,
};
