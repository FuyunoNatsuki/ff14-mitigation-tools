// data/foods.js と data/gear.js を作り直すスクリプト（Node.js 18 以上）。
//   node tools/gear/build-gear-data.mjs
// - 食事：XIVAPI（ゲームデータ）から、アイテムレベル690以上（パッチ7.x）の料理を取り、戦闘用のものだけ残す
// - 装備：装備名は tools/gear/gear-source.json の url（https://fuucdayo.com/gearset/<url>/）のページの、最初の装備パターンから取る。
//         ステータスは、各部位の値を etro.gg（https://etro.gg/api/equipment/<アイテムID>/）から取り、自分で積み上げる：
//           サブステータス（クリ・意思・DH・SS・不屈・信仰）＝ 基礎値（420、意思・信仰は 440）＋ 各部位（装備の値＋マテリア、
//             部位ごとの上限まで。マテリアの値は https://etro.gg/api/materia/、カスタム武器はページの「ステータスの振り分け」）
//           能力値（STR・DEX・VIT・INT・MND）＝ 装備だけの合計（ジョブの基礎値と種族の補正はツール側で足す）
//           物理防御・魔法防御・武器の性能も etro.gg の値
//         サイトのステータス欄（食事込み）とも比べ、食事の分を除いて合わないものは警告を出す（値は etro.gg から積み上げたものを使う）
// 装備を更新するときは gear-source.json の url・food・pattern を書き換えて実行してください（stats は照合にだけ使います）。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const API = 'https://v2.xivapi.com/api';
const get = async (url, params) => {
  const res = await fetch(`${API}/${url}?${new URLSearchParams(params)}`);
  const j = await res.json();
  if (!res.ok) throw new Error(`${url}: ${j.message || res.status}`);
  return j;
};

// ----- 食事 -----
const PARAM = {'クリティカル':'crit', '意思力':'det', 'ダイレクトヒット':'dh', 'スキルスピード':'ss', 'スペルスピード':'ss', '不屈':'ten', '信仰':'pie', 'VIT':'vit'};
const items = await get('search', {sheets:'Item', query:'+ItemUICategory=46 +LevelItem>=690', language:'ja', fields:'Name,LevelItem.value,ItemAction.Data', limit:'200'});
const rows = items.results.map(r => r.fields.ItemAction.fields.Data[1]).join(',');
const food = await get('sheet/ItemFood', {rows, language:'ja', fields:'BaseParam[].Name,IsRelative,ValueHQ,MaxHQ'});
const byRow = new Map(food.rows.map(r => [r.row_id, r.fields]));
const foods = [];
for (const it of items.results) {
  const d = byRow.get(it.fields.ItemAction.fields.Data[1]);
  const params = d.BaseParam.map((b, i) => b.fields && b.fields.Name ? {name:b.fields.Name, pct:d.ValueHQ[i], max:d.MaxHQ[i]} : null).filter(Boolean);
  if (!params.length || params.some(p => !PARAM[p.name])) continue; // 製作・採集用は除く
  foods.push({id:'f' + it.row_id, name:it.fields.Name, ilvl:it.fields.LevelItem.value,
    params:params.map(p => ({stat:PARAM[p.name], label:p.name, pct:p.pct, max:p.max}))});
}
foods.sort((a, b) => b.ilvl - a.ilvl || a.id.localeCompare(b.id));
const foodByName = new Map(foods.map(f => [f.name, f]));

// ----- 装備 -----
// 食事込みの合計から、食事の分を除く（合計 = 素の値 + min(⌊素の値 × pct%⌋, max)）
function unfood(total, pct, max){
  for (let pre = total - max - 2; pre <= total; pre++) if (pre + Math.min(Math.floor(pre * pct / 100), max) === total) return pre;
  throw new Error(`食事の分を除けません: ${total}`);
}
// サイトの表記 → ステータスのキー
const STAT = {'クリティカル':'crit', '意思力':'det', 'DH':'dh', 'ダイレクトヒット':'dh', 'スキルスピード':'ss', 'スペルスピード':'ss', '不屈':'ten', '信仰':'pie',
  'STR':'str', 'DEX':'dex', 'VIT':'vit', 'INT':'int', 'MND':'mnd'};
// etro.gg・ゲームデータのパラメータ番号 → ステータスのキー
const PARAM_ID = {1:'str', 2:'dex', 3:'vit', 4:'int', 5:'mnd', 6:'pie', 19:'ten', 22:'dh', 27:'crit', 44:'det', 45:'ss', 46:'ss'};
const ATTR_KEYS = ['str', 'dex', 'vit', 'int', 'mnd'];
const SUB_BASE = {crit:420, det:440, dh:420, ss:420, ten:420, pie:440}; // Lv100 のサブステータスの基礎値
const LV_MAIN = 440, PARTY_BONUS = 5;
const source = JSON.parse(fs.readFileSync(path.join(here, 'gear-source.json'), 'utf8'));
const mctx = {window:{}};
vm.createContext(mctx);
vm.runInContext(fs.readFileSync(path.join(root, 'data/modifiers.js'), 'utf8'), mctx);
const JOB_MODS = mctx.window.MP_JOB_MODS;
const etroGet = async p => { const r = await fetch(`https://etro.gg/api/${p}`); if (!r.ok) throw new Error(`etro.gg ${p}: ${r.status}`); return r.json(); };
// マテリアのアイテムID → {ステータス, 値}
const MATERIA = new Map();
for (const m of await etroGet('materia/')) for (let t = 1; t <= 20; t++) if (m['tier' + t]) MATERIA.set(m['tier' + t].id, {k:PARAM_ID[m.param], v:m['tier' + t + 'Value']});
// 日本語のアイテム名 → アイテムID（XIVAPI）、アイテムID → etro.gg の装備データ
const idCache = new Map(), etroCache = new Map();
async function itemId(name){
  if (!idCache.has(name)) {
    const hit = (await get('search', {sheets:'Item', query:`+Name="${name}"`, language:'ja', fields:'Name'})).results[0];
    if (!hit) throw new Error(`アイテム「${name}」が見つかりません`);
    idCache.set(name, hit.row_id);
  }
  return idCache.get(name);
}
async function etroItem(id){ if (!etroCache.has(id)) etroCache.set(id, await etroGet(`equipment/${id}/`)); return etroCache.get(id); }
// サイトの装備ページから、最初の装備パターンの部位・装備名・マテリア・カスタム武器の振り分けを取る
async function gearItems(url){
  const res = await fetch(`https://fuucdayo.com/gearset/${url}/`);
  if (!res.ok) throw new Error(`gearset/${url}: ${res.status}`);
  const first = (await res.text()).split('fr-gear-title')[1] || '';
  return first.split('fr-gear-item').slice(1).map(it => {
    const slot = (it.match(/data-fr-slot="(\w+)"/) || [])[1], name = (it.match(/<strong>([^<]*)<\/strong>/) || [])[1];
    if (!slot || !name) return null;
    const materia = [...it.matchAll(/class="fr-materia [^"]*" title="([^"]*)"/g)].map(m => m[1]);
    const dist = {};
    if (it.includes('ステータスの振り分け')) for (const m of it.split('ステータスの振り分け')[1].split('</dl>')[0].matchAll(/<dt>([^<]*)<\/dt><dd>([^<]*)<\/dd>/g)) if (STAT[m[1]]) dist[STAT[m[1]]] = (dist[STAT[m[1]]] || 0) + +m[2];
    return {slot, name, materia, dist};
  }).filter(Boolean);
}
// 1部位のステータス：etro.gg の装備の値＋カスタム武器の振り分け＋マテリア（部位ごとの上限まで）
async function slotStats(it){
  const id = await itemId(it.name), e = await etroItem(id);
  const st = {};
  for (let i = 0; i < 6; i++) { const k = PARAM_ID[e['param' + i]]; if (k) st[k] = (st[k] || 0) + e['param' + i + 'Value']; }
  for (const [k, v] of Object.entries(it.dist)) st[k] = (st[k] || 0) + v;
  const cap = {};
  for (const [p, v] of Object.entries(e.maxParams || {})) if (PARAM_ID[p]) cap[PARAM_ID[p]] = v;
  const capped = [];
  for (const mn of it.materia) {
    const m = MATERIA.get(await itemId(mn));
    if (!m) throw new Error(`マテリア「${mn}」が etro.gg にありません`);
    const before = st[m.k] || 0, after = cap[m.k] != null ? Math.min(cap[m.k], before + m.v) : before + m.v;
    if (after < before + m.v) capped.push(`${mn} は上限で ${after - before}`);
    st[m.k] = after;
  }
  return {id, e, st, capped};
}
const gear = {};
for (const [job, g] of Object.entries(source)) {
  const f = foodByName.get(g.food);
  if (!f) throw new Error(`${job}: 食事「${g.food}」が見つかりません`);
  const items = await gearItems(g.url);
  if (!items.length) throw new Error(`${job}: 装備ページから部位を読めません`);
  const sub = {...SUB_BASE}, attrs = Object.fromEntries(ATTR_KEYS.map(k => [k, 0]));
  let def = 0, mdef = 0, weapon = null;
  const ids = [];
  for (const it of items) {
    const s = await slotStats(it);
    ids.push(s.id);
    for (const [k, v] of Object.entries(s.st)) if (k in attrs) attrs[k] += v; else if (k in sub) sub[k] += v;
    def += s.e.defensePhys || 0; mdef += s.e.defenseMag || 0;
    if (it.slot === 'Weapon') weapon = {name:it.name, e:s.e};
    if (s.capped.length) console.log(`  ${job} ${it.name}: ${s.capped.join('、')}`);
  }
  if (!weapon) throw new Error(`${job}: 武器が見つかりません`);
  // サイトのステータス欄（食事込み）と照合する：サブステータスは食事の分を除いて、能力値は ⌊(基礎値＋装備) × 1.05⌋ と比べる
  const site = {};
  for (const [k, v] of Object.entries(g.stats)) if (STAT[k]) site[STAT[k]] = v;
  for (const p of f.params) if (site[p.stat] != null) site[p.stat] = unfood(site[p.stat], p.pct, p.max);
  const calc = {...sub};
  for (const k of ATTR_KEYS) calc[k] = Math.floor((Math.floor(LV_MAIN * JOB_MODS[job][k] / 100) + attrs[k]) * (100 + PARTY_BONUS) / 100);
  const diff = Object.keys(site).filter(k => k in calc && calc[k] !== site[k]).map(k => `${k} ${site[k]} → ${calc[k]}`);
  if (diff.length) console.warn(`${job}: サイトの値と違うもの（サイト → etro.gg から積み上げた値）: ${diff.join(' / ')}`);
  gear[job] = {name:`Patch7.55 最終装備（${g.pattern}）`, source:`https://fuucdayo.com/gearset/${g.url}/`, weapon:weapon.name, ilvl:weapon.e.itemLevel,
    food:f.id, items:ids,
    gearAttrs:attrs, stats:{...sub, def, mdef, wd:weapon.e.damageMag, wdPhys:weapon.e.damagePhys}};
  console.log(`${job}: クリ ${sub.crit} / 意思 ${sub.det} / DH ${sub.dh} / SS ${sub.ss} / 不屈 ${sub.ten} / 信仰 ${sub.pie} / VIT ${calc.vit} / 物防 ${def} / 魔防 ${mdef} / 武器 ${weapon.e.damageMag}/${weapon.e.damagePhys}`);
}

// ----- 書き出し（1行に1件）-----
const lines = arr => arr.join(',\n');
fs.writeFileSync(path.join(root, 'data/foods.js'), `'use strict';
// 食事（パッチ7.xで追加された、戦闘用のもの。製作・採集用は除く）。数値は HQ のもの。
// params: {stat: 上がるステータス, pct: 上がる割合(%), max: 上限}。値は XIVAPI（ゲームデータ）から作っています。
// 作り直すとき: node tools/gear/build-gear-data.mjs
window.MP_FOODS = [
${lines(foods.map(f => '  ' + JSON.stringify(f)))}
];
`);
fs.writeFileSync(path.join(root, 'data/gear.js'), `'use strict';
// ジョブごとの装備プリセット（メンバーのステータスが空欄のときの標準値）。
// https://fuucdayo.com/battle/8759/ の「Patch7.55 最終装備」の各ジョブの最初の装備パターンから作りました。
// 装備名はサイトの装備ページから取り、ステータスは etro.gg の各部位の値（装備＋マテリア、部位ごとの上限まで）から積み上げています。
// 食事の分は含みません（食事は food で選ぶ）。サイトのステータス欄（食事の分を除く）とも照合しています。
// gearAttrs は STR・DEX・VIT・INT・MND の装備だけの合計（ジョブの基礎値・種族の補正・パーティボーナス +5% は含まない）。
// def / mdef は物理防御・魔法防御、wd / wdPhys は武器の魔法・物理性能（どれも etro.gg の値）。items は装備のアイテムID。
// food は data/foods.js の id（サイトで使っている食事）。wd は武器の魔法性能（回復量の計算に使う）、wdPhys は物理性能。
// サブステータスは基礎値（クリ・DH・SS・不屈 420、意思・信仰 440）込み。
// 作り直すとき: tools/gear/gear-source.json を直してから node tools/gear/build-gear-data.mjs
window.MP_GEAR = {
${lines(Object.entries(gear).map(([k, v]) => '  ' + k + ': ' + JSON.stringify(v)))}
};
`);
console.log(`食事 ${foods.length} 件、装備 ${Object.keys(gear).length} ジョブを書き出しました。`);
