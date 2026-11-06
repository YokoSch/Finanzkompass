/**
 * Deterministischer Zero-Dependency-Build: Modularen ESM-Quelltext in ein
 * allein lauffähiges HTML-Dokument einbetten. Importreihenfolge manuell!
 * Jeder Import wird nur für die Entwicklungsvariante benötigt. Das Buildskript
 * entfernt statische Import- und Export-Schlüsselwörter; alle Dateien teilen
 * anschließend einen lexikalischen IIFE-Scope.
 * Keine dynamischen Imports, kein export default, keine Namenskollisionen.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const base=resolve(import.meta.dirname,'..');
const order=['date','money','model','recurrence','forecast','operations','persistence','icons','chart','ui-render','ui-actions','main'];
let js='';
for(const part of order){
  let src=await readFile(`${base}/src/${part}.js`,'utf8');
  src=src.replace(/^import\s+[^;]+;\s*$/gm,'').replace(/^export\s+(?=(function|class|const|let|async|\{))/gm,'');
  if(/^\s*(?:import|export)\s/m.test(src))throw Error(`Unaufgelöster ES-Modul-Import/Export in ${part}.js`);
  js+=`\n/* ===== Modul: ${part}.js ===== */\n${src}\n`;
}
const html=await readFile(`${base}/src/index.html`,'utf8');
let css=await readFile(`${base}/src/styles.css`,'utf8');
css=css.replace(/^@import url\(''\);\n/, '');
const built=html.replace('<link rel="stylesheet" href="./styles.css"/>',`<style>\n${css}\n</style>`).replace('<script type="module" src="./main.js"></script>',`<script>\n(()=>{'use strict';\n${js}\n})();\n</script>`);
await mkdir(`${base}/dist`,{recursive:true});
await writeFile(`${base}/dist/Finanzkompass.html`,built,'utf8');
console.log(`Build abgeschlossen: dist/Finanzkompass.html (${(Buffer.byteLength(built)/1024).toFixed(1)} KiB)`);
