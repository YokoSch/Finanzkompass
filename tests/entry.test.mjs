import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const html=readFileSync(resolve(project,'index.html'),'utf8');
const order=['date','money','model','recurrence','forecast','operations','persistence','icons','chart','ui-render','ui-actions','main'];

test('Root-Index lädt alle gekapselten Moduldateien in richtiger Reihenfolge, ohne ESM',()=>{
  assert.match(html,/<div id="app">/);
  assert.doesNotMatch(html,/type\s*=\s*["']module["']/i);
  const scriptRefs=[...html.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(m=>m[1]);
  assert.deepEqual(scriptRefs,order.map(n=>`./src/${n}.js`));
  assert.match(html,/<link rel="stylesheet" href="\.\/src\/styles\.css"\s*\/>/);
  for (const ref of scriptRefs) {
    assert.ok(existsSync(resolve(project,ref)),`Datei fehlt: ${ref}`);
    const content=readFileSync(resolve(project,ref),'utf8');
    assert.doesNotMatch(content,/^\s*(?:import|export)\s/m,`Native ES-Module gefunden: ${ref}`);
    assert.match(content,/globalThis\.FinanzkompassModules/,`Kein gekapselter Registry-Code: ${ref}`);
  }
});

test('Relative Pfade funktionieren als GitHub-Pages-Projektunterordner',()=>{
  const root='https://beispiel.github.io/Finanzkompass/';
  assert.equal(new URL('./src/main.js',root).pathname,'/Finanzkompass/src/main.js');
  assert.equal(new URL('./src/styles.css',root).pathname,'/Finanzkompass/src/styles.css');
  assert.ok(existsSync(resolve(project,'.nojekyll')));
});
