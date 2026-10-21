'use strict';
// 分:秒の入力欄（class="tfield"）の書式
//   入力中：数字と「:」「.」だけにする（全角は半角に）。「:」を打たずに数字を3桁以上続けると、下2桁を秒にして「:」を入れる
//           （123 → 1:23、1234 → 12:34）。「.」のあとは1桁（0.1秒）まで
//   確定時：「分:秒.0」の形にそろえる（60秒以上は分に繰り上げる。data-tfmt="whole" の欄は「分:秒」）。読めない値は赤枠にする
// 確定時の整形は、各欄の change の処理より先に行う（document のキャプチャで受ける）

function maskTime(v){
  v = String(v).replace(/[０-９：．]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/[^\d:.]/g, '');
  const dot = v.indexOf('.');
  let main = dot >= 0 ? v.slice(0, dot) : v;
  const dec = dot >= 0 ? v.slice(dot + 1).replace(/\D/g, '').slice(0, 1) : null;
  const colon = main.indexOf(':');
  if (colon < 0) {
    if (main.length >= 3) main = main.slice(0, -2) + ':' + main.slice(-2);
  } else {
    const m = main.slice(0, colon).replace(/\D/g, ''), s = main.slice(colon + 1).replace(/\D/g, '');
    // 秒が3桁以上になったら、数字を詰め直して下2桁を秒にする（1:234 → 12:34）
    main = s.length > 2 ? (m + s).slice(0, -2) + ':' + (m + s).slice(-2) : m + ':' + s;
  }
  return main + (dec != null ? '.' + dec : '');
}
function formatTimeField(el){
  const raw = el.value.trim();
  if (!raw) { el.classList.remove('invalid'); return; }
  const v = parseT(raw);
  const ok = v != null && v >= 0;
  el.classList.toggle('invalid', !ok);
  if (!ok) return;
  if (el.dataset.tfmt === 'whole') { const s = Math.round(v); el.value = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  else el.value = fmtT(Math.round(v * 10) / 10);
}
document.addEventListener('input', ev => {
  const el = ev.target;
  if (!el.classList || !el.classList.contains('tfield')) return;
  const v = maskTime(el.value);
  if (v !== el.value) { el.value = v; el.setSelectionRange(v.length, v.length); }
  el.classList.remove('invalid');
});
document.addEventListener('change', ev => { if (ev.target.classList && ev.target.classList.contains('tfield')) formatTimeField(ev.target); }, true);
