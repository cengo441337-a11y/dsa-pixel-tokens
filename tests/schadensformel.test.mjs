/**
 * WOZU
 * ----
 * Prüft `tpFormelZuWuerfeln` — den Umwandler von DSA-Schadensformeln in
 * Foundry-Würfelschreibweise.
 *
 * Diese Tests fehlten. Aufgefallen ist das nicht beim Lesen, sondern in der
 * Mutationsprüfung: eine absichtlich zurückgebaute Fassung des Umwandlers ging
 * durch die gesamte Testsuite, ohne dass ein einziger Test rot wurde.
 *
 * WO IM AUFBAU
 * ------------
 * `scripts/config.mjs`. Aufrufer sind `sheet.mjs::_rollDamage` und
 * `combat.mjs::showDamageDialog`.
 *
 * WORAUF ACHTEN
 * -------------
 * Der Fehler, der hier bewacht wird, war unauffällig und teuer: die Seitenzahl
 * landete in der Bonusgruppe, aus "2W6+4" wurde "2d66+4" — ein 66-seitiger
 * Würfel mit Erwartungswert 71 statt 11.
 */

import "./foundry-stub.mjs";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { tpFormelZuWuerfeln } from "../scripts/config.mjs";

describe("tpFormelZuWuerfeln — DSA-Schreibweise in Würfel übersetzen", () => {
  test("W ohne Seitenzahl ist immer ein W6", () => {
    assert.equal(tpFormelZuWuerfeln("1W+4"), "1d6+4");
    assert.equal(tpFormelZuWuerfeln("W6"), "1d6");
    assert.equal(tpFormelZuWuerfeln("W"), "1d6");
  });

  test("Seitenzahl bleibt Seitenzahl und wird nicht zum Zuschlag", () => {
    // Der eigentliche Befund: "2W6+4" wurde zu "2d66+4".
    assert.equal(tpFormelZuWuerfeln("2W6+4"), "2d6+4");
    assert.equal(tpFormelZuWuerfeln("3W20"), "3d20");
    assert.equal(tpFormelZuWuerfeln("1W20+2"), "1d20+2");
  });

  test("negative Zuschläge bleiben erhalten", () => {
    assert.equal(tpFormelZuWuerfeln("2W6-1"), "2d6-1");
  });

  test("mehrere Würfelgruppen in einer Formel", () => {
    assert.equal(tpFormelZuWuerfeln("2W6+1W4"), "2d6+1d4");
  });

  test("Kleinschreibung wird genauso behandelt", () => {
    assert.equal(tpFormelZuWuerfeln("2w6+4"), "2d6+4");
  });

  test("leere oder unsinnige Eingaben ergeben einen brauchbaren Würfel", () => {
    // Ein Schadenswurf ohne Formel darf nicht die ganze Aktion abbrechen.
    assert.equal(tpFormelZuWuerfeln(""), "1d6");
    assert.equal(tpFormelZuWuerfeln(null), "1d6");
    assert.equal(tpFormelZuWuerfeln(undefined), "1d6");
  });

  test("eine bereits umgewandelte Formel bleibt unverändert", () => {
    assert.equal(tpFormelZuWuerfeln("2d6+4"), "2d6+4");
  });

  test("der Erwartungswert bleibt in einer sinnvollen Grössenordnung", () => {
    // Zusicherung statt Sollwert: 2W6+4 liegt zwischen 6 und 16. Wer die
    // Seitenzahl verliert, landet bei 2d66 — Erwartungswert 71.
    const formel = tpFormelZuWuerfeln("2W6+4");
    const treffer = formel.match(/^(\d+)d(\d+)([+-]\d+)?$/);
    assert.ok(treffer, `unerwartete Form: ${formel}`);
    const [, anzahl, seiten, zuschlag] = treffer;
    const min = Number(anzahl) * 1 + Number(zuschlag ?? 0);
    const max = Number(anzahl) * Number(seiten) + Number(zuschlag ?? 0);
    assert.equal(min, 6);
    assert.equal(max, 16);
  });
});
