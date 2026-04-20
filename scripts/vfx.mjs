/**
 * DSA Fantasy VTT — Modern VFX Engine v2.0
 * PIXI.Graphics-basierte Zauber- und Kampfeffekte mit Glow, Partikeln, Screen Shake.
 * Kompatibel mit FoundryVTT v12 / PIXI.js v7.
 */

// ── Utilities ────────────────────────────────────────────────────────────────

const rnd  = (min, max) => min + Math.random() * (max - min);
const lerp = (a, b, t)  => a + (b - a) * t;
const easeOut   = t => 1 - Math.pow(1 - t, 2);
const easeIn    = t => t * t;
const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const TAU = Math.PI * 2;

function getLayer() {
  return canvas.interface ?? canvas.controls;
}

/** Creates a container with optional additive blending. */
function makeContainer(additive = false) {
  const c = new PIXI.Container();
  if (additive) c.blendMode = PIXI.BLEND_MODES.ADD;
  getLayer().addChild(c);
  return c;
}

/** Safely destroys a container and removes it from parent. */
function cleanup(container) {
  try {
    container.parent?.removeChild(container);
    container.destroy({ children: true });
  } catch (_) {}
}

/**
 * Runs a callback every ticker tick for `durationMs` ms.
 * Callback receives (t: 0→1, elapsedMs).
 */
function animate(durationMs, callback) {
  return new Promise(resolve => {
    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(elapsed / durationMs, 1);
      try { callback(t, elapsed); } catch (e) { console.warn("[dsa-vfx]", e); }
      if (t >= 1) { canvas.app.ticker.remove(tick); resolve(); }
    };
    canvas.app.ticker.add(tick);
  });
}

/** Screen shake — shakes canvas.stage for dramatic impacts. */
async function screenShake(intensity = 6, durationMs = 300) {
  const stage = canvas.stage;
  if (!stage) return;
  const ox = stage.pivot.x, oy = stage.pivot.y;
  await animate(durationMs, t => {
    const decay = 1 - easeOut(t);
    stage.pivot.x = ox + rnd(-intensity, intensity) * decay;
    stage.pivot.y = oy + rnd(-intensity, intensity) * decay;
  });
  stage.pivot.x = ox;
  stage.pivot.y = oy;
}

/** Draws a polygon crystal shard shape. */
function drawCrystal(g, cx, cy, w, h, angle, color, alpha) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const pts = [
    { x: 0, y: -h / 2 },   // top
    { x: w / 2, y: 0 },     // right
    { x: 0, y: h / 2 },     // bottom
    { x: -w / 2, y: 0 },    // left
  ];
  const rotated = pts.map(p => ({
    x: cx + p.x * cos - p.y * sin,
    y: cy + p.x * sin + p.y * cos,
  }));
  g.beginFill(color, alpha);
  g.drawPolygon(rotated.flatMap(p => [p.x, p.y]));
  g.endFill();
}

// ── Effect Renderers ─────────────────────────────────────────────────────────

/**
 * Lightning: jagged multi-pass beam with branches and screen flash.
 */
async function vfxLightning(x, y, opts = {}) {
  const endX    = opts.endX     ?? x;
  const endY    = opts.endY     ?? y - 90;
  const col     = opts.color    ?? 0x9966ff;
  const glow    = opts.glowColor ?? 0xccaaff;
  const segs    = opts.segments ?? 10;
  const dur     = opts.duration ?? 700;
  const flashes = opts.flashes  ?? 3;

  const container = makeContainer(true);

  const drawBeam = () => {
    while (container.children.length) container.children[0].destroy();

    const passes = [
      { w: 18, col: glow, alpha: 0.08, jitter: 5 },
      { w: 8,  col: glow, alpha: 0.30, jitter: 16 },
      { w: 3,  col: col,  alpha: 0.90, jitter: 22 },
      { w: 1,  col: 0xffffff, alpha: 0.70, jitter: 20 },
    ];
    for (const p of passes) {
      const g = new PIXI.Graphics();
      g.lineStyle(p.w, p.col, p.alpha);
      g.moveTo(x, y);
      for (let i = 1; i < segs; i++) {
        const t  = i / segs;
        const mx = lerp(x, endX, t);
        const my = lerp(y, endY, t);
        const j  = p.jitter * (1 - Math.abs(t - 0.5) * 1.6);
        g.lineTo(mx + rnd(-j, j), my + rnd(-j, j));
      }
      g.lineTo(endX, endY);
      container.addChild(g);
    }

    // Branches
    for (let b = 0; b < 4; b++) {
      if (Math.random() > 0.5) continue;
      const bt   = rnd(0.2, 0.8);
      const bx   = lerp(x, endX, bt) + rnd(-6, 6);
      const by   = lerp(y, endY, bt) + rnd(-6, 6);
      const bLen = rnd(20, 55);
      const bAng = rnd(0, TAU);
      const bg   = new PIXI.Graphics();
      bg.lineStyle(1.5, col, 0.55);
      bg.moveTo(bx, by);
      const mid = { x: bx + Math.cos(bAng) * bLen * 0.5 + rnd(-8, 8), y: by + Math.sin(bAng) * bLen * 0.5 + rnd(-8, 8) };
      bg.lineTo(mid.x, mid.y);
      bg.lineTo(bx + Math.cos(bAng) * bLen, by + Math.sin(bAng) * bLen);
      container.addChild(bg);
    }

    // Impact flash
    const burst = new PIXI.Graphics();
    burst.beginFill(0xffffff, 0.6);
    burst.drawCircle(endX, endY, rnd(12, 22));
    burst.endFill();
    burst.beginFill(glow, 0.45);
    burst.drawCircle(endX, endY, rnd(6, 14));
    burst.endFill();
    container.addChild(burst);
  };

  const interval = dur / flashes;
  for (let f = 0; f < flashes; f++) {
    drawBeam();
    await new Promise(r => setTimeout(r, interval * 0.55));
    container.visible = false;
    await new Promise(r => setTimeout(r, interval * 0.45));
    container.visible = true;
  }

  await animate(200, t => { container.alpha = 1 - t; });
  cleanup(container);
}

/**
 * Fire v2: expanding burst + smoke plume + ember sparks + shockwave ring.
 */
async function vfxFire(x, y, opts = {}) {
  const col1  = opts.color1    ?? 0xff6600;
  const col2  = opts.color2    ?? 0xffdd00;
  const count = opts.particles ?? 36;
  const rad   = opts.radius    ?? 70;
  const dur   = opts.duration  ?? 1000;
  const shake = opts.shake     ?? (rad > 60);

  const container = makeContainer(false);
  const glowLayer = new PIXI.Container();
  glowLayer.blendMode = PIXI.BLEND_MODES.ADD;
  container.addChild(glowLayer);

  if (shake) screenShake(rad > 100 ? 10 : 5, 350);

  const particles = Array.from({ length: count }, () => ({
    angle: rnd(0, TAU),
    speed: rnd(0.3, 1.0),
    size:  rnd(5, 14),
    col:   Math.random() > 0.4 ? col1 : (Math.random() > 0.5 ? col2 : 0xffaa00),
    life:  rnd(0.4, 1.0),
    drift: rnd(-12, 12),
  }));

  // Smoke particles
  const smokes = Array.from({ length: 14 }, () => ({
    ox: rnd(-20, 20), speed: rnd(0.2, 0.6), size: rnd(12, 28), phase: rnd(0.15, 0.5),
  }));

  // Ember sparks (fall down with gravity)
  const embers = Array.from({ length: 16 }, () => ({
    angle: rnd(0, TAU), speed: rnd(0.5, 1.2), size: rnd(1.5, 3.5), grav: rnd(40, 100),
  }));

  const coreG  = new PIXI.Graphics(); glowLayer.addChild(coreG);
  const pGfx   = particles.map(() => { const g = new PIXI.Graphics(); glowLayer.addChild(g); return g; });
  const smokeG = new PIXI.Graphics(); container.addChild(smokeG); // smoke behind glow
  container.setChildIndex(smokeG, 0);
  const emberG = new PIXI.Graphics(); glowLayer.addChild(emberG);
  const ringG  = new PIXI.Graphics(); container.addChild(ringG);

  await animate(dur, t => {
    // Shockwave ring
    ringG.clear();
    if (t < 0.4) {
      const rt = t / 0.4;
      ringG.lineStyle(Math.max(0.5, 4 * (1 - rt)), col1, (1 - rt) * 0.6);
      ringG.drawCircle(x, y, rad * 1.3 * easeOut(rt));
    }

    // Core glow
    coreG.clear();
    const ga = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
    const gr = rad * 0.6 * easeOut(Math.min(t * 2, 1));
    coreG.beginFill(0xff8800, ga * 0.4);
    coreG.drawCircle(x, y, gr);
    coreG.endFill();
    coreG.beginFill(0xffee66, ga * 0.3);
    coreG.drawCircle(x, y, gr * 0.45);
    coreG.endFill();
    coreG.beginFill(0xffffff, ga * 0.15);
    coreG.drawCircle(x, y, gr * 0.2);
    coreG.endFill();

    // Fire particles
    particles.forEach((p, i) => {
      const g = pGfx[i];
      g.clear();
      if (t >= p.life) return;
      const pt   = t / p.life;
      const dist = rad * p.speed * easeOut(pt);
      const px   = x + Math.cos(p.angle) * dist + p.drift * pt;
      const py   = y + Math.sin(p.angle) * dist - dist * 0.4;
      const a    = 1 - easeIn(pt);
      const sz   = p.size * (1 - pt * 0.5);
      if (sz < 0.5 || a < 0.04) return;
      g.beginFill(p.col, a);
      g.drawCircle(px, py, sz);
      g.endFill();
      if (sz > 4) {
        g.beginFill(0xffffff, a * 0.45);
        g.drawCircle(px, py, sz * 0.35);
        g.endFill();
      }
    });

    // Smoke rising
    smokeG.clear();
    smokes.forEach(s => {
      const pt = (t - s.phase) / (1 - s.phase);
      if (pt <= 0 || pt >= 1) return;
      const py = y - pt * 100 * s.speed;
      const a  = (1 - pt) * 0.18;
      const sz = s.size * (0.6 + pt * 0.8);
      smokeG.beginFill(0x333333, a);
      smokeG.drawCircle(x + s.ox + Math.sin(pt * 4) * 8, py, sz);
      smokeG.endFill();
    });

    // Embers with gravity
    emberG.clear();
    embers.forEach(e => {
      if (t > 0.85) return;
      const pt   = t / 0.85;
      const dist = rad * 0.8 * e.speed * easeOut(pt);
      const ex   = x + Math.cos(e.angle) * dist;
      const ey   = y + Math.sin(e.angle) * dist + e.grav * pt * pt; // gravity
      const a    = (1 - pt) * 0.9;
      emberG.beginFill(0xffcc00, a);
      emberG.drawCircle(ex, ey, e.size * (1 - pt * 0.4));
      emberG.endFill();
    });
  });

  cleanup(container);
}

/**
 * Ice v2: crystal polygon shards + frost ring + cold mist + sparkles.
 */
async function vfxIce(x, y, opts = {}) {
  const col   = opts.color   ?? 0x88ddff;
  const count = opts.shards  ?? 14;
  const rad   = opts.radius  ?? 75;
  const dur   = opts.duration ?? 1000;

  const container = makeContainer(false);
  const glowLayer = new PIXI.Container();
  glowLayer.blendMode = PIXI.BLEND_MODES.ADD;
  container.addChild(glowLayer);

  const shards = Array.from({ length: count }, (_, i) => ({
    angle: (i / count) * TAU + rnd(-0.12, 0.12),
    len:   rnd(25, rad),
    w:     rnd(6, 14),
    h:     rnd(18, 38),
    speed: rnd(0.4, 1.0),
    rot:   rnd(0, TAU),
  }));

  // Sparkles
  const sparkles = Array.from({ length: 20 }, () => ({
    angle: rnd(0, TAU), dist: rnd(15, rad * 0.9), phase: rnd(0, 0.6), size: rnd(1.5, 3.5),
  }));

  const frostG   = new PIXI.Graphics(); container.addChild(frostG);
  const shardG   = new PIXI.Graphics(); container.addChild(shardG);
  const sparkG   = new PIXI.Graphics(); glowLayer.addChild(sparkG);
  const mistG    = new PIXI.Graphics(); container.addChild(mistG);

  await animate(dur, t => {
    // Frost ring on ground
    frostG.clear();
    const fr = rad * 1.1 * easeOut(Math.min(t * 2.5, 1));
    const fa = Math.sin(t * Math.PI) * 0.25;
    frostG.lineStyle(3, 0xaaeeff, fa);
    frostG.drawEllipse(x, y + 8, fr, fr * 0.3);
    frostG.lineStyle(1.5, 0xffffff, fa * 0.5);
    frostG.drawEllipse(x, y + 8, fr * 0.85, fr * 0.25);

    // Crystal shards
    shardG.clear();
    shards.forEach(s => {
      const pt = Math.min(t / s.speed, 1);
      const a  = pt < 0.7 ? 0.85 : 0.85 * (1 - (pt - 0.7) / 0.3);
      const dist = s.len * easeOut(pt);
      const cx = x + Math.cos(s.angle) * dist;
      const cy = y + Math.sin(s.angle) * dist;
      const scale = 1 - pt * 0.3;
      drawCrystal(shardG, cx, cy, s.w * scale, s.h * scale, s.rot + pt * 0.5, col, a * 0.7);
      // Inner bright edge
      drawCrystal(shardG, cx, cy, s.w * scale * 0.5, s.h * scale * 0.6, s.rot + pt * 0.5, 0xeeffff, a * 0.4);
    });

    // Cold mist
    mistG.clear();
    if (t > 0.1 && t < 0.9) {
      const mt = (t - 0.1) / 0.8;
      const ma = Math.sin(mt * Math.PI) * 0.12;
      for (let i = 0; i < 5; i++) {
        const mx = x + Math.sin(t * 3 + i * 1.5) * rad * 0.5;
        const my = y + Math.cos(t * 2 + i * 2) * rad * 0.3;
        mistG.beginFill(0xcceeFF, ma);
        mistG.drawCircle(mx, my, 22 + i * 6);
        mistG.endFill();
      }
    }

    // Sparkles at tips
    sparkG.clear();
    sparkles.forEach(sp => {
      const pt = (t - sp.phase) / (1 - sp.phase);
      if (pt <= 0 || pt >= 1) return;
      const pulse = Math.sin(pt * Math.PI * 4) * 0.5 + 0.5;
      const sx = x + Math.cos(sp.angle) * sp.dist;
      const sy = y + Math.sin(sp.angle) * sp.dist;
      const a  = Math.sin(pt * Math.PI) * pulse;
      sparkG.beginFill(0xffffff, a * 0.9);
      sparkG.drawStar(sx, sy, 4, sp.size * pulse, sp.size * 0.3);
      sparkG.endFill();
    });
  });

  cleanup(container);
}

/**
 * Heal v2: rising star sparkles + gentle ring pulse + golden dust.
 */
async function vfxHeal(x, y, opts = {}) {
  const col   = opts.color    ?? 0x44ff88;
  const count = opts.count    ?? 24;
  const dur   = opts.duration ?? 1400;

  const container = makeContainer(false);
  const glowLayer = new PIXI.Container();
  glowLayer.blendMode = PIXI.BLEND_MODES.ADD;
  container.addChild(glowLayer);

  const sparks = Array.from({ length: count }, () => ({
    ox:    rnd(-36, 36),
    speed: rnd(0.3, 0.75),
    size:  rnd(3, 8),
    phase: rnd(0, 0.4),
    wob:   rnd(-1, 1) * 18,
    rot:   rnd(0, TAU),
  }));

  const glowG = new PIXI.Graphics(); glowLayer.addChild(glowG);
  const ringG = new PIXI.Graphics(); container.addChild(ringG);
  const gfx = sparks.map(() => { const g = new PIXI.Graphics(); glowLayer.addChild(g); return g; });

  await animate(dur, t => {
    // Ambient glow
    glowG.clear();
    const ga = Math.sin(t * Math.PI) * 0.3;
    glowG.beginFill(col, ga * 0.5);
    glowG.drawCircle(x, y, 40 * Math.sin(t * Math.PI));
    glowG.endFill();

    // Pulse rings rising up
    ringG.clear();
    for (let r = 0; r < 3; r++) {
      const phase = (t * 2 + r * 0.33) % 1;
      const ry = y - phase * 60;
      const ra = (1 - phase) * Math.sin(t * Math.PI) * 0.35;
      ringG.lineStyle(1.5, col, ra);
      ringG.drawEllipse(x, ry, 28 * (1 - phase * 0.4), 10 * (1 - phase * 0.4));
    }

    // Rising sparkles
    sparks.forEach((s, i) => {
      const g  = gfx[i];
      g.clear();
      const pt = (t - s.phase) / (1 - s.phase);
      if (pt <= 0 || pt >= 1) return;
      const ept = easeOut(pt);
      const py  = y - ept * 95 * s.speed;
      const px  = x + s.ox + Math.sin(pt * Math.PI * 2.5) * s.wob;
      const a   = pt < 0.4 ? pt / 0.4 : 1 - (pt - 0.4) / 0.6;
      const sz  = s.size * (1 - pt * 0.35);
      if (sz < 0.5 || a < 0.04) return;
      g.beginFill(col, a * 0.85);
      g.drawStar(px, py, 4, sz, sz * 0.3, s.rot + pt * 2);
      g.endFill();
      g.beginFill(0xffffff, a * 0.55);
      g.drawCircle(px, py, sz * 0.25);
      g.endFill();
    });
  });

  cleanup(container);
}

/**
 * Impact v2: white flash + expanding rings + spark lines + screen shake.
 */
async function vfxImpact(x, y, opts = {}) {
  const col = opts.color    ?? 0xff4444;
  const rad = opts.radius   ?? 55;
  const dur = opts.duration ?? 550;

  const container = makeContainer(false);
  const flashLayer = new PIXI.Container();
  flashLayer.blendMode = PIXI.BLEND_MODES.ADD;
  container.addChild(flashLayer);

  screenShake(4, 200);

  const rings  = Array.from({ length: 3 }, (_, i) => {
    const g = new PIXI.Graphics(); container.addChild(g);
    return { g, delay: i * 0.1 };
  });
  const flashG = new PIXI.Graphics(); flashLayer.addChild(flashG);
  const sparks = Array.from({ length: 12 }, () => ({ angle: rnd(0, TAU), speed: rnd(0.4, 1.0), len: rnd(25, 50) }));
  const sparkG = new PIXI.Graphics(); container.addChild(sparkG);

  await animate(dur, t => {
    // White flash
    flashG.clear();
    if (t < 0.12) {
      const fa = (0.12 - t) / 0.12;
      flashG.beginFill(0xffffff, fa * 0.85);
      flashG.drawCircle(x, y, 28);
      flashG.endFill();
      flashG.beginFill(col, fa * 0.5);
      flashG.drawCircle(x, y, 18);
      flashG.endFill();
    }

    // Expanding rings
    rings.forEach(({ g, delay }) => {
      g.clear();
      const pt = Math.max(0, (t - delay) / (1 - delay));
      if (pt <= 0) return;
      g.lineStyle(Math.max(0.5, 3.5 * (1 - pt)), col, (1 - pt) * 0.8);
      g.drawCircle(x, y, rad * easeOut(pt));
    });

    // Spark lines
    sparkG.clear();
    if (t < 0.55) {
      sparks.forEach(s => {
        const st = t / (s.speed * 0.55);
        if (st >= 1) return;
        const d0 = 10 * easeOut(st);
        const d1 = s.len * easeOut(st);
        sparkG.lineStyle(2, col, (1 - st) * 0.85);
        sparkG.moveTo(x + Math.cos(s.angle) * d0, y + Math.sin(s.angle) * d0);
        sparkG.lineTo(x + Math.cos(s.angle) * d1, y + Math.sin(s.angle) * d1);
        // Bright tip
        sparkG.lineStyle(0);
        sparkG.beginFill(0xffffff, (1 - st) * 0.6);
        sparkG.drawCircle(x + Math.cos(s.angle) * d1, y + Math.sin(s.angle) * d1, 2);
        sparkG.endFill();
      });
    }
  });

  cleanup(container);
}

/**
 * Death v2: dark nova + dissolving particles + skull flash + soul wisps.
 */
async function vfxDeath(x, y, opts = {}) {
  const dur = opts.duration ?? 1800;

  const container = makeContainer(false);

  screenShake(6, 400);

  const particles = Array.from({ length: 36 }, () => ({
    angle: rnd(0, TAU),
    speed: rnd(0.15, 1.0),
    size:  rnd(5, 16),
    col:   [0x880000, 0x220000, 0x440000, 0x110011][Math.floor(Math.random() * 4)],
    life:  rnd(0.5, 1.0),
  }));

  // Soul wisps
  const wisps = Array.from({ length: 8 }, () => ({
    ox: rnd(-20, 20), speed: rnd(0.15, 0.5), size: rnd(3, 6), phase: rnd(0.3, 0.6),
    wob: rnd(-15, 15),
  }));

  const novaG  = new PIXI.Graphics(); container.addChild(novaG);
  const pGfx   = particles.map(() => { const g = new PIXI.Graphics(); container.addChild(g); return g; });
  const skullG = new PIXI.Graphics(); container.addChild(skullG);
  const wispLayer = new PIXI.Container();
  wispLayer.blendMode = PIXI.BLEND_MODES.ADD;
  container.addChild(wispLayer);
  const wispG  = new PIXI.Graphics(); wispLayer.addChild(wispG);

  await animate(dur, t => {
    // Dark nova
    novaG.clear();
    const nt = Math.min(t / 0.25, 1);
    const na = t < 0.25 ? 1 : 1 - (t - 0.25) / 0.75;
    novaG.beginFill(0x440000, na * 0.6);
    novaG.drawCircle(x, y, 90 * easeOut(nt));
    novaG.endFill();
    novaG.beginFill(0x000000, na * 0.5);
    novaG.drawCircle(x, y, 45 * easeOut(nt));
    novaG.endFill();
    // Outer ring
    if (t > 0.2) {
      const lt = (t - 0.2) / 0.8;
      novaG.lineStyle(3, 0x660000, (1 - lt) * 0.5);
      novaG.drawCircle(x, y, 90 * (0.5 + lt * 0.4));
      novaG.lineStyle(1, 0x330000, (1 - lt) * 0.3);
      novaG.drawCircle(x, y, 100 * (0.5 + lt * 0.4));
    }

    // Dissolving particles
    particles.forEach((p, i) => {
      const g = pGfx[i];
      g.clear();
      if (t >= p.life) return;
      const pt   = t / p.life;
      const dist = 120 * p.speed * easeOut(pt);
      const a    = (1 - pt) * 0.85;
      const sz   = p.size * (1 - pt * 0.6);
      if (sz < 0.5) return;
      const px = x + Math.cos(p.angle) * dist;
      const py = y + Math.sin(p.angle) * dist - dist * 0.2; // slight rise
      g.beginFill(p.col, a);
      g.drawCircle(px, py, sz);
      g.endFill();
    });

    // Skull silhouette flash
    skullG.clear();
    if (t > 0.1 && t < 0.35) {
      const st = (t - 0.1) / 0.25;
      const sa = Math.sin(st * Math.PI) * 0.7;
      // Simple skull from circles (head, eyes, jaw)
      skullG.beginFill(0xaa0000, sa);
      skullG.drawCircle(x, y - 10, 18); // head
      skullG.endFill();
      skullG.beginFill(0x000000, sa * 1.2);
      skullG.drawCircle(x - 7, y - 13, 4.5); // left eye
      skullG.drawCircle(x + 7, y - 13, 4.5); // right eye
      skullG.drawEllipse(x, y - 2, 5, 3);     // nose
      skullG.endFill();
      skullG.beginFill(0xaa0000, sa * 0.7);
      skullG.drawEllipse(x, y + 6, 12, 6);    // jaw
      skullG.endFill();
    }

    // Soul wisps rising
    wispG.clear();
    wisps.forEach(w => {
      const pt = (t - w.phase) / (1 - w.phase);
      if (pt <= 0 || pt >= 1) return;
      const wy = y - pt * 120 * w.speed;
      const wx = x + w.ox + Math.sin(pt * Math.PI * 3) * w.wob;
      const a  = Math.sin(pt * Math.PI) * 0.7;
      wispG.beginFill(0x8844aa, a);
      wispG.drawCircle(wx, wy, w.size * (1 - pt * 0.3));
      wispG.endFill();
      wispG.beginFill(0xccaaff, a * 0.5);
      wispG.drawCircle(wx, wy, w.size * 0.35);
      wispG.endFill();
    });
  });

  cleanup(container);
}

/**
 * Shield v2: hexagonal grid segments + rotating rune dots + pulse waves.
 */
async function vfxShield(x, y, opts = {}) {
  const col = opts.color    ?? 0x4488ff;
  const rad = opts.radius   ?? 50;
  const dur = opts.duration ?? 1400;

  const container = makeContainer(false);
  const glowLayer = new PIXI.Container();
  glowLayer.blendMode = PIXI.BLEND_MODES.ADD;
  container.addChild(glowLayer);

  const ringG = new PIXI.Graphics(); container.addChild(ringG);
  const hexG  = new PIXI.Graphics(); container.addChild(hexG);
  const runeG = new PIXI.Graphics(); glowLayer.addChild(runeG);

  await animate(dur, t => {
    const env   = Math.sin(t * Math.PI);
    const pulse = Math.sin(t * Math.PI * 5) * 0.06;
    const r     = rad * (1 + pulse);

    // Main rings
    ringG.clear();
    ringG.lineStyle(12, col, env * 0.1);
    ringG.drawCircle(x, y, r + 14);
    ringG.lineStyle(4, col, env * 0.5);
    ringG.drawCircle(x, y, r);
    ringG.lineStyle(1.5, 0xffffff, env * 0.35);
    ringG.drawCircle(x, y, r - 4);

    // Hex grid segments (6 arcs)
    hexG.clear();
    for (let i = 0; i < 6; i++) {
      const segAngle = (i / 6) * TAU + t * 0.3;
      const segLen   = TAU / 6 * 0.75;
      const ripple   = Math.sin(t * Math.PI * 3 + i * 1.2) * 0.15;
      hexG.lineStyle(2.5, col, env * (0.4 + ripple));
      // Draw arc as short line segments
      const steps = 8;
      let first = true;
      for (let s = 0; s <= steps; s++) {
        const a = segAngle + (s / steps) * segLen;
        const px = x + Math.cos(a) * (r + 2);
        const py = y + Math.sin(a) * (r + 2);
        if (first) { hexG.moveTo(px, py); first = false; } else hexG.lineTo(px, py);
      }
    }

    // Pulse waves
    [0, 0.5].forEach(offset => {
      const phase = ((t * 2 + offset) % 1);
      ringG.lineStyle(1.5, col, (1 - phase) * env * 0.5);
      ringG.drawCircle(x, y, rad * easeOut(phase));
    });

    // Rotating rune dots
    runeG.clear();
    for (let i = 0; i < 6; i++) {
      const a  = (i / 6) * TAU + t * Math.PI * 0.6;
      const rx = x + Math.cos(a) * r;
      const ry = y + Math.sin(a) * r;
      const glow = Math.sin(t * Math.PI * 4 + i) * 0.3 + 0.7;
      runeG.beginFill(0xffffff, env * glow * 0.8);
      runeG.drawCircle(rx, ry, 3.5);
      runeG.endFill();
      runeG.beginFill(col, env * 0.4);
      runeG.drawCircle(rx, ry, 6);
      runeG.endFill();
    }
  });

  cleanup(container);
}

/**
 * Shadow v2: rotating dark vortex + pulsing center + dark tendrils.
 */
async function vfxShadow(x, y, opts = {}) {
  const col = opts.color    ?? 0x4400aa;
  const dur = opts.duration ?? 1200;

  const container = makeContainer(false);

  const spirals = Array.from({ length: 6 }, (_, i) => ({
    startAngle: (i / 6) * TAU,
    maxLen: rnd(40, 80),
    thick:  rnd(2, 5),
  }));

  // Dark tendrils
  const tendrils = Array.from({ length: 8 }, () => ({
    angle: rnd(0, TAU), len: rnd(30, 65), phase: rnd(0, 0.3),
  }));

  const sGfx    = spirals.map(() => { const g = new PIXI.Graphics(); container.addChild(g); return g; });
  const centerG = new PIXI.Graphics(); container.addChild(centerG);
  const tendG   = new PIXI.Graphics(); container.addChild(tendG);

  await animate(dur, t => {
    const env      = Math.sin(t * Math.PI);
    const rotation = t * Math.PI * 6;

    // Spirals
    spirals.forEach((s, i) => {
      const g = sGfx[i];
      g.clear();
      g.lineStyle(s.thick, col, env * 0.7);
      const steps = 16;
      let first = true;
      for (let j = 0; j < steps; j++) {
        const jt   = j / (steps - 1);
        const ang  = s.startAngle + rotation + jt * Math.PI * 1.4;
        const dist = s.maxLen * jt * env;
        const px   = x + Math.cos(ang) * dist;
        const py   = y + Math.sin(ang) * dist;
        if (first) { g.moveTo(px, py); first = false; } else g.lineTo(px, py);
      }
    });

    // Pulsing center
    centerG.clear();
    const cr = 22 * (0.4 + 0.6 * Math.sin(t * Math.PI * 3.5));
    centerG.beginFill(0x000000, env * 0.7);
    centerG.drawCircle(x, y, cr);
    centerG.endFill();
    centerG.beginFill(col, env * 0.4);
    centerG.drawCircle(x, y, cr * 0.5);
    centerG.endFill();
    centerG.beginFill(0xffffff, env * 0.1);
    centerG.drawCircle(x, y, cr * 0.2);
    centerG.endFill();

    // Dark tendrils reaching outward
    tendG.clear();
    tendrils.forEach(td => {
      const pt = Math.max(0, (t - td.phase) / (1 - td.phase));
      if (pt <= 0 || pt >= 1) return;
      const reach = td.len * easeOut(pt) * env;
      const wob   = Math.sin(pt * Math.PI * 4) * 12;
      tendG.lineStyle(2, col, (1 - pt) * env * 0.5);
      tendG.moveTo(x, y);
      const mid = {
        x: x + Math.cos(td.angle) * reach * 0.5 + Math.cos(td.angle + Math.PI / 2) * wob,
        y: y + Math.sin(td.angle) * reach * 0.5 + Math.sin(td.angle + Math.PI / 2) * wob,
      };
      tendG.quadraticCurveTo(mid.x, mid.y,
        x + Math.cos(td.angle) * reach, y + Math.sin(td.angle) * reach);
    });
  });

  cleanup(container);
}

/**
 * Water v2: ripples + arcing droplets + splash foam.
 */
async function vfxWater(x, y, opts = {}) {
  const col = opts.color    ?? 0x44aaff;
  const dur = opts.duration ?? 1100;

  const container = makeContainer(false);
  const glowLayer = new PIXI.Container();
  glowLayer.blendMode = PIXI.BLEND_MODES.ADD;
  container.addChild(glowLayer);

  const ripples = [0, 0.15, 0.30].map((delay, i) => {
    const g = new PIXI.Graphics(); container.addChild(g);
    return { g, delay, rad: 38 + i * 20 };
  });

  const droplets = Array.from({ length: 16 }, () => ({
    angle: rnd(0, TAU), speed: rnd(0.35, 0.85), height: rnd(25, 60), size: rnd(2.5, 5),
  }));
  const dropG = new PIXI.Graphics(); container.addChild(dropG);
  const foamG = new PIXI.Graphics(); glowLayer.addChild(foamG);

  await animate(dur, t => {
    // Ripples
    ripples.forEach(({ g, delay, rad }) => {
      g.clear();
      const pt = Math.max(0, (t - delay) / (1 - delay));
      if (pt <= 0 || pt >= 1) return;
      g.lineStyle(2.5, col, (1 - pt) * 0.65);
      g.drawCircle(x, y, rad * easeOut(pt));
      g.lineStyle(1, 0xffffff, (1 - pt) * 0.2);
      g.drawEllipse(x, y, rad * easeOut(pt), rad * easeOut(pt) * 0.35);
    });

    // Droplets with arc
    dropG.clear();
    droplets.forEach(d => {
      if (t >= d.speed) return;
      const pt = t / d.speed;
      const px = x + Math.cos(d.angle) * 40 * pt;
      const py = y - Math.sin(pt * Math.PI) * d.height;
      dropG.beginFill(col, (1 - pt) * 0.75);
      dropG.drawCircle(px, py, d.size * (1 - pt * 0.4));
      dropG.endFill();
      dropG.beginFill(0xffffff, (1 - pt) * 0.3);
      dropG.drawCircle(px - 1, py - 1, d.size * 0.3);
      dropG.endFill();
    });

    // Foam/spray at center
    foamG.clear();
    if (t < 0.35) {
      const ft = t / 0.35;
      foamG.beginFill(0xffffff, (1 - ft) * 0.25);
      foamG.drawCircle(x, y, 20 * easeOut(ft));
      foamG.endFill();
    }
  });

  cleanup(container);
}

/**
 * Poison v2: rising bubbles + toxic cloud + dripping effect.
 */
async function vfxPoison(x, y, opts = {}) {
  const col = opts.color    ?? 0x44ff44;
  const dur = opts.duration ?? 1200;

  const container = makeContainer(false);

  const bubbles = Array.from({ length: 22 }, () => ({
    ox:    rnd(-38, 38),
    speed: rnd(0.25, 0.75),
    size:  rnd(5, 14),
    phase: rnd(0, 0.35),
    col:   Math.random() > 0.5 ? col : 0x88ff00,
  }));

  // Toxic cloud
  const clouds = Array.from({ length: 6 }, () => ({
    ox: rnd(-25, 25), oy: rnd(-15, 15), size: rnd(18, 35), phase: rnd(0, 0.3),
  }));

  const cloudG = new PIXI.Graphics(); container.addChild(cloudG);
  const bGfx = bubbles.map(() => { const g = new PIXI.Graphics(); container.addChild(g); return g; });

  await animate(dur, t => {
    // Toxic cloud
    cloudG.clear();
    clouds.forEach(c => {
      const pt = Math.max(0, (t - c.phase) / (1 - c.phase));
      if (pt <= 0 || pt >= 1) return;
      const a = Math.sin(pt * Math.PI) * 0.15;
      const sz = c.size * (0.7 + pt * 0.5);
      cloudG.beginFill(col, a);
      cloudG.drawCircle(x + c.ox + Math.sin(t * 3) * 5, y + c.oy - pt * 30, sz);
      cloudG.endFill();
    });

    // Bubbles
    bubbles.forEach((b, i) => {
      const g  = bGfx[i];
      g.clear();
      const pt = (t - b.phase) / (1 - b.phase);
      if (pt <= 0 || pt >= 1) return;
      const py = y - pt * 80 * b.speed;
      const wobble = Math.sin(pt * Math.PI * 3) * 6;
      const a  = 1 - pt;
      const sz = b.size * (0.5 + 0.5 * Math.sin(pt * Math.PI));
      // Bubble outline
      g.lineStyle(1.5, 0xffffff, a * 0.3);
      g.beginFill(b.col, a * 0.45);
      g.drawCircle(x + b.ox + wobble, py, sz);
      g.endFill();
      g.lineStyle(0);
      // Highlight
      g.beginFill(0xffffff, a * 0.25);
      g.drawCircle(x + b.ox + wobble - sz * 0.25, py - sz * 0.25, sz * 0.3);
      g.endFill();
    });
  });

  cleanup(container);
}

/**
 * Summoning Circle: double rotating rune circle + energy pillar + glyphs.
 */
async function vfxSummon(x, y, opts = {}) {
  const col = opts.color    ?? 0xffaa44;
  const rad = opts.radius   ?? 55;
  const dur = opts.duration ?? 2000;

  const container = makeContainer(false);
  const glowLayer = new PIXI.Container();
  glowLayer.blendMode = PIXI.BLEND_MODES.ADD;
  container.addChild(glowLayer);

  const circleG = new PIXI.Graphics(); container.addChild(circleG);
  const pillarG = new PIXI.Graphics(); glowLayer.addChild(pillarG);
  const glyphG  = new PIXI.Graphics(); glowLayer.addChild(glyphG);

  await animate(dur, t => {
    const env = t < 0.15 ? t / 0.15 : (t > 0.85 ? (1 - t) / 0.15 : 1);
    const rot1 = t * Math.PI * 2;
    const rot2 = -t * Math.PI * 1.4;

    // Double circle
    circleG.clear();
    circleG.lineStyle(3, col, env * 0.6);
    circleG.drawCircle(x, y, rad);
    circleG.lineStyle(1.5, col, env * 0.4);
    circleG.drawCircle(x, y, rad * 0.7);
    // Inner star
    circleG.lineStyle(2, col, env * 0.5);
    for (let i = 0; i < 5; i++) {
      const a1 = rot1 + (i / 5) * TAU;
      const a2 = rot1 + ((i + 2) / 5) * TAU;
      circleG.moveTo(x + Math.cos(a1) * rad * 0.7, y + Math.sin(a1) * rad * 0.7);
      circleG.lineTo(x + Math.cos(a2) * rad * 0.7, y + Math.sin(a2) * rad * 0.7);
    }

    // Glyphs on outer ring
    glyphG.clear();
    for (let i = 0; i < 8; i++) {
      const a  = rot2 + (i / 8) * TAU;
      const gx = x + Math.cos(a) * rad;
      const gy = y + Math.sin(a) * rad;
      const pulse = Math.sin(t * Math.PI * 3 + i * 0.8) * 0.4 + 0.6;
      glyphG.beginFill(col, env * pulse * 0.9);
      glyphG.drawStar(gx, gy, 4, 5, 2);
      glyphG.endFill();
    }

    // Energy pillar
    pillarG.clear();
    if (t > 0.2 && t < 0.9) {
      const pt = (t - 0.2) / 0.7;
      const pillarH = 120 * easeOut(pt);
      const pa = Math.sin(pt * Math.PI) * 0.35;
      // Gradient pillar (wider at base, narrow at top)
      for (let s = 0; s < 8; s++) {
        const st = s / 7;
        const w  = 18 * (1 - st * 0.6);
        const py = y - st * pillarH;
        pillarG.beginFill(col, pa * (1 - st * 0.7));
        pillarG.drawEllipse(x, py, w, 4);
        pillarG.endFill();
      }
    }
  });

  cleanup(container);
}

/**
 * Vine Tendrils: green vines growing from ground upward in spirals.
 */
async function vfxVines(x, y, opts = {}) {
  const col = opts.color    ?? 0x228822;
  const dur = opts.duration ?? 1400;

  const container = makeContainer(false);

  const vines = Array.from({ length: 6 }, (_, i) => ({
    angle: (i / 6) * TAU + rnd(-0.3, 0.3),
    len: rnd(50, 90),
    thick: rnd(2, 4),
    curl: rnd(1.5, 3),
    speed: rnd(0.4, 0.8),
  }));

  const vineG = new PIXI.Graphics(); container.addChild(vineG);
  const leafG = new PIXI.Graphics(); container.addChild(leafG);

  await animate(dur, t => {
    const env = t < 0.1 ? t / 0.1 : (t > 0.85 ? (1 - t) / 0.15 : 1);

    vineG.clear();
    leafG.clear();

    vines.forEach(v => {
      const growth = Math.min(t / v.speed, 1);
      const steps  = Math.floor(20 * growth);
      if (steps < 2) return;

      vineG.lineStyle(v.thick, col, env * 0.8);
      let first = true;
      let lastX = x, lastY = y;
      for (let s = 0; s <= steps; s++) {
        const st = s / 20;
        const dist = v.len * st;
        const curl = Math.sin(st * Math.PI * v.curl) * 20 * st;
        const vx = x + Math.cos(v.angle) * curl + Math.cos(v.angle + Math.PI / 2) * dist * 0.3;
        const vy = y - dist; // grow upward
        if (first) { vineG.moveTo(vx, vy); first = false; } else vineG.lineTo(vx, vy);
        lastX = vx; lastY = vy;
      }

      // Leaf buds at tip
      if (growth > 0.5) {
        const la = (growth - 0.5) * 2;
        leafG.beginFill(0x44bb44, env * la * 0.7);
        leafG.drawEllipse(lastX + 4, lastY, 5 * la, 3 * la);
        leafG.drawEllipse(lastX - 4, lastY - 3, 5 * la, 3 * la);
        leafG.endFill();
      }
    });

    // Ground roots
    vineG.lineStyle(3, 0x115511, env * 0.4);
    vineG.drawEllipse(x, y + 4, 25 * Math.min(t * 3, 1), 6 * Math.min(t * 3, 1));
  });

  cleanup(container);
}

/**
 * Tornado: spiraling particles + debris + funnel shape.
 */
async function vfxTornado(x, y, opts = {}) {
  const col = opts.color    ?? 0xccddff;
  const dur = opts.duration ?? 1500;

  const container = makeContainer(false);

  const particles = Array.from({ length: 40 }, (_, i) => ({
    phase: rnd(0, TAU),
    height: rnd(0, 1),
    speed: rnd(2, 5),
    size: rnd(2, 5),
    col: Math.random() > 0.6 ? 0x998866 : col, // some debris colored
  }));

  const pG = new PIXI.Graphics(); container.addChild(pG);
  const funnelG = new PIXI.Graphics(); container.addChild(funnelG);

  await animate(dur, t => {
    const env = Math.sin(t * Math.PI);

    // Funnel outline
    funnelG.clear();
    funnelG.lineStyle(1.5, col, env * 0.2);
    for (let h = 0; h < 12; h++) {
      const ht = h / 11;
      const ry = y - ht * 110;
      const rr = 8 + (1 - ht) * 40; // wider at bottom
      funnelG.drawEllipse(x, ry, rr, rr * 0.25);
    }

    // Spiraling particles
    pG.clear();
    particles.forEach(p => {
      const ht  = p.height;
      const py  = y - ht * 110;
      const rr  = 8 + (1 - ht) * 38;
      const ang = p.phase + t * p.speed * TAU;
      const px  = x + Math.cos(ang) * rr;
      const ppy = py + Math.sin(ang) * rr * 0.25;
      const a   = env * 0.8;
      pG.beginFill(p.col, a);
      pG.drawCircle(px, ppy, p.size * env);
      pG.endFill();
    });
  });

  cleanup(container);
}

// ── Projectile Renderers ─────────────────────────────────────────────────────

/**
 * Fire projectile v2: spinning core + spiral trail + ember sparks.
 */
async function vfxProjectileFire(fx, fy, tx, ty, opts = {}) {
  const col   = opts.color ?? 0xff6600;
  const glow  = opts.glow  ?? 0xffaa22;
  const size  = opts.size  ?? 11;
  const speed = opts.speed ?? 13;

  const container = makeContainer(false);
  const glowLayer = new PIXI.Container();
  glowLayer.blendMode = PIXI.BLEND_MODES.ADD;
  container.addChild(glowLayer);

  const dist  = Math.hypot(tx - fx, ty - fy);
  const ticks = Math.max(Math.ceil(dist / speed), 1);
  const trail = [];
  const MAX_TRAIL = 26;

  const g = new PIXI.Graphics(); container.addChild(g);
  const glowG = new PIXI.Graphics(); glowLayer.addChild(glowG);

  return new Promise(resolve => {
    let tick = 0;
    const onTick = () => {
      try {
        tick++;
        const t  = Math.min(tick / ticks, 1);
        const cx = fx + (tx - fx) * t;
        const cy = fy + (ty - fy) * t;
        const spin = tick * 0.3;

        trail.push({ x: cx, y: cy });
        while (trail.length > MAX_TRAIL) trail.shift();

        g.clear();
        glowG.clear();

        // Trail
        trail.forEach((p, i) => {
          const ta = (i / trail.length) * 0.5;
          const ts = size * (i / trail.length) * 0.6;
          if (ts < 0.5) return;
          g.beginFill(col, ta);
          g.drawCircle(p.x + rnd(-2, 2), p.y + rnd(-2, 2), ts);
          g.endFill();
        });

        // Outer glow
        glowG.beginFill(glow, 0.2);
        glowG.drawCircle(cx, cy, size * 2.5);
        glowG.endFill();

        // Spinning core
        g.beginFill(col, 0.8);
        g.drawCircle(cx, cy, size);
        g.endFill();
        g.beginFill(0xffffff, 0.85);
        g.drawCircle(cx + Math.cos(spin) * 3, cy + Math.sin(spin) * 3, size * 0.4);
        g.endFill();

        if (t >= 1) {
          canvas.app.ticker.remove(onTick);
          cleanup(container);
          resolve();
        }
      } catch (e) {
        canvas.app.ticker.remove(onTick);
        cleanup(container);
        resolve();
      }
    };
    canvas.app.ticker.add(onTick);
  });
}

/**
 * Lightning projectile: instant jagged beam.
 */
async function vfxProjectileLightning(fx, fy, tx, ty, opts = {}) {
  await vfxLightning(fx, fy, {
    endX:      tx,
    endY:      ty,
    color:     opts.color     ?? 0x9966ff,
    glowColor: opts.glowColor ?? 0xccaaff,
    duration:  opts.duration  ?? 500,
    flashes:   2,
    segments:  12,
  });
}

/**
 * Magic Ray v2: wavy glowing beam + impact burst.
 */
async function vfxProjectileMagicRay(fx, fy, tx, ty, opts = {}) {
  const col   = opts.color    ?? 0x9933ff;
  const glow  = opts.glow     ?? 0xcc66ff;
  const speed = opts.speed    ?? 18;
  const width = opts.width    ?? 6;

  const container = makeContainer(false);
  const glowLayer = new PIXI.Container();
  glowLayer.blendMode = PIXI.BLEND_MODES.ADD;
  container.addChild(glowLayer);

  const dist  = Math.hypot(tx - fx, ty - fy);
  const ticks = Math.max(Math.ceil(dist / speed), 1);
  const angle = Math.atan2(ty - fy, tx - fx);
  const perp  = angle + Math.PI / 2;

  const g = new PIXI.Graphics(); container.addChild(g);
  const glowG = new PIXI.Graphics(); glowLayer.addChild(glowG);
  const burstG = new PIXI.Graphics(); glowLayer.addChild(burstG);

  return new Promise(resolve => {
    let tick = 0;
    const onTick = () => {
      try {
        tick++;
        const t  = Math.min(tick / ticks, 1);
        const cx = fx + (tx - fx) * t;
        const cy = fy + (ty - fy) * t;

        g.clear();
        glowG.clear();

        // Wavy beam (draw as segmented line with sine offset)
        const beamSteps = 16;
        const drawBeam = (w, c, a) => {
          g.lineStyle(w, c, a);
          let first = true;
          for (let s = 0; s <= beamSteps; s++) {
            const bt = s / beamSteps * t;
            const bx = fx + (tx - fx) * bt;
            const by = fy + (ty - fy) * bt;
            const wave = Math.sin(bt * 12 + tick * 0.15) * 4;
            const px = bx + Math.cos(perp) * wave;
            const py = by + Math.sin(perp) * wave;
            if (first) { g.moveTo(px, py); first = false; } else g.lineTo(px, py);
          }
        };

        drawBeam(width * 3.5, glow, 0.1);
        drawBeam(width * 1.8, glow, 0.28);
        drawBeam(width, col, 0.85);
        drawBeam(width * 0.3, 0xffffff, 0.75);

        // Head glow
        glowG.beginFill(glow, 0.22);
        glowG.drawCircle(cx, cy, width * 3.5);
        glowG.endFill();
        glowG.beginFill(col, 0.7);
        glowG.drawCircle(cx, cy, width * 1.5);
        glowG.endFill();
        glowG.beginFill(0xffffff, 0.85);
        glowG.drawCircle(cx, cy, width * 0.5);
        glowG.endFill();

        // Impact burst
        burstG.clear();
        if (t >= 0.9) {
          const bt = (t - 0.9) / 0.1;
          const br = width * 12 * bt;
          burstG.beginFill(glow, (1 - bt) * 0.45);
          burstG.drawCircle(tx, ty, br);
          burstG.endFill();
          burstG.beginFill(col, (1 - bt) * 0.7);
          burstG.drawCircle(tx, ty, br * 0.4);
          burstG.endFill();
        }

        if (t >= 1) {
          canvas.app.ticker.remove(onTick);
          animate(300, bt => {
            burstG.clear();
            const r = width * 16 * easeOut(bt);
            burstG.beginFill(glow, (1 - bt) * 0.35);
            burstG.drawCircle(tx, ty, r);
            burstG.endFill();
          }).then(() => { cleanup(container); resolve(); });
        }
      } catch (e) {
        canvas.app.ticker.remove(onTick);
        cleanup(container);
        resolve();
      }
    };
    canvas.app.ticker.add(onTick);
  });
}

/**
 * Arrow projectile v2: shaft + arrowhead + dust on impact.
 */
async function vfxProjectileArrow(fx, fy, tx, ty, opts = {}) {
  const col   = opts.color ?? 0xddaa44;
  const speed = opts.speed ?? 22;

  const container = makeContainer(false);
  const dist  = Math.hypot(tx - fx, ty - fy);
  const ticks = Math.max(Math.ceil(dist / speed), 1);
  const angle = Math.atan2(ty - fy, tx - fx);

  const g = new PIXI.Graphics();
  container.addChild(g);

  return new Promise(resolve => {
    let tick = 0;
    const onTick = () => {
      try {
        tick++;
        const t  = Math.min(tick / ticks, 1);
        const cx = fx + (tx - fx) * t;
        const cy = fy + (ty - fy) * t;
        const shaftLen = 24;

        g.clear();
        // Shaft
        g.lineStyle(2, col, 0.85);
        g.moveTo(cx - Math.cos(angle) * shaftLen, cy - Math.sin(angle) * shaftLen);
        g.lineTo(cx, cy);
        // Fletching
        const fa = angle + Math.PI;
        g.lineStyle(1, 0x886644, 0.6);
        g.moveTo(cx - Math.cos(angle) * shaftLen, cy - Math.sin(angle) * shaftLen);
        g.lineTo(cx - Math.cos(angle) * shaftLen + Math.cos(fa + 0.4) * 6,
                 cy - Math.sin(angle) * shaftLen + Math.sin(fa + 0.4) * 6);
        g.moveTo(cx - Math.cos(angle) * shaftLen, cy - Math.sin(angle) * shaftLen);
        g.lineTo(cx - Math.cos(angle) * shaftLen + Math.cos(fa - 0.4) * 6,
                 cy - Math.sin(angle) * shaftLen + Math.sin(fa - 0.4) * 6);
        // Arrowhead
        g.lineStyle(0);
        g.beginFill(0xcccccc, 0.9);
        const tipLen = 5;
        g.drawPolygon([
          cx + Math.cos(angle) * tipLen, cy + Math.sin(angle) * tipLen,
          cx + Math.cos(angle + 2.6) * 4, cy + Math.sin(angle + 2.6) * 4,
          cx + Math.cos(angle - 2.6) * 4, cy + Math.sin(angle - 2.6) * 4,
        ]);
        g.endFill();

        if (t >= 1) {
          canvas.app.ticker.remove(onTick);
          // Dust puff on impact
          animate(250, dt => {
            g.clear();
            for (let i = 0; i < 5; i++) {
              const da = rnd(0, TAU);
              const dd = 12 * easeOut(dt);
              g.beginFill(0x998866, (1 - dt) * 0.3);
              g.drawCircle(tx + Math.cos(da) * dd, ty + Math.sin(da) * dd, 3 * (1 - dt));
              g.endFill();
            }
          }).then(() => { cleanup(container); resolve(); });
        }
      } catch (e) {
        canvas.app.ticker.remove(onTick);
        cleanup(container);
        resolve();
      }
    };
    canvas.app.ticker.add(onTick);
  });
}

/**
 * Ice Shard projectile: rotating crystal flying towards target.
 */
async function vfxProjectileIceShard(fx, fy, tx, ty, opts = {}) {
  const col   = opts.color ?? 0x88ddff;
  const speed = opts.speed ?? 16;

  const container = makeContainer(false);
  const glowLayer = new PIXI.Container();
  glowLayer.blendMode = PIXI.BLEND_MODES.ADD;
  container.addChild(glowLayer);

  const dist  = Math.hypot(tx - fx, ty - fy);
  const ticks = Math.max(Math.ceil(dist / speed), 1);

  const g = new PIXI.Graphics(); container.addChild(g);
  const glowG = new PIXI.Graphics(); glowLayer.addChild(glowG);

  return new Promise(resolve => {
    let tick = 0;
    const onTick = () => {
      try {
        tick++;
        const t  = Math.min(tick / ticks, 1);
        const cx = fx + (tx - fx) * t;
        const cy = fy + (ty - fy) * t;
        const rot = tick * 0.15;

        g.clear();
        glowG.clear();

        // Glow
        glowG.beginFill(col, 0.15);
        glowG.drawCircle(cx, cy, 16);
        glowG.endFill();

        // Crystal shard
        drawCrystal(g, cx, cy, 8, 22, rot, col, 0.8);
        drawCrystal(g, cx, cy, 4, 14, rot, 0xeeffff, 0.5);

        // Frost trail
        if (tick > 3) {
          for (let i = 1; i <= 4; i++) {
            const tt = Math.max(0, t - i * 0.02);
            const tx2 = fx + (tx - fx) * tt;
            const ty2 = fy + (ty - fy) * tt;
            g.beginFill(col, 0.15 * (1 - i / 4));
            g.drawCircle(tx2, ty2, 4 * (1 - i / 4));
            g.endFill();
          }
        }

        if (t >= 1) {
          canvas.app.ticker.remove(onTick);
          cleanup(container);
          resolve();
        }
      } catch (e) {
        canvas.app.ticker.remove(onTick);
        cleanup(container);
        resolve();
      }
    };
    canvas.app.ticker.add(onTick);
  });
}

// ── Registry ─────────────────────────────────────────────────────────────────

/** Maps effect names to standalone VFX functions. */
const VFX_MAP = {
  // Lightning / electric
  lightning:    (x, y, o) => vfxLightning(x, y, o),
  blitz:        (x, y, o) => vfxLightning(x, y, o),
  fulminictus:  (x, y, o) => vfxLightning(x, y, { ...o, color: 0x4466ff, glowColor: 0x88aaff }),
  donnerkeil:   (x, y, o) => vfxLightning(x, y, { ...o, color: 0xddaa00, glowColor: 0xffee44 }),
  // Fire
  feuerball:    (x, y, o) => vfxFire(x, y, o),
  explosion:    (x, y, o) => vfxFire(x, y, { ...o, particles: 50, radius: 130, duration: 1400 }),
  flammenpfeil: (x, y, o) => vfxFire(x, y, { ...o, particles: 18, radius: 42 }),
  brennen:      (x, y, o) => vfxFire(x, y, { ...o, radius: 35, duration: 1800, color1: 0xff4400, color2: 0xff8800, shake: false }),
  // Ice / Frost
  eis:          (x, y, o) => vfxIce(x, y, o),
  aquafaxius:   (x, y, o) => vfxIce(x, y, { ...o, color: 0x44aaff, shards: 12 }),
  // Water
  wasser:       (x, y, o) => vfxWater(x, y, o),
  // Heal / Light
  heilung:      (x, y, o) => vfxHeal(x, y, o),
  balsamsal:    (x, y, o) => vfxHeal(x, y, { ...o, color: 0x88ffaa }),
  attributo:    (x, y, o) => vfxHeal(x, y, { ...o, color: 0xffbb44 }),
  respondami:   (x, y, o) => vfxHeal(x, y, { ...o, color: 0xddddff }),
  visibili:     (x, y, o) => vfxHeal(x, y, { ...o, color: 0xcccccc, count: 16 }),
  // Impact / Damage
  schadenflash: (x, y, o) => vfxImpact(x, y, o),
  horriphobus:  (x, y, o) => vfxImpact(x, y, { ...o, color: 0xaa44ff }),
  // Death
  tod_animation:(x, y, o) => vfxDeath(x, y, o),
  pandemonium:  (x, y, o) => vfxDeath(x, y, { ...o, duration: 2400 }),
  // Shield / Protect
  armatrutz:    (x, y, o) => vfxShield(x, y, o),
  paralysis:    (x, y, o) => vfxShield(x, y, { ...o, color: 0xaaff44, radius: 44 }),
  silentium:    (x, y, o) => vfxShield(x, y, { ...o, color: 0xaaaaff }),
  // Summoning (NEW)
  invocatio:    (x, y, o) => vfxSummon(x, y, { ...o, color: 0xffaa44, radius: 55, duration: 1800 }),
  daemonenbann: (x, y, o) => vfxSummon(x, y, { ...o, color: 0xcc2222, radius: 60, duration: 2000 }),
  // Shadow / Dark
  schatten:     (x, y, o) => vfxShadow(x, y, o),
  schattenform: (x, y, o) => vfxShadow(x, y, { ...o, duration: 1700 }),
  planastral:   (x, y, o) => vfxShadow(x, y, { ...o, color: 0x220066, duration: 2200 }),
  portal:       (x, y, o) => vfxSummon(x, y, { ...o, color: 0x4400aa, radius: 50, duration: 2000 }),
  // Poison / Nature
  gift:         (x, y, o) => vfxPoison(x, y, o),
  odem:         (x, y, o) => vfxPoison(x, y, { ...o, color: 0x44ff44 }),
  // Vines (NEW)
  fesselranken: (x, y, o) => vfxVines(x, y, o),
  // Wind / Tornado (NEW)
  wind:         (x, y, o) => vfxTornado(x, y, o),
  // Misc
  motoricus:    (x, y, o) => vfxIce(x, y, { ...o, color: 0xffeedd, shards: 10 }),
  verwandlung:  (x, y, o) => vfxFire(x, y, { ...o, color1: 0xaa44ff, color2: 0xff44aa, shake: false }),
};

/** Maps projectile effect names to travel-VFX functions. */
const VFX_PROJECTILE_MAP = {
  // Feuer
  feuerball:    (fx, fy, tx, ty, o) => vfxProjectileFire(fx, fy, tx, ty, o),
  flammenpfeil: (fx, fy, tx, ty, o) => vfxProjectileFire(fx, fy, tx, ty, o),
  feuerpfeil:   (fx, fy, tx, ty, o) => vfxProjectileFire(fx, fy, tx, ty, { ...o, size: 7 }),
  // Eis
  eis:          (fx, fy, tx, ty, o) => vfxProjectileIceShard(fx, fy, tx, ty, o),
  eisball:      (fx, fy, tx, ty, o) => vfxProjectileIceShard(fx, fy, tx, ty, { ...o, speed: 14 }),
  eispfeil:     (fx, fy, tx, ty, o) => vfxProjectileIceShard(fx, fy, tx, ty, { ...o, speed: 20 }),
  aquafaxius:   (fx, fy, tx, ty, o) => vfxProjectileIceShard(fx, fy, tx, ty, o),
  // Blitz
  blitz:        (fx, fy, tx, ty, o) => vfxProjectileLightning(fx, fy, tx, ty, o),
  blitzball:    (fx, fy, tx, ty, o) => vfxProjectileMagicRay(fx, fy, tx, ty, { color: 0x9966ff, glow: 0xccaaff, width: 7 }),
  blitzpfeil:   (fx, fy, tx, ty, o) => vfxProjectileLightning(fx, fy, tx, ty, { ...o, duration: 350 }),
  donnerkeil:   (fx, fy, tx, ty, o) => vfxProjectileMagicRay(fx, fy, tx, ty, { color: 0xddaa00, glow: 0xffee88 }),
  fulminictus:  (fx, fy, tx, ty, o) => vfxProjectileMagicRay(fx, fy, tx, ty, { color: 0xddddff, glow: 0xffffff, width: 8 }),
  // Gift
  giftball:     (fx, fy, tx, ty, o) => vfxProjectileFire(fx, fy, tx, ty, { ...o, color: 0x44ff44, glow: 0x88ff00 }),
  odem:         (fx, fy, tx, ty, o) => vfxProjectileFire(fx, fy, tx, ty, { ...o, color: 0x44ff44, glow: 0x88ff00 }),
  // Wasser
  wasserball:   (fx, fy, tx, ty, o) => vfxProjectileFire(fx, fy, tx, ty, { ...o, color: 0x4488ff, glow: 0x88ccff }),
  // Schatten
  schattenball: (fx, fy, tx, ty, o) => vfxProjectileMagicRay(fx, fy, tx, ty, { color: 0x4400aa, glow: 0x8844cc, width: 6 }),
  // Pfeile (mundane + elementar)
  pfeil:        (fx, fy, tx, ty, o) => vfxProjectileArrow(fx, fy, tx, ty, o),
  pfeil_feuer:  (fx, fy, tx, ty, o) => vfxProjectileFire(fx, fy, tx, ty, { ...o, size: 7 }),
  pfeil_eis:    (fx, fy, tx, ty, o) => vfxProjectileIceShard(fx, fy, tx, ty, { ...o, speed: 20 }),
  pfeil_erz:    (fx, fy, tx, ty, o) => vfxProjectileMagicRay(fx, fy, tx, ty, { color: 0xaa8844, glow: 0xddbb66, width: 5 }),
  pfeil_humus:  (fx, fy, tx, ty, o) => vfxProjectileFire(fx, fy, tx, ty, { ...o, color: 0x44aa22, glow: 0x88dd44, size: 6 }),
  pfeil_luft:   (fx, fy, tx, ty, o) => vfxProjectileMagicRay(fx, fy, tx, ty, { color: 0xccddff, glow: 0xeeffff, width: 4 }),
  pfeil_wasser: (fx, fy, tx, ty, o) => vfxProjectileFire(fx, fy, tx, ty, { ...o, color: 0x4488ff, glow: 0x88ccff, size: 6 }),
  // Magic Rays
  horriphobus:  (fx, fy, tx, ty, o) => vfxProjectileMagicRay(fx, fy, tx, ty, { color: 0xaa44ff, glow: 0xdd88ff }),
  invocatio:    (fx, fy, tx, ty, o) => vfxProjectileMagicRay(fx, fy, tx, ty, { color: 0xffaa44, glow: 0xffdd88 }),
  motoricus:    (fx, fy, tx, ty, o) => vfxProjectileMagicRay(fx, fy, tx, ty, { color: 0xffeedd, glow: 0xffffff }),
  respondami:   (fx, fy, tx, ty, o) => vfxProjectileMagicRay(fx, fy, tx, ty, { color: 0xddddff, glow: 0xffffff }),
};

// ── Public API ───────────────────────────────────────────────────────────────

/** Returns true if a dynamic VFX is registered for this effect name. */
export function hasVFX(name) {
  return name in VFX_MAP;
}

/** Returns true if a dynamic projectile VFX is registered for this effect name. */
export function hasProjectileVFX(name) {
  return name in VFX_PROJECTILE_MAP;
}

/**
 * Spawns a standalone dynamic VFX at canvas position (x, y).
 */
export async function spawnVFX(x, y, name, opts = {}) {
  const fn = VFX_MAP[name];
  if (!fn) return false;
  try {
    await fn(x, y, opts);
  } catch (e) {
    console.error(`[dsa-vfx] Effect "${name}" error:`, e);
  }
  return true;
}

/**
 * Spawns a dynamic projectile VFX travelling from one token to another,
 * then optionally triggers an impact effect.
 */
export async function spawnProjectileVFX(fromToken, toToken, name, impactName = null) {
  const fx = fromToken.center?.x ?? fromToken.x;
  const fy = fromToken.center?.y ?? fromToken.y;
  const tx = toToken.center?.x   ?? toToken.x;
  const ty = toToken.center?.y   ?? toToken.y;

  const projFn = VFX_PROJECTILE_MAP[name];
  if (projFn) {
    try { await projFn(fx, fy, tx, ty, {}); } catch (e) { console.error(`[dsa-vfx] Projectile "${name}":`, e); }
  }

  if (impactName) {
    await spawnVFX(tx, ty, impactName, {});
  }
}
