/**
 * WOZU
 * ----
 * Prüft den Kern der DSA-4.1-Probenmechanik in `scripts/config.mjs`:
 * `resolveProbe` (3W20-Talent-/Zauberprobe) und `checkCritical`
 * (glücklicher Wurf / Patzer). Diese beiden Funktionen entscheiden über
 * Gelingen, TaP* / ZfP* und damit über Schadenshöhe und Wirkungsdauer jedes
 * Zaubers — eine falsche Antwort hier ist im Spiel sofort teuer.
 *
 * WO IM AUFBAU
 * ------------
 * Aufrufer von `resolveProbe`: magic.mjs, liturgies.mjs, shamanism.mjs,
 * sheet.mjs, zone-spells.mjs. Alle fünf verlassen sich auf `tapStar`.
 *
 * WORAUF ACHTEN
 * -------------
 * Die Würfel werden hier IMMER fest vorgegeben. Kein Test darf `Math.random`
 * oder `Roll` benutzen — ein Regeltest, der würfelt, prüft den Zufall statt
 * die Regel und meldet mal grün, mal rot.
 */

import "./foundry-stub.mjs";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { resolveProbe, checkCritical, applyCrit } from "../scripts/config.mjs";

describe("resolveProbe — 3W20-Probe (WdH S.27)", () => {
  test("alle Würfel unter den Eigenschaften: TaP* = voller TaW", () => {
    const r = resolveProbe([2, 3, 4], [12, 12, 12], 7);
    assert.equal(r.success, true);
    assert.equal(r.tapStar, 7);
  });

  test("überzählige Augen werden vom TaW abgezogen", () => {
    // 15 gegen 12 = 3 zu viel, 14 gegen 12 = 2 zu viel → 5 Punkte verbraucht
    const r = resolveProbe([15, 14, 5], [12, 12, 12], 7);
    assert.equal(r.success, true);
    assert.equal(r.tapStar, 2);
  });

  test("mehr Überpunkte als TaW: Probe misslingt, TaP* = 0", () => {
    const r = resolveProbe([18, 18, 5], [12, 12, 12], 7);
    assert.equal(r.success, false);
    assert.equal(r.tapStar, 0);
  });

  test("TaW genau aufgebraucht: Probe gelingt mit TaP* 1 (Mindestwert)", () => {
    // 19 gegen 12 = 7 zu viel, TaW 7 → Rest 0 → gelungen, aber TaP* mindestens 1
    const r = resolveProbe([19, 5, 5], [12, 12, 12], 7);
    assert.equal(r.success, true);
    assert.equal(r.tapStar, 1);
  });

  test("Erschwernis wird vor der Probe vom TaW abgezogen", () => {
    const r = resolveProbe([2, 3, 4], [12, 12, 12], 7, 4);
    assert.equal(r.effectiveTaw, 3);
    assert.equal(r.tapStar, 3);
  });

  test("negativer effektiver TaW erschwert zusätzlich jede Eigenschaft (WdH S.7)", () => {
    // TaW 2 − Erschwernis 5 = −3 → jede Eigenschaft gilt um 3 gemindert.
    // Würfel 9 gegen effektiv 9 ist noch drin, 10 gegen effektiv 9 nicht mehr.
    const gerade = resolveProbe([9, 9, 9], [12, 12, 12], 2, 5);
    assert.equal(gerade.success, true, "9 gegen effektiv 9 muss gelingen");
    const drueber = resolveProbe([10, 9, 9], [12, 12, 12], 2, 5);
    assert.equal(drueber.success, false, "10 gegen effektiv 9 muss misslingen");
  });

  test("TaP* sind auf den unmodifizierten TaW gedeckelt (Erleichterung erhöht die Qualität nicht)", () => {
    // WdH S.27: Eine Erleichterung erhöht die Chance, aber es können nie mehr
    // TaP* übrig bleiben, als der Held überhaupt TaW besitzt.
    // Belegt am 06.09.2026: TaW 4 mit Erleichterung 5 lieferte ZfP* 9 statt 4.
    const r = resolveProbe([2, 2, 2], [12, 12, 12], 4, -5);
    assert.equal(r.success, true);
    assert.equal(r.tapStar, 4, "TaP* darf den unmodifizierten TaW nicht übersteigen");
  });

  test("Deckelung greift auch bei teilweise verbrauchtem TaW", () => {
    // TaW 4, Erleichterung 5 → effektiv 9; ein Würfel frisst 2 Punkte → 7 übrig,
    // gedeckelt auf 4.
    const r = resolveProbe([14, 2, 2], [12, 12, 12], 4, -5);
    assert.equal(r.tapStar, 4);
  });

  test("Deckelung darf gelungene Proben mit kleinem Rest nicht verfälschen", () => {
    // TaW 10, Erleichterung 3 → effektiv 13; Würfel fressen 11 → Rest 2.
    // 2 liegt unter dem TaW, bleibt also 2.
    const r = resolveProbe([17, 18, 2], [12, 12, 12], 10, -3);
    assert.equal(r.success, true);
    assert.equal(r.tapStar, 2);
  });
});

describe("checkCritical — glücklicher Wurf und Patzer (WdH S.28)", () => {
  test("zwei Einsen sind ein glücklicher Wurf", () => {
    const c = checkCritical([1, 1, 15]);
    assert.equal(c.gluecklich, true);
    assert.equal(c.patzer, false);
  });

  test("zwei Zwanzigen sind ein Patzer", () => {
    const c = checkCritical([20, 20, 3]);
    assert.equal(c.patzer, true);
    assert.equal(c.gluecklich, false);
  });

  test("eine einzelne Zwanzig ist bei der 3W20-Probe bedeutungslos", () => {
    const c = checkCritical([20, 3, 3]);
    assert.equal(c.patzer, false);
    assert.equal(c.gluecklich, false);
  });

  test("drei Einsen werden als meisterhaft ausgewiesen", () => {
    const c = checkCritical([1, 1, 1]);
    assert.equal(c.gluecklich, true);
    assert.equal(c.meisterhaft, true, "drei Einsen sind mehr als ein glücklicher Wurf");
  });

  test("drei Zwanzigen werden als schwerer Patzer ausgewiesen", () => {
    const c = checkCritical([20, 20, 20]);
    assert.equal(c.patzer, true);
    assert.equal(c.schwererPatzer, true, "drei Zwanzigen sind ein schwerer Patzer");
  });
});

describe("applyCrit — Probe und Kritischer verrechnet", () => {
  /** Kürzel: würfelt nicht, sondern rechnet die vorgegebenen Würfel durch. */
  const durchrechnen = (dice, attrs, taw, mod = 0) =>
    applyCrit(resolveProbe(dice, attrs, taw, mod), checkCritical(dice), taw);

  test("glücklicher Wurf trotz rechnerisch misslungener Probe liefert verwertbare TaP*", () => {
    // Belegt am 06.09.2026: Würfel [1,1,20] gegen 10/10/10 mit ZfW 2 ergab
    // success=false und tapStar=0. magic.mjs setzte daraufhin success=true und
    // meldete "GLÜCKLICH! Maximale Wirkung!" — rechnete den Schaden aber mit
    // ZfP* 0, also ohne jede Wirkung.
    const e = durchrechnen([1, 1, 20], [10, 10, 10], 2);
    assert.equal(e.success, true);
    assert.equal(e.quelle, "gluecklich");
    assert.ok(e.tapStar >= 1, "eine gelungene Probe darf nicht 0 TaP* liefern");
  });

  test("glücklicher Wurf verschlechtert eine ohnehin gute Probe nicht", () => {
    // [1,1,2] gegen 15/15/15 mit TaW 8: nichts wird verbraucht → 8 TaP*.
    const e = durchrechnen([1, 1, 2], [15, 15, 15], 8);
    assert.equal(e.tapStar, 8);
  });

  test("meisterhafter Erfolg gibt den vollen TaW als TaP*", () => {
    const e = durchrechnen([1, 1, 1], [10, 10, 10], 9);
    assert.equal(e.quelle, "meisterhaft");
    assert.equal(e.tapStar, 9);
  });

  test("Patzer sticht eine rechnerisch gelungene Probe", () => {
    // [20,20,1] gegen 20/20/20 mit TaW 10: rechnerisch gelungen, trotzdem Patzer.
    const roh = resolveProbe([20, 20, 1], [20, 20, 20], 10);
    assert.equal(roh.success, true, "Vorbedingung: die reine Rechnung gelingt");
    const e = durchrechnen([20, 20, 1], [20, 20, 20], 10);
    assert.equal(e.success, false);
    assert.equal(e.tapStar, 0);
    assert.equal(e.quelle, "patzer");
  });

  test("ohne Kritischen bleibt das Probenergebnis unverändert", () => {
    const e = durchrechnen([15, 14, 5], [12, 12, 12], 7);
    assert.equal(e.quelle, "probe");
    assert.equal(e.success, true);
    assert.equal(e.tapStar, 2);
  });
});
