/**
 * WOZU
 * ----
 * Prüft die Zustandsverwaltung: Abzüge je Stufe, Geltungsbereich je Zustand,
 * und die Grenze bei Stufe 4.
 *
 * WO IM AUFBAU
 * ------------
 * `scripts/zustaende.mjs`. Der Heldenbogen ruft `zustandsMalus()` bei jeder
 * Probe und jedem Kampfwurf auf.
 *
 * WORAUF ACHTEN
 * -------------
 * Der Abzug ist eine POSITIVE Zahl. Wer das Vorzeichen dreht, macht aus jedem
 * Schmerz einen Bonus — und die Probe wird leichter, je schlechter es dem
 * Helden geht. Deshalb prüft der letzte Test genau das.
 */

import "./foundry-stub.mjs";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ZUSTAENDE, MAX_STUFE, stufeBegrenzen, zustandsMalus,
  handlungsfaehigkeit, aktiveZustaende, zustandsZeile,
} from "../scripts/zustaende.mjs";

describe("stufeBegrenzen — Stufen bleiben zwischen 0 und 4", () => {
  test("gültige Stufen kommen unverändert zurück", () => {
    for (const s of [0, 1, 2, 3, 4]) assert.equal(stufeBegrenzen(s), s);
  });

  test("zu hohe Stufen werden gekappt", () => {
    assert.equal(stufeBegrenzen(9), MAX_STUFE);
  });

  test("negative Stufen werden zu null", () => {
    // Eine negative Stufe waere ein Bonus durch die Hintertuer.
    assert.equal(stufeBegrenzen(-3), 0);
  });

  test("Unsinn wird zu null, nicht zu NaN", () => {
    assert.equal(stufeBegrenzen("abc"), 0);
    assert.equal(stufeBegrenzen(undefined), 0);
    assert.equal(stufeBegrenzen(null), 0);
  });

  test("Kommastellen werden abgeschnitten", () => {
    assert.equal(stufeBegrenzen(2.9), 2);
  });
});

describe("zustandsMalus — Abzug auf Proben", () => {
  test("ein Zustand auf 'alle' wirkt immer", () => {
    assert.equal(zustandsMalus({ schmerz: 2 }), 2);
    assert.equal(zustandsMalus({ schmerz: 2 }, { attribute: ["KL", "IN", "CH"] }), 2);
  });

  test("mehrere Zustände addieren sich", () => {
    assert.equal(zustandsMalus({ schmerz: 2, betaeubung: 1 }), 3);
  });

  test("ein eigenschaftsgebundener Zustand greift nur bei passender Probe", () => {
    // Paralyse wirkt auf koerperliche Eigenschaften.
    assert.equal(zustandsMalus({ paralyse: 3 }, { attribute: ["FF", "GE", "KO"] }), 3);
    assert.equal(zustandsMalus({ paralyse: 3 }, { attribute: ["KL", "IN", "CH"] }), 0);
  });

  test("ohne Angabe der Eigenschaften wird ein gebundener Zustand nicht angerechnet", () => {
    // Lieber ein Abzug zu wenig als ein erfundener.
    assert.equal(zustandsMalus({ paralyse: 3 }), 0);
  });

  test("im Kampf zählt, ob der Zustand auf Kampfwerte wirkt", () => {
    // Verwirrung wirkt nicht auf Attacke und Parade, Schmerz schon.
    assert.equal(zustandsMalus({ verwirrung: 2 }, { kampf: true }), 0);
    assert.equal(zustandsMalus({ schmerz: 2 }, { kampf: true }), 2);
    assert.equal(zustandsMalus({ paralyse: 2 }, { kampf: true }), 2);
  });

  test("unbekannte Zustände werden ignoriert, nicht mitgezählt", () => {
    assert.equal(zustandsMalus({ erfunden: 4, schmerz: 1 }), 1);
  });

  test("Stufe 0 zieht nichts ab", () => {
    assert.equal(zustandsMalus({ schmerz: 0 }), 0);
  });

  test("der Abzug ist immer positiv oder null — nie ein Bonus", () => {
    for (const [schluessel] of Object.entries(ZUSTAENDE)) {
      for (const stufe of [-2, 0, 1, 4, 99]) {
        const m = zustandsMalus({ [schluessel]: stufe }, { attribute: ["MU", "KL", "IN"], kampf: false });
        assert.ok(m >= 0, `${schluessel} Stufe ${stufe} ergab ${m}`);
        assert.ok(m <= MAX_STUFE, `${schluessel} Stufe ${stufe} ergab ${m}, mehr als ${MAX_STUFE}`);
      }
    }
  });
});

describe("handlungsfaehigkeit — Stufe 4 beendet den Zug", () => {
  test("Stufe 4 macht handlungsunfähig, in jedem Zustand", () => {
    for (const schluessel of Object.keys(ZUSTAENDE)) {
      const e = handlungsfaehigkeit({ [schluessel]: 4 });
      assert.equal(e.handlungsunfaehig, true, `${schluessel} 4 sollte handlungsunfaehig machen`);
      assert.equal(e.gruende.length, 1);
    }
  });

  test("Stufe 3 macht noch nicht handlungsunfähig", () => {
    assert.equal(handlungsfaehigkeit({ schmerz: 3, furcht: 3 }).handlungsunfaehig, false);
  });

  test("ohne Zustände ist der Held handlungsfähig", () => {
    assert.equal(handlungsfaehigkeit({}).handlungsunfaehig, false);
    assert.equal(handlungsfaehigkeit(undefined).handlungsunfaehig, false);
  });
});

describe("aktiveZustaende — was vom Aktor gelesen wird", () => {
  const aktorMit = (z) => ({ getFlag: (b, s) => (b === "dsa-pixel-tokens" && s === "zustaende") ? z : undefined });

  test("nur Zustände über Stufe 0 kommen zurück", () => {
    assert.deepEqual(aktiveZustaende(aktorMit({ schmerz: 2, furcht: 0 })), { schmerz: 2 });
  });

  test("unbekannte Schlüssel werden aussortiert", () => {
    assert.deepEqual(aktiveZustaende(aktorMit({ erfunden: 3, schmerz: 1 })), { schmerz: 1 });
  });

  test("Aktor ohne Kennfeld liefert ein leeres Ergebnis", () => {
    assert.deepEqual(aktiveZustaende(aktorMit(undefined)), {});
    assert.deepEqual(aktiveZustaende(undefined), {});
  });
});

describe("zustandsZeile — Anzeige im Chat", () => {
  test("ohne Zustand bleibt die Zeile leer", () => {
    assert.equal(zustandsZeile({}, 0), "");
  });

  test("mit Zustand steht Name, Stufe und Abzug drin", () => {
    const zeile = zustandsZeile({ schmerz: 2 }, 2);
    assert.match(zeile, /Schmerz 2/);
    assert.match(zeile, /−2/);
  });

  test("wirkt der Zustand auf diese Probe nicht, wird das gesagt", () => {
    // Sonst wundert sich der Spieler, warum sein Schmerz nicht abgezogen wurde.
    const zeile = zustandsZeile({ paralyse: 2 }, 0);
    assert.match(zeile, /kein Abzug/);
  });
});
