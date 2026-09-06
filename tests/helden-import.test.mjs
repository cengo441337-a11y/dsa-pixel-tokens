/**
 * WOZU
 * ----
 * Prüft die Stellen des Helden-Imports, an denen aus einer richtigen
 * Eingabedatei falsche Werte wurden — und den Keyword-Rater für Zaubereffekte.
 *
 * WO IM AUFBAU
 * ------------
 * `scripts/xml-parser.mjs` (Import) und `scripts/config.mjs` (Rater). Beide
 * laufen beim Einlesen einer Datei aus der Helden-Software.
 *
 * WORAUF ACHTEN
 * -------------
 * Die Erwartungswerte hier stammen aus den drei mitgelieferten Beispielhelden.
 * Wer eine vierte Datei bekommt, bei der die Auslegung von `value` danebenliegt,
 * trägt sie hier als weitere Zeile ein — nicht als Sonderfall im Parser.
 */

import "./foundry-stub.mjs";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { javaNamenBereinigen, mrAusImport, _istPraefixMitWortgrenze } from "../scripts/xml-parser.mjs";
import { guessSpellEffect, RACE_GS } from "../scripts/config.mjs";

describe("javaNamenBereinigen — Rassennamen aus der Helden-Software", () => {
  test("Mittellaender wird zu Mittelländer", () => {
    assert.equal(javaNamenBereinigen("helden.model.rasse.Mittellaender"), "Mittelländer");
  });

  test("Huegelzwerg wird zu Hügelzwerg", () => {
    assert.equal(javaNamenBereinigen("helden.model.rasse.Huegelzwerg"), "Hügelzwerg");
  });

  test("Auelf bleibt Auelf", () => {
    // Belegt am 06.09.2026: "ue" → "ü" machte daraus "Aülf". Der Name stand
    // damit in keiner Rassentabelle, und der Held bekam Geschwindigkeit 8
    // statt 9.
    assert.equal(javaNamenBereinigen("helden.model.rasse.Auelf"), "Auelf");
  });

  test("Ambosszwerg bleibt Ambosszwerg", () => {
    // "sz" → "ß" machte daraus "Amboßwerg" — Geschwindigkeit 8 statt 6.
    assert.equal(javaNamenBereinigen("helden.model.rasse.Ambosszwerg"), "Ambosszwerg");
  });

  test("die bereinigten Namen stehen wirklich in der Geschwindigkeitstabelle", () => {
    // Der eigentliche Zweck der Bereinigung. Ohne diese Zusicherung könnte man
    // die Namen "richtig" schreiben und trotzdem am Nachschlagen vorbeilaufen.
    for (const roh of ["Auelf", "Ambosszwerg", "Huegelzwerg", "Waldelf", "Zwerg"]) {
      const name = javaNamenBereinigen(`helden.model.rasse.${roh}`);
      assert.ok(RACE_GS[name] !== undefined, `${roh} → "${name}" fehlt in RACE_GS`);
    }
  });

  test("ein Name ohne Punkte bleibt unverändert", () => {
    assert.equal(javaNamenBereinigen("Thorwaler"), "Thorwaler");
  });
});

describe("mrAusImport — Magieresistenz aus der Heldendatei", () => {
  // Die drei mitgelieferten Beispielhelden, nachgerechnet am 06.09.2026.
  test("Aytan: value ist der Zukauf", () => {
    // MU 15, KL 17, KO 13 → Formel 9; value 2 (Zukauf), mod −4 (Vollzauberer)
    assert.equal(mrAusImport(9, 2, -4), 7);
  });

  test("Grog: value ist der fertige Wert", () => {
    // MU 17, KL 15, KO 18 → Formel 10; value 10, mod +5
    // Vorher: 10 + 10 + 5 = 25. Eine Magieresistenz von 25 gibt es nicht.
    assert.equal(mrAusImport(10, 10, 5), 15);
  });

  test("Tarvas: value liegt über der Formel und gilt als fertiger Wert", () => {
    // MU 16, KL 14, KO 13 → Formel 9; value 11, mod 0. Vorher: 20.
    assert.equal(mrAusImport(9, 11, 0), 11);
  });

  test("fehlende Felder ergeben den reinen Formelwert", () => {
    assert.equal(mrAusImport(8), 8);
  });
});

describe("_istPraefixMitWortgrenze — Waffen aus der Tabelle finden", () => {
  test("ein Zusatz nach Komma zählt als derselbe Gegenstand", () => {
    assert.equal(_istPraefixMitWortgrenze("kurzschwert, breit", "kurzschwert"), true);
  });

  test("ein weiterlaufendes Wort ist ein anderer Gegenstand", () => {
    // Belegt am 06.09.2026: Grogs "Granat (10 Karat)" — ein Edelstein — galt als
    // Treffer auf "Granatapfel" und wurde zur Wurfwaffe mit 4W6 Schaden.
    assert.equal(_istPraefixMitWortgrenze("granatapfel", "granat"), false);
  });

  test("gleiche Namen treffen weiterhin", () => {
    assert.equal(_istPraefixMitWortgrenze("granat", "granat"), true);
  });

  test("Klammerzusatz zählt als Wortgrenze", () => {
    assert.equal(_istPraefixMitWortgrenze("granat (10 karat)", "granat"), true);
  });
});

describe("guessSpellEffect — Keyword-Rater für unbekannte Zauber", () => {
  test("Eiszauber werden als Eis erkannt", () => {
    assert.equal(guessSpellEffect("Eiseskälte Kämpferherz").effect, "eis");
    assert.equal(guessSpellEffect("Glacoflumen Fluss aus Eis").effect, "eis");
  });

  test("Geisterbann ist kein Eiszauber", () => {
    // "eis" steckt als Teilstring in "Geister". Der Eis-Zweig stand an zweiter
    // Stelle und fing 19 Zauber ab, die woandershin gehörten.
    assert.notEqual(guessSpellEffect("Geisterbann").effect, "eis");
  });

  test("Silentium Schweigekreis ist kein Eiszauber", () => {
    assert.notEqual(guessSpellEffect("Silentium Schweigekreis").effect, "eis");
  });

  test("Körperlose Reise wird zum Portal, nicht zu Eis", () => {
    assert.equal(guessSpellEffect("Körperlose Reise").effect, "portal");
  });

  test("Eisenhart ist kein Eiszauber", () => {
    assert.notEqual(guessSpellEffect("Eisenhart").effect, "eis");
  });

  test("ein Kreis ist keine Reise", () => {
    assert.notEqual(guessSpellEffect("Schweigekreise").effect, "portal");
  });
});
