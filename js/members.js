'use strict';
// メンバー（ジョブ・ステータス・最大HP）と、不屈・防御力による被ダメ倍率

// ===== メンバー =====
const activeMembers = () => members.slice(0, partySize);
const memberById = id => members.find(m => m.id === id) || null;
const isActiveId = id => activeMembers().some(m => m.id === id);
const jobOf = m => JOB_DATA[m && m.job] || null;
const roleOf = m => (jobOf(m) || {}).role || 'melee';
// 種族（空ならララフェル（デューンフォーク）など、data/modifiers.js の標準の種族）
const clanOf = m => CLAN[m && m.race] || CLAN[DEFAULT_CLAN] || null;
// 装備なしの能力値（STR・DEX・VIT・INT・MND）：ジョブの基礎値 ⌊main × ジョブ補正 ÷ 100⌋ に種族の補正を足したもの
// （例：デューンフォークのガンブレイカーは STR 439 / DEX 419 / VIT 482 / INT 266 / MND 443）
function nakedAttr(m, k){
  const jm = JOB_MODS[m && m.job], c = clanOf(m);
  if (!jm) return 0;
  return Math.floor(LV.main * jm[k] / 100) + (c ? c.mod[ATTR_KEYS.indexOf(k)] : 0);
}
// 装備プリセットの能力値：（装備なしの値＋装備）にパーティボーナスを掛ける（設定でオフにしたときは掛けない）
const partyBonusPct = () => settings.partyBonus === false ? 0 : (LV.partyBonus || 0);
function presetAttr(m, k){
  const j = jobOf(m) || {};
  const gear = j.gearAttrs && j.gearAttrs[k];
  if (gear == null || !JOB_MODS[m && m.job]) return j[k] || 0;
  return Math.floor((nakedAttr(m, k) + gear) * (100 + partyBonusPct()) / 100);
}
// 装備だけの値（手入力があればそれ、なければジョブの装備プリセット）。能力値の手入力はゲーム内の値（種族の補正込み）
const baseStatOf = (m, k) => (m && m[k] > 0) ? m[k] : ATTR_KEYS.includes(k) ? presetAttr(m, k) : ((jobOf(m) || {})[k] || 0);
// メンバーの食事：'none' は食事なし、空ならジョブの装備プリセットの食事
function foodOf(m){
  if (!m || m.food === 'none') return null;
  return FOOD[m.food] || FOOD[(jobOf(m) || {}).food] || null;
}
// 食事で上がる量（素の値 × 割合、ただし上限まで）。f を渡すとその食事で計算する
function foodBonus(m, k, f = foodOf(m)){
  const p = f && f.params.find(x => x.stat === k);
  return p ? Math.min(Math.floor(baseStatOf(m, k) * p.pct / 100), p.max) : 0;
}
// 計算に使う値（装備＋食事）
const statOf = (m, k) => baseStatOf(m, k) + (FOOD_STATS.has(k) ? foodBonus(m, k) : 0);
// VIT 1 あたりの最大HP（data/job-data.js の MP_LEVEL.hpPerVit）
const hpPerVitOf = m => (LV.hpPerVit || {})[roleOf(m) === 'tank' ? 'tank' : 'other'] || 0;
// VIT から出す最大HP（Lv100）：⌊Lv の HP × ジョブのHP補正 ÷ 100⌋ + ⌊(VIT − main) × hpPerVit⌋。出せなければ 0
function hpFromVit(m, vit){
  const jm = JOB_MODS[m && m.job];
  if (!jm || !(LV.hp > 0) || !(vit > 0)) return 0;
  return Math.floor(LV.hp * jm.hp / 100) + Math.floor((vit - LV.main) * hpPerVitOf(m));
}
// 食事の VIT で増える HP（f を渡すとその食事で計算する）
function foodHp(m, f = foodOf(m)){ return Math.floor(foodBonus(m, 'vit', f) * hpPerVitOf(m)); }
function logPlayer(m){ return fight && m && m.pid >= 0 ? fight.playerMap.get(m.pid) || null : null; }
// 食事なしの最大HP（メンバー表に出す値）。VIT を手入力していればその VIT から。
// ログのHPは食事込みなので、そのジョブの装備プリセットの食事を食べていたものとして、その分を引く
function defaultHp(m){
  const lp = logPlayer(m);
  if (m.vit > 0) { const v = hpFromVit(m, m.vit); if (v) return v; }
  if (lp && lp.maxHP) return lp.maxHP - foodHp(m, FOOD[(jobOf(m) || {}).food] || null);
  return hpFromVit(m, statOf(m, 'vit')) || (jobOf(m) || {}).hp || FALLBACK_HP[roleGroup(roleOf(m))];
}
// TL・計算に使う最大HP（食事込み）。手入力の HP・ログの HP は食事なしの値に、選んだ食事の VIT の分を足す。
// VIT から出すときは、食事込みの VIT から出す
function hpOf(m){
  if (m.hp > 0) return m.hp + foodHp(m);
  const lp = logPlayer(m);
  if (!(m.vit > 0) && lp && lp.maxHP) return defaultHp(m) + foodHp(m);
  return hpFromVit(m, statOf(m, 'vit') + foodBonus(m, 'vit')) || defaultHp(m) + foodHp(m);
}
function memberName(m){ if (!m) return '?'; const lp = logPlayer(m); return m.name || (lp && lp.name) || (jobOf(m) || {}).ja || m.job; }
// 不屈による被ダメージ倍率（Lv100）
function tenMul(m){
  if (!settings.ten) return 1;
  const ten = Math.max(statOf(m, 'ten'), TEN_SUB);
  return (1000 - Math.floor(200 * (ten - TEN_SUB) / TEN_DIV)) / 1000;
}
// 物理防御力・魔法防御力による被ダメージ倍率（Lv100）：(100 − ⌊15 × 防御力 ÷ 2780⌋) ÷ 100。特殊ダメージには使わない
function defMulOf(v, type){ return type === 'unique' || !(v > 0) ? 1 : (100 - Math.floor(15 * v / TEN_DIV)) / 100; }
const defValueOf = (m, type) => type === 'phys' ? statOf(m, 'def') : type === 'mag' ? statOf(m, 'mdef') : 0;
const defMul = (m, type) => defMulOf(defValueOf(m, type), type);
// ログのプレイヤーの防御力による倍率（そのジョブの装備プリセットの防御力）。ログの元ダメージから防御力の分を戻すのに使う
function logDefMul(p, type){ const j = JOB_DATA[JOB_FROM_LOG[p && p.job]] || {}; return defMulOf(type === 'phys' ? j.def : type === 'mag' ? j.mdef : 0, type); }
function normMember(id, x, fb){
  x = x && typeof x === 'object' ? x : {};
  const o = {id, job:JOB_DATA[x.job] && JOB_ORDER.includes(x.job) ? x.job : fb.job, name:String(x.name || '').slice(0, 20), pid:Number.isInteger(+x.pid) ? +x.pid : fb.pid,
    food:typeof x.food === 'string' && (x.food === 'none' || FOOD[x.food]) ? x.food : (fb.food || ''),
    race:typeof x.race === 'string' && CLAN[x.race] ? x.race : (fb.race || '')};
  for (const k of STAT_KEYS) o[k] = clampNum(x[k], 0, 9999999, 0);
  return o;
}
// ログのプレイヤーから初期メンバーを作る（足りない枠は標準の編成）
function defaultMembers(f){
  const ps = f ? [...f.players].sort((a, b) => (ROLE_ORDER[jobRoleOfLog(a)] - ROLE_ORDER[jobRoleOfLog(b)]) || a.id - b.id) : [];
  return SLOT_IDS.map((id, i) => {
    const p = ps[i];
    const o = {id, job:p ? (JOB_FROM_LOG[p.job] || DEFAULT_COMP[i]) : DEFAULT_COMP[i], name:'', pid:p ? p.id : -1, food:'', race:''};
    for (const k of STAT_KEYS) o[k] = 0;
    return o;
  });
}
function jobRoleOfLog(p){ const j = JOB_FROM_LOG[p.job]; return (JOB_DATA[j] || {}).role || (p.role === 'tank' ? 'tank' : p.role === 'healer' ? 'healer' : 'melee'); }
function defaultPartySize(f){ return f && f.players.length ? Math.min(8, f.players.length) : 8; }
function mergeMembers(raw){
  const base = defaultMembers(fight);
  if (!raw || typeof raw !== 'object') return base;
  return base.map(b => raw[b.id] ? normMember(b.id, raw[b.id], b) : b);
}
const membersObj = list => Object.fromEntries(list.map(m => [m.id, {...m}]));
const castKey = c => `${Math.round(c.t)}-${String(c.abilityId).replace(/[^A-Za-z0-9]/g, '')}`;
function cleanOverrides(o){ const r = {}; if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (/^[A-Za-z0-9-]{1,32}$/.test(k) && +v > 0 && +v < 1e8) r[k] = Math.round(+v); return r; }
