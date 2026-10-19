'use strict';
// 画面全体で使う状態と小さな道具（保存・書式・エスケープなど）

// ===== 状態 =====
// fight: {key, name, duration(ms), players:[], playerMap, casts:[{id,t,abilityId,name,nHits,nExcl,targets:[{pid,raw,est,n,actual}]}], abilityTypes:{}, excluded, sample}
let fight = null;
let plan = [];          // {uid, mitId, t(sec), caster:'m1'..|null, target:'all'|'m1'..., custom?:{name,p,m,d}}
let members = [];       // 8枠 {id, job, name, pid, hp, crit, det, ten, pie, ss}（0 = 標準値）
let partySize = 8;
let overrides = {};     // 攻撃キー -> 元ダメージ（1人あたり）
let selCast = null, selEntry = null, openRows = new Set();
let settings = {trait:false, ten:true, def:false, zoom:8, minDmg:30000, scope:'all'};
let readOnly = false;

const $ = id => document.getElementById(id);
const store = {
  get(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e) { return null; } },
  set(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} },
  del(k){ try { localStorage.removeItem(k); } catch(e) {} },
};
const fmt = n => Math.round(n).toLocaleString('ja-JP');
const fmtT = s => { const neg = s < 0; s = Math.abs(s); const m = Math.floor(s / 60); const r = s - m * 60;
  return (neg ? '-' : '') + m + ':' + (r < 10 ? '0' : '') + r.toFixed(1); };
const parseT = str => { str = String(str).trim(); const mm = str.match(/^(-?)(\d+):(\d+(?:\.\d+)?)$/);
  if (mm) return (mm[1] ? -1 : 1) * (+mm[2] * 60 + +mm[3]); const n = parseFloat(str); return isFinite(n) ? n : null; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
const setStatus = (msg, cls = '') => { const el = $('status'); el.textContent = msg; el.className = 'status ' + cls; };
const clampNum = (v, lo, hi, dflt) => { v = +v; return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt; };
