/** chart.js — SVG-Chart ohne externe Abhängigkeit.
 * Ausdünnung als Min-Max-Körbe: Peaks/Tiefpunkte bleiben trotz Jahreszoom erhalten.
 */
import {eur} from './money.js';
import {dateLabel} from './date.js';
function sampleDays(days,max=210){
  if(days.length<=max)return days;
  const result=[days[0]], buckets=Math.floor((max-2)/2), width=(days.length-2)/buckets;
  for(let i=0;i<buckets;i++){
    const start=1+Math.floor(i*width),end=1+Math.floor((i+1)*width);
    const chunk=days.slice(start,Math.min(days.length-1,end+1));
    if(!chunk.length)continue;
    let lo=chunk[0],hi=chunk[0];
    for(const d of chunk){if(d.closingCents<lo.closingCents)lo=d;if(d.closingCents>hi.closingCents)hi=d;}
    for(const d of [lo,hi].sort((a,b)=>a.date.localeCompare(b.date)))if(result.at(-1).date!==d.date)result.push(d);
  }
  if(result.at(-1).date!==days.at(-1).date)result.push(days.at(-1));
  return result;
}
export function drawForecastChart(days,reserveCents,selectedDate){
  if(!days.length)return `<div class="empty-chart">Keine Prognose für den gewählten Zeitraum.</div>`;
  const pts=sampleDays(days),w=900,h=248,L=16,R=16,T=20,B=32;
  const data=[...days.map(d=>d.closingCents),...days.map(d=>d.lowCents),reserveCents,0];
  const {lo,hi}=data.reduce((a,v)=>({lo:Math.min(a.lo,v),hi:Math.max(a.hi,v)}),{lo:Infinity,hi:-Infinity});
  const range=Math.max(10000,hi-lo),pad=range*.12;
  const min=lo-pad,max=hi+pad;
  const x=(date)=>L+(days.length===1?0:((Date.parse(date+'T12:00:00Z')-Date.parse(days[0].date+'T12:00:00Z'))/(Date.parse(days.at(-1).date+'T12:00:00Z')-Date.parse(days[0].date+'T12:00:00Z')))*(w-L-R));
  const y=v=>T+(max-v)/(max-min)*(h-T-B);
  const line=pts.map((d,i)=>`${i?'L':'M'} ${x(d.date).toFixed(2)} ${y(d.closingCents).toFixed(2)}`).join(' ');
  const area=`${line} L ${x(days.at(-1).date).toFixed(2)} ${h-B} L ${x(days[0].date).toFixed(2)} ${h-B} Z`;
  const y0=y(0),yReserve=y(reserveCents),lowest=days.reduce((a,b)=>b.lowCents<a.lowCents?b:a,days[0]);
  const idx=days.findIndex(d=>d.date===selectedDate),chosen=idx>=0?days[idx]:null;
  const grid=[0,.25,.5,.75,1].map(k=>{
    const yy=T+k*(h-T-B),val=max-k*(max-min);
    return `<line x1="${L}" y1="${yy}" x2="${w-R}" y2="${yy}" class="chart-grid"/><text x="${L+5}" y="${yy-5}" class="chart-grid-text">${Math.round(val/100/100)*100} €</text>`;
  }).join('');
  const xLabels=[0,.25,.5,.75,1].map(k=>{
    const i=Math.min(days.length-1,Math.round(k*(days.length-1)));
    return `<text x="${x(days[i].date)}" y="${h-4}" class="chart-date" text-anchor="${k===0?'start':k===1?'end':'middle'}">${dateLabel(days[i].date,{month:'short',year:'2-digit'})}</text>`;
  }).join('');
  const marker=chosen?`<line x1="${x(chosen.date)}" y1="${T}" x2="${x(chosen.date)}" y2="${h-B}" class="chart-marker"/><circle cx="${x(chosen.date)}" cy="${y(chosen.closingCents)}" r="6" class="chart-dot"/>`:'';
  return `<div class="chart-wrap">
    <svg class="forecast-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Kontostandsverlauf. Tiefster Zwischenstand ${eur(lowest.lowCents)} am ${dateLabel(lowest.date)}">
      <defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5dbbaa" stop-opacity=".22"/><stop offset="100%" stop-color="#5dbbaa" stop-opacity="0"/></linearGradient></defs>
      ${grid}<path d="${area}" fill="url(#chartFill)"/><line x1="${L}" x2="${w-R}" y1="${y0}" y2="${y0}" class="zero-line"/><line x1="${L}" x2="${w-R}" y1="${yReserve}" y2="${yReserve}" class="reserve-line"/>
      <path d="${line}" class="chart-line"/>${marker}${xLabels}
      <rect x="${L}" y="${T}" width="${w-L-R}" height="${h-T-B}" fill="transparent" data-chart-hit="1"/>
    </svg>
  </div>`;
}
