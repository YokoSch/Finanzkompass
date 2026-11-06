/**
 * recurrence.js — erzeugt deterministische Vorkommen einer Buchungsregel.
 * WICHTIG: Monats-/Jahresdatum IMMER vom Anker aus berechnen, nicht iterativ:
 * 31.01. -> 28.02. -> 31.03. statt versehentlich dauerhaft am 28.
 * Weekend shift verändert nur das effektive Datum, nicht den Nominaltermin.
 */
import {addDays,addMonthsAnchored,addYearsAnchored,shiftWeekday,diffDays,isValidISO} from './date.js';
export function nominalDate(rule,index){
  const step=index*(rule.interval||1);
  switch(rule.frequency){
    case 'none': return index===0?rule.anchor:null;
    case 'daily': return addDays(rule.anchor,step);
    case 'weekly': return addDays(rule.anchor,7*step);
    case 'monthly': return addMonthsAnchored(rule.anchor,step);
    case 'yearly': return addYearsAnchored(rule.anchor,step);
    default: throw Error('Unbekannte Wiederholung');
  }
}
function estimateLastIndex(rule, until){
  if(rule.frequency==='none')return 0;
  const days=Math.max(0,diffDays(until,rule.anchor)), i=rule.interval||1;
  if(rule.frequency==='daily')return Math.floor(days/i)+2;
  if(rule.frequency==='weekly')return Math.floor(days/(7*i))+2;
  const [y1,m1]=rule.anchor.split('-').map(Number),[y2,m2]=until.split('-').map(Number);
  const months=(y2-y1)*12+m2-m1;
  return Math.max(0,Math.floor(months/((rule.frequency==='yearly'?12:1)*i))+2);
}
export function occurrenceAt(rule,index,exception=null){
  const nominal=nominalDate(rule,index);
  if(!nominal||(rule.until && nominal>rule.until))return null;
  if(exception?.action==='skip')return null;
  return {
    key:`${rule.id}:${index}`,ruleId:rule.id,occurrenceIndex:index,
    nominalDate:nominal,
    date:exception?.action==='override'?exception.date:shiftWeekday(nominal,rule.weekdayPolicy),
    title:exception?.action==='override'?exception.title:rule.title,
    amountCents:exception?.action==='override'?exception.amountCents:rule.amountCents,
    note:exception?.action==='override'?(exception.note||''):rule.note,
    repeat:rule.frequency!=='none',exception:!!exception,
    frequency:rule.frequency
  };
}
export function materializeEvents(s, from, to, {includePosted=false}={}) {
  if(!isValidISO(from)||!isValidISO(to)||to<from)return [];
  const exceptions=new Map(s.exceptions.map(e=>[`${e.ruleId}:${e.occurrenceIndex}`,e]));
  const posted=new Map(s.posted.map(p=>[`${p.ruleId}:${p.occurrenceIndex}`,p]));
  const events=[];
  for(const rule of s.rules){
    // 4 Tage Puffer für Verschiebungen über Monats-/Jahresgrenzen; darüber hinaus
    // werden manuelle Ausnahmen durch die Indexgrenze mit einbezogen.
    let limit=addDays(to,4);
    for(const e of s.exceptions)if(e.ruleId===rule.id){
      const d=nominalDate(rule,e.occurrenceIndex);
      if(d&&d>limit&&e.action==='override'&&e.date<=to)limit=d;
    }
    const upper=estimateLastIndex(rule,limit);
    // Schutz gegen versehentliche tägliche Millionen-Simulationen.
    if(upper>450000)throw Error('Zu viele Einzeltermine. Bitte Simulationszeitraum verkürzen.');
    for(let i=0;i<=upper;i++){
      const nominal=nominalDate(rule,i);
      if(!nominal || nominal>limit || (rule.until&&nominal>rule.until))break;
      const key=`${rule.id}:${i}`,p=posted.get(key);
      if(p)continue; // gebuchte Snapshots unten zentral einsammeln
      const event=occurrenceAt(rule,i,exceptions.get(key));
      if(event && event.date>=from&&event.date<=to) events.push({...event,posted:false});
    }
  }
  // Alle gebuchten Snapshots unabhängig vom Lebenszyklus der Regel anzeigen.
  // Wichtig nach Serien-Splits, dem Löschen von Regeln und Datumskorrekturen.
  if(includePosted){
    for(const p of s.posted)if(p.date>=from&&p.date<=to){
      const source=s.rules.find(r=>r.id===p.ruleId);
      events.push({...p,key:`${p.ruleId}:${p.occurrenceIndex}`,posted:true,repeat:source?.frequency!=='none'});
    }
  }
  events.sort((a,b)=>a.date.localeCompare(b.date)||a.amountCents-b.amountCents||a.title.localeCompare(b.title));
  return events;
}
export function upcomingOccurrences(s,rule,count=5,asOf=s.settings.balanceDate){
  const until=addYearsAnchored(asOf,3);
  return materializeEvents({...s,rules:[rule]},asOf,until).slice(0,count);
}
