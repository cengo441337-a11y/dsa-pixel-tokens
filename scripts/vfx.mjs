/**
 * DSA Fantasy VTT — Dynamic VFX Engine
 * PIXI.Graphics-basierte Zauber- und Kampfeffekte ohne Sprite-Sheets.
 * Kompatibel mit FoundryVTT v12 / PIXI.js v7.
 */

// ── Utilities ────────────────────────────────────────────────────────────────

const rnd  = (min, max) => min + Math.random() * (max - min);
const lerp = (a, b, t)  => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 2);
const easeIn  = t => t * t;
const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

function getLayer() {
  return canvas.interface ?? canvas.controls;
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

// ── Effect Renderers ─────────────────────────────────────────────────────────

/**
 * Lightning: jagged multi-pass beam from (x,y) to (endX,endY).
 * Three passes (outer glow → mid glow → bright core) with branch sparks.
 */
async function vfxLightning(x, y, opts = {}) {
  const endX    = opts.endX     ?? x;
  const endY    = opts.endY     ?? y - 80;
  const col     = opts.color    ?? 0x9966ff;
  const glow    = opts.glowColor ?? 0xccaaff;
  const segs    = opts.segments ?? 8;
  const dur     = opts.duration ?? 650;
  const flashes = opts.flashes  ?? 3;

  const layer = getLayer();
  const container = new PIXI.Container();
  layer.addChild(container);

  const drawBeam = () => {
    // Destroy old children
    while (container.children.length) {
      container.children[0].destroy();
    }

    // Three passes: outer glow, inner glow, core
    const passes = [
      { w: 14, col: glow, alpha: 0.10, jitter: 6  },
      { w: 6,  col: glow, alpha: 0.35, jitter: 14 },
      { w: 2,  col: col,  alpha: 0.95, jitter: 20 },
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

    // Random branch sparks
    for (let b = 0; b < 2; b++) {
      if (Math.random() > 0.55) continue;
      const bt   = rnd(0.25, 0.75);
      const bx   = lerp(x, endX, bt) + rnd(-8, 8);
      const by   = lerp(y, endY, bt) + rnd(-8, 8);
      const bLen = rnd(18, 42);
      const bAng = rnd(0, Math.PI * 2);
      const bg   = new PIXI.Graphics();
      bg.lineStyle(1, col, 0.65);
      bg.moveTo(bx, by);
      bg.lineTo(bx + Math.cos(bAng) * bLen, by + Math.sin(bAng) * bLen);
      container.addChild(bg);
    }

    // Impact burst
    const burst = new PIXI.Graphics();
    burst.beginFill(glow, 0.55);
    burst.drawCircle(endX, endY, rnd(7, 16));
    burst.endFill();
    burst.beginFill(0xffffff, 0.85);
    burst.drawCircle(endX, endY, rnd(2, 5));
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

  await animate(180, t => { container.alpha = 1 - t; });

  try { layer.removeChild(container); container.destroy({ children: true }); } catch (_) {}
}

/**
 * Fire: expanding burst — glow core + drifting particles.
 */
async function vfxFire(x, y, opts = {}) {
  const col1  = opts.color1   ?? 0xff6600;
  const col2  = opts.color2   ?? 0xffdd00;
  const count = opts.particles ?? 24;
  const rad   = opts.radius   ?? 65;
  const dur   = opts.duration ?? 850;

  const layer = getLayer();
  const container = new PIXI.Container();
  layer.addChild(container);

  const particles = Array.from({ length: count }, () => ({
    angle: rnd(0, Math.PI * 2),
    speed: rnd(0.35, 1.0),
    size:  rnd(4, 10),
    col:   Math.random() > 0.5 ? col1 : col2,
    life:  rnd(0.55, 1.0),
    drift: rnd(-8, 8),
  }));

  const coreG = new PIXI.Graphics();
  container.addChild(coreG);
  const pGfx = particles.map(() => { const g = new PIXI.Graphics(); container.addChild(g); return g; });

  await animate(dur, t => {
    coreG.clear();
    const ga = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75;
    const gr = rad * 0.55 * easeOut(t);
    coreG.beginFill(0xff8800, ga * 0.35);
    coreG.drawCircle(x, y, gr);
    coreG.endFill();
    coreG.beginFill(0xffee66, ga * 0.2);
    coreG.drawCircle(x, y, gr * 0.5);
    coreG.endFill();

    particles.forEach((p, i) => {
      const g = pGfx[i];
      g.clear();
      if (t >= p.life) return;
      const pt   = t / p.life;
      const dist = rad * p.speed * easeOut(pt);
      const px   = x + Math.cos(p.angle) * dist + p.drift * pt;
      const py   = y + Math.sin(p.angle) * dist - dist * 0.35;
      const a    = 1 - easeIn(pt);
      const sz   = p.size * (1 - pt * 0.55);
      if (sz < 0.5 || a < 0.04) return;
      g.beginFill(p.col, a);
      g.drawCircle(px, py, sz);
      g.endFill();
      if (sz > 3) {
        g.beginFill(0xffffff, a * 0.4);
        g.drawCircle(px, py, sz * 0.4);
        g.endFill();
      }
    });
  });

  try { layer.removeChild(container); container.destroy({ children: true }); } catch (_) {}
}

/**
 * Ice: crystalline shards radiating outward with sparkling tips.
 */
async function vfxIce(x, y, opts = {}) {
  const col   = opts.color   ?? 0x88ddff;
  const count = opts.shards  ?? 12;
  const rad   = opts.radius  ?? 70;
  const dur   = opts.duration ?? 950;

  const layer = getLayer();
  const container = new PIXI.Container();
  layer.addChild(container);

  const shards = Array.from({ length: count }, (_, i) => ({
    angle: (i / count) * Math.PI * 2 + rnd(-0.15, 0.15),
    len:   rnd(22, rad),
    thick: rnd(2, 7),
    speed: rnd(0.55, 1.0),
  }));

  const glowG = new PIXI.Graphics();
  container.addChild(glowG);
  const sGfx = shards.map(() => { const g = new PIXI.Graphics(); container.addChild(g); return g; });

  await animate(dur, t => {
    glowG.clear();
    const ga = Math.sin(t * Math.PI) * 0.35;
    glowG.beginFill(0xaaeeff, ga);
    glowG.drawCircle(x, y, 28 * easeOut(t));
    glowG.endFill();

    shards.forEach((s, i) => {
      const g  = sGfx[i];
      g.clear();
      const pt = Math.min(t / s.speed, 1);
      const a  = pt < 0.75 ? 0.9 : 0.9 * (1 - (pt - 0.75) / 0.25);
      const dist = s.len * easeOut(pt);
      const ex = x + Math.cos(s.angle) * dist;
      const ey = y + Math.sin(s.angle) * dist;
      const thick = s.thick * (1 - pt * 0.45);
      g.lineStyle(thick, col, a * 0.85);
      g.moveTo(x + Math.cos(s.angle) * dist * 0.08, y + Math.sin(s.angle) * dist * 0.08);
      g.lineTo(ex, ey);
      g.lineStyle(0);
      g.beginFill(0xeeffff, a * 0.7);
      g.drawCircle(ex, ey, thick * 0.7 * (1 - pt * 0.8));
      g.endFill();
      // Cross sparkle at tip
      if (pt < 0.6 && thick > 3) {
        const ca = s.angle + Math.PI / 2;
        g.lineStyle(1, 0xffffff, a * 0.5);
        g.moveTo(ex + Math.cos(ca) * 5, ey + Math.sin(ca) * 5);
        g.lineTo(ex - Math.cos(ca) * 5, ey - Math.sin(ca) * 5);
      }
    });
  });

  try { layer.removeChild(container); container.destroy({ children: true }); } catch (_) {}
}

/**
 * Heal: upward rising sparkles with gentle glow.
 */
async function vfxHeal(x, y, opts = {}) {
  const col   = opts.color    ?? 0x44ff88;
  const count = opts.count    ?? 20;
  const dur   = opts.duration ?? 1300;

  const layer = getLayer();
  const container = new PIXI.Container();
  layer.addChild(container);

  const sparks = Array.from({ length: count }, () => ({
    ox:    rnd(-32, 32),
    speed: rnd(0.3, 0.8),
    size:  rnd(3, 7),
    phase: rnd(0, 0.45),
    wob:   rnd(-1, 1) * 15,
  }));

  const glowG = new PIXI.Graphics();
  container.addChild(glowG);
  const gfx = sparks.map(() => { const g = new PIXI.Graphics(); container.addChild(g); return g; });

  await animate(dur, t => {
    glowG.clear();
    const ga = Math.sin(t * Math.PI) * 0.25;
    glowG.beginFill(col, ga);
    glowG.drawCircle(x, y, 35 * Math.sin(t * Math.PI));
    glowG.endFill();

    sparks.forEach((s, i) => {
      const g  = gfx[i];
      g.clear();
      const pt = (t - s.phase) / (1 - s.phase);
      if (pt <= 0 || pt >= 1) return;
      const ept = easeOut(pt);
      const py  = y - ept * 90 * s.speed;
      const px  = x + s.ox + Math.sin(pt * Math.PI * 2) * s.wob;
      const a   = pt < 0.45 ? pt / 0.45 : 1 - (pt - 0.45) / 0.55;
      const sz  = s.size * (1 - pt * 0.4);
      if (sz < 0.5 || a < 0.04) return;
      g.beginFill(col, a * 0.9);
      g.drawStar(px, py, 4, sz, sz * 0.35);
      g.endFill();
      g.beginFill(0xffffff, a * 0.5);
      g.drawCircle(px, py, sz * 0.28);
      g.endFill();
    });
  });

  try { layer.removeChild(container); container.destroy({ children: true }); } catch (_) {}
}

/**
 * Impact: white flash + expanding rings + spark lines.
 */
async function vfxImpact(x, y, opts = {}) {
  const col = opts.color    ?? 0xff4444;
  const rad = opts.radius   ?? 52;
  const dur = opts.duration ?? 520;

  const layer = getLayer();
  const container = new PIXI.Container();
  layer.addChild(container);

  const rings  = Array.from({ length: 3 }, (_, i) => {
    const g = new PIXI.Graphics(); container.addChild(g);
    return { g, delay: i * 0.12 };
  });
  const flashG = new PIXI.Graphics(); container.addChild(flashG);

  const sparks = Array.from({ length: 8 }, () => ({ angle: rnd(0, Math.PI * 2), speed: rnd(0.5, 1.0) }));
  const sparkG = new PIXI.Graphics(); container.addChild(sparkG);

  await animate(dur, t => {
    // White flash
    flashG.clear();
    if (t < 0.15) {
      flashG.beginFill(0xffffff, (0.15 - t) / 0.15 * 0.75);
      flashG.drawCircle(x, y, 24);
      flashG.endFill();
    }

    // Rings
    rings.forEach(({ g, delay }) => {
      g.clear();
      const pt = Math.max(0, (t - delay) / (1 - delay));
      if (pt <= 0) return;
      g.lineStyle(Math.max(0.5, 3 * (1 - pt)), col, (1 - pt) * 0.85);
      g.drawCircle(x, y, rad * easeOut(pt));
    });

    // Sparks
    sparkG.clear();
    if (t < 0.6) {
      sparks.forEach(s => {
        const st = t / (s.speed * 0.6);
        if (st >= 1) return;
        const d0 = 12 * easeOut(st);
        const d1 = 42 * easeOut(st);
        sparkG.lineStyle(1.5, col, (1 - st) * 0.9);
        sparkG.moveTo(x + Math.cos(s.angle) * d0, y + Math.sin(s.angle) * d0);
        sparkG.lineTo(x + Math.cos(s.angle) * d1, y + Math.sin(s.angle) * d1);
      });
    }
  });

  try { layer.removeChild(container); container.destroy({ children: true }); } catch (_) {}
}

/**
 * Death: dark nova + dissolving particles + bone-cross.
 */
async function vfxDeath(x, y, opts = {}) {
  const dur = opts.duration ?? 1600;

  const layer = getLayer();
  const container = new PIXI.Container();
  layer.addChild(container);

  const particles = Array.from({ length: 28 }, () => ({
    angle: rnd(0, Math.PI * 2),
    speed: rnd(0.2, 1.0),
    size:  rnd(5, 14),
    col:   Math.random() > 0.5 ? 0x880000 : 0x220000,
    life:  rnd(0.6, 1.0),
  }));

  const novaG = new PIXI.Graphics();  container.addChild(novaG);
  const pGfx  = particles.map(() => { const g = new PIXI.Graphics(); container.addChild(g); return g; });
  const crossG = new PIXI.Graphics(); container.addChild(crossG);

  await animate(dur, t => {
    novaG.clear();
    const nt = Math.min(t / 0.3, 1);
    const na = t < 0.3 ? 1 : 1 - (t - 0.3) / 0.7;
    novaG.beginFill(0x550000, na * 0.65);
    novaG.drawCircle(x, y, 80 * easeOut(nt));
    novaG.endFill();
    novaG.beginFill(0x000000, na * 0.45);
    novaG.drawCircle(x, y, 40 * easeOut(nt));
    novaG.endFill();
    if (t > 0.3) {
      const lt = (t - 0.3) / 0.7;
      novaG.lineStyle(3, 0x660000, (1 - lt) * 0.45);
      novaG.drawCircle(x, y, 80 * (0.5 + lt * 0.3));
    }

    particles.forEach((p, i) => {
      const g = pGfx[i];
      g.clear();
      if (t >= p.life) return;
      const pt   = t / p.life;
      const dist = 105 * p.speed * easeOut(pt);
      const a    = (1 - pt) * 0.85;
      const sz   = p.size * a;
      if (sz < 0.5) return;
      g.beginFill(p.col, a);
      g.drawCircle(x + Math.cos(p.angle) * dist, y + Math.sin(p.angle) * dist, sz);
      g.endFill();
    });

    // Bone cross
    crossG.clear();
    const ba = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65;
    const cl = 28;
    crossG.lineStyle(4, 0xaa0000, ba * 0.7);
    crossG.moveTo(x - cl, y);   crossG.lineTo(x + cl, y);
    crossG.moveTo(x, y - cl);   crossG.lineTo(x, y + cl);
  });

  try { layer.removeChild(container); container.destroy({ children: true }); } catch (_) {}
}

/**
 * Shield/Aura: pulsing concentric rings with rotating rune marks.
 */
async function vfxShield(x, y, opts = {}) {
  const col = opts.color    ?? 0x4488ff;
  const rad = opts.radius   ?? 48;
  const dur = opts.duration ?? 1300;

  const layer = getLayer();
  const container = new PIXI.Container();
  layer.addChild(container);

  const ringG = new PIXI.Graphics(); container.addChild(ringG);
  const runeG = new PIXI.Graphics(); container.addChild(runeG);

  await animate(dur, t => {
    const env   = Math.sin(t * Math.PI);
    const pulse = Math.sin(t * Math.PI * 4) * 0.08;
    const r     = rad * (1 + pulse);

    ringG.clear();
    ringG.lineStyle(10, col, env * 0.15);
    ringG.drawCircle(x, y, r + 12);
    ringG.lineStyle(4, col, env * 0.5);
    ringG.drawCircle(x, y, r);
    ringG.lineStyle(1.5, 0xffffff, env * 0.4);
    ringG.drawCircle(x, y, r - 5);

    // Two expanding pulse waves, offset by half cycle
    [0, 0.5].forEach(offset => {
      const phase = ((t * 2 + offset) % 1);
      ringG.lineStyle(1.5, col, (1 - phase) * env * 0.6);
      ringG.drawCircle(x, y, rad * easeOut(phase));
    });

    runeG.clear();
    for (let i = 0; i < 4; i++) {
      const a  = (i / 4) * Math.PI * 2 + t * Math.PI * 0.5;
      const rx = x + Math.cos(a) * rad;
      const ry = y + Math.sin(a) * rad;
      runeG.beginFill(col, env * 0.85);
      runeG.drawCircle(rx, ry, 3);
      runeG.endFill();
    }
  });

  try { layer.removeChild(container); container.destroy({ children: true }); } catch (_) {}
}

/**
 * Shadow: rotating dark spiral vortex.
 */
async function vfxShadow(x, y, opts = {}) {
  const col = opts.color    ?? 0x4400aa;
  const dur = opts.duration ?? 1100;

  const layer = getLayer();
  const container = new PIXI.Container();
  layer.addChild(container);

  const spirals = Array.from({ length: 5 }, (_, i) => ({
    startAngle: (i / 5) * Math.PI * 2,
    maxLen: rnd(35, 70),
    thick:  rnd(2, 4),
  }));

  const sGfx   = spirals.map(() => { const g = new PIXI.Graphics(); container.addChild(g); return g; });
  const centerG = new PIXI.Graphics(); container.addChild(centerG);

  await animate(dur, t => {
    const env      = Math.sin(t * Math.PI);
    const rotation = t * Math.PI * 5;

    spirals.forEach((s, i) => {
      const g = sGfx[i];
      g.clear();
      g.lineStyle(s.thick, col, env * 0.75);
      const steps = 14;
      let first = true;
      for (let j = 0; j < steps; j++) {
        const jt   = j / (steps - 1);
        const ang  = s.startAngle + rotation + jt * Math.PI * 1.2;
        const dist = s.maxLen * jt;
        const px   = x + Math.cos(ang) * dist;
        const py   = y + Math.sin(ang) * dist;
        if (first) { g.moveTo(px, py); first = false; } else g.lineTo(px, py);
      }
    });

    centerG.clear();
    const cr = 18 * (0.5 + 0.5 * Math.sin(t * Math.PI * 3));
    centerG.beginFill(0x000000, env * 0.6);
    centerG.drawCircle(x, y, cr);
    centerG.endFill();
    centerG.beginFill(col, env * 0.35);
    centerG.drawCircle(x, y, cr * 0.55);
    centerG.endFill();
  });

  try { layer.removeChild(container); container.destroy({ children: true }); } catch (_) {}
}

/**
 * Water: rippling circles + arcing droplets.
 */
async function vfxWater(x, y, opts = {}) {
  const col = opts.color    ?? 0x44aaff;
  const dur = opts.duration ?? 1000;

  const layer = getLayer();
  const container = new PIXI.Container();
  layer.addChild(container);

  const ripples = [0, 0.18, 0.36].map((delay, i) => {
    const g = new PIXI.Graphics(); container.addChild(g);
    return { g, delay, rad: 35 + i * 18 };
  });

  const droplets = Array.from({ length: 12 }, () => ({
    angle:  rnd(0, Math.PI * 2),
    speed:  rnd(0.4, 0.9),
    height: rnd(20, 50),
  }));
  const dropG = new PIXI.Graphics(); container.addChild(dropG);

  await animate(dur, t => {
    ripples.forEach(({ g, delay, rad }) => {
      g.clear();
      const pt = Math.max(0, (t - delay) / (1 - delay));
      if (pt <= 0 || pt >= 1) return;
      g.lineStyle(2, col, (1 - pt) * 0.7);
      g.drawCircle(x, y, rad * easeOut(pt));
      g.lineStyle(1, col, (1 - pt) * 0.25);
      g.drawEllipse(x, y, rad * easeOut(pt), rad * easeOut(pt) * 0.38);
    });

    dropG.clear();
    droplets.forEach(d => {
      if (t >= d.speed) return;
      const pt = t / d.speed;
      const px = x + Math.cos(d.angle) * 35 * pt;
      const py = y - Math.sin(pt * Math.PI) * d.height;
      dropG.beginFill(col, (1 - pt) * 0.8);
      dropG.drawCircle(px, py, 3 * (1 - pt * 0.5));
      dropG.endFill();
    });
  });

  try { layer.removeChild(container); container.destroy({ children: true }); } catch (_) {}
}

/**
 * Toxic/Poison: rising bubbles with translucent fill.
 */
async function vfxPoison(x, y, opts = {}) {
  const col = opts.color    ?? 0x44ff44;
  const dur = opts.duration ?? 1100;

  const layer = getLayer();
  const container = new PIXI.Container();
  layer.addChild(container);

  const bubbles = Array.from({ length: 18 }, () => ({
    ox:    rnd(-35, 35),
    speed: rnd(0.3, 0.8),
    size:  rnd(4, 12),
    phase: rnd(0, 0.4),
    col:   Math.random() > 0.5 ? col : 0x88ff00,
  }));
  const bGfx = bubbles.map(() => { const g = new PIXI.Graphics(); container.addChild(g); return g; });

  await animate(dur, t => {
    bubbles.forEach((b, i) => {
      const g  = bGfx[i];
      g.clear();
      const pt = (t - b.phase) / (1 - b.phase);
      if (pt <= 0 || pt >= 1) return;
      const py = y - pt * 70 * b.speed;
      const a  = 1 - pt;
      const sz = b.size * (0.5 + 0.5 * Math.sin(pt * Math.PI));
      g.lineStyle(1, 0xffffff, a * 0.35);
      g.beginFill(b.col, a * 0.5);
      g.drawCircle(x + b.ox, py, sz);
      g.endFill();
      g.lineStyle(0);
      g.beginFill(0xffffff, a * 0.22);
      g.drawCircle(x + b.ox - sz * 0.28, py - sz * 0.28, sz * 0.28);
      g.endFill();
    });
  });

  try { layer.removeChild(container); container.destroy({ children: true }); } catch (_) {}
}

// ── Projectile Renderers ─────────────────────────────────────────────────────

/**
 * Fire projectile: glowing orb with particle trail.
 */
async function vfxProjectileFire(fx, fy, tx, ty, opts = {}) {
  const col   = opts.color ?? 0xff6600;
  const glow  = opts.glow  ?? 0xffaa22;
  const size  = opts.size  ?? 10;
  const speed = opts.speed ?? 12;

  const layer = getLayer();
  const dist  = Math.hypot(tx - fx, ty - fy);
  const ticks = Math.max(Math.ceil(dist / speed), 1);
  const trail = [];
  const MAX_TRAIL = 22;

  const container = new PIXI.Container();
  layer.addChild(container);
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

        trail.push({ x: cx, y: cy });
        while (trail.length > MAX_TRAIL) trail.shift();

        g.clear();
        trail.forEach((p, i) => {
          const ta = (i / trail.length) * 0.55;
          const ts = size * (i / trail.length) * 0.65;
          if (ts < 0.5 || ta < 0.02) return;
          g.beginFill(col, ta);
          g.drawCircle(p.x, p.y, ts);
          g.endFill();
        });
        g.beginFill(glow, 0.25);
        g.drawCircle(cx, cy, size * 2.2);
        g.endFill();
        g.beginFill(col, 0.75);
        g.drawCircle(cx, cy, size);
        g.endFill();
        g.beginFill(0xffffff, 0.85);
        g.drawCircle(cx, cy, size * 0.42);
        g.endFill();

        if (t >= 1) {
          canvas.app.ticker.remove(onTick);
          try { layer.removeChild(container); container.destroy({ children: true }); } catch (_) {}
          resolve();
        }
      } catch (e) {
        canvas.app.ticker.remove(onTick);
        try { layer.removeChild(container); container.destroy({ children: true }); } catch (_) {}
        resolve();
      }
    };
    canvas.app.ticker.add(onTick);
  });
}

/**
 * Lightning projectile: instant jagged beam (delegates to vfxLightning).
 */
async function vfxProjectileLightning(fx, fy, tx, ty, opts = {}) {
  await vfxLightning(fx, fy, {
    endX:      tx,
    endY:      ty,
    color:     opts.color     ?? 0x9966ff,
    glowColor: opts.glowColor ?? 0xccaaff,
    duration:  opts.duration  ?? 450,
    flashes:   2,
    segments:  10,
  });
}

/**
 * Arrow/mundane projectile: thin line with arrowhead.
 */
async function vfxProjectileArrow(fx, fy, tx, ty, opts = {}) {
  const col   = opts.color ?? 0xddaa44;
  const speed = opts.speed ?? 20;

  const layer = getLayer();
  const dist  = Math.hypot(tx - fx, ty - fy);
  const ticks = Math.max(Math.ceil(dist / speed), 1);
  const angle = Math.atan2(ty - fy, tx - fx);

  const container = new PIXI.Container();
  layer.addChild(container);
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
        const shaftLen = 22;

        g.clear();
        g.lineStyle(2, col, 0.9);
        g.moveTo(cx - Math.cos(angle) * shaftLen, cy - Math.sin(angle) * shaftLen);
        g.lineTo(cx, cy);
        g.lineStyle(0);
        g.beginFill(0xffffff, 0.8);
        g.drawCircle(cx, cy, 2.5);
        g.endFill();

        if (t >= 1) {
          canvas.app.ticker.remove(onTick);
          try { layer.removeChild(container); container.destroy({ children: true }); } catch (_) {}
          resolve();
        }
      } catch (e) {
        canvas.app.ticker.remove(onTick);
        try { layer.removeChild(container); container.destroy({ children: true }); } catch (_) {}
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
  explosion:    (x, y, o) => vfxFire(x, y, { ...o, particles: 42, radius: 120, duration: 1300 }),
  flammenpfeil: (x, y, o) => vfxFire(x, y, { ...o, particles: 14, radius: 40 }),
  brennen:      (x, y, o) => vfxFire(x, y, { ...o, radius: 30, duration: 1600, color1: 0xff4400, color2: 0xff8800 }),
  // Ice / Frost
  eis:          (x, y, o) => vfxIce(x, y, o),
  aquafaxius:   (x, y, o) => vfxIce(x, y, { ...o, color: 0x44aaff, shards: 10 }),
  // Water
  wasser:       (x, y, o) => vfxWater(x, y, o),
  // Heal / Light
  heilung:      (x, y, o) => vfxHeal(x, y, o),
  balsamsal:    (x, y, o) => vfxHeal(x, y, { ...o, color: 0x88ffaa }),
  attributo:    (x, y, o) => vfxHeal(x, y, { ...o, color: 0xffbb44 }),
  respondami:   (x, y, o) => vfxHeal(x, y, { ...o, color: 0xddddff }),
  visibili:     (x, y, o) => vfxHeal(x, y, { ...o, color: 0xcccccc, count: 14 }),
  // Impact / Damage
  schadenflash: (x, y, o) => vfxImpact(x, y, o),
  horriphobus:  (x, y, o) => vfxImpact(x, y, { ...o, color: 0xaa44ff }),
  // Death
  tod_animation:(x, y, o) => vfxDeath(x, y, o),
  pandemonium:  (x, y, o) => vfxDeath(x, y, { ...o, duration: 2200 }),
  // Shield / Protect
  armatrutz:    (x, y, o) => vfxShield(x, y, o),
  paralysis:    (x, y, o) => vfxShield(x, y, { ...o, color: 0xaaff44, radius: 42 }),
  silentium:    (x, y, o) => vfxShield(x, y, { ...o, color: 0xaaaaff }),
  invocatio:    (x, y, o) => vfxShield(x, y, { ...o, color: 0xffaa44, radius: 55, duration: 1600 }),
  // Shadow / Dark
  schatten:     (x, y, o) => vfxShadow(x, y, o),
  schattenform: (x, y, o) => vfxShadow(x, y, { ...o, duration: 1600 }),
  daemonenbann: (x, y, o) => vfxShadow(x, y, { ...o, color: 0x880000, duration: 1300 }),
  planastral:   (x, y, o) => vfxShadow(x, y, { ...o, color: 0x220066, duration: 2000 }),
  portal:       (x, y, o) => vfxShadow(x, y, { ...o, color: 0x4400aa, duration: 1800 }),
  // Poison / Nature
  gift:         (x, y, o) => vfxPoison(x, y, o),
  odem:         (x, y, o) => vfxPoison(x, y, { ...o, color: 0x44ff44 }),
  fesselranken: (x, y, o) => vfxPoison(x, y, { ...o, color: 0x228822 }),
  // Misc
  motoricus:    (x, y, o) => vfxIce(x, y, { ...o, color: 0xffeedd, shards: 8 }),
  wind:         (x, y, o) => vfxIce(x, y, { ...o, color: 0xccddff, shards: 16, radius: 80 }),
  verwandlung:  (x, y, o) => vfxFire(x, y, { ...o, color1: 0xaa44ff, color2: 0xff44aa }),
};

/** Maps projectile effect names to travel-VFX functions. */
const VFX_PROJECTILE_MAP = {
  feuerball:    (fx, fy, tx, ty, o) => vfxProjectileFire(fx, fy, tx, ty, o),
  flammenpfeil: (fx, fy, tx, ty, o) => vfxProjectileFire(fx, fy, tx, ty, o),
  aquafaxius:   (fx, fy, tx, ty, o) => vfxProjectileFire(fx, fy, tx, ty, { ...o, color: 0x44aaff, glow: 0x88ddff }),
  odem:         (fx, fy, tx, ty, o) => vfxProjectileFire(fx, fy, tx, ty, { ...o, color: 0x44ff44, glow: 0x88ff00 }),
  donnerkeil:   (fx, fy, tx, ty, o) => vfxProjectileLightning(fx, fy, tx, ty, { color: 0xddaa00, glowColor: 0xffee44 }),
  blitz:        (fx, fy, tx, ty, o) => vfxProjectileLightning(fx, fy, tx, ty, o),
  pfeil:        (fx, fy, tx, ty, o) => vfxProjectileArrow(fx, fy, tx, ty, o),
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
 * @param {number} x
 * @param {number} y
 * @param {string} name - Effect name (must be in VFX_MAP)
 * @param {object} [opts] - Optional overrides passed to the effect function
 * @returns {Promise<boolean>} true if effect was rendered, false if unknown
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
 * @param {Token} fromToken
 * @param {Token} toToken
 * @param {string} name - Projectile effect name
 * @param {string|null} [impactName] - Optional impact effect name (uses VFX_MAP)
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
