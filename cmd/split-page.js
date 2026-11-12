#!/usr/bin/env node
/* Lighter app (Phase D 25): splits a module into the part every page needs and the part only its own page needs.

     node cmd/split-page.js house-claims.js claims [API names other pages use …]

   house-claims.js stays the "everywhere" part (it goes on being loaded with tail.js): the hooks other pages use
   (At a glance, search, ⌘K commands, calendar reminders), the module's data functions they need, and the window
   object's data methods. The page part is written to <page>/<name>.page.js; build.py loads it on its own page after
   tail.js ("late" in scripts.json). The page part takes what it needs from the everywhere part
   (window.__core[key]); the everywhere part reaches page-only things (a card on screen, a sheet to open) through
   __ui() – empty on other pages, so a command there goes to the page instead.
   Run it once per module, read both files, run the tests. Mutable shared state is reported – fix that by hand. */
const fs = require('fs'), path = require('path');
const acorn = require('/opt/npm-tools/node_modules/acorn'), walk = require('/opt/npm-tools/node_modules/acorn-walk');
const [file, key, ...roots] = process.argv.slice(2);
if (!file || !key) { console.error('usage: node cmd/split-page.js <file.js> <key> [api names …]'); process.exit(1); }
const FILE = path.resolve(__dirname, file), src = fs.readFileSync(FILE, 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 2020, ranges: true });
const iife = ast.body.find(s => s.type === 'ExpressionStatement' && s.expression.type === 'CallExpression' && /Function/.test(s.expression.callee.type));
if (!iife) throw new Error('no (function () { … })() in ' + file);
const body = iife.expression.callee.body.body, head = src.slice(0, iife.start), fnStart = iife.expression.callee.body.start + 1;
const HOOK = /window\.(BriefExtra|EventsExtra|CommandExtra|SearchExtra|NotifyExtra)\b|^HF && HF\.uses\(|^HF\.uses\(|\.st-page\[data-page=|st:page|class="st-row|\[data-[a-z]*cfg[\]=]/;   /* HF.uses: which photos are still in use – every page must know, or they could be cleaned away; .st-page, st:page, st-row, [data-…cfg]: the module's rows in Settings and their handlers – Settings opens on every page */

/* ---------- items: one per top-level statement (a var with several names: one per name) ---------- */
const items = [];
for (const st of body) {
  if (st.type === 'VariableDeclaration' && st.declarations.length > 1) {
    for (const d of st.declarations) items.push({ node: d, text: st.kind + ' ' + src.slice(d.start, d.end) + ';', names: [d.id.name], kind: 'var', st });
  } else if (st.type === 'VariableDeclaration') items.push({ node: st, text: src.slice(st.start, st.end), names: [st.declarations[0].id.name], kind: 'var', st });
  else if (st.type === 'FunctionDeclaration') items.push({ node: st, text: src.slice(st.start, st.end), names: [st.id.name], kind: 'fn', st });
  else items.push({ node: st, text: src.slice(st.start, st.end), names: [], kind: 'do', st });
}
const top = new Map(); items.forEach((it, i) => it.names.forEach(n => top.set(n, i)));
/* the names an item uses (an over-estimate: a local with the same name counts too) */
function refsOf(node) {
  const out = [];
  walk.fullAncestor(node, (n, anc) => {
    if (n.type !== 'Identifier' || !top.has(n.name)) return;
    const p = anc[anc.length - 2];
    if (p && p.type === 'MemberExpression' && p.property === n && !p.computed) return;
    if (p && p.type === 'Property' && p.key === n && !p.computed && !p.shorthand) return;
    if (p && (p.type === 'FunctionDeclaration' || p.type === 'FunctionExpression') && p.id === n) return;
    if (p && p.type === 'VariableDeclarator' && p.id === n) return;
    /* inside a command's run(): an action – it opens things on the page, so it doesn't pull them into the everywhere part */
    n.inRun = anc.some(a => a.type === 'Property' && !a.computed && (a.key.name || a.key.value) === 'run');
    out.push(n);
  });
  return out;
}
/* what belongs to the page: things on screen, and everything done at load that isn't a hook */
const isGuard = it => it.kind === 'do' && (/^"use strict"|^'use strict'/.test(it.text) || (it.st.type === 'IfStatement' && it.st.consequent.type === 'ReturnStatement'));
const isHook = it => it.kind === 'do' && HOOK.test(it.text);
const isApi = it => it.kind === 'do' && /^window\.[A-Z]\w+\s*=\s*\{/.test(it.text);
const domSeed = it => it.kind === 'var' && /document\.|\bel\b\s*=|\.collection\(/.test(it.text.split('=').slice(1).join('='));
items.forEach(it => { it.guard = isGuard(it); it.hook = isHook(it); it.api = isApi(it); it.page = domSeed(it) || (it.kind === 'do' && !it.guard && !it.hook && !it.api); });
items.forEach(it => { it.refs = refsOf(it.node); it.uses = new Set(it.refs.filter(r => !r.inRun || !it.hook).map(r => r.name)); });

/* ---------- the everywhere part: the hooks, the API names asked for, and what they use ---------- */
const core = new Set(), need = [];
items.forEach((it, i) => { if (it.hook || it.guard) need.push(i); });
/* every window.Name = { … } object (a module can publish more than one, like money-plus: MoneyPlus and Shared) */
const apiItems = items.filter(it => it.api), apiProps = [];
apiItems.forEach(it => { const name = it.text.match(/^window\.(\w+)/)[1];
  it.node.expression.right.properties.forEach(p => apiProps.push({ api: name, key: p.key.name || p.key.value, text: src.slice(p.start, p.end), uses: new Set(refsOf(p.value).map(r => r.name)) })); });
function close() {
  while (need.length) {
    const i = need.pop(); if (core.has(i)) continue; core.add(i);
    for (const n of items[i].uses) { const j = top.get(n); if (j != null && !core.has(j) && !items[j].page) { need.push(j); if (process.env.WHY) console.log('  ' + (items[i].names[0] || items[i].text.slice(0, 40)) + ' → ' + n); } }
  }
}
close();
for (const p of apiProps) if (roots.includes(p.key)) { for (const n of p.uses) { const j = top.get(n); if (j != null && !items[j].page) need.push(j); } }
close();
/* a click/change handler for buttons the everywhere part draws (Settings rows, say) goes with it: its data-… attribute
   appears in the everywhere part's text. Repeat until nothing more moves. */
for (let moved = true; moved;) {
  moved = false;
  const coreText = [...core].map(i => items[i].text).join('\n');
  items.forEach((it, i) => {
    if (core.has(i) || it.kind !== 'do' || !/addEventListener\(/.test(it.text)) return;
    const attrs = (it.text.match(/closest\('\[(data-[\w-]+)/g) || []).map(a => a.slice(10));
    if (attrs.length && attrs.some(a => new RegExp(a + '[\\s=">]').test(coreText))) { need.push(i); it.page = false; moved = true; }
  });
  close();
}
/* an API name goes with the everywhere part when everything it uses is there */
const inCore = n => { const j = top.get(n); return j == null || core.has(j); };
const coreProps = apiProps.filter(p => [...p.uses].every(inCore)), pageProps = apiProps.filter(p => !coreProps.includes(p));
const coreNames = new Set([...core].flatMap(i => items[i].names));
/* page-only names the everywhere part still mentions (inside a command, say): reached through __ui() */
const viaUi = new Set();
for (const i of core) for (const r of items[i].refs) if (!coreNames.has(r.name)) viaUi.add(r.name);

/* ---------- write ---------- */
function rewrite(it) {
  const reps = it.refs.filter(r => viaUi.has(r.name)).sort((a, b) => b.start - a.start);
  let t = it.text, base = it.kind === 'var' && it.st.declarations.length > 1 ? it.node.start - (it.st.kind.length + 1) : it.node.start;
  for (const r of reps) {
    const a = r.start - base, b = r.end - base;
    /* a shorthand property { el } becomes { el: __ui().el } */
    const sh = /[{,]\s*$/.test(t.slice(0, a)) && /^\s*[,}]/.test(t.slice(b));
    t = t.slice(0, a) + (sh ? r.name + ': ' : '') + '__ui().' + r.name + t.slice(b);
  }
  return t;
}
const ind = '  ';
let coreOut = [], pageOut = [];
items.forEach((it, i) => {
  if (core.has(i)) coreOut.push(rewrite(it));
  else if (!it.api) pageOut.push(it.text);
  if (it.guard && !core.has(i)) coreOut.push(it.text);
  if (it.guard) { if (!pageOut.includes(it.text)) pageOut.push(it.text); }
});
const coreList = [...coreNames].filter(n => items[top.get(n)].kind !== 'do');
apiItems.forEach(it => { const name = it.text.match(/^window\.(\w+)/)[1], cp = coreProps.filter(p => p.api === name), pp = pageProps.filter(p => p.api === name);
  coreOut.push('window.' + name + ' = { ' + cp.map(p => p.text).join(', ') + ' };');
  if (pp.length) pageOut.push('Object.assign(window.' + name + ', { ' + pp.map(p => p.text).join(', ') + ' });'); });
coreOut.push('(window.__core = window.__core || {})[' + JSON.stringify(key) + '] = { ' + coreList.map(n => n + ': ' + n).join(', ') + ' };');
if (viaUi.size) coreOut.splice(coreOut.findIndex(t => !/^"use strict"|^'use strict'/.test(t)), 0, 'function __ui() { return (window.__ui || {})[' + JSON.stringify(key) + '] || {}; }   /* page-only things, when this is their page */');
/* the page part: what it takes from the everywhere part, and what it hands back */
const pageUses = new Set(); items.forEach((it, i) => { if (!core.has(i) && !it.api) it.uses.forEach(n => { if (coreNames.has(n)) pageUses.add(n); }); });
pageProps.forEach(p => p.uses.forEach(n => { if (coreNames.has(n)) pageUses.add(n); }));
const imp = [...pageUses].filter(n => items[top.get(n)].kind !== 'do');
const firstReal = pageOut.findIndex(t => !/^"use strict"|^'use strict'/.test(t) && !/^if \(.*\) return;$/.test(t));
pageOut.splice(firstReal < 0 ? pageOut.length : firstReal, 0, 'var __c = (window.__core || {})[' + JSON.stringify(key) + ']; if (!__c) return;' + (imp.length ? '\n' + ind + 'var ' + imp.map(n => n + ' = __c.' + n).join(', ') + ';' : ''));
if (viaUi.size) pageOut.push('(window.__ui = window.__ui || {})[' + JSON.stringify(key) + '] = { ' + [...viaUi].map(n => n + ': ' + n).join(', ') + ' };');
/* state both parts change can't be shared by copying it: report it */
const warn = [];
items.forEach((it, i) => { if (core.has(i)) return; walk.simple(it.node, { AssignmentExpression(n) { if (n.left.type === 'Identifier' && coreNames.has(n.left.name) && items[top.get(n.left.name)].kind === 'var') warn.push(n.left.name); } }); });
for (const n of viaUi) if (items[top.get(n)].kind === 'var') walk.simple(ast, { AssignmentExpression(x) { if (x.left.type === 'Identifier' && x.left.name === n) warn.push(n + ' (page var changed later; the everywhere part reads it through __ui at call time)'); } });

const tail = src.slice(iife.expression.callee.body.end - 1);
const wrap = (parts, note) => head.replace(/^(\/\*[\s\S]*?\*\/)/, m => m + note) + '(function () {\n' + parts.map(t => ind + t.replace(/^\s+/, '')).join('\n') + '\n' + tail.replace(/^\}/, '}');
const page = path.join(path.dirname(FILE), path.basename(file, '.js') + '.page.js');
fs.writeFileSync(page, wrap(pageOut, '\n/* The page part of ' + path.basename(file) + ' (made by cmd/split-page.js): loaded on its own page after tail.js; the everywhere part is ' + path.basename(file) + '. */'));
fs.writeFileSync(FILE, wrap(coreOut, '\n/* The everywhere part (made by cmd/split-page.js): hooks for other pages and the data they need. The rest is in ' + path.basename(page) + ', loaded only on its own page. */'));
console.log(file + ': everywhere ' + coreOut.join('\n').length + ' B, page ' + pageOut.join('\n').length + ' B; via __ui: ' + [...viaUi].join(', ') + (warn.length ? '\n  CHECK shared state: ' + [...new Set(warn)].join(', ') : ''));
