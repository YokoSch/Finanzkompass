/*
 * Modul main.js – Browser-kompatibel auch über file://.
 * Eigenständiger Scope: nur die bewusst exportierten Funktionen werden
 * unter globalThis.FinanzkompassModules.main veröffentlicht.
 * Die Abhängigkeiten werden durch die Reihenfolge der defer-Skripte in
 * /index.html geladen; kein Build, kein Server und keine Bibliothek nötig.
 */
(function(modules) {
'use strict';
const {FinanceUI} = modules.uiActions;
/** main.js — einziger Bootstrap-Punkt. */
const app=new FinanceUI(document.getElementById('app'));
// Erleichtert spätere Fehlersuche in DevTools, ohne Schreibzugriff auf den State.
Object.defineProperty(window,'FinanzkompassDebug',{value:Object.freeze({
  version:'1.0.1',
  state:()=>structuredClone(app.state),
  forecast:()=>structuredClone(app.result)
}),writable:false});
})(globalThis.FinanzkompassModules || (globalThis.FinanzkompassModules = Object.create(null)));
