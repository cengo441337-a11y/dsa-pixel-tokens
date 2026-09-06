/**
 * WOZU
 * ----
 * Prüft, dass anhaltende Liturgie-Effekte wieder verschwinden und dass ein
 * Liturgie-Segen einen auswertbaren Zahlenwert bekommt.
 *
 * WO IM AUFBAU
 * ------------
 * `scripts/persistent-effects.mjs` (Ablauf) und `scripts/liturgy-effects.mjs`
 * (Segen). Der Heldenbogen liest den Segen über `aktiveBuffs()`.
 *
 * WORAUF ACHTEN
 * -------------
 * Der Rundenzähler läuft nur während eines Kampfes. Ein Test, der `game.combat`
 * nicht setzt, prüft deshalb den Zeitzweig — nicht den Rundenzweig.
 */

import "./foundry-stub.mjs";
import { resetGameState } from "./foundry-stub.mjs";
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { istAbgelaufen, ablaufBerechnen, parseDuration } from "../scripts/persistent-effects.mjs";
import { buffWertBerechnen, aktiveBuffs } from "../scripts/liturgy-effects.mjs";

const MODUL = "dsa-pixel-tokens";

describe("istAbgelaufen — wann ein Effekt endet", () => {
  test("was nie abläuft, läuft auch jetzt nicht ab", () => {
    assert.equal(istAbgelaufen(null, { runde: 999, zeit: 999999 }), false);
  });

  test("Rundeneffekt endet, wenn die Zielrunde erreicht ist", () => {
    assert.equal(istAbgelaufen({ runde: 5 }, { runde: 4 }), false);
    assert.equal(istAbgelaufen({ runde: 5 }, { runde: 5 }), true);
    assert.equal(istAbgelaufen({ runde: 5 }, { runde: 9 }), true);
  });

  test("ohne laufenden Kampf endet ein Rundeneffekt nicht", () => {
    // Sonst würde das Ende eines Kampfes alle Segen auf einmal wegräumen.
    assert.equal(istAbgelaufen({ runde: 5 }, { runde: undefined, zeit: 10_000 }), false);
  });

  test("Zeiteffekt endet, wenn die Weltzeit den Zeitpunkt erreicht", () => {
    assert.equal(istAbgelaufen({ zeit: 3600 }, { zeit: 3599 }), false);
    assert.equal(istAbgelaufen({ zeit: 3600 }, { zeit: 3600 }), true);
  });
});

describe("ablaufBerechnen — Wirkungsdauer in einen Zeitpunkt umrechnen", () => {
  beforeEach(() => resetGameState());

  test("Runden werden auf die aktuelle Kampfrunde aufgeschlagen", () => {
    globalThis.game.combat = { round: 3 };
    assert.deepEqual(ablaufBerechnen({ rounds: 4 }), { runde: 7 });
  });

  test("Sekunden werden auf die Weltzeit aufgeschlagen", () => {
    globalThis.game.time = { worldTime: 1000 };
    assert.deepEqual(ablaufBerechnen({ seconds: 3600 }), { zeit: 4600 });
  });

  test("ohne Dauer gibt es keinen Ablauf", () => {
    assert.equal(ablaufBerechnen(null), null);
    assert.equal(ablaufBerechnen({}), null);
  });

  test("Wirkungsdauer aus der Liturgie wird zum Ablaufzeitpunkt", () => {
    // Kette wie im Spiel: Text → parseDuration → ablaufBerechnen
    globalThis.game.combat = { round: 2 };
    const dauer = parseDuration("LkP* SR", 5);
    assert.ok(dauer, "parseDuration muss für 'LkP* SR' eine Dauer liefern");
    const ablauf = ablaufBerechnen(dauer);
    assert.ok(ablauf?.runde > 2, "der Effekt muss irgendwann enden");
  });
});

describe("buffWertBerechnen — aus der Formel wird eine Zahl", () => {
  test("LkP* halbe rundet auf", () => {
    // DSA rundet abgeleitete Werte auf: LkP* 5 → 3, nicht 2.
    assert.equal(buffWertBerechnen("lkp_half", 5), 3);
    assert.equal(buffWertBerechnen("lkp_half", 6), 3);
  });

  test("voller LkP* und LkP*+5", () => {
    assert.equal(buffWertBerechnen("lkp", 7), 7);
    assert.equal(buffWertBerechnen("lkp_plus_5", 7), 12);
  });

  test("feste Zahl bleibt die Zahl", () => {
    assert.equal(buffWertBerechnen("1", 9), 1);
  });

  test("permanent ist keine Zahl", () => {
    // Ein Eid hat keinen Zahlenwert — er darf auch keinen erfinden.
    assert.equal(buffWertBerechnen("permanent", 9), null);
    assert.equal(buffWertBerechnen("irgendwas", 9), null);
  });
});

describe("aktiveBuffs — was der Heldenbogen zu sehen bekommt", () => {
  /** Aktor-Attrappe mit gesetzten Segen. */
  const aktorMit = (buffs) => ({
    getFlag: (bereich, schluessel) =>
      (bereich === MODUL && schluessel === "liturgyBuffs") ? buffs : undefined,
  });

  test("Zahlenwerte werden nach Art zurückgegeben", () => {
    const werte = aktiveBuffs(aktorMit([{ type: "rs", wert: 3 }, { type: "at_pa", wert: 2 }]));
    assert.equal(werte.rs, 3);
    assert.equal(werte.at_pa, 2);
  });

  test("gleichartige Segen stapeln nicht — der stärkere gilt", () => {
    const werte = aktiveBuffs(aktorMit([{ type: "rs", wert: 2 }, { type: "rs", wert: 5 }]));
    assert.equal(werte.rs, 5);
  });

  test("Segen ohne Zahl (Eid) taucht nicht als Wert auf", () => {
    const werte = aktiveBuffs(aktorMit([{ type: "eid", wert: null }]));
    assert.equal(werte.eid, undefined);
  });

  test("Aktor ohne Segen liefert ein leeres Ergebnis, keinen Fehler", () => {
    assert.deepEqual(aktiveBuffs(undefined), {});
    assert.deepEqual(aktiveBuffs(aktorMit(undefined)), {});
  });
});
