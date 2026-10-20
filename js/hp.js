'use strict';
// HP の推移（攻撃によるダメージ・回復・HoT・バリア・平常時の回復）を、戦闘の頭から時刻順に計算する

const TICK = 3;               // HoT と平常時の回復は3秒ごと
const DET_SUB = 440;          // Lv100 の意思力の基準値
const RECIT_WINDOW = 15;      // 秘策の効果時間（秒）

// ===== ステータスから回復量の倍率を出す（Lv100）=====
const detMul = m => (1000 + Math.floor(140 * (Math.max(statOf(m, 'det'), DET_SUB) - DET_SUB) / TEN_DIV)) / 1000;
const critRate = m => Math.floor(200 * (Math.max(statOf(m, 'crit'), TEN_SUB) - TEN_SUB) / TEN_DIV + 50) / 1000;
const critMul = m => (1400 + Math.floor(200 * (Math.max(statOf(m, 'crit'), TEN_SUB) - TEN_SUB) / TEN_DIV)) / 1000;
const hppOf = m => statOf(m, 'hpp') || 45;
// 不屈はタンクの回復量にも効く（f(TNC) = 110 × (不屈 − 420) / 2780 + 1000）
const tncHealMul = m => roleOf(m) === 'tank' ? (1000 + Math.floor(110 * (Math.max(statOf(m, 'ten'), TEN_SUB) - TEN_SUB) / TEN_DIV)) / 1000 : 1;
// HoT はスペルスピード（スキルスピード）で強くなる（f(SPD) = 130 × (SS − 420) / 2780 + 1000）
const spdMul = m => (1000 + Math.floor(130 * (Math.max(statOf(m, 'ss'), TEN_SUB) - TEN_SUB) / TEN_DIV)) / 1000;

// その時刻に効いているバフ（使った人の回復アップ・対象の被回復アップ・ニュートラルセクト）
function buffActive(e, d, t){ return t >= e.t && t < e.t + (d.buffDur || d.d || 0); }
function casterHealUp(casterId, t){
  let up = 0;
  for (const e of plan) { const d = defOf(e); if (d && d.healUp && entryLive(e) && e.caster === casterId && buffActive(e, d, t)) up += d.healUp; }
  return up;
}
function recvUp(memberId, t){
  let up = 0;
  for (const e of plan) {
    const d = defOf(e);
    if (!d || !d.recv || !entryLive(e) || !buffActive(e, d, t)) continue;
    if (d.kind === 'party' || e.target === memberId) up += d.recv;
  }
  return up;
}
function nsActive(casterId, t){
  return plan.some(e => e.mitId === 'ns' && entryLive(e) && e.caster === casterId && t >= e.t && t < e.t + (MIT.ns.buffDur || 20));
}
// 秘策：使った人の、効果時間内の最初の対象スキルをクリティカル確定にする
function recitationCrits(){
  const crit = new Set();
  const entries = plan.filter(e => !e.custom && entryLive(e)).sort((a, b) => a.t - b.t);
  for (const r of entries.filter(e => MIT[e.mitId].recit)) {
    const hit = entries.find(e => MIT[e.mitId].recitable && e.caster === r.caster && e.t >= r.t && e.t < r.t + RECIT_WINDOW && !crit.has(e.uid));
    if (hit) crit.add(hit.uid);
  }
  return crit;
}
function targetsOf(e, d){
  const act = activeMembers();
  if (d.kind === 'party') return act;
  const id = d.kind === 'self' ? e.caster : e.target;
  return act.filter(m => m.id === id);
}
// 威力から回復量を出す（回復計算式の順で、各段で小数点以下を切り捨てる）。
//   H1 = 威力 × 回復係数 × f(意思力)          … 回復係数は f(回復魔法力) × f(武器) × 特性 をまとめた目安
//   H2 = H1 × f(不屈)（タンクのみ）。HoT は f(不屈) の代わりに f(スペルスピード)
//   H3 = H2 × クリティカル（確定 / 期待値 / なし）
//   H  = H3 × バフ（使った人の回復魔法アップ・対象の被回復アップ）。±3% の乱数は入れず平均値で計算する
function healAmount(pot, caster, target, t, crit, isHot){
  let v = Math.floor(pot * hppOf(caster) * detMul(caster));
  v = Math.floor(v * (isHot ? spdMul(caster) : tncHealMul(caster)));
  if (crit === 'sure') v = Math.floor(v * critMul(caster));
  else if (crit === 'expect') v = Math.floor(v * (1 + critRate(caster) * (critMul(caster) - 1)));
  v = Math.floor(v * (1 + casterHealUp(caster.id, t)));
  return Math.floor(v * (1 + recvUp(target.id, t)));
}

// ===== シミュレーション =====
// evals: 攻撃ごとの計算結果（evalCast の戻り値。rows[].dmg を使う）
// 戻り値: {at: Map(castId -> Map(memberId -> {hpBefore, shieldBefore, hpAfter, dead})), series: Map(memberId -> [[t, hp, shield, dead]])}
function simulateHp(evals){
  const mem = activeMembers();
  const st = new Map(mem.map(m => [m.id, {m, max:hpOf(m), hp:hpOf(m), shields:[], triggers:[], dead:false}]));
  const series = new Map(mem.map(m => [m.id, [[0, hpOf(m), 0, false]]]));
  const at = new Map();
  const events = [];   // {t, pri, fn}
  const crits = recitationCrits();
  const critMode = e => crits.has(e.uid) ? 'sure' : settings.critExp ? 'expect' : null;

  // 攻撃（優先度1：同じ時刻の回復・バリアのあとに当たる）
  for (const ev of evals) {
    const rows = ev.rows.filter(r => r.dmg != null && st.has(r.m.id));
    if (!rows.length) continue;
    events.push({t:ev.c.t / 1000, pri:1, fn:t => {
      const snap = new Map();
      for (const r of rows) {
        const s = st.get(r.m.id);
        const before = {hpBefore:s.hp, shieldBefore:shieldTotal(s, t), dead:s.dead};
        if (!s.dead) {
          let dmg = r.dmg;
          for (const sh of s.shields) { if (sh.exp <= t || dmg <= 0) continue; const a = Math.min(sh.amt, dmg); sh.amt -= a; dmg -= a; }
          s.shields = s.shields.filter(sh => sh.amt > 0 && sh.exp > t);
          s.hp -= dmg;
          if (s.hp <= 0) { s.hp = 0; s.dead = true; }
          // HP 条件の回復：被弾後に閾値を下回ったら、その瞬間に回復する
          if (!s.dead) fireTriggers(s, t, tr => s.hp < s.max * tr.under);
        }
        snap.set(r.m.id, {...before, hpAfter:s.hp, deadAfter:s.dead});
        record(r.m.id, t);
      }
      at.set(ev.c.id, snap);
    }});
  }

  // 回復・HoT・バリア（優先度0）
  for (const e of plan) {
    if (e.custom || !entryLive(e)) continue;
    const d = MIT[e.mitId];
    if (!hasHealEffect(d)) continue;
    const caster = memberById(e.caster);
    if (!caster) continue;
    const t0 = e.t + (d.delay || 0);
    const mode = critMode(e);
    events.push({t:t0, pri:0, fn:t => {
      for (const m of targetsOf(e, d)) {
        const s = st.get(m.id); if (!s || s.dead) continue;
        let healed = 0;
        if (d.heal) { healed = healAmount(d.heal, caster, m, t, mode); s.hp = Math.min(s.max, s.hp + healed); }
        let shield = 0;
        if (d.shield) {
          if (d.shield.pct) shield += Math.floor((healed || healAmount(d.heal || 0, caster, m, t, mode)) * d.shield.pct);
          if (d.shield.pot) shield += healAmount(d.shield.pot, caster, m, t, mode);
          if (d.shield.hpPct) shield += Math.floor((d.shield.of === 'caster' ? hpOf(caster) : s.max) * d.shield.hpPct);
        }
        // 鼓舞激励の策がクリティカルのとき：回復量の180%のバリアを追加
        if (d.catalyze && mode === 'sure' && healed) shield += Math.floor(healed * 1.8);
        // ニュートラルセクト中：回復量に対してバリアを追加
        if (d.ns && healed && nsActive(caster.id, t)) shield += Math.floor(healed * d.ns);
        if (shield > 0) s.shields.push({amt:shield, exp:t + (d.shieldDur || 30)});
        // HP 条件の回復（深謀遠慮の策など）：回復量は付けた時点の強さで決め、発動を待つ
        if (d.trigger) {
          const tr = {key:e.uid + '/' + m.id, amt:healAmount(d.trigger.pot, caster, m, t, mode), under:d.trigger.under || 0.5, exp:t + d.trigger.dur};
          s.triggers.push(tr);
          // 付けた時点ですでに閾値を下回っていれば、すぐに回復する
          fireTriggers(s, t, x => x === tr && s.hp < s.max * x.under);
        }
        record(m.id, t);
      }
    }});
    // HP 条件の回復が効果時間の終わりまで発動しなかったら、終わりで必ず回復する
    if (d.trigger) {
      const ids = targetsOf(e, d).map(m => m.id);
      events.push({t:t0 + d.trigger.dur, pri:0, fn:t => { for (const id of ids) { const s = st.get(id); if (s && !s.dead) fireTriggers(s, t, x => x.key === e.uid + '/' + id); } }});
    }
    // HoT は効果を付けた時点の強さで、3秒ごとに回復する
    if (d.hot) {
      const ticks = Math.floor(d.hot.dur / TICK);
      const amounts = new Map(targetsOf(e, d).map(m => [m.id, healAmount(d.hot.pot, caster, m, t0, mode === 'sure' ? null : mode, true)]));
      for (let k = 1; k <= ticks; k++) {
        events.push({t:t0 + k * TICK, pri:0, fn:t => {
          for (const [id, amt] of amounts) { const s = st.get(id); if (!s || s.dead) continue; s.hp = Math.min(s.max, s.hp + amt); record(id, t); }
        }});
      }
    }
  }

  // 平常時の回復（最大HPに対する割合を3秒ごと）
  const regen = Math.max(0, +settings.regenPct || 0) / 100;
  if (regen > 0) for (let t = TICK; t <= fight.duration / 1000; t += TICK) {
    events.push({t, pri:0, fn:t => { for (const s of st.values()) { if (s.dead) continue; s.hp = Math.min(s.max, s.hp + Math.floor(s.max * regen)); record(s.m.id, t); } }});
  }

  events.sort((a, b) => a.t - b.t || a.pri - b.pri);
  for (const ev of events) ev.fn(ev.t);
  return {at, series};

  // 条件に合う待機中の回復を発動して取り除く
  function fireTriggers(s, t, cond){
    const keep = [];
    for (const tr of s.triggers) {
      if (cond(tr) && tr.exp >= t) { s.hp = Math.min(s.max, s.hp + tr.amt); record(s.m.id, t); }
      else if (tr.exp > t) keep.push(tr);
    }
    s.triggers = keep;
  }
  function shieldTotal(s, t){ return s.shields.reduce((a, sh) => a + (sh.exp > t ? sh.amt : 0), 0); }
  function record(id, t){ const s = st.get(id); series.get(id).push([t, s.hp, shieldTotal(s, t), s.dead]); }
}

// 攻撃ごとの計算結果に、HP の推移（被弾前のHP・バリア）を反映して判定し直す
function applyHpSim(evals, sim){
  for (const ev of evals) {
    const snap = sim.at.get(ev.c.id);
    let worst = null;
    for (const r of ev.rows) {
      const s = snap && snap.get(r.m.id);
      if (!s || r.dmg == null) continue;
      r.hpBefore = s.hpBefore; r.shieldBefore = s.shieldBefore; r.wasDead = s.dead;
      r.left = s.dead ? 0 : s.hpBefore - Math.max(0, r.dmg - s.shieldBefore);
      r.leftPct = r.left / r.hp * 100;
      if (!worst || r.leftPct < worst.leftPct) worst = r;
    }
    if (worst) { ev.worst = worst; ev.status = worst.left <= 0 ? 'bad' : worst.leftPct < 15 ? 'warn' : 'ok'; }
  }
}
