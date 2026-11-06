/**
 * ui-actions.js — einzige Stelle für Eventhandling / Benutzeraktionen.
 * Die Oberflächenfunktionen erzeugen nur HTML; Fachlogik: operations.js;
 * Rechenkern: forecast.js. Keine Inline-onclick-Handler.
 */
import {todayISO,startOfMonth,addMonthsAnchored,addYearsAnchored,isValidISO,dateLabel,diffDays} from './date.js';
import {eur,parseEuroCents,toEuroInput,toSignedEuroInput} from './money.js';
import {newRule,freshState,validateState} from './model.js';
import {materializeEvents} from './recurrence.js';
import {forecast} from './forecast.js';
import {loadState,saveState,exportState,importState,getPersistenceMode} from './persistence.js';
import {changeOccurrence,cancelOccurrence,deleteRule,restoreOccurrence,postOccurrence,undoPosted,cleanAfterManualBalanceUpdate} from './operations.js';
import {renderApp,renderRules} from './ui-render.js';
function requireMoney(raw,allowNegative=false){
  const c=parseEuroCents(raw);
  if(c===null||(allowNegative?false:c<=0))throw Error('Bitte einen gültigen Betrag mit maximal zwei Nachkommastellen eingeben.');
  return c;
}
function requireDate(date){if(!isValidISO(date))throw Error('Bitte ein gültiges Datum eingeben.');return date;}
export class FinanceUI {
  constructor(root){
    this.root=root;
    const loaded=loadState();
    this.state=loaded.state;
    this.view='overview';this.modal=null;this.toast=null;this.search='';this.bookingFilter='all';
    this.calendarMonth=startOfMonth(todayISO());this.selectedDay=todayISO();
    this.chartDate=null;this.rangePreset='1y';this.eventMap=new Map();
    this.confirmAction=null;this.toastTimer=null;
    this.updateTheme();
    this.registerEvents();this.render();
    if(loaded.warning)this.showToast(loaded.warning,true);
  }
  updateTheme(){
    const setting=this.state.settings.theme||'system';
    const dark=setting==='dark'||(setting==='system'&&window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme=dark?'dark':'light';
  }
  render(){
    this.persistenceMode=getPersistenceMode();
    try{
      this.result=forecast(this.state);
      this.eventMap=new Map();
      this.root.innerHTML=renderApp(this);
    }catch(error){
      console.error('Rendering/Forecast:',error);
      this.root.innerHTML=`<div style="font-family:system-ui;padding:40px;max-width:560px;margin:auto"><h1>Simulation fehlgeschlagen</h1><p>${String(error.message).replace(/[<>]/g,'')}</p><p>Deine Daten bleiben gespeichert. Lade die Seite nach einem Import erneut, oder verwende eine kürzere Simulation.</p><button onclick="location.reload()">Neu laden</button></div>`;
    }
  }
  showToast(message,error=false,undo=null){
    clearTimeout(this.toastTimer);
    this.toast={message,error,undo};this.render();
    this.toastTimer=setTimeout(()=>{this.toast=null;this.render();},error?8000:4200);
  }
  mutate(fn,message,{undo=true}={}){
    const before=structuredClone(this.state),next=structuredClone(this.state);
    try{fn(next);validateState(next);forecast(next);saveState(next);
      this.state=next;this.modal=null;this.confirmAction=null;
      if(message)this.showToast(message,false,undo?before:null);else this.render();
    }catch(error){this.captureDraft();this.showToast(error.message,true);}
  }
  replaceState(next,message){
    try{validateState(next);forecast(next);saveState(next);this.state=next;
      this.modal=null;this.rangePreset='custom';this.calendarMonth=startOfMonth(todayISO());this.selectedDay=todayISO();this.updateTheme();this.showToast(message);
    }catch(error){this.showToast(error.message,true);}
  }
  openModal(type,draft={},extra={}){
    this.modal={type,draft,...extra};this.render();
    requestAnimationFrame(()=>{
      const input=this.root.querySelector('.overlay input:not([type="radio"]):not([type="hidden"])');
      if(input&&!['post','occurrences'].includes(type))input.focus({preventScroll:true});
    });
  }
  openNew(date=todayISO(),prefill=null){
    this.openModal('entry',{
      title:prefill?.title||'',amount:prefill?toEuroInput(prefill.amountCents):'',
      date,kind:prefill?.amountCents>0?'income':'expense',
      frequency:prefill?.frequency||'none',weekdayPolicy:prefill?.weekdayPolicy||'none',
      until:prefill?.until||'',note:prefill?.note||''
    });
  }
  openEditRule(id){
    const r=this.state.rules.find(x=>x.id===id);if(!r)return;
    this.openModal('edit-rule',{
      title:r.title,amount:toEuroInput(r.amountCents),kind:r.amountCents>0?'income':'expense',
      date:r.anchor,frequency:r.frequency,weekdayPolicy:r.weekdayPolicy,until:r.until||'',note:r.note||''
    },{ruleId:r.id});
  }
  openEvent(key){
    const event=this.eventMap.get(key);
    if(!event)return this.showToast('Diese Buchung wurde nicht gefunden.',true);
    this.openModal('occurrence',{title:event.title,amount:toEuroInput(event.amountCents),date:event.date,scope:'once'}, {event});
  }
  confirm(title,description,confirmText,action){
    this.confirmAction=action;
    this.openModal('confirm',{}, {title,description,confirmText});
  }
  captureDraft(){
    const m=this.modal,form=this.root.querySelector('.overlay form');if(!m||!form)return;
    const f=new FormData(form);
    const result={...m.draft};
    for(const [key,val] of f)result[key]=val;
    result.expandMore=Boolean(form.querySelector('details[open]'));
    m.draft=result;
  }
  registerEvents(){
    this.root.addEventListener('click',ev=>this.handleClick(ev));
    this.root.addEventListener('submit',ev=>this.handleSubmit(ev));
    this.root.addEventListener('change',ev=>this.handleChange(ev));
    this.root.addEventListener('input',ev=>this.handleInput(ev));
    this.root.addEventListener('keydown',ev=>{
      if(ev.key==='Escape'&&this.modal){this.modal=null;this.render();}
      if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches('[role="button"][data-action]')){ev.preventDefault();ev.target.click();}
    });
    const themeMedia=window.matchMedia?.('(prefers-color-scheme: dark)');
    themeMedia?.addEventListener?.('change',()=>this.updateTheme());
  }
  handleClick(ev){
    if(ev.target.matches('[data-overlay]')){this.modal=null;this.render();return;}
    const node=ev.target.closest('[data-action]');
    if(!node){
      const hit=ev.target.closest('[data-chart-hit]');
      if(hit){
        const svg=hit.closest('svg'),rect=svg.getBoundingClientRect(),x=(ev.clientX-rect.left)/rect.width;
        const days=this.result.days.filter(d=>d.date>=this.state.settings.viewStart&&d.date<=this.state.settings.viewEnd);
        if(days.length){const i=Math.max(0,Math.min(days.length-1,Math.round((x-.018)/.964*(days.length-1))));this.chartDate=days[i].date;this.render();}
      }
      return;
    }
    const a=node.dataset.action,id=node.dataset.id,key=node.dataset.key;
    switch(a){
      case 'nav':this.view=node.dataset.view;this.modal=null;this.render();break;
      case 'new-entry':this.openNew(node.dataset.date||todayISO());break;
      case 'edit-balance':this.openModal('balance',{amount:toSignedEuroInput(this.state.settings.currentBalanceCents)});break;
      case 'edit-reserve':this.openModal('reserve',{amount:toEuroInput(this.state.settings.reserveCents)});break;
      case 'range-custom':this.openModal('range',{start:this.state.settings.viewStart,end:this.state.settings.viewEnd});break;
      case 'range-preset':this.applyRangePreset(node.dataset.preset);break;
      case 'calendar-prev':this.calendarMonth=startOfMonth(addMonthsAnchored(this.calendarMonth,-1));this.selectedDay=this.calendarMonth;this.render();break;
      case 'calendar-next':this.calendarMonth=startOfMonth(addMonthsAnchored(this.calendarMonth,1));this.selectedDay=this.calendarMonth;this.render();break;
      case 'calendar-today':this.calendarMonth=startOfMonth(todayISO());this.selectedDay=todayISO();this.render();break;
      case 'select-day':this.selectedDay=node.dataset.date;this.render();break;
      case 'calendar-from-chart':{
        const d=this.chartDate||this.result.minDate;
        this.selectedDay=d;this.calendarMonth=startOfMonth(d);this.view='calendar';this.render();break;
      }
      case 'edit-event':this.openEvent(key);break;
      case 'edit-rule':this.openEditRule(id);break;
      case 'show-occurrences':this.openModal('occurrences',{}, {ruleId:id});break;
      case 'delete-rule':{
        const rule=this.state.rules.find(x=>x.id===id);if(!rule)return;
        this.confirm('Buchungsregel löschen?',`„${rule.title}“ und alle noch geplanten Termine werden entfernt. Bereits gebuchte Zahlungen bleiben als Historie erhalten.`,'Regel löschen',()=>this.mutate(s=>deleteRule(s,id),'Buchungsregel gelöscht.'));
        break;
      }
      case 'filter-bookings':this.bookingFilter=node.dataset.filter;this.render();break;
      case 'close-modal':this.modal=null;this.render();break;
      case 'confirm-action':{
        const fn=this.confirmAction;this.confirmAction=null;if(fn)fn();break;
      }
      case 'prefill-rule':{
        this.captureDraft();const rule=this.state.rules.find(r=>r.id===id);
        if(rule){Object.assign(this.modal.draft,{title:rule.title,amount:toEuroInput(rule.amountCents),kind:rule.amountCents>0?'income':'expense'});this.render();}
        break;
      }
      case 'cancel-event':{
        const e=this.modal?.event;if(!e)return;
        this.mutate(s=>cancelOccurrence(s,e),e.repeat?'Einzeltermin fällt aus.':'Einzelbuchung gelöscht.');break;
      }
      case 'restore-skipped':{
        const index=Number(node.dataset.index);
        this.mutate(s=>restoreOccurrence(s,id,index),'Ausgefallener Einzeltermin wiederhergestellt.');break;
      }
      case 'restore-event':{
        const e=this.modal?.event;if(!e)return;
        this.mutate(s=>restoreOccurrence(s,e.ruleId,e.occurrenceIndex),'Ausnahme entfernt, Standardtermin wiederhergestellt.');break;
      }
      case 'post-event':{
        const e=this.modal?.event;if(!e)return;
        this.openModal('post',{amount:toEuroInput(e.amountCents),date:todayISO()},{event:e});break;
      }
      case 'undo-posted':{
        const p=this.state.posted.find(x=>x.id===id);
        if(p)this.mutate(s=>undoPosted(s,p),'Buchung zurückgenommen.');break;
      }
      case 'experiment':this.openModal('experiment',{amount:'',date:todayISO()});break;
      case 'adopt-experiment':{
        if(!this.modal?.result)return;
        const d=this.modal.draft;this.openNew(d.date,{title:'Zusätzliche Ausgabe',amountCents:-this.modal.testAmountCents,frequency:'none'});break;
      }
      case 'open-budget-info':this.openModal('budgetinfo');break;
      case 'export':try{exportState(this.state);this.showToast('JSON-Backup wurde heruntergeladen.');}catch(error){this.showToast(error.message,true);}break;
      case 'import':this.root.querySelector('#json-file-picker')?.click();break;
      case 'reset':this.confirm('Alle Daten wirklich zurücksetzen?','Sämtliche Regeln, Ausnahmen, Buchungshistorie und Einstellungen werden gelöscht. Bitte sichere deine Daten vorher als JSON-Datei.','Alles löschen',()=>this.replaceState(freshState(),'Alle Daten zurückgesetzt.'));break;
      case 'undo-toast':{
        const snapshot=this.toast?.undo;if(snapshot)this.replaceState(snapshot,'Letzte Änderung rückgängig gemacht.');break;
      }
    }
  }
  handleInput(ev){
    if(ev.target.id==='rule-search'){
      this.search=ev.target.value;
      // Nur die Liste aktualisieren; Suchfeld behält Fokus und Cursorposition.
      const area=this.root.querySelector('#rules-content');if(area)area.innerHTML=renderRules(this);
    }
  }
  async handleChange(ev){
    if(ev.target.id==='theme-select'){
      const val=ev.target.value;
      this.mutate(s=>{s.settings.theme=val;},'Darstellung geändert.',{undo:false});this.updateTheme();return;
    }
    if(ev.target.id==='json-file-picker'){
      const file=ev.target.files?.[0];if(!file)return;
      try{
        const parsed=await importState(file);
        this.confirm('Backup importieren?',`Die Datei „${file.name}“ enthält ${parsed.rules.length} Buchungsregeln und ${parsed.posted.length} gebuchte Zahlungen. Alle aktuellen Daten werden ersetzt.`,'Daten ersetzen',()=>this.replaceState(parsed,'Backup importiert.'));
      }catch(error){this.showToast(`Import fehlgeschlagen: ${error.message}`,true);}
      ev.target.value='';
    }
  }
  handleSubmit(ev){
    if(!ev.target.matches('form[data-form]'))return;
    ev.preventDefault();
    const f=new FormData(ev.target),type=ev.target.dataset.form;
    try{
      if(type==='entry'){
        const name=String(f.get('title')||'').trim(),date=requireDate(String(f.get('date')));
        if(!name)throw Error('Bitte eine Bezeichnung angeben.');
        const amount=Math.abs(requireMoney(f.get('amount')))*(f.get('kind')==='income'?1:-1);
        const frequency=String(f.get('frequency')||'none');
        const until=String(f.get('until')||'')||null;
        if(until&&(!isValidISO(until)||until<date))throw Error('Das Serienende muss am oder nach dem Startdatum liegen.');
        const weekdayPolicy=String(f.get('weekdayPolicy')||'none');
        const note=String(f.get('note')||'').trim();
        const edit=this.modal?.type==='edit-rule';
        this.mutate(s=>{
          if(edit){
            const r=s.rules.find(x=>x.id===this.modal.ruleId);if(!r)throw Error('Buchungsregel nicht gefunden.');
            Object.assign(r,{title:name,amountCents:amount,anchor:date,frequency,until,weekdayPolicy,note});
          }else s.rules.push(newRule({title:name,amountCents:amount,anchor:date,frequency,until,weekdayPolicy,note}));
        },edit?'Buchungsregel gespeichert.':'Buchung angelegt.');
      }else if(type==='occurrence'){
        const e=this.modal.event,title=String(f.get('title')||'').trim(),date=requireDate(String(f.get('date')));
        if(!title)throw Error('Bitte eine Bezeichnung angeben.');
        const amount=Math.abs(requireMoney(f.get('amount')))*(e.amountCents>0?1:-1);
        const scope=String(f.get('scope')||'once');
        this.mutate(s=>changeOccurrence(s,e,{title,amountCents:amount,date},scope),'Buchung angepasst.');
      }else if(type==='post'){
        const e=this.modal.event;
        const amount=Math.abs(requireMoney(f.get('amount')))*(e.amountCents>0?1:-1);
        const mode=String(f.get('bookingMode')),date=requireDate(String(f.get('date')));
        if(date>todayISO())throw Error('Eine tatsächliche Buchung darf nicht in der Zukunft liegen.');
        this.mutate(s=>postOccurrence(s,e,mode,amount,date),'Zahlung als gebucht markiert.');
      }else if(type==='balance'){
        const cents=requireMoney(f.get('amount'),true),now=todayISO();
        this.mutate(s=>{
          cleanAfterManualBalanceUpdate(s);
          s.settings.currentBalanceCents=cents;s.settings.balanceDate=now;
          if(s.settings.viewStart<now)s.settings.viewStart=now;
          if(s.settings.viewEnd<now)s.settings.viewEnd=addYearsAnchored(now,1);
        },'Kontostand aktualisiert.');
      }else if(type==='reserve'){
        const cents=requireMoney(f.get('amount'),true);
        if(cents<0)throw Error('Die Sicherheitsreserve darf nicht negativ sein.');
        this.mutate(s=>{s.settings.reserveCents=cents;},'Sicherheitsreserve gespeichert.');
      }else if(type==='range'){
        const start=requireDate(String(f.get('start'))),end=requireDate(String(f.get('end')));
        if(start>end)throw Error('Der Start darf nicht nach dem Ende liegen.');
        if(start<this.state.settings.balanceDate)throw Error('Die grafische Anzeige kann erst am Kontostand-Stichtag beginnen. Für frühere Zeiträume fehlen historische Kontostände.');
        if(end<this.state.settings.balanceDate)throw Error('Das Ende muss am oder nach dem Kontostand-Stichtag liegen.');
        this.mutate(s=>{s.settings.viewStart=start;s.settings.viewEnd=end;},'Zeitraum geändert.',{undo:false});
        this.rangePreset='custom';this.chartDate=null;
      }else if(type==='experiment'){
        const amount=requireMoney(f.get('amount')),date=requireDate(String(f.get('date')));
        const test=structuredClone(this.state);
        test.rules.push(newRule({title:'Testausgabe',amountCents:-amount,anchor:date,frequency:'none'}));
        const result=forecast(test);
        this.modal={...this.modal,draft:{amount:String(f.get('amount')),date},result,testAmountCents:amount};
        this.render();
      }
    }catch(error){this.captureDraft();this.showToast(error.message,true);}
  }
  applyRangePreset(preset){
    const months=({'1m':1,'3m':3,'6m':6,'1y':12})[preset];if(!months)return;
    const anchor=todayISO();
    this.rangePreset=preset;this.chartDate=null;
    this.mutate(s=>{s.settings.viewStart=anchor;s.settings.viewEnd=addMonthsAnchored(anchor,months);},null,{undo:false});
  }
}
