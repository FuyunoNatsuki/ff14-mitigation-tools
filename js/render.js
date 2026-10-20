'use strict';
// 画面の描画（メンバー表・タイムライン・予測表・編集欄）

// ===== アイコン =====
function iconHtml(def, kind, cls = ''){
  const url = !def.custom && ACTION_ICONS[def.id];
  const label = def.abbr || String(def.name || '').slice(0, 2);
  return `<span class="ico ${kind} ${cls}" title="${esc(def.name)}">${url ? `<img src="${esc(url)}" alt="">` : esc(label)}</span>`;
}
const jobBadge = m => { const j = jobOf(m); return `<span class="jb ${j ? j.role : 'none'}" title="${esc(j ? j.ja : '')}">${esc(j ? j.abbr : '?')}</span>`; };

// ===== 描画 =====
let EVALS = [], SIM = null;
let drag = null, renderPending = false;
function renderAll(){
  // ドラッグ中に他の人の更新が届いたら、離すまで描き直さない
  if (drag) { renderPending = true; return; }
  renderPending = false;
  document.body.classList.toggle('ro', readOnly);
  renderMembers();
  if (!fight) return renderEmpty();
  plan.forEach(fixEntry);
  EVALS = fight.casts.map(evalCast);
  SIM = simulateHp(EVALS);
  if (settings.hpSim) applyHpSim(EVALS, SIM);
  const vis = visibleCasts(EVALS);
  renderSummary(vis); renderJobFilter(); renderPalette(); renderTimeline(vis); renderTable(vis); renderEdit(); renderInsertAt(); renderControls(); renderAddCast();
  if (mode === 'local') saveLocal();
}
function renderEmpty(){
  $('summary').innerHTML = mode === 'shared'
    ? '<span class="sub">共有中の戦闘はまだありません。書き出したデータを「データを読み込む」で取り込むか、「サンプルで試す」で始めてください。</span>'
    : mode === 'room'
    ? '<span class="sub">このルームにはまだ戦闘データがありません。FF Logs のログを読み込むか、「データを読み込む」「サンプルで試す」で始めると、ルームの全員に共有されます。</span>'
    : '<span class="sub">ログを読み込むか「サンプルで試す」を押すと、ここに戦闘の概要が出ます。</span>';
  $('tl').innerHTML = ''; $('palette').innerHTML = ''; $('editBox').hidden = true; $('insertAt').textContent = '';
  $('tbody').innerHTML = '<tr><td colspan="9" class="empty">まだ戦闘データがありません。</td></tr>';
  renderControls();
}
function renderSummary(vis){
  const bad = vis.filter(v => v.status === 'bad').length, warn = vis.filter(v => v.status === 'warn').length;
  const tanks = activeMembers().filter(m => roleOf(m) === 'tank').map(m => esc(memberName(m))).join('・') || '—';
  $('summary').innerHTML = `
    <div><div class="lbl">戦闘</div><div class="fight">${esc(fight.name)}${fight.sample ? '<span class="sample-badge">サンプル</span>' : ''}</div><div class="sub">${fmtT(fight.duration / 1000)} / ${partySize}人 / タンク: ${tanks}</div></div>
    <div><div class="lbl">表示中の攻撃</div><div class="big">${vis.length}</div></div>
    <div><div class="lbl">戦闘不能あり</div><div class="big" style="color:${bad ? 'var(--bad)' : 'var(--ok)'}">${bad}</div></div>
    <div><div class="lbl">残り15%未満</div><div class="big" style="color:${warn ? 'var(--warn)' : 'var(--fg)'}">${warn}</div></div>
    <div><div class="lbl">配置したスキル</div><div class="big">${plan.filter(entryLive).length}</div></div>
    <div><div class="lbl">バリアで除外したヒット</div><div class="big">${fight.excluded}</div></div>`;
}

// メンバー表（入力中は描き直さない）
function renderMembers(){
  const sel = $('partySize');
  if (sel.options.length !== 8) sel.innerHTML = [1,2,3,4,5,6,7,8].map(n => `<option value="${n}">${n}人</option>`).join('');
  if (document.activeElement !== sel) sel.value = String(partySize);
  sel.disabled = readOnly;
  const body = $('mbody');
  if (body.contains(document.activeElement)) return;
  const players = fight ? fight.players : [];
  body.innerHTML = members.map((m, i) => {
    const j = jobOf(m) || {};
    const ph = k => k === 'hp' ? defaultHp(m) : (j[k] || '');
    const num = k => `<td class="num c-stat" data-label="${STAT_LABEL[k]}"><input type="number" min="0" step="${k === 'hp' ? 1000 : 1}" data-mstat="${k}" data-mid="${m.id}" value="${m[k] > 0 ? m[k] : ''}" placeholder="${esc(ph(k))}" aria-label="${esc(memberName(m))} ${k}" ${readOnly ? 'disabled' : ''}${k === 'hp' ? ' style="width:100px"' : ''}></td>`;
    return `<tr class="${i < partySize ? '' : 'inactive'}">
      <td class="slot c-slot">${i + 1}</td>
      <td class="c-job"><div class="row" style="gap:6px;align-items:center;flex-wrap:nowrap">${jobBadge(m)}<select data-mjob="${m.id}" aria-label="${i + 1}人目のジョブ" ${readOnly ? 'disabled' : ''}>${JOB_ORDER.map(k => `<option value="${k}"${k === m.job ? ' selected' : ''}>${esc(JOB_DATA[k].ja)}</option>`).join('')}</select></div></td>
      <td class="c-name" data-label="名前"><input type="text" class="nm" maxlength="20" data-mname="${m.id}" value="${esc(m.name)}" placeholder="${esc((logPlayer(m) || {}).name || j.ja || '')}" aria-label="${i + 1}人目の名前" ${readOnly ? 'disabled' : ''}></td>
      <td class="c-pid" data-label="ログのプレイヤー"><select data-mpid="${m.id}" aria-label="${i + 1}人目に対応するログのプレイヤー" ${readOnly ? 'disabled' : ''}><option value="-1">なし（全体攻撃のみ）</option>${players.map(p => `<option value="${p.id}"${p.id === m.pid ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></td>
      <td class="c-food" data-label="食事">${foodSelect(m, i)}</td>
      ${STAT_KEYS.map(num).join('')}</tr>`;
  }).join('');
}

function renderPalette(){
  const fs = jobFilterSet();
  const rows = activeMembers().filter(m => passesJobFilter(m, fs)).map(m => {
    const acts = ACTIONS.filter(d => d.tab === settings.tab && d.jobs.includes(m.job));
    return `<div class="prow"><span class="who">${jobBadge(m)}<span style="overflow:hidden;text-overflow:ellipsis">${esc(memberName(m))}</span></span>
      ${acts.map(d => `<button type="button" class="pbtn" data-add="${d.id}" data-caster="${m.id}" title="${esc(actionTip(d))}" ${readOnly ? 'disabled' : ''}>${iconHtml(d, d.kind)}</button>`).join('') || '<span class="sub">配置できるスキルなし</span>'}</div>`;
  });
  if (settings.tab === 'mit') rows.push(`<div class="prow"><span class="who"><span class="jb none">他</span>自由入力</span><button type="button" class="pbtn" data-add="__custom" title="%と秒を指定して軽減を作る" ${readOnly ? 'disabled' : ''}>${iconHtml({name:'自作軽減', abbr:'＋', custom:true}, 'custom')}</button></div>`);
  $('palette').innerHTML = rows.join('');
}

function clashSet(){
  // 同じ人が同じ軽減をリキャスト内に置いたもの（チャージ数を超えたもの）
  const s = new Set(), groups = {};
  for (const e of plan) { if (e.custom || !entryLive(e)) continue; (groups[e.caster + '|' + e.mitId] ||= []).push(e); }
  for (const list of Object.values(groups)) {
    list.sort((a, b) => a.t - b.t);
    const def = MIT[list[0].mitId], ch = def.charges || 1;
    for (let i = ch; i < list.length; i++) if (list[i].t - list[i - ch].t < def.r) s.add(list[i].uid);
  }
  return s;
}

function renderTimeline(vis){
  const pps = settings.zoom;
  const durS = fight.duration / 1000;
  const W = Math.ceil((durS + 10) * pps);
  const clash = clashSet();
  const visSet = new Set(vis.map(v => v.c.id));
  const others = peerSelections();
  const slotIndex = id => SLOT_IDS.indexOf(id);
  let ticks = '';
  const step = pps >= 12 ? 10 : pps >= 6 ? 15 : 30;
  for (let s = 0; s <= durS + 10; s += step) ticks += `<div class="tick-s" style="left:${s * pps}px">${fmtT(s).replace(/\.0$/, '')}</div>`;
  let html = `<div class="lab head">時刻</div><div class="lane head" style="width:${W}px">${ticks}</div>`;
  html += `<div class="lab casts">攻撃</div><div class="lane casts" style="width:${W}px">` +
    EVALS.filter(ev => visSet.has(ev.c.id)).map(ev => {
      const dots = (others.get(ev.c.id) || []).slice(0, 1).map(col => `<span class="pdot" style="background:${esc(col)}"></span>`).join('');
      return `<button type="button" class="cast ${ev.status}${selCast === ev.c.id ? ' sel' : ''}" data-cast="${ev.c.id}" style="left:${ev.c.t / 1000 * pps}px"
      title="${fmtT(ev.c.t / 1000)} ${esc(ev.c.name)}（${TYPE_LABEL[ev.type]}）\n元ダメ最大 ${fmt(ev.maxRaw)} → 予測 ${fmt(ev.maxDmg)}" aria-label="${fmtT(ev.c.t / 1000)} ${esc(ev.c.name)}">${dots}</button>`; }).join('') + '</div>';

  const barHtml = (e, d, k) => {
    const who = e.by && profileCache[e.by] && profileCache[e.by].name ? `\n配置: ${profileCache[e.by].name}` : '';
    const rec = d.r ? `<div class="rbar ${k}" style="left:${e.t * pps}px;width:${d.r * pps}px"></div>` : '';
    return rec + `<button type="button" class="mbar ${k}${selEntry === e.uid ? ' sel' : ''}${clash.has(e.uid) ? ' clash' : ''}" data-entry="${esc(e.uid)}" style="left:${e.t * pps}px;width:${Math.max(d.d * pps, 22)}px" title="${esc(d.name)} ${fmtT(e.t)}〜${fmtT(e.t + d.d)}${d.r ? ' / リキャスト' + d.r + '秒' : ''}${clash.has(e.uid) ? '（リキャスト中）' : ''}${esc(who)}">${iconHtml(d, k)}<span class="bname">${esc(d.name)}</span></button>`;
  };
  // メンバーごとに、ジョブの軽減の並び順で行を固定する（時刻で並び替えない）
  const fs = jobFilterSet();
  for (const m of activeMembers().filter(m => passesJobFilter(m, fs))) {
    html += `<div class="lab member">${jobBadge(m)}<span class="lname">${esc(memberName(m))}</span>${hpLowLabel(m)}</div><div class="lane member" style="width:${W}px">${hpSvg(m, W, pps)}</div>`;
    const mine = plan.filter(e => !e.custom && e.caster === m.id && MIT[e.mitId].tab === settings.tab);
    const rows = new Map();
    for (const e of mine) { const rk = e.mitId + '|' + (MIT[e.mitId].kind === 'single' ? e.target : ''); (rows.get(rk) || rows.set(rk, []).get(rk)).push(e); }
    const ordered = [...rows.entries()].sort((a, b) => {
      const [ma, ta] = a[0].split('|'), [mb, tb] = b[0].split('|');
      return (MIT[ma].order - MIT[mb].order) || (slotIndex(ta) - slotIndex(tb));
    });
    for (const [rk, list] of ordered) {
      const d = MIT[list[0].mitId];
      const tgt = d.kind === 'single' ? memberById(list[0].target) : null;
      html += `<div class="lab act" title="${esc(d.name)}${tgt ? ' → ' + esc(memberName(tgt)) : ''}">${iconHtml(d, d.kind, 'sm')}<span class="lname">${esc(d.name)}</span>${tgt ? `<span class="sub">→ ${esc(memberName(tgt))}</span>` : ''}</div><div class="lane" style="width:${W}px">` +
        list.map(e => barHtml(e, d, d.kind)).join('') + '</div>';
    }
  }
  const customs = settings.tab === 'mit' ? plan.filter(e => e.custom) : [];
  if (customs.length) {
    html += `<div class="lab member"><span class="jb none">他</span>自由入力</div><div class="lane member" style="width:${W}px"></div>`;
    const rows = new Map();
    for (const e of customs) { const rk = e.custom.name + '|' + e.target; (rows.get(rk) || rows.set(rk, []).get(rk)).push(e); }
    for (const [, list] of [...rows.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const tgt = list[0].target === 'all' ? null : memberById(list[0].target);
      html += `<div class="lab act">${iconHtml(list[0].custom, 'custom', 'sm')}<span class="lname">${esc(list[0].custom.name)}</span><span class="sub">${tgt ? '→ ' + esc(memberName(tgt)) : ''}</span></div><div class="lane" style="width:${W}px">` +
        list.map(e => barHtml(e, {...e.custom, r:0}, 'custom')).join('') + '</div>';
    }
  }
  const sc = selCast != null ? fight.casts[selCast] : null;
  if (sc) html += `<div class="guide" style="left:calc(var(--lab-w) + ${sc.t / 1000 * pps}px)"></div>`;
  $('tl').innerHTML = html;
}

function renderTable(vis){
  if (!vis.length) { $('tbody').innerHTML = '<tr><td colspan="9" class="empty">条件に合う攻撃がありません。下限や対象の絞り込みを変えてください。</td></tr>'; return; }
  const tb = $('tbody');
  // 元ダメの欄を入力中なら、その行が消えないように描き直しを控える
  if (tb.contains(document.activeElement) && document.activeElement.matches('input.ovr')) return;
  tb.innerHTML = vis.map(ev => {
    const c = ev.c, w = ev.worst;
    const pill = ev.status === 'none' ? '<span class="pill none">サンプルなし</span>'
      : ev.status === 'bad' ? `<span class="pill bad">戦闘不能 ${ev.rows.filter(r => r.left != null && r.left <= 0).length}人</span>`
      : ev.status === 'warn' ? '<span class="pill warn">ギリギリ</span>' : '<span class="pill ok">生存</span>';
    const mits = ev.shown.map(e => { const d = defOf(e); const r = rateOf(d, ev.type);
      const caster = memberById(e.caster), tgt = e.target === 'all' ? null : memberById(e.target);
      const tip = `${d.name} ${r}%${caster ? '（' + memberName(caster) + '）' : ''}${tgt && d.kind === 'single' ? ' → ' + memberName(tgt) : ''}`;
      return iconHtml({...d, name:tip}, kindOf(e), 'sm' + (r ? '' : ' off')); }).join('') || '<span class="sub">なし</span>';
    const est = ev.rows.some(r => r.estimated) ? ' <span class="est">推定</span>' : '';
    let out = `<tr class="cast-row${selCast === c.id ? ' sel' : ''}" data-row="${c.id}">
      <td class="time c-time">${fmtT(c.t / 1000)}</td>
      <td class="c-name"><span class="aname">${esc(c.name)}</span>${est}${c.manual ? ` <span class="manual">手入力</span> <button type="button" class="btn danger small" data-delcast="${c.id}" ${readOnly ? 'disabled' : ''}>削除</button>` : ''}<div class="sub">${c.nHits}ヒット${c.nExcl ? ` / バリア除外 ${c.nExcl}` : ''}</div></td>
      <td class="c-type"><select class="type-sel ${ev.type}" data-type="${esc(c.abilityId)}" aria-label="ダメージ種別" ${readOnly ? 'disabled' : ''}>${Object.entries(TYPE_LABEL).map(([k, v]) => `<option value="${k}"${k === ev.type ? ' selected' : ''}>${v}</option>`).join('')}</select></td>
      <td class="num c-n">${ev.targets}</td>
      <td class="num c-raw" data-label="元ダメ"><input type="number" class="ovr${ev.ovr ? ' set' : ''}" min="0" step="1000" data-ovr="${esc(ev.key)}" value="${ev.ovr || ''}" placeholder="${ev.logMax ? Math.round(ev.logMax) : '—'}" aria-label="${esc(c.name)} の元ダメージ" ${readOnly ? 'disabled' : ''}>${ev.ovr ? '<div class="manual">手入力</div>' : ''}</td>
      <td class="c-mits"><div class="mits">${mits}</div></td>
      <td class="num c-dmg" data-label="予測被ダメ">${ev.status === 'none' ? '—' : fmt(ev.maxDmg)}</td>
      <td class="num c-left" data-label="最小残りHP">${w ?(w.left <= 0 ? '<span style="color:var(--bad)">0</span>' : fmt(w.left) + `<div class="sub">${esc(memberName(w.m))} ${w.leftPct.toFixed(0)}%</div>`) : '—'}</td>
      <td class="c-pill">${pill}</td></tr>`;
    if (openRows.has(c.id)) {
      out += `<tr class="detail"><td colspan="9"><div class="tbl-wrap"><table class="ptable"><thead><tr><th>メンバー</th><th class="num">最大HP</th><th class="num">被弾前HP</th><th class="num">バリア</th><th class="num">元ダメ</th><th class="num">軽減</th><th class="num">予測被ダメ</th><th class="num">残りHP</th><th class="num">ログ上の実ダメ</th></tr></thead><tbody>` +
        ev.rows.map(r => `<tr><td><div class="row" style="gap:6px;align-items:center;flex-wrap:nowrap">${jobBadge(r.m)}${esc(memberName(r.m))} <span class="sub">${r.nHits > 1 ? '×' + r.nHits : ''}</span>${r.estimated ? ' <span class="est">推定</span>' : ''}${ev.ovr ? ' <span class="manual">手入力</span>' : ''}</div></td>
          <td class="num">${fmt(r.hp)}</td>
          <td class="num">${r.hpBefore != null ? (r.wasDead ? '<span style="color:var(--bad)">戦闘不能</span>' : fmt(r.hpBefore)) : '—'}</td>
          <td class="num">${r.shieldBefore ? fmt(r.shieldBefore) : '—'}</td>
          <td class="num">${r.raw == null ? '除外' : fmt(r.raw)}</td>
          <td class="num">${((1 - r.mul) * 100).toFixed(1)}%</td>
          <td class="num">${r.dmg == null ? '—' : fmt(r.dmg)}</td>
          <td class="num" style="color:${r.left == null ? 'inherit' : r.left <= 0 ? 'var(--bad)' : r.leftPct < 15 ? 'var(--warn)' : 'inherit'}">${r.left == null ? '—' : r.left <= 0 ? '0' : fmt(r.left)}</td>
          <td class="num sub">${r.actual == null ? '—' : fmt(r.actual)}</td></tr>`).join('') +
        `</tbody></table></div><p class="note">「ログ上の実ダメ」は実際の戦闘で受けたダメージ（バリア吸収分を含む）です。ログに対応するプレイヤーがいないメンバーは、全体攻撃のときだけ中央値で計算します。</p></td></tr>`;
    }
    return out;
  }).join('');
}

function insertTime(){ if (!fight || selCast == null) return 0; return Math.max(0, Math.round((fight.casts[selCast].t / 1000 - 8) * 10) / 10); }
function renderInsertAt(){
  if (readOnly) { $('insertAt').textContent = '閲覧のみ：軽減の配置は編集できる人だけが変更できます。'; return; }
  const t = insertTime();
  $('insertAt').innerHTML = `軽減の配置位置: <strong>${fmtT(t)}</strong>${selCast != null ? '（' + esc(fight.casts[selCast].name) + ' の8秒前）' : '（攻撃を選ぶとその8秒前に置きます）'}`;
}

function renderEdit(){
  const box = $('editBox');
  const e = plan.find(x => x.uid === selEntry);
  if (!e || !fight || readOnly) { box.hidden = true; box.innerHTML = ''; return; }
  // 入力中の欄があるときは描き直さない（他の人の更新で入力が消えないように）
  if (!box.hidden && box.dataset.uid === e.uid && box.contains(document.activeElement)) return;
  const d = defOf(e), k = kindOf(e);
  const caster = memberById(e.caster);
  const opts = list => list.map(m => `<option value="${m.id}">${esc(memberName(m))}</option>`).join('');
  const targetOpts = k === 'party' ? '<option value="all">全員</option>'
    : k === 'self' ? `<option value="${esc(e.caster)}">${esc(memberName(caster))}（自分）</option>`
    : (k === 'custom' ? '<option value="all">全員</option>' : '') + opts(activeMembers());
  box.hidden = false; box.dataset.uid = e.uid;
  box.innerHTML = `<span class="name">${iconHtml(d, k)}${esc(d.name)} <span class="sub">${caster ? esc(memberName(caster)) + ' / ' : ''}${esc(d.custom ? `物理${d.p}% / 魔法${d.m}% / ${d.d}秒` : actionTip(d).split(' / ').slice(1).join(' / '))}</span></span>
    <label class="f" for="edT">開始時刻<input type="text" id="edT" value="${fmtT(e.t)}" style="width:90px"></label>
    <label class="f" for="edTarget">対象<select id="edTarget" ${k === 'party' || k === 'self' ? 'disabled' : ''}>${targetOpts}</select></label>
    ${healOvrFields(e, d)}
    ${k === 'custom' ? `<label class="f" for="edP">物理%<input type="number" id="edP" value="${d.p}" min="0" max="100" style="width:80px"></label>
      <label class="f" for="edM">魔法%<input type="number" id="edM" value="${d.m}" min="0" max="100" style="width:80px"></label>
      <label class="f" for="edD">効果秒<input type="number" id="edD" value="${d.d}" min="1" style="width:80px"></label>
      <label class="f" for="edN">名前<input type="text" id="edN" value="${esc(d.name)}" style="width:140px"></label>` : ''}
    <button class="btn danger small" type="button" id="edDel">削除</button>
    <button class="btn ghost small" type="button" id="edClose">閉じる</button>`;
  if (k === 'single' || k === 'custom') $('edTarget').value = String(e.target);
}

function renderControls(){
  $('clearPlan').disabled = readOnly || !plan.length;
  $('importBtn').disabled = readOnly && mode === 'shared';
  $('demo').disabled = readOnly && mode === 'shared';
  $('sharedFight').disabled = readOnly;
  // タブの選択状態と、ヒール・バリアの設定欄
  for (const b of document.querySelectorAll('.tab')) b.setAttribute('aria-selected', String(b.dataset.tab === settings.tab));
  $('healOpts').hidden = settings.tab !== 'heal';
}

// ===== スキルの説明（アイコンのツールチップ）=====
function actionTip(d){
  const parts = [d.name];
  if (d.p || d.m) parts.push(d.p === d.m ? `軽減${d.p}%` : `物理${d.p}% 魔法${d.m}%`);
  if (d.heal) parts.push(`回復 威力${d.heal}`);
  if (d.hot) parts.push(`HoT 威力${d.hot.pot}×${Math.floor(d.hot.dur / 3)}回`);
  if (d.shield) parts.push(d.shield.pct ? `バリア 回復量の${Math.round(d.shield.pct * 100)}%` : d.shield.pot ? `バリア 威力${d.shield.pot}` : `バリア 最大HPの${Math.round(d.shield.hpPct * 100)}%`);
  if (d.healUp) parts.push(`回復魔法+${Math.round(d.healUp * 100)}%`);
  if (d.recv) parts.push(`被回復+${Math.round(d.recv * 100)}%`);
  if (d.recit) parts.push('次の鼓舞・意気・不撓・深謀がクリティカル確定');
  if (d.ns) parts.push(`ニュートラルセクト中は回復量の${Math.round(d.ns * 100)}%のバリア`);
  if (d.trigger) parts.push(`HPが${Math.round((d.trigger.under || 0.5) * 100)}%を下回ったら回復 威力${d.trigger.pot}（${d.trigger.dur}秒以内に下回らなければ終了時に回復）`);
  if (d.delay) parts.push(`${d.delay}秒後に発動`);
  parts.push(`${d.d}秒 / リキャスト${d.r}秒`);
  return parts.join(' / ');
}

// ===== HP の推移（メンバーの行に描く）=====
const LANE_H = 28;
function hpSvg(m, W, pps){
  const pts = SIM && SIM.series.get(m.id);
  if (!pts || !pts.length) return '';
  const max = hpOf(m);
  const y = v => (LANE_H - 2 - Math.max(0, Math.min(1, v / max)) * (LANE_H - 4)).toFixed(1);
  const x = t => (t * pps).toFixed(1);
  // 階段状の線：時刻ごとに直前の値から新しい値へ縦に移る
  let hpTop = `M0,${y(pts[0][1])}`, shTop = `M0,${y(pts[0][1] + pts[0][2])}`;
  let deadAt = null;
  for (let i = 1; i < pts.length; i++) {
    const [t, hp, sh, dead] = pts[i];
    hpTop += ` H${x(t)} V${y(hp)}`;
    shTop += ` H${x(t)} V${y(hp + sh)}`;
    if (dead && deadAt == null) deadAt = t;
  }
  hpTop += ` H${W}`; shTop += ` H${W}`;
  // バリアは HP の線の上に重ねた帯（HP の線を逆向きにたどって閉じる）
  const hpArea = `${hpTop} V${LANE_H} H0 Z`;
  const shArea = `${shTop} V${y(pts[pts.length - 1][1])} ${reverseStep(pts, x, y)} Z`;
  const dead = deadAt != null ? `<rect class="dead" x="${x(deadAt)}" y="${LANE_H - 4}" width="${Math.max(0, W - deadAt * pps)}" height="4"></rect>` : '';
  return `<svg class="hpsvg" viewBox="0 0 ${W} ${LANE_H}" preserveAspectRatio="none" aria-hidden="true"><path class="sh" d="${shArea}"></path><path class="hp" d="${hpArea}"></path>${dead}</svg>`;
}
// HP の階段線を右から左へたどる（バリアの帯の下側）
function reverseStep(pts, x, y){
  let d = '';
  for (let i = pts.length - 1; i >= 1; i--) d += ` H${x(pts[i][0])} V${y(pts[i - 1][1])}`;
  return d + ' H0';
}
// メンバー名の横に、戦闘中の最低HP（%）
function hpLowLabel(m){
  const pts = SIM && SIM.series.get(m.id);
  if (!pts || pts.length < 2) return '';
  const max = hpOf(m);
  const dead = pts.some(p => p[3]);
  const low = Math.min(...pts.map(p => p[1])) / max * 100;
  return `<span class="hpnow" style="${dead ? 'color:var(--bad)' : low < 15 ? 'color:var(--warn)' : ''}">${dead ? '戦闘不能' : '最低' + low.toFixed(0) + '%'}</span>`;
}

// ===== 回復量・HoT・バリア量の手入力欄（編集欄）=====
// 空欄のときは計算した値を薄く表示する（1人目の対象・クリティカルなしで計算）
function healOvrFields(e, d){
  if (e.custom || !d || !hasHealEffect(d)) return '';
  const caster = memberById(e.caster), tgt = targetsOf(e, d)[0];
  if (!caster || !tgt) return '';
  const ov = e.ovr || {};
  const field = (key, label, calc) => `<label class="f" for="ed_${key}">${label}<input type="number" id="ed_${key}" data-eovr="${key}" min="0" step="100" value="${ov[key] || ''}" placeholder="${calc}" style="width:120px"></label>`;
  const pot = d.heal || (d.trigger && d.trigger.pot);
  let html = '';
  if (pot) html += field('heal', '回復量（手入力）', healAmount(pot, caster, tgt, e.t, null));
  if (d.hot) html += field('hot', 'HoT 1回分（手入力）', healAmount(d.hot.pot, caster, tgt, e.t, null, true));
  if (d.shield) {
    let sh = 0;
    if (d.shield.pct) sh += Math.floor(healAmount(d.heal || 0, caster, tgt, e.t, null) * d.shield.pct);
    if (d.shield.pot) sh += healAmount(d.shield.pot, caster, tgt, e.t, null);
    if (d.shield.hpPct) sh += Math.floor((d.shield.of === 'caster' ? hpOf(caster) : hpOf(tgt)) * d.shield.hpPct);
    html += field('shield', 'バリア量（手入力）', sh);
  }
  return html;
}

// ===== ジョブで絞り込み（軽減・バリアを置いているジョブ。複数選ぶといずれか＝OR）=====
// 置いているジョブ：参加中のメンバーで、軽減・ヒール・バリアを1つ以上置いている人のジョブ
function placedJobs(){
  const act = activeMembers();
  const has = new Set(plan.filter(e => !e.custom && entryLive(e)).map(e => e.caster));
  return [...new Set(act.filter(m => has.has(m.id)).map(m => m.job))].sort((a, b) => JOB_ORDER.indexOf(a) - JOB_ORDER.indexOf(b));
}
// 実際に効いている絞り込み（選んだジョブのうち、今も置いているもの。空なら全員）
function jobFilterSet(){
  const present = new Set(placedJobs());
  return new Set((settings.jobFilter || []).filter(j => present.has(j)));
}
const passesJobFilter = (m, fs) => !fs.size || fs.has(m.job);
function renderJobFilter(){
  const box = $('jobFilter');
  const jobs = placedJobs();
  const fs = jobFilterSet();
  if (!jobs.length) { box.innerHTML = ''; return; }
  box.innerHTML = `<span class="sub">ジョブで絞り込み（複数選ぶといずれか）</span>
    <button type="button" class="jf${fs.size ? '' : ' on'}" data-jobf="" aria-pressed="${!fs.size}">すべて</button>` +
    jobs.map(j => { const d = JOB_DATA[j]; const on = fs.has(j);
      return `<button type="button" class="jf${on ? ' on' : ''}" data-jobf="${j}" aria-pressed="${on}"><span class="jb ${d.role}">${esc(d.abbr)}</span>${esc(d.ja)}</button>`; }).join('');
}

// ===== 食事の選択（メンバー表）=====
// 空：ジョブの装備プリセットの食事、none：食事なし。下に食事で上がる量を出す
function foodSelect(m, i){
  const preset = FOOD[(jobOf(m) || {}).food];
  const opts = [['', `装備の食事（${preset ? preset.name : 'なし'}）`], ['none', '食事なし'], ...FOODS.map(f => [f.id, `${f.name}（IL${f.ilvl}）`])];
  const cur = m.food || '';
  const f = foodOf(m);
  const label = {crit:'クリ', det:'意思', dh:'DH', ss:'SS', ten:'不屈', pie:'信仰', vit:'VIT'};
  const gains = f ? f.params.map(p => { const v = foodBonus(m, p.stat); return v ? `${label[p.stat]}+${v}` : ''; }).filter(Boolean) : [];
  const hp = foodHp(m), fromLog = !(m.hp > 0) && logPlayer(m) && logPlayer(m).maxHP;
  const sub = f ? gains.join(' ') + (hp ? ` / HP+${fmt(hp)}${fromLog ? '（ログのHPには足さない）' : ''}` : '') : '食事による上昇なし';
  return `<select data-mfood="${m.id}" aria-label="${i + 1}人目の食事" ${readOnly ? 'disabled' : ''}>${opts.map(([v, l]) => `<option value="${v}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
    <div class="sub food-gain">${esc(sub)}</div>`;
}
