'use strict';
// ヒール・バリアのスキル一覧（「ヒール・バリア」タブに並ぶもの）。数値はパッチ7.xの目安です。違っていたら直してください。
// id はプランの保存に使うので変えないでください。abbr はアイコンの略称、jobs は使えるジョブです。
//
//   kind   : party=全員 / single=味方1人 / self=自分
//   d      : タイムライン上のバーの長さ（秒）。r : リキャスト（秒）
//   heal   : 即時回復の威力
//   hot    : {pot: 1回あたりの威力, dur: 秒}（3秒ごとに回復）
//   shield : {pct: 回復量に対する割合} / {pot: 威力} / {hpPct: 最大HPに対する割合, of: 'caster' か 'target'}、shieldDur: 秒
//   delay  : 使ってから効果が出るまでの秒数
//   healUp : 使った人の回復魔法の効果アップ（0.2 = +20%）、recv : 対象の被回復アップ。buffDur : その効果の秒数
//   recit  : 秘策（次の対象スキルがクリティカル確定）。recitable : 秘策の対象
//   catalyze : クリティカルのとき、回復量の180%のバリアを追加（鼓舞激励の策）
//   ns     : ニュートラルセクト中に、回復量に対してこの割合のバリアを追加
//   trigger: {pot: 威力, under: 0.5, dur: 秒}。効果時間中に HP が最大HPの under を下回った瞬間に回復し、
//            下回らなければ効果時間の終わりに回復する（深謀遠慮の策・シャドウヴィジル・ハート・オブ・コランダム）
const HEALS = [
  // ----- 白魔道士 -----
  {id:'medica3',  abbr:'メ3', name:'メディガ',                 jobs:['WHM'], kind:'party',  d:15, r:2.5, heal:250, hot:{pot:175, dur:15}},
  {id:'cure3',    abbr:'ケガ', name:'ケアルガ',                 jobs:['WHM'], kind:'party',  d:3,  r:2.5, heal:600},
  {id:'rapture',  abbr:'ラプ', name:'ハート・オブ・ラプチャー', jobs:['WHM'], kind:'party',  d:3,  r:2.5, heal:400},
  {id:'assize',   abbr:'アサ', name:'アサイズ',                 jobs:['WHM'], kind:'party',  d:3,  r:40,  heal:400},
  {id:'asylum',   abbr:'アサ', name:'アサイラム',               jobs:['WHM'], kind:'party',  d:24, r:90,  hot:{pot:100, dur:24}},
  {id:'tetra',    abbr:'テト', name:'テトラグラマトン',         jobs:['WHM'], kind:'single', d:3,  r:60,  heal:700, charges:2},
  {id:'regen',    abbr:'リジ', name:'リジェネ',                 jobs:['WHM'], kind:'single', d:18, r:2.5, hot:{pot:250, dur:18}},
  {id:'benison',  abbr:'ベニ', name:'ディヴァインベニゾン',     jobs:['WHM'], kind:'single', d:15, r:30,  shield:{pot:500}, shieldDur:15, charges:2},
  {id:'caress',   abbr:'カレ', name:'ディヴァインカレス',       jobs:['WHM'], kind:'party',  d:10, r:1,   shield:{pot:400}, shieldDur:10, hot:{pot:200, dur:10}},
  // ----- 学者 -----
  {id:'recit',    abbr:'秘策', name:'秘策',                     jobs:['SCH'], kind:'self',   d:15, r:60,  recit:true},
  {id:'adlo',     abbr:'鼓舞', name:'鼓舞激励の策',             jobs:['SCH'], kind:'single', d:30, r:2.5, heal:300, shield:{pct:1.8}, shieldDur:30, recitable:true, catalyze:true},
  {id:'concit',   abbr:'意気', name:'意気軒昂の策',             jobs:['SCH'], kind:'party',  d:30, r:2.5, heal:200, shield:{pct:1.8}, shieldDur:30, recitable:true},
  {id:'indom',    abbr:'不撓', name:'不撓不屈の策',             jobs:['SCH'], kind:'party',  d:3,  r:30,  heal:400, recitable:true},
  {id:'excog',    abbr:'深謀', name:'深謀遠慮の策',             jobs:['SCH'], kind:'single', d:45, r:45,  trigger:{pot:800, under:0.5, dur:45}, recitable:true},
  {id:'lustrate', abbr:'活性', name:'生命活性法',               jobs:['SCH'], kind:'single', d:3,  r:1,   heal:600},
  {id:'whisper',  abbr:'囁き', name:'光の囁き',                 jobs:['SCH'], kind:'party',  d:21, r:60,  hot:{pot:80, dur:21}},
  {id:'blessing', abbr:'祝福', name:'フェイブレッシング',       jobs:['SCH'], kind:'party',  d:3,  r:60,  heal:320},
  {id:'consol',   abbr:'コン', name:'コンソレイション',         jobs:['SCH'], kind:'party',  d:30, r:30,  heal:250, shield:{pot:250}, shieldDur:30, charges:2},
  // ----- 占星術師 -----
  {id:'ns',       abbr:'NS',   name:'ニュートラルセクト',       jobs:['AST'], kind:'self',   d:20, r:120, healUp:0.2, buffDur:20},
  {id:'hconj',    abbr:'ヘコ', name:'コンジャンクション・ヘリオス', jobs:['AST'], kind:'party', d:15, r:2.5, heal:250, hot:{pot:175, dur:15}, ns:1.25},
  {id:'abenefic', abbr:'アベ', name:'アスペクト・ベネフィク',   jobs:['AST'], kind:'single', d:15, r:2.5, heal:250, hot:{pot:250, dur:15}, ns:2.5},
  {id:'helios',   abbr:'ヘリ', name:'ヘリオス',                 jobs:['AST'], kind:'party',  d:3,  r:2.5, heal:400},
  {id:'benefic2', abbr:'ベネ', name:'ベネフィラ',               jobs:['AST'], kind:'single', d:3,  r:2.5, heal:800},
  {id:'essdig',   abbr:'星天', name:'星天開門',                 jobs:['AST'], kind:'single', d:3,  r:40,  heal:400, charges:3},
  {id:'intersect',abbr:'交差', name:'星天交差',                 jobs:['AST'], kind:'single', d:30, r:30,  heal:200, shield:{pot:400}, shieldDur:30, charges:2},
  {id:'opposit',  abbr:'対抗', name:'星天対抗',                 jobs:['AST'], kind:'party',  d:15, r:60,  heal:200, hot:{pot:100, dur:15}},
  {id:'star',     abbr:'星',   name:'アーサリースター',         jobs:['AST'], kind:'party',  d:10, r:60,  heal:720, delay:10},
  // ----- 賢者 -----
  {id:'eprog',    abbr:'Eプ', name:'エウクラシア・プログノシスII', jobs:['SGE'], kind:'party', d:30, r:2.5, heal:100, shield:{pct:3.6}, shieldDur:30},
  {id:'ediag',    abbr:'Eデ', name:'エウクラシア・ディアグノシス', jobs:['SGE'], kind:'single', d:30, r:2.5, heal:300, shield:{pct:1.8}, shieldDur:30},
  {id:'prog',     abbr:'プロ', name:'プログノシス',             jobs:['SGE'], kind:'party',  d:3,  r:2.5, heal:300},
  {id:'diag',     abbr:'ディ', name:'ディアグノシス',           jobs:['SGE'], kind:'single', d:3,  r:2.5, heal:450},
  {id:'ixo',      abbr:'イク', name:'イックソコレ',             jobs:['SGE'], kind:'party',  d:3,  r:30,  heal:400},
  {id:'physis',   abbr:'ピュ', name:'ピュシスII',               jobs:['SGE'], kind:'party',  d:15, r:60,  hot:{pot:130, dur:15}, recv:0.1, buffDur:10},
  {id:'haima',    abbr:'ハイ', name:'ハイマ',                   jobs:['SGE'], kind:'single', d:15, r:120, shield:{pot:300}, shieldDur:15},
  {id:'panhaima', abbr:'パン', name:'パンハイマ',               jobs:['SGE'], kind:'party',  d:15, r:120, shield:{pot:200}, shieldDur:15},
  {id:'pneuma',   abbr:'プネ', name:'プネウマ',                 jobs:['SGE'], kind:'party',  d:3,  r:120, heal:600},
  // ----- タンク -----
  {id:'shake',    abbr:'シェ', name:'シェイクオフ',             jobs:['WAR'], kind:'party',  d:30, r:90,  shield:{hpPct:0.15, of:'target'}, shieldDur:30},
  {id:'dveil',    abbr:'ヴェ', name:'ディヴァインヴェール',     jobs:['PLD'], kind:'party',  d:30, r:90,  heal:400, shield:{hpPct:0.10, of:'caster'}, shieldDur:30},
  {id:'tbn',      abbr:'TBN', name:'ブラックナイト',            jobs:['DRK'], kind:'single', d:7,  r:15,  shield:{hpPct:0.25, of:'caster'}, shieldDur:7},
  // ----- DPS -----
  {id:'waltz',    abbr:'ワル', name:'癒やしのワルツ',             jobs:['DNC'], kind:'party',  d:3,  r:60,  heal:300},
  {id:'minne',    abbr:'ミン', name:'地神のミンネ',             jobs:['BRD'], kind:'party',  d:15, r:120, recv:0.15, buffDur:15},
  {id:'mantra',   abbr:'マン', name:'マントラ',                 jobs:['MNK'], kind:'party',  d:15, r:90,  recv:0.1, buffDur:15},
  // DPS の自己バリア・パーティバリア（最大HPに対する割合）
  {id:'crest',    abbr:'クレ', name:'アルケインクレスト',         jobs:['RPR'], kind:'self',   d:5,  r:30,  shield:{hpPct:0.10, of:'target'}, shieldDur:5},
  {id:'improv',   abbr:'イン', name:'インプロビゼーション・フィニッシュ', jobs:['DNC'], kind:'party', d:30, r:120, shield:{hpPct:0.10, of:'target'}, shieldDur:30},
  {id:'tcoat',    abbr:'コト', name:'テンペラコート',             jobs:['PCT'], kind:'self',   d:10, r:120, shield:{hpPct:0.20, of:'target'}, shieldDur:10},
  {id:'tgrassa',  abbr:'グラ', name:'テンペラグラッサ',           jobs:['PCT'], kind:'party',  d:10, r:120, shield:{hpPct:0.10, of:'target'}, shieldDur:10},
  {id:'aegis',    abbr:'守光', name:'守りの光',                   jobs:['SMN'], kind:'self',   d:30, r:60,  shield:{hpPct:0.20, of:'target'}, shieldDur:30, charges:2},
  {id:'manaward', abbr:'マバ', name:'マバリア',                   jobs:['BLM'], kind:'self',   d:20, r:120, shield:{hpPct:0.30, of:'target'}, shieldDur:20},
  {id:'secondwind',abbr:'内丹', name:'内丹',                    jobs:['MNK','DRG','NIN','SAM','RPR','VPR','BRD','MCH','DNC'], kind:'self', d:3, r:120, heal:800},
];

// 軽減タブにあるスキルのうち、回復・バリア・回復アップの効果も持つもの（軽減率は data/mitigations.js 側）
const MIT_HEAL_EXTRAS = {
  guardian:   {shield:{pot:1000}, shieldDur:15},
  temperance: {healUp:0.2, buffDur:20},
  soil:       {hot:{pot:100, dur:15}},
  cu:         {hot:{pot:100, dur:15}},
  exalt:      {heal:500, delay:8},
  kera:       {hot:{pot:100, dur:15}},
  holos:      {heal:300, shield:{pot:300}, shieldDur:30},
  tauro:      {heal:700},
  vigil:      {trigger:{pot:1200, under:0.5, dur:20}},
  corundum:   {trigger:{pot:900, under:0.5, dur:20}},
};
