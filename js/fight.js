'use strict';
// 戦闘データの組み立て（ログ→攻撃一覧）、保存用の形式

// FF Logs のイベント配列から攻撃一覧を作る
function buildFight({code, fightId, name, startTime, duration, events, actors, abilities}){
  // damage と calculateddamage のうち、元ダメージを持つ方を使う
  const has = t => events.filter(e => e.type === t && e.unmitigatedAmount != null).length;
  const useType = has('damage') >= has('calculateddamage') ? 'damage' : 'calculateddamage';
  const players = new Map();
  const hits = [];
  let excluded = 0;
  for (const e of events) {
    if (e.type !== useType || e.tick) continue;
    const tgt = actors.get(e.targetID);
    if (!tgt || tgt.type !== 'Player') continue;
    if (!players.has(tgt.id)) players.set(tgt.id, {id:tgt.id, name:tgt.name, job:tgt.subType, role:roleGroup((JOB_DATA[JOB_FROM_LOG[tgt.subType]] || {}).role), maxHP:0});
    const pl = players.get(tgt.id);
    const mhp = e.targetResources && e.targetResources.maxHitPoints;
    if (mhp && mhp > pl.maxHP) pl.maxHP = mhp;
    let unmit = e.unmitigatedAmount;
    if (unmit == null && e.multiplier) unmit = (e.amount + (e.absorbed || 0)) / e.multiplier;
    const absorbed = e.absorbed || 0;
    // バリアで吸収されたヒットは元ダメージのサンプルとして使わない
    const valid = unmit != null && absorbed <= 0;
    if (!valid) excluded++;
    const ab = abilities.get(e.abilityGameID);
    hits.push({t:e.timestamp - startTime, abilityId:e.abilityGameID, abilityName:ab ? ab.name : ('#' + e.abilityGameID),
      abilityType:ab ? +ab.type : 0, targetId:tgt.id, unmit:valid ? unmit : null, actual:(e.amount || 0) + absorbed, valid});
  }
  return makeFight({key:code + '-' + fightId, name, duration, players:[...players.values()], hits, excluded});
}

// ヒットの列を攻撃ごとにまとめ、プレイヤーごとの元ダメージに集計する
function makeFight({key, name, duration, players, hits, excluded, sample}){
  hits.sort((a, b) => a.t - b.t);
  const open = new Map();
  const groups = [];
  const abilityTypes = {};
  for (const h of hits) {
    let g = open.get(h.abilityId);
    if (!g || h.t - g.last > CLUSTER_GAP) {
      g = {t:h.t, last:h.t, abilityId:h.abilityId, name:h.abilityName, hits:[]};
      groups.push(g); open.set(h.abilityId, g);
    }
    g.last = h.t; g.hits.push(h);
    if (!(h.abilityId in abilityTypes)) abilityTypes[h.abilityId] = h.abilityType === 128 ? 'phys' : h.abilityType === 1024 ? 'mag' : 'unique';
  }
  const casts = groups.map(g => {
    const vals = g.hits.filter(h => h.valid).map(h => h.unmit).sort((a, b) => a - b);
    const median = vals.length ? vals[Math.floor(vals.length / 2)] : null;
    const by = new Map();
    for (const h of g.hits) {
      if (!by.has(h.targetId)) by.set(h.targetId, {pid:h.targetId, raw:0, est:false, n:0, actual:0, missing:false});
      const o = by.get(h.targetId);
      o.n++; o.actual += h.actual;
      if (h.valid) o.raw += h.unmit;
      else if (median != null) { o.raw += median; o.est = true; }
      else o.missing = true;
    }
    const targets = [...by.values()].map(o => ({pid:o.pid, raw:o.missing ? null : Math.round(o.raw), est:o.est, n:o.n, actual:Math.round(o.actual)}));
    return {t:Math.round(g.t), abilityId:g.abilityId, name:g.name, nHits:g.hits.length, nExcl:g.hits.filter(h => !h.valid).length, targets};
  });
  return finishFight({key, name, duration, players, casts, abilityTypes, excluded, sample:!!sample});
}
function finishFight(f){
  f.playerMap = new Map(f.players.map(p => [p.id, p]));
  f.casts.forEach((c, i) => c.id = i);
  f.phases = cleanPhases(f.phases, f.duration);
  return f;
}

// 共有・保存用のコンパクトな形式
function packFight(f){
  return {key:f.key, name:f.name, duration:f.duration, excluded:f.excluded, sample:!!f.sample, manual:!!f.manual, phases:(f.phases || []).map(p => ({id:p.id, name:p.name, start:p.start})),
    players:f.players.map(p => ({id:p.id, name:p.name, job:p.job, role:p.role, maxHP:p.maxHP || 0})),
    abilityTypes:{...f.abilityTypes},
    casts:f.casts.map(c => [c.t, c.abilityId, c.name, c.nHits, c.nExcl, c.targets.map(x => [x.pid, x.raw, x.est ? 1 : 0, x.n, x.actual]), c.manual ? 1 : 0])};
}
function unpackFight(p){
  if (!p || !Array.isArray(p.players) || !Array.isArray(p.casts)) throw new Error('bad fight');
  return finishFight({key:String(p.key || 'imported'), name:String(p.name || '戦闘'), duration:+p.duration || 0, excluded:+p.excluded || 0, sample:!!p.sample, manual:!!p.manual, phases:p.phases,
    players:p.players.map(x => ({id:+x.id, name:String(x.name || '?'), job:String(x.job || ''), role:['tank','healer','dps'].includes(x.role) ? x.role : 'dps', maxHP:+x.maxHP || 0})),
    abilityTypes:Object.assign({}, p.abilityTypes || {}),
    casts:p.casts.map(c => ({t:+c[0], abilityId:c[1], name:String(c[2]), nHits:+c[3], nExcl:+c[4],
      targets:c[5].map(x => ({pid:+x[0], raw:x[1] == null ? null : +x[1], est:!!x[2], n:+x[3], actual:+x[4]})), manual:!!c[6]}))});
}

