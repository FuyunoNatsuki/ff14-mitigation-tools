'use strict';
// 被ダメージの計算（攻撃ごと・メンバーごと）

// ===== 計算 =====
function rateOf(def, type){ if (type === 'phys') return def.p; if (type === 'mag') return def.m; return def.p === def.m ? def.p : 0; }
const defOf = e => e.custom || MIT[e.mitId];
const kindOf = e => e.custom ? 'custom' : MIT[e.mitId].kind;
// 参加中のメンバーが使う軽減だけを有効にする（人数を減らすと、外れた枠の軽減は計算から外れる）
const entryLive = e => e.custom ? true : isActiveId(e.caster);
function activeEntries(tSec){ return plan.filter(e => { const d = defOf(e); return d && entryLive(e) && tSec >= e.t && tSec < e.t + d.d; }); }

function evalCast(c){
  // 共有データ由来の値なので、決まった3種類以外は「特殊」として扱う（HTMLに入れるため）
  const rawType = fight.abilityTypes[c.abilityId];
  const type = ['phys', 'mag', 'unique'].includes(rawType) ? rawType : 'unique';
  const act = activeEntries(c.t / 1000);
  const key = castKey(c);
  const ovr = overrides[key] > 0 ? overrides[key] : null;
  const byPid = new Map(c.targets.map(x => [x.pid, x]));
  const vals = c.targets.filter(x => x.raw != null).map(x => x.raw).sort((a, b) => a - b);
  const median = vals.length ? vals[Math.floor(vals.length / 2)] : null;
  const aoe = c.targets.length >= Math.min(4, Math.max(1, fight.players.length));
  const logMax = vals.length ? vals[vals.length - 1] : 0;
  const rows = [];
  let worst = null, maxRaw = 0, maxDmg = 0, maxActual = 0;
  const hitIds = new Set();
  for (const m of activeMembers()) {
    const x = m.pid >= 0 ? byPid.get(m.pid) : null;
    let raw, est = false, n = 1, actual = null;
    if (x) { raw = ovr != null ? ovr : x.raw; est = ovr == null && x.est; n = x.n; actual = x.actual; }
    // ログに対応するプレイヤーがいないメンバーは、全体攻撃なら当たったものとして扱う
    else if (aoe) { raw = ovr != null ? ovr : median; est = ovr == null; }
    else continue;
    hitIds.add(m.id);
    let mul = 1;
    for (const e of act) if (e.target === 'all' || e.target === m.id) mul *= 1 - rateOf(defOf(e), type) / 100;
    if (settings.trait && roleOf(m) === 'tank') mul *= 0.8;
    mul *= tenMul(m) * defMul(m, type);
    const dmg = raw == null ? null : Math.floor(raw * mul);
    const hp = hpOf(m);
    const left = dmg == null ? null : hp - dmg;
    const row = {m, raw, estimated:est, nHits:n, actual, mul, dmg, hp, left, leftPct:left == null ? null : left / hp * 100};
    rows.push(row);
    if (actual != null) maxActual = Math.max(maxActual, actual);
    if (raw != null) { maxRaw = Math.max(maxRaw, raw); maxDmg = Math.max(maxDmg, dmg); if (!worst || row.leftPct < worst.leftPct) worst = row; }
  }
  const status = !worst ? 'none' : worst.left <= 0 ? 'bad' : worst.leftPct < 15 ? 'warn' : 'ok';
  // 表の「有効な軽減」には軽減率のあるものだけ出す（回復だけのスキルは除く）
  const shown = act.filter(e => { const d = defOf(e); return (d.p || d.m) && (e.target === 'all' || hitIds.has(e.target)); });
  return {c, key, type, rows, worst, maxRaw, maxDmg, maxActual, status, shown, ovr, logMax, targets:c.targets.length,
    hasTank:c.targets.some(x => (fight.playerMap.get(x.pid) || {}).role === 'tank')};
}

function visibleCasts(evals){
  return evals.filter(ev => {
    // サンプルがない攻撃は、実ダメージ（バリア込み）で下限を判定する
    const size = ev.status === 'none' ? ev.maxActual : ev.maxRaw;
    if (size < (settings.minDmg || 0)) return false;
    if (settings.scope === 'aoe' && ev.targets < 4) return false;
    if (settings.scope === 'tb' && !(ev.hasTank && ev.targets <= 2)) return false;
    return true;
  });
}

// 古い形式のプラン（対象がログのプレイヤーID、使う人なし）を今のメンバーに合わせる
function fixEntry(e){
  if (typeof e.target === 'number') {
    const m = activeMembers().find(x => x.pid === e.target) || members.find(x => x.pid === e.target);
    e.target = m ? m.id : 'all';
  }
  if (e.custom) return;
  const d = MIT[e.mitId];
  if (d.kind === 'party') e.target = 'all';
  if (!e.caster || !memberById(e.caster)) {
    const can = activeMembers().filter(m => d.jobs.includes(m.job));
    const pick = d.kind === 'self' ? (can.find(m => m.id === e.target) || can[0]) : can[0];
    e.caster = pick ? pick.id : null;
  }
  if (d.kind === 'self') e.target = e.caster || 'all';
  if (d.kind === 'single' && (e.target === 'all' || !memberById(e.target))) e.target = e.caster || 'all';
}
