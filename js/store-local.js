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
  // 攻撃の追加・削除など、プランはそのままで戦闘データだけ差し替える
  updateFight(f){ fight = f; renderAll(); },
};
const localKey = (p) => fight ? p + fight.key : null;
let savedFightRef = null;
function saveLocal(){
  if (!fight) return;
  store.set(localKey('fflp-plan-'), plan.map(cleanEntry));
  store.set(localKey('fflp-types-'), fight.abilityTypes);
  store.set(localKey('fflp-members-'), {members:membersObj(members), partySize});
  store.set(localKey('fflp-ovr-'), overrides);
  // 最後に開いていた戦闘（手入力のTLを含む）を覚えておき、次に開いたときに出す。中身が変わったときだけ書く
  if (savedFightRef !== fight) {
    savedFightRef = fight;
    const packed = packFight(fight);
    store.set('fflp-lastfight', packed);
    // TL の一覧にも入れる（プルダウンで切り替えられるように）
    store.set('fflp-fight-' + fight.key, packed);
    const list = localTlList().filter(x => x.key !== fight.key);
    const old = localTlList().find(x => x.key === fight.key);
    list.push({key:fight.key, name:fight.name, at:old ? old.at : Date.now()});
    store.set('fflp-tls', list);
  }
}
// このブラウザに保存した TL の一覧（作った順）
function localTlList(){
  const l = store.get('fflp-tls');
  return Array.isArray(l) ? l.filter(x => x && typeof x.key === 'string').sort((a, b) => (a.at || 0) - (b.at || 0)) : [];
}
function selectLocalTl(key){
  const p = store.get('fflp-fight-' + key);
  if (!p) return setStatus('このTLのデータが見つかりませんでした。', 'err');
  try { setFight(unpackFight(p), null, null); resetHistory(); setStatus(`TL「${fight.name}」を表示しています。`, 'ok'); }
  catch (e) { setStatus('このTLのデータを読み取れませんでした。', 'err'); }
}
// TL をこのブラウザから消す（戦闘・プラン・メンバー・上書き）。表示中なら、ほかの TL に切り替える
function deleteLocalTl(key){
  for (const p of ['fflp-fight-', 'fflp-plan-', 'fflp-types-', 'fflp-members-', 'fflp-ovr-']) store.del(p + key);
  store.set('fflp-tls', localTlList().filter(x => x.key !== key));
  if (fight && fight.key === key) {
    const rest = localTlList();
    savedFightRef = null; store.del('fflp-lastfight');
    if (rest.length) selectLocalTl(rest[rest.length - 1].key);
    else { fight = null; plan = []; resetHistory(); renderAll(); }
  } else renderAll();
}
function cleanEntry(e){ const o = {uid:e.uid, mitId:e.mitId, t:e.t, target:e.target, caster:e.caster || null}; if (e.custom) o.custom = {...e.custom}; if (e.ovr && Object.keys(e.ovr).length) o.ovr = {...e.ovr}; return o; }
function validEntry(e){ return e && (e.custom || Object.hasOwn(MIT, e.mitId)) && isFinite(e.t); }
// 共有データから届いた軽減を、数値や文字列の型をそろえて取り込む（他人が書いた値はそのまま信用しない）
function toEntry(id, x){
  const tgt = x.target === 'all' ? 'all' : (typeof x.target === 'string' && SLOT_IDS.includes(x.target)) ? x.target : (Number.isFinite(+x.target) ? +x.target : 'all');
  const e = {uid:String(id), mitId:String(x.mitId || ''), t:clampNum(x.t, 0, 3600, NaN), target:tgt,
    caster:typeof x.caster === 'string' && SLOT_IDS.includes(x.caster) ? x.caster : Number.isInteger(x.caster) ? x.caster : null, by:typeof x.by === 'string' ? x.by : null};
  // 手入力の回復量・HoT・バリア量（1人あたり）
  const ovr = cleanOvr(x.ovr); if (ovr) e.ovr = ovr;
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


const rawOps = () => mode === 'shared' ? SharedOps : mode === 'room' ? RoomOps : Local;
// 操作は戻る・進むの履歴に記録する（js/history.js）
const ops = () => recorded(rawOps());
// 手入力の回復量・HoT の1回分・バリア量を、正の整数だけ取り込む
function cleanOvr(x){
  if (!x || typeof x !== 'object') return null;
  const o = {};
  for (const k of ['heal', 'hot', 'shield']) { const v = Math.round(+x[k]); if (v > 0 && v < 1e7) o[k] = v; }
  return Object.keys(o).length ? o : null;
}
