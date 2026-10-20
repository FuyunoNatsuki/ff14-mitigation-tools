'use strict';
// 手入力のTL：空のTLを作る、攻撃を追加する・消す

// ゲーム内のジョブ記号 → FF Logs のジョブ名（手入力のTLでも、ログと同じ形のプレイヤーを作るため）
const LOG_JOB = Object.fromEntries(Object.entries(JOB_FROM_LOG).map(([log, code]) => [code, log]));

// 今のメンバー表のメンバーで、攻撃のない空のTLを作る
function newManualFight(name, durationSec){
  const players = members.map((m, i) => ({id:i + 1, name:memberName(m), job:LOG_JOB[m.job] || m.job,
    role:roleGroup(roleOf(m)), maxHP:m.hp > 0 ? m.hp : 0}));
  return finishFight({key:'manual-' + uid(), name, duration:Math.round(durationSec * 1000), excluded:0, sample:false, manual:true,
    players, abilityTypes:{}, casts:[]});
}

// 攻撃の名前から、同じ名前どうしで種別を共有するための ID を作る
function manualAbilityId(name){
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 'u' + h.toString(36);
}

// 「当たる人」の選択肢：全員・ロールごと・メンバー1人ずつ（ログのプレイヤーに対応しているメンバーだけ）
function castTargetsFor(sel){
  const act = activeMembers().filter(m => m.pid >= 0);
  if (sel === 'all') return act;
  if (sel === 'tank' || sel === 'healer') return act.filter(m => roleOf(m) === sel);
  if (sel === 'dps') return act.filter(m => roleGroup(roleOf(m)) === 'dps');
  return act.filter(m => m.id === sel);
}
function renderAddCast(){
  const sel = $('acTarget');
  if (!sel || document.activeElement === sel) return;
  const cur = sel.value || 'all';
  const opts = [['all', '全員'], ['tank', 'タンク'], ['healer', 'ヒーラー'], ['dps', 'DPS'],
    ...activeMembers().filter(m => m.pid >= 0).map(m => [m.id, memberName(m)])];
  sel.innerHTML = opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
  sel.value = opts.some(o => o[0] === cur) ? cur : 'all';
  $('acAdd').disabled = readOnly || !fight;
  $('newTl').disabled = readOnly && mode === 'shared';
}

$('newTl').addEventListener('click', () => {
  if (readOnly) return;
  const name = $('newTlName').value.trim().slice(0, 60) || '手入力のTL';
  const len = parseT($('newTlLen').value || '10:00');
  if (len == null || len <= 0 || len > 3600) return setStatus('戦闘の長さは「10:00」のように分:秒で入れてください（最長60分）。', 'err');
  const f = newManualFight(name, len);
  // メンバーのステータスはそのまま引き継ぎ、ログのプレイヤーは1〜8番に対応させる
  const keep = membersObj(members.map((m, i) => ({...m, pid:i + 1})));
  ops().loadFight(f, [], {members:keep, partySize, overrides:{}});
  $('addCastBox').open = true;
  setStatus(`空のTL「${name}」を作りました。「攻撃ごとの予測」の「攻撃を追加」から攻撃を入れてください。`, 'ok');
});

$('acAdd').addEventListener('click', () => {
  if (readOnly || !fight) return;
  const t = parseT($('acTime').value);
  const name = $('acName').value.trim().slice(0, 40);
  const dmg = Math.round(+$('acDmg').value);
  const type = $('acType').value;
  if (t == null || t < 0) return setStatus('時刻は「1:23.0」のように分:秒で入れてください。', 'err');
  if (t * 1000 > fight.duration) return setStatus(`時刻が戦闘の長さ（${fmtT(fight.duration / 1000)}）を超えています。`, 'err');
  if (!name) return setStatus('攻撃の名前を入れてください。', 'err');
  if (!(dmg > 0 && dmg < 1e8)) return setStatus('元ダメージを入れてください。', 'err');
  const targets = castTargetsFor($('acTarget').value);
  if (!targets.length) return setStatus('当たる人がいません。メンバー表の「ログのプレイヤー」を確認してください。', 'err');
  const abilityId = manualAbilityId(name);
  const cast = {t:Math.round(t * 1000), abilityId, name, nHits:targets.length, nExcl:0, manual:true,
    targets:targets.map(m => ({pid:m.pid, raw:dmg, est:false, n:1, actual:0}))};
  const types = {...fight.abilityTypes};
  if (!(abilityId in types) || ['phys', 'mag', 'unique'].includes(type)) types[abilityId] = type;
  const f = finishFight({...fight, abilityTypes:types, casts:[...fight.casts, cast].sort((a, b) => a.t - b.t)});
  selCast = null; openRows = new Set();
  ops().updateFight(f);
  setStatus(`${fmtT(t)} に「${name}」を追加しました。`, 'ok');
});

// 表の行の「削除」：手入力で追加した攻撃だけ消せる（2回押しで確認）
let delArmed = null;
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-delcast]'); if (!b || readOnly || !fight) return;
  ev.stopPropagation();
  const id = +b.dataset.delcast, c = fight.casts[id];
  if (!c || !c.manual) return;
  if (delArmed !== id) { delArmed = id; b.textContent = 'もう一度押すと削除'; setTimeout(() => { if (delArmed === id) { delArmed = null; b.textContent = '削除'; } }, 3000); return; }
  delArmed = null;
  const f = finishFight({...fight, casts:fight.casts.filter(x => x !== c)});
  selCast = null; openRows = new Set();
  ops().updateFight(f);
  setStatus(`「${c.name}」（${fmtT(c.t / 1000)}）を削除しました。`, 'ok');
}, true);
