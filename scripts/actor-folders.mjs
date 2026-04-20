/**
 * DSA Pixel Tokens — Actor-Ordner-Verwaltung
 *
 * Sortiert alle Kreaturen automatisch in thematische Folder:
 *   DSA Daemonen/
 *     Blakharaz/, Lolgramoth/, Thargunitoth/, Charyptoroth/, Tasfarelel/,
 *     Belkelel/, Belhalhar/, Belshirash/, Amazeroth/, Agrimoth/,
 *     Aphasmayra/, Mishkhara/, Calijnaar/, Dar-Klajid/, Unabhaengig/
 *   DSA Elementare/
 *     Feuer/, Wasser/, Eis/, Luft/, Humus/, Erz/, Sonstige/
 *   DSA Untote/
 *     Skelette/, Zombies/, Mumien/, Ghule/, Brandleichen/,
 *     Eisleichen/, Wasserleichen/, Sonstige/
 *   DSA Monster/
 *   DSA Pandaemonium/
 */

import { MODULE_ID } from "./config.mjs";

// ─── Folder-Mapping-Tabellen ────────────────────────────────────────────────

const DEMON_DOMAINS = [
  "Blakharaz", "Lolgramoth", "Thargunitoth", "Charyptoroth", "Tasfarelel",
  "Belkelel", "Belhalhar", "Belshirash", "Amazeroth", "Agrimoth",
  "Aphasmayra", "Mishkhara", "Calijnaar", "Dar-Klajid", "Asfaloth", "Belzhorash",
  "Belshirash", "Pandaemonium",
];

const ELEMENTAL_KEYWORDS = {
  Feuer:  ["feuer", "flammen", "glut", "hitze", "brenn", "lava", "salamander", "maehre", "drachenfliege", "hoellenschaedel", "alagrimm"],
  Wasser: ["wasser", "regen", "wellen", "see", "gischt", "sirene", "meer", "necker", "seebeben", "ertrunken"],
  Eis:    ["eis", "frost", "kaelte", "gletsch", "firy", "schnee", "winter", "blizzantil", "krystall"],
  Luft:   ["luft", "wind", "orkan", "sturm", "himmel", "gazelle", "wolken", "tornado", "hagel"],
  Humus:  ["humus", "baum", "ranken", "wald", "laub", "dornen", "rosendschinn", "truncus", "blaetter"],
  Erz:    ["erz", "stein", "fels", "sand", "metall", "gagol", "wuehlschrat", "quecksilber", "doryphoros", "al serak", "al shafeif"],
};

const UNDEAD_KEYWORDS = {
  Skelette:       ["skelett", "knochen", "gebein"],
  Zombies:        ["zombie", "fleisch", "koloss", "plagen"],
  Mumien:         ["mumie", "kriegermumi"],
  Ghule:          ["ghul"],
  Brandleichen:   ["brandleiche", "brandbock", "hoellenschaedel"],
  Eisleichen:     ["eisleiche", "kalte hauch"],
  Wasserleichen:  ["wasserleich", "ertrunken"],
};

// ─── Core: Actor-Kategorisierung ────────────────────────────────────────────

/**
 * Liefert { topFolder, subFolder } fuer einen Actor.
 * Gibt null zurueck wenn Actor nicht kategorisiert werden soll (Spieler, NSC, etc.)
 */
export function categorizeActor(actor) {
  const name = (actor.name ?? "").toLowerCase();
  const sys = actor.system ?? {};

  // ── 1. Pandaemonium-Cluster (eigener Marker) ─────────────────────────────
  if (actor.getFlag(MODULE_ID, "pandaemoniumActor")?.isPdCluster ||
      name.includes("pandaemonium")) {
    return { topFolder: "DSA Pandaemonium", subFolder: null };
  }

  // ── 2. Creature-Flag aus unserem Modul ───────────────────────────────────
  const creatureFlag = actor.getFlag(MODULE_ID, "creature");
  const domain = creatureFlag?.domain ?? sys.domain ?? "";
  const creatureType = (creatureFlag?.creatureType ?? sys.creatureType ?? "").toLowerCase();

  // Daemon: hat Domain
  if (domain && DEMON_DOMAINS.some(d => d.toLowerCase() === domain.toLowerCase())) {
    return { topFolder: "DSA Daemonen", subFolder: domain };
  }
  if (domain === "Frei" || domain === "Unabhaengig" || domain === "Unabhängig") {
    return { topFolder: "DSA Daemonen", subFolder: "Unabhaengig" };
  }

  // Elementar: via creatureType oder Namen
  if (creatureType === "elementar" || _matchesAny(name, ["geist des", "dschinn", "elementarer meister", "elementargeist"])) {
    const elem = _detectElement(name);
    return { topFolder: "DSA Elementare", subFolder: elem ?? "Sonstige" };
  }

  // Benannte Elementarwesen (aus "Elementare Gewalten")
  const src = actor._source?._source ?? sys._source ?? "";
  if (src.toLowerCase().includes("elementare gewalten")) {
    const elem = _detectElement(name);
    return { topFolder: "DSA Elementare", subFolder: elem ?? "Sonstige" };
  }

  // ── 3. Untote (via Namen / Abilities) ────────────────────────────────────
  for (const [subFolder, kws] of Object.entries(UNDEAD_KEYWORDS)) {
    if (_matchesAny(name, kws)) {
      return { topFolder: "DSA Untote", subFolder };
    }
  }
  // Weitere Untote-Stichworte
  if (_matchesAny(name, ["untot", "schatten", "alagrimm", "blutbestie", "moorleich", "yaq hai"])) {
    return { topFolder: "DSA Untote", subFolder: "Sonstige" };
  }

  // ── 4. Monster (Fallback fuer alles andere mit Kreatur-Flag) ──────────────
  if (creatureFlag) {
    return { topFolder: "DSA Monster", subFolder: null };
  }

  // Nicht kategorisierbar → null = kein Folder-Move
  return null;
}

function _matchesAny(text, keywords) {
  return keywords.some(k => text.includes(k));
}

function _detectElement(name) {
  for (const [elem, kws] of Object.entries(ELEMENTAL_KEYWORDS)) {
    if (_matchesAny(name, kws)) return elem;
  }
  return null;
}

// ─── Folder-Creation-Helpers ────────────────────────────────────────────────

async function _getOrCreateFolder(name, type = "Actor", parentId = null) {
  const existing = game.folders.find(f =>
    f.name === name && f.type === type && (f.folder?.id ?? null) === parentId
  );
  if (existing) return existing;

  return await Folder.create({
    name, type,
    folder: parentId,
    sorting: "a",
    color: _colorForFolder(name),
  });
}

function _colorForFolder(name) {
  const colors = {
    "DSA Daemonen":     "#8b0000",
    "DSA Elementare":   "#4a90d9",
    "DSA Untote":       "#6b5b95",
    "DSA Monster":      "#8b6914",
    "DSA Pandaemonium": "#ff4444",
  };
  return colors[name] ?? null;
}

/**
 * Stellt sicher dass Ordnerstruktur existiert, gibt Folder-ID fuer Unterordner zurueck.
 * Wenn subFolder null → Top-Folder-ID.
 */
export async function ensureFolder(topFolder, subFolder = null) {
  const top = await _getOrCreateFolder(topFolder, "Actor", null);
  if (!subFolder) return top.id;
  const sub = await _getOrCreateFolder(subFolder, "Actor", top.id);
  return sub.id;
}

/**
 * Verschiebt einen Actor in den richtigen Ordner basierend auf categorizeActor().
 * Tut nichts wenn Actor nicht kategorisierbar ist.
 */
export async function moveActorToCategoryFolder(actor) {
  const cat = categorizeActor(actor);
  if (!cat) return false;
  const folderId = await ensureFolder(cat.topFolder, cat.subFolder);
  if (actor.folder?.id !== folderId) {
    await actor.update({ folder: folderId });
  }
  return true;
}

// ─── Migration: Alle bestehenden Actors einsortieren ────────────────────────

const MIGRATION_FLAG_KEY = "actorFoldersV1";

export async function migrateActorFolders() {
  try {
    game.settings.register(MODULE_ID, MIGRATION_FLAG_KEY, {
      scope: "world", config: false, type: Boolean, default: false,
    });
  } catch {}
  // Re-run durch DSASortiereActors() moeglich (Flag check wird auch geprueft)
  let done = false;
  try { done = game.settings.get(MODULE_ID, MIGRATION_FLAG_KEY) === true; } catch {}
  if (done) return 0;

  let moved = 0;
  for (const actor of game.actors) {
    try {
      if (await moveActorToCategoryFolder(actor)) moved++;
    } catch (err) {
      console.warn(`[${MODULE_ID}] Konnte ${actor.name} nicht einsortieren:`, err);
    }
  }

  if (moved > 0) {
    ui.notifications.info(`[DSA Pixel] ${moved} Actor(s) in thematische Ordner einsortiert.`);
  }
  try { await game.settings.set(MODULE_ID, MIGRATION_FLAG_KEY, true); } catch {}
  return moved;
}

// Globaler Helper — jederzeit manuell re-sortieren
globalThis.DSASortiereActors = async () => {
  try { await game.settings.set(MODULE_ID, MIGRATION_FLAG_KEY, false); } catch {}
  let moved = 0;
  for (const actor of game.actors) {
    try {
      if (await moveActorToCategoryFolder(actor)) moved++;
    } catch {}
  }
  ui.notifications.info(`[DSA Pixel] ${moved} Actor(s) neu einsortiert.`);
  try { await game.settings.set(MODULE_ID, MIGRATION_FLAG_KEY, true); } catch {}
  return moved;
};

// ─── Duplikat-Entfernung ────────────────────────────────────────────────────

/**
 * Findet Duplikate (gleicher Name + Typ) und loescht alle ausser einem.
 * Behalten wird der Actor mit den meisten Items (= vollstaendigster).
 * Token-Referenzen werden vor dem Loeschen auf den Master umgeleitet.
 */
export async function deduplicateActors() {
  // Gruppiere nach Name+Typ (case-insensitive)
  const groups = new Map();
  for (const actor of game.actors) {
    const key = `${actor.type}|${actor.name.toLowerCase().trim()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(actor);
  }

  let deleted = 0;
  for (const [key, actors] of groups) {
    if (actors.length <= 1) continue;

    // Sortiere absteigend nach Vollstaendigkeit: items.size, dann updatedAt
    actors.sort((a, b) => {
      const byItems = (b.items.size ?? 0) - (a.items.size ?? 0);
      if (byItems !== 0) return byItems;
      return (b._stats?.modifiedTime ?? 0) - (a._stats?.modifiedTime ?? 0);
    });

    const master = actors[0];
    const duplicates = actors.slice(1);

    // Token-Referenzen aller Scenes auf Master umbiegen
    for (const scene of game.scenes) {
      const updates = [];
      for (const t of scene.tokens) {
        if (duplicates.some(d => d.id === t.actorId)) {
          updates.push({ _id: t.id, actorId: master.id });
        }
      }
      if (updates.length > 0) {
        await scene.updateEmbeddedDocuments("Token", updates).catch(() => {});
      }
    }

    // Duplikate loeschen
    for (const dup of duplicates) {
      try {
        await dup.delete();
        deleted++;
      } catch (err) {
        console.warn(`[${MODULE_ID}] Konnte Duplikat ${dup.name} nicht loeschen:`, err);
      }
    }
  }

  return deleted;
}

// Globaler Helper — Duplikate manuell entfernen
globalThis.DSADedupActors = async () => {
  const before = game.actors.size;
  const deleted = await deduplicateActors();
  ui.notifications.info(`[DSA Pixel] ${deleted} Actor-Duplikat(e) entfernt (${before} → ${game.actors.size}).`);
  return deleted;
};
