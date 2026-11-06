/**
 * Optionaler Zero-Dependency-Export: erstellt eine einzige Standalone-HTML.
 * Die GitHub-Pages-Fassung und der Doppelklick-Start verwenden weiterhin die
 * getrennten Dateien in src/ und benötigen KEINEN Build.
 *
 * Quelle der Wahrheit ist /index.html samt allen dort genannten Skripten.
 * Die Reihenfolge der <script defer>-Elemente muss der Abhängigkeitsfolge
 * entsprechen. Wir betten exakt diese Skripte für einen portablen Export ein.
 */
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const base=resolve(dirname(fileURLToPath(import.meta.url)), '..');
let html=await readFile(resolve(base, 'index.html'), 'utf8');
const cssRef=html.match(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/>/);
if (!cssRef) throw Error('Kein Stylesheet in index.html gefunden.');
const css=await readFile(resolve(base, cssRef[1]), 'utf8');
html=html.replace(cssRef[0], `<style>\n${css}\n</style>`);
const refs=[...html.matchAll(/<script\s+defer\s+src="([^"]+\.js)"\s*><\/script>/g)];
if (refs.length<10) throw Error('Zu wenige Moduldateien in index.html gefunden.');
for (const match of refs) {
  const source=await readFile(resolve(base, match[1]), 'utf8');
  if (/<\/script\s*>/i.test(source)) throw Error(`Unsicherer Inline-Script-Tag in ${match[1]}`);
  html=html.replace(match[0],`<script>\n${source}\n</script>`);
}
await mkdir(resolve(base,'dist'),{recursive:true});
const target=resolve(base,'dist','Finanzkompass.html');
await writeFile(target,html,'utf8');
console.log(`Standalone-Export erstellt: dist/Finanzkompass.html (${(Buffer.byteLength(html)/1024).toFixed(1)} KiB)`);
