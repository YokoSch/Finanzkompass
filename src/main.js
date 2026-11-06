/** main.js — einziger Bootstrap-Punkt. */
import {FinanceUI} from './ui-actions.js';
const app=new FinanceUI(document.getElementById('app'));
// Erleichtert spätere Fehlersuche in DevTools, ohne Schreibzugriff auf den State.
Object.defineProperty(window,'FinanzkompassDebug',{value:Object.freeze({
  version:'1.0.0',
  state:()=>structuredClone(app.state),
  forecast:()=>structuredClone(app.result)
}),writable:false});
