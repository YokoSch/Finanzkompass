/**
 * model.js — versioniertes Datenmodell. Vorzeichen: Einnahme positiv, Ausgabe negativ.
 * recurrence.anchor = erster NOMINALER Termin; Ausnahmen per occurrenceIndex.
 * currentBalanceCents = bereits BANKSEITIG verbuchter Kontostand am balanceDate.
 */
import {todayISO,addYears,isValidISO} from './date.js';
export const DATA_VERSION=1;
export const STORAGE_KEY='finanzkompass.v1';
export const FREQUENCIES=['none','daily','weekly','monthly','yearly'];
export const WEEKEND_POLICIES=['none','previous','next'];
export const id=()=>`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
export function freshState(now=todayISO()) {
  return {
    version:DATA_VERSION,
    settings:{currentBalanceCents:0,balanceDate:now,viewStart:now,viewEnd:addYears(now,1),reserveCents:0,theme:'system'},
    rules:[], exceptions:[], posted:[],
    updatedAt:new Date().toISOString()
  };
}
export function newRule(input) {
  return {
    id:id(),title:String(input.title||'').trim(),amountCents:input.amountCents,
    anchor:input.anchor,frequency:input.frequency||'none',interval:1,
    until:input.until||null,weekdayPolicy:input.weekdayPolicy||'none',
    note:String(input.note||'').trim(),createdAt:new Date().toISOString()
  };
}
export function validateState(s) {
  if(!s||typeof s!=='object'||s.version!==DATA_VERSION) throw Error('Unbekanntes Datenformat oder Versionsnummer.');
  if(!s.settings||!Array.isArray(s.rules)||!Array.isArray(s.exceptions)||!Array.isArray(s.posted)) throw Error('Die Datendatei ist unvollständig.');
  const set=s.settings;
  for(const k of ['balanceDate','viewStart','viewEnd']) if(!isValidISO(set[k])) throw Error(`Ungültiges Datum: ${k}`);
  for(const k of ['currentBalanceCents','reserveCents']) if(!Number.isSafeInteger(set[k])) throw Error(`Ungültiger Geldbetrag: ${k}`);
  if(set.reserveCents<0) throw Error('Die Sicherheitsreserve darf nicht negativ sein.');
  if(set.viewEnd<set.viewStart) throw Error('Das Enddatum liegt vor dem Startdatum.');
  const ids=new Set();
  for(const r of s.rules){
    if(typeof r.id!=='string'||!r.id||ids.has(r.id))throw Error('Doppelte oder ungültige Buchungs-ID.');
    ids.add(r.id);
    if(typeof r.title!=='string'||!r.title.trim()||!Number.isSafeInteger(r.amountCents)||r.amountCents===0||!isValidISO(r.anchor)||!FREQUENCIES.includes(r.frequency)||!Number.isInteger(r.interval)||r.interval<1||!WEEKEND_POLICIES.includes(r.weekdayPolicy)||r.until&&!isValidISO(r.until))throw Error(`Ungültige Buchungsregel: ${r.title||r.id}`);
  }
  const exKeys=new Set(),postKeys=new Set();
  for(const e of s.exceptions){
    if(!ids.has(e.ruleId)||!Number.isInteger(e.occurrenceIndex)||e.occurrenceIndex<0||!['skip','override'].includes(e.action))throw Error('Ungültige Buchungsausnahme.');
    if(e.action==='override' && (!isValidISO(e.date)||!Number.isSafeInteger(e.amountCents)||e.amountCents===0||typeof e.title!=='string'||!e.title.trim()))throw Error('Ungültige Änderung einer Einzelbuchung.');
    const key=`${e.ruleId}:${e.occurrenceIndex}`;
    if(exKeys.has(key))throw Error('Doppelte Buchungsausnahme.');
    exKeys.add(key);
  }
  for(const p of s.posted){
    if(typeof p.ruleId!=='string'||!Number.isInteger(p.occurrenceIndex)||p.occurrenceIndex<0||!isValidISO(p.date)||!Number.isSafeInteger(p.amountCents)||p.amountCents===0||typeof p.title!=='string'||typeof p.id!=='string'||!Number.isSafeInteger(p.balanceAdjustmentCents||0))throw Error('Ungültiger historischer Eintrag.');
    const key=`${p.ruleId}:${p.occurrenceIndex}`;
    if(postKeys.has(key))throw Error('Doppelt gebuchte Zahlung.');
    postKeys.add(key);
  }
  if(JSON.stringify(s).length>8_000_000)throw Error('Datei zu groß (maximal 8 MB).');
  return s;
}
