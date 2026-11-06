/*
 * Modul persistence.js – Browser-kompatibel auch über file://.
 * Eigenständiger Scope: nur die bewusst exportierten Funktionen werden
 * unter globalThis.FinanzkompassModules.persistence veröffentlicht.
 * Die Abhängigkeiten werden durch die Reihenfolge der defer-Skripte in
 * /index.html geladen; kein Build, kein Server und keine Bibliothek nötig.
 */
(function(modules) {
'use strict';
const {freshState,validateState,STORAGE_KEY} = modules.model;
/**
 * persistence.js — kein Cloud-Dienst, keine Cookies; LocalStorage + JSON.
 * Manche Browser verbieten LocalStorage für direkt geöffnete file://-Seiten.
 * Dann bleibt die App absichtlich bedienbar (nur im Tab-Speicher) und zeigt
 * eine dauerhafte Warnung mit Hinweis auf den zwingenden JSON-Export.
 */
let persistenceMode='local';
let memoryCopy=null;
function getPersistenceMode(){return persistenceMode;}
function loadState(){
  try{
    const raw=window.localStorage.getItem(STORAGE_KEY);
    if(!raw)return {state:freshState(),warning:null};
    try{return {state:validateState(JSON.parse(raw)),warning:null};}
    catch(error){
      // Vor einem Neustart mit leeren Werten die kaputten Originaldaten sichern.
      try{window.localStorage.setItem(`${STORAGE_KEY}.recovery.${Date.now()}`,raw);}catch(_){/* eventuell voll */}
      return {state:freshState(),warning:`Die bisherigen Browserdaten sind beschädigt und wurden nach Möglichkeit separat gesichert: ${error.message}`};
    }
  }catch(error){
    persistenceMode='memory';
    return {state:memoryCopy||freshState(),warning:'Dieser Browser sperrt die dauerhafte lokale Speicherung. Bitte vor dem Schließen unbedingt ein JSON-Backup exportieren.'};
  }
}
function saveState(s){
  s.updatedAt=new Date().toISOString();
  validateState(s);
  try{
    window.localStorage.setItem(STORAGE_KEY,JSON.stringify(s));
    persistenceMode='local';memoryCopy=null;return true;
  }catch(error){
    // Berechnungen und Formulare sollen auch in restriktiven Browsern funktionieren.
    memoryCopy=structuredClone(s);persistenceMode='memory';return false;
  }
}
function exportState(s){
  validateState(s);
  const b=new Blob([JSON.stringify(s,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(b),link=document.createElement('a');
  link.href=url;link.download=`Finanzkompass_Backup_${s.settings.balanceDate}.json`;
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
async function importState(file){
  if(file.size>8_000_000)throw Error('Datei ist größer als 8 MB.');
  return validateState(JSON.parse(await file.text()));
}
// Nur dieses Modul exportiert seine öffentliche API.
modules.persistence = Object.freeze({ getPersistenceMode, loadState, saveState, exportState, importState });
})(globalThis.FinanzkompassModules || (globalThis.FinanzkompassModules = Object.create(null)));
