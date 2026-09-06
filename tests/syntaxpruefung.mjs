/**
 * WOZU
 * ----
 * Wächter für die Fehlerklassen, die `node --check` durchwinkt, weil sie
 * syntaktisch gültig sind und erst zur Laufzeit knallen — dann aber mitten im
 * Spielabend.
 *
 * Anlass: Beim Umbau am 06.09.2026 wurde per Suchen-und-Ersetzen aus
 * `const zfpStar = result.tapStar ?? 0;` die Zeile `const zfpStar = zfpStar;`.
 * Gültige Syntax, gültiger Import — und ein "Cannot access before
 * initialization" genau dann, wenn jemand Gardianum wirkt.
 *
 * WO IM AUFBAU
 * ------------
 * Läuft vor den Regeltests (`npm run check`). Braucht keine Fremdpakete —
 * bewusst, damit die Prüfung auch auf einem frisch geklonten Modul sofort
 * läuft, ohne dass jemand erst etwas installieren muss.
 *
 * WORAUF ACHTEN
 * -------------
 * Neue Prüfungen gehören hier hinein, wenn sie ohne Ausführung entscheidbar
 * sind. Alles, was echte Werte braucht, gehört in eine *.test.mjs.
 * Jede Prüfung muss einmal rot gewesen sein — sonst weiss niemand, ob sie
 * überhaupt greift. Wie man das nachstellt, steht bei jeder Prüfung dabei.
 */

import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const wurzel = join(dirname(fileURLToPath(import.meta.url)), "..");
const befunde = [];

/** Sammelt alle Quelldateien mit einer der Endungen, ohne Fremdpakete. */
function dateienSuchen(verzeichnis, endungen, gesammelt = []) {
  for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
    if (eintrag.name === "node_modules" || eintrag.name === ".git") continue;
    const pfad = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) dateienSuchen(pfad, endungen, gesammelt);
    else if (endungen.some(e => eintrag.name.endsWith(e))) gesammelt.push(pfad);
  }
  return gesammelt;
}

const jsDateien   = dateienSuchen(join(wurzel, "scripts"), [".mjs", ".js"])
  .concat(dateienSuchen(join(wurzel, "tests"), [".mjs"]));
const jsonDateien = dateienSuchen(join(wurzel, "data"), [".json"])
  .concat([join(wurzel, "module.json"), join(wurzel, "package.json")]);

// ── Prüfung 1: Syntax ───────────────────────────────────────────────────────
// Rot machen: irgendwo eine Klammer entfernen.
for (const datei of jsDateien) {
  try {
    execFileSync(process.execPath, ["--check", datei], { stdio: "pipe" });
  } catch (fehler) {
    befunde.push(`Syntaxfehler in ${relative(wurzel, datei)}:\n${fehler.stderr?.toString().split("\n").slice(0, 4).join("\n")}`);
  }
}

// ── Prüfung 2: JSON lesbar ──────────────────────────────────────────────────
// Rot machen: in einer data/*.json ein Komma zu viel setzen.
for (const datei of jsonDateien) {
  try {
    JSON.parse(readFileSync(datei, "utf8"));
  } catch (fehler) {
    befunde.push(`Unlesbares JSON in ${relative(wurzel, datei)}: ${fehler.message}`);
  }
}

// ── Prüfung 3: sich selbst zuweisende Deklaration ───────────────────────────
// `const x = x;` ist gültige Syntax und wirft erst beim Ausführen.
// Rot machen: irgendwo `const test = test;` einfügen.
const selbstbezug = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\1\s*(?:[;,)]|$)/;

/**
 * Blendet Kommentare aus, ohne die Zeilennummern zu verschieben: Blockkommentare
 * werden durch ebenso viele Zeilenumbrüche ersetzt. Ohne diesen Schritt meldete
 * die Prüfung ihr eigenes Beispiel aus dem Kopfkommentar als Befund.
 */
function kommentareLeeren(quelltext) {
  return quelltext
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .split(/\r?\n/)
    .map(zeile => zeile.replace(/\/\/.*$/, ""))
    .join("\n");
}

for (const datei of jsDateien) {
  const zeilen = kommentareLeeren(readFileSync(datei, "utf8")).split(/\r?\n/);
  zeilen.forEach((zeile, i) => {
    const treffer = zeile.match(selbstbezug);
    if (treffer) {
      befunde.push(`${relative(wurzel, datei)}:${i + 1} — "${treffer[1]}" wird sich selbst zugewiesen; das wirft zur Laufzeit.`);
    }
  });
}

// ── Prüfung 3b: Helfer wird vor seiner Deklaration aufgerufen ───────────────
// `const hasSF = (…) => …` ist keine Funktionsdeklaration und wird nicht
// vorgezogen. Ein Aufruf oberhalb der Zeile wirft "Cannot access ... before
// initialization" — aber erst, wenn genau dieser Zweig durchlaufen wird.
// Am 06.09.2026 waren dadurch sieben Kampfmanöver unbenutzbar, ohne dass es je
// jemandem aufgefallen wäre: der Angriff brach einfach kommentarlos ab.
// Rot machen: in einer Methode einen `const helfer = () => {}` unter einen
// bereits vorhandenen `helfer()`-Aufruf schieben.
const helferDeklaration = /^(\s*)(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\(|function\b)/;

const { nurCode } = await import("./unbekannte-namen.mjs");

for (const datei of jsDateien) {
  const quelle = nurCode(readFileSync(datei, "utf8"));
  const zeilen = quelle.split("\n");

  // Zwei Tiefen je Zeilenanfang:
  //   tiefe          - alle geschweiften Klammern (Blöcke, Objekte, Funktionen)
  //   funktionstiefe - nur die Klammern, die einen Funktionsrumpf öffnen
  // Die zweite ist der Grund, warum diese Prüfung überhaupt brauchbar ist: ein
  // Aufruf INNERHALB einer später ausgeführten Funktion ist harmlos, auch wenn
  // er im Text oberhalb der Deklaration steht. Ohne diese Unterscheidung meldete
  // die Prüfung `updateHint()` in sheet.mjs als Fehler — dort ruft ein
  // Ereignisrückruf einen anderen, und beide existieren längst, wenn geklickt wird.
  const tiefeBeiZeile = [];
  const funktionstiefeBeiZeile = [];
  let tiefe = 0, funktionstiefe = 0;
  const klammerArt = [];  // true = diese Klammer öffnet einen Funktionsrumpf
  let naechsteIstFunktion = false;

  for (const zeile of zeilen) {
    tiefeBeiZeile.push(tiefe);
    funktionstiefeBeiZeile.push(funktionstiefe);
    for (let k = 0; k < zeile.length; k++) {
      const z = zeile[k];
      if (zeile.startsWith("=>", k) || zeile.startsWith("function", k)) naechsteIstFunktion = true;
      else if (z === ";" || z === ",") naechsteIstFunktion = false;
      if (z === "{") {
        tiefe++;
        klammerArt.push(naechsteIstFunktion);
        if (naechsteIstFunktion) funktionstiefe++;
        naechsteIstFunktion = false;
      } else if (z === "}") {
        tiefe--;
        if (klammerArt.pop()) funktionstiefe--;
      }
    }
  }

  zeilen.forEach((zeile, i) => {
    const treffer = zeile.match(helferDeklaration);
    if (!treffer) return;
    const name = treffer[2];
    const eigeneTiefe = tiefeBeiZeile[i];
    if (eigeneTiefe === 0) return; // Modulebene: Aufrufe stehen dort in Funktionen

    // Rückwärts bis zum Anfang des umschliessenden Blocks laufen.
    let blockStart = 0;
    for (let j = i - 1; j >= 0; j--) {
      if (tiefeBeiZeile[j] < eigeneTiefe) { blockStart = j; break; }
    }
    const aufruf = new RegExp(`\\b${name}\\s*\\(`);
    for (let j = blockStart; j < i; j++) {
      const gleicheFunktion = funktionstiefeBeiZeile[j] === funktionstiefeBeiZeile[i];
      if (gleicheFunktion && tiefeBeiZeile[j] >= eigeneTiefe && aufruf.test(zeilen[j])) {
        befunde.push(`${relative(wurzel, datei)}:${j + 1} — "${name}" wird aufgerufen, aber erst in Zeile ${i + 1} deklariert; das wirft zur Laufzeit.`);
        break;
      }
    }
  });
}

// ── Prüfung 4: jedes Modul lädt kopflos ─────────────────────────────────────
// Fängt alles ab, was schon beim Import scheitert: fehlende Exporte, Tippfehler
// in Importnamen, Zugriff auf Foundry-Globals zur Ladezeit.
// Rot machen: in irgendeiner Datei einen Import auf einen nicht existierenden
// Namen ändern.
await import("./foundry-stub.mjs");
for (const datei of dateienSuchen(join(wurzel, "scripts"), [".mjs"])) {
  try {
    await import(pathToFileURL(datei).href);
  } catch (fehler) {
    befunde.push(`${relative(wurzel, datei)} lädt nicht: ${fehler.message}`);
  }
}

// ── Prüfung 5: Importnamen existieren wirklich als Export ───────────────────
// Ein Import auf einen fehlenden Namen wirft beim Laden bereits (Prüfung 4),
// aber diese Prüfung nennt den Namen statt nur die Datei.
// Rot machen: `import { gibtEsNicht } from "./config.mjs";` einfügen.
const importZeile = /import\s*\{([^}]+)\}\s*from\s*["'](\.[^"']+)["']/g;
for (const datei of dateienSuchen(join(wurzel, "scripts"), [".mjs"])) {
  const inhalt = readFileSync(datei, "utf8");
  for (const treffer of inhalt.matchAll(importZeile)) {
    const ziel = join(dirname(datei), treffer[2]);
    let modul;
    try {
      modul = await import(pathToFileURL(ziel).href);
    } catch { continue; } // Ladefehler meldet bereits Prüfung 4
    const namen = treffer[1].split(",")
      .map(n => n.split(/\s+as\s+/)[0].trim())
      .filter(Boolean);
    for (const name of namen) {
      if (!(name in modul)) {
        befunde.push(`${relative(wurzel, datei)} importiert "${name}" aus ${treffer[2]} — dort nicht exportiert.`);
      }
    }
  }
}

// ── Prüfung 6: Bezeichner ohne Deklaration ──────────────────────────────────
// Fing am 06.09.2026 zwei garantierte Abstürze, die kein Syntaxtest sieht:
// `formula: kontrollFormula` in magic.mjs (lag VOR dem AsP-Abzug, hätte also
// kostenloses Zaubern ergeben) und `KO ${ko}` in zone-spells.mjs (Ausdauer war
// schon abgezogen, dann brach die Chat-Nachricht ab).
// Rot machen: irgendwo eine Variable benutzen, die es nicht gibt.
const { unbekannteNamenFinden } = await import("./unbekannte-namen.mjs");
for (const datei of dateienSuchen(join(wurzel, "scripts"), [".mjs"])) {
  befunde.push(...unbekannteNamenFinden(datei, relative(wurzel, datei)));
}

// ── Prüfung 7: Chat-Nachrichten nur über dsaChat() ──────────────────────────
// Eine Nachricht ohne Kennfeld des Moduls wird von dice-hooks.mjs als fremde
// Nachricht behandelt: das Ergebnis wird aus dem Text erraten und der Effekt
// ein zweites Mal ausgelöst. Bis v0.7.18 galt das für alle 43 eigenen
// Nachrichten. Wer eine neue schreibt, soll nicht daran denken müssen.
// Rot machen: irgendwo ChatMessage.create({ … }) direkt aufrufen.
for (const datei of dateienSuchen(join(wurzel, "scripts"), [".mjs"])) {
  if (datei.endsWith("config.mjs")) continue; // dort steht dsaChat selbst
  const zeilen = kommentareLeeren(readFileSync(datei, "utf8")).split("\n");
  zeilen.forEach((zeile, i) => {
    if (/\bChatMessage\.create\s*\(/.test(zeile)) {
      befunde.push(`${relative(wurzel, datei)}:${i + 1} — ChatMessage.create direkt aufgerufen; dsaChat() aus config.mjs benutzen, sonst löst dice-hooks den Effekt doppelt aus.`);
    }
  });
}

// ── Prüfung 8: ist es auch verdrahtet? ──────────────────────────────────────
// "Gebaut und getestet" heisst nicht "wird benutzt". Diese Tabelle hält fest,
// welche Bausteine an welcher Stelle tatsächlich aufgerufen werden müssen. Ein
// grüner Testlauf über eine Funktion, die niemand ruft, beweist nichts.
// Rot machen: einen der Aufrufe unten aus der Zieldatei entfernen.
const VERDRAHTUNG = [
  { was: "registerKampfuebersicht", datei: "scripts/module.mjs",
    warum: "sonst laesst sich die Kampfuebersicht nicht oeffnen" },
  { was: "registerSammelproben", datei: "scripts/module.mjs",
    warum: "sonst gibt es die Sammelproben im Spiel nicht" },
  { was: "registerZustaende", datei: "scripts/module.mjs",
    warum: "sonst gibt es die Zustandsverwaltung im Spiel nicht" },
  { was: "zustandsMalus", datei: "scripts/sheet.mjs",
    warum: "sonst wirken Zustände auf keine Probe" },
  { was: "aktiveBuffs", datei: "scripts/sheet.mjs",
    warum: "sonst bleiben Liturgie-Segen wieder wirkungslos" },
  { was: "applyCrit", datei: "scripts/magic.mjs",
    warum: "sonst rechnet der Zauber wieder mit ZfP* 0 bei glücklichem Wurf" },
  { was: "mrVerrechnen", datei: "scripts/magic.mjs",
    warum: "sonst wird die Magieresistenz wieder als Probenerschwernis verrechnet" },
  { was: "abgelaufeneEffekteEntfernen", datei: "scripts/persistent-effects.mjs",
    warum: "sonst laufen anhaltende Effekte nie ab" },
  { was: "calcIniPenalty", datei: "scripts/combat.mjs",
    warum: "sonst rechnet die Kampfleiste den Rüstungsmalus wieder eigenständig" },
  { was: "tpFormelZuWuerfeln", datei: "scripts/combat.mjs",
    warum: "sonst entsteht wieder ein 66-seitiger Würfel aus 2W6" },
  { was: "relayActorUpdate", datei: "scripts/pixel-tokens.mjs",
    warum: "sonst bricht Zonenschaden beim ersten fremden Token ab" },
];
for (const eintrag of VERDRAHTUNG) {
  const pfad = join(wurzel, eintrag.datei);
  let inhalt;
  try { inhalt = kommentareLeeren(readFileSync(pfad, "utf8")); }
  catch { befunde.push(`${eintrag.datei} fehlt — ${eintrag.was} kann dort nicht aufgerufen werden.`); continue; }
  const aufruf = new RegExp(`\\b${eintrag.was}\\s*\\(`);
  if (!aufruf.test(inhalt)) {
    befunde.push(`${eintrag.datei} ruft "${eintrag.was}" nicht auf — ${eintrag.warum}.`);
  }
}

// ── Ergebnis ────────────────────────────────────────────────────────────────
// Die Ergebniszeile nennt IMMER eine Zahl, damit ein Aufrufer nicht nur am
// Rückgabewert hängt, sondern im Protokoll sieht, wie viel geprüft wurde.
const geprueft = `${jsDateien.length} JS-Dateien, ${jsonDateien.length} JSON-Dateien`;
if (befunde.length > 0) {
  console.error(`Statische Pruefung: ${befunde.length} Befund(e) bei ${geprueft}\n`);
  for (const b of befunde) console.error("  - " + b);
  process.exit(1);
}
console.log(`Statische Pruefung: 0 Befunde bei ${geprueft}.`);
