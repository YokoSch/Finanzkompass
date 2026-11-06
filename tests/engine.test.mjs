import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,newRule,validateState} from '../src/model.js';
import {materializeEvents,nominalDate} from '../src/recurrence.js';
import {forecast} from '../src/forecast.js';
import {changeOccurrence,postOccurrence,cancelOccurrence,undoPosted,cleanAfterManualBalanceUpdate,restoreOccurrence} from '../src/operations.js';
import {addDays,addMonthsAnchored,shiftWeekday,diffDays} from '../src/date.js';
import {parseEuroCents} from '../src/money.js';
const anchor='2026-11-05';
const state=()=>freshState(anchor);
const add=(s,title,cents,date,frequency='none',weekdayPolicy='none')=>{
 const r=newRule({title,amountCents:cents,anchor:date,frequency,weekdayPolicy});s.rules.push(r);return r;
};
test('Eröffnungsstand ohne Buchungen: komplett sicher ausgebbar',()=>{
 const s=state();s.settings.currentBalanceCents=100000;
 const r=forecast(s);
 assert.equal(r.safeSpendCents,100000);assert.equal(r.minDate,anchor);
 assert.equal(r.endCents,100000);
});
test('Tagesrisiko zählt Ausgaben vor gleichzeitigen Einnahmen',()=>{
 const s=state();s.settings.currentBalanceCents=80000;s.settings.viewEnd='2026-11-20';
 add(s,'Miete',-45000,'2026-11-08');add(s,'Gehalt',200000,'2026-11-08');
 const r=forecast(s);
 assert.equal(r.minCents,35000);assert.equal(r.safeSpendCents,35000);
 assert.equal(r.endCents,235000);
});
test('Reserve und Fehlbetrag',()=>{
 const s=state();s.settings.currentBalanceCents=25000;s.settings.reserveCents=10000;
 add(s,'Rate',-30000,'2026-11-10');
 const r=forecast(s);assert.equal(r.safeSpendCents,0);assert.equal(r.shortfallCents,15000);
});
test('Monatsende bleibt am ursprünglichen Zahltag verankert',()=>{
 const r=newRule({title:'Am 31.',amountCents:-1000,anchor:'2027-01-31',frequency:'monthly'});
 assert.equal(nominalDate(r,1),'2027-02-28');assert.equal(nominalDate(r,2),'2027-03-31');
});
test('29. Februar in Nicht-Schaltjahr',()=>{
 const r=newRule({title:'Jahrestag',amountCents:-1000,anchor:'2024-02-29',frequency:'yearly'});
 assert.equal(nominalDate(r,1),'2025-02-28');assert.equal(nominalDate(r,4),'2028-02-29');
});
test('Monatliches Gehalt im Dezember vom 15. auf 12. verschieben ohne Duplikat',()=>{
 const s=state();s.settings.viewEnd='2027-02-28';
 const r=add(s,'Gehalt',200000,'2026-11-15','monthly');
 const ev=materializeEvents(s,'2026-11-05','2027-02-28').find(e=>e.nominalDate==='2026-12-15');
 changeOccurrence(s,ev,{title:'Gehalt',amountCents:200000,date:'2026-12-12'},'once');
 const entries=materializeEvents(s,'2026-12-01','2026-12-31');
 assert.equal(entries.length,1);assert.equal(entries[0].date,'2026-12-12');
 assert.equal(materializeEvents(s,'2027-01-01','2027-01-31')[0].date,'2027-01-15');
});
test('Zukünftige Serienänderung teilt den Plan korrekt',()=>{
 const s=state();const r=add(s,'Gehalt',200000,'2026-11-15','monthly');
 const dec=materializeEvents(s,anchor,'2027-03-01').find(x=>x.nominalDate==='2026-12-15');
 changeOccurrence(s,dec,{title:'Neues Gehalt',amountCents:230000,date:'2026-12-12'},'future');
 const events=materializeEvents(s,anchor,'2027-03-01');
 assert.deepEqual(events.map(x=>[x.date,x.amountCents]),[
  ['2026-11-15',200000],['2026-12-12',230000],['2027-01-12',230000],['2027-02-12',230000]
 ]);
 assert.equal(s.rules.length,2);
});
test('Wochenendverschiebung berücksichtigt Kalendergrenze',()=>{
 assert.equal(shiftWeekday('2026-11-01','previous'),'2026-10-30');
 assert.equal(shiftWeekday('2026-11-01','next'),'2026-11-02');
});
test('Bankbuchung entfernt geplanten Umsatz und passt Betrag optional an',()=>{
 const s=state();s.settings.currentBalanceCents=100000;
 const r=add(s,'Abo',-4000,'2026-11-07');
 const ev=materializeEvents(s,anchor,'2026-11-30')[0];
 postOccurrence(s,ev,'adjust',-4200);
 assert.equal(s.settings.currentBalanceCents,95800);
 assert.equal(materializeEvents(s,anchor,'2026-11-30').length,0);
 assert.equal(forecast(s).safeSpendCents,95800);
 undoPosted(s,s.posted[0]);
 assert.equal(s.settings.currentBalanceCents,100000);
 assert.equal(materializeEvents(s,anchor,'2026-11-30').length,1);
});
test('Bereits enthaltener Kontoumsatz wird nicht doppelt abgezogen',()=>{
 const s=state();s.settings.currentBalanceCents=50000;
 add(s,'Strom',-7000,'2026-11-07');
 postOccurrence(s,materializeEvents(s,anchor,'2026-11-20')[0],'included');
 assert.equal(s.settings.currentBalanceCents,50000);
 assert.equal(forecast(s).safeSpendCents,50000);
});
test('Neuer manueller Kontostand überschreibt rückgängigfähige Saldoänderungen',()=>{
 const s=state();s.settings.currentBalanceCents=50000;
 add(s,'Strom',-7000,'2026-11-07');
 postOccurrence(s,materializeEvents(s,anchor,'2026-11-20')[0],'adjust');
 cleanAfterManualBalanceUpdate(s);s.settings.currentBalanceCents=80000;
 undoPosted(s,s.posted[0]);assert.equal(s.settings.currentBalanceCents,80000);
});
test('Serie einzeltermin ausfallen lassen und wiederherstellen',()=>{
 const s=state();add(s,'Versicherung',-7000,'2026-11-12','monthly');
 let ev=materializeEvents(s,anchor,'2026-12-31')[0];
 cancelOccurrence(s,ev);
 assert.equal(materializeEvents(s,anchor,'2026-12-31').length,1);
 restoreOccurrence(s,ev.ruleId,ev.occurrenceIndex);
 assert.equal(materializeEvents(s,anchor,'2026-12-31').length,2);
});
test('Nicht verschachtelte Betragsangaben',()=>{
 assert.equal(parseEuroCents('1.234,56'),123456);
 assert.equal(parseEuroCents('-15,30'),-1530);
 assert.equal(parseEuroCents('1,234'),null);
 assert.equal(parseEuroCents('8.20'),820);
});
test('Ungültiger JSON-Datensatz wird zurückgewiesen',()=>{
 const s=state();add(s,'Test',-1000,anchor);s.exceptions.push({id:'bad',ruleId:'unbekannt',occurrenceIndex:0,action:'skip'});
 assert.throws(()=>validateState(s),/ausnahme/i);
});
test('Kalendarische Tage sind DST-unabhängig',()=>{
 assert.equal(addDays('2026-03-29',1),'2026-03-30');
 assert.equal(diffDays('2026-10-26','2026-10-25'),1);
});

test('Gesamte Serie verschieben behält den ursprünglichen Monatsbeginn',()=>{
 const s=state();const rule=add(s,'Gehalt',200000,'2026-11-15','monthly');
 const dec=materializeEvents(s,anchor,'2027-02-28').find(x=>x.nominalDate==='2026-12-15');
 changeOccurrence(s,dec,{title:'Gehalt',amountCents:200000,date:'2026-12-12'},'all');
 assert.equal(rule.anchor,'2026-11-12');
 assert.deepEqual(materializeEvents(s,anchor,'2027-02-28').map(x=>x.date),[
  '2026-11-12','2026-12-12','2027-01-12','2027-02-12'
 ]);
});
test('Gebuchte Snapshots bleiben nach Serienaufteilung in Kalender/Historie sichtbar',()=>{
 const s=state();add(s,'Lohn',200000,'2026-11-15','monthly');
 const dec=materializeEvents(s,anchor,'2027-03-01').find(x=>x.nominalDate==='2026-12-15');
 postOccurrence(s,dec,'included');
 changeOccurrence(s,dec,{title:'Lohn 2',amountCents:200000,date:'2026-12-12'},'future');
 const history=materializeEvents(s,anchor,'2026-11-30',{includePosted:true});
 assert.equal(history.filter(x=>x.posted).length,1);
});
test('Negativer Kontostand lässt sich mit Vorzeichen für Formular rendern',async()=>{
 const {toSignedEuroInput}=await import('../src/money.js');
 assert.equal(toSignedEuroInput(-15250),'-152,50');
});

test('Betragsänderung ab Wochenende führt nicht zu unbeabsichtigter Serienverschiebung',()=>{
 const s=state();const rule=add(s,'Zahlung',-10000,'2026-11-15','monthly','next');
 const nov=materializeEvents(s,anchor,'2026-12-31')[0];
 assert.equal(nov.date,'2026-11-16');
 changeOccurrence(s,nov,{title:'Zahlung',amountCents:-12000,date:nov.date},'future');
 const dates=materializeEvents(s,anchor,'2027-01-31').map(x=>x.date);
 assert.deepEqual(dates,['2026-11-16','2026-12-15','2027-01-15']);
});
test('Gesamte Serie aus bereits verschobener Einzelbuchung umstellen',()=>{
 const s=state();add(s,'Lohn',200000,'2026-11-15','monthly');
 const dec=materializeEvents(s,anchor,'2027-01-31').find(x=>x.nominalDate==='2026-12-15');
 changeOccurrence(s,dec,{title:'Lohn',amountCents:200000,date:'2026-12-12'},'once');
 const moved=materializeEvents(s,anchor,'2027-01-31').find(x=>x.date==='2026-12-12');
 changeOccurrence(s,moved,{title:'Lohn',amountCents:200000,date:'2026-12-12'},'all');
 assert.equal(s.rules[0].anchor,'2026-11-12');
 assert.equal(materializeEvents(s,anchor,'2027-01-31').find(x=>x.date==='2027-01-12')?.title,'Lohn');
});
