/**
 * WOZU
 * ----
 * Sammelproben nach DSA 4.1. Manche Aufgaben lassen sich nicht mit einem Wurf
 * erledigen — ein Ritual vorbereiten, eine Rüstung schmieden, eine Bibliothek
 * durchforsten, einen Verletzten über Tage pflegen. Dafür würfelt der Held
 * mehrfach; die übrig gebliebenen Punkte jeder Probe werden addiert, bis ein
 * Zielwert erreicht ist.
 *
 * Von Hand ist das mühsam: jemand muss die Teilergebnisse mitschreiben, die
 * verstrichene Zeit im Blick behalten und wissen, wann Schluss ist. Genau das
 * macht diese Datei.
 *
 * WO IM AUFBAU
 * ------------
 * - Zustand lebt am Aktor im Kennfeld `sammelproben` (überlebt also einen
 *   Neustart und ist auch am nächsten Spielabend noch da).
 * - `scripts/module.mjs` registriert den globalen Helfer `DSASammelprobe(actor)`.
 * - Gewürfelt wird über `resolveProbe`/`applyCrit` aus config.mjs — dieselbe
 *   Mechanik wie bei jeder anderen Probe, inklusive Deckelung der TaP* und
 *   Behandlung von Patzern.
 *
 * WORAUF ACHTEN
 * -------------
 * Was bei einem Patzer passiert, ist zwischen Spielrunden unterschiedlich
 * geregelt. Deshalb steht es hier als Einstellung (`patzerRegel`) und nicht als
 * feste Annahme im Code: "abbruch" beendet die Sammelprobe, "verlust" kostet
 * die bisher gesammelten Punkte, "weiter" zählt sie nur als Fehlversuch. Wer
 * eine andere Hausregel hat, ergänzt sie hier — nicht in der Bedienung.
 */

import {
  MODULE_ID, resolveProbe, checkCritical, applyCrit, dsaChat,
} from "./config.mjs";
import { aktiveZustaende, zustandsMalus } from "./zustaende.mjs";

/** Kennfeld am Aktor. */
export const FLAG_SAMMELPROBEN = "sammelproben";

/** Was ein Patzer mit der bisherigen Arbeit macht. */
export const PATZER_REGELN = {
  abbruch: "Die Sammelprobe ist gescheitert und wird beendet.",
  verlust: "Die bisher gesammelten Punkte gehen verloren, es darf weitergehen.",
  weiter:  "Der Versuch zählt als Fehlschlag, die Punkte bleiben.",
};

/**
 * Legt eine neue Sammelprobe an.
 *
 * @param {object} opts
 * @param {string} opts.name - was da eigentlich getan wird
 * @param {string} opts.talent - Talentname (nur für die Anzeige)
 * @param {string[]} opts.attribute - die drei Eigenschaften, z.B. ["KL","FF","FF"]
 * @param {number} opts.taw - Talentwert
 * @param {number} opts.ziel - benötigte Gesamtpunkte
 * @param {number} [opts.maxVersuche] - 0 = unbegrenzt
 * @param {number} [opts.erschwernis]
 * @param {string} [opts.intervall] - Text, z.B. "1 Stunde"
 * @param {string} [opts.patzerRegel] - Schlüssel aus PATZER_REGELN
 * @returns {object} neuer Zustand
 */
export function neueSammelprobe(opts) {
  return {
    id: `sp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name: opts.name ?? "Sammelprobe",
    talent: opts.talent ?? "",
    attribute: Array.isArray(opts.attribute) ? opts.attribute.slice(0, 3) : ["KL", "KL", "KL"],
    taw: Number(opts.taw) || 0,
    ziel: Math.max(1, Number(opts.ziel) || 1),
    maxVersuche: Math.max(0, Number(opts.maxVersuche) || 0),
    erschwernis: Number(opts.erschwernis) || 0,
    intervall: opts.intervall ?? "",
    patzerRegel: PATZER_REGELN[opts.patzerRegel] ? opts.patzerRegel : "abbruch",
    gesammelt: 0,
    versuche: 0,
    verlauf: [],          // je Versuch: { wuerfel, tap, gesammelt, patzer }
    abgeschlossen: false,
    gescheitert: false,
  };
}

/**
 * Verrechnet einen Wurf mit dem bisherigen Stand.
 *
 * Reine Rechnung ohne Würfel und ohne Foundry — die Würfel kommen von aussen.
 * Nur so lässt sich das Zusammenspiel aus Zielwert, Versuchsgrenze und
 * Patzerregel überhaupt prüfen.
 *
 * @param {object} stand - Zustand aus neueSammelprobe
 * @param {number[]} wuerfel - drei Würfelergebnisse
 * @param {number} [zusatzErschwernis] - z.B. Abzug durch Zustände
 * @returns {object} NEUER Zustand (der alte bleibt unangetastet)
 */
export function versuchVerrechnen(stand, wuerfel, zusatzErschwernis = 0) {
  if (stand.abgeschlossen || stand.gescheitert) return stand;

  const attribute = stand.attribute.map(a => Number(a) || 0);
  const gesamtErschwernis = (Number(stand.erschwernis) || 0) + (Number(zusatzErschwernis) || 0);
  const roh = resolveProbe(wuerfel, attribute, stand.taw, gesamtErschwernis);
  const crit = checkCritical(wuerfel);
  const ergebnis = applyCrit(roh, crit, stand.taw);

  let gesammelt = stand.gesammelt;
  let gescheitert = false;

  if (crit.patzer) {
    if (stand.patzerRegel === "abbruch") gescheitert = true;
    else if (stand.patzerRegel === "verlust") gesammelt = 0;
    // "weiter": nichts passiert ausser dem Fehlversuch
  } else if (ergebnis.success) {
    gesammelt += ergebnis.tapStar;
  }
  // Eine misslungene Probe ohne Patzer bringt schlicht keine Punkte.

  const versuche = stand.versuche + 1;
  const abgeschlossen = !gescheitert && gesammelt >= stand.ziel;
  const versucheAufgebraucht =
    stand.maxVersuche > 0 && versuche >= stand.maxVersuche && !abgeschlossen;

  return {
    ...stand,
    gesammelt,
    versuche,
    abgeschlossen,
    gescheitert: gescheitert || versucheAufgebraucht,
    verlauf: [
      ...stand.verlauf,
      {
        wuerfel: [...wuerfel],
        tap: crit.patzer ? 0 : (ergebnis.success ? ergebnis.tapStar : 0),
        gesammelt,
        patzer: crit.patzer,
        gluecklich: crit.gluecklich,
      },
    ],
  };
}

/**
 * Wie weit ist die Sache? Liefert alles, was die Anzeige braucht.
 * @param {object} stand
 */
export function fortschritt(stand) {
  const ziel = Math.max(1, stand?.ziel ?? 1);
  const gesammelt = Math.max(0, stand?.gesammelt ?? 0);
  return {
    gesammelt,
    ziel,
    prozent: Math.min(100, Math.round((gesammelt / ziel) * 100)),
    fehlend: Math.max(0, ziel - gesammelt),
    versuche: stand?.versuche ?? 0,
    verbleibendeVersuche: stand?.maxVersuche > 0
      ? Math.max(0, stand.maxVersuche - (stand.versuche ?? 0))
      : null,
  };
}

// ─── Speicherung am Aktor ───────────────────────────────────────────────────

/** Alle laufenden Sammelproben eines Aktors. */
export function sammelprobenVon(actor) {
  return actor?.getFlag?.(MODULE_ID, FLAG_SAMMELPROBEN) ?? [];
}

async function speichern(actor, liste) {
  await actor.setFlag(MODULE_ID, FLAG_SAMMELPROBEN, liste);
}

/** Legt eine Sammelprobe am Aktor an und gibt sie zurück. */
export async function sammelprobeAnlegen(actor, opts) {
  const stand = neueSammelprobe(opts);
  await speichern(actor, [...sammelprobenVon(actor), stand]);
  return stand;
}

/** Entfernt eine Sammelprobe. */
export async function sammelprobeEntfernen(actor, id) {
  await speichern(actor, sammelprobenVon(actor).filter(s => s.id !== id));
}

/**
 * Würfelt einen Versuch, speichert den neuen Stand und meldet ihn im Chat.
 * @returns {Promise<object|null>} neuer Stand
 */
export async function versuchWuerfeln(actor, id) {
  const liste = sammelprobenVon(actor);
  const stand = liste.find(s => s.id === id);
  if (!stand) {
    ui.notifications.warn("[DSA Pixel] Sammelprobe nicht gefunden.");
    return null;
  }
  if (stand.abgeschlossen || stand.gescheitert) {
    ui.notifications.info("[DSA Pixel] Diese Sammelprobe ist bereits beendet.");
    return stand;
  }

  const wurf = new Roll("3d20");
  await wurf.evaluate();
  const wuerfel = wurf.terms[0].results.map(r => r.result);

  // Eigenschaftswerte des Helden einsetzen — im gespeicherten Stand stehen die
  // Namen, damit eine spaeter gesteigerte Eigenschaft auch wirkt.
  const werte = stand.attribute.map(a => Number(actor.system?.[a]?.value ?? 10));
  const zMalus = zustandsMalus(aktiveZustaende(actor), { attribute: stand.attribute });
  const neu = versuchVerrechnen({ ...stand, attribute: werte }, wuerfel, zMalus);
  // Die Namen wieder einsetzen — gerechnet wurde mit den Werten.
  neu.attribute = stand.attribute;

  await speichern(actor, liste.map(s => (s.id === id ? neu : s)));

  const f = fortschritt(neu);
  const letzte = neu.verlauf.at(-1);
  const balken = "█".repeat(Math.round(f.prozent / 5)).padEnd(20, "░");
  const wuerfelHtml = wuerfel.map((d, i) => {
    const cls = d === 1 ? "crit" : d === 20 ? "fumble" : (d > werte[i] ? "fail" : "success");
    return `<div class="die ${cls}" title="${stand.attribute[i]} ${werte[i]}">${d}</div>`;
  }).join("");

  let ergebnisZeile;
  if (neu.abgeschlossen) {
    ergebnisZeile = `<div class="result-line result-crit">FERTIG — ${f.gesammelt}/${f.ziel} nach ${f.versuche} Versuch${f.versuche === 1 ? "" : "en"}</div>`;
  } else if (neu.gescheitert) {
    const grund = letzte?.patzer ? "Patzer" : "keine Versuche mehr";
    ergebnisZeile = `<div class="result-line result-fail">GESCHEITERT (${grund})</div>`;
  } else {
    ergebnisZeile = `<div class="result-line ${letzte?.tap > 0 ? "result-success" : "result-fail"}">
      ${letzte?.patzer ? "PATZER!" : letzte?.tap > 0 ? `+${letzte.tap} TaP*` : "kein Fortschritt"}
    </div>`;
  }

  await dsaChat({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="dsa-pixel-chat">
      <div class="chat-title">Sammelprobe: ${neu.name}</div>
      <div class="dsa-mod-hint">${neu.talent || neu.attribute.join("/")} ${neu.taw}
        ${neu.erschwernis ? ` · Erschwernis ${neu.erschwernis}` : ""}
        ${zMalus ? ` · Zustände −${zMalus}` : ""}
        ${neu.intervall ? ` · je ${neu.intervall}` : ""}</div>
      <div class="dice-row">${wuerfelHtml}</div>
      ${ergebnisZeile}
      <div style="text-align:center;font-family:'VT323',monospace;font-size:15px;color:#c9a">
        ${balken} ${f.gesammelt}/${f.ziel}
      </div>
      ${f.verbleibendeVersuche !== null && !neu.abgeschlossen && !neu.gescheitert
        ? `<div style="text-align:center;font-size:12px;color:#889">noch ${f.verbleibendeVersuche} Versuch${f.verbleibendeVersuche === 1 ? "" : "e"}</div>`
        : ""}
    </div>`,
  }, {
    success: neu.abgeschlossen,
    fumble: !!letzte?.patzer,
    type: "sammelprobe",
  });

  return neu;
}

// ─── Bedienung ──────────────────────────────────────────────────────────────

const TALENT_VORLAGEN = [
  { name: "Ritual vorbereiten",     talent: "Ritualkenntnis", attribute: ["KL", "KL", "IN"], ziel: 30, intervall: "1 Stunde" },
  { name: "Waffe schmieden",        talent: "Grobschmied",    attribute: ["FF", "KK", "KK"], ziel: 50, intervall: "1 Tag" },
  { name: "Bibliothek durchsuchen", talent: "Gelehrtenwissen",attribute: ["KL", "KL", "IN"], ziel: 21, intervall: "1 Stunde" },
  { name: "Verletzten pflegen",     talent: "Heilkunde Wunden", attribute: ["MU", "CH", "FF"], ziel: 15, intervall: "1 Tag" },
  { name: "Spur verfolgen",         talent: "Fährtensuchen",  attribute: ["KL", "IN", "IN"], ziel: 12, intervall: "10 Minuten" },
];

/** Fenster: laufende Sammelproben und ein Formular für eine neue. */
export function zeigeSammelprobenDialog(actor) {
  if (!actor) {
    ui.notifications.warn("[DSA Pixel] Kein Held ausgewählt.");
    return;
  }
  const laufende = sammelprobenVon(actor);

  const laufendeHtml = laufende.length ? laufende.map(s => {
    const f = fortschritt(s);
    const balken = "█".repeat(Math.round(f.prozent / 5)).padEnd(20, "░");
    const zustandText = s.abgeschlossen ? "✔ fertig" : s.gescheitert ? "✘ gescheitert" : `${f.fehlend} fehlen`;
    return `
      <div style="border:1px solid #3a3a5e;border-radius:3px;padding:5px;margin-bottom:4px">
        <div style="display:flex;justify-content:space-between;font-family:'VT323',monospace;font-size:15px;color:#e0c0a0">
          <span>${s.name}</span><span style="color:#889">${zustandText}</span>
        </div>
        <div style="font-family:'VT323',monospace;color:#c9a;font-size:14px">${balken} ${f.gesammelt}/${f.ziel}</div>
        <div style="display:flex;gap:4px;margin-top:3px">
          ${s.abgeschlossen || s.gescheitert ? "" : `
            <button type="button" class="sp-wurf" data-id="${s.id}" style="flex:1;cursor:pointer">Versuch würfeln</button>`}
          <button type="button" class="sp-weg" data-id="${s.id}" style="cursor:pointer">Entfernen</button>
        </div>
      </div>`;
  }).join("") : `<div style="color:#889;font-family:'VT323',monospace">Keine laufende Sammelprobe.</div>`;

  const vorlagenHtml = TALENT_VORLAGEN.map((v, i) =>
    `<option value="${i}">${v.name} (${v.talent}, Ziel ${v.ziel})</option>`).join("");

  new Dialog({
    title: `Sammelproben — ${actor.name}`,
    content: `
      <div style="padding:6px">
        <div style="font-family:'VT323',monospace;font-size:16px;color:#e0c0a0;margin-bottom:4px">Laufend</div>
        ${laufendeHtml}
        <hr style="border-color:#3a3a5e;margin:8px 0">
        <div style="font-family:'VT323',monospace;font-size:16px;color:#e0c0a0;margin-bottom:4px">Neu anlegen</div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 8px;align-items:center;font-family:'VT323',monospace;font-size:14px">
          <label>Vorlage</label><select id="sp-vorlage">${vorlagenHtml}</select>
          <label>Name</label><input id="sp-name" type="text" value="${TALENT_VORLAGEN[0].name}">
          <label>Talentwert</label><input id="sp-taw" type="number" value="7" min="0">
          <label>Zielpunkte</label><input id="sp-ziel" type="number" value="${TALENT_VORLAGEN[0].ziel}" min="1">
          <label>Erschwernis</label><input id="sp-mod" type="number" value="0">
          <label>Max. Versuche</label><input id="sp-max" type="number" value="0" min="0" title="0 = unbegrenzt">
          <label>Bei Patzer</label>
          <select id="sp-patzer">
            <option value="abbruch">Sammelprobe gescheitert</option>
            <option value="verlust">Punkte verloren, weiter</option>
            <option value="weiter">nur Fehlversuch</option>
          </select>
        </div>
      </div>`,
    buttons: {
      anlegen: {
        label: "Anlegen",
        callback: async (html) => {
          const v = TALENT_VORLAGEN[Number(html.find("#sp-vorlage").val()) || 0];
          await sammelprobeAnlegen(actor, {
            name: html.find("#sp-name").val() || v.name,
            talent: v.talent,
            attribute: v.attribute,
            taw: parseInt(html.find("#sp-taw").val()) || 0,
            ziel: parseInt(html.find("#sp-ziel").val()) || v.ziel,
            erschwernis: parseInt(html.find("#sp-mod").val()) || 0,
            maxVersuche: parseInt(html.find("#sp-max").val()) || 0,
            intervall: v.intervall,
            patzerRegel: html.find("#sp-patzer").val(),
          });
          zeigeSammelprobenDialog(actor);
        },
      },
      schliessen: { label: "Schliessen" },
    },
    default: "schliessen",
    render: (html) => {
      html.find("#sp-vorlage").on("change", (e) => {
        const v = TALENT_VORLAGEN[Number(e.currentTarget.value) || 0];
        html.find("#sp-name").val(v.name);
        html.find("#sp-ziel").val(v.ziel);
      });
      html.find(".sp-wurf").on("click", async (e) => {
        await versuchWuerfeln(actor, e.currentTarget.dataset.id);
        html.closest(".app").find(".dialog-button.schliessen").trigger("click");
        zeigeSammelprobenDialog(actor);
      });
      html.find(".sp-weg").on("click", async (e) => {
        await sammelprobeEntfernen(actor, e.currentTarget.dataset.id);
        html.closest(".app").find(".dialog-button.schliessen").trigger("click");
        zeigeSammelprobenDialog(actor);
      });
    },
  }, { width: 420 }).render(true);
}

export function registerSammelproben() {
  globalThis.DSASammelprobe = (actor) => {
    const ziel = actor
      ?? canvas.tokens?.controlled?.[0]?.actor
      ?? game.user?.character;
    zeigeSammelprobenDialog(ziel);
  };
  console.log(`[${MODULE_ID}] Sammelproben registriert — DSASammelprobe(actor)`);
}
