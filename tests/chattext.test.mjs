/**
 * WOZU
 * ----
 * Prüft `bewerteChatText` aus `scripts/dice-hooks.mjs` — die Notlösung, mit der
 * das Modul das Ergebnis fremder Chatnachrichten errät, um Effekte auszulösen.
 *
 * WO IM AUFBAU
 * ------------
 * Wird nur erreicht, wenn eine Nachricht KEIN eigenes Kennfeld
 * (`flags["dsa-pixel-tokens"].probe`) trägt — also bei Nachrichten des
 * Spielsystems gdsa oder anderer Module.
 *
 * WORAUF ACHTEN
 * -------------
 * Wer hier ein Stichwort ergänzt, muss beide Richtungen prüfen: Enthält das
 * neue Wort ein bestehendes als Teilstring? Genau daran ist die alte Fassung
 * gescheitert — "Misserfolg" enthält "erfolg".
 */

import "./foundry-stub.mjs";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { bewerteChatText } from "../scripts/dice-hooks.mjs";

describe("bewerteChatText — Ergebnis aus fremdem Chattext", () => {
  test("Misserfolg gilt nicht als Erfolg", () => {
    // Belegt am 06.09.2026: text.includes("erfolg") traf in "Misserfolg" zu.
    // Folge: Treffer-Effekt und Schadensblitz nach einer misslungenen Probe.
    const e = bewerteChatText("Klettern: Misserfolg");
    assert.equal(e.success, false);
  });

  test("nicht gelungen gilt nicht als gelungen", () => {
    assert.equal(bewerteChatText("Die Probe ist nicht gelungen").success, false);
  });

  test("kein Treffer gilt nicht als Treffer", () => {
    assert.equal(bewerteChatText("Angriff: kein Treffer").success, false);
  });

  test("gelungene Probe wird als Erfolg erkannt", () => {
    assert.equal(bewerteChatText("Schwerter: Probe gelungen").success, true);
  });

  test("Treffer wird als Erfolg erkannt", () => {
    assert.equal(bewerteChatText("Attacke — Treffer!").success, true);
  });

  test("Patzer schlägt jedes Erfolgswort", () => {
    const e = bewerteChatText("Treffer? Nein — PATZER!");
    assert.equal(e.success, false);
    assert.equal(e.fumble, true);
  });

  test("glücklicher Wurf gilt als Erfolg und als kritisch", () => {
    const e = bewerteChatText("GLÜCKLICH! Maximale Wirkung");
    assert.equal(e.success, true);
    assert.equal(e.critical, true);
  });

  test("kritischer Misserfolg ist ein Patzer, kein Kritischer", () => {
    const e = bewerteChatText("Kritischer Misserfolg");
    assert.equal(e.fumble, true);
    assert.equal(e.success, false);
    assert.equal(e.critical, false, "ein Patzer darf keinen Kritisch-Effekt auslösen");
  });

  test("Text ohne Aussage liefert kein Urteil", () => {
    // Wichtig: null, nicht false. Ein "weiss nicht" darf nicht als Misserfolg
    // durchgehen, sonst löst jede beliebige Nachricht Misserfolgs-Effekte aus.
    assert.equal(bewerteChatText("Alrik betritt die Taverne.").success, null);
  });

  test("Zaubernachricht wird als solche erkannt", () => {
    assert.equal(bewerteChatText("Ignifaxius — 12 AsP").istZauber, true);
  });
});
