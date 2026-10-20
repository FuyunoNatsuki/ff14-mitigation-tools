'use strict';
// URL で共有するルーム（中継サーバー経由で Firebase Realtime Database に保存）

// ----- URLで共有するルーム（中継サーバーの REST とストリーミング）-----
// ブラウザがつなぐのは中継サーバー（worker/ の Cloudflare Worker）だけ。データベースのURLは中継の中にしかない。
const ROOM_API = 'https://mitigation-planner-rooms.mitigation-planner-rooms.workers.dev';
const Room = {db:null, id:null, es:null, mirror:{}, clientId:uid(), hb:null, fightVer:null, baseTypes:{}, peers:[], connected:false, syncTimer:null};
// 中継サーバー（workers.dev か、手元で動かすときの localhost）以外へは送らない
function normDb(u){
  u = String(u || '').trim().replace(/\/+$/, '');
  if (!u || /REPLACE_ME/.test(u)) return '';
  try {
    const x = new URL(u);
    const okRemote = x.protocol === 'https:' && /\.workers\.dev$/.test(x.hostname);
    const okLocal = x.protocol === 'http:' && x.hostname === 'localhost';
    return okRemote || okLocal ? x.origin : null;
  } catch (e) { return null; }
}
const validRoomId = id => /^[a-z0-9]{12}$/.test(String(id || ''));
const newRoomId = () => { const a = 'abcdefghijkmnpqrstuvwxyz23456789'; const b = new Uint8Array(12); crypto.getRandomValues(b); return [...b].map(x => a[x % a.length]).join(''); };
const roomUrl = p => `${Room.db}/rooms/${Room.id}${p ? '/' + p : ''}`;
const myName = () => ($('nick').value.trim() || '名無し').slice(0, 20);
function shareLink(){ const base = location.href.split(/[?#]/)[0]; return `${base}?room=${Room.id}`; }

async function roomReq(method, path, body){
  const res = await fetch(roomUrl(path), {method, headers:{'Content-Type':'application/json'}, body:body === undefined ? undefined : JSON.stringify(body)});
  if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? 'denied' : 'http ' + res.status);
}
function roomWriteError(e){
  setStatus(e && e.message === 'denied'
    ? 'ルームに書き込めませんでした。共有ルームの設定（中継サーバーとデータベースのルール）を管理者に確認してもらってください。'
    : '保存に失敗しました。ネットワークを確認して、もう一度操作してください。', 'err');
}
const roomBody = e => { const o = {mitId:e.mitId, t:e.t, target:e.target, caster:e.caster || null, by:Room.clientId}; if (e.custom) o.custom = {...e.custom}; if (e.ovr) o.ovr = {...e.ovr}; return o; };
const roomFightBody = f => ({json:JSON.stringify(packFight(f)), ver:uid(), name:f.name, at:{'.sv':'timestamp'}});
const roomMember = m => { const o = {job:m.job, name:m.name, pid:m.pid}; for (const k of STAT_KEYS) o[k] = m[k] || 0; return o; };
const RoomOps = {
  add(e){ plan.push(e); renderAll(); roomReq('PUT', 'plan/' + e.uid, roomBody(e)).catch(roomWriteError); },
  update(e){ renderAll(); roomReq('PUT', 'plan/' + e.uid, roomBody(e)).catch(roomWriteError); },
  remove(id){ plan = plan.filter(e => e.uid !== id); renderAll(); roomReq('DELETE', 'plan/' + id).catch(roomWriteError); },
  clear(){ plan = []; renderAll(); roomReq('DELETE', 'plan').catch(roomWriteError); },
  setType(id, t){ fight.abilityTypes[id] = t; renderAll(); roomReq('PATCH', 'types', {[id]:t}).catch(roomWriteError); },
  setMember(m){ renderAll(); roomReq('PUT', 'members/' + m.id, roomMember(m)).catch(roomWriteError); },
  setPartySize(n){ partySize = n; renderAll(); roomReq('PUT', 'partySize', n).catch(roomWriteError); },
  setOverride(k, v){ if (v) overrides[k] = v; else delete overrides[k]; renderAll(); (v ? roomReq('PUT', 'overrides/' + k, v) : roomReq('DELETE', 'overrides/' + k)).catch(roomWriteError); },
  // 攻撃の追加・削除：戦闘データだけ書き直す（プラン・メンバーはそのまま）
  updateFight(f){
    const body = roomFightBody(f);
    Room.fightVer = body.ver; Room.baseTypes = {...f.abilityTypes}; fight = f; renderAll();
    roomReq('PUT', 'fight', body).catch(roomWriteError);
  },
  // 戦闘を入れ替えるときは、ルームのプラン・メンバー・上書きも一緒に入れ替える（1回の書き込みで）
  async loadFight(f, planList, extra){
    const planObj = {};
    for (const e of (planList || []).filter(validEntry)) planObj[uid()] = roomBody(cleanEntry(toEntry('x', e)));
    const saveFight = fight; fight = f;
    const mem = extra && extra.members ? mergeMembers(extra.members) : defaultMembers(f);
    fight = saveFight;
    const ovr = cleanOverrides(extra && extra.overrides);
    try { await roomReq('PATCH', '', {fight:roomFightBody(f), types:null, plan:Object.keys(planObj).length ? planObj : null,
      members:Object.fromEntries(mem.map(m => [m.id, roomMember(m)])), partySize:(extra && extra.partySize) || defaultPartySize(f),
      overrides:Object.keys(ovr).length ? ovr : null}); }
    catch (e) { roomWriteError(e); }
  },
};

// ストリーミングで届く put / patch をローカルの写しに当てはめる
function applyRoomEvent(type, msg){
  if (!msg || typeof msg.path !== 'string') return;
  const segs = msg.path.split('/').filter(Boolean);
  const setAt = (path, val) => {
    if (!path.length) { Room.mirror = (val && typeof val === 'object') ? val : {}; return; }
    let o = Room.mirror;
    for (const s of path.slice(0, -1)) { if (!o[s] || typeof o[s] !== 'object') o[s] = {}; o = o[s]; }
    const last = path[path.length - 1];
    if (val === null || val === undefined) delete o[last]; else o[last] = val;
  };
  if (type === 'put') setAt(segs, msg.data);
  else if (type === 'patch' && msg.data && typeof msg.data === 'object') for (const [k, v] of Object.entries(msg.data)) setAt([...segs, k], v);
  clearTimeout(Room.syncTimer);
  Room.syncTimer = setTimeout(syncFromMirror, 30);
}
function syncFromMirror(){
  const m = Room.mirror || {};
  const fd = m.fight;
  if (!fd) { if (fight) { fight = null; Room.fightVer = null; plan = []; } }
  else if (fd.ver !== Room.fightVer) {
    try {
      const f = unpackFight(JSON.parse(fd.json));
      Room.baseTypes = {...f.abilityTypes};
      fight = f; Room.fightVer = fd.ver; selCast = null; selEntry = null; openRows = new Set();
      setStatus(`ルームの戦闘「${f.name}」を表示しています。`, 'ok');
    } catch (e) { setStatus('ルームの戦闘データを読み取れませんでした。データを読み込み直してください。', 'err'); }
  }
  if (fight) {
    fight.abilityTypes = {...Room.baseTypes, ...(m.types || {})};
    members = mergeMembers(m.members);
    partySize = m.partySize >= 1 && m.partySize <= 8 ? Math.round(m.partySize) : defaultPartySize(fight);
    overrides = cleanOverrides(m.overrides);
  }
  plan = Object.entries(m.plan || {}).map(([id, x]) => toEntry(id, x || {})).filter(validEntry);
  if (selEntry && !plan.some(e => e.uid === selEntry)) selEntry = null;
  // 自分の最終更新時刻を基準に、45秒以上更新のない人は退出扱い
  const pres = m.presence || {};
  const mine = pres[Room.clientId] && pres[Room.clientId].at;
  Room.peers = Object.entries(pres).filter(([id, p]) => p && (id === Room.clientId || !mine || p.at > mine - 45000))
    .map(([id, p]) => ({id, name:String(p.name || '名無し').slice(0, 20), sel:typeof p.sel === 'number' ? p.sel : null}));
  renderPeers();
  renderAll();
}
function sendPresence(){
  if (mode !== 'room') return;
  roomReq('PUT', 'presence/' + Room.clientId, {name:myName(), sel:selCast == null ? null : selCast, at:{'.sv':'timestamp'}}).catch(() => {});
}
async function startRoom(db, id, seed){
  mode = 'room'; readOnly = false;
  Room.db = db; Room.id = id; Room.mirror = {}; Room.fightVer = null; Room.connected = false;
  try { history.replaceState(null, '', shareLink()); } catch (e) {}
  $('roomOff').hidden = true; $('roomOn').hidden = false;
  $('roomIdView').textContent = id; $('roomLink').value = shareLink();
  $('roomNote').textContent = location.protocol === 'file:'
    ? 'ローカルのファイルで開いているため、このリンクはほかの人の環境では開けません。相手にもこのHTMLファイルを渡し、ルームID「' + id + '」で参加してもらってください。ルームIDを知っている人は誰でも編集できます。'
    : 'このリンクを開いた人は、アカウントなしで誰でも編集できます。リンクは信頼できるメンバーにだけ渡してください。';
  setModeBadge();
  if (seed) {
    // 今表示している戦闘・メンバー・プランをそのままルームに入れる
    setStatus('ルームを作っています…');
    try { await roomReq('PUT', '', {fight:seed.fight ? roomFightBody(seed.fight) : null,
      plan:Object.fromEntries(seed.plan.map(e => [e.uid, roomBody(e)])), types:seed.types || null,
      members:Object.fromEntries(seed.members.map(m => [m.id, roomMember(m)])), partySize:seed.partySize,
      overrides:Object.keys(seed.overrides).length ? seed.overrides : null}); }
    catch (e) { roomWriteError(e); return; }
  } else {
    fight = null; plan = []; renderAll();
  }
  setStatus('ルームに接続しています…');
  openStream();
  sendPresence();
  Room.hb = setInterval(sendPresence, 15000);
  window.addEventListener('pagehide', () => { try { fetch(roomUrl('presence/' + Room.clientId), {method:'DELETE', keepalive:true}); } catch (e) {} });
}
// ルームの変更をストリーミングで受け取る。中継サーバーの鍵が切り替わったとき（auth_revoked）はつなぎ直す
function openStream(){
  if (Room.es) Room.es.close();
  const es = new EventSource(roomUrl(''));
  Room.es = es;
  es.addEventListener('put', ev => { if (!Room.connected) { Room.connected = true; setStatus('ルームに接続しました。編集はすぐに全員へ反映されます。', 'ok'); } applyRoomEvent('put', JSON.parse(ev.data)); });
  es.addEventListener('patch', ev => applyRoomEvent('patch', JSON.parse(ev.data)));
  es.addEventListener('auth_revoked', () => { es.close(); setTimeout(openStream, 500); });
  es.addEventListener('cancel', () => { setStatus('ルームを読み込めませんでした。ルームIDを確認してください。', 'err'); es.close(); });
  es.onerror = () => { setStatus(Room.connected ? '接続が切れました。再接続しています…' : 'ルームに接続できません。ネットワークを確認してください。', 'err'); };
}
function leaveRoom(){
  if (Room.es) Room.es.close();
  clearInterval(Room.hb);
  const done = () => { location.href = location.href.split(/[?#]/)[0]; };
  fetch(roomUrl('presence/' + Room.clientId), {method:'DELETE'}).then(done, done);
}
function readDbInput(){
  const db = normDb(ROOM_API);
  if (!db) { setStatus('共有ルームの中継サーバーが設定されていません。', 'err'); return null; }
  return db;
}
$('roomCreate').addEventListener('click', () => {
  const db = readDbInput(); if (!db) return;
  // ルームの種別は元の戦闘データに入れて送る（types は上書き分だけ）
  startRoom(db, newRoomId(), {fight, plan:plan.map(cleanEntry), members, partySize, overrides, types:null});
});
$('roomJoin').addEventListener('click', () => {
  const db = readDbInput(); if (!db) return;
  const id = $('roomCode').value.trim().toLowerCase();
  if (!validRoomId(id)) return setStatus('ルームIDは英小文字と数字の12文字です。', 'err');
  startRoom(db, id, null);
});
$('roomLeave').addEventListener('click', leaveRoom);
$('roomCopy').addEventListener('click', async () => {
  const text = $('roomLink').value;
  try { await navigator.clipboard.writeText(text); setStatus('共有リンクをコピーしました。', 'ok'); }
  catch (e) { $('roomLink').select(); setStatus('リンクを選択しました。Ctrl+C でコピーしてください。'); }
});
$('nick').addEventListener('change', () => { store.set('fflp-nick', $('nick').value.trim()); sendPresence(); });
