/**
 * WOZU
 * ----
 * Prüft `mrVerrechnen` aus `scripts/config.mjs` — die Stelle, an der sich
 * entscheidet, ob ein Zauber am Ziel abprallt.
 *
 * WO IM AUFBAU
 * ------------
 * `magic.mjs::castSpell` ruft die Funktion direkt nach `applyCrit` auf. Das
 * Ergebnis steuert drei Dinge: ob der Zauber wirkt, wie stark er wirkt, und ob
 * der Zauberer die vollen oder nur die anteiligen AsP zahlt.
 *
 * WORAUF ACHTEN
 * -------------
 * "Widerstanden" ist kein Misserfolg. Die Probe ist gelungen, das Ziel hat sich
 * gewehrt — die vollen Kosten bleiben fällig. Wer das verwechselt, macht das
 * Zaubern gegen starke Gegner billiger, statt es schwerer zu machen.
 */

import "./foundry-stub.mjs";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mrVerrechnen } from "../scripts/config.mjs";

describe("mrVerrechnen — Magieresistenz gegen ZfP* (WdZ S.30)", () => {
  test("MR wird von den ZfP* abgezogen", () => {
    const e = mrVerrechnen(10, 4);
    assert.equal(e.zfpStar, 6);
    assert.equal(e.widerstanden, false);
  });

  test("MR gleich ZfP*: Ziel widersteht", () => {
    const e = mrVerrechnen(7, 7);
    assert.equal(e.zfpStar, 0);
    assert.equal(e.widerstanden, true);
  });

  test("MR höher als ZfP*: Ziel widersteht, ZfP* fällt nicht unter null", () => {
    // Belegt am 06.09.2026: Als Probenerschwernis griff bei ZfW unter der MR die
    // Sonderregel für negative Talentwerte — der Zauber wirkte dann mit ZfP* 1.
    // Ein Ziel konnte sich also nie vollständig wehren.
    const e = mrVerrechnen(3, 20);
    assert.equal(e.zfpStar, 0);
    assert.equal(e.widerstanden, true);
  });

  test("ohne Magieresistenz bleibt alles wie es ist", () => {
    const e = mrVerrechnen(5, 0);
    assert.equal(e.zfpStar, 5);
    assert.equal(e.widerstanden, false, "ohne MR gibt es keinen Widerstand");
  });

  test("ZfP* 0 ohne MR gilt nicht als Widerstand", () => {
    // Sonst würde jeder Zauber ohne MR-Ziel als widerstanden gemeldet.
    const e = mrVerrechnen(0, 0);
    assert.equal(e.widerstanden, false);
  });

  test("negative Eingaben werden nicht zu Boni", () => {
    assert.equal(mrVerrechnen(5, -3).zfpStar, 5);
    assert.equal(mrVerrechnen(-2, 0).zfpStar, 0);
  });
});
