/**
 * WOZU
 * ----
 * Prüft die Buchführung der Sammelprobe: Punkte addieren, Zielwert erkennen,
 * Versuchsgrenze einhalten, Patzer nach der eingestellten Regel behandeln.
 *
 * WO IM AUFBAU
 * ------------
 * `scripts/sammelprobe.mjs`. Die Würfel kommen von aussen — genau deshalb lässt
 * sich das hier überhaupt prüfen.
 *
 * WORAUF ACHTEN
 * -------------
 * `versuchVerrechnen` gibt einen NEUEN Zustand zurück und lässt den alten in
 * Ruhe. Wer das ändert, macht jede Anzeige, die den vorherigen Stand noch hält,
 * still falsch — und der Fehler fällt erst auf, wenn jemand die Punkte
 * nachrechnet.
 */

import "./foundry-stub.mjs";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  neueSammelprobe, versuchVerrechnen, fortschritt, PATZER_REGELN,
} from "../scripts/sammelprobe.mjs";

/** Eine Sammelprobe mit Eigenschaftswerten statt Namen — so rechnet die Funktion. */
function probe(overrides = {}) {
  return neueSammelprobe({
    name: "Ritual", talent: "Ritualkenntnis",
    attribute: [14, 14, 14], taw: 8, ziel: 20,
    ...overrides,
  });
}

describe("neueSammelprobe — sinnvolle Ausgangswerte", () => {
  test("Zielwert ist mindestens 1", () => {
    assert.equal(neueSammelprobe({ ziel: 0 }).ziel, 1);
    assert.equal(neueSammelprobe({ ziel: -5 }).ziel, 1);
  });

  test("unbekannte Patzerregel fällt auf Abbruch zurück", () => {
    assert.equal(neueSammelprobe({ patzerRegel: "erfunden" }).patzerRegel, "abbruch");
    assert.ok(PATZER_REGELN.abbruch);
  });

  test("es werden nie mehr als drei Eigenschaften übernommen", () => {
    assert.equal(neueSammelprobe({ attribute: ["KL", "IN", "FF", "KK"] }).attribute.length, 3);
  });
});

describe("versuchVerrechnen — Punkte sammeln", () => {
  test("eine gelungene Probe zählt ihre TaP* dazu", () => {
    // Alle Würfel unter den Eigenschaften → voller TaW als TaP*.
    const nach = versuchVerrechnen(probe(), [2, 3, 4]);
    assert.equal(nach.gesammelt, 8);
    assert.equal(nach.versuche, 1);
  });

  test("mehrere Versuche addieren sich", () => {
    let s = probe();
    s = versuchVerrechnen(s, [2, 3, 4]);   // +8
    s = versuchVerrechnen(s, [2, 3, 4]);   // +8 → 16
    assert.equal(s.gesammelt, 16);
    assert.equal(s.abgeschlossen, false, "16 von 20 ist noch nicht fertig");
  });

  test("beim Erreichen des Ziels ist die Sammelprobe fertig", () => {
    let s = probe();
    s = versuchVerrechnen(s, [2, 3, 4]);
    s = versuchVerrechnen(s, [2, 3, 4]);
    s = versuchVerrechnen(s, [2, 3, 4]);   // 24 ≥ 20
    assert.equal(s.abgeschlossen, true);
    assert.equal(s.gescheitert, false);
  });

  test("eine misslungene Probe bringt keine Punkte, beendet aber nichts", () => {
    // Drei hohe Würfel fressen mehr als den TaW.
    const s = versuchVerrechnen(probe(), [19, 19, 19]);
    assert.equal(s.gesammelt, 0);
    assert.equal(s.versuche, 1);
    assert.equal(s.gescheitert, false);
  });

  test("der übergebene Zustand wird nicht verändert", () => {
    const vorher = probe();
    const kopie = JSON.stringify(vorher);
    versuchVerrechnen(vorher, [2, 3, 4]);
    assert.equal(JSON.stringify(vorher), kopie, "versuchVerrechnen darf den alten Stand nicht anfassen");
  });

  test("eine zusätzliche Erschwernis mindert die Ausbeute", () => {
    const ohne = versuchVerrechnen(probe(), [2, 3, 4]);
    const mit  = versuchVerrechnen(probe(), [2, 3, 4], 3);
    assert.equal(mit.gesammelt, ohne.gesammelt - 3);
  });
});

describe("versuchVerrechnen — Patzer nach eingestellter Regel", () => {
  const patzerWuerfel = [20, 20, 5];

  test("Abbruch beendet die Sammelprobe", () => {
    let s = probe({ patzerRegel: "abbruch" });
    s = versuchVerrechnen(s, [2, 3, 4]);          // 8 Punkte
    s = versuchVerrechnen(s, patzerWuerfel);
    assert.equal(s.gescheitert, true);
    assert.equal(s.gesammelt, 8, "die Punkte bleiben stehen, die Arbeit ist nur vorbei");
  });

  test("Verlust kostet die bisherige Arbeit, geht aber weiter", () => {
    let s = probe({ patzerRegel: "verlust" });
    s = versuchVerrechnen(s, [2, 3, 4]);
    s = versuchVerrechnen(s, patzerWuerfel);
    assert.equal(s.gesammelt, 0);
    assert.equal(s.gescheitert, false);
  });

  test("Weiter zählt nur den Fehlversuch", () => {
    let s = probe({ patzerRegel: "weiter" });
    s = versuchVerrechnen(s, [2, 3, 4]);
    s = versuchVerrechnen(s, patzerWuerfel);
    assert.equal(s.gesammelt, 8);
    assert.equal(s.gescheitert, false);
    assert.equal(s.versuche, 2);
  });

  test("ein Patzer bringt nie Punkte, auch wenn die Rechnung aufginge", () => {
    // [20,20,5] gegen Eigenschaften 20/20/20 ginge rechnerisch auf.
    const s = versuchVerrechnen(probe({ attribute: [20, 20, 20], patzerRegel: "weiter" }), [20, 20, 5]);
    assert.equal(s.gesammelt, 0);
    assert.equal(s.verlauf.at(-1).patzer, true);
  });
});

describe("versuchVerrechnen — Versuchsgrenze", () => {
  test("aufgebrauchte Versuche lassen die Sammelprobe scheitern", () => {
    let s = probe({ ziel: 100, maxVersuche: 2 });
    s = versuchVerrechnen(s, [2, 3, 4]);
    assert.equal(s.gescheitert, false);
    s = versuchVerrechnen(s, [2, 3, 4]);
    assert.equal(s.gescheitert, true, "nach dem zweiten von zwei Versuchen ist Schluss");
  });

  test("wer im letzten Versuch fertig wird, hat bestanden", () => {
    let s = probe({ ziel: 16, maxVersuche: 2 });
    s = versuchVerrechnen(s, [2, 3, 4]);
    s = versuchVerrechnen(s, [2, 3, 4]);   // 16 ≥ 16
    assert.equal(s.abgeschlossen, true);
    assert.equal(s.gescheitert, false, "Erfolg im letzten Versuch ist kein Scheitern");
  });

  test("ohne Grenze geht es beliebig weiter", () => {
    let s = probe({ ziel: 100, maxVersuche: 0 });
    for (let i = 0; i < 5; i++) s = versuchVerrechnen(s, [2, 3, 4]);
    assert.equal(s.gescheitert, false);
    assert.equal(s.versuche, 5);
  });

  test("eine beendete Sammelprobe nimmt keine Würfe mehr an", () => {
    let s = probe({ ziel: 8 });
    s = versuchVerrechnen(s, [2, 3, 4]);   // fertig
    const nachher = versuchVerrechnen(s, [2, 3, 4]);
    assert.equal(nachher.versuche, 1, "der zweite Wurf darf nicht mehr zählen");
  });
});

describe("fortschritt — was die Anzeige bekommt", () => {
  test("Prozent und fehlende Punkte stimmen", () => {
    const f = fortschritt({ gesammelt: 5, ziel: 20, versuche: 1, maxVersuche: 0 });
    assert.equal(f.prozent, 25);
    assert.equal(f.fehlend, 15);
    assert.equal(f.verbleibendeVersuche, null);
  });

  test("über dem Ziel bleibt es bei 100 Prozent", () => {
    assert.equal(fortschritt({ gesammelt: 40, ziel: 20 }).prozent, 100);
    assert.equal(fortschritt({ gesammelt: 40, ziel: 20 }).fehlend, 0);
  });

  test("verbleibende Versuche werden gezählt", () => {
    const f = fortschritt({ gesammelt: 0, ziel: 10, versuche: 3, maxVersuche: 5 });
    assert.equal(f.verbleibendeVersuche, 2);
  });
});
