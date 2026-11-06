/**
 * date.js — kalendarische Berechnungen ohne Zeitzonenverschiebungen.
 * Alle fachlichen Datumswerte sind ISO-Tage YYYY-MM-DD, keine Zeitstempel.
 * Im Inneren verwenden wir UTC-Mittag/UTC-Datum für mathematische Tage.
 */
const DAY_MS = 86400000;
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
export const pad = n => String(n).padStart(2, '0');
export function isValidISO(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === value;
}
export function dateUTC(iso) {
  const [y,m,d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m-1, d, 12));
}
export function dateISO(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth()+1)}-${pad(date.getUTCDate())}`;
}
export function addDays(iso, days) {
  return dateISO(new Date(dateUTC(iso).getTime() + days * DAY_MS));
}
export function diffDays(a,b) {
  return Math.round((dateUTC(a).getTime()-dateUTC(b).getTime())/DAY_MS);
}
export function monthLength(year, month) { return new Date(Date.UTC(year,month,0,12)).getUTCDate(); }
export function addMonthsAnchored(iso, n) {
  const [y,m,d] = iso.split('-').map(Number);
  const first = new Date(Date.UTC(y,m-1+n,1,12));
  const yy=first.getUTCFullYear(), mm=first.getUTCMonth()+1;
  return `${yy}-${pad(mm)}-${pad(Math.min(d,monthLength(yy,mm)))}`;
}
export function addYearsAnchored(iso,n) {
  const [y,m,d]=iso.split('-').map(Number), yy=y+n;
  return `${yy}-${pad(m)}-${pad(Math.min(d,monthLength(yy,m)))}`;
}
export function startOfMonth(iso) { return `${iso.slice(0,7)}-01`; }
export function endOfMonth(iso) {
  const [y,m]=iso.split('-').map(Number);
  return `${y}-${pad(m)}-${pad(monthLength(y,m))}`;
}
export function dateLabel(iso, opts={day:'2-digit',month:'short',year:'numeric'}) {
  if(!isValidISO(iso)) return '–';
  return new Intl.DateTimeFormat('de-DE', {...opts,timeZone:'UTC'}).format(dateUTC(iso));
}
export function monthLabel(iso) {return dateLabel(iso,{month:'long',year:'numeric'});}
export function weekdayMon0(iso) { return (dateUTC(iso).getUTCDay()+6)%7; }
export function shiftWeekday(iso, mode='none') {
  if(mode==='none') return iso;
  let d=iso, count=0;
  while(weekdayMon0(d)>=5 && count++<3) d=addDays(d,mode==='previous'?-1:1);
  return d;
}
export function addYears(iso,n) { return addYearsAnchored(iso,n); }
export function clampDate(value,min,max) {return value<min?min:value>max?max:value;}
