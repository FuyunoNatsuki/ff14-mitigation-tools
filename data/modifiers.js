'use strict';
// 種族（部族）とジョブの補正値。STR・DEX・VIT・INT・MND（と最大HP）の計算に使います。
// 出典: Allagan Studies（https://www.akhmorning.com/allagan-studies/modifiers/clan/ と /modifiers/）。
// 種族の値はゲームデータ（XIVAPI の Tribe）とも照合しました。ローエンガルデの VIT だけ Allagan Studies が +2、
// ゲームデータが +3 で違うため、ゲームデータの +3 を使っています。

// 種族: [STR, DEX, VIT, INT, MND] の補正
window.MP_CLANS = [
  {id:'midlander',  ja:'ヒューラン（ミッドランダー）', mod:[ 2, -1,  0,  3, -1]},
  {id:'highlander', ja:'ヒューラン（ハイランダー）',   mod:[ 3,  0,  2, -2,  0]},
  {id:'wildwood',   ja:'エレゼン（フォレスター）',     mod:[ 0,  3, -1,  2, -1]},
  {id:'duskwight',  ja:'エレゼン（シェーダー）',       mod:[ 0,  0, -1,  3,  1]},
  {id:'plainsfolk', ja:'ララフェル（プレーンフォーク）', mod:[-1,  3, -1,  2,  0]},
  {id:'dunesfolk',  ja:'ララフェル（デューンフォーク）', mod:[-1,  1, -2,  2,  3]},
  {id:'sun',        ja:'ミコッテ（サンシーカー）',     mod:[ 2,  3,  0, -1, -1]},
  {id:'moon',       ja:'ミコッテ（ムーンキーパー）',   mod:[-1,  2, -2,  1,  3]},
  {id:'seawolf',    ja:'ルガディン（ゼーヴォルフ）',   mod:[ 2, -1,  3, -2,  1]},
  {id:'hellsguard', ja:'ルガディン（ローエンガルデ）', mod:[ 0, -2,  3,  0,  2]},
  {id:'raen',       ja:'アウラ（アウラ・レン）',       mod:[-1,  2, -1,  0,  3]},
  {id:'xaela',      ja:'アウラ（アウラ・ゼラ）',       mod:[ 3,  0,  2,  0, -2]},
  {id:'helion',     ja:'ロスガル（ヘリオン）',         mod:[ 3, -3,  3, -3,  3]},
  {id:'lost',       ja:'ロスガル（ロスト）',           mod:[ 3, -3,  3, -3,  3]},
  {id:'rava',       ja:'ヴィエラ（ラヴァ・ヴィエラ）', mod:[ 0,  3, -2,  1,  1]},
  {id:'veena',      ja:'ヴィエラ（ヴィナ・ヴィエラ）', mod:[-1,  0, -1,  3,  2]},
];
// メンバーの種族が決まっていないときの種族
window.MP_DEFAULT_CLAN = 'dunesfolk';

// ジョブの補正（%）: hp=最大HP、str/dex/vit/int/mnd=各能力値。最大HP = ⌊Lv の HP × hp ÷ 100⌋ + ⌊(VIT − main) × hpPerVit⌋
window.MP_JOB_MODS = {
  PLD:{hp:140, str:100, vit:110, dex:95,  int:60,  mnd:100},
  WAR:{hp:145, str:105, vit:110, dex:95,  int:40,  mnd:55},
  DRK:{hp:140, str:105, vit:110, dex:95,  int:60,  mnd:40},
  GNB:{hp:140, str:100, vit:110, dex:95,  int:60,  mnd:100},
  WHM:{hp:105, str:55,  vit:100, dex:105, int:105, mnd:115},
  SCH:{hp:105, str:90,  vit:100, dex:100, int:105, mnd:115},
  AST:{hp:105, str:50,  vit:100, dex:100, int:105, mnd:115},
  SGE:{hp:105, str:60,  vit:100, dex:100, int:115, mnd:115},
  MNK:{hp:110, str:110, vit:100, dex:105, int:50,  mnd:90},
  DRG:{hp:115, str:115, vit:105, dex:100, int:45,  mnd:65},
  NIN:{hp:108, str:85,  vit:100, dex:110, int:65,  mnd:75},
  SAM:{hp:109, str:112, vit:100, dex:108, int:60,  mnd:50},
  RPR:{hp:115, str:115, vit:105, dex:100, int:80,  mnd:40},
  VPR:{hp:111, str:100, vit:100, dex:110, int:45,  mnd:55},
  BRD:{hp:105, str:90,  vit:100, dex:115, int:85,  mnd:80},
  MCH:{hp:105, str:85,  vit:100, dex:115, int:80,  mnd:85},
  DNC:{hp:105, str:90,  vit:100, dex:115, int:85,  mnd:80},
  BLM:{hp:105, str:45,  vit:100, dex:100, int:115, mnd:75},
  SMN:{hp:105, str:90,  vit:100, dex:100, int:115, mnd:80},
  RDM:{hp:105, str:55,  vit:100, dex:105, int:115, mnd:110},
  PCT:{hp:105, str:50,  vit:100, dex:110, int:115, mnd:80},
};
