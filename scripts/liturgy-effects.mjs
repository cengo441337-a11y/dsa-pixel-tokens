/**
 * DSA 4.1 Liturgy Effects Dispatcher
 *
 * Wendet visuelle und mechanische Effekte beim Wirken einer erfolgreichen
 * Liturgie an. Quellen:
 *   - Liber Liturgium (LL)
 *   - Wege der Götter (WdG)
 *
 * Architektur:
 *   - LITURGY_EFFECTS map: id-keyed effect specs
 *   - applyLiturgyEffects(): dispatcher, ruft je nach 'apply' branch
 *   - Damage/Heal/Buff/Dispel werden mechanisch angewandt
 *   - Alle anderen Liturgien bekommen einen passenden VFX-Glow + Chat-Beschreibung
 *   - Fallback: generischer holy_light auf den Caster
 */

import { MODULE_ID, broadcastVFX, relayActorUpdate, relayTokenUpdate } from "./config.mjs";
import { addPersistentEffect, parseDuration } from "./persistent-effects.mjs";

// VFX-Namen die als persistente Aura unterstützt werden (in vfx.mjs PERSISTENT_PALETTES)
const PERSISTENT_CAPABLE = new Set([
  "holy_aura", "holy_seal", "rondra_aura", "boron_seal", "hesinde_glow",
  "travia_warm", "phex_dark", "peraine_heal", "ingerimm_forge", "rahja_love",
  "efferd_wave", "firun_ice", "tsa_rainbow", "shaman_smoke", "curse_dark",
]);

// ─── Helper: Caster-Token finden ─────────────────────────────────────────────

function getCasterToken(actor) {
  if (!actor) return null;
  // 1) Aktiv kontrollierter Token vom Caster
  const ctrl = canvas.tokens?.controlled?.[0];
  if (ctrl?.actor?.id === actor.id) return ctrl;
  // 2) Erster Token des Aktors auf der Szene
  return canvas.tokens?.placeables?.find(t => t.actor?.id === actor.id) ?? null;
}

function getTargetTokens() {
  const targets = Array.from(game.user.targets ?? []);
  return targets.length ? targets : [];
}

function tokenCenter(t) {
  return { x: t?.center?.x ?? t?.x ?? 0, y: t?.center?.y ?? t?.y ?? 0 };
}

// ─── Damage anwenden (LeP-Reduktion + Schaden-VFX) ───────────────────────────

async function applyHolyDamage(token, sp, opts = {}) {
  if (!token?.actor || sp <= 0) return;
  const sys = token.actor.system ?? {};
  const lep = Number(sys.LeP?.value ?? sys.lep?.value ?? 0);
  const lepNeu = Math.max(-30, lep - sp);
  await relayTokenUpdate(token, { "system.LeP.value": lepNeu });
  const c = tokenCenter(token);
  broadcastVFX({ kind: "effect", x: c.x, y: c.y, effect: opts.vfx ?? "holy_burst" });
  broadcastVFX({
    kind: "scrollingText",
    tgtTokenId: token.id,
    text: `-${sp}`,
    color: opts.color ?? "#ffd770",
    fontSize: 28,
  });
}

async function applyHolyHeal(token, lep, opts = {}) {
  if (!token?.actor || lep <= 0) return;
  const sys = token.actor.system ?? {};
  const cur = Number(sys.LeP?.value ?? sys.lep?.value ?? 0);
  const max = Number(sys.LeP?.max ?? sys.lep?.max ?? 30);
  const lepNeu = Math.min(max, cur + lep);
  await relayTokenUpdate(token, { "system.LeP.value": lepNeu });
  const c = tokenCenter(token);
  broadcastVFX({ kind: "effect", x: c.x, y: c.y, effect: opts.vfx ?? "holy_heal" });
  broadcastVFX({
    kind: "scrollingText",
    tgtTokenId: token.id,
    text: `+${lep}`,
    color: opts.color ?? "#88ffaa",
    fontSize: 26,
  });
}

async function applyAsPDrain(token, asp) {
  if (!token?.actor || asp <= 0) return;
  const sys = token.actor.system ?? {};
  const cur = Number(sys.AsP?.value ?? sys.asp?.value ?? 0);
  if (cur <= 0) return; // nicht-magisch, kein Effekt
  const aspNeu = Math.max(0, cur - asp);
  await relayTokenUpdate(token, { "system.AsP.value": aspNeu });
  const c = tokenCenter(token);
  broadcastVFX({ kind: "effect", x: c.x, y: c.y, effect: "dispel" });
  broadcastVFX({
    kind: "scrollingText",
    tgtTokenId: token.id,
    text: `−${asp} AsP`,
    color: "#aaccff",
    fontSize: 22,
  });
}

// ─── Buff via DSA-Pixel-Flag (wirkt wie ActiveEffect, dauerts via Combat-Tracker) ─

async function applyBuffFlag(actor, buffData) {
  if (!actor) return;
  const flagKey = "liturgyBuffs";
  const existing = actor.getFlag(MODULE_ID, flagKey) ?? [];
  const newBuff = {
    id: `lit_${Date.now()}_${Math.floor(Math.random()*1000)}`,
    appliedAt: Date.now(),
    ...buffData,
  };
  await actor.setFlag(MODULE_ID, flagKey, [...existing, newBuff]);
}

// ─── Effekt-Dispatch-Map ─────────────────────────────────────────────────────
// 'apply' kann sein:
//   "self_aura"     — Effekt + Buff auf Caster
//   "self_heal"     — heilt Caster
//   "target_heal"   — heilt Ziel-Token
//   "target_dmg"    — fügt Ziel-Token holy SP zu
//   "target_dispel" — drainiert AsP von Ziel
//   "target_buff"   — Buff auf Ziel-Token
//   "area_dmg"      — Schaden auf alle Targets
//   "ritual_only"   — nur VFX + Chat-Beschreibung (kein mech. Effekt)
//   "command"       — Heiliger Befehl-style: ring + scrollingText am Ziel

export const LITURGY_EFFECTS = {
  // ─── PRAIOS ───────────────────────────────────────────────────────────────
  "goldene-ruestung": {
    apply: "self_aura",
    vfx: "holy_aura",
    buff: { type: "RS", formula: "lkp_half", desc: "RS +LkP*/2 (Goldene Rüstung)" },
  },
  "blendstrahl": {
    apply: "target_dispel",
    vfx: "holy_burst",
    aspDrain: "lkp",  // LkP* AsP drain bei Magischen
    desc: "Blendstrahl entzieht magische Wesen LkP* AsP",
  },
  "praios-magiebann": {
    apply: "self_aura",
    vfx: "holy_seal",
    buff: { type: "antimagie_zone", formula: "permanent", desc: "Auge des Praios — Antimagie-Zone (LkP* SR)" },
  },
  "zerschmetternder-bannstrahl": {
    apply: "target_dmg",
    vfx: "holy_strike",
    damage: { formula: "lkp_plus_15", target: "paktierer", desc: "LkP*+15 SP geweiht/verletzend (gegen Paktierer)" },
    aspDrain: "all",  // Magiebegabte verlieren ALLE AsP
  },
  "argelions-mantel": {
    apply: "self_aura",
    vfx: "holy_aura",
    buff: { type: "magie_resist", formula: "lkp_plus_5", desc: "Zauber gegen Geweihte werden um LkP*+5 geschwächt" },
  },
  "anathema": {
    apply: "target_dmg",
    vfx: "curse_dark",
    damage: { formula: "lkp_plus_10", target: "all", desc: "Anathema — LkP*+10 SP" },
  },
  "exkommunikation": {
    apply: "target_dispel",
    vfx: "curse_dark",
    desc: "Schließt Ziel aus dem Götterglauben aus",
  },
  "exorzismus": {
    apply: "target_dispel",
    vfx: "dispel",
    aspDrain: "lkp_x2",
    desc: "Vertreibt unheilige Wesen, drainiert AsP",
  },
  "praios-mahnung": {
    apply: "command",
    vfx: "curse_dark",
    desc: "Strafe: Blind / Orientierung -LkP*+5 / Hörsturz",
  },
  "ordination": {
    apply: "self_aura",
    vfx: "holy_seal",
    desc: "Salbt einen neuen Geweihten",
  },
  "konsekration": {
    apply: "ritual_only",
    vfx: "holy_seal",
    desc: "Weiht einen Bereich (heilig vs unheilige Wesen)",
  },
  "heiliger-befehl": {
    apply: "command",
    vfx: "divine_command",
    desc: "Befehl, dem Ziel Selbstbeherrschung-Probe (vs LkP*+5) widerstehen muss",
  },
  "heiliger-lehnseid": {
    apply: "target_buff",
    vfx: "holy_seal",
    buff: { type: "eid", formula: "permanent", desc: "Heiliger Lehnseid — bei Bruch -LkP* auf alle Proben für LkP* Wochen" },
  },
  "innere-ruhe": {
    apply: "self_aura",
    vfx: "holy_light",
    buff: { type: "selbstbeherrschung", formula: "lkp_half", desc: "Selbstbeherrschung +LkP*/2" },
  },
  "weisung-des-himmels": {
    apply: "ritual_only",
    vfx: "holy_light",
    desc: "Zeigt die Himmelsrichtung / im Notfall Weg zur Sicherheit",
  },

  // ─── RONDRA ───────────────────────────────────────────────────────────────
  "thalionmels-schlachtgesang": {
    apply: "self_aura",
    vfx: "rondra_aura",
    buff: { type: "at_pa", formula: "lkp_half", desc: "AT/PA +LkP*/2 für Verbündete in Hörweite" },
  },
  "mikailspfeil": {
    apply: "target_dmg",
    vfx: "rondra_strike",
    projectile: "mikailspfeil",
    damage: { formula: "1w6_plus_lkp", desc: "1W6 + LkP* SP geweiht/verletzend" },
  },
  "rondras-wundersame-ruestung": {
    apply: "self_aura",
    vfx: "rondra_aura",
    buff: { type: "rs", formula: "lkp_half", desc: "Rondras wundersame Rüstung — RS +LkP*/2" },
  },
  "ehrenhafter-zweikampf": {
    apply: "ritual_only",
    vfx: "rondra_aura",
    desc: "Beide Kontrahenten gebunden, keine Einmischung möglich",
  },

  // ─── EFFERD ───────────────────────────────────────────────────────────────
  "anrufung-der-winde": {
    apply: "ritual_only",
    vfx: "efferd_wave",
    desc: "Beschwört günstige Winde (Reise/Schiff)",
  },

  // ─── TRAVIA ───────────────────────────────────────────────────────────────
  "heimsteinsegen": {
    apply: "ritual_only",
    vfx: "travia_warm",
    desc: "Schützt das Heim vor Übel + Untote",
  },
  "speisesegen": {
    apply: "ritual_only",
    vfx: "travia_warm",
    desc: "Speise wird haltbar + sättigend",
  },
  "tranksegen": {
    apply: "ritual_only",
    vfx: "travia_warm",
    desc: "Trank wird rein + heilsam",
  },

  // ─── BORON ────────────────────────────────────────────────────────────────
  "borons-suesse-gnade": {
    apply: "target_heal",
    vfx: "boron_seal",
    heal: { formula: "lkp_x2", desc: "Heilt LkP*×2 LeP, oder erlöst sterbenden" },
  },
  "ruf-in-borons-arme": {
    apply: "target_dmg",
    vfx: "boron_seal",
    damage: { formula: "lkp_plus_5", desc: "Reißt Seele in Borons Reich (LkP*+5 SP)" },
  },
  "siegel-borons": {
    apply: "ritual_only",
    vfx: "boron_seal",
    desc: "Schützt Grab/Reliquie vor Schändung",
  },

  // ─── HESINDE ──────────────────────────────────────────────────────────────
  "blick-der-weberin": {
    apply: "self_aura",
    vfx: "hesinde_glow",
    desc: "Sieht magische und geistige Auras (LkP* SR)",
  },
  "argelions-bannende-hand": {
    apply: "target_dispel",
    vfx: "dispel",
    aspDrain: "lkp_plus_5",
    desc: "Dispel: ZfP*-Reduktion -LkP*+5 oder Spruch komplett aufgehoben",
  },
  "schlangenstab": {
    apply: "self_aura",
    vfx: "hesinde_glow",
    desc: "Stab wird Schlange (Begleiter LkP* Stunden)",
  },
  "weisheitssegen": {
    apply: "self_aura",
    vfx: "hesinde_glow",
    buff: { type: "kl_in", formula: "1", desc: "KL/IN +1 für 1 Probe" },
  },

  // ─── PHEX ─────────────────────────────────────────────────────────────────
  "phexens-augenzwinkern": {
    apply: "target_dmg",
    vfx: "phex_dark",
    projectile: "phex_dart",
    damage: { formula: "lkp_half", desc: "LkP*/2 SP überraschend (oft tödlich)" },
  },
  "phexens-meisterschluessel": {
    apply: "ritual_only",
    vfx: "phex_dark",
    desc: "Öffnet jedes nicht-magische Schloss",
  },
  "phexens-elsterflug": {
    apply: "self_aura",
    vfx: "phex_dark",
    buff: { type: "schleichen", formula: "lkp", desc: "Schleichen/Sich Verstecken +LkP*" },
  },

  // ─── PERAINE ──────────────────────────────────────────────────────────────
  "heilungssegen": {
    apply: "target_heal",
    vfx: "peraine_heal",
    heal: { formula: "lkp", desc: "Heilt LkP* LeP" },
  },
  "wundsegen": {
    apply: "target_heal",
    vfx: "peraine_heal",
    heal: { formula: "1w6_plus_lkp_half", woundHeal: 1, desc: "Heilt 1W6+LkP*/2 LeP, +1 Wunde geheilt" },
  },
  "peraines-pflanzengespuer": {
    apply: "self_aura",
    vfx: "peraine_heal",
    desc: "Erkennt heilende/giftige Pflanzen im Umkreis",
  },
  "kleiner-giftbann": {
    apply: "target_dispel",
    vfx: "peraine_heal",
    desc: "Neutralisiert Gift-Stufe LkP*",
  },

  // ─── INGERIMM ─────────────────────────────────────────────────────────────
  "heilige-schmiedeglut": {
    apply: "ritual_only",
    vfx: "ingerimm_forge",
    desc: "Schmiedeprobe LkP*/2 erleichtert, Werk wird mehr wert",
  },
  "angroschs-zorn": {
    apply: "target_dmg",
    vfx: "ingerimm_forge",
    damage: { formula: "lkp_plus_5", desc: "LkP*+5 SP feurig" },
  },
  "gebieter-der-lava": {
    apply: "ritual_only",
    vfx: "ingerimm_forge",
    desc: "Steuert Lava-Strom für LkP* SR",
  },

  // ─── RAHJA ────────────────────────────────────────────────────────────────
  "rahjas-begehren": {
    apply: "command",
    vfx: "rahja_love",
    desc: "Ziel verliebt sich (MR-Probe vs LkP*+5)",
  },
  "rahjas-rauschsegen": {
    apply: "self_aura",
    vfx: "rahja_love",
    desc: "Wein/Bier wird zu vollkommener Freude",
  },
  "heiliges-liebesspiel": {
    apply: "ritual_only",
    vfx: "rahja_love",
    desc: "Beide Partner heilen 1W6+LkP*/2 LeP",
  },

  // ─── TSA ──────────────────────────────────────────────────────────────────
  "tsas-wundersame-erneuerung": {
    apply: "target_heal",
    vfx: "tsa_rainbow",
    heal: { formula: "all", desc: "Heilt alle LeP, Krankheiten, Wunden" },
  },
  "tsas-lebensschutz": {
    apply: "target_buff",
    vfx: "tsa_rainbow",
    buff: { type: "lep_at_negative", formula: "lkp", desc: "Stirbt erst bei LeP -LkP* (statt 0)" },
  },
  "tsas-lebensgeschenk": {
    apply: "target_heal",
    vfx: "tsa_rainbow",
    heal: { formula: "resurrect", desc: "Erweckt frisch Verstorbene zum Leben" },
  },
  "tsas-wundersame-fruchtbarkeit": {
    apply: "ritual_only",
    vfx: "tsa_rainbow",
    desc: "Land/Tier/Frau wird fruchtbarer für LkP* Monate",
  },

  // ─── FIRUN ────────────────────────────────────────────────────────────────
  "firuns-zorn": {
    apply: "target_dmg",
    vfx: "firun_ice",
    damage: { formula: "lkp_plus_5", desc: "LkP*+5 SP eisig" },
  },
  "firuns-einsicht": {
    apply: "self_aura",
    vfx: "firun_ice",
    buff: { type: "fährtensuchen", formula: "lkp", desc: "Fährtensuchen/Wildnisleben +LkP*" },
  },
  "schneesturm": {
    apply: "ritual_only",
    vfx: "firun_ice",
    desc: "Bringt Schneesturm in LkP* km Radius für LkP* Stunden",
  },

  // ─── AVES ─────────────────────────────────────────────────────────────────
  "reisesegen": {
    apply: "target_buff",
    vfx: "aves_travel",
    buff: { type: "wandern", formula: "lkp", desc: "Wandern-Talent +LkP*, Geschwindigkeit +LkP*/2" },
  },
  "zuflucht-finden": {
    apply: "ritual_only",
    vfx: "aves_travel",
    desc: "Findet sichere Zuflucht (Wind/Wetter-Schutz)",
  },

  // ─── SWAFNIR ──────────────────────────────────────────────────────────────
  "swafnirs-fluke": {
    apply: "target_dmg",
    vfx: "swafnir_wave",
    damage: { formula: "1w6_plus_lkp", desc: "1W6+LkP* SP wuchtig (Walschwingen-Schlag)" },
  },

  // ─── SCHAMANEN (Tairach/Kamaluq) ──────────────────────────────────────────
  "tiergestalt": {
    apply: "self_aura",
    vfx: "shaman_smoke",
    desc: "Verwandlung in Totem-Tier (LkP* Stunden)",
  },
  "blick-geisterwirken": {
    apply: "self_aura",
    vfx: "shaman_smoke",
    desc: "Sieht magische und geisterhafte Auras",
  },
  "sicht-auf-madas-welt": {
    apply: "self_aura",
    vfx: "hesinde_glow",
    desc: "Sieht magische und geisterhafte Auras (Praios/Hesinde-Variante)",
  },

  // ─── 12-Götter universelle Segnungen (Default-Glow) ──────────────────────
  "eidsegen": {
    apply: "target_buff",
    vfx: "holy_light",
    buff: { type: "eid", formula: "permanent", desc: "Eid bindet — Bruch löst Strafe aus" },
  },
  "feuersegen": {
    apply: "ritual_only",
    vfx: "ingerimm_forge",
    desc: "Feuer brennt heller, sicherer und länger",
  },
  "geburtssegen": {
    apply: "target_buff",
    vfx: "tsa_rainbow",
    buff: { type: "lep_max", formula: "lkp_half", desc: "+LkP*/2 LeP-Max für das Kind" },
  },
  "glueckssegen": {
    apply: "target_buff",
    vfx: "holy_light",
    buff: { type: "rerolls", formula: "1", desc: "1× Probe wiederholen mit besserem Wert" },
  },
  "goettliches-zeichen": {
    apply: "ritual_only",
    vfx: "holy_burst",
    desc: "Sichtbares göttliches Zeichen (Donner, Lichtblitz, etc.)",
  },
  "grabsegen": {
    apply: "ritual_only",
    vfx: "boron_seal",
    desc: "Schützt Grab vor Untoten/Schändung",
  },
  "harmoniesegen": {
    apply: "self_aura",
    vfx: "holy_light",
    buff: { type: "ueberreden", formula: "lkp_half", desc: "Überreden/Etikette +LkP*/2" },
  },
  "maertyrersegen": {
    apply: "self_aura",
    vfx: "holy_light",
    buff: { type: "lep_temp", formula: "lkp", desc: "+LkP* temp. LeP für letzten Kampf" },
  },
  "objektsegen": {
    apply: "ritual_only",
    vfx: "holy_seal",
    desc: "Objekt wird heilig (haltbarer, nicht brechbar)",
  },
  "objektweihe": {
    apply: "ritual_only",
    vfx: "holy_seal",
    desc: "Object wird permanent geweiht (gegen Untote/Dämonen)",
  },
  "schutzsegen": {
    apply: "target_buff",
    vfx: "holy_aura",
    buff: { type: "rs", formula: "1", desc: "RS +1 für 1 Tag" },
  },
  "prophezeiung": {
    apply: "ritual_only",
    vfx: "holy_light",
    desc: "Vage Vision der Zukunft / Hinweis vom Gott",
  },
  "schlaf-des-gesegneten": {
    apply: "target_heal",
    vfx: "holy_light",
    heal: { formula: "1", woundHeal: 0, desc: "Tiefer Schlaf — heilt LkP* LeP/Stunde" },
  },
  "ucuris-geleit": {
    apply: "self_aura",
    vfx: "aves_travel",
    desc: "Sicheres Reisen für LkP* Tage",
  },
  "handwerkssegen": {
    apply: "self_aura",
    vfx: "ingerimm_forge",
    buff: { type: "handwerk", formula: "lkp_half", desc: "Handwerks-Talente +LkP*/2 für 1 Werk" },
  },
  "initiation": {
    apply: "ritual_only",
    vfx: "holy_seal",
    desc: "Aufnahme eines Akoluthen / Novizen",
  },
  "goettliche-verstaendigung": {
    apply: "self_aura",
    vfx: "hesinde_glow",
    desc: "Versteht alle Sprachen für LkP* SR",
  },
  "grosser-eidsegen": {
    apply: "target_buff",
    vfx: "holy_seal",
    buff: { type: "eid_strong", formula: "permanent", desc: "Großer Eid — Bruch löst schwere Strafe aus" },
  },
};

// ─── Formel-Helfer ───────────────────────────────────────────────────────────

function applyFormula(formula, lkpStar) {
  if (typeof formula === "number") return formula;
  if (typeof formula !== "string") return 0;
  switch (formula) {
    case "lkp": return lkpStar;
    case "lkp_half": return Math.floor(lkpStar / 2);
    case "lkp_plus_5": return lkpStar + 5;
    case "lkp_plus_10": return lkpStar + 10;
    case "lkp_plus_15": return lkpStar + 15;
    case "lkp_x2": return lkpStar * 2;
    case "1w6_plus_lkp": {
      const r = Math.floor(Math.random() * 6) + 1;
      return r + lkpStar;
    }
    case "1w6_plus_lkp_half": {
      const r = Math.floor(Math.random() * 6) + 1;
      return r + Math.floor(lkpStar / 2);
    }
    case "all": return 999; // applyHolyHeal cappt auf max
    case "permanent": return -1; // permanent-flag
    case "1": return 1;
    default:
      const n = parseInt(formula);
      return isNaN(n) ? 0 : n;
  }
}

// ─── Persistent-Effect-Helper ────────────────────────────────────────────────

/**
 * Erstellt einen persistenten Effekt (ActiveEffect + Aura) wenn die Liturgie
 * eine Wirkungsdauer >= 1 Spielrunde hat UND das VFX als persistent unterstützt
 * wird. Gibt effectId zurück (oder null falls one-shot).
 */
async function maybePersist(targetActor, vfx, lit, lkpStar) {
  if (!targetActor || !vfx) return null;
  if (!PERSISTENT_CAPABLE.has(vfx)) return null;
  const duration = parseDuration(lit.wirkungsdauer ?? lit.wirkungsdauerDetail, lkpStar);
  if (!duration && !lit.wirkungsdauer?.toLowerCase()?.includes("permanent")) {
    // augenblicklich → kein persistent effect
    return null;
  }
  return await addPersistentEffect(targetActor, {
    name: lit.name,
    vfx,
    duration,
    lit,
    lkpStar,
  });
}

// ─── Haupt-Dispatcher ────────────────────────────────────────────────────────

/**
 * Wendet den Effekt einer erfolgreichen Liturgie an.
 *
 * @param {Actor} actor - Der wirkende Geweihte
 * @param {object} lit - Die Liturgie-Daten (id, name, grad, effekt, etc.)
 * @param {number} lkpStar - Die erwürfelten LkP*
 * @returns {Promise<object>} { vfx, mech, desc, persistentEffectId }
 */
export async function applyLiturgyEffects(actor, lit, lkpStar) {
  if (!actor || !lit) return null;

  const spec = LITURGY_EFFECTS[lit.id];
  const casterToken = getCasterToken(actor);
  const targets = getTargetTokens();

  // FALLBACK: keine spezifische Definition → generischer Glow auf Caster
  if (!spec) {
    if (casterToken) {
      const c = tokenCenter(casterToken);
      broadcastVFX({ kind: "effect", x: c.x, y: c.y, effect: "holy_light" });
    }
    return { vfx: "holy_light", mech: null, desc: lit.effekt || "Liturgie wirkt" };
  }

  const vfxName = spec.vfx ?? "holy_light";
  const out = { vfx: vfxName, mech: null, desc: spec.desc ?? lit.effekt };

  switch (spec.apply) {
    case "self_aura": {
      if (casterToken) {
        const c = tokenCenter(casterToken);
        broadcastVFX({ kind: "effect", x: c.x, y: c.y, effect: vfxName });
        if (spec.buff) {
          const value = applyFormula(spec.buff.formula, lkpStar);
          await applyBuffFlag(actor, { ...spec.buff, value, source: lit.name, lkpStar });
          out.mech = `Buff: ${spec.buff.desc}`;
          broadcastVFX({
            kind: "scrollingText",
            tgtTokenId: casterToken.id,
            text: spec.buff.type === "RS" ? `+${value} RS` : `+ Buff`,
            color: "#ffd770",
            fontSize: 22,
          });
        }
      }
      // Persistente Aura wenn Wirkungsdauer durativ
      out.persistentEffectId = await maybePersist(actor, vfxName, lit, lkpStar);
      break;
    }

    case "self_heal": {
      if (casterToken && spec.heal) {
        const lep = applyFormula(spec.heal.formula, lkpStar);
        await applyHolyHeal(casterToken, lep, { vfx: vfxName });
        out.mech = `+${lep} LeP geheilt (Caster)`;
      }
      break;
    }

    case "target_heal": {
      if (!targets.length) {
        // Kein Target → heilt Caster
        if (casterToken && spec.heal) {
          const lep = applyFormula(spec.heal.formula, lkpStar);
          await applyHolyHeal(casterToken, lep, { vfx: vfxName });
          out.mech = `+${lep} LeP geheilt (Caster, kein Ziel anvisiert)`;
        }
      } else {
        for (const t of targets) {
          if (spec.heal) {
            const lep = applyFormula(spec.heal.formula, lkpStar);
            await applyHolyHeal(t, lep, { vfx: vfxName });
          }
        }
        out.mech = `${targets.length} Ziel(e) geheilt`;
      }
      break;
    }

    case "target_dmg":
    case "area_dmg": {
      if (!targets.length) {
        ui.notifications.warn(`${lit.name} braucht ein Ziel — bitte Token anvisieren (T).`);
        break;
      }
      for (const t of targets) {
        // Projektil von Caster zu Ziel?
        if (spec.projectile && casterToken) {
          broadcastVFX({
            kind: "projectile",
            srcTokenId: casterToken.id,
            tgtTokenId: t.id,
            projectile: spec.projectile,
            impact: vfxName,
          });
          // Damage nach kurzem Delay (Projektil-Reisezeit)
          await new Promise(r => setTimeout(r, 350));
        }
        if (spec.damage) {
          const sp = applyFormula(spec.damage.formula, lkpStar);
          await applyHolyDamage(t, sp, { vfx: vfxName });
        }
        if (spec.aspDrain) {
          const asp = spec.aspDrain === "all" ? 999
                    : applyFormula(spec.aspDrain, lkpStar);
          await applyAsPDrain(t, asp);
        }
      }
      out.mech = `${targets.length} Ziel(e) getroffen`;
      break;
    }

    case "target_dispel": {
      if (!targets.length) {
        // Self-cast als Antimagie (Praios' Magiebann o.ä.)
        if (casterToken) {
          const c = tokenCenter(casterToken);
          broadcastVFX({ kind: "effect", x: c.x, y: c.y, effect: vfxName });
          out.mech = "Antimagie-Zone aktiv";
          // Antimagie-Zone ist persistent (LkP* SR)
          out.persistentEffectId = await maybePersist(actor, vfxName, lit, lkpStar);
        }
      } else {
        for (const t of targets) {
          const c = tokenCenter(t);
          broadcastVFX({ kind: "effect", x: c.x, y: c.y, effect: vfxName });
          if (spec.aspDrain) {
            const asp = applyFormula(spec.aspDrain, lkpStar);
            await applyAsPDrain(t, asp);
          }
        }
        out.mech = `${targets.length} Ziel(e) entzaubert`;
      }
      break;
    }

    case "target_buff": {
      const tt = targets.length ? targets : (casterToken ? [casterToken] : []);
      const persistentIds = [];
      for (const t of tt) {
        const c = tokenCenter(t);
        broadcastVFX({ kind: "effect", x: c.x, y: c.y, effect: vfxName });
        if (spec.buff && t.actor) {
          const value = applyFormula(spec.buff.formula, lkpStar);
          await applyBuffFlag(t.actor, { ...spec.buff, value, source: lit.name, lkpStar });
          broadcastVFX({
            kind: "scrollingText",
            tgtTokenId: t.id,
            text: `+ ${spec.buff.type}`,
            color: "#ffd770",
            fontSize: 20,
          });
          // Persistente Aura auf Ziel-Actor
          const eid = await maybePersist(t.actor, vfxName, lit, lkpStar);
          if (eid) persistentIds.push({ actorId: t.actor.id, effectId: eid });
        }
      }
      out.persistentEffectIds = persistentIds;
      out.mech = spec.buff?.desc ?? "Buff angewandt";
      break;
    }

    case "command": {
      const tt = targets.length ? targets : (casterToken ? [casterToken] : []);
      for (const t of tt) {
        const c = tokenCenter(t);
        broadcastVFX({ kind: "effect", x: c.x, y: c.y, effect: vfxName });
        broadcastVFX({
          kind: "scrollingText",
          tgtTokenId: t.id,
          text: `❗ ${lit.name}`,
          color: "#ffd770",
          fontSize: 22,
        });
      }
      out.mech = "Befehl erteilt — SL entscheidet über Selbstbeherrschung-Probe";
      break;
    }

    case "ritual_only":
    default: {
      if (casterToken) {
        const c = tokenCenter(casterToken);
        broadcastVFX({ kind: "effect", x: c.x, y: c.y, effect: vfxName });
      }
      break;
    }
  }

  return out;
}
