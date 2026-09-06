/**
 * DSA Pixel-Art Tokens — Aventurischer Kalender
 *
 * 12 Götter-Monate à 30 Tage + 5 Namenlose Tage = 365 Tage/Jahr
 * 7 Wochentage (Praios- bis Phex-Tag)
 *
 * Speicherung des aktuellen Datums via World-Settings:
 *   game.settings.get(MODULE_ID, "calendarDate") → { year, month, day }
 *     month: 1-13 (1-12 = Götter-Monate, 13 = Namenlose Tage)
 *     day:   1-30 (Götter-Monate) bzw. 1-5 (Namenlose Tage)
 */

import { MODULE_ID } from "./config.mjs";

const SETTING_DATE = "calendarDate";

/**
 * Default-Datum: 1. Praios, 1043 BF (Standard-Kampagnen-Start).
 *
 * WIRD ALS FUNKTION GELIEFERT, nicht als Objekt. Vorher war das eine Konstante,
 * und der Blaettern-Knopf schrieb direkt hinein: `let date = settings.get(...) ??
 * DEFAULT_DATE;` gefolgt von `date.day++`. In einer frischen Welt (oder wenn die
 * Einstellung den Vorgabewert ungeklont zurueckgibt) veraenderte ein Klick auf
 * "+1 Tag" damit den vermeintlich konstanten Kampagnenstart — fuer den Rest der
 * Sitzung. Eine Funktion kann man nicht versehentlich beschreiben.
 */
function standardDatum() {
  return { year: 1043, month: 1, day: 1 };
}

let _calendarData = null;

/** Lädt data/calendar.json einmal in Memory. */
async function loadCalendarData() {
  if (_calendarData) return _calendarData;
  try {
    const res = await fetch(`modules/${MODULE_ID}/data/calendar.json`);
    _calendarData = await res.json();
  } catch (e) {
    console.error(`[${MODULE_ID}] calendar.json konnte nicht geladen werden:`, e);
    _calendarData = { monate: [], wochentage: [], namenlose_tage: {}, feiertage: [] };
  }
  return _calendarData;
}

/** Tag-Index seit "Tag 1" zur Berechnung des Wochentags. */
function dayOfYearIndex(date, cal) {
  if (date.month === 13) {
    // Namenlose Tage: nach 12 × 30 Tagen
    return 12 * 30 + (date.day - 1);
  }
  return (date.month - 1) * 30 + (date.day - 1);
}

/** Wochentag (1-7) für ein gegebenes Datum. */
function getWeekday(date, cal) {
  // Annahme: 1. Praios = Praios-Tag (Tag 1 der Woche).
  // Total Tage seit Jahr 0 → modulo 7.
  const totalDays = (date.year * 365) + dayOfYearIndex(date, cal);
  return ((totalDays % 7) + 7) % 7 + 1;  // 1-7
}

/** Datum normalisieren (Tage über/unter Limit korrigieren). */
function normalizeDate(date, cal) {
  let { year, month, day } = date;
  // Sicherheit: Integer
  year = Math.floor(year);
  month = Math.floor(month);
  day = Math.floor(day);

  // Tag-Limit pro Monat
  const maxDay = month === 13 ? 5 : 30;
  while (day > maxDay) {
    day -= (month === 13 ? 5 : 30);
    month++;
    if (month > 13) { month = 1; year++; }
  }
  while (day < 1) {
    month--;
    if (month < 1) { month = 13; year--; }
    day += (month === 13 ? 5 : 30);
  }
  while (month > 13) { month -= 13; year++; }
  while (month < 1)  { month += 13; year--; }
  return { year, month, day };
}

/** Datum als formatierten String. */
function formatDate(date, cal) {
  if (date.month === 13) {
    return `${date.day}. Namenloser Tag, ${date.year} BF`;
  }
  const monat = cal.monate[date.month - 1];
  return `${date.day}. ${monat?.name ?? "?"}, ${date.year} BF`;
}

/** Foundry-Application für Kalender-UI. */
class DSACalendarApp extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dsa-calendar",
      title: "Aventurischer Kalender",
      template: null,  // wir bauen das HTML inline
      width: 540,
      height: "auto",
      resizable: true,
      classes: ["dsa-calendar-app"],
    });
  }

  async getData() {
    const cal = await loadCalendarData();
    const date = { ...(game.settings.get(MODULE_ID, SETTING_DATE) ?? standardDatum()) };
    const monat = date.month === 13 ? null : cal.monate[date.month - 1];
    const wochentagNr = getWeekday(date, cal);
    const wochentag = cal.wochentage[wochentagNr - 1];
    return { cal, date, monat, wochentag, wochentagNr, isNamenlos: date.month === 13 };
  }

  async _renderInner() {
    const { cal, date, monat, wochentag, isNamenlos } = await this.getData();
    const namenlos = cal.namenlose_tage ?? {};

    const html = $(`<div class="dsa-calendar">
      <style>
        .dsa-calendar { font-family: 'Cinzel', serif; padding: 12px; color: #e0e0e0;
          background: linear-gradient(180deg, #1a1428 0%, #0d1024 100%); }
        .dsa-calendar h2 { font-family: 'Press Start 2P', cursive; font-size: 14px;
          color: #ffd700; text-align: center; margin: 0 0 10px; letter-spacing: 1px; }
        .dsa-cal-date { font-size: 22px; text-align: center; padding: 12px;
          background: rgba(255,215,0,0.08); border: 2px solid #ffd700; border-radius: 6px;
          margin-bottom: 10px; }
        .dsa-cal-date b { color: #ffd700; font-size: 26px; }
        .dsa-cal-wochentag { font-size: 13px; color: #9be; margin-top: 4px; }
        .dsa-cal-monat-info { font-size: 12px; color: #caa; margin-top: 6px; }
        .dsa-cal-controls { display: grid; grid-template-columns: repeat(6, 1fr);
          gap: 4px; margin: 10px 0; }
        .dsa-cal-btn { padding: 6px; background: #0d1b2e; border: 1px solid #3a3a5e;
          color: #ffd700; cursor: pointer; font-family: 'Press Start 2P', cursive;
          font-size: 9px; transition: all 0.15s; border-radius: 3px; }
        .dsa-cal-btn:hover { background: #1a2e4a; border-color: #ffd700; }
        .dsa-cal-tabs { display: flex; gap: 4px; margin: 10px 0 6px;
          border-bottom: 1px solid rgba(255,255,255,0.1); }
        .dsa-cal-tab { padding: 6px 10px; cursor: pointer; font-size: 12px;
          color: #888; border-bottom: 2px solid transparent; }
        .dsa-cal-tab.active { color: #ffd700; border-bottom-color: #ffd700; }
        .dsa-cal-content { font-size: 12px; line-height: 1.5; max-height: 400px;
          overflow-y: auto; padding: 6px; }
        .dsa-cal-monat-row { padding: 6px 8px; margin: 2px 0; background: rgba(255,255,255,0.03);
          border-left: 3px solid #4a4a8e; border-radius: 0 4px 4px 0; }
        .dsa-cal-monat-row.current { border-left-color: #ffd700; background: rgba(255,215,0,0.08); }
        .dsa-cal-monat-name { font-weight: bold; color: #ffd700; }
        .dsa-cal-domaene { color: #9be; font-size: 11px; }
        .dsa-cal-saison { color: #888; font-size: 10px; font-style: italic; }
        .dsa-cal-anmerkung { color: #aaa; font-size: 11px; margin-top: 3px; }
        .dsa-cal-feiertag { padding: 4px 8px; background: rgba(255,100,100,0.1);
          border-left: 3px solid #f88; border-radius: 0 3px 3px 0; margin: 2px 0; }
      </style>

      <div class="dsa-cal-date">
        <div class="dsa-cal-wochentag">⊙ ${wochentag?.name ?? "?"} (${wochentag?.gott}-Tag)</div>
        <b>${formatDate(date, cal)}</b>
        <div class="dsa-cal-monat-info">
          ${isNamenlos
            ? `<span style="color:#f55">⚠ ${namenlos.anmerkung ?? ""}</span>`
            : `<span style="color:#9be">${monat?.gott} — ${monat?.domaene}</span><br>
               <span style="color:#888">${monat?.saison} · ${monat?.anmerkung ?? ""}</span>`}
        </div>
      </div>

      ${game.user.isGM ? `
      <div class="dsa-cal-controls">
        <button class="dsa-cal-btn" data-act="day-1">−1 Tag</button>
        <button class="dsa-cal-btn" data-act="day+1">+1 Tag</button>
        <button class="dsa-cal-btn" data-act="week-1">−1 Wo</button>
        <button class="dsa-cal-btn" data-act="week+1">+1 Wo</button>
        <button class="dsa-cal-btn" data-act="month-1">−1 Mo</button>
        <button class="dsa-cal-btn" data-act="month+1">+1 Mo</button>
        <button class="dsa-cal-btn" data-act="year-1" style="grid-column:1/3">−1 Jahr</button>
        <button class="dsa-cal-btn" data-act="year+1" style="grid-column:3/5">+1 Jahr</button>
        <button class="dsa-cal-btn" data-act="set-date" style="grid-column:5/7">Datum setzen…</button>
      </div>` : ""}

      <div class="dsa-cal-tabs">
        <div class="dsa-cal-tab active" data-tab="monate">Monate (Götter)</div>
        <div class="dsa-cal-tab" data-tab="wochentage">Wochentage</div>
        <div class="dsa-cal-tab" data-tab="namenlose">Namenlose Tage</div>
        <div class="dsa-cal-tab" data-tab="feiertage">Feiertage</div>
      </div>

      <div class="dsa-cal-content" data-content="monate">
        ${cal.monate.map((m, i) => `
          <div class="dsa-cal-monat-row ${date.month === m.nr ? "current" : ""}">
            <span class="dsa-cal-monat-name">${m.nr}. ${m.name}</span>
            <span class="dsa-cal-domaene">— ${m.domaene}</span><br>
            <span class="dsa-cal-saison">${m.saison} · ${m.tage} Tage</span>
            <div class="dsa-cal-anmerkung">${m.anmerkung}</div>
          </div>`).join("")}
      </div>

      <div class="dsa-cal-content" data-content="wochentage" style="display:none">
        ${cal.wochentage.map((w, i) => `
          <div class="dsa-cal-monat-row ${getWeekday(date, cal) === w.nr ? "current" : ""}">
            <span class="dsa-cal-monat-name">${w.nr}. ${w.name}</span>
            <span class="dsa-cal-domaene">— ${w.gott} (${w.domaene})</span>
            <div class="dsa-cal-anmerkung">${w.anmerkung}</div>
          </div>`).join("")}
        <div style="margin-top:8px;padding:6px;font-size:11px;color:#888;background:rgba(0,0,0,0.3);border-radius:3px">
          ${cal._alternative_wochentage?.anmerkung ?? ""}
        </div>
      </div>

      <div class="dsa-cal-content" data-content="namenlose" style="display:none">
        <div class="dsa-cal-monat-row" style="border-left-color:#f55">
          <span class="dsa-cal-monat-name" style="color:#f88">${namenlos.name}</span>
          (${namenlos.anzahl} Tage, ${namenlos.position})
          <div class="dsa-cal-anmerkung">${namenlos.anmerkung}</div>
        </div>
        <div style="margin-top:10px;padding:6px;font-size:11px;color:#caa;background:rgba(255,80,80,0.08);border-radius:3px">
          <b>Spielregeln in den Namenlosen Tagen (DSA 4.1 WdH S.40):</b><br>
          • Magier: Beschwörungen erschwert (Verfall-Risiko erhöht)<br>
          • Geweihte: KaP-Regeneration halbiert<br>
          • Hexen: Sabbat-Pflicht in der Walpurgisnacht<br>
          • Reisen, Hochzeiten und wichtige Beschlüsse gelten als unglückbringend
        </div>
      </div>

      <div class="dsa-cal-content" data-content="feiertage" style="display:none">
        ${(cal.feiertage ?? []).map(f => `
          <div class="dsa-cal-feiertag">
            <b>${f.datum}</b> — ${f.name}
            <div class="dsa-cal-anmerkung">${f.anmerkung}</div>
          </div>`).join("")}
      </div>
    </div>`);

    return html;
  }

  activateListeners(html) {
    super.activateListeners(html);
    // Tab-Switching
    html.find(".dsa-cal-tab").on("click", e => {
      const tab = e.currentTarget.dataset.tab;
      html.find(".dsa-cal-tab").removeClass("active");
      $(e.currentTarget).addClass("active");
      html.find(".dsa-cal-content").hide();
      html.find(`[data-content="${tab}"]`).show();
    });
    // Datum-Steuerung (nur GM)
    html.find(".dsa-cal-btn").on("click", async e => {
      const act = e.currentTarget.dataset.act;
      // Immer mit einer eigenen Kopie rechnen: die Einstellung kann dasselbe
      // Objekt zurueckgeben, das im Speicher liegt.
      let date = { ...(game.settings.get(MODULE_ID, SETTING_DATE) ?? standardDatum()) };
      const cal = await loadCalendarData();
      if (act === "day+1") date.day++;
      else if (act === "day-1") date.day--;
      else if (act === "week+1") date.day += 7;
      else if (act === "week-1") date.day -= 7;
      else if (act === "month+1") date.month++;
      else if (act === "month-1") date.month--;
      else if (act === "year+1") date.year++;
      else if (act === "year-1") date.year--;
      else if (act === "set-date") {
        return this._promptDate(date, cal);
      }
      date = normalizeDate(date, cal);
      await game.settings.set(MODULE_ID, SETTING_DATE, date);
      this.render();
    });
  }

  async _promptDate(currentDate, cal) {
    const monateOpts = cal.monate.map((m, i) =>
      `<option value="${m.nr}" ${currentDate.month === m.nr ? "selected" : ""}>${m.nr}. ${m.name}</option>`
    ).join("");
    new Dialog({
      title: "Datum setzen",
      content: `
        <div style="padding:8px">
          <label>Tag: <input id="cal-day" type="number" min="1" max="30" value="${currentDate.day}" style="width:60px"></label>
          <label>Monat: <select id="cal-month">${monateOpts}<option value="13" ${currentDate.month === 13 ? "selected" : ""}>13. Namenlose Tage</option></select></label>
          <label>Jahr: <input id="cal-year" type="number" value="${currentDate.year}" style="width:80px"> BF</label>
        </div>`,
      buttons: {
        ok: {
          label: "Setzen",
          callback: async (html) => {
            let d = {
              year:  parseInt(html.find("#cal-year").val()) || 1043,
              month: parseInt(html.find("#cal-month").val()) || 1,
              day:   parseInt(html.find("#cal-day").val()) || 1,
            };
            d = normalizeDate(d, cal);
            await game.settings.set(MODULE_ID, SETTING_DATE, d);
            this.render();
          }
        },
        cancel: { label: "Abbruch" }
      }
    }).render(true);
  }
}

let _calendarApp = null;
export function openCalendar() {
  if (!_calendarApp) _calendarApp = new DSACalendarApp();
  _calendarApp.render(true);
}

/** Setting registrieren + Sidebar-Button hinzufügen. */
export function registerCalendar() {
  game.settings.register(MODULE_ID, SETTING_DATE, {
    name: "Aventurisches Datum",
    hint: "{ year, month (1-13), day }",
    scope: "world",
    config: false,
    type: Object,
    default: standardDatum(),
  });

  // Globaler Floating-Button oben links — DOM-injektion, weil Foundry v12's
  // getSceneControlButtons-Hook im Modus-Lifecycle nur einmal früh in der
  // Init-Phase feuert und dynamische Module-Hooks nicht mehr greifen.
  // Fixed-position links neben den Scene-Controls sichtbar für ALLE User.
  function injectGlobalCalendarButton() {
    if (document.getElementById("dsa-pixel-calendar-global-btn")) return;
    const btn = document.createElement("button");
    btn.id = "dsa-pixel-calendar-global-btn";
    btn.title = "Aventurischer Kalender öffnen";
    btn.innerHTML = `<i class="fas fa-calendar-alt"></i>`;
    btn.style.cssText = `
      position: fixed;
      top: 8px;
      left: 80px;
      z-index: 100;
      width: 40px;
      height: 40px;
      border-radius: 6px;
      background: linear-gradient(135deg, #2a3a5e 0%, #1a2540 100%);
      border: 2px solid #ffd700;
      color: #ffd700;
      font-size: 18px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5), 0 0 4px rgba(255,215,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.15s, box-shadow 0.15s;
      font-family: monospace;
    `;
    btn.addEventListener("mouseenter", () => {
      btn.style.transform = "scale(1.08)";
      btn.style.boxShadow = "0 2px 12px rgba(255,215,0,0.5), 0 0 8px rgba(255,215,0,0.6)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "scale(1)";
      btn.style.boxShadow = "0 2px 8px rgba(0,0,0,0.5), 0 0 4px rgba(255,215,0,0.3)";
    });
    btn.addEventListener("click", () => openCalendar());
    document.body.appendChild(btn);
  }

  // Direkt nach ready injizieren
  injectGlobalCalendarButton();

  // Auch nach jedem Canvas-Wechsel sichern (Foundry kann DOM zurücksetzen)
  Hooks.on("canvasReady", () => injectGlobalCalendarButton());
  Hooks.on("renderSceneControls", () => injectGlobalCalendarButton());

  // Backup: Settings-Tab-Button (für User die den Floating-Button verstecken)
  Hooks.on("renderSettings", (_app, html) => {
    if (html.find("#dsa-pixel-calendar-btn").length) return;
    const btn = $(`
      <button type="button" id="dsa-pixel-calendar-btn" style="margin:4px 0;width:100%">
        <i class="fas fa-calendar-alt"></i> Aventurischer Kalender
      </button>
    `);
    btn.on("click", () => openCalendar());
    html.find("#settings-game").append(btn);
  });

  console.log(`[${MODULE_ID}] ✓ Aventurischer Kalender registriert (Floating-Button oben links + Settings)`);
}
