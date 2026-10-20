// data/foods.js と data/gear.js を作り直すスクリプト（Node.js 18 以上）。
//   node tools/gear/build-gear-data.mjs
// - 食事：XIVAPI（ゲームデータ）から、アイテムレベル690以上（パッチ7.x）の料理を取り、戦闘用のものだけ残す
// - 装備：tools/gear/gear-source.json（https://fuucdayo.com/battle/8759/ の各ジョブの最初の装備パターン。
//         サイトの数値は食事込み）から、食事の分を除いた「装備だけ」の値を出す。武器の性能は XIVAPI から取る
// 装備を更新するときは gear-source.json の stats（サイトのステータス欄の数値）・food・weapon を書き換えて実行してください。
import fs from 'node:fs';
import path from 'node:path';
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
const STAT = {'クリティカル':'crit', '意思力':'det', 'DH':'dh', 'スキルスピード':'ss', 'スペルスピード':'ss', '不屈':'ten', '信仰':'pie', 'VIT':'vit', 'MND':'mnd'};
const source = JSON.parse(fs.readFileSync(path.join(here, 'gear-source.json'), 'utf8'));
const gear = {};
for (const [job, g] of Object.entries(source)) {
  const f = foodByName.get(g.food);
  if (!f) throw new Error(`${job}: 食事「${g.food}」が見つかりません`);
  const st = {};
  for (const [k, v] of Object.entries(g.stats)) if (STAT[k]) st[STAT[k]] = v;
  for (const p of f.params) if (st[p.stat] != null) st[p.stat] = unfood(st[p.stat], p.pct, p.max);
  const w = await get('search', {sheets:'Item', query:`+Name="${g.weapon}"`, language:'ja', fields:'Name,LevelItem.value,DamagePhys,DamageMag'});
  const wf = w.results[0] && w.results[0].fields;
  if (!wf) throw new Error(`${job}: 武器「${g.weapon}」が見つかりません`);
  gear[job] = {name:`Patch7.55 最終装備（${g.pattern}）`, source:`https://fuucdayo.com/gearset/${g.url}/`, weapon:g.weapon, ilvl:wf.LevelItem.value,
    food:f.id, stats:{vit:st.vit, crit:st.crit, det:st.det, dh:st.dh, ss:st.ss, ten:st.ten || 420, pie:st.pie || 440,
      ...(st.mnd ? {mnd:st.mnd} : {}), wd:wf.DamageMag, wdPhys:wf.DamagePhys}};
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
// サイトの数値は食事込みなので、ここでは食事の分を除いた「装備だけ」の値にしています（食事は food で選ぶ）。
// food は data/foods.js の id（サイトで使っている食事）。wd は武器の魔法性能（回復量の計算に使う）、wdPhys は物理性能。
// ten / pie は、その装備で上がっていなければ基準値（不屈 420、信仰 440）。
// 作り直すとき: tools/gear/gear-source.json を直してから node tools/gear/build-gear-data.mjs
window.MP_GEAR = {
${lines(Object.entries(gear).map(([k, v]) => '  ' + k + ': ' + JSON.stringify(v)))}
};
`);
console.log(`食事 ${foods.length} 件、装備 ${Object.keys(gear).length} ジョブを書き出しました。`);
