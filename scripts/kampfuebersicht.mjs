/**
 * WOZU
 * ----
 * Eine Tafel für die Spielleitung: Wer steht im Kampf, wie schlecht geht es
 * ihm, und was hindert ihn gerade?
 *
 * Das Modul führt inzwischen einiges an Zustand mit — Lebensenergie, Ausdauer,
 * Wunden je Körperzone, die acht Zustände, anhaltende Liturgie-Effekte. Nur sah
 * man davon nichts an einer Stelle zusammen. Wer wissen wollte, ob der Ork noch
 * kämpfen kann, musste seinen Bogen öffnen; wer wissen wollte, wie es der
 * ganzen Runde geht, öffnete acht Bögen.
 *
 * WO IM AUFBAU
 * ------------
 * - Liest ausschliesslich. Kein Wurf, keine Änderung, kein Schreibvorgang —
 *   deshalb ist sie auch für Spieler unbedenklich, zeigt ihnen aber nur, was
 *   sie ohnehin sehen dürfen.
 * - `scripts/module.mjs` registriert den globalen Helfer `DSAKampfuebersicht()`.
 * - Baut auf `zustaende.mjs` (Zustände) und `config.mjs` (Wundschwellen,
 *   Lebensenergie-Status) auf.
 *
 * WORAUF ACHTEN
 * -------------
 * Die Tafel zeigt fremde Werte. Ein Spieler soll nicht die Lebensenergie eines
 * NSC ablesen können, den die Spielleitung verdeckt hält — deshalb prüft
 * `sichtbarFuer()`, ob der Betrachter den Aktor überhaupt beobachten darf, und
 * zeigt sonst nur den Namen. Wer diese Prüfung entfernt, macht aus einer
 * Übersicht einen Spickzettel.
 */

import { MODULE_ID, getWoundThresholds, getLepStatus, ALL_ZONES, ZONE_LABELS } from "./config.mjs";
import { aktiveZustaende, zustandsMalus, handlungsfaehigkeit, ZUSTAENDE } from "./zustaende.mjs";

/**
 * Darf der aktuelle Benutzer die Werte dieses Aktors sehen?
 * Spielleitung immer; sonst nur ab Beobachter-Recht.
 */
export function sichtbarFuer(actor, user = game.user) {
  if (!actor) return false;
  if (user?.isGM) return true;
  const stufe = actor.ownership?.[user?.id] ?? actor.ownership?.default ?? 0;
  const beobachter = CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2;
  return stufe >= beobachter;
}

/**
 * Fasst einen Kämpfer in genau die Zahlen zusammen, die auf die Tafel gehören.
 *
 * Reine Rechnung — kein DOM, kein Foundry-Fenster. Nur deshalb lässt sich der
 * interessante Teil (Zustände, Wunden, Handlungsfähigkeit) prüfen.
 *
 * @param {Actor} actor
 * @returns {object}
 */
export function kaempferZeile(actor) {
  const sys = actor?.system ?? {};
  const lep = Number(sys.LeP?.value ?? 0);
  const lepMax = Number(sys.LeP?.max ?? 0);
  const aup = Number(sys.AuP?.value ?? 0);
  const aupMax = Number(sys.AuP?.max ?? 0);
  const asp = Number(sys.AsP?.value ?? 0);
  const aspMax = Number(sys.AsP?.max ?? 0);
  const ko = Number(sys.KO?.value ?? 10);

  const wundenJeZone = actor?.getFlag?.(MODULE_ID, "wounds") ?? {};
  const wundenGesamt = Object.values(wundenJeZone).reduce((s, w) => s + (Number(w) || 0), 0);
  const zonenMitWunden = ALL_ZONES
    .filter(z => (wundenJeZone[z] ?? 0) > 0)
    .map(z => ({ zone: z, label: ZONE_LABELS[z] ?? z, anzahl: wundenJeZone[z] }));

  const zustaende = aktiveZustaende(actor);
  const { handlungsunfaehig, gruende } = handlungsfaehigkeit(zustaende);

  return {
    id: actor?.id ?? null,
    name: actor?.name ?? "?",
    lep, lepMax, aup, aupMax, asp, aspMax,
    lepAnteil: lepMax > 0 ? Math.max(0, Math.min(100, Math.round((lep / lepMax) * 100))) : null,
    aupAnteil: aupMax > 0 ? Math.max(0, Math.min(100, Math.round((aup / aupMax) * 100))) : null,
    wundschwellen: getWoundThresholds(ko),
    wundenGesamt,
    zonenMitWunden,
    // Wundmalus nach WdS S.57: zwei Punkte je Wunde auf alle Proben.
    wundmalus: wundenGesamt * 2,
    zustaende,
    zustandsMalusProbe: zustandsMalus(zustaende),
    zustandsMalusKampf: zustandsMalus(zustaende, { kampf: true }),
    lepStatus: getLepStatus(lep, ko, {}),
    handlungsunfaehig,
    gruende,
  };
}

/** Farbe für einen Balken — grün, gelb, rot. */
function balkenFarbe(anteil) {
  if (anteil === null) return "#555";
  if (anteil > 60) return "#4caf50";
  if (anteil > 25) return "#ffb300";
  return "#e94560";
}

function balken(anteil, wert, max, kuerzel) {
  if (max <= 0) return `<span style="color:#556">${kuerzel} —</span>`;
  const breite = anteil ?? 0;
  return `
    <div style="display:flex;align-items:center;gap:4px">
      <span style="color:#889;font-size:11px;width:24px">${kuerzel}</span>
      <div style="flex:1;height:9px;background:rgba(0,0,0,0.5);border:1px solid #333;border-radius:2px;overflow:hidden">
        <div style="width:${breite}%;height:100%;background:${balkenFarbe(anteil)}"></div>
      </div>
      <span style="font-family:'VT323',monospace;font-size:13px;color:#ccc;width:52px;text-align:right">${wert}/${max}</span>
    </div>`;
}

/** Baut die HTML-Zeile eines Kämpfers. */
function zeileHtml(actor) {
  if (!sichtbarFuer(actor)) {
    return `<div style="padding:5px;border:1px solid #2a2a3e;border-radius:3px;margin-bottom:4px;
                        font-family:'VT323',monospace;font-size:15px;color:#667">
      ${actor?.name ?? "?"} <span style="font-size:12px">— verdeckt</span>
    </div>`;
  }

  const d = kaempferZeile(actor);
  const zustandsChips = Object.entries(d.zustaende)
    .map(([k, s]) => `<span style="background:rgba(233,69,96,0.18);border:1px solid rgba(233,69,96,0.5);
      border-radius:3px;padding:0 4px;font-size:12px;color:#e9a">${ZUSTAENDE[k].icon} ${ZUSTAENDE[k].label} ${s}</span>`)
    .join(" ");

  const wundenText = d.wundenGesamt > 0
    ? `<span style="color:#e94560;font-size:12px">${"💀".repeat(Math.min(5, d.wundenGesamt))}
        ${d.wundenGesamt} Wunde${d.wundenGesamt === 1 ? "" : "n"}
        (${d.zonenMitWunden.map(z => `${z.label} ${z.anzahl}`).join(", ")})
        · alle Proben −${d.wundmalus}</span>`
    : "";

  const abzugText = (d.zustandsMalusProbe > 0 || d.zustandsMalusKampf > 0)
    ? `<span style="color:#c98;font-size:12px">Zustände: Proben −${d.zustandsMalusProbe}, Kampf −${d.zustandsMalusKampf}</span>`
    : "";

  const warnung = d.handlungsunfaehig
    ? `<div style="color:#ff4444;font-weight:bold;font-size:13px">⛔ HANDLUNGSUNFÄHIG — ${d.gruende.join("; ")}</div>`
    : d.lepStatus.label
      ? `<div style="color:${d.lepStatus.color};font-weight:bold;font-size:13px">${d.lepStatus.label}</div>`
      : "";

  return `
    <div style="padding:5px;border:1px solid #3a3a5e;border-radius:3px;margin-bottom:4px;background:rgba(0,0,0,0.25)">
      <div style="font-family:'Cinzel',serif;font-size:14px;color:#e0c0a0;margin-bottom:3px">${d.name}</div>
      ${balken(d.lepAnteil, d.lep, d.lepMax, "LeP")}
      ${balken(d.aupAnteil, d.aup, d.aupMax, "AuP")}
      ${d.aspMax > 0 ? balken(d.aspMax > 0 ? Math.round((d.asp / d.aspMax) * 100) : null, d.asp, d.aspMax, "AsP") : ""}
      ${warnung}
      ${wundenText ? `<div style="margin-top:2px">${wundenText}</div>` : ""}
      ${zustandsChips ? `<div style="margin-top:3px;display:flex;gap:3px;flex-wrap:wrap">${zustandsChips}</div>` : ""}
      ${abzugText ? `<div style="margin-top:2px">${abzugText}</div>` : ""}
    </div>`;
}

/**
 * Sammelt die Aktoren, die auf die Tafel gehören: bevorzugt die Teilnehmer des
 * laufenden Kampfes, sonst die gerade ausgewählten Token.
 */
export function kaempferSammeln() {
  const ausKampf = (game.combat?.combatants ?? [])
    .map(c => c.actor)
    .filter(Boolean);
  if (ausKampf.length) return ausKampf;
  return (canvas.tokens?.controlled ?? []).map(t => t.actor).filter(Boolean);
}

/** Das Fenster. Aktualisiert sich, wenn sich an einem Aktor etwas ändert. */
class KampfuebersichtFenster extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dsa-kampfuebersicht",
      classes: ["dsa-pixel-sheet"],
      title: "Kampfübersicht",
      popOut: true,
      width: 380,
      height: "auto",
      resizable: true,
    });
  }

  async _renderInner() {
    const kaempfer = kaempferSammeln();
    const inhalt = kaempfer.length
      ? kaempfer.map(zeileHtml).join("")
      : `<div style="color:#889;font-family:'VT323',monospace;padding:8px">
           Kein Kampf im Gange und kein Token ausgewählt.
         </div>`;
    return $(`<div class="window-content" style="background:linear-gradient(180deg,#12121c,#0a0a12);padding:6px">
      ${inhalt}
      <div style="font-size:11px;color:#556;text-align:center;margin-top:4px">
        Nur Anzeige — hier wird nichts verändert.
      </div>
    </div>`);
  }
}

let _fenster = null;

export function zeigeKampfuebersicht() {
  if (!_fenster) _fenster = new KampfuebersichtFenster();
  _fenster.render(true);
}

export function registerKampfuebersicht() {
  globalThis.DSAKampfuebersicht = () => zeigeKampfuebersicht();

  // Neu zeichnen, wenn sich etwas Sichtbares ändert. Nur wenn das Fenster
  // offen ist — sonst zeichnet jede Schadensmeldung ein unsichtbares Fenster neu.
  const neuZeichnen = () => { if (_fenster?.rendered) _fenster.render(false); };
  Hooks.on("updateActor", neuZeichnen);
  Hooks.on("updateCombat", neuZeichnen);
  Hooks.on("deleteCombat", neuZeichnen);
  Hooks.on("controlToken", neuZeichnen);

  console.log(`[${MODULE_ID}] Kampfübersicht registriert — DSAKampfuebersicht()`);
}
