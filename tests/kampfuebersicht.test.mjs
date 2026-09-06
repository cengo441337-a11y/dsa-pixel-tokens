/**
 * WOZU
 * ----
 * Prüft die beiden Teile der Kampfübersicht, bei denen ein Fehler etwas
 * kostet: die Sichtbarkeitsprüfung und die Zusammenfassung eines Kämpfers.
 *
 * WO IM AUFBAU
 * ------------
 * `scripts/kampfuebersicht.mjs`. Die Anzeige selbst wird bewusst nicht geprüft
 * — Oberflächen ändern sich schneller, als ihre Tests nützen.
 *
 * WORAUF ACHTEN
 * -------------
 * `sichtbarFuer` entscheidet, ob ein Spieler die Lebensenergie eines fremden
 * Aktors sieht. Wer die Prüfung aufweicht, macht aus der Übersicht einen
 * Spickzettel auf die verdeckten Werte der Spielleitung.
 */

import "./foundry-stub.mjs";
import { resetGameState } from "./foundry-stub.mjs";
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { sichtbarFuer, kaempferZeile } from "../scripts/kampfuebersicht.mjs";

const MODUL = "dsa-pixel-tokens";

/** Aktor-Attrappe mit Systemwerten, Wunden und Zuständen. */
function aktor({ name = "Alrik", lep = 30, lepMax = 30, aup = 40, aupMax = 40,
                 asp = 0, aspMax = 0, ko = 12, wunden = {}, zustaende = {},
                 ownership = {} } = {}) {
  const flags = { [MODUL]: { wounds: wunden, zustaende } };
  return {
    id: `id-${name}`,
    name,
    ownership,
    system: {
      LeP: { value: lep, max: lepMax },
      AuP: { value: aup, max: aupMax },
      AsP: { value: asp, max: aspMax },
      KO:  { value: ko },
    },
    flags,
    getFlag(bereich, schluessel) { return this.flags?.[bereich]?.[schluessel]; },
  };
}

describe("sichtbarFuer — wer welche Werte sehen darf", () => {
  beforeEach(() => resetGameState());

  test("die Spielleitung sieht alles", () => {
    const sl = { isGM: true, id: "gm" };
    assert.equal(sichtbarFuer(aktor({ ownership: {} }), sl), true);
  });

  test("ein Spieler ohne Recht sieht die Werte nicht", () => {
    const spieler = { isGM: false, id: "s1" };
    assert.equal(sichtbarFuer(aktor({ ownership: { default: 0 } }), spieler), false);
  });

  test("ab Beobachter-Recht sieht ein Spieler die Werte", () => {
    const spieler = { isGM: false, id: "s1" };
    assert.equal(sichtbarFuer(aktor({ ownership: { s1: 2 } }), spieler), true);
    assert.equal(sichtbarFuer(aktor({ ownership: { s1: 3 } }), spieler), true);
  });

  test("eingeschränktes Recht reicht nicht", () => {
    const spieler = { isGM: false, id: "s1" };
    assert.equal(sichtbarFuer(aktor({ ownership: { s1: 1 } }), spieler), false);
  });

  test("ohne Aktor gibt es nichts zu sehen", () => {
    assert.equal(sichtbarFuer(null, { isGM: true }), false);
  });
});

describe("kaempferZeile — die Zahlen hinter der Anzeige", () => {
  beforeEach(() => resetGameState());

  test("Anteile werden in Prozent umgerechnet", () => {
    const d = kaempferZeile(aktor({ lep: 15, lepMax: 30, aup: 10, aupMax: 40 }));
    assert.equal(d.lepAnteil, 50);
    assert.equal(d.aupAnteil, 25);
  });

  test("ohne Höchstwert gibt es keinen Anteil statt einer Division durch null", () => {
    const d = kaempferZeile(aktor({ lepMax: 0 }));
    assert.equal(d.lepAnteil, null);
  });

  test("Anteile bleiben zwischen 0 und 100", () => {
    // Negative Lebensenergie ist in DSA möglich (lebensbedrohlich).
    const tot = kaempferZeile(aktor({ lep: -8, lepMax: 30 }));
    assert.equal(tot.lepAnteil, 0);
    const ueber = kaempferZeile(aktor({ lep: 45, lepMax: 30 }));
    assert.equal(ueber.lepAnteil, 100);
  });

  test("Wunden werden gezählt und nach Zone aufgeschlüsselt", () => {
    const d = kaempferZeile(aktor({ wunden: { kopf: 1, lBein: 2 } }));
    assert.equal(d.wundenGesamt, 3);
    assert.equal(d.wundmalus, 6, "zwei Punkte je Wunde (WdS S.57)");
    assert.equal(d.zonenMitWunden.length, 2);
  });

  test("Zustände liefern getrennte Abzüge für Probe und Kampf", () => {
    // Verwirrung wirkt auf geistige Proben, nicht auf Attacke und Parade.
    const d = kaempferZeile(aktor({ zustaende: { schmerz: 2, verwirrung: 1 } }));
    assert.equal(d.zustandsMalusKampf, 2, "nur Schmerz wirkt im Kampf");
    assert.ok(d.zustandsMalusProbe >= 2);
  });

  test("Stufe 4 wird als handlungsunfähig gemeldet", () => {
    const d = kaempferZeile(aktor({ zustaende: { betaeubung: 4 } }));
    assert.equal(d.handlungsunfaehig, true);
    assert.equal(d.gruende.length, 1);
  });

  test("ein unverletzter Held meldet weder Wunden noch Zustände", () => {
    const d = kaempferZeile(aktor());
    assert.equal(d.wundenGesamt, 0);
    assert.equal(d.wundmalus, 0);
    assert.equal(d.handlungsunfaehig, false);
    assert.deepEqual(d.zustaende, {});
  });

  test("die Wundschwellen richten sich nach der Konstitution", () => {
    const d = kaempferZeile(aktor({ ko: 14 }));
    assert.equal(d.wundschwellen.ws1, 7);
    assert.equal(d.wundschwellen.ws2, 14);
  });
});
