'use strict';
// FF Logs との通信（ログイン・API・レポートと戦闘の読み込み）

// ===== FF Logs API =====
const API = 'https://www.fflogs.com';
// FF Logs で「Public Client」として作ったクライアントのID（秘密の情報ではないので公開して問題ありません）。
// リダイレクトURLには、このページのURL（クエリなし）を登録します。
const FFLOGS_PUBLIC_CLIENT_ID = '01a153f2-4c82-7195-8cc5-c126d07dde7b';
// ログイン方式（PKCE）は、登録したURLと同じ https のページでだけ使う
const pkceAvailable = () => !!FFLOGS_PUBLIC_CLIENT_ID && location.protocol === 'https:';
const redirectUri = () => location.origin + location.pathname;
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomStr = n => b64url(crypto.getRandomValues(new Uint8Array(n)));
const session = {
  get(k){ try { return JSON.parse(sessionStorage.getItem(k)); } catch(e) { return null; } },
  set(k,v){ try { sessionStorage.setItem(k, JSON.stringify(v)); } catch(e) {} },
  del(k){ try { sessionStorage.removeItem(k); } catch(e) {} },
};
function userToken(){ const t = store.get('fflp-utoken'); return t && t.exp > Date.now() + 60000 ? t.token : null; }
async function startLogin(){
  const verifier = randomStr(48), state = randomStr(16);
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  // 戻ってきたときに、ルームや入力中のURLを元に戻せるように覚えておく
  session.set('fflp-pkce', {verifier, state, search:location.search, url:$('url').value});
  const p = new URLSearchParams({client_id:FFLOGS_PUBLIC_CLIENT_ID, code_challenge:challenge, code_challenge_method:'S256',
    state, redirect_uri:redirectUri(), response_type:'code'});
  location.href = API + '/oauth/authorize?' + p.toString();
}
// FF Logs から戻ってきたとき（?code=…&state=…）にトークンへ交換する。戻り値は元のクエリ
async function finishLogin(q){
  const saved = session.get('fflp-pkce'); session.del('fflp-pkce');
  const back = {search:saved ? saved.search : '', url:saved ? saved.url : ''};
  if (!saved || saved.state !== q.get('state')) return {...back, msg:'FF Logs へのログインを確認できませんでした。もう一度「FF Logs でログイン」を押してください。', ok:false};
  if (q.get('error')) return {...back, msg:'FF Logs へのログインがキャンセルされました。', ok:false};
  try {
    const res = await fetch(API + '/oauth/token', {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({grant_type:'authorization_code', client_id:FFLOGS_PUBLIC_CLIENT_ID, code_verifier:saved.verifier, redirect_uri:redirectUri(), code:q.get('code')}).toString()});
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    store.set('fflp-utoken', {token:j.access_token, exp:Date.now() + (j.expires_in || 86400) * 1000});
    return {...back, msg:'FF Logs にログインしました。レポートのURLを貼って「読み込む」を押してください。', ok:true};
  } catch (e) { return {...back, msg:'FF Logs へのログインに失敗しました（' + e.message + '）。もう一度試してください。', ok:false}; }
}
function renderLogin(){
  const on = pkceAvailable();
  $('loginRow').hidden = !on;
  // ログイン方式が使えるときは、クライアントIDとシークレットの入力欄を出さない
  $('credBox').hidden = on;
  if (!on) return;
  const logged = !!userToken();
  $('loginState').textContent = logged ? 'FF Logs にログイン中です。' : 'ログを読み込むには FF Logs へのログインが必要です（初回のみ）。';
  $('loginBtn').hidden = logged; $('logoutBtn').hidden = !logged;
}
$('loginBtn').addEventListener('click', () => startLogin().catch(() => setStatus('ログインを始められませんでした。', 'err')));
$('logoutBtn').addEventListener('click', () => { store.del('fflp-utoken'); renderLogin(); setStatus('FF Logs からログアウトしました。'); });

// API の呼び出し先と認証。ログイン方式ならユーザー用、そうでなければクライアント用のAPIを使う
async function getAuth(){
  if (pkceAvailable()) {
    const t = userToken();
    if (!t) throw new Error('先に「FF Logs でログイン」を押してください。');
    return {token:t, endpoint:API + '/api/v2/user', user:true};
  }
  return {token:await getToken(), endpoint:API + '/api/v2/client', user:false};
}
async function getToken(){
  const id = $('cid').value.trim(), sec = $('csec').value.trim();
  if (!id || !sec) { $('credBox').open = true; throw new Error('FF Logs API のクライアントIDとシークレットを入力してください。'); }
  const cached = store.get('fflp-token');
  if (cached && cached.id === id && cached.exp > Date.now() + 60000) return cached.token;
  const res = await fetch(API + '/oauth/token', {method:'POST',
    headers:{'Authorization':'Basic ' + btoa(id + ':' + sec), 'Content-Type':'application/x-www-form-urlencoded'},
    body:'grant_type=client_credentials'});
  if (!res.ok) throw new Error('認証に失敗しました（' + res.status + '）。クライアントIDとシークレットを確認してください。');
  const j = await res.json();
  store.set('fflp-token', {id, token:j.access_token, exp:Date.now() + j.expires_in * 1000});
  return j.access_token;
}
async function gql(query, variables){
  const auth = await getAuth();
  const res = await fetch(auth.endpoint, {method:'POST',
    headers:{'Authorization':'Bearer ' + auth.token, 'Content-Type':'application/json'},
    body:JSON.stringify({query, variables})});
  if (res.status === 401) {
    if (auth.user) { store.del('fflp-utoken'); renderLogin(); throw new Error('FF Logs のログインの有効期限が切れました。もう一度「FF Logs でログイン」を押してください。'); }
    store.del('fflp-token'); throw new Error('認証の有効期限が切れました。もう一度読み込んでください。');
  }
  if (!res.ok) throw new Error('FF Logs への問い合わせに失敗しました（' + res.status + '）。');
  const j = await res.json();
  if (j.errors && j.errors.length) throw new Error('FF Logs: ' + j.errors.map(e => e.message).join(' / '));
  return j.data;
}
function parseUrl(u){
  const m = String(u).match(/reports\/(?:a:)?([A-Za-z0-9]{8,})/);
  if (!m) return null;
  const fm = String(u).match(/[?#&]fight=(\d+|last)/);
  return {code:m[1], fight:fm ? fm[1] : null};
}

let reportCache = null; // {code, title, fights, actors, abilities}
async function loadReport(){
  const p = parseUrl($('url').value);
  if (!p) { setStatus('URLの形式が違います。「fflogs.com/reports/英数字」を含むURLを貼り付けてください。', 'err'); return; }
  $('load').disabled = true;
  try {
    if (!reportCache || reportCache.code !== p.code) {
      setStatus('レポートを取得しています…');
      const d = await gql(`query($code:String!){reportData{report(code:$code){title
        fights{id name startTime endTime kill encounterID difficulty}
        masterData{actors{id name type subType petOwner} abilities{gameID name type}}}}}`, {code:p.code});
      const r = d.reportData.report;
      if (!r) throw new Error('レポートが見つかりません。非公開ログの場合は読み込めません。');
      reportCache = {code:p.code, title:r.title, fights:r.fights.filter(f => f.encounterID > 0),
        actors:r.masterData.actors, abilities:r.masterData.abilities};
      if (!reportCache.fights.length) throw new Error('このレポートにボス戦がありません。');
      const sel = $('fight');
      sel.innerHTML = reportCache.fights.map(f => `<option value="${f.id}">#${f.id} ${esc(f.name)} ${f.kill ? '（討伐）' : '（ワイプ）'} ${fmtT((f.endTime - f.startTime) / 1000)}</option>`).join('');
      sel.disabled = false;
      let fid = p.fight === 'last' ? reportCache.fights[reportCache.fights.length - 1].id : +p.fight;
      if (!reportCache.fights.some(f => f.id === fid)) fid = (reportCache.fights.find(f => f.kill) || reportCache.fights[reportCache.fights.length - 1]).id;
      sel.value = fid;
    }
    await loadFight(+$('fight').value);
  } catch (e) {
    setStatus(e.message === 'Failed to fetch' ? 'FF Logs に接続できませんでした。ネットワークを確認してください。' : e.message, 'err');
  } finally { $('load').disabled = false; }
}

// 戦闘のイベントを、ページを送りながらすべて取る（dataType: DamageTaken / Casts）
async function fetchEvents(r, f, dataType, label){
  const events = [];
  let start = f.startTime;
  for (let page = 0; page < 50 && start != null; page++) {
    const d = await gql(`query($code:String!,$fid:Int!,$s:Float!,$e:Float!){reportData{report(code:$code){
      events(fightIDs:[$fid],startTime:$s,endTime:$e,dataType:${dataType},hostilityType:Friendlies,includeResources:${dataType === 'DamageTaken'},limit:10000){data nextPageTimestamp}}}}`,
      {code:r.code, fid:f.id, s:start, e:f.endTime});
    const ev = d.reportData.report.events;
    events.push(...ev.data);
    start = ev.nextPageTimestamp;
    setStatus(`「${f.name}」の${label}を取得しています…（${events.length}件）`);
  }
  return events;
}

// ログで実際に使われた軽減・ヒール・バリアを、プランの形にする。使う人・対象はログのプレイヤーID（fixEntry でメンバーに直す）
function planFromCasts(events, f, actors){
  const owner = id => { const a = actors.get(id); return a && a.petOwner > 0 ? a.petOwner : id; }; // フェアリーなどのペットは主のプレイヤー
  const out = [];
  for (const e of events) {
    if (e.type !== 'cast') continue;
    const id = SKILL_BY_GAME_ID.get(e.abilityGameID);
    const d = id && MIT[id];
    if (!d) continue;
    const caster = owner(e.sourceID);
    const tgt = e.targetID > 0 ? owner(e.targetID) : -1;
    const tgtIsPlayer = (actors.get(tgt) || {}).type === 'Player';
    out.push({mitId:id, t:Math.max(0, Math.round((e.timestamp - f.startTime) / 100) / 10), caster,
      target:d.kind === 'party' ? 'all' : d.kind === 'single' && tgtIsPlayer ? tgt : caster, at:e.timestamp});
  }
  return out;
}

// ログで使われたヒール・バリアに、ログ上の回復量・HoT の1回分・バリア量（1人あたりの平均）を入れる（e.ovr。手入力と同じ扱い）。
// 回復量はオーバーヒールを含む量（あふれた分も含めた、スキルが出した回復量）。
//   回復：使ってから 2.5秒以内（遅れて効くスキルはその分あと）の、そのスキルの回復
//   HoT ：効果時間の間の、そのスキルの効果（Status）の回復
//   バリア：使ってから 2.5秒以内に付いた、そのスキルの効果のバリア量（ログにバリア量が記録されているときだけ）
// ログに見つからなかったものは、これまでどおり計算式で出す
function healOverridesFromLog(entries, heals, buffs, actors){
  const owner = id => { const a = actors.get(id); return a && a.petOwner > 0 ? a.petOwner : id; };
  const amount = h => (h.amount || 0) + (h.overheal || 0);
  const avg = list => list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : 0;
  let n = 0;
  for (const e of entries) {
    const d = MIT[e.mitId];
    if (!(d.heal || d.hot || d.shield)) continue;
    const ids = new Set(SKILL_GAME_IDS[e.mitId] || []);
    const st = new Set((SKILL_STATUS_IDS[e.mitId] || []).map(x => x + 1000000));
    const from = ev => owner(ev.sourceID) === e.caster;
    const t0 = e.at + (d.delay || 0) * 1000;
    const ovr = {};
    if (d.heal) ovr.heal = avg(heals.filter(h => !h.tick && ids.has(h.abilityGameID) && from(h) && h.timestamp >= e.at && h.timestamp <= t0 + 2500).map(amount));
    if (d.hot) ovr.hot = avg(heals.filter(h => h.tick && (st.has(h.abilityGameID) || ids.has(h.abilityGameID)) && from(h) && h.timestamp > e.at && h.timestamp <= t0 + d.hot.dur * 1000 + 3000).map(amount));
    if (d.shield) ovr.shield = avg(buffs.filter(b => (b.type === 'applybuff' || b.type === 'refreshbuff') && st.has(b.abilityGameID) && from(b) && b.absorb > 0 && b.timestamp >= e.at && b.timestamp <= t0 + 2500).map(b => b.absorb));
    for (const k of Object.keys(ovr)) if (!(ovr[k] > 0)) delete ovr[k];
    if (Object.keys(ovr).length) { e.ovr = ovr; n++; }
  }
  return n;
}

async function loadFight(fid){
  const r = reportCache, f = r.fights.find(x => x.id === fid);
  if (!f) return;
  const fromLog = settings.mitSource === 'log';
  setStatus(`「${f.name}」の被ダメージを取得しています…`);
  const events = await fetchEvents(r, f, 'DamageTaken', '被ダメージ');
  const actors = new Map(r.actors.map(a => [a.id, a]));
  const abilities = new Map(r.abilities.map(a => [a.gameID, a]));
  const loaded = buildFight({code:r.code, fightId:fid, name:f.name, startTime:f.startTime, duration:f.endTime - f.startTime, events, actors, abilities});
  // 軽減：ログで実際に使われたもの、または今のプランの軽減（戦闘を開いていないときは、その戦闘で前に保存したプラン）
  let planList = null, note = '';
  if (fromLog) {
    planList = planFromCasts(await fetchEvents(r, f, 'Casts', 'スキルの使用'), f, actors);
    // ヒール・バリアの量もログのものを使う
    const healN = healOverridesFromLog(planList, await fetchEvents(r, f, 'Healing', '回復'), await fetchEvents(r, f, 'Buffs', 'バフ'), actors);
    note = `ログで使われた軽減・回復 ${planList.length} 件を配置し、そのうち ${healN} 件の回復量・HoT・バリア量をログの値にしました。`;
  } else if (fight) {
    planList = plan.map(cleanEntry);
    note = `今のプランの軽減 ${planList.length} 件をそのまま使います。`;
  }
  await ops().loadFight(loaded, planList, null);
  setStatus(`${r.title} / ${f.name} を読み込みました${mode === 'room' ? '（ルームの全員に共有）' : ''}。攻撃 ${loaded.casts.length} 回、バリアで除外したヒット ${loaded.excluded} 件。${note}`, 'ok');
}
