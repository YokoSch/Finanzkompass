/*
 * Modul operations.js – Browser-kompatibel auch über file://.
 * Eigenständiger Scope: nur die bewusst exportierten Funktionen werden
 * unter globalThis.FinanzkompassModules.operations veröffentlicht.
 * Die Abhängigkeiten werden durch die Reihenfolge der defer-Skripte in
 * /index.html geladen; kein Build, kein Server und keine Bibliothek nötig.
 */
(function(modules) {
'use strict';
const {id,newRule} = modules.model;
const {nominalDate,occurrenceAt} = modules.recurrence;
const {addDays,addMonthsAnchored,monthLength,pad,diffDays} = modules.date;
/**
 * operations.js — fachliche Mutationen, zentral für alle UI-Eingabewege.
 * Übergabe: editierbarer State-Klon. UI ruft danach commit() mit Validierung.
 */
function putException(s,e){
  s.exceptions=s.exceptions.filter(x=>!(x.ruleId===e.ruleId&&x.occurrenceIndex===e.occurrenceIndex));
  s.exceptions.push(e);
}
/** Verschiebt den Serienanker, ohne die Terminnummer des geöffneten Vorkommens
 * als neues Serien-Startdatum zu missdeuten. Z. B. Dez 15 -> Dez 12 bedeutet
 * für die GESAMTE Serie Nov 15 -> Nov 12 (nicht Neustart in Dezember).
 */
function shiftedSeriesAnchor(rule,index,newDate,currentDisplayedDate){
  if(newDate===currentDisplayedDate)return rule.anchor;
  const nominal=nominalDate(rule,index);
  if(rule.frequency==='monthly'||rule.frequency==='yearly'){
    const [ny,nm]=nominal.split('-').map(Number);
    const [ty,tm,td]=newDate.split('-').map(Number);
    const deltaMonths=(ty-ny)*12+(tm-nm);
    const base=addMonthsAnchored(rule.anchor,deltaMonths);
    const [by,bm]=base.split('-').map(Number);
    return `${by}-${pad(bm)}-${pad(Math.min(td,monthLength(by,bm)))}`;
  }
  return addDays(rule.anchor,diffDays(newDate,nominal));
}
function changeOccurrence(s,ev,values,scope='once'){
  const rule=s.rules.find(r=>r.id===ev.ruleId);
  if(!rule)throw Error('Die ursprüngliche Buchungsregel ist nicht mehr vorhanden.');
  const patch={title:values.title.trim(),amountCents:values.amountCents,date:values.date};
  if(scope==='once'){
    if(rule.frequency==='none'){
      Object.assign(rule,{title:patch.title,amountCents:patch.amountCents,anchor:patch.date});
      s.exceptions=s.exceptions.filter(x=>x.ruleId!==rule.id);
    }else{
      putException(s,{id:id(),ruleId:rule.id,occurrenceIndex:ev.occurrenceIndex,action:'override',...patch,note:values.note||''});
    }
  }else if(scope==='all'||rule.frequency==='none'){
    // Änderungsfolge: Indizes bleiben stabil; vergangene Buchungen sind in posted snapshotbasiert.
    Object.assign(rule,{title:patch.title,amountCents:patch.amountCents,anchor:shiftedSeriesAnchor(rule,ev.occurrenceIndex,patch.date,ev.exception?nominalDate(rule,ev.occurrenceIndex):ev.date)});
  }else if(scope==='future'){
    const index=ev.occurrenceIndex;
    if(index===0){
      const anchor=(!ev.exception&&patch.date===ev.date)?nominalDate(rule,0):patch.date;
      Object.assign(rule,{title:patch.title,amountCents:patch.amountCents,anchor});
      return;
    }
    const oldEnd=rule.until;
    rule.until=nominalDate(rule,index-1);
    // Bei unverändertem Datum den NOMINALTERMIN als Serienanker behalten.
    // Beispiel: Samstag 15. -> Mo 17. darf nach einer reinen Betragsanpassung
    // nicht künftig auf den 17. jedes Monats umgestellt werden.
    const nextAnchor=(!ev.exception&&patch.date===ev.date)?nominalDate(rule,index):patch.date;
    const newer=newRule({title:patch.title,amountCents:patch.amountCents,anchor:nextAnchor,
      frequency:rule.frequency,until:oldEnd,weekdayPolicy:rule.weekdayPolicy,note:rule.note});
    newer.interval=rule.interval;
    s.rules.push(newer);
    // Folgetermin-Ausnahmen wandern auf den neuen Anker; ursprüngliche Ausnahmedaten bleiben.
    s.exceptions=s.exceptions.map(x=>x.ruleId===rule.id&&x.occurrenceIndex>=index?
      {...x,ruleId:newer.id,occurrenceIndex:x.occurrenceIndex-index}:x);
    // Im Voraus gebuchte Vorkommen behalten ihre Identität/Historie.
    // Sie werden absichtlich NICHT in die neue Serie eingebucht.
  }else throw Error('Unbekannter Änderungsumfang.');
}
function cancelOccurrence(s,ev){
  const rule=s.rules.find(r=>r.id===ev.ruleId);
  if(!rule)return;
  if(rule.frequency==='none')deleteRule(s,rule.id);
  else putException(s,{id:id(),ruleId:ev.ruleId,occurrenceIndex:ev.occurrenceIndex,action:'skip'});
}
function restoreOccurrence(s,ruleId,index){
  s.exceptions=s.exceptions.filter(x=>!(x.ruleId===ruleId&&x.occurrenceIndex===index));
}
function deleteRule(s,ruleId){
  s.rules=s.rules.filter(r=>r.id!==ruleId);
  s.exceptions=s.exceptions.filter(e=>e.ruleId!==ruleId);
  // Posted-Snapshots explizit behalten: echte Kontohistorie darf nicht verschwinden.
}
/**
 * bookingMode='adjust': Wertung als tatsächlicher Kontoumsatz; aktuellen Kontostand
 * unmittelbar mit dem Betrag ändern. 'included': Konto-Saldo war bereits aktualisiert.
 * Beide Modi entfernen das Planereignis dauerhaft aus der Prognose.
 */
function postOccurrence(s,ev,bookingMode='adjust',actualAmountCents=ev.amountCents,actualDate=s.settings.balanceDate){
  if(s.posted.some(p=>p.ruleId===ev.ruleId&&p.occurrenceIndex===ev.occurrenceIndex))throw Error('Bereits gebucht.');
  const delta=bookingMode==='adjust'?actualAmountCents:0;
  s.posted.push({id:id(),ruleId:ev.ruleId,occurrenceIndex:ev.occurrenceIndex,
    date:actualDate,title:ev.title,amountCents:actualAmountCents,
    balanceAdjustmentCents:delta,createdAt:new Date().toISOString()});
  s.settings.currentBalanceCents+=delta;
}
function undoPosted(s,p){
  s.posted=s.posted.filter(x=>x.id!==p.id);
  s.settings.currentBalanceCents-=(p.balanceAdjustmentCents||0);
}
function cleanAfterManualBalanceUpdate(s){
  // Kontostand wird als neue absolute Momentaufnahme erfasst.
  // Bereits gebuchte Belege bleiben erhalten; beim 'Rückgängig' dürfen deren
  // historische automatischen Saldoanpassungen nicht mehr verrechnet werden.
  s.posted=s.posted.map(p=>({...p,balanceAdjustmentCents:0}));
}
// Nur dieses Modul exportiert seine öffentliche API.
modules.operations = Object.freeze({ putException, shiftedSeriesAnchor, changeOccurrence, cancelOccurrence, restoreOccurrence, deleteRule, postOccurrence, undoPosted, cleanAfterManualBalanceUpdate });
})(globalThis.FinanzkompassModules || (globalThis.FinanzkompassModules = Object.create(null)));
