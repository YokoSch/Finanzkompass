/*
 * Modul forecast.js – Browser-kompatibel auch über file://.
 * Eigenständiger Scope: nur die bewusst exportierten Funktionen werden
 * unter globalThis.FinanzkompassModules.forecast veröffentlicht.
 * Die Abhängigkeiten werden durch die Reihenfolge der defer-Skripte in
 * /index.html geladen; kein Build, kein Server und keine Bibliothek nötig.
 */
(function(modules) {
'use strict';
const {materializeEvents} = modules.recurrence;
const {addDays,diffDays,addYearsAnchored} = modules.date;
/**
 * forecast.js — rein funktionale Liquiditätsrechnung, frei von UI und Storage.
 * Standardannahme: Belastungen eines Tages VOR Gutschriften (konservativ).
 * safeSpend = max(0, kleinstes Tages-Zwischentief − Reserve).
 * Die Auswahl viewStart betrifft nur die Anzeige. Risikoprüfung startet IMMER
 * am Kontoanker/balanceDate, sonst würden Engpässe vor dem Zoom ausgeblendet.
 */
function forecast(state,end=state.settings.viewEnd){
  const {balanceDate,currentBalanceCents,reserveCents}=state.settings;
  if(end<balanceDate)return {
    days:[],events:[],minCents:currentBalanceCents,minDate:balanceDate,
    safeSpendCents:Math.max(0,currentBalanceCents-reserveCents),shortfallCents:Math.max(0,reserveCents-currentBalanceCents),
    endCents:currentBalanceCents,emptyHorizon:true
  };
  if(diffDays(end,balanceDate)>160000)throw Error('Simulationszeitraum übersteigt die technische Grenze von 160.000 Tagen.');
  const events=materializeEvents(state,balanceDate,end);
  const byDay=new Map();
  for(const e of events){
    if(!byDay.has(e.date))byDay.set(e.date,[]);
    byDay.get(e.date).push(e);
  }
  let balance=currentBalanceCents,minCents=balance,minDate=balanceDate;
  const days=[];
  for(let date=balanceDate;date<=end;date=addDays(date,1)){
    const entries=byDay.get(date)||[];
    const debit=entries.reduce((s,e)=>s+Math.min(0,e.amountCents),0);
    const credit=entries.reduce((s,e)=>s+Math.max(0,e.amountCents),0);
    const low=balance+debit;
    if(low<minCents){minCents=low;minDate=date;}
    const opening=balance;
    balance=low+credit;
    days.push({date,openingCents:opening,debitCents:debit,creditCents:credit,lowCents:low,closingCents:balance,count:entries.length});
  }
  return {
    days,events,minCents,minDate,endCents:balance,
    safeSpendCents:Math.max(0,minCents-reserveCents),
    shortfallCents:Math.max(0,reserveCents-minCents),emptyHorizon:false
  };
}
function dateBalance(forecastResult,date,initialCents){
  const row=forecastResult.days.find(d=>d.date===date);
  return row?.closingCents??initialCents;
}
/** Durchschnittlicher Netto-Cashflow in den kommenden 12 Monaten, nur Serien.
 * Im Unterschied zu pauschalen Frequenzfaktoren berücksichtigt diese Kennzahl
 * echte Enddaten, Verschiebungen und Ausnahmen sowie „bereits gebucht“.
 * Noch gebuchte Zahlungen zählen NICHT dazu, weil sie im Ist-Kontostand stecken.
 */
function estimatedMonthlySurplus(s){
  const start=s.settings.balanceDate,end=addDays(addYearsAnchored(start,1),-1);
  const total=materializeEvents(s,start,end).filter(e=>e.repeat).reduce((sum,e)=>sum+e.amountCents,0);
  return Math.round(total/12);
}
// Nur dieses Modul exportiert seine öffentliche API.
modules.forecast = Object.freeze({ forecast, dateBalance, estimatedMonthlySurplus });
})(globalThis.FinanzkompassModules || (globalThis.FinanzkompassModules = Object.create(null)));
