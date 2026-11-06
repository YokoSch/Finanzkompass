/** money.js — Geld in Cent / deutsche Betragseingaben. */
export function eur(cents,{signed=false,minimumFractionDigits=2}={}) {
  const val=cents/100;
  return (signed && cents>0?'+':'') + new Intl.NumberFormat('de-DE',{
    style:'currency',currency:'EUR',minimumFractionDigits,maximumFractionDigits:2
  }).format(val);
}
export function parseEuroCents(raw) {
  if(typeof raw==='number') return Number.isFinite(raw)?Math.round(raw*100):null;
  let x=String(raw??'').trim().replace(/[€\s\u00a0]/g,'');
  if(!x) return null;
  // 1.234,56 oder 1234.56 oder 1234,56
  if(x.includes(',') && x.includes('.')) x=x.replace(/\./g,'').replace(',','.');
  else if(x.includes(',')) x=x.replace(',','.');
  if(!/^-?\d+(?:\.\d{1,2})?$/.test(x)) return null;
  const c=Math.round(Number(x)*100);
  return Number.isSafeInteger(c)?c:null;
}
export function toEuroInput(cents) {return (Math.abs(cents)/100).toFixed(2).replace('.',',');}
export function toSignedEuroInput(cents) {return (cents/100).toFixed(2).replace('.',',');}
