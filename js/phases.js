'use strict';
// フェーズ：TL を開始時刻で区切って、フェーズごとに表示する。
// 計算（軽減の効果時間・リキャスト・HP の推移）は TL 全体で続けて行うので、前のフェーズで使ったスキルはそのまま引き継がれる。

// 戦闘データに入れておくフェーズの形をそろえる（{id, name, start(秒)} を開始時刻の順に）
function cleanPhases(list, durationMs){
  if (!Array.isArray(list)) return [];
  const dur = (durationMs || 0) / 1000;
  return list.map(p => ({id:String(p && p.id || uid()).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16) || uid(),
      name:String(p && p.name || '').slice(0, 20), start:clampNum(p && p.start, 0, dur || 3600, NaN)}))
    .filter(p => isFinite(p.start))
    .sort((a, b) => a.start - b.start);
}
// 表示中のフェーズと、その範囲（秒）。「全体」のときは TL 全体
function currentPhase(){
  const ps = (fight && fight.phases) || [];
  return ps.find(p => p.id === settings.phase) || null;
}
function phaseEnd(p){
  const ps = fight.phases, i = ps.indexOf(p);
  return i >= 0 && i < ps.length - 1 ? ps[i + 1].start : fight.duration / 1000;
}
function viewRange(){
  const p = fight && currentPhase();
  return p ? [p.start, phaseEnd(p)] : [0, fight ? fight.duration / 1000 : 0];
}
const viewStart = () => viewRange()[0];
const phaseLabel = (p, i) => p.name || `P${i + 1}`;

// フェーズの切り替えボタン
function renderPhaseBar(){
  const box = $('phaseBar');
  const ps = (fight && fight.phases) || [];
  if (!ps.length) { box.innerHTML = ''; return; }
  const cur = currentPhase();
  box.innerHTML = `<span class="sub">フェーズ</span><button type="button" class="ph${cur ? '' : ' on'}" data-phase="" aria-pressed="${!cur}">全体</button>` +
    ps.map((p, i) => `<button type="button" class="ph${cur === p ? ' on' : ''}" data-phase="${esc(p.id)}" aria-pressed="${cur === p}">${esc(phaseLabel(p, i))}<span class="sub">${fmtT(p.start).replace(/\.0$/, '')}〜${fmtT(phaseEnd(p)).replace(/\.0$/, '')}</span></button>`).join('');
}
// フェーズの編集欄（名前・開始時刻・削除）
function renderPhaseList(){
  const box = $('phaseList');
  if (box.contains(document.activeElement)) return;
  const ps = (fight && fight.phases) || [];
  box.innerHTML = ps.length ? ps.map((p, i) => `<div class="ph-row">
      <input type="text" class="ph-name" data-phname="${esc(p.id)}" maxlength="20" value="${esc(p.name)}" placeholder="P${i + 1}" aria-label="フェーズ${i + 1}の名前" ${readOnly ? 'disabled' : ''}>
      <input type="text" class="ph-start" data-phstart="${esc(p.id)}" value="${fmtT(p.start)}" aria-label="フェーズ${i + 1}の開始時刻" ${readOnly ? 'disabled' : ''}>
      <span class="sub">〜 ${fmtT(phaseEnd(p))}</span>
      <button type="button" class="btn danger small" data-phdel="${esc(p.id)}" ${readOnly ? 'disabled' : ''}>削除</button></div>`).join('')
    : '<p class="sub" style="margin:8px 0 0">まだフェーズはありません。下で開始時刻を入れて追加してください。</p>';
  $('phAdd').disabled = readOnly;
}

// フェーズの変更は戦闘データの書き換えとして保存・共有する（プラン・メンバーはそのまま）
function savePhases(list){
  const f = finishFight({...fight, phases:cleanPhases(list, fight.duration)});
  ops().updateFight(f);
}
$('phAdd').addEventListener('click', () => {
  if (readOnly || !fight) return;
  const typed = $('phStart').value.trim();
  const start = typed ? parseT(typed) : (selCast != null ? Math.round(fight.casts[selCast].t / 100) / 10 : null);
  if (start == null || start < 0 || start * 1000 > fight.duration) return setStatus('開始時刻は「2:30.0」のように分:秒で入れるか、タイムラインで攻撃を選んでから追加してください。', 'err');
  const ps = fight.phases || [];
  if (ps.some(p => Math.abs(p.start - start) < 0.05)) return setStatus('同じ開始時刻のフェーズがすでにあります。', 'err');
  const name = $('phName').value.trim().slice(0, 20);
  // 最初の区切りを入れたときは、0:00 からの最初のフェーズも作る（区切りの前も1つのフェーズとして選べるように）
  const head = !ps.some(p => p.start === 0) && start > 0 ? [{id:uid(), name:'', start:0}] : [];
  savePhases([...head, ...ps, {id:uid(), name, start}]);
  $('phName').value = ''; $('phStart').value = '';
  setStatus(`${fmtT(start)} からのフェーズを追加しました。`, 'ok');
});
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-phase]');
  if (b) { settings.phase = b.dataset.phase || ''; selEntry = null; saveSettings(); return renderAll(); }
  const del = ev.target.closest('[data-phdel]');
  if (del && !readOnly && fight) {
    const id = del.dataset.phdel;
    if (settings.phase === id) settings.phase = '';
    savePhases((fight.phases || []).filter(p => p.id !== id));
  }
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (!fight || readOnly || !(t.dataset.phname || t.dataset.phstart)) return;
  const ps = (fight.phases || []).map(p => ({...p}));
  const p = ps.find(x => x.id === (t.dataset.phname || t.dataset.phstart)); if (!p) return;
  if (t.dataset.phname) p.name = t.value.trim().slice(0, 20);
  else { const v = parseT(t.value); if (v == null || v < 0 || v * 1000 > fight.duration) { setStatus('開始時刻は分:秒で、戦闘の長さの中で入れてください。', 'err'); return renderAll(); } p.start = v; }
  t.blur();
  savePhases(ps);
});
