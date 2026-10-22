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
    let raw, est = false, n = 1, actual = null, logHpBefore = null, logImmune = false;
    if (x) { raw = ovr != null ? ovr : x.raw; est = ovr == null && x.est; n = x.n; actual = x.actual; logHpBefore = x.hpb == null ? null : x.hpb; logImmune = !!x.sv; }
    // ログのプレイヤーに対応しているメンバーは、ログで当たっていない攻撃は受けない
    else if (logPlayer(m)) continue;
    // ログに対応するプレイヤーがいないメンバーは、全体攻撃なら当たったものとして扱う
    else if (aoe) { raw = ovr != null ? ovr : median; est = ovr == null; }
    else continue;
    hitIds.add(m.id);
    // 元ダメージ（防御力を計上する前）× 軽減 × タンク特性 × 不屈 × そのメンバーの防御力
    let mit = 1;
    for (const e of act) if (e.target === 'all' || e.target === m.id) mit *= 1 - rateOf(defOf(e), type) / 100;
    if (settings.trait && roleOf(m) === 'tank') mit *= 0.8;
    mit *= tenMul(m);
    const dm = defMul(m, type), mul = mit * dm;
    const dmg = raw == null ? null : Math.floor(raw * mul);
    const hp = hpOf(m);
    // ログでは被弾直前の HP 以上のダメージを受けて生き残っている（ツールにない無敵・ギミック）：「HPをログに合わせる」のときは戦闘不能に数えない
    const immune = logImmune && settings.hpFromLog !== false;
    const left = dmg == null ? null : immune ? hp : hp - dmg;
    const row = {m, raw, estimated:est, nHits:n, actual, logHpBefore, immune, mit, defVal:defValueOf(m, type), defMul:dm, afterDef:raw == null ? null : Math.floor(raw * dm),
      mul, dmg, hp, left, leftPct:left == null ? null : left / hp * 100};
    rows.push(row);
    if (actual != null) maxActual = Math.max(maxActual, actual);
    if (raw != null) { maxRaw = Math.max(maxRaw, raw); maxDmg = Math.max(maxDmg, dmg); if (!immune && (!worst || row.leftPct < worst.leftPct)) worst = row; }
  }
  // 当たった全員が「ログでは無効」のときは immune（戦闘不能にもサンプルなしにもしない）
  const status = !worst ? (rows.some(r => r.immune) ? 'immune' : 'none') : worst.left <= 0 ? 'bad' : worst.leftPct < 15 ? 'warn' : 'ok';
  // 表に出す元ダメージ：防御力を計上する前の値に、当たったメンバーのうち防御力がいちばん低い人・高い人の防御力を掛けたもの
  const base = ovr != null ? ovr : logMax;
  let defLo = null, defHi = null;
  for (const r of rows) {
    if (r.raw == null) continue;
    if (!defLo || r.defVal < defLo.defVal) defLo = r;
    if (!defHi || r.defVal > defHi.defVal) defHi = r;
  }
  const defRange = base > 0 && defLo ? {base, lo:{m:defLo.m, def:defLo.defVal, dmg:Math.floor(base * defLo.defMul)},
    hi:{m:defHi.m, def:defHi.defVal, dmg:Math.floor(base * defHi.defMul)}} : null;
  // 表の「有効な軽減」には軽減率のあるものだけ出す（回復だけのスキルは除く）
  const shown = act.filter(e => { const d = defOf(e); return (d.p || d.m) && (e.target === 'all' || hitIds.has(e.target)); });
  return {c, key, type, rows, worst, maxRaw, maxDmg, maxActual, status, shown, ovr, logMax, defRange, targets:c.targets.length,
    hasTank:c.targets.some(x => (fight.playerMap.get(x.pid) || {}).role === 'tank')};
}

function visibleCasts(evals){
  // 表示中のフェーズの範囲にある攻撃だけ（全体のときは TL 全体）
  const [vs, ve] = viewRange(), whole = !currentPhase();
  return evals.filter(ev => {
    const t = ev.c.t / 1000;
    if (t < vs || (whole ? t > ve : t >= ve)) return false;
    // サンプルがない攻撃は、実ダメージ（バリア込み）で下限を判定する
    const size = ev.status === 'none' ? ev.maxActual : ev.maxRaw;
    if (size < (settings.minDmg || 0)) return false;
    if (settings.scope === 'aoe' && ev.targets < 4) return false;
    if (settings.scope === 'tb' && !(ev.hasTank && ev.targets <= 2)) return false;
    return true;
  });
}

// 古い形式のプラン（対象がログのプレイヤーID、使う人なし）と、ログの軽減から作ったプラン（使う人・対象がログのプレイヤーID）を今のメンバーに合わせる
function fixEntry(e){
  if (typeof e.target === 'number') {
    const m = activeMembers().find(x => x.pid === e.target) || members.find(x => x.pid === e.target);
    e.target = m ? m.id : 'all';
  }
  if (typeof e.caster === 'number') {
    const m = activeMembers().find(x => x.pid === e.caster) || members.find(x => x.pid === e.caster);
    e.caster = m ? m.id : null;
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
