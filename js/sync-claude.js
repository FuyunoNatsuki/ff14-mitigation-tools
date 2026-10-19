'use strict';
// claude.ai のページとして開いたときの共有（アカウントで共有）

// ----- 共有（claude.ai のページとして開いたとき）-----
const Shared = {db:null, user:null, room:null, myId:null, key:null, subs:[], meta:null, chunks:[], fights:[]};
let profileCache = {};
const keySeg = k => String(k).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120) || 'fight';

async function initShared(){
  if (!window.claude || typeof window.claude.use !== 'function') return;
  const db = await window.claude.use('db');
  if (!db) return;
  Shared.db = db;
  mode = 'shared';
  Shared.user = await window.claude.use('user');
  if (Shared.user) {
    Shared.myId = await Shared.user.id();
    const can = await Shared.user.can('data.write');
    readOnly = can === false;
  }
  $('fflogsBox').hidden = true; $('sharedBox').hidden = false;
  setModeBadge();
  fight = null; plan = []; renderAll();
  setStatus('共有データを読み込んでいます…');
  db.doc('state/current').onSnapshot(s => {
    const k = s.exists ? (s.data() || {}).key : null;
    if (k !== Shared.key) switchKey(k || null);
    if (!k) setStatus('');
  }, dbError);
  db.collection('fights').onSnapshot(s => {
    Shared.fights = s.docs.map(d => ({key:d.id, name:(d.data() || {}).name || d.id, at:(d.data() || {}).at || 0}));
    renderFightPicker();
  }, dbError);
  initRoom();
}
function setModeBadge(){
  const b = $('modeBadge'), t = $('modeText');
  if (mode === 'room') { b.className = 'mode shared'; b.textContent = 'ルーム共有中'; t.textContent = '編集はすぐにルームの全員へ反映されます。'; return; }
  if (mode !== 'shared') { b.className = 'mode local'; b.textContent = 'ローカル'; t.textContent = 'このブラウザだけで保存されます。'; return; }
  if (readOnly) { b.className = 'mode ro'; b.textContent = '閲覧のみ'; t.textContent = '共有中のプランを見ています。編集するには、持ち主に編集者として招待してもらってください。'; return; }
  b.className = 'mode shared'; b.textContent = '共有中'; t.textContent = '変更はすぐに全員の画面へ反映されます。';
}
function dbError(e){
  if (!e) return;
  if (e.code === 'revoked' || e.code === 'not_granted') { readOnly = true; setModeBadge(); renderAll(); return; }
  setStatus('共有データの読み込みに失敗しました。ページを開き直してください。', 'err');
}
function writeError(e){
  const code = e && e.code;
  if (code === 'invalid_argument') { readOnly = true; setModeBadge(); setStatus('このページを編集する権限がありません。閲覧のみで表示します。', 'err'); renderAll(); return; }
  if (code === 'quota_exceeded') { setStatus('共有データの容量がいっぱいです。使わない戦闘のデータを減らしてください。', 'err'); return; }
  setStatus('保存に失敗しました。少し待ってからもう一度操作してください。', 'err');
}

function switchKey(k){
  Shared.subs.forEach(u => { try { u(); } catch (e) {} });
  Shared.subs = []; Shared.key = k; Shared.meta = null; Shared.chunks = [];
  fight = null; plan = []; selCast = null; selEntry = null; openRows = new Set();
  renderFightPicker();
  if (!k) { renderAll(); return; }
  const base = 'fights/' + k;
  Shared.subs.push(Shared.db.doc(base).onSnapshot(s => { Shared.meta = s.exists ? s.data() : null; assemble(); }, dbError));
  Shared.subs.push(Shared.db.collection(base + '/chunks').onSnapshot(s => { Shared.chunks = s.docs.map(d => d.data() || {}); assemble(); }, dbError));
  Shared.subs.push(Shared.db.collection(base + '/plan').onSnapshot(s => {
    plan = s.docs.map(d => toEntry(d.id, d.data() || {})).filter(validEntry);
    if (selEntry && !plan.some(e => e.uid === selEntry)) selEntry = null;
    resolveProfiles(plan.map(e => e.by));
    if (fight) renderAll();
  }, dbError));
}
// 戦闘データは複数のドキュメントに分けて保存し、そろったら組み立てる
function assemble(){
  const m = Shared.meta;
  if (!m) return;
  const parts = Shared.chunks.filter(c => c.ver === m.ver).sort((a, b) => a.idx - b.idx);
  if (parts.length < m.chunkCount) return;
  const types = Object.assign({}, m.abilityTypes || {}, m.typeOverrides || {});
  if (!fight || fight.ver !== m.ver) {
    try {
      fight = unpackFight({...m, casts:parts.flatMap(p => p.casts)});
      fight.ver = m.ver;
      setStatus(`共有中の戦闘「${fight.name}」を表示しています。`, 'ok');
    } catch (e) { fight = null; setStatus('共有中の戦闘データが壊れています。データを取り込み直してください。', 'err'); renderAll(); return; }
  }
  fight.abilityTypes = types;
  members = mergeMembers(m.members);
  partySize = m.partySize >= 1 && m.partySize <= 8 ? Math.round(m.partySize) : defaultPartySize(fight);
  overrides = cleanOverrides(m.overrides);
  renderAll();
}
function renderFightPicker(){
  const sel = $('sharedFight');
  if (!Shared.fights.length) { sel.innerHTML = '<option value="">まだ戦闘データがありません</option>'; return; }
  const list = [...Shared.fights].sort((a, b) => b.at - a.at);
  sel.innerHTML = (Shared.key ? '' : '<option value="">選んでください</option>') + list.map(f => `<option value="${esc(f.key)}">${esc(f.name)}</option>`).join('');
  if (Shared.key) sel.value = Shared.key;
}

const entryBody = e => { const o = {mitId:e.mitId, t:e.t, target:e.target, caster:e.caster || null, by:Shared.myId || null, at:Date.now()}; if (e.custom) o.custom = {...e.custom}; return o; };
const sharedMeta = data => Shared.db.doc(`fights/${Shared.key}`).update(data).catch(writeError);
const SharedOps = {
  add(e){ plan.push(e); renderAll(); Shared.db.doc(`fights/${Shared.key}/plan/${e.uid}`).set(entryBody(e)).catch(writeError); },
  update(e){ renderAll(); Shared.db.doc(`fights/${Shared.key}/plan/${e.uid}`).set(entryBody(e)).catch(writeError); },
  remove(id){ plan = plan.filter(e => e.uid !== id); renderAll(); Shared.db.doc(`fights/${Shared.key}/plan/${id}`).delete().catch(writeError); },
  async clear(){ const ids = plan.map(e => e.uid); plan = []; renderAll();
    try { for (const id of ids) await Shared.db.doc(`fights/${Shared.key}/plan/${id}`).delete(); } catch (e) { writeError(e); } },
  setType(id, t){ fight.abilityTypes[id] = t; renderAll(); sharedMeta({typeOverrides:{[id]:t}}); },
  setMember(m){ renderAll(); sharedMeta({members:{[m.id]:{...m}}}); },
  setPartySize(n){ partySize = n; renderAll(); sharedMeta({partySize:n}); },
  setOverride(k, v){ if (v) overrides[k] = v; else delete overrides[k]; renderAll(); sharedMeta({overrides:{[k]:v || 0}}); },
  // 戦闘データを共有に書き込み、全員の表示をその戦闘に切り替える
  async loadFight(f, planList, extra){
    const db = Shared.db, k = keySeg(f.key), base = 'fights/' + k;
    const packed = packFight(f);
    setStatus('共有データに書き込んでいます…');
    try {
      const prev = await db.doc(base).get();
      const prevMeta = prev.exists ? prev.data() : null;
      const ver = uid();
      // 1ドキュメント256KiBの上限に収まるように分ける
      const chunks = []; let cur = [], size = 0;
      for (const c of packed.casts) { const s = JSON.stringify(c).length * 3; if (cur.length && size + s > 180000) { chunks.push(cur); cur = []; size = 0; } cur.push(c); size += s; }
      if (cur.length || !chunks.length) chunks.push(cur);
      for (let i = 0; i < chunks.length; i++) await db.doc(`${base}/chunks/${i}`).set({ver, idx:i, casts:chunks[i]});
      for (let i = chunks.length; i < ((prevMeta && prevMeta.chunkCount) || 0); i++) await db.doc(`${base}/chunks/${i}`).delete();
      const saveFight = fight; fight = f;
      const mem = extra && extra.members ? mergeMembers(extra.members) : (prevMeta && prevMeta.members ? mergeMembers(prevMeta.members) : defaultMembers(f));
      fight = saveFight;
      const meta = {name:packed.name, duration:packed.duration, excluded:packed.excluded, sample:packed.sample, key:packed.key,
        players:packed.players, abilityTypes:packed.abilityTypes, typeOverrides:(prevMeta && prevMeta.typeOverrides) || {},
        members:membersObj(mem), partySize:(extra && extra.partySize) || (prevMeta && prevMeta.partySize) || defaultPartySize(f),
        overrides:cleanOverrides((extra && extra.overrides) || (prevMeta && prevMeta.overrides)),
        chunkCount:chunks.length, ver, at:Date.now(), by:Shared.myId || null};
      await db.doc(base).set(meta);
      let added = 0;
      if (planList && planList.length) {
        const existing = await db.collection(base + '/plan').limit(1).get();
        if (existing.empty) for (const e of planList.filter(validEntry)) { await db.doc(`${base}/plan/${uid()}`).set(entryBody(cleanEntry(toEntry('x', e)))); added++; }
      }
      await db.doc('state/current').set({key:k, at:Date.now(), by:Shared.myId || null});
      setStatus(`「${packed.name}」を共有しました${added ? `（軽減 ${added} 件も取り込み）` : planList && planList.length ? '（この戦闘にはすでにプランがあるので、ファイルのプランは取り込んでいません）' : ''}。`, 'ok');
    } catch (e) { writeError(e); }
  },
};
