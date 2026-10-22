'use strict';
// 戦闘データの組み立て（ログ→攻撃一覧）、保存用の形式

// ログの攻撃の種類（FF Logs の ability.type）を、物理・魔法・特殊に分ける
const typeOfLog = t => +t === 128 ? 'phys' : +t === 1024 ? 'mag' : 'unique';

// FF Logs のイベント配列から攻撃一覧を作る。
// 元ダメージは「防御力を計上する前」の値にして持つ：ログの元ダメージ（受けた人の防御力の分が引かれた値とみなす）を、
// その人のジョブの装備プリセットの防御力の倍率で割り戻す
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
    // 被弾直前の HP（ログの HP は被弾したあとの値なので、受けた分を足す）
    const hpAfter = e.targetResources && e.targetResources.hitPoints;
    const hpb = Number.isFinite(hpAfter) && mhp ? Math.min(mhp, hpAfter + (e.amount || 0)) : null;
    // 被弾直前の HP 以上のダメージなのに生き残った（無敵・ギミックなど、ツールにない効果）
    const sv = hpb != null && hpAfter > 0 && (e.amount || 0) >= hpb;
    if (mhp && mhp > pl.maxHP) pl.maxHP = mhp;
    let unmit = e.unmitigatedAmount;
    if (unmit == null && e.multiplier) unmit = (e.amount + (e.absorbed || 0)) / e.multiplier;
    const absorbed = e.absorbed || 0;
    // バリアで吸収されたヒットは元ダメージのサンプルとして使わない
    const valid = unmit != null && absorbed <= 0;
    if (!valid) excluded++;
    const ab = abilities.get(e.abilityGameID);
    const src = actors.get(e.sourceID);
    hits.push({t:e.timestamp - startTime, abilityId:e.abilityGameID, abilityName:ab ? ab.name : ('#' + e.abilityGameID),
      abilityType:ab ? +ab.type : 0, targetId:tgt.id, src:src ? src.name : String(e.sourceID), hpb, sv,
      unmit:valid ? unmit / logDefMul(pl, typeOfLog(ab && ab.type)) : null, actual:(e.amount || 0) + absorbed, valid});
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
      g = {t:h.t, last:h.t, abilityId:h.abilityId, name:h.abilityName, src:h.src, hits:[]};
      groups.push(g); open.set(h.abilityId, g);
    }
    g.last = h.t; g.hits.push(h);
    if (!(h.abilityId in abilityTypes)) abilityTypes[h.abilityId] = typeOfLog(h.abilityType);
  }
  // 攻撃ごとの元ダメージ（防御力を計上する前）の中央値
  for (const g of groups) {
    const vals = g.hits.filter(h => h.valid).map(h => h.unmit).sort((a, b) => a - b);
    g.median = vals.length ? vals[Math.floor(vals.length / 2)] : null;
  }
  // バリアで全員のダメージが吸収されて元ダメージがない攻撃は、同じ敵の同じ攻撃（別のタイミング）のうち、
  // 時刻がいちばん近いものの中央値を使う
  for (const g of groups) {
    if (g.median != null || sample) continue;
    let ref = null;
    for (const o of groups) if (o !== g && o.median != null && o.abilityId === g.abilityId && o.src === g.src && (!ref || Math.abs(o.t - g.t) < Math.abs(ref.t - g.t))) ref = o;
    if (ref) { g.median = ref.median; g.from = Math.round(ref.t); }
  }
  const casts = groups.map(g => {
    const median = g.median;
    const by = new Map();
    for (const h of g.hits) {
      if (!by.has(h.targetId)) by.set(h.targetId, {pid:h.targetId, raw:0, est:false, n:0, actual:0, missing:false, hpb:h.hpb == null ? null : h.hpb, sv:false});
      const o = by.get(h.targetId);
      o.n++; o.actual += h.actual; if (h.sv) o.sv = true;
      if (h.valid) o.raw += h.unmit;
      else if (median != null) { o.raw += median; o.est = true; }
      else o.missing = true;
    }
    const targets = [...by.values()].map(o => ({pid:o.pid, raw:o.missing ? null : Math.round(o.raw), est:o.est, n:o.n, actual:Math.round(o.actual), hpb:o.hpb, ...(o.sv ? {sv:true} : {})}));
    const c = {t:Math.round(g.t), abilityId:g.abilityId, name:g.name, nHits:g.hits.length, nExcl:g.hits.filter(h => !h.valid).length, targets};
    if (g.from != null) c.from = g.from;
    return c;
  });
  return finishFight({key, name, duration, players, casts, abilityTypes, excluded, sample:!!sample});
}
function finishFight(f){
  // 元ダメージは防御力を計上する前の値（古い形式は unpackFight で直してから渡す）
  f.defBase = true;
  f.playerMap = new Map(f.players.map(p => [p.id, p]));
  f.casts.forEach((c, i) => c.id = i);
  f.phases = cleanPhases(f.phases, f.duration);
  return f;
}

// 共有・保存用のコンパクトな形式
function packFight(f){
  return {key:f.key, name:f.name, duration:f.duration, excluded:f.excluded, sample:!!f.sample, manual:!!f.manual, defBase:1, phases:(f.phases || []).map(p => ({id:p.id, name:p.name, start:p.start})),
    players:f.players.map(p => ({id:p.id, name:p.name, job:p.job, role:p.role, maxHP:p.maxHP || 0})),
    abilityTypes:{...f.abilityTypes},
    casts:f.casts.map(c => [c.t, c.abilityId, c.name, c.nHits, c.nExcl, c.targets.map(x => [x.pid, x.raw, x.est ? 1 : 0, x.n, x.actual, x.hpb == null ? null : x.hpb, x.sv ? 1 : 0]), c.manual ? 1 : 0, c.from == null ? null : c.from])};
}
function unpackFight(p){
  if (!p || !Array.isArray(p.players) || !Array.isArray(p.casts)) throw new Error('bad fight');
  const f = {key:String(p.key || 'imported'), name:String(p.name || '戦闘'), duration:+p.duration || 0, excluded:+p.excluded || 0, sample:!!p.sample, manual:!!p.manual, phases:p.phases,
    players:p.players.map(x => ({id:+x.id, name:String(x.name || '?'), job:String(x.job || ''), role:['tank','healer','dps'].includes(x.role) ? x.role : 'dps', maxHP:+x.maxHP || 0})),
    abilityTypes:Object.assign({}, p.abilityTypes || {}),
    casts:p.casts.map(c => ({t:+c[0], abilityId:c[1], name:String(c[2]), nHits:+c[3], nExcl:+c[4],
      targets:c[5].map(x => ({pid:+x[0], raw:x[1] == null ? null : +x[1], est:!!x[2], n:+x[3], actual:+x[4], hpb:Number.isFinite(x[5]) ? +x[5] : null, ...(x[6] ? {sv:true} : {})})), manual:!!c[6],
      ...(Number.isFinite(c[7]) ? {from:+c[7]} : {})}))};
  // 古い形式（ログの元ダメージをそのまま持っていたもの）は、防御力を計上する前の値に直す。手入力の攻撃はそのまま
  if (!p.defBase) {
    const byId = new Map(f.players.map(x => [x.id, x]));
    for (const c of f.casts) if (!c.manual) {
      const type = typeOfLog({phys:128, mag:1024}[f.abilityTypes[c.abilityId]]);
      for (const x of c.targets) if (x.raw != null) x.raw = Math.round(x.raw / logDefMul(byId.get(x.pid), type));
    }
  }
  return finishFight(f);
}

