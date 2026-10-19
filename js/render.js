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
let EVALS = [];
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
  const vis = visibleCasts(EVALS);
  renderSummary(vis); renderPalette(); renderTimeline(vis); renderTable(vis); renderEdit(); renderInsertAt(); renderControls();
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
    <div><div class="lbl">配置した軽減</div><div class="big">${plan.filter(entryLive).length}</div></div>
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
      ${STAT_KEYS.map(num).join('')}</tr>`;
  }).join('');
}

function renderPalette(){
  const rows = activeMembers().map(m => {
    const acts = MITS.filter(d => d.jobs.includes(m.job));
    return `<div class="prow"><span class="who">${jobBadge(m)}<span style="overflow:hidden;text-overflow:ellipsis">${esc(memberName(m))}</span></span>
      ${acts.map(d => `<button type="button" class="pbtn" data-add="${d.id}" data-caster="${m.id}" title="${esc(d.name)}: 物理${d.p}% 魔法${d.m}% ${d.d}秒 / リキャスト${d.r}秒" ${readOnly ? 'disabled' : ''}>${iconHtml(d, d.kind)}</button>`).join('') || '<span class="sub">配置できる軽減なし</span>'}</div>`;
  });
  rows.push(`<div class="prow"><span class="who"><span class="jb none">他</span>自由入力</span><button type="button" class="pbtn" data-add="__custom" title="%と秒を指定して軽減を作る" ${readOnly ? 'disabled' : ''}>${iconHtml({name:'自作軽減', abbr:'＋', custom:true}, 'custom')}</button></div>`);
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
  for (const m of activeMembers()) {
    html += `<div class="lab member">${jobBadge(m)}<span class="lname">${esc(memberName(m))}</span></div><div class="lane member" style="width:${W}px"></div>`;
    const mine = plan.filter(e => !e.custom && e.caster === m.id);
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
  const customs = plan.filter(e => e.custom);
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
      <td class="c-name"><span class="aname">${esc(c.name)}</span>${est}<div class="sub">${c.nHits}ヒット${c.nExcl ? ` / バリア除外 ${c.nExcl}` : ''}</div></td>
      <td class="c-type"><select class="type-sel ${ev.type}" data-type="${esc(c.abilityId)}" aria-label="ダメージ種別" ${readOnly ? 'disabled' : ''}>${Object.entries(TYPE_LABEL).map(([k, v]) => `<option value="${k}"${k === ev.type ? ' selected' : ''}>${v}</option>`).join('')}</select></td>
      <td class="num c-n">${ev.targets}</td>
      <td class="num c-raw" data-label="元ダメ"><input type="number" class="ovr${ev.ovr ? ' set' : ''}" min="0" step="1000" data-ovr="${esc(ev.key)}" value="${ev.ovr || ''}" placeholder="${ev.logMax ? Math.round(ev.logMax) : '—'}" aria-label="${esc(c.name)} の元ダメージ" ${readOnly ? 'disabled' : ''}>${ev.ovr ? '<div class="manual">手入力</div>' : ''}</td>
      <td class="c-mits"><div class="mits">${mits}</div></td>
      <td class="num c-dmg" data-label="予測被ダメ">${ev.status === 'none' ? '—' : fmt(ev.maxDmg)}</td>
      <td class="num c-left" data-label="最小残りHP">${w ?(w.left <= 0 ? '<span style="color:var(--bad)">0</span>' : fmt(w.left) + `<div class="sub">${esc(memberName(w.m))} ${w.leftPct.toFixed(0)}%</div>`) : '—'}</td>
      <td class="c-pill">${pill}</td></tr>`;
    if (openRows.has(c.id)) {
      out += `<tr class="detail"><td colspan="9"><div class="tbl-wrap"><table class="ptable"><thead><tr><th>メンバー</th><th class="num">最大HP</th><th class="num">元ダメ</th><th class="num">軽減</th><th class="num">予測被ダメ</th><th class="num">残りHP</th><th class="num">ログ上の実ダメ</th></tr></thead><tbody>` +
        ev.rows.map(r => `<tr><td><div class="row" style="gap:6px;align-items:center;flex-wrap:nowrap">${jobBadge(r.m)}${esc(memberName(r.m))} <span class="sub">${r.nHits > 1 ? '×' + r.nHits : ''}</span>${r.estimated ? ' <span class="est">推定</span>' : ''}${ev.ovr ? ' <span class="manual">手入力</span>' : ''}</div></td>
          <td class="num">${fmt(r.hp)}</td>
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
  box.innerHTML = `<span class="name">${iconHtml(d, k)}${esc(d.name)} <span class="sub">${caster ? esc(memberName(caster)) + ' / ' : ''}物理${d.p}% / 魔法${d.m}% / ${d.d}秒${d.r ? ' / リキャスト' + d.r + '秒' : ''}</span></span>
    <label class="f" for="edT">開始時刻<input type="text" id="edT" value="${fmtT(e.t)}" style="width:90px"></label>
    <label class="f" for="edTarget">対象<select id="edTarget" ${k === 'party' || k === 'self' ? 'disabled' : ''}>${targetOpts}</select></label>
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
}
