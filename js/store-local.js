'use strict';
// 保存先の切り替えと、このブラウザだけに保存するローカル版

// ===== 保存先（ローカル / 共有ページ / ルーム）=====
let mode = 'local';
const Local = {
  add(e){ plan.push(e); renderAll(); },
  update(e){ renderAll(); },
  remove(id){ plan = plan.filter(e => e.uid !== id); renderAll(); },
  clear(){ plan = []; renderAll(); },
  setType(id, t){ fight.abilityTypes[id] = t; renderAll(); },
  setMember(m){ renderAll(); },
  setPartySize(n){ partySize = n; renderAll(); },
  setOverride(k, v){ if (v) overrides[k] = v; else delete overrides[k]; renderAll(); },
  async loadFight(f, planList, extra){ setFight(f, planList, extra); },
};
const localKey = (p) => fight ? p + fight.key : null;
function saveLocal(){
  if (!fight) return;
  store.set(localKey('fflp-plan-'), plan.map(cleanEntry));
  store.set(localKey('fflp-types-'), fight.abilityTypes);
  store.set(localKey('fflp-members-'), {members:membersObj(members), partySize});
  store.set(localKey('fflp-ovr-'), overrides);
}
function cleanEntry(e){ const o = {uid:e.uid, mitId:e.mitId, t:e.t, target:e.target, caster:e.caster || null}; if (e.custom) o.custom = {...e.custom}; return o; }
function validEntry(e){ return e && (e.custom || Object.hasOwn(MIT, e.mitId)) && isFinite(e.t); }
// 共有データから届いた軽減を、数値や文字列の型をそろえて取り込む（他人が書いた値はそのまま信用しない）
function toEntry(id, x){
  const tgt = x.target === 'all' ? 'all' : (typeof x.target === 'string' && SLOT_IDS.includes(x.target)) ? x.target : (Number.isFinite(+x.target) ? +x.target : 'all');
  const e = {uid:String(id), mitId:String(x.mitId || ''), t:clampNum(x.t, 0, 3600, NaN), target:tgt,
    caster:typeof x.caster === 'string' && SLOT_IDS.includes(x.caster) ? x.caster : null, by:typeof x.by === 'string' ? x.by : null};
  if (x.custom && typeof x.custom === 'object') e.custom = {name:String(x.custom.name || '自作軽減').slice(0, 30), p:clampNum(x.custom.p, 0, 100, 0), m:clampNum(x.custom.m, 0, 100, 0), d:clampNum(x.custom.d, 1, 600, 1)};
  return e;
}

// 戦闘を画面にセット（ローカル）。planList / extra が null なら保存済みの内容を使う
function setFight(f, planList, extra){
  fight = f; selCast = null; selEntry = null; openRows = new Set();
  const types = store.get(localKey('fflp-types-')); if (types) Object.assign(fight.abilityTypes, types);
  const sm = extra ? {members:extra.members, partySize:extra.partySize} : store.get(localKey('fflp-members-'));
  members = mergeMembers(sm && sm.members);
  partySize = sm && sm.partySize >= 1 && sm.partySize <= 8 ? Math.round(sm.partySize) : defaultPartySize(fight);
  overrides = cleanOverrides(extra ? extra.overrides : store.get(localKey('fflp-ovr-')));
  if (planList) plan = planList.map(e => toEntry(uid(), e || {})).filter(validEntry);
  else { const p = store.get(localKey('fflp-plan-')); plan = Array.isArray(p) ? p.map(e => toEntry(e && e.uid || uid(), e || {})).filter(validEntry) : []; }
  renderAll();
}


const ops = () => mode === 'shared' ? SharedOps : mode === 'room' ? RoomOps : Local;
