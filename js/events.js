'use strict';
// ボタンや入力などの操作

// ===== 操作 =====
function addEntry(mitId, casterId){
  if (readOnly) return;
  if (!fight) { setStatus('先にログを読み込むか、新しいTLを作ってください。', 'err'); return; }
  const t = insertTime();
  let target = 'all', custom, caster = null;
  if (mitId === '__custom') { custom = {name:'自作軽減', p:10, m:10, d:15}; mitId = 'custom'; }
  else {
    const d = MIT[mitId];
    caster = casterId;
    if (d.kind === 'self') target = caster;
    else if (d.kind === 'single') {
      // タンク向けの攻撃を選んでいれば、それを受けたタンク（自分以外を優先）を対象にする
      const c = selCast != null ? fight.casts[selCast] : null;
      const hitIds = c ? new Set(c.targets.map(x => x.pid)) : new Set();
      const tanks = activeMembers().filter(m => roleOf(m) === 'tank');
      const hit = tanks.filter(m => hitIds.has(m.pid));
      const pick = hit.find(m => m.id !== caster) || hit[0] || tanks.find(m => m.id !== caster) || tanks[0] || memberById(caster);
      target = pick ? pick.id : caster;
    }
  }
  const e = {uid:uid(), mitId, t, target, caster};
  if (custom) e.custom = custom;
  selEntry = e.uid;
  ops().add(e);
}

document.addEventListener('click', ev => {
  const t = ev.target;
  const add = t.closest('[data-add]'); if (add) return addEntry(add.dataset.add, add.dataset.caster || null);
  const cast = t.closest('[data-cast]');
  if (cast) { selCast = +cast.dataset.cast; announceSelection(); renderAll(); const row = document.querySelector(`[data-row="${selCast}"]`); if (row) row.scrollIntoView({block:'nearest'}); return; }
  const row = t.closest('[data-row]');
  if (row && !t.closest('select, input, button')) { const id = +row.dataset.row; if (selCast === id) { openRows.has(id) ? openRows.delete(id) : openRows.add(id); } selCast = id; announceSelection(); renderAll(); return; }
  if (t.id === 'edDel') { const id = selEntry; selEntry = null; return ops().remove(id); }
  if (t.id === 'edClose') { selEntry = null; return renderAll(); }
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (readOnly) return;
  if (t.dataset.type) return ops().setType(t.dataset.type, t.value);
  if (t.dataset.ovr) {
    const v = Math.round(+t.value);
    t.blur();
    return ops().setOverride(t.dataset.ovr, v > 0 && v < 1e8 ? v : null);
  }
  // メンバーの編集
  const mid = t.dataset.mjob || t.dataset.mname || t.dataset.mpid || t.dataset.mfood || t.dataset.mrace || t.dataset.mid;
  if (mid) {
    const m = memberById(mid); if (!m) return;
    if (t.dataset.mjob) { if (!JOB_DATA[t.value]) return; m.job = t.value; }
    else if (t.dataset.mname) m.name = t.value.trim().slice(0, 20);
    else if (t.dataset.mpid) m.pid = Number.isInteger(+t.value) ? +t.value : -1;
    else if (t.dataset.mfood) m.food = t.value === 'none' || FOOD[t.value] ? t.value : '';
    else if (t.dataset.mrace) m.race = CLAN[t.value] ? t.value : '';
    else if (t.dataset.mstat) m[t.dataset.mstat] = clampNum(t.value, 0, 9999999, 0);
    t.blur();
    return ops().setMember(m);
  }
  if (t.id === 'partySize') { const n = clampNum(t.value, 1, 8, 8); t.blur(); return ops().setPartySize(Math.round(n)); }
  const e = plan.find(x => x.uid === selEntry);
  if (e && t.dataset.eovr) {
    // 回復量・HoT・バリア量の手入力（空にすると計算値に戻る）
    const v = Math.round(+t.value);
    const ovr = {...(e.ovr || {})};
    if (v > 0 && v < 1e7) ovr[t.dataset.eovr] = v; else delete ovr[t.dataset.eovr];
    if (Object.keys(ovr).length) e.ovr = ovr; else delete e.ovr;
    t.blur(); return ops().update(e);
  }
  if (e) {
    if (t.id === 'edT') { const v = parseT(t.value); if (v != null) { e.t = Math.max(0, v); t.blur(); ops().update(e); } return; }
    if (t.id === 'edTarget') { e.target = t.value === 'all' ? 'all' : t.value; t.blur(); return ops().update(e); }
    if (e.custom && ['edP', 'edM', 'edD', 'edN'].includes(t.id)) {
      const key = {edP:'p', edM:'m', edD:'d', edN:'name'}[t.id];
      e.custom = {...e.custom, [key]:key === 'name' ? (t.value || '自作軽減') : Math.max(key === 'd' ? 1 : 0, Math.min(key === 'd' ? 600 : 100, +t.value || 0))};
      t.blur(); return ops().update(e);
    }
  }
});
$('trait').addEventListener('change', e => { settings.trait = e.target.checked; saveSettings(); renderAll(); });
$('ten').addEventListener('change', e => { settings.ten = e.target.checked; saveSettings(); renderAll(); });
// パーティボーナス（+5%）：装備プリセットの STR・DEX・VIT・INT・MND に掛けるか
$('partyBonus').addEventListener('change', e => { settings.partyBonus = e.target.checked; saveSettings(); renderAll(); });
// ログを読み込むときの軽減（今のプランの軽減 / ログで実際に使われた軽減）
$('mitSource').addEventListener('change', e => { settings.mitSource = e.target.value === 'log' ? 'log' : 'plan'; saveSettings(); });
$('hpSim').addEventListener('change', e => { settings.hpSim = e.target.checked; saveSettings(); renderAll(); });
$('critExp').addEventListener('change', e => { settings.critExp = e.target.checked; saveSettings(); renderAll(); });
// タブ（軽減 / ヒール・バリア）の切り替え
for (const b of document.querySelectorAll('.tab')) b.addEventListener('click', () => { settings.tab = b.dataset.tab; selEntry = null; saveSettings(); renderAll(); });
$('zoom').addEventListener('change', e => { settings.zoom = +e.target.value; saveSettings(); renderAll(); });
$('minDmg').addEventListener('input', e => { settings.minDmg = +e.target.value || 0; saveSettings(); renderAll(); });
$('scope').addEventListener('change', e => { settings.scope = e.target.value; saveSettings(); renderAll(); });
function saveSettings(){ store.set('fflp-settings', settings); }

// ドラッグで軽減バーを移動（動かさずに離したらクリック＝選択）
$('tl').addEventListener('pointerdown', ev => {
  const bar = ev.target.closest('[data-entry]'); if (!bar) return;
  const e = plan.find(x => x.uid === bar.dataset.entry); if (!e) return;
  if (readOnly) { selEntry = null; return; }
  drag = {e, bar, rec:bar.previousElementSibling && bar.previousElementSibling.classList.contains('rbar') ? bar.previousElementSibling : null, x0:ev.clientX, t0:e.t, moved:false};
  bar.setPointerCapture(ev.pointerId); bar.style.cursor = 'grabbing';
});
$('tl').addEventListener('pointermove', ev => {
  if (!drag) return;
  const dx = ev.clientX - drag.x0;
  if (Math.abs(dx) > 3) drag.moved = true;
  if (!drag.moved) return;
  drag.e.t = Math.max(0, Math.round((drag.t0 + dx / settings.zoom) * 2) / 2);
  drag.bar.style.left = (drag.e.t - viewStart()) * settings.zoom + 'px';
  if (drag.rec) drag.rec.style.left = (drag.e.t - viewStart()) * settings.zoom + 'px';
});
function endDrag(){
  if (!drag) return;
  const {e, moved, t0} = drag; drag = null;
  selEntry = e.uid;
  // 共有中は、ドラッグ中に他の人の更新で消えた軽減でないか確かめてから保存する
  const live = plan.find(x => x.uid === e.uid);
  if (moved && live) { live.t = e.t; ops().update(live); }
  else { if (!moved) e.t = t0; renderAll(); }
  if (!moved) { const el = $('edT'); if (el) el.focus(); }
}
$('tl').addEventListener('pointerup', endDrag);
$('tl').addEventListener('pointercancel', () => { if (drag) { drag.e.t = drag.t0; drag.moved = false; } endDrag(); });

// データの書き出し・読み込み（戦闘データ + メンバー + プラン + 元ダメの上書き）
$('exportBtn').addEventListener('click', async () => {
  if (!fight) return setStatus('書き出す戦闘がありません。', 'err');
  const text = JSON.stringify({app:'mitigation-planner', v:3, fight:packFight(fight), plan:plan.map(cleanEntry), members:membersObj(members), partySize, overrides});
  const filename = `軽減プラン_${fight.name.replace(/[\\/:*?"<>|]/g, '_')}.json`;
  if (mode === 'shared') {
    const dl = await window.claude.use('downloads');
    if (!dl) return setStatus('このページからはファイルを保存できません。', 'err');
    try { await dl.save({filename, data:text}); setStatus('書き出しました。', 'ok'); }
    catch (e) { if (e && e.code !== 'declined') setStatus('ファイルを保存できませんでした。', 'err'); }
    return;
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], {type:'application/json'}));
  a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
});
$('importBtn').addEventListener('click', () => { if (!readOnly) $('importFile').click(); });
$('importFile').addEventListener('change', async ev => {
  const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
  let j;
  try { j = JSON.parse(await f.text()); } catch (e) { return setStatus('ファイルを読めませんでした。このツールで書き出したJSONを選んでください。', 'err'); }
  try {
    if (j.fight) return ops().loadFight(unpackFight(j.fight), Array.isArray(j.plan) ? j.plan : [], {members:j.members, partySize:j.partySize, overrides:j.overrides});
    // 旧形式（プランだけのファイル）
    if (!Array.isArray(j.plan)) throw new Error();
    if (!fight) return setStatus('このファイルには戦闘データが入っていません。先に戦闘を読み込んでください。', 'err');
    if (j.abilityTypes) for (const [id, t] of Object.entries(j.abilityTypes)) if (fight.abilityTypes[id] !== t) ops().setType(id, t);
    for (const e of j.plan.filter(validEntry)) { const ne = toEntry(uid(), e); fixEntry(ne); ops().add(ne); }
    setStatus(`プラン「${j.name || f.name}」の軽減を追加しました。`, 'ok');
  } catch (e) { setStatus('ファイルの中身を読み取れませんでした。このツールで書き出したJSONを選んでください。', 'err'); }
});
let clearArmed = false;
$('clearPlan').addEventListener('click', ev => {
  if (!plan.length || readOnly) return;
  if (!clearArmed) { clearArmed = true; ev.target.textContent = 'もう一度押すと消去'; setTimeout(() => { clearArmed = false; ev.target.textContent = '全消去'; }, 3000); return; }
  clearArmed = false; ev.target.textContent = '全消去'; selEntry = null; ops().clear();
});
$('sharedFight').addEventListener('change', e => {
  const k = e.target.value; if (!k || readOnly || k === Shared.key) return;
  Shared.db.doc('state/current').set({key:k, at:Date.now(), by:Shared.myId || null}).catch(writeError);
});

// 読み込み（FF Logs）
$('load').addEventListener('click', loadReport);
$('url').addEventListener('keydown', e => { if (e.key === 'Enter') loadReport(); });
$('fight').addEventListener('change', async () => { $('load').disabled = true; try { await loadFight(+$('fight').value); } catch (e) { setStatus(e.message, 'err'); } finally { $('load').disabled = false; } });
const saveCred = () => { if ($('remember').checked) store.set('fflp-cred', {id:$('cid').value.trim(), sec:$('csec').value.trim()}); else store.del('fflp-cred'); };
['cid', 'csec'].forEach(id => $(id).addEventListener('change', saveCred));
$('remember').addEventListener('change', saveCred);

// ジョブで絞り込み：押したジョブを選ぶ／外す。「すべて」で解除
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-jobf]'); if (!b) return;
  const j = b.dataset.jobf;
  const cur = new Set(jobFilterSet());
  if (!j) cur.clear(); else if (cur.has(j)) cur.delete(j); else cur.add(j);
  settings.jobFilter = [...cur];
  saveSettings(); renderAll();
});

// 各セクションの折り畳み（見出しの右のボタン。開閉はこのブラウザに覚えておく）
function initFolds(){
  const saved = store.get('fflp-fold') || {};
  for (const sec of document.querySelectorAll('section.fold')) {
    const key = sec.dataset.fold, head = sec.querySelector('.fold-head'), body = sec.querySelector('.fold-body');
    if (!head || !body) continue;
    body.id = body.id || 'fold-' + key;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'fold-btn'; btn.setAttribute('aria-controls', body.id);
    const set = open => { sec.classList.toggle('collapsed', !open); btn.setAttribute('aria-expanded', String(open)); btn.textContent = open ? '畳む' : '開く'; btn.title = open ? 'このセクションを畳む' : 'このセクションを開く'; };
    set(saved[key] !== false);
    btn.addEventListener('click', () => { const open = sec.classList.contains('collapsed'); set(open); const s = store.get('fflp-fold') || {}; s[key] = open; store.set('fflp-fold', s); });
    head.appendChild(btn);
  }
}
initFolds();
