/**
 * WOZU
 * ----
 * Findet Bezeichner, die benutzt, aber nirgends deklariert werden — der Fehler,
 * den ein Übersetzer sofort meldet und den reines JavaScript erst zur Laufzeit
 * bemerkt. Zwei Beispiele aus dem Audit vom 06.09.2026:
 *
 *   zone-spells.mjs — "Talent ${taw} gg KO ${ko}" : `ko` existiert nicht.
 *                     Der Spieler verlor bereits Ausdauer, dann brach der
 *                     Aufbau der Chat-Nachricht ab. Kein Wurf, keine Meldung.
 *   magic.mjs       — `formula: kontrollFormula` : existiert nicht. Die Zeile
 *                     liegt vor dem AsP-Abzug, hätte also kostenloses Zaubern
 *                     ergeben.
 *
 * WO IM AUFBAU
 * ------------
 * Wird von `tests/syntaxpruefung.mjs` als Prüfung 6 aufgerufen.
 *
 * WORAUF ACHTEN
 * -------------
 * Der erste Versuch benutzte reguläre Ausdrücke, um Zeichenketten auszublenden.
 * Er meldete 2985 Treffer, fast alle aus HTML in Template-Literalen — unbrauchbar,
 * weil niemand eine Liste liest, die zu 99 % aus Rauschen besteht. Deshalb läuft
 * hier ein echter Zeichenlauf, der Zeichenketten, Template-Literale samt
 * verschachtelter `${…}`, reguläre Ausdrücke und Kommentare sauber trennt.
 *
 * Der Scanner bleibt trotzdem vorsichtig: im Zweifel schweigt er. Wer eine
 * Fehlmeldung bekommt, trägt den Namen in `BEKANNTE_NAMEN` ein — und schaltet
 * NICHT die Prüfung ab. Wer hier etwas ändert, prüft danach, dass das saubere
 * Repo wieder null Befunde liefert; sonst gewöhnen sich alle an rotes Rauschen
 * und übersehen den echten Treffer.
 */

import { readFileSync } from "node:fs";

/** Was der Scanner nicht als Fehler zählen darf. */
const BEKANNTE_NAMEN = new Set([
  // JavaScript selbst
  "undefined", "NaN", "Infinity", "globalThis", "console", "Math", "JSON", "Object",
  "Array", "String", "Number", "Boolean", "Symbol", "BigInt", "Date", "RegExp", "Error",
  "TypeError", "RangeError", "ReferenceError", "SyntaxError", "Promise", "Map", "Set",
  "WeakMap", "WeakSet", "Proxy", "Reflect", "Intl", "parseInt", "parseFloat", "isNaN",
  "isFinite", "encodeURIComponent", "decodeURIComponent", "encodeURI", "decodeURI",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval", "queueMicrotask",
  "structuredClone", "AbortController", "TextEncoder", "TextDecoder", "URL", "Blob",
  "FormData", "Headers", "Request", "Response", "fetch", "atob", "btoa", "arguments",
  "requestAnimationFrame", "cancelAnimationFrame", "performance", "crypto", "process",
  // Browser
  "window", "document", "navigator", "location", "history", "localStorage",
  "sessionStorage", "Element", "HTMLElement", "Node", "NodeList", "Event",
  "CustomEvent", "MutationObserver", "ResizeObserver", "Image", "Audio", "DOMParser",
  "XMLSerializer", "getComputedStyle", "alert", "confirm", "prompt", "$", "jQuery",
  // Foundry VTT und Bibliotheken
  "game", "canvas", "ui", "CONFIG", "CONST", "Hooks", "foundry", "PIXI", "Roll",
  "ChatMessage", "Actor", "Actors", "Item", "Items", "Token", "TokenDocument",
  "Scene", "Scenes", "Folder", "Macro", "Macros", "Combat", "Combatant",
  "ActiveEffect", "MeasuredTemplate", "MeasuredTemplateDocument", "Application",
  "FormApplication", "DocumentSheet", "ActorSheet", "ItemSheet", "Dialog",
  "Handlebars", "FilePicker", "AudioHelper", "TextEditor", "SceneNavigation",
  "KeyboardManager", "loadTemplates", "renderTemplate", "mergeObject", "duplicate",
  "setProperty", "getProperty", "randomID", "fromUuid", "fromUuidSync",
  "isNewerVersion", "debounce", "libWrapper", "socketlib", "Sequence", "Sequencer",
  "saveDataToFile", "readTextFromFile", "DSAPixelTokens", "DSAPandaemonium",
  "loadTexture", "srcExists", "getTexture", "Color", "Ray", "PointSource",
]);

/** Schlüsselwörter, die wie Bezeichner aussehen, aber keine sind. */
const SCHLUESSELWOERTER = new Set([
  "const", "let", "var", "function", "class", "extends", "return", "if", "else",
  "for", "while", "do", "switch", "case", "default", "break", "continue", "new",
  "delete", "typeof", "instanceof", "in", "of", "this", "super", "null", "true",
  "false", "try", "catch", "finally", "throw", "async", "await", "yield", "import",
  "export", "from", "as", "static", "get", "set", "void", "with", "debugger",
]);

/**
 * Zerlegt den Quelltext in "Code" und "kein Code". Zurück kommt ein Text
 * gleicher Zeilenzahl, in dem alles, was nicht ausführbarer Code ist, durch
 * Leerzeichen ersetzt wurde — Zeilenumbrüche bleiben erhalten, damit die
 * Zeilennummern im Befund stimmen.
 *
 * Warum von Hand und nicht mit einem regulären Ausdruck: Template-Literale
 * dürfen `${ ... }` enthalten, darin wieder Template-Literale, darin wieder
 * `${ ... }`. Das ist geschachtelt und damit für einen regulären Ausdruck
 * grundsätzlich nicht entscheidbar.
 */
export function nurCode(quelle) {
  const aus = [];
  // Klammerzähler je offenem Template-Literal; -1 heisst "gerade im Textteil".
  const templateStapel = [];
  let i = 0;
  let letztesBedeutendes = "";

  const schreibe = (zeichen) => aus.push(zeichen === "\n" ? "\n" : zeichen);
  const verwerfe = (zeichen) => aus.push(zeichen === "\n" ? "\n" : " ");

  while (i < quelle.length) {
    const z = quelle[i];
    const zz = quelle.slice(i, i + 2);

    // Textteil eines Template-Literals — MUSS vor allem anderen geprüft werden.
    // Sonst startet ein Anführungszeichen im HTML eine Schein-Zeichenkette und
    // ein "https://" in einem Link einen Schein-Kommentar, der den Rest der
    // Zeile verschluckt. Genau daran scheiterte der erste Entwurf.
    if (templateStapel.length > 0 && templateStapel.at(-1) === -1) {
      if (z === "\\") { verwerfe(quelle[i++]); if (i < quelle.length) verwerfe(quelle[i++]); continue; }
      if (z === "`") { verwerfe(quelle[i++]); templateStapel.pop(); letztesBedeutendes = "`"; continue; }
      if (zz === "${") {
        verwerfe(quelle[i++]); verwerfe(quelle[i++]);
        templateStapel[templateStapel.length - 1] = 0; // ab hier zählt Code
        continue;
      }
      verwerfe(quelle[i++]);
      continue;
    }

    // Zeilenkommentar
    if (zz === "//") {
      while (i < quelle.length && quelle[i] !== "\n") verwerfe(quelle[i++]);
      continue;
    }
    // Blockkommentar
    if (zz === "/*") {
      verwerfe(quelle[i++]); verwerfe(quelle[i++]);
      while (i < quelle.length && quelle.slice(i, i + 2) !== "*/") verwerfe(quelle[i++]);
      if (i < quelle.length) { verwerfe(quelle[i++]); verwerfe(quelle[i++]); }
      continue;
    }
    // Einfache Zeichenkette
    if (z === '"' || z === "'") {
      const ende = z;
      verwerfe(quelle[i++]);
      while (i < quelle.length && quelle[i] !== ende) {
        if (quelle[i] === "\\") verwerfe(quelle[i++]);
        if (i < quelle.length) verwerfe(quelle[i++]);
      }
      if (i < quelle.length) verwerfe(quelle[i++]);
      letztesBedeutendes = ende;
      continue;
    }
    // Template-Literal beginnt
    if (z === "`") {
      verwerfe(quelle[i++]);
      templateStapel.push(-1);
      continue;
    }
    // Innerhalb eines ${ ... }: Klammern zählen, um das Ende zu finden
    if (templateStapel.length > 0 && templateStapel.at(-1) >= 0) {
      if (z === "{") templateStapel[templateStapel.length - 1]++;
      else if (z === "}") {
        if (templateStapel.at(-1) === 0) {
          verwerfe(quelle[i++]);
          templateStapel[templateStapel.length - 1] = -1; // zurück in den Textteil
          continue;
        }
        templateStapel[templateStapel.length - 1]--;
      }
      // fällt bewusst durch: der Inhalt IST Code und wird unten normal behandelt
    }
    // Regulärer Ausdruck — nur dort, wo ein Wert beginnen darf
    if (z === "/" && !/[\w$)\]]/.test(letztesBedeutendes)) {
      let j = i + 1, inKlasse = false, gueltig = false;
      while (j < quelle.length) {
        const c = quelle[j];
        if (c === "\\") { j += 2; continue; }
        if (c === "\n") break;
        if (c === "[") inKlasse = true;
        else if (c === "]") inKlasse = false;
        else if (c === "/" && !inKlasse) { gueltig = true; break; }
        j++;
      }
      if (gueltig) {
        while (i <= j) verwerfe(quelle[i++]);
        while (i < quelle.length && /[gimsuyd]/.test(quelle[i])) verwerfe(quelle[i++]);
        letztesBedeutendes = "/";
        continue;
      }
    }

    if (!/\s/.test(z)) letztesBedeutendes = z;
    schreibe(quelle[i++]);
  }
  return aus.join("");
}

/**
 * Sammelt alle Namen, die in dieser Datei gebunden werden. Bewusst grosszügig:
 * lieber eine Bindung zu viel erkennen (dann schweigt der Scanner) als eine zu
 * wenig (dann meldet er Unsinn).
 */
function gebundeneNamen(code) {
  const namen = new Set();
  const merke = (text) => {
    for (const t of String(text).match(/[A-Za-z_$][\w$]*/g) ?? []) namen.add(t);
  };

  // Zerlegungen: const { a, b } = …  /  const [x, y] = …
  for (const m of code.matchAll(/\b(?:const|let|var)\s+(\{[^}]*\}|\[[^\]]*\])/g)) merke(m[1]);
  // Einfache und mehrfache Deklarationen in einer Anweisung:
  //   let resultText, resultClass;      → beide Namen
  //   const ox = p.x, oy = p.y;         → beide Namen, nicht die rechte Seite
  // Deshalb wird der Deklarationskopf bis zum Semikolon herausgeschnitten und
  // darin nur genommen, was vor einem "=" oder Komma steht.
  for (const m of code.matchAll(/\b(?:const|let|var)\s+([^;\n]*)/g)) {
    const kopf = m[1];
    for (const d of kopf.matchAll(/(?:^|[,(])\s*([A-Za-z_$][\w$]*)\s*(?==(?![=>])|,|$)/g)) merke(d[1]);
    const ersterName = kopf.match(/^\s*([A-Za-z_$][\w$]*)/);
    if (ersterName) merke(ersterName[1]);
  }
  // Zusatzlauf: jede einzelne Deklaration, auch wenn sie in der Zeile einer
  // anderen steckt — z.B. const intVal = (n) => { const v = parseInt(...); ... }
  // Der Kopf-Schnitt oben endet am ersten Semikolon und übersieht das innere v.
  for (const m of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) merke(m[1]);
  // Klassenfelder: static ZONE_TABLE = [...]  /  static #zaehler = 0
  for (const m of code.matchAll(/^\s*static\s+([A-Za-z_$#][\w$]*)/gm)) merke(m[1]);
  // Zuweisungen an globalThis: globalThis.DSAImportXML = … wird später benutzt
  for (const m of code.matchAll(/globalThis\.([A-Za-z_$][\w$]*)/g)) merke(m[1]);
  for (const m of code.matchAll(/\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)?\s*\(([^()]*)\)/g)) { merke(m[1] ?? ""); merke(m[2]); }
  for (const m of code.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g)) merke(m[1]);
  for (const m of code.matchAll(/\(([^()]*)\)\s*=>/g)) merke(m[1]);
  for (const m of code.matchAll(/(?:^|[^\w$.])([A-Za-z_$][\w$]*)\s*=>/g)) merke(m[1]);
  for (const m of code.matchAll(/\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g)) merke(m[1]);
  for (const m of code.matchAll(/import\s+([^;]+?)\s+from/g)) merke(m[1]);
  // Methodendefinitionen: Name und Parameter sind beide gebunden.
  for (const m of code.matchAll(/^\s*(?:static\s+)?(?:async\s+)?(?:get\s+|set\s+)?([A-Za-z_$#][\w$]*)\s*\(([^()]*)\)\s*\{/gm)) {
    merke(m[1]); merke(m[2]);
  }
  return namen;
}

/**
 * Prüft eine Datei und liefert Befundtexte.
 * @param {string} pfad
 * @param {string} anzeigename - wie der Pfad im Bericht erscheinen soll
 */
export function unbekannteNamenFinden(pfad, anzeigename) {
  const code = nurCode(readFileSync(pfad, "utf8"));
  const gebunden = gebundeneNamen(code);
  const befunde = [];
  const gemeldet = new Set();

  code.split("\n").forEach((zeile, i) => {
    // Eigenschaftszugriffe, Objektschlüssel, benannte Argumente und private
    // Felder sind keine freien Bezeichner.
    const geputzt = zeile
      .replace(/(?:\?\.|\.)\s*[A-Za-z_$][\w$]*/g, ".")
      .replace(/[\p{L}_$][\p{L}\p{N}_$]*\s*:/gu, "schluessel:")
      .replace(/#[A-Za-z_$][\w$]*/g, "priv");

    for (const treffer of geputzt.matchAll(/(?<![\w$])[A-Za-z_$][\w$]*/g)) {
      const name = treffer[0];
      if (name === "schluessel" || name === "priv") continue;
      if (SCHLUESSELWOERTER.has(name)) continue;
      if (BEKANNTE_NAMEN.has(name)) continue;
      if (gebunden.has(name)) continue;
      if (gemeldet.has(name)) continue;
      gemeldet.add(name);
      befunde.push(`${anzeigename}:${i + 1} — "${name}" wird benutzt, ist aber in der Datei weder deklariert noch importiert.`);
    }
  });

  return befunde;
}
