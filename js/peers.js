'use strict';
// 同時に開いている人の表示

// 同時に開いている人の表示（room）
async function initRoom(){
  const room = await window.claude.use('room');
  if (!room) return;
  Shared.room = room;
  room.onPeers(ch => { Shared.peers = ch.peers; renderPeers(); if (fight) renderTimelineOnly(); }, () => {});
}
async function resolveProfiles(ids){
  if (!Shared.user) return;
  ids = [...new Set(ids.filter(Boolean))];
  if (!ids.length) return;
  const ps = await Shared.user.profiles(ids);
  let changed = false;
  for (const id of ids) if (!profileCache[id] || profileCache[id].name !== ps[id].name) { profileCache[id] = ps[id]; changed = true; }
  if (changed) { renderPeers(); if (fight) renderTimelineOnly(); }
}
function renderTimelineOnly(){ if (drag) { renderPending = true; return; } renderTimeline(visibleCasts(EVALS)); }
// 名前の文字列から決まる色（ルームではアカウントの色がないため）
const PEER_COLORS = ['#3767c9', '#3f9a5a', '#b8434d', '#c27a2a', '#8a6bc4', '#2a8f9c', '#b0509a', '#6f7d1f'];
const colorFor = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return PEER_COLORS[h % PEER_COLORS.length]; };
// 開いている人の一覧（共有ページ・ルーム共通の形）
function peerList(){
  if (mode === 'room') return Room.peers.map(p => ({key:p.id, name:p.name, isMe:p.id === Room.clientId, sel:p.sel, color:colorFor(p.id), avatar:null}));
  if (mode !== 'shared') return [];
  const byPerson = new Map();
  for (const p of (Shared.peers || [])) { if (p.kind !== 'viewer') continue; const k = p.by || p.peer; if (!byPerson.has(k) || p.sameTab) byPerson.set(k, p); }
  resolveProfiles([...byPerson.values()].map(p => p.by));
  return [...byPerson.values()].map(p => { const prof = p.by && profileCache[p.by];
    return {key:p.by || p.peer, name:(prof && prof.name) || 'メンバー', isMe:p.isMe, sel:p.presence && typeof p.presence.sel === 'number' ? p.presence.sel : null,
      color:(prof && prof.color) || 'var(--accent)', avatar:prof ? prof.avatarUrl : null}; });
}
function peerSelections(){
  const m = new Map();
  for (const p of peerList()) { if (p.isMe || p.sel == null) continue; (m.get(p.sel) || m.set(p.sel, []).get(p.sel)).push(p.color); }
  return m;
}
function renderPeers(){
  const el = $('peers');
  const peers = peerList();
  el.textContent = '';
  if (!peers.length) return;
  const lab = document.createElement('span'); lab.textContent = '開いている人'; el.appendChild(lab);
  for (const p of peers) {
    const chip = document.createElement('span'); chip.className = 'peer' + (p.isMe ? ' me' : '');
    if (p.avatar) { const img = document.createElement('img'); img.alt = ''; img.src = p.avatar; chip.appendChild(img); }
    else { const dot = document.createElement('span'); dot.style.cssText = `width:12px;height:12px;border-radius:50%;margin-left:5px;background:${p.color}`; chip.appendChild(dot); }
    const nm = document.createElement('span'); nm.textContent = p.name + (p.isMe ? '（あなた）' : '');
    chip.appendChild(nm); el.appendChild(chip);
  }
}
function announceSelection(){
  if (mode === 'room') return sendPresence();
  if (Shared.room) Shared.room.presence({sel:selCast == null ? null : selCast}).catch(() => {});
}
