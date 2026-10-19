'use strict';
// メンバー（ジョブ・ステータス・最大HP）と、不屈・防御力による被ダメ倍率

// ===== メンバー =====
const activeMembers = () => members.slice(0, partySize);
const memberById = id => members.find(m => m.id === id) || null;
const isActiveId = id => activeMembers().some(m => m.id === id);
const jobOf = m => JOB_DATA[m && m.job] || null;
const roleOf = m => (jobOf(m) || {}).role || 'melee';
const statOf = (m, k) => (m && m[k] > 0) ? m[k] : ((jobOf(m) || {})[k] || 0);
function logPlayer(m){ return fight && m && m.pid >= 0 ? fight.playerMap.get(m.pid) || null : null; }
function defaultHp(m){ const lp = logPlayer(m); return (lp && lp.maxHP) || (jobOf(m) || {}).hp || FALLBACK_HP[roleGroup(roleOf(m))]; }
function hpOf(m){ return m.hp > 0 ? m.hp : defaultHp(m); }
function memberName(m){ if (!m) return '?'; const lp = logPlayer(m); return m.name || (lp && lp.name) || (jobOf(m) || {}).ja || m.job; }
// 不屈による被ダメージ倍率（Lv100）
function tenMul(m){
  if (!settings.ten) return 1;
  const ten = Math.max(statOf(m, 'ten'), TEN_SUB);
  return (1000 - Math.floor(200 * (ten - TEN_SUB) / TEN_DIV)) / 1000;
}
// 物理防御力・魔法防御力による被ダメージ倍率（Lv100）。特殊ダメージには使わない。値が0（未入力）なら掛けない
function defMul(m, type){
  if (!settings.def || type === 'unique') return 1;
  const v = statOf(m, type === 'phys' ? 'def' : 'mdef');
  if (!(v > 0)) return 1;
  return 1 - Math.floor(15 * v / TEN_DIV) / 100;
}
function normMember(id, x, fb){
  x = x && typeof x === 'object' ? x : {};
  const o = {id, job:JOB_DATA[x.job] && JOB_ORDER.includes(x.job) ? x.job : fb.job, name:String(x.name || '').slice(0, 20), pid:Number.isInteger(+x.pid) ? +x.pid : fb.pid};
  for (const k of STAT_KEYS) o[k] = clampNum(x[k], 0, 9999999, 0);
  return o;
}
// ログのプレイヤーから初期メンバーを作る（足りない枠は標準の編成）
function defaultMembers(f){
  const ps = f ? [...f.players].sort((a, b) => (ROLE_ORDER[jobRoleOfLog(a)] - ROLE_ORDER[jobRoleOfLog(b)]) || a.id - b.id) : [];
  return SLOT_IDS.map((id, i) => {
    const p = ps[i];
    const o = {id, job:p ? (JOB_FROM_LOG[p.job] || DEFAULT_COMP[i]) : DEFAULT_COMP[i], name:'', pid:p ? p.id : -1};
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
