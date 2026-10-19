'use strict';
// 起動処理（ルームへの参加・FF Logs ログインからの復帰・サンプル表示）

// 初期化
(function init(){
  const s = store.get('fflp-settings'); if (s) Object.assign(settings, s);
  $('trait').checked = settings.trait; $('ten').checked = settings.ten !== false; $('defOn').checked = !!settings.def;$('zoom').value = String(settings.zoom); $('minDmg').value = settings.minDmg; $('scope').value = settings.scope;
  const c = store.get('fflp-cred'); if (c) { $('cid').value = c.id || ''; $('csec').value = c.sec || ''; } else $('credBox').open = true;
  members = defaultMembers(null);
  if (window.claude && typeof window.claude.use === 'function') {
    // claude.ai のページとして開かれている：共有データにつながるまで空の状態で待つ
    $('fflogsBox').hidden = true; $('sharedBox').hidden = false; $('roomBox').hidden = true;
    renderAll();
    setStatus('共有データに接続しています…');
    initShared().then(() => {
      if (mode !== 'shared') {
        // 共有できない表示（未ログインなど）：このブラウザだけで動かす
        $('sharedBox').hidden = true;
        setModeBadge(); setFight(demoFight(), null, null);
        setStatus('共有データに接続できないため、このブラウザだけで表示しています。サインインすると共有プランが見られます。');
      }
    });
    return;
  }
  $('nick').value = store.get('fflp-nick') || '';
  renderLogin();
  const q0 = new URLSearchParams(location.search);
  if (pkceAvailable() && q0.get('state') && (q0.get('code') || q0.get('error'))) {
    // FF Logs のログインから戻ってきた：トークンに交換してから、元のURL（ルームなど）に戻す
    finishLogin(q0).then(r => {
      try { history.replaceState(null, '', location.pathname + (r.search || '')); } catch (e) {}
      if (r.url) $('url').value = r.url;
      renderLogin();
      startPage(new URLSearchParams(r.search || ''));
      setStatus(r.msg, r.ok ? 'ok' : 'err');
    });
    return;
  }
  startPage(q0);
})();
function startPage(q){
  // URLに ?room= があればそのルームに参加する
  const qRoom = (q.get('room') || '').toLowerCase();
  if (validRoomId(qRoom)) {
    const db = readDbInput();
    if (db) { startRoom(db, qRoom, null); return; }
  }
  // 最初はサンプルを表示して、使い方がわかる状態にする
  setFight(demoFight(), null, null);
  setStatus('サンプルデータを表示中です。FF Logs のURLを貼って「読み込む」を押すと実際のログに切り替わります。');
}
