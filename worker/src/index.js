// Mitigation Planner の共有ルーム用の中継サーバー（Cloudflare Workers）。
// ブラウザはこの中継だけにつなぎ、Firebase Realtime Database のURLと鍵は中継の中（Secrets）にだけ置く。
//
// 必要な Secrets（wrangler secret put で登録）:
//   DB_URL      : Firebase Realtime Database のURL（例: https://xxxx-default-rtdb.firebaseio.com）
//   FIREBASE_SA : Firebase のサービスアカウントの鍵（JSON の中身そのまま）
// 変数（wrangler.toml）:
//   ALLOWED_ORIGINS : ブラウザからの呼び出しを許すページの origin（カンマ区切り。file:// で開いたページは "null"）
//
// 受け付ける呼び出し:
//   GET    /rooms/<ルームID>            ルーム全体をストリーミング（Server-Sent Events）で受け取る
//   PUT    /rooms/<ルームID>            ルームを作る（中身を丸ごと書く）
//   PATCH  /rooms/<ルームID>            ルームの一部をまとめて書き換える
//   PUT/PATCH/DELETE /rooms/<ルームID>/<項目>[/...]  項目ごとの書き込み・削除
// それ以外（ルーム全体の削除、ルームの一覧、決められていない項目）は断る。

const ROOM_ID = /^[a-z0-9]{12}$/;
const KEYS = new Set(['fight', 'plan', 'types', 'members', 'partySize', 'overrides', 'presence']);
const SEGMENT = /^[A-Za-z0-9_-]{1,32}$/;
const MAX_BODY = 2_500_000; // 戦闘データ（最大 2,000,000 文字）に余裕を持たせた上限
// Firebase のルールでは auth.uid がこの値のときだけ読み書きを許す
const PROXY_UID = 'mp-room-proxy';

let tokenCache = {token: null, exp: 0};

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, {status: cors ? 204 : 403, headers: cors || {}});
    if (!cors) return text(403, 'This origin is not allowed.');

    try {
      const url = new URL(request.url);
      const segs = url.pathname.split('/').filter(Boolean);
      if (segs[0] !== 'rooms' || !ROOM_ID.test(segs[1] || '')) return text(404, 'Not found.', cors);
      const sub = segs.slice(2);
      if (sub.length && (!KEYS.has(sub[0]) || sub.length > 3 || !sub.every(s => SEGMENT.test(s)))) return text(400, 'Unknown item.', cors);

      const method = request.method;
      if (method === 'GET' && sub.length) return text(405, 'Only the whole room can be read.', cors);
      if (method === 'DELETE' && !sub.length) return text(405, 'A room cannot be deleted as a whole.', cors);
      if (!['GET', 'PUT', 'PATCH', 'DELETE'].includes(method)) return text(405, 'Method not allowed.', cors);

      let body;
      if (method === 'PUT' || method === 'PATCH') {
        body = await request.text();
        if (body.length > MAX_BODY) return text(413, 'Too large.', cors);
        try { JSON.parse(body); } catch (e) { return text(400, 'Body must be JSON.', cors); }
      }

      const target = await firebaseUrl(env, ['rooms', segs[1], ...sub]);
      if (method === 'GET') {
        // ストリーミングをそのまま中継する（Firebase がリダイレクトしても fetch が追いかける）
        const up = await fetch(target, {headers: {Accept: 'text/event-stream'}});
        if (!up.ok) return text(up.status === 401 ? 403 : 502, 'Could not open the room.', cors);
        return new Response(up.body, {status: 200, headers: {...cors,
          'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no'}});
      }
      const up = await fetch(target, {method, body, headers: body ? {'Content-Type': 'application/json'} : {}});
      // 書き込みの結果の中身は返さない（ブラウザは状態コードだけ見る）
      return text(up.ok ? 200 : up.status === 401 ? 403 : up.status === 400 ? 400 : 502, up.ok ? 'ok' : 'Rejected.', cors);
    } catch (e) {
      return text(500, 'Relay error.', cors);
    }
  },
};

function corsHeaders(origin, env) {
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function text(status, msg, cors) {
  return new Response(msg, {status, headers: {...(cors || {}), 'Content-Type': 'text/plain; charset=utf-8'}});
}

// Firebase への URL。サービスアカウントのトークンで、権限を中継用の uid に絞って呼ぶ
async function firebaseUrl(env, segs) {
  const base = String(env.DB_URL || '').trim().replace(/\/+$/, '');
  if (!/^https:\/\/[a-z0-9.-]+\.(firebaseio\.com|firebasedatabase\.app)$/.test(base)) throw new Error('DB_URL is not set');
  const token = await accessToken(env);
  const q = new URLSearchParams({access_token: token, auth_variable_override: JSON.stringify({uid: PROXY_UID})});
  return `${base}/${segs.map(encodeURIComponent).join('/')}.json?${q}`;
}

// サービスアカウントの鍵から Google の OAuth アクセストークンを作る（1時間有効、少し前に作り直す）
async function accessToken(env) {
  if (tokenCache.token && tokenCache.exp > Date.now() + 5 * 60 * 1000) return tokenCache.token;
  const sa = JSON.parse(env.FIREBASE_SA || '{}');
  if (!sa.client_email || !sa.private_key) throw new Error('FIREBASE_SA is not set');
  const now = Math.floor(Date.now() / 1000);
  const enc = obj => b64url(new TextEncoder().encode(JSON.stringify(obj)));
  const unsigned = enc({alg: 'RS256', typ: 'JWT'}) + '.' + enc({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  });
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + b64url(new Uint8Array(sig))}),
  });
  if (!res.ok) throw new Error('token ' + res.status);
  const j = await res.json();
  tokenCache = {token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000};
  return tokenCache.token;
}

function pemToDer(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
