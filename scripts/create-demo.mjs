/** Fakultative Beispieldatei, wird NIE automatisch beim Start importiert. */
import {writeFile} from 'node:fs/promises';
import {freshState,newRule} from '../src/model.js';
import {todayISO,addMonthsAnchored,startOfMonth,pad} from '../src/date.js';
const now=todayISO(),s=freshState(now);
s.settings.currentBalanceCents=175000;
function upcoming(day){
 const first=now.slice(0,7)+`-${pad(day)}`;
 return first>=now?first:addMonthsAnchored(first,1);
}
for(const [title,cents,date,frequency] of [
 ['Gehalt',215000,upcoming(15),'monthly'],
 ['Miete',-78000,upcoming(1),'monthly'],
 ['Strom',-5800,upcoming(8),'monthly'],
 ['Internet',-3000,upcoming(20),'monthly'],
 ['ÖPNV',-6300,upcoming(25),'monthly'],
 ['Lebensmittel',-6500,now,'none']
])s.rules.push(newRule({title,amountCents:cents,anchor:date,frequency}));
await writeFile(new URL('../Beispieldaten.json',import.meta.url),JSON.stringify(s,null,2)+'\n');
console.log('Beispieldaten.json erstellt — nur für freiwilligen Import.');
