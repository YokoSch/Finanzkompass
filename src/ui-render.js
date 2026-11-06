/*
 * Modul ui-render.js – Browser-kompatibel auch über file://.
 * Eigenständiger Scope: nur die bewusst exportierten Funktionen werden
 * unter globalThis.FinanzkompassModules.uiRender veröffentlicht.
 * Die Abhängigkeiten werden durch die Reihenfolge der defer-Skripte in
 * /index.html geladen; kein Build, kein Server und keine Bibliothek nötig.
 */
(function(modules) {
'use strict';
const {icon} = modules.icons;
const {eur,toEuroInput} = modules.money;
const {todayISO,startOfMonth,endOfMonth,addMonthsAnchored,monthLabel,dateLabel,weekdayMon0,addDays} = modules.date;
const {materializeEvents,upcomingOccurrences,nominalDate} = modules.recurrence;
const {estimatedMonthlySurplus} = modules.forecast;
const {drawForecastChart} = modules.chart;
/** ui-render.js — HTML-Templates, ohne Zustandsänderungen.
 * Alle benutzerdefinierten Strings gehen durch esc(), damit Importdaten niemals
 * HTML oder Skripte in die Oberfläche einschleusen können.
 */
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const dateText=iso=>dateLabel(iso,{day:'2-digit',month:'short',year:'numeric'});
const recurName=f=>({none:'Einmalig',daily:'Täglich',weekly:'Wöchentlich',monthly:'Monatlich',yearly:'Jährlich'}[f]||'Unbekannt');
const pbtn=(action,text,cls='secondary-btn',extra='')=>`<button type="button" class="${cls}" data-action="${action}" ${extra}>${text}</button>`;
const formatValue=c=>`<span class="${c>0?'metric-green':c<0?'':'muted'}">${eur(c,{signed:c>0})}</span>`;
function navButton(ui,view,label,ico){return `<button type="button" data-action="nav" data-view="${view}" class="nav-button ${ui.view===view?'active':''}">${icon(ico,19)}<span>${label}</span></button>`;}
function mobileButton(ui,view,label,ico){return `<button type="button" data-action="nav" data-view="${view}" class="${ui.view===view?'active':''}">${icon(ico,20)}${label}</button>`;}
function pageData(view){return ({overview:['DEIN FINANZIELLER SPIELRAUM','Übersicht','Deine Finanzen, auf einen Blick.'],calendar:['ALLES ZUR RICHTIGEN ZEIT','Kalender','Jeden Tag verstehen und bequem planen.'],bookings:['DEINE BUCHUNGEN','Buchungen','Regelmäßiges und Einmaliges an einem Ort.'],settings:['PERSÖNLICHE EINSTELLUNGEN','Einstellungen','Reserve, Daten und Verhalten der App.']}[view]);}
function renderApp(ui){
  const pg=pageData(ui.view), s=ui.state;
  return `<div class="app-shell">
    <aside class="sidebar"><div class="brand"><div class="brand-symbol">${icon('wallet',20)}</div><div>Finanzkompass<small>Dein Geld. Dein Überblick.</small></div></div>
      <nav class="side-nav" aria-label="Hauptmenü">${navButton(ui,'overview','Übersicht','chart')}${navButton(ui,'calendar','Kalender','calendar')}${navButton(ui,'bookings','Buchungen','repeat')}${navButton(ui,'settings','Einstellungen','settings')}</nav>
      <div class="sidebar-bottom"><div class="side-hint">${icon('shield',16)} <strong>100 % lokal.</strong><br>Deine Finanzdaten bleiben in diesem Browser. Regelmäßige JSON-Backups sind empfohlen.</div><div class="version">Finanzkompass · Version 1.0.0</div></div>
    </aside>
    <div class="main-area">
      <header class="topbar"><div><div class="page-overline">${pg[0]}</div><h1 class="page-title">${pg[1]}</h1><p class="page-description">${pg[2]}</p></div>
        <div class="top-actions">${pbtn('new-entry',`${icon('plus',18)} Neue Buchung`,'primary-btn')}${pbtn('nav',icon('settings',19),'round-btn','data-view="settings" aria-label="Einstellungen"')}</div>
      </header>
      <main id="main-content">${ui.persistenceMode==='memory'?`<div class="setup-banner"><div><h3>${icon('alert',17)} Nur temporäre Speicherung möglich</h3><p>Dieser Browser erlaubt keine dauerhafte Speicherung für diese Datei. Änderungen bleiben nur bis zum Schließen des Tabs erhalten. Exportiere regelmäßig eine JSON-Sicherung.</p></div>${pbtn('export',`${icon('download',16)} Backup sichern`,'primary-btn')}</div>`:''}${renderPage(ui)}</main>
      <div class="footer-text">Prognose auf Basis deiner Eingaben · Kein Bankabgleich · Buchungsreihenfolge innerhalb eines Tages konservativ geschätzt</div>
    </div>
    <nav class="mobile-nav" aria-label="Mobiles Menü">${mobileButton(ui,'overview','Übersicht','chart')}${mobileButton(ui,'calendar','Kalender','calendar')}${mobileButton(ui,'bookings','Buchungen','repeat')}${mobileButton(ui,'settings','Mehr','settings')}</nav>
    <button class="fab-mobile" type="button" data-action="new-entry" aria-label="Neue Buchung">${icon('plus',26)}</button>
    ${ui.modal?renderModal(ui):''}
    ${ui.toast?`<div class="toast" role="status">${icon(ui.toast.error?'alert':'check',16)}<span>${esc(ui.toast.message)}</span>${ui.toast.undo?`<button type="button" data-action="undo-toast">Rückgängig</button>`:''}</div>`:''}
    <input type="file" id="json-file-picker" accept=".json,application/json" hidden/>
  </div>`;
}
function renderPage(ui){
  if(ui.view==='overview')return renderHome(ui);
  if(ui.view==='calendar')return renderCalendar(ui);
  if(ui.view==='bookings')return renderBookings(ui);
  return renderSettings(ui);
}
function firstUse(ui){return ui.state.rules.length===0&&ui.state.settings.currentBalanceCents===0;}
function renderHome(ui){
  const {state:s,result:r}=ui,sett=s.settings;
  const isDanger=r.shortfallCents>0;
  const coming=r.events.filter(e=>e.date>=sett.balanceDate).slice(0,5);
  const selected=r.days.find(d=>d.date===ui.chartDate) || r.days.find(d=>d.date===r.minDate)||r.days[0];
  const shown=r.days.filter(d=>d.date>=sett.viewStart&&d.date<=sett.viewEnd);
  const monthForecast=estimatedMonthlySurplus(s);
  return `${firstUse(ui)?`<div class="setup-banner"><div><h3>Willkommen bei Finanzkompass</h3><p>Trage zuerst deinen aktuellen Kontostand ein und lege dann die regelmäßigen Einnahmen und Ausgaben an. Es sind keine Beispieldaten hinterlegt.</p></div>${pbtn('edit-balance',`${icon('plus',16)} Kontostand eingeben`,'primary-btn')}</div>`:''}
  ${sett.balanceDate<todayISO()?`<div class="setup-banner stale-warning"><div><h3>Kontostand ist nicht mehr aktuell</h3><p>Dein letzter Kontostand stammt vom ${dateText(sett.balanceDate)}. Die Prognose berücksichtigt seitdem geplante Zahlungen, aber keine unbekannten tatsächlichen Kontobewegungen. Aktualisiere den Saldo für ein verlässlicheres Ergebnis.</p></div>${pbtn('edit-balance','Kontostand aktualisieren','secondary-btn')}</div>`:''}
  <section class="grid-home">
    <div class="card hero ${isDanger?'is-danger':''}">
      <div><div class="hero-label">${icon('shield',17)} ${isDanger?'Voraussichtliche Deckungslücke':'Sicher zusätzlich ausgebbar'}</div>
        <div class="hero-value">${eur(isDanger?r.shortfallCents:r.safeSpendCents)}</div>
        <div class="hero-desc">${isDanger?`Mindestens dieser Betrag fehlt, damit dein Konto bis ${dateText(sett.viewEnd)} die Reserve nicht unterschreitet.`:`Du könntest diesen Betrag heute zusätzlich ausgeben, ohne bis ${dateText(sett.viewEnd)} deine Reserve zu unterschreiten.`}</div>
      </div>
      <div class="hero-bottom"><span class="hero-label">${icon('calendar',15)} Bis ${dateText(sett.viewEnd)}</span><button type="button" class="hero-action" data-action="experiment">${icon('bolt',16)} Ausgabe testen</button></div>
    </div>
    <div class="stat-stack">
      <div class="card stat-card"><div><div class="stat-label">Kontostand heute</div><div class="stat-value">${eur(sett.currentBalanceCents)}</div><div class="stat-sub">Stand: ${dateText(sett.balanceDate)} · <button class="link-button" data-action="edit-balance">Bearbeiten</button></div></div><div class="stat-icon">${icon('wallet',20)}</div></div>
      <div class="card stat-card"><div><div class="stat-label">Tiefster prognostizierter Stand</div><div class="stat-value ${r.minCents<0?'metric-danger':''}">${eur(r.minCents)}</div><div class="stat-sub">${dateText(r.minDate)} · Reserve ${eur(sett.reserveCents)}</div></div><div class="stat-icon">${icon('chart',20)}</div></div>
    </div>
  </section>
  <section class="dashboard-lower">
    <div class="card chart-card"><div class="section-top chart-header"><div><h2>Kontostandsprognose</h2><div class="section-sub">Tagesgenau berechnet · der Verlauf zeigt Tagesendstände</div></div><div class="chart-pillset">${[['1m','1 M'],['3m','3 M'],['6m','6 M'],['1y','1 J']].map(([k,t])=>`<button type="button" class="chart-pill ${ui.rangePreset===k?'active':''}" data-action="range-preset" data-preset="${k}">${t}</button>`).join('')}<button type="button" class="chart-pill ${ui.rangePreset==='custom'?'active':''}" data-action="range-custom" title="Zeitraum frei wählen">${icon('calendar',13)}</button></div></div>
      ${drawForecastChart(shown,sett.reserveCents,ui.chartDate)}
      <div class="chart-legend"><span><i class="legend-line"></i> Kontostand</span><span><i class="legend-dash"></i> Nullgrenze</span><span>Reserve: ${eur(sett.reserveCents)}</span></div>
      ${selected?`<div class="selected-day"><div><small>${dateText(selected.date)} ${selected.date===r.minDate?'· finanzieller Tiefpunkt':''}</small><strong>${eur(selected.closingCents)}</strong></div><div class="muted" style="font-size:11px;text-align:right">${selected.count} geplante Buchung${selected.count===1?'':'en'}<br>${pbtn('calendar-from-chart','Im Kalender öffnen','link-button','style="min-height:0;padding:5px 0"')}</div></div>`:''}
    </div>
    <div class="card"><div class="section-top"><div><h2>Nächste Buchungen</h2><div class="section-sub">Was als Nächstes ansteht</div></div><button class="link-button" data-action="nav" data-view="calendar">Kalender ${icon('right',13)}</button></div>
      ${coming.length?`<div class="event-list">${coming.map(ev=>renderEventRow(ui,ev)).join('')}</div>`:emptyInline('Noch keine zukünftigen Buchungen.','new-entry','Buchung anlegen')}
      <div class="divider"></div><div class="section-top" style="margin:0"><div><div class="section-sub">Ø monatlicher Überschuss aus laufenden Buchungen</div><div style="font-weight:760;font-size:22px;margin-top:5px" class="${monthForecast<0?'metric-danger':'metric-green'}">${eur(monthForecast)}</div></div>${pbtn('open-budget-info',icon('info',17),'icon-btn','aria-label="Information zum Monatswert"')}</div>
    </div>
  </section>`;
}
function emptyInline(message,action,text){return `<div style="text-align:center;padding:25px 6px;color:var(--muted);font-size:12px;line-height:1.8">${esc(message)}<div style="margin-top:12px">${pbtn(action,`${icon('plus',15)} ${text}`,'secondary-btn btn-sm')}</div></div>`;}
function renderEventRow(ui,ev,{showDate=true}={}){
  ui.eventMap.set(ev.key,ev);
  const meta=[showDate?dateText(ev.date):null,ev.posted?'Gebucht':ev.exception?'Ausnahme':ev.repeat?'Wiederkehrend':'Einmalig'].filter(Boolean).join(' · ');
  return `<div class="event-row clickable" role="button" tabindex="0" data-action="edit-event" data-key="${esc(ev.key)}"><div class="event-icon ${ev.amountCents>0?'positive':''}">${icon(ev.amountCents>0?'bank':'wallet',17)}</div><div class="event-desc"><div class="event-title">${esc(ev.title)}</div><div class="event-meta">${meta}</div></div><div class="event-amount ${ev.amountCents>0?'metric-green':''}">${eur(ev.amountCents,{signed:ev.amountCents>0})}</div>${icon('right',16)}</div>`;
}
function renderCalendar(ui){
  const month=ui.calendarMonth, first=startOfMonth(month),end=endOfMonth(month);
  const events=materializeEvents(ui.state,first,end,{includePosted:true});
  const byDay=new Map();
  for(const ev of events){if(!byDay.has(ev.date))byDay.set(ev.date,[]);byDay.get(ev.date).push(ev);}
  const blank=weekdayMon0(first),count=Number(end.slice(-2)),total=Math.ceil((blank+count)/7)*7;
  const selected=ui.selectedDay>=first&&ui.selectedDay<=end?ui.selectedDay:first;
  const todays=todayISO();
  const cells=Array.from({length:total},(_,i)=>{
    const n=i-blank+1;
    if(n<1||n>count)return '<div class="cal-day blank"></div>';
    const date=`${month.slice(0,7)}-${String(n).padStart(2,'0')}`,list=byDay.get(date)||[];
    const sum=list.reduce((v,e)=>v+e.amountCents,0);
    return `<button type="button" class="cal-day ${date===selected?'selected':''} ${date===todays?'today':''}" data-action="select-day" data-date="${date}"><span class="day-num">${n}</span><span class="day-dots">${list.slice(0,5).map(ev=>`<i class="dot ${ev.amountCents>0?'positive':''}"></i>`).join('')}</span>${list.length?`<span class="day-total">${sum>0?'+':''}${Math.round(sum/100)} €</span>`:''}</button>`;
  }).join('');
  const chosen=byDay.get(selected)||[];
  return `<section class="calendar-layout"><div class="card"><div class="cal-head"><div class="cal-title">${esc(monthLabel(first))}</div><div style="display:flex;gap:5px">${pbtn('calendar-today','Heute','secondary-btn btn-sm')}${pbtn('calendar-prev',icon('left',18),'round-btn','aria-label="Voriger Monat" style="width:34px;height:34px"')}${pbtn('calendar-next',icon('right',18),'round-btn','aria-label="Nächster Monat" style="width:34px;height:34px"')}</div></div><div class="cal-week">${['Mo','Di','Mi','Do','Fr','Sa','So'].map(x=>`<div>${x}</div>`).join('')}</div><div class="calendar-grid">${cells}</div><div class="inline-note">${icon('info',15)} <span>Ausgaben und Einnahmen sind als Punkte markiert. Verschobene Einzeltermine erscheinen am tatsächlich geplanten Tag.</span></div></div>
    <aside class="card calendar-side"><div class="page-overline">AUSGEWÄHLTER TAG</div><div class="cal-side-title">${dateText(selected)}</div><div class="cal-side-sub">${chosen.length} Buchung${chosen.length===1?'':'en'} · ${eur(chosen.reduce((sum,x)=>sum+x.amountCents,0),{signed:true})}</div>
    <div class="event-list">${chosen.length?chosen.map(ev=>renderEventRow(ui,ev,{showDate:false})).join(''):'<p class="muted" style="font-size:12px;line-height:1.7;padding:12px 0">Keine Buchungen an diesem Tag.</p>'}</div>
    ${pbtn('new-entry',`${icon('plus',17)} Buchung für diesen Tag`,'primary-btn','data-date="'+selected+'"')}</aside>
  </section>`;
}
function renderBookings(ui){
  return `<section><div class="toolbar"><div class="seg-tabs">${[['all','Alle'],['recurring','Wiederkehrend'],['oneoff','Einmalig']].map(([v,label])=>`<button type="button" class="seg-tab ${ui.bookingFilter===v?'active':''}" data-action="filter-bookings" data-filter="${v}">${label}</button>`).join('')}</div><label class="searchfield">${icon('search',17)}<input id="rule-search" type="search" aria-label="Buchungen durchsuchen" placeholder="Buchung suchen ..." value="${esc(ui.search)}"/></label></div><div id="rules-content">${renderRules(ui)}</div></section>`;
}
function renderRules(ui){
  const records=ui.state.rules.filter(r=>(ui.bookingFilter==='all'||(ui.bookingFilter==='recurring'&&r.frequency!=='none')||(ui.bookingFilter==='oneoff'&&r.frequency==='none'))&&r.title.toLowerCase().includes(ui.search.toLowerCase().trim())).sort((a,b)=>a.title.localeCompare(b.title,'de'));
  if(!records.length)return `<div class="empty-state"><div class="empty-symbol">${icon('repeat',29)}</div><h3>${ui.state.rules.length?'Keine passenden Buchungen':'Noch keine Buchungen'}</h3><p>${ui.state.rules.length?'Probiere einen anderen Filter oder Suchbegriff.':'Lege eine Einnahme oder Ausgabe an. Wiederkehrende Buchungen werden automatisch über den ganzen Zeitraum geplant.'}</p>${pbtn('new-entry',`${icon('plus',17)} Neue Buchung`,'primary-btn')}</div>`;
  return `<div class="rule-list">${records.map(r=>{
    const next=upcomingOccurrences(ui.state,r,1,ui.state.settings.balanceDate)[0];
    return `<div class="rule-card"><div class="event-icon ${r.amountCents>0?'positive':''}">${icon(r.amountCents>0?'bank':r.frequency==='none'?'wallet':'repeat',20)}</div><div class="rule-main"><div class="rule-title">${esc(r.title)}</div><div class="rule-sub">${recurName(r.frequency)} · ${r.frequency==='none'?dateText(r.anchor):`Ab ${dateText(r.anchor)}`}${r.weekdayPolicy!=='none'?' · Mo–Fr-Verschiebung':''}</div><div class="rule-secondary">${next?'Nächster Termin: '+dateText(next.date):'Keine künftigen Termine'}</div></div><div class="rule-amount ${r.amountCents>0?'metric-green':''}">${eur(r.amountCents,{signed:r.amountCents>0})}</div><div class="rule-actions">${r.frequency!=='none'?pbtn('show-occurrences',icon('calendar',17),'icon-btn',`data-id="${esc(r.id)}" title="Einzeltermine" aria-label="Termine verwalten"`):''}${pbtn('edit-rule',icon('edit',17),'icon-btn',`data-id="${esc(r.id)}" title="Regel bearbeiten" aria-label="Buchung bearbeiten"`)}${pbtn('delete-rule',icon('trash',17),'icon-btn',`data-id="${esc(r.id)}" title="Löschen" aria-label="Buchung löschen"`)}</div></div>`;
  }).join('')}</div>`;
}
function renderSettings(ui){
  const sett=ui.state.settings;
  return `<section class="settings-grid"><div class="card settings-card"><h2>Finanzielle Eckdaten</h2><div class="setting-row"><div><div class="setting-title">Aktueller Kontostand</div><div class="setting-desc">Startwert der Prognose. Bereits enthaltene Umsätze nicht erneut einrechnen.</div></div><button class="link-button" data-action="edit-balance">${eur(sett.currentBalanceCents)} ${icon('edit',15)}</button></div><div class="setting-row"><div><div class="setting-title">Sicherheitsreserve</div><div class="setting-desc">Diesen Mindestbetrag nach Möglichkeit nie unterschreiten.</div></div><button class="link-button" data-action="edit-reserve">${eur(sett.reserveCents)} ${icon('edit',15)}</button></div><div class="setting-row"><div><div class="setting-title">Simulationszeitraum</div><div class="setting-desc">Die Risikoprüfung beginnt stets beim aktuellen Kontostand.</div></div><button class="link-button" data-action="range-custom">${dateText(sett.viewEnd)} ${icon('edit',15)}</button></div><div class="setting-row"><div><div class="setting-title">Darstellung</div><div class="setting-desc">Helles oder dunkles Design.</div></div><select class="select" id="theme-select" aria-label="Design" style="width:128px;min-height:36px"><option value="system" ${sett.theme==='system'?'selected':''}>System</option><option value="light" ${sett.theme==='light'?'selected':''}>Hell</option><option value="dark" ${sett.theme==='dark'?'selected':''}>Dunkel</option></select></div></div>
  <div class="card settings-card"><h2>Deine Daten</h2><div class="setting-row"><div><div class="setting-title">JSON-Backup exportieren</div><div class="setting-desc">Alle Regeln, Ausnahmen, erledigten Buchungen und Einstellungen in einer Datei.</div></div>${pbtn('export',icon('download',19),'round-btn','aria-label="Backup herunterladen"')}</div><div class="setting-row"><div><div class="setting-title">Backup importieren</div><div class="setting-desc">Ersetzt nach Bestätigung alle aktuell gespeicherten Daten.</div></div>${pbtn('import',icon('upload',19),'round-btn','aria-label="Backup importieren"')}</div><div class="setting-row"><div><div class="setting-title">Alle Daten zurücksetzen</div><div class="setting-desc">Löscht die lokale Planung. Bitte vorher ein Backup erstellen.</div></div>${pbtn('reset',icon('trash',18),'danger-btn btn-sm','aria-label="Alle Daten zurücksetzen"')}</div><div class="inline-note">${icon('shield',17)} Kein Login, kein Server, keine automatische Synchronisierung. Löscht der Browser seinen lokalen Speicher, sind ungesicherte Daten weg.</div></div>
  <div class="card settings-card"><h2>So rechnet Finanzkompass</h2><div class="details"><details><summary>Was ist „Sicher zusätzlich ausgebbar“?</summary><p>Wir simulieren jeden Tag bis zum gewählten Enddatum. Zuerst werden an jedem Tag die Ausgaben, dann die Einnahmen berücksichtigt. Der kleinste dabei mögliche Zwischenstand minus Sicherheitsreserve ist dein theoretisch zusätzlich ausgebbarer Betrag. Annahme: Alle geplanten Zahlungen passieren wie eingegeben.</p></details></div><div class="details"><details><summary>Warum gibt es „Gebucht“?</summary><p>Wenn eine geplante Zahlung tatsächlich erfolgt ist, kannst du sie als gebucht markieren. Dann wird sie aus der offenen Prognose entfernt. Bei Bedarf wird gleichzeitig der heutige Kontostand angepasst. Wenn du die Zahlung bereits in deinem Kontostand berücksichtigt hast, wähle ausdrücklich „bereits enthalten“.</p></details></div><div class="details"><details><summary>Wie funktionieren Terminverschiebungen?</summary><p>Jedes Wiederholungsmuster hat feste nummerierte Ausgangstermine. Einzelne Ausnahmen ändern nur einen bestimmten Termin und erzeugen keine Doppelbuchung. Die Mo–Fr-Automatik beachtet keine gesetzlichen Feiertage; dafür kannst du Termine einzeln verschieben.</p></details></div></div>
  <div class="card settings-card"><h2>Wichtige Hinweise</h2><div class="hint-row">${icon('info',17)} <span>Dieses Tool ersetzt keinen Bankkontostand. Es berücksichtigt keine nicht eingegebenen Zahlungen, Zinsen oder Dispolimits. Bitte vor größeren Entscheidungen den tatsächlichen Kontostand abgleichen.</span></div><div class="hint-row" style="margin-top:12px">${icon('clock',17)} <span>Der Kontoanker ist der letzte bestätigte Kontostand vom ${dateText(sett.balanceDate)}. Aktualisiere ihn regelmäßig, insbesondere wenn viele spontane Ausgaben auftreten.</span></div></div></section>`;
}
const field=(label,name,value,type='text',other='')=>`<div class="field"><label for="f-${name}">${label}</label><input class="input" id="f-${name}" name="${name}" type="${type}" value="${esc(value??'')}" ${other}/></div>`;
const modalHeader=(title,desc='')=>`<div class="modal-head"><h2 class="modal-title">${title}</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('close',21)}</button></div>${desc?`<p class="modal-sub">${desc}</p>`:'<div style="height:16px"></div>'}`;
const formFooter=(text='Speichern')=>`<div class="form-actions">${pbtn('close-modal','Abbrechen','secondary-btn')}<button type="submit" class="primary-btn">${icon('check',17)} ${text}</button></div>`;
function renderModal(ui){
  const m=ui.modal,d=m.draft||{},t=m.type;
  let content='';
  if(t==='entry'||t==='edit-rule'){
    const editing=t==='edit-rule',recent=[...ui.state.rules].reverse().slice(0,5);
    content=`${modalHeader(editing?'Buchungsregel bearbeiten':'Neue Buchung',editing?'Änderungen an der Grundregel gelten für alle künftigen, noch nicht gebuchten Vorkommen.':'Schnell erfassen, direkt einplanen. Nur Betrag und Bezeichnung sind neben dem Datum erforderlich.')}
      <form data-form="entry"><div class="segment"><label><input type="radio" name="kind" value="expense" ${d.kind!=='income'?'checked':''}/> ${icon('wallet',15)} Ausgabe</label><label><input type="radio" name="kind" value="income" ${d.kind==='income'?'checked':''}/> ${icon('bank',15)} Einnahme</label></div>
      <div class="field"><label for="f-amount">Betrag</label><div class="amount-shell"><input class="input amount-input" name="amount" id="f-amount" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(d.amount||'')}" required/></div></div>
      ${field('Bezeichnung','title',d.title||'','text','placeholder="z. B. Miete, Gehalt, Einkauf" required maxlength="100"')}
      ${!editing&&recent.length?`<div class="quick-items" aria-label="Zuletzt verwendete Buchungen">${recent.map(r=>`<button type="button" class="quick-item" data-action="prefill-rule" data-id="${esc(r.id)}">${esc(r.title)}</button>`).join('')}</div>`:''}
      <div class="form-row">${field('Datum','date',d.date||todayISO(),'date','required')}
      <div class="field"><label for="f-frequency">Wiederholung</label><select class="select" name="frequency" id="f-frequency">${[['none','Einmalig'],['daily','Täglich'],['weekly','Wöchentlich'],['monthly','Monatlich'],['yearly','Jährlich']].map(([v,txt])=>`<option value="${v}" ${d.frequency===v?'selected':''}>${txt}</option>`).join('')}</select></div></div>
      <details class="form-more" ${d.expandMore?'open':''}><summary>Weitere Optionen</summary><div class="form-row"><div class="field"><label for="f-weekdayPolicy">Wochenendtermine</label><select class="select" name="weekdayPolicy" id="f-weekdayPolicy"><option value="none" ${d.weekdayPolicy==='none'?'selected':''}>Unverändert</option><option value="previous" ${d.weekdayPolicy==='previous'?'selected':''}>Vorheriger Mo–Fr</option><option value="next" ${d.weekdayPolicy==='next'?'selected':''}>Nächster Mo–Fr</option></select></div>${field('Ende der Wiederholung','until',d.until||'','date')}</div>${field('Notiz (optional)','note',d.note||'','text','maxlength="300"')}<div class="hint-row">${icon('info',15)} Die Mo–Fr-Automatik prüft nur Wochenenden, keine Feiertage.</div></details>
      ${editing&&ui.state.exceptions.some(e=>e.ruleId===m.ruleId)?`<div class="hint-row" style="margin-top:12px">${icon('alert',16)} Vorhandene Ausnahmen bleiben an ihre laufende Terminnummer gebunden. Prüfe sie nach Änderungen des Startdatums oder Wiederholungsrhythmus.</div>`:''}
      ${formFooter(editing?'Regel speichern':'Buchung hinzufügen')}</form>`;
  } else if(t==='occurrence'){
    const ev=m.event,rule=ui.state.rules.find(x=>x.id===ev.ruleId),recurring=rule?.frequency!=='none';
    if(ev.posted){
      content=`${modalHeader('Bereits gebuchte Zahlung','Dieser Umsatz ist in deiner Kontohistorie gespeichert und wird nicht erneut prognostiziert.')}
        <div class="selected-day"><div><strong>${esc(ev.title)}</strong><small>${dateText(ev.date)}</small></div><strong>${eur(ev.amountCents,{signed:ev.amountCents>0})}</strong></div>
        <div class="hint-row">${icon('info',17)} Beim Rückgängigmachen wird eine eventuell automatisch vorgenommene Kontostandsänderung wieder rückgängig gemacht, sofern danach kein neuer Kontostand erfasst wurde.</div>
        <div class="form-actions">${pbtn('close-modal','Schließen','secondary-btn')}${pbtn('undo-posted',`${icon('undo',17)} Buchung zurücknehmen`,'danger-btn',`data-id="${esc(ev.id)}"`)}</div>`;
    } else {
      content=`${modalHeader('Buchung bearbeiten',recurring?`Regeltermin: ${dateText(ev.nominalDate)}. Du kannst nur diesen Termin ändern oder die Serie anpassen.`:'Ändere Datum oder Betrag. Die Prognose wird anschließend automatisch neu berechnet.')}
        <form data-form="occurrence"><div class="form-row">${field('Bezeichnung','title',d.title,'text','required maxlength="100"')}${field('Datum','date',d.date,'date','required')}</div><div class="field"><label>Betrag</label><div class="amount-shell"><input class="input" name="amount" inputmode="decimal" value="${esc(d.amount)}" required/></div></div>
        ${recurring?`<div class="field"><label>Änderung anwenden auf</label><div class="scope-options"><label class="scope-option"><input type="radio" name="scope" value="once" ${d.scope==='once'?'checked':''}/><div><strong>Nur diese Buchung</strong><span>Einzelne Ausnahme; spätere Termine bleiben gleich.</span></div></label><label class="scope-option"><input type="radio" name="scope" value="future" ${d.scope==='future'?'checked':''}/><div><strong>Diese und alle folgenden</strong><span>Ab diesem Termin neue Serie beginnen.</span></div></label><label class="scope-option"><input type="radio" name="scope" value="all" ${d.scope==='all'?'checked':''}/><div><strong>Gesamte Serie</strong><span>Den Zahltag für die gesamte Serie anpassen.</span></div></label></div></div>`:''}
        ${formFooter('Änderung speichern')}</form><div class="modal-extra-actions">
          ${pbtn('post-event',`${icon('check',16)} Als gebucht markieren`,'secondary-btn btn-sm')}
          ${pbtn('cancel-event',`${icon('trash',15)} ${recurring?'Termin ausfallen lassen':'Buchung löschen'}`,'ghost-btn btn-sm')}
          ${ev.exception?pbtn('restore-event',`${icon('undo',15)} Ausnahme entfernen`,'ghost-btn btn-sm'):''}
        </div>`;
    }
  } else if(t==='post'){
    content=`${modalHeader('Zahlung als gebucht markieren','Die geplante Zahlung verschwindet aus der offenen Prognose. Wie soll dein aktueller Kontostand behandelt werden?')}
      <form data-form="post"><div class="selected-day"><div><strong>${esc(m.event.title)}</strong><small>Geplant für ${dateText(m.event.date)}</small></div><strong>${eur(m.event.amountCents,{signed:m.event.amountCents>0})}</strong></div>
      <div class="form-row"><div class="field"><label>Tatsächlicher Betrag</label><div class="amount-shell"><input class="input" name="amount" value="${esc(d.amount)}" inputmode="decimal" required/></div></div>${field('Buchungsdatum','date',d.date||todayISO(),'date','required')}</div>
      <div class="scope-options"><label class="scope-option"><input name="bookingMode" type="radio" value="adjust" checked/><div><strong>Kontostand jetzt mitändern</strong><span>Die Zahlung wird direkt zum aktuellen Saldo addiert bzw. davon abgezogen.</span></div></label><label class="scope-option"><input name="bookingMode" type="radio" value="included"/><div><strong>Ist im Kontostand bereits enthalten</strong><span>Kein zweiter Abzug oder Zuschlag; nur die offene Prognose aktualisieren.</span></div></label></div>${formFooter('Als gebucht speichern')}</form>`;
  } else if(t==='balance'){
    content=`${modalHeader('Kontostand aktualisieren','Trage den Saldo aus deiner Banking-App ein. Er ist der neue Ausgangspunkt aller zukünftigen Berechnungen.')}
      <form data-form="balance"><div class="field"><label>Aktueller Kontostand in Euro</label><div class="amount-shell"><input class="input amount-input" name="amount" inputmode="decimal" value="${esc(d.amount)}" required/></div></div><div class="hint-row">${icon('info',16)} Als neuer Stichtag wird heute (${dateText(todayISO())}) gesetzt. Bereits gebuchte Zahlungen bleiben erledigt. Ihre alten automatischen Saldoanpassungen werden nicht noch einmal verrechnet.</div>${formFooter('Kontostand übernehmen')}</form>`;
  } else if(t==='reserve'){
    content=`${modalHeader('Sicherheitsreserve','Dieser Betrag soll während der gesamten Simulation nicht unterschritten werden.')}
    <form data-form="reserve"><div class="field"><label>Reserve in Euro</label><div class="amount-shell"><input class="input amount-input" name="amount" inputmode="decimal" value="${esc(d.amount)}" required/></div></div>${formFooter('Reserve übernehmen')}</form>`;
  } else if(t==='range'){
    content=`${modalHeader('Zeitraum festlegen','Frei wählbar. Standard: ab heute ein Jahr in die Zukunft.')}
    <form data-form="range"><div class="form-row">${field('Anzeige ab','start',d.start,'date',`required min="${ui.state.settings.balanceDate}"`)}${field('Prognose bis','end',d.end,'date','required')}</div><div class="hint-row">${icon('shield',16)} Zur Berechnung des heute sicher ausgebbaren Geldes werden auch alle Termine zwischen deinem Kontostand-Stichtag und dem gewählten Ende berücksichtigt – selbst wenn die Anzeige erst später beginnt.</div>${formFooter('Zeitraum übernehmen')}</form>`;
  } else if(t==='experiment'){
    content=`${modalHeader('Ausgabe testen','Was passiert, wenn du eine zusätzliche Ausgabe in deine Planung aufnimmst? Es wird nichts gespeichert.')}
    <form data-form="experiment"><div class="form-row">${field('Betrag in Euro','amount',d.amount||'','text','inputmode="decimal" placeholder="150,00" required')}${field('Ausgabedatum','date',d.date||todayISO(),'date','required')}</div>${formFooter('Auswirkung berechnen')}</form>
    ${m.result?`<div class="selected-day" style="margin-top:17px"><div><small>Sicher verfügbar nach Test</small><strong class="${m.result.shortfallCents?'metric-danger':'metric-green'}">${m.result.shortfallCents?'0,00 €':eur(m.result.safeSpendCents)}</strong></div><div style="text-align:right"><small>${m.result.shortfallCents?'Fehlbetrag':'Bisher sicher verfügbar'}</small><strong>${m.result.shortfallCents?eur(m.result.shortfallCents):eur(ui.result.safeSpendCents)}</strong></div></div>`:''}
    <div class="modal-extra-actions">${pbtn('close-modal','Schließen','secondary-btn')}${m.result?pbtn('adopt-experiment',`${icon('plus',16)} Als Buchung übernehmen`,'primary-btn'):''}</div>`;
  } else if(t==='occurrences'){
    const rule=ui.state.rules.find(r=>r.id===m.ruleId),events=rule?upcomingOccurrences(ui.state,rule,10,ui.state.settings.balanceDate):[];
    const skipped=ui.state.exceptions.filter(e=>e.ruleId===m.ruleId&&e.action==='skip').sort((a,b)=>a.occurrenceIndex-b.occurrenceIndex);
    content=`${modalHeader('Einzeltermine verwalten',rule?`${esc(rule.title)} · ${recurName(rule.frequency)}. Klicke auf einen Termin, um ihn unabhängig von der Serie anzupassen.`:'')}
      ${events.length?`<div class="event-list">${events.map(ev=>renderEventRow(ui,ev)).join('')}</div>`:'<p class="muted">Keine anstehenden Termine.</p>'}
      ${skipped.length?`<div class="divider"></div><h3 class="section-heading">Ausgefallene Termine</h3>${skipped.map(e=>`<div class="event-row"><div class="event-desc"><div class="event-title">${esc(rule?.title||'Buchung')}</div><div class="event-meta">${rule?dateText(nominalDate(rule,e.occurrenceIndex)):`Termin ${e.occurrenceIndex+1}`} · fällt aus</div></div>${pbtn('restore-skipped',`${icon('undo',15)} Wiederherstellen`,'secondary-btn btn-sm',`data-id="${esc(e.ruleId)}" data-index="${e.occurrenceIndex}"`)}</div>`).join('')}`:''}
      <div class="form-actions">${pbtn('close-modal','Schließen','secondary-btn')}</div>`;
  } else if(t==='confirm'){
    content=`${modalHeader(esc(m.title),esc(m.description))}<div class="form-actions">${pbtn('close-modal','Abbrechen','secondary-btn')}${pbtn('confirm-action',`${icon('check',16)} ${esc(m.confirmText||'Bestätigen')}`,'danger-btn')}</div>`;
  } else if(t==='budgetinfo'){
    content=`${modalHeader('Monatlicher Überschuss','Eine ergänzende Orientierungsgröße, nicht dein sicher ausgebbarer Kontostand.')}
      <p style="line-height:1.8;font-size:13px;color:var(--muted)">Hier werden alle wiederkehrenden Einnahmen und Ausgaben auf einen durchschnittlichen Monat umgerechnet. Einmalige Zahlungen sind nicht enthalten. Diese Größe ignoriert den genauen Zahlungszeitpunkt sowie Ausnahmen und ist deshalb nicht gleich dem kurzfristig sicheren Ausgabelimit.</p><div class="form-actions">${pbtn('close-modal','Verstanden','primary-btn')}</div>`;
  }
  return `<div class="overlay" data-overlay="1" role="presentation"><div class="modal ${t==='occurrences'?'wide':''}" role="dialog" aria-modal="true" aria-label="${esc(m.title||t)}">${content}</div></div>`;
}
// Nur dieses Modul exportiert seine öffentliche API.
modules.uiRender = Object.freeze({ esc, renderApp, renderEventRow, renderRules });
})(globalThis.FinanzkompassModules || (globalThis.FinanzkompassModules = Object.create(null)));
