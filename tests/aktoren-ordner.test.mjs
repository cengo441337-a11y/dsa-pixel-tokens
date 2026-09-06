/**
 * WOZU
 * ----
 * Bewacht die beiden Stellen, an denen das Modul von sich aus Aktoren anfasst:
 * das Einsortieren in Ordner (`categorizeActor`) und das Entfernen von
 * Duplikaten (`deduplicateActors`). Beides lief bis v0.7.18 bei jedem Weltstart
 * ungefragt; das Löschen war endgültig.
 *
 * WO IM AUFBAU
 * ------------
 * `scripts/actor-folders.mjs`, aufgerufen aus `scripts/module.mjs` im
 * ready-Hook.
 *
 * WORAUF ACHTEN
 * -------------
 * Der wichtigste Test hier ist der negative: dass NICHTS passiert. Er muss
 * einmal rot gewesen sein, sonst beweist er nichts — die Belege dazu stehen im
 * jeweiligen Kommentar.
 */

import "./foundry-stub.mjs";
import { resetGameState } from "./foundry-stub.mjs";
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { categorizeActor, deduplicateActors } from "../scripts/actor-folders.mjs";

const MODUL = "dsa-pixel-tokens";

/** Baut einen Aktor, wie ihn die geprüften Funktionen erwarten. */
function aktor({ name, typ = "npc", kreatur = null, besitzerId = null, gegenstaende = 0 }) {
  const flags = kreatur ? { [MODUL]: { creature: kreatur } } : {};
  return {
    id: `id-${name}`,
    name,
    type: typ,
    system: {},
    flags,
    ownership: besitzerId ? { default: 0, [besitzerId]: 3 } : { default: 0 },
    items: { size: gegenstaende },
    getFlag(bereich, schluessel) { return this.flags?.[bereich]?.[schluessel]; },
    geloescht: false,
    async delete() { this.geloescht = true; },
  };
}

/** Setzt game.actors und game.users auf die übergebenen Werte. */
function weltMit(aktoren, benutzer = {}) {
  resetGameState();
  const liste = [...aktoren];
  globalThis.game.actors = Object.assign(liste, {
    get: (id) => liste.find(a => a.id === id) ?? null,
    contents: liste,
    size: liste.length,
  });
  globalThis.game.users = { get: (id) => benutzer[id] ?? null };
  globalThis.game.scenes = Object.assign([], { current: null, get: () => null });
}

describe("categorizeActor — wer verschoben werden darf", () => {
  beforeEach(() => resetGameState());

  test("Spielercharakter mit heiklem Namen bleibt liegen", () => {
    // Belegt am 06.09.2026: "Rhondara Schattenwind" landete in DSA Untote,
    // weil der Stichwortabgleich vor der Kreatur-Prüfung lief.
    weltMit([], { spieler1: { isGM: false } });
    const held = aktor({ name: "Rhondara Schattenwind", typ: "character", besitzerId: "spieler1" });
    assert.equal(categorizeActor(held), null);
  });

  test("selbstgebauter NSC ohne Kreatur-Kennfeld bleibt ebenfalls liegen", () => {
    weltMit([]);
    const nsc = aktor({ name: "Die Moorleiche von Trallop" });
    assert.equal(categorizeActor(nsc), null);
  });

  test("einem Spieler übergebene Kreatur wird nicht mehr verschoben", () => {
    // Dieser Fall trennt die beiden Schutzmassnahmen voneinander: Der Aktor hat
    // ein Kreatur-Kennfeld UND einen Untoten-Namen, gehört aber einem Spieler.
    // Nur die Besitzprüfung kann ihn hier noch retten. Ohne diesen Test blieb
    // sie ungeprüft — die Mutationsprobe am 06.09.2026 fiel dadurch grün aus,
    // obwohl die Prüfung entfernt war.
    weltMit([], { spieler1: { isGM: false } });
    const geist = aktor({
      name: "Schattenwandler (Spielerfigur)",
      kreatur: { creatureType: "untot" },
      besitzerId: "spieler1",
    });
    assert.equal(categorizeActor(geist), null);
  });

  test("importierte Kreatur mit Untoten-Stichwort wird einsortiert", () => {
    weltMit([]);
    const skelett = aktor({ name: "Untoter Wächter", kreatur: { creatureType: "untot" } });
    const ziel = categorizeActor(skelett);
    assert.equal(ziel?.topFolder, "DSA Untote");
  });
});

describe("deduplicateActors — löscht nur auf ausdrückliche Anweisung", () => {
  test("ohne Schalter wird nichts gelöscht, nur gezählt", async () => {
    // Belegt am 06.09.2026: Der ready-Hook rief diese Funktion bei jedem
    // Weltstart auf; ein zweiter Import desselben Helden kostete danach einen
    // der beiden Aktoren, ohne Rückfrage.
    const a = aktor({ name: "Goblin", kreatur: { creatureType: "tier" }, gegenstaende: 3 });
    const b = aktor({ name: "Goblin", kreatur: { creatureType: "tier" }, gegenstaende: 0 });
    weltMit([a, b]);

    const bericht = await deduplicateActors();
    assert.equal(bericht.gefunden, 1, "das Duplikat muss gemeldet werden");
    assert.equal(bericht.geloescht, 0, "ohne Schalter darf nichts verschwinden");
    assert.equal(a.geloescht, false);
    assert.equal(b.geloescht, false);
  });

  test("mit Schalter wird der unvollständigere Eintrag entfernt", async () => {
    const voll  = aktor({ name: "Goblin", kreatur: { creatureType: "tier" }, gegenstaende: 3 });
    const leer  = aktor({ name: "Goblin", kreatur: { creatureType: "tier" }, gegenstaende: 0 });
    weltMit([voll, leer]);

    const bericht = await deduplicateActors({ wirklichLoeschen: true });
    assert.equal(bericht.geloescht, 1);
    assert.equal(voll.geloescht, false, "der Eintrag mit mehr Gegenständen bleibt");
    assert.equal(leer.geloescht, true);
  });

  test("Spielercharaktere zählen nie als Duplikat — auch nicht mit Schalter", async () => {
    const held1 = aktor({ name: "Aytan", typ: "character", besitzerId: "spieler1", gegenstaende: 39 });
    const held2 = aktor({ name: "Aytan", typ: "character", besitzerId: "spieler1", gegenstaende: 0 });
    weltMit([held1, held2], { spieler1: { isGM: false } });

    const bericht = await deduplicateActors({ wirklichLoeschen: true });
    assert.equal(bericht.gefunden, 0);
    assert.equal(held1.geloescht, false);
    assert.equal(held2.geloescht, false);
  });

  test("von Hand gebaute Aktoren ohne Kreatur-Kennfeld werden nicht angefasst", async () => {
    const a = aktor({ name: "Wirt Alrik", gegenstaende: 2 });
    const b = aktor({ name: "Wirt Alrik", gegenstaende: 0 });
    weltMit([a, b]);

    const bericht = await deduplicateActors({ wirklichLoeschen: true });
    assert.equal(bericht.gefunden, 0);
    assert.equal(b.geloescht, false);
  });
});
