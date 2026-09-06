/**
 * WOZU
 * ----
 * Zustandsverwaltung nach DSA 4.1. Ein Held kann in acht Zuständen stecken —
 * Schmerz, Betäubung, Verwirrung, Furcht, Paralyse, Belastung, Berauschung,
 * Entrückung — jeweils in Stufe 0 bis 4. Die Stufe zieht Punkte von Proben ab,
 * Stufe 4 macht handlungsunfähig.
 *
 * Bis v0.7.18 kannte das Modul davon keinen einzigen. Wer seinen Helden unter
 * Schmerzen würfeln liess, musste den Abzug im Kopf haben und von Hand in das
 * Modifikator-Feld tippen — bei jeder einzelnen Probe, den ganzen Abend lang.
 *
 * WO IM AUFBAU
 * ------------
 * - `scripts/sheet.mjs` liest `zustandsMalus()` bei jeder Probe und jedem
 *   Kampfwurf und schlägt ihn auf den Modifikator.
 * - `scripts/module.mjs` registriert die Hooks und den globalen Helfer
 *   `DSAZustaende(actor)`.
 * - Gespeichert wird am Aktor im Kennfeld `zustaende` als { schluessel: stufe }.
 *
 * WORAUF ACHTEN
 * -------------
 * Die Tabelle unten sagt je Zustand, WORAUF er wirkt. Der Kern der Regel — pro
 * Stufe ein Punkt Abzug, Stufe 4 handlungsunfähig — ist in DSA 4.1 einheitlich.
 * Der Geltungsbereich einzelner Zustände (welche Eigenschaften genau betroffen
 * sind) ist zwischen den Regelwerken teils unterschiedlich beschrieben; die
 * Tabelle ist deshalb bewusst an einer Stelle gebündelt und leicht zu ändern,
 * statt über den Code verteilt zu sein. Wer eine Stelle im Regelwerk zur Hand
 * hat, korrigiert genau hier — nicht in sheet.mjs.
 *
 * Und: `stufe` ist immer 0..4. Wer die Grenze aufweicht, bekommt negative
 * Proben-Boni durch die Hintertür.
 */

import { MODULE_ID, dsaChat } from "./config.mjs";

/** Kennfeld am Aktor, in dem die Stufen liegen. */
export const FLAG_ZUSTAENDE = "zustaende";

/** Höchste Stufe. Stufe 4 bedeutet immer: der Held kann nicht mehr handeln. */
export const MAX_STUFE = 4;

/**
 * Die acht Zustände.
 *
 * `betrifft`:
 *   "alle"    - jede Probe und jeder Kampfwurf
 *   [Liste]   - nur Proben, an denen mindestens eine dieser Eigenschaften
 *               beteiligt ist
 * `kampf`: wirkt der Abzug auch auf Attacke, Parade und Ausweichen?
 */
export const ZUSTAENDE = {
  schmerz: {
    label: "Schmerz",
    icon: "🩸",
    betrifft: "alle",
    kampf: true,
    stufe4: "Handlungsunfähig — der Held bricht zusammen.",
    hinweis: "Wunden verursachen Schmerz. Das Modul rechnet Wundmali getrennt; " +
             "wer beides doppelt zählt, zieht zweimal ab.",
  },
  betaeubung: {
    label: "Betäubung",
    icon: "💫",
    betrifft: "alle",
    kampf: true,
    stufe4: "Bewusstlos.",
  },
  verwirrung: {
    label: "Verwirrung",
    icon: "🌀",
    betrifft: ["MU", "KL", "IN", "CH"],
    kampf: false,
    stufe4: "Der Held handelt unkontrolliert; die Spielleitung entscheidet.",
  },
  furcht: {
    label: "Furcht",
    icon: "😱",
    betrifft: "alle",
    kampf: true,
    stufe4: "Starr vor Schreck — keine Handlung möglich.",
  },
  paralyse: {
    label: "Paralyse",
    icon: "🧊",
    betrifft: ["FF", "GE", "KO", "KK"],
    kampf: true,
    stufe4: "Vollständig bewegungsunfähig.",
  },
  belastung: {
    label: "Belastung",
    icon: "🎒",
    betrifft: ["FF", "GE", "KO", "KK"],
    kampf: true,
    stufe4: "Der Held bricht unter der Last zusammen.",
  },
  berauschung: {
    label: "Berauschung",
    icon: "🍺",
    betrifft: ["MU", "KL", "IN", "CH", "FF", "GE"],
    kampf: true,
    stufe4: "Bewusstlos.",
  },
  entrueckung: {
    label: "Entrückung",
    icon: "✨",
    betrifft: ["KL", "IN"],
    kampf: false,
    stufe4: "Vollständig entrückt — nicht ansprechbar.",
  },
};

/**
 * Liest die Zustände eines Aktors.
 * @param {Actor} actor
 * @returns {Record<string, number>} nur Zustände mit Stufe > 0
 */
export function aktiveZustaende(actor) {
  const roh = actor?.getFlag?.(MODULE_ID, FLAG_ZUSTAENDE) ?? {};
  const aus = {};
  for (const [schluessel, stufe] of Object.entries(roh)) {
    if (!ZUSTAENDE[schluessel]) continue;
    const s = stufeBegrenzen(stufe);
    if (s > 0) aus[schluessel] = s;
  }
  return aus;
}

/**
 * Hält eine Stufe im gültigen Bereich 0..4 und macht aus Unsinn eine 0.
 * @param {*} wert
 * @returns {number}
 */
export function stufeBegrenzen(wert) {
  const n = Math.trunc(Number(wert));
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_STUFE, Math.max(0, n));
}

/**
 * Berechnet den Gesamt-Abzug für eine Probe.
 *
 * @param {Record<string, number>} zustaende - { schluessel: stufe }
 * @param {object} opts
 * @param {string[]} [opts.attribute] - Eigenschaften der Probe, z.B. ["MU","IN","GE"]
 * @param {boolean} [opts.kampf] - handelt es sich um Attacke/Parade/Ausweichen?
 * @returns {number} Abzug als POSITIVE Zahl (0 = kein Abzug)
 */
export function zustandsMalus(zustaende, opts = {}) {
  const { attribute = null, kampf = false } = opts;
  let summe = 0;
  for (const [schluessel, stufeRoh] of Object.entries(zustaende ?? {})) {
    const eintrag = ZUSTAENDE[schluessel];
    if (!eintrag) continue;
    const stufe = stufeBegrenzen(stufeRoh);
    if (stufe <= 0) continue;

    if (kampf) {
      // Im Kampf zählt nur, ob der Zustand überhaupt auf Kampfwerte wirkt —
      // Attacke und Parade hängen an keiner einzelnen Eigenschaft.
      if (eintrag.kampf) summe += stufe;
      continue;
    }

    if (eintrag.betrifft === "alle") {
      summe += stufe;
      continue;
    }
    // Eigenschaftsgebundener Zustand: er greift, sobald eine der betroffenen
    // Eigenschaften an der Probe beteiligt ist. Ohne Angabe der Eigenschaften
    // wird er NICHT angerechnet — lieber ein Abzug zu wenig als ein erfundener.
    if (Array.isArray(attribute) && attribute.some(a => eintrag.betrifft.includes(a))) {
      summe += stufe;
    }
  }
  return summe;
}

/**
 * Ist der Held handlungsunfähig? Das ist bei Stufe 4 in JEDEM Zustand der Fall.
 * @param {Record<string, number>} zustaende
 * @returns {{ handlungsunfaehig: boolean, gruende: string[] }}
 */
export function handlungsfaehigkeit(zustaende) {
  const gruende = [];
  for (const [schluessel, stufe] of Object.entries(zustaende ?? {})) {
    const eintrag = ZUSTAENDE[schluessel];
    if (!eintrag) continue;
    if (stufeBegrenzen(stufe) >= MAX_STUFE) {
      gruende.push(`${eintrag.label} ${MAX_STUFE}: ${eintrag.stufe4}`);
    }
  }
  return { handlungsunfaehig: gruende.length > 0, gruende };
}

/**
 * Setzt einen Zustand auf eine Stufe. Stufe 0 entfernt ihn.
 *
 * @param {Actor} actor
 * @param {string} schluessel
 * @param {number} stufe
 */
export async function setzeZustand(actor, schluessel, stufe) {
  if (!actor || !ZUSTAENDE[schluessel]) return null;
  const neu = { ...(actor.getFlag(MODULE_ID, FLAG_ZUSTAENDE) ?? {}) };
  const wert = stufeBegrenzen(stufe);
  if (wert === 0) delete neu[schluessel];
  else neu[schluessel] = wert;
  await actor.setFlag(MODULE_ID, FLAG_ZUSTAENDE, neu);
  return neu;
}

/** Entfernt alle Zustände — für "Held ist wieder wohlauf". */
export async function alleZustaendeLoeschen(actor) {
  if (!actor) return;
  await actor.setFlag(MODULE_ID, FLAG_ZUSTAENDE, {});
}

/**
 * Baut die Zeile, die unter einer Probe im Chat steht — oder einen leeren Text,
 * wenn kein Zustand wirkt.
 *
 * @param {Record<string, number>} zustaende
 * @param {number} malus - bereits berechneter Abzug
 * @returns {string} HTML
 */
export function zustandsZeile(zustaende, malus) {
  const teile = Object.entries(zustaende ?? {})
    .filter(([k]) => ZUSTAENDE[k])
    .map(([k, s]) => `${ZUSTAENDE[k].icon} ${ZUSTAENDE[k].label} ${s}`);
  if (!teile.length) return "";
  const abzug = malus > 0 ? ` · Abzug −${malus}` : " · kein Abzug auf diese Probe";
  return `<div class="dsa-mod-hint" style="color:#c98">${teile.join(" · ")}${abzug}</div>`;
}

// ─── Bedienung ──────────────────────────────────────────────────────────────

/**
 * Öffnet das Zustandsfenster für einen Aktor: acht Regler, sofort wirksam.
 * @param {Actor} actor
 */
export function zeigeZustandsDialog(actor) {
  if (!actor) {
    ui.notifications.warn("[DSA Pixel] Kein Held ausgewählt.");
    return;
  }
  const aktuell = aktiveZustaende(actor);

  const zeilen = Object.entries(ZUSTAENDE).map(([schluessel, z]) => {
    const stufe = aktuell[schluessel] ?? 0;
    const knoepfe = [0, 1, 2, 3, 4].map(s => `
      <button type="button" class="dsa-zustand-stufe ${s === stufe ? "aktiv" : ""}"
        data-zustand="${schluessel}" data-stufe="${s}"
        style="width:26px;height:26px;font-family:'VT323',monospace;font-size:15px;cursor:pointer;
               background:${s === stufe ? "#e94560" : "rgba(0,0,0,0.4)"};
               border:2px solid ${s === stufe ? "#e94560" : "#3a3a5e"};
               color:${s === stufe ? "#fff" : "#bbb"}">${s}</button>`).join("");
    return `
      <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:3px 0">
        <div style="font-family:'VT323',monospace;font-size:16px;color:#e0c0a0" title="${z.stufe4}">
          ${z.icon} ${z.label}
        </div>
        <div style="display:flex;gap:3px">${knoepfe}</div>
      </div>`;
  }).join("");

  new Dialog({
    title: `Zustände — ${actor.name}`,
    content: `
      <div style="padding:6px;background:linear-gradient(180deg,#12121c,#0a0a12)">
        <div style="font-size:12px;color:#889;font-family:'VT323',monospace;margin-bottom:6px">
          Pro Stufe ein Punkt Abzug. Stufe 4 heisst handlungsunfähig.
        </div>
        ${zeilen}
      </div>`,
    buttons: {
      klar: {
        label: "Alle aufheben",
        callback: async () => {
          await alleZustaendeLoeschen(actor);
          ui.notifications.info(`[DSA Pixel] ${actor.name}: alle Zustände aufgehoben.`);
        },
      },
      fertig: { label: "Fertig" },
    },
    default: "fertig",
    render: (html) => {
      html.find(".dsa-zustand-stufe").on("click", async (ev) => {
        const el = ev.currentTarget;
        await setzeZustand(actor, el.dataset.zustand, Number(el.dataset.stufe));
        // Fenster neu aufbauen, damit die Auswahl sichtbar bleibt.
        html.closest(".app").find(".dialog-button.fertig").trigger("click");
        zeigeZustandsDialog(actor);
      });
    },
  }, { width: 340 }).render(true);
}

/**
 * Meldet den aktuellen Zustand eines Helden im Chat — für die Spielleitung,
 * damit die Runde weiss, woran sie ist.
 */
export async function zustandsBericht(actor) {
  const zustaende = aktiveZustaende(actor);
  const { handlungsunfaehig, gruende } = handlungsfaehigkeit(zustaende);
  const liste = Object.entries(zustaende)
    .map(([k, s]) => `<div>${ZUSTAENDE[k].icon} ${ZUSTAENDE[k].label} — Stufe ${s} (−${s})</div>`)
    .join("");

  await dsaChat({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="dsa-pixel-chat">
      <div class="chat-title">Zustände — ${actor.name}</div>
      ${liste || `<div style="color:#8a8">Keine Zustände.</div>`}
      ${handlungsunfaehig
        ? `<div class="result-line result-fail">HANDLUNGSUNFÄHIG<br>
             <span style="font-size:12px">${gruende.join("<br>")}</span></div>`
        : ""}
    </div>`,
  });
}

export function registerZustaende() {
  globalThis.DSAZustaende = (actor) => {
    const ziel = actor
      ?? canvas.tokens?.controlled?.[0]?.actor
      ?? game.user?.character;
    zeigeZustandsDialog(ziel);
  };
  console.log(`[${MODULE_ID}] Zustände registriert — DSAZustaende(actor)`);
}
