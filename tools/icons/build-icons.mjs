// data/icons.js（スキルとジョブの公式アイコン）と data/action-ids.js（スキルのゲーム内ID）を作り直すスクリプト（Node.js 18 以上）。
//   node tools/icons/build-icons.mjs
// - スキル：data/mitigations.js と data/heals.js の日本語名で XIVAPI（ゲームデータ）の Action を探し、そのアイコンを使う
// - ジョブ：ゲーム内のジョブアイコン（062100 + ClassJob の番号）
// アイコンは画像（PNG）を data URI にして data/icons.js に埋め込むので、ファイルを直接開いてもネットなしで表示できます。
// 名前で見つからない・違うスキルが選ばれるときは、PICK に Action の番号を書いてください。
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
const png = async iconPath => {
  const res = await fetch(`${API}/asset?${new URLSearchParams({path:iconPath, format:'png'})}`);
  if (!res.ok) throw new Error(`${iconPath}: ${res.status}`);
  return 'data:image/png;base64,' + Buffer.from(await res.arrayBuffer()).toString('base64');
};

// 名前で決まらないスキルの Action の番号（スキルの id → Action の番号）
const PICK = {
  essdig: 3614, // 星天開門（同じ名前の古い Action があるため）
};

// スキルの一覧を data/ のファイルから読む
const ctx = {window:{}};
vm.createContext(ctx);
for (const f of ['data/mitigations.js', 'data/heals.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
const skills = vm.runInContext('[...MITS, ...HEALS]', ctx);

const actions = {}, picked = {}, actionIds = {};
for (const s of skills) {
  // FF Logs のログでスキルを見分けるためのゲーム内ID（同じ名前のプレイヤーのスキル。PvP 用などを含む）
  const all = await get('search', {sheets:'Action', query:`Name="${s.name}"`, language:'ja', fields:'IsPlayerAction', limit:'50'});
  actionIds[s.id] = [...new Set([PICK[s.id], ...all.results.filter(x => x.fields.IsPlayerAction).map(x => x.row_id)].filter(Boolean))].sort((a, b) => a - b);
  let row;
  if (PICK[s.id]) {
    row = (await get(`sheet/Action/${PICK[s.id]}`, {language:'ja', fields:'Name,Icon'})).fields;
    row.row_id = PICK[s.id];
  } else {
    const r = await get('search', {sheets:'Action', query:`Name="${s.name}"`, language:'ja',
      fields:'Name,Icon,IsPlayerAction,ClassJobLevel,ClassJob.Abbreviation', limit:'50'});
    const cands = r.results.map(x => ({...x.fields, row_id:x.row_id, job:x.fields.ClassJob.fields && x.fields.ClassJob.fields.Abbreviation}));
    // プレイヤーのスキル > そのジョブのスキル > 番号の小さいもの
    const score = c => (c.IsPlayerAction ? 4 : 0) + (s.jobs.includes(c.job) ? 2 : 0) + (c.ClassJobLevel > 0 ? 1 : 0);
    cands.sort((a, b) => score(b) - score(a) || a.row_id - b.row_id);
    row = cands[0];
  }
  if (!row) { console.warn(`見つからない: ${s.id} ${s.name}`); continue; }
  actions[s.id] = await png(row.Icon.path);
  picked[s.id] = {action:row.row_id, icon:row.Icon.id};
  // エウクラシア系など、プレイヤーのスキルとして登録されていないものは、アイコンに使った Action の番号を入れる
  if (!actionIds[s.id].includes(row.row_id)) actionIds[s.id] = [...actionIds[s.id], row.row_id].sort((a, b) => a - b);
  console.log(`${s.id.padEnd(13)} ${String(row.row_id).padStart(6)} ${row.Name}`);
}

// ジョブのアイコン（ClassJob の番号）
const CLASSJOB = {PLD:19, MNK:20, WAR:21, DRG:22, BRD:23, WHM:24, BLM:25, SMN:27, SCH:28, NIN:30, MCH:31, DRK:32, AST:33,
  SAM:34, RDM:35, GNB:37, DNC:38, RPR:39, SGE:40, VPR:41, PCT:42};
const jobs = {};
for (const [j, n] of Object.entries(CLASSJOB)) jobs[j] = await png(`ui/icon/062000/0621${String(n).padStart(2, '0')}.tex`);

const out = `'use strict';
// スキルとジョブの公式アイコン（tools/icons/build-icons.mjs で作ったファイルです。手で直さないでください）
// (C) SQUARE ENIX
// Action の番号: ${JSON.stringify(picked)}
window.MP_OFFICIAL_ICONS = {
  actions: {
${Object.entries(actions).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n')}
  },
  jobs: {
${Object.entries(jobs).map(([k, v]) => `    ${k}: ${JSON.stringify(v)},`).join('\n')}
  },
};
`;
fs.writeFileSync(path.join(root, 'data/icons.js'), out);
fs.writeFileSync(path.join(root, 'data/action-ids.js'), `'use strict';
// スキルのゲーム内ID（FF Logs のログで使われたスキルを見分けるのに使う）。tools/icons/build-icons.mjs で作ったファイルです
window.MP_ACTION_IDS = {
${Object.entries(actionIds).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n')}
};
`);
console.log(`data/icons.js: スキル ${Object.keys(actions).length} / ${skills.length}、ジョブ ${Object.keys(jobs).length}、${Math.round(out.length / 1024)}KB`);
