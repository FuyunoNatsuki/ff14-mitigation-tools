'use strict';
// 操作の戻る・進む（Ctrl+Z / Ctrl+Y、メニューのボタン）
// 自分の操作の前と後のようす（プラン・種別・メンバー・人数・元ダメの上書き・戦闘データ）を記録しておき、
// 戻すときは、その操作で変わったところだけを前の値に戻す（ルームでほかの人が変えたところには触らない）。
// 同じ操作の中でまとめて行われた変更（データの取り込みなど）は、1回の操作として戻す。TL を切り替えると履歴は消える

const History = {undo:[], redo:[], last:null, pending:null, applying:false};
const HISTORY_MAX = 100;

// 今のようす。プランとメンバーは JSON の文字列にして持つ（あとから中身が書き換わっても影響しないように）
function histSnap(){
  return {key:fight ? fight.key + '|' + (mode === 'room' ? Room.tl : '') : null, fight,
    plan:new Map(plan.map(e => [e.uid, JSON.stringify(cleanEntry(e))])),
    types:JSON.stringify(fight ? fight.abilityTypes : {}),
    members:new Map(members.map(m => [m.id, JSON.stringify(m)])),
    partySize, overrides:JSON.stringify(overrides)};
}
function histChanged(a, b){
  if (a.fight !== b.fight || a.partySize !== b.partySize || a.types !== b.types || a.overrides !== b.overrides) return true;
  for (const k of ['plan', 'members']) {
    if (a[k].size !== b[k].size) return true;
    for (const [id, v] of a[k]) if (b[k].get(id) !== v) return true;
  }
  return false;
}
function resetHistory(){ History.undo = []; History.redo = []; History.last = null; History.pending = null; renderHistoryButtons(); }
// 描き直しのたびに呼ぶ：ほかの人の変更や TL の切り替えのあとのようすを、次の操作の「前」にする
function syncHistory(){
  if (History.applying || History.pending) return;
  const s = histSnap();
  if (History.last && History.last.key !== s.key) { History.undo = []; History.redo = []; }
  History.last = s;
  renderHistoryButtons();
}

// 保存先の操作に記録を挟む（loadFight は TL を足す操作なので記録しない）
function recorded(raw){
  const o = {};
  for (const k of Object.keys(raw)) o[k] = (...args) => {
    if (k !== 'loadFight' && !History.applying && !History.pending) {
      History.pending = {before:History.last || histSnap()};
      queueMicrotask(finishOp);
    }
    return raw[k](...args);
  };
  return o;
}
function finishOp(){
  const p = History.pending; History.pending = null;
  if (!p) return;
  const after = histSnap();
  if (p.before.key && p.before.key === after.key && histChanged(p.before, after)) {
    History.undo.push({before:p.before, after});
    if (History.undo.length > HISTORY_MAX) History.undo.shift();
    History.redo = [];
  }
  History.last = after;
  renderHistoryButtons();
}

// from のようすから to のようすへ：from と to で違うところだけ、to の値にする
function applyDelta(from, to){
  const o = rawOps();
  History.applying = true;
  try {
    if (to.fight !== from.fight && to.fight) o.updateFight(to.fight);
    for (const [id, js] of to.plan) {
      if (from.plan.get(id) === js) continue;
      const x = toEntry(id, JSON.parse(js)), cur = plan.find(e => e.uid === id);
      if (cur) { Object.assign(cur, x); o.update(cur); } else o.add(x);
    }
    for (const id of from.plan.keys()) if (!to.plan.has(id) && plan.some(e => e.uid === id)) o.remove(id);
    if (to.types !== from.types && fight) {
      const tt = JSON.parse(to.types), ft = JSON.parse(from.types);
      for (const [id, t] of Object.entries(tt)) if (ft[id] !== t) o.setType(id, t);
    }
    for (const [id, js] of to.members) {
      if (from.members.get(id) === js) continue;
      const m = memberById(id);
      if (m) { Object.assign(m, JSON.parse(js)); o.setMember(m); }
    }
    if (to.partySize !== from.partySize) o.setPartySize(to.partySize);
    if (to.overrides !== from.overrides) {
      const tv = JSON.parse(to.overrides), fv = JSON.parse(from.overrides);
      for (const k of new Set([...Object.keys(tv), ...Object.keys(fv)])) if (tv[k] !== fv[k]) o.setOverride(k, tv[k] || null);
    }
  } finally { History.applying = false; }
  History.last = histSnap();
}
function undo(){
  if (readOnly || !History.undo.length) return;
  const h = History.undo.pop();
  selEntry = null;
  applyDelta(h.after, h.before);
  History.redo.push(h);
  renderAll();
  setStatus('操作を1つ戻しました。');
}
function redo(){
  if (readOnly || !History.redo.length) return;
  const h = History.redo.pop();
  selEntry = null;
  applyDelta(h.before, h.after);
  History.undo.push(h);
  renderAll();
  setStatus('操作を1つやり直しました。');
}
function renderHistoryButtons(){
  const u = $('undoBtn'), r = $('redoBtn');
  if (u) u.disabled = readOnly || !History.undo.length;
  if (r) r.disabled = readOnly || !History.redo.length;
}

// Ctrl+Z で戻る、Ctrl+Y（または Ctrl+Shift+Z）で進む。入力欄の中ではブラウザの元に戻すを使う
document.addEventListener('keydown', ev => {
  if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
  const t = ev.target;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  const k = ev.key.toLowerCase();
  if (k === 'z' && !ev.shiftKey) { ev.preventDefault(); undo(); }
  else if (k === 'y' || (k === 'z' && ev.shiftKey)) { ev.preventDefault(); redo(); }
});
$('undoBtn').addEventListener('click', undo);
$('redoBtn').addEventListener('click', redo);
