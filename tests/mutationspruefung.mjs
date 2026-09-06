/**
 * WOZU
 * ----
 * Prüft die Tests, nicht den Code. Ein grüner Testlauf beweist nur, dass die
 * Tests durchlaufen — nicht, dass sie etwas merken würden. Diese Prüfung baut
 * absichtlich Fehler ein und verlangt, dass die Tests rot werden.
 *
 * Anlass: Am 06.09.2026 war ein Test zu den Aktoren-Ordnern grün, obwohl die
 * Schutzprüfung, die er angeblich bewachte, entfernt war. Er war grün aus dem
 * falschen Grund. Aufgefallen ist das erst durch genau diesen Durchlauf.
 *
 * WO IM AUFBAU
 * ------------
 * `npm run mutation`. Läuft nicht bei jedem Testlauf mit — er dauert, weil er
 * die gesamte Testsuite je Mutation einmal startet. Gedacht ist er für den
 * Abschluss einer Durchsicht und vor einem Release.
 *
 * WORAUF ACHTEN
 * -------------
 * Jede Mutation muss BEIDE Richtungen zeigen: eingebaut → rot, zurückgenommen →
 * wieder grün. Ohne die Rückrichtung wüsste man nicht, ob der rote Lauf von der
 * Mutation kam oder von einer kaputten Arbeitskopie.
 *
 * Wer eine neue Regel absichert, trägt hier eine Mutation dazu ein. Eine Regel
 * ohne Mutation ist eine Regel, von der niemand weiss, ob ihr Test greift.
 *
 * Der Durchlauf fasst NICHTS an, was er nicht am Ende zurückschreibt: jede
 * Datei wird vorher in den Speicher gelesen und im finally-Zweig wieder
 * hergestellt — auch wenn der Testlauf abstürzt.
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const wurzel = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Die Mutationen. `suche` muss GENAU EINMAL in der Datei vorkommen — sonst
 * bricht der Durchlauf ab, statt an einer zufälligen Stelle zu schneiden.
 */
const MUTATIONEN = [
  {
    name: "TaP*-Deckelung entfernt",
    datei: "scripts/config.mjs",
    suche: "? Math.max(1, Math.min(remaining, Math.max(taw, 0)))",
    ersatz: "? Math.max(1, remaining)",
    erwartet: "Erleichterungen blasen die TaP* wieder auf",
  },
  {
    name: "glücklicher Wurf liefert wieder 0 TaP*",
    datei: "scripts/config.mjs",
    suche: 'return { success: true, tapStar: Math.max(1, result?.tapStar ?? 0), quelle: "gluecklich" };',
    ersatz: 'return { success: true, tapStar: result?.tapStar ?? 0, quelle: "gluecklich" };',
    erwartet: "der Zauber gelingt und richtet nichts aus",
  },
  {
    name: "Patzer sticht nicht mehr",
    datei: "scripts/config.mjs",
    suche: 'if (crit?.patzer) return { success: false, tapStar: 0, quelle: "patzer" };',
    ersatz: 'if (false) return { success: false, tapStar: 0, quelle: "patzer" };',
    erwartet: "eine rechnerisch gelungene Probe gilt trotz Patzer",
  },
  {
    name: "Magieresistenz wirkt nicht mehr",
    datei: "scripts/config.mjs",
    suche: "return { zfpStar: uebrig, widerstanden: mr > 0 && uebrig <= 0 };",
    ersatz: "return { zfpStar: Math.max(1, uebrig), widerstanden: false };",
    erwartet: "das Ziel kann sich nie vollständig wehren",
  },
  {
    name: "Schadensformel ohne eigene Seitenzahl-Gruppe",
    datei: "scripts/config.mjs",
    suche: '(_, anzahl, seiten, zuschlag) => `${anzahl || "1"}d${seiten || "6"}${zuschlag || ""}`',
    ersatz: '(_, anzahl, seiten, zuschlag) => `${anzahl || "1"}d6${seiten || ""}${zuschlag || ""}`',
    erwartet: "aus 2W6+4 wird wieder ein 66-seitiger Würfel",
  },
  {
    name: "Zustands-Abzug als Bonus",
    datei: "scripts/zustaende.mjs",
    suche: "      if (eintrag.kampf) summe += stufe;",
    ersatz: "      if (eintrag.kampf) summe -= stufe;",
    erwartet: "je schlechter es dem Helden geht, desto leichter die Probe",
  },
  {
    name: "Stufengrenze aufgehoben",
    datei: "scripts/zustaende.mjs",
    suche: "  return Math.min(MAX_STUFE, Math.max(0, n));",
    ersatz: "  return n;",
    erwartet: "negative Stufen werden zu Boni, Stufe 99 zu −99",
  },
  {
    name: "Duplikate werden wieder ungefragt gelöscht",
    datei: "scripts/actor-folders.mjs",
    suche: "    if (!wirklichLoeschen) continue;",
    ersatz: "    if (false) continue;",
    erwartet: "der Weltstart löscht wieder Aktoren",
  },
  {
    name: "Spielercharaktere sind nicht mehr geschützt",
    datei: "scripts/actor-folders.mjs",
    suche: "  if (_hatSpielerBesitzer(actor)) return null;",
    ersatz: "  if (false) return null;",
    erwartet: "Helden wandern wieder nach 'DSA Untote'",
  },
  {
    name: "Sammelprobe kennt keine Versuchsgrenze",
    datei: "scripts/sammelprobe.mjs",
    suche: "    stand.maxVersuche > 0 && versuche >= stand.maxVersuche && !abgeschlossen;",
    ersatz: "    false;",
    erwartet: "aufgebrauchte Versuche beenden nichts mehr",
  },
  {
    name: "Sammelprobe zählt Patzerpunkte mit",
    datei: "scripts/sammelprobe.mjs",
    suche: "  if (crit.patzer) {",
    ersatz: "  if (false) {",
    erwartet: "ein Patzer bringt Fortschritt",
  },
  {
    name: "Kampfübersicht zeigt fremde Werte",
    datei: "scripts/kampfuebersicht.mjs",
    suche: "  return stufe >= beobachter;",
    ersatz: "  return true;",
    erwartet: "Spieler lesen verdeckte Werte der Spielleitung",
  },
  {
    name: "Waffenzuordnung ohne Wortgrenze",
    datei: "scripts/xml-parser.mjs",
    suche: "  return !/[\\p{L}\\p{N}]/u.test(t.charAt(p.length));",
    ersatz: "  return true;",
    erwartet: "ein Edelstein wird wieder zur Wurfwaffe",
  },
  {
    name: "Magieresistenz beim Import wieder doppelt addiert",
    datei: "scripts/xml-parser.mjs",
    suche: "  const grundwert = v >= formel ? v : formel + v;",
    ersatz: "  const grundwert = formel + v;",
    erwartet: "Grog bekommt wieder MR 25",
  },
  {
    name: "Umlaut-Ersetzung ohne Ausnahmen",
    datei: "scripts/xml-parser.mjs",
    suche: "  if (Object.prototype.hasOwnProperty.call(JAVA_NAME_AUSNAHMEN, roh)) {",
    ersatz: "  if (false) {",
    erwartet: "aus Auelf wird wieder Aülf",
  },
  {
    name: "Ablauf anhaltender Effekte abgeschaltet",
    datei: "scripts/persistent-effects.mjs",
    suche: "    return jetzt.runde >= ablauf.runde;",
    ersatz: "    return false;",
    erwartet: "Segen und Auren bleiben für immer",
  },
  {
    name: "Liturgie-Segen ohne Zahlenwert zählt als 0",
    datei: "scripts/liturgy-effects.mjs",
    suche: "    if (b?.wert === null || b?.wert === undefined) continue;",
    ersatz: "    if (false) continue;",
    erwartet: "ein Eid erscheint als Segen mit Bonus 0",
  },
  {
    // Diese Mutation ersetzt eine fruehere, die durchrutschte: die Wortgrenze
    // allein ist nicht beobachtbar, weil die Rangfolge darunter den Fall
    // ohnehin auffaengt. Die Rangfolge IST also die tragende Regel — und die
    // wird hier mutiert.
    name: "Erfolg schlaegt Misserfolg (Rangfolge gedreht)",
    datei: "scripts/dice-hooks.mjs",
    suche: "  if (patzer || misserfolg) success = false;\n  else if (gluecklich || erfolg) success = true;",
    ersatz: "  if (gluecklich || erfolg) success = true;\n  else if (patzer || misserfolg) success = false;",
    erwartet: '"nicht gelungen" gilt wieder als gelungen',
  },
  {
    name: "ohne Erfolg zaehlt wieder als Erfolg",
    datei: "scripts/dice-hooks.mjs",
    suche: "                  || /\\bohne\\s+erfolg\\b/.test(t)",
    ersatz: "                  || false",
    erwartet: '"Der Wurf blieb ohne Erfolg" loest Treffer-Effekte aus',
  },
];

/**
 * Startet die gesamte Testsuite und meldet gruen/rot.
 *
 * Die Testdateien werden einzeln uebergeben und NICHT als Verzeichnis: node
 * deutet "tests/" je nach Fassung als Datei und bricht dann mit
 * "Cannot find module" ab — was hier faelschlich als "rot" durchginge und den
 * ganzen Durchlauf wertlos machte.
 */
function testeSuite() {
  const dateien = readdirSync(join(wurzel, "tests"))
    .filter(n => n.endsWith(".test.mjs"))
    .map(n => join("tests", n));
  if (dateien.length === 0) {
    console.error("Keine Testdateien gefunden — der Durchlauf koennte nichts beweisen.");
    process.exit(1);
  }
  try {
    execFileSync(process.execPath, ["--test", ...dateien], { cwd: wurzel, stdio: "pipe" });
    return true;   // gruen
  } catch {
    return false;  // rot
  }
}

// ── Vorbedingung: die unveränderte Arbeitskopie muss grün sein ──────────────
process.stdout.write("Ausgangslage prüfen ... ");
if (!testeSuite()) {
  console.error("ROT.\nDie Tests sind schon ohne Mutation rot. Erst reparieren, dann mutieren —\n" +
                "sonst ist jedes Ergebnis dieses Durchlaufs wertlos.");
  process.exit(1);
}
console.log("grün.\n");

let ueberlebt = 0;
let gefangen = 0;
const durchgerutscht = [];

for (const m of MUTATIONEN) {
  const pfad = join(wurzel, m.datei);
  const original = readFileSync(pfad, "utf8");
  // Zeilenenden vereinheitlichen: das Arbeitsverzeichnis kann CRLF haben (git
  // konvertiert beim Auschecken), die Suchtexte hier stehen mit \n. Ohne diesen
  // Schritt findet eine mehrzeilige Mutation null Treffer und bricht den Lauf
  // ab, obwohl am Code nichts fehlt.
  const normiert = original.replace(/\r\n/g, "\n");
  const treffer = normiert.split(m.suche).length - 1;

  if (treffer !== 1) {
    console.error(`ABBRUCH: "${m.name}" — Suchtext kommt ${treffer}× in ${m.datei} vor, erwartet genau 1×.`);
    console.error("Der Code hat sich geändert. Mutation anpassen, nicht raten.");
    process.exit(1);
  }

  let rot;
  try {
    writeFileSync(pfad, normiert.replace(m.suche, m.ersatz), "utf8");
    rot = !testeSuite();
  } finally {
    // Egal was passiert: die Datei wird wiederhergestellt.
    writeFileSync(pfad, original, "utf8");
  }

  if (rot) {
    gefangen++;
    console.log(`  gefangen   ${m.name}`);
  } else {
    ueberlebt++;
    durchgerutscht.push(m);
    console.log(`  DURCHGERUTSCHT  ${m.name} — ${m.erwartet}`);
  }
}

// ── Rückrichtung: nach allen Mutationen muss wieder alles grün sein ─────────
process.stdout.write("\nArbeitskopie nach dem Durchlauf ... ");
const wiederGruen = testeSuite();
console.log(wiederGruen ? "grün." : "ROT — eine Datei wurde nicht sauber zurückgeschrieben!");

console.log(`\nMutationsprüfung: ${gefangen} von ${MUTATIONEN.length} gefangen, ${ueberlebt} durchgerutscht.`);
if (durchgerutscht.length) {
  console.error("\nFür diese Regeln gibt es keinen Test, der sie bewacht:");
  for (const m of durchgerutscht) {
    console.error(`  - ${m.name} (${m.datei}) — Folge: ${m.erwartet}`);
  }
}
process.exit((ueberlebt === 0 && wiederGruen) ? 0 : 1);
