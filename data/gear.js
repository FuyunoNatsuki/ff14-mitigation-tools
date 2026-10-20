'use strict';
// ジョブごとの装備プリセット（メンバーのステータスが空欄のときの標準値）。
// https://fuucdayo.com/battle/8759/ の「Patch7.55 最終装備」の各ジョブの最初の装備パターンから作りました。
// サイトの数値は食事込みなので、ここでは食事の分を除いた「装備だけ」の値にしています（食事は food で選ぶ）。
// food は data/foods.js の id（サイトで使っている食事）。wd は武器の魔法性能（回復量の計算に使う）、wdPhys は物理性能。
// ten / pie は、その装備で上がっていなければ基準値（不屈 420、信仰 440）。
// 作り直すとき: tools/gear/gear-source.json を直してから node tools/gear/build-gear-data.mjs
window.MP_GEAR = {
  PLD: {"name":"Patch7.55 最終装備（GCD2.50 絶武器+PW盾）","source":"https://fuucdayo.com/gearset/8770/","weapon":"パラッツォダイヤ・ソード","ilvl":795,"food":"f49240","stats":{"vit":7574,"crit":3504,"det":2953,"dh":1338,"ss":420,"ten":600,"pie":440,"wd":79,"wdPhys":158}},
  WAR: {"name":"Patch7.55 最終装備（GCD2.50 PW）","source":"https://fuucdayo.com/gearset/8781/","weapon":"ファントムオカルタム・ウォーハンマー","ilvl":795,"food":"f49240","stats":{"vit":7574,"crit":3504,"det":2995,"dh":1230,"ss":420,"ten":676,"pie":440,"wd":79,"wdPhys":158}},
  DRK: {"name":"Patch7.55 最終装備（GCD2.50 PW）","source":"https://fuucdayo.com/gearset/8756/","weapon":"ファントムオカルタム・ディバイダー","ilvl":795,"food":"f49240","stats":{"vit":7574,"crit":3504,"det":2995,"dh":1230,"ss":420,"ten":676,"pie":440,"wd":79,"wdPhys":158}},
  GNB: {"name":"Patch7.55 最終装備（GCD2.50 PW）","source":"https://fuucdayo.com/gearset/8780/","weapon":"ファントムオカルタム・ガンブレード","ilvl":795,"food":"f49240","stats":{"vit":7574,"crit":3504,"det":2995,"dh":1230,"ss":420,"ten":676,"pie":440,"wd":79,"wdPhys":158}},
  WHM: {"name":"Patch7.55 最終装備（GCD2.30 PW）","source":"https://fuucdayo.com/gearset/8793/","weapon":"ファントムオカルタム・ケーン","ilvl":795,"food":"f49244","stats":{"vit":6822,"crit":3276,"det":2468,"dh":528,"ss":1985,"ten":420,"pie":588,"mnd":6838,"wd":158,"wdPhys":158}},
  SCH: {"name":"Patch7.55 最終装備（GCD2.40 PW）","source":"https://fuucdayo.com/gearset/8787/","weapon":"ファントムオカルタム・コーデックス","ilvl":795,"food":"f49240","stats":{"vit":6822,"crit":3276,"det":2915,"dh":852,"ss":1214,"ten":420,"pie":588,"mnd":6838,"wd":158,"wdPhys":158}},
  AST: {"name":"Patch7.55 最終装備（GCD2.42 PW）","source":"https://fuucdayo.com/gearset/8789/","weapon":"ファントムオカルタム・スターグローブ","ilvl":795,"food":"f49240","stats":{"vit":6822,"crit":3249,"det":3090,"dh":852,"ss":1066,"ten":420,"pie":588,"mnd":6838,"wd":158,"wdPhys":158}},
  SGE: {"name":"Patch7.55 最終装備（GCD2.39 PW 記憶指）","source":"https://fuucdayo.com/gearset/8797/","weapon":"ファントムオカルタム・ペンデュラム","ilvl":795,"food":"f49244","stats":{"vit":6798,"crit":3263,"det":3014,"dh":906,"ss":1214,"ten":420,"pie":440,"mnd":6817,"wd":158,"wdPhys":158}},
  MNK: {"name":"Patch7.55 最終装備（GCD1.94 PW）","source":"https://fuucdayo.com/gearset/8791/","weapon":"ファントムオカルタム・トンファー","ilvl":795,"food":"f49240","stats":{"vit":7528,"crit":3514,"det":2139,"dh":1767,"ss":985,"ten":420,"pie":440,"wd":79,"wdPhys":158}},
  DRG: {"name":"Patch7.55 最終装備（GCD2.50 PW）","source":"https://fuucdayo.com/gearset/8774/","weapon":"ファントムオカルタム・スピア","ilvl":795,"food":"f49240","stats":{"vit":7551,"crit":3514,"det":2435,"dh":2036,"ss":420,"ten":420,"pie":440,"wd":79,"wdPhys":158}},
  NIN: {"name":"Patch7.55 最終装備（GCD2.12 PW）","source":"https://fuucdayo.com/gearset/8783/","weapon":"ファントムオカルタム・ナイフ","ilvl":795,"food":"f49240","stats":{"vit":7528,"crit":3514,"det":2456,"dh":2015,"ss":420,"ten":420,"pie":440,"wd":79,"wdPhys":158}},
  SAM: {"name":"Patch7.55 最終装備（GCD2.14 PW）","source":"https://fuucdayo.com/gearset/8785/","weapon":"ファントムオカルタム・ブレード","ilvl":795,"food":"f49240","stats":{"vit":7528,"crit":3514,"det":2355,"dh":1847,"ss":689,"ten":420,"pie":440,"wd":79,"wdPhys":158}},
  RPR: {"name":"Patch7.55 最終装備（GCD2.49 PW）","source":"https://fuucdayo.com/gearset/8772/","weapon":"ファントムオカルタム・ウォーサイズ","ilvl":795,"food":"f49240","stats":{"vit":7551,"crit":3514,"det":2435,"dh":1982,"ss":474,"ten":420,"pie":440,"wd":79,"wdPhys":158}},
  VPR: {"name":"Patch7.55 最終装備（GCD2.12 PW）","source":"https://fuucdayo.com/gearset/8771/","weapon":"ファントムオカルタム・ツインファング","ilvl":795,"food":"f49240","stats":{"vit":7528,"crit":3514,"det":2456,"dh":2015,"ss":420,"ten":420,"pie":440,"wd":79,"wdPhys":158}},
  BRD: {"name":"Patch7.55 最終装備（GCD2.49 PW）","source":"https://fuucdayo.com/gearset/8778/","weapon":"ファントムオカルタム・ハープボウ","ilvl":795,"food":"f49240","stats":{"vit":7528,"crit":3494,"det":2614,"dh":1823,"ss":474,"ten":420,"pie":440,"wd":79,"wdPhys":158}},
  MCH: {"name":"Patch7.55 最終装備（GCD2.50 PW）","source":"https://fuucdayo.com/gearset/8768/","weapon":"ファントムオカルタム・リボルバー","ilvl":795,"food":"f49240","stats":{"vit":7528,"crit":3494,"det":2614,"dh":1877,"ss":420,"ten":420,"pie":440,"wd":79,"wdPhys":158}},
  DNC: {"name":"Patch7.55 最終装備（GCD2.50 PW）","source":"https://fuucdayo.com/gearset/8767/","weapon":"ファントムオカルタム・ファン","ilvl":795,"food":"f49240","stats":{"vit":7528,"crit":3494,"det":2614,"dh":1877,"ss":420,"ten":420,"pie":440,"wd":79,"wdPhys":158}},
  BLM: {"name":"Patch7.55 最終装備（GCD2.14）","source":"https://fuucdayo.com/gearset/8765/","weapon":"ファントムオカルタム・スタッフ","ilvl":795,"food":"f49243","stats":{"vit":6822,"crit":780,"det":2290,"dh":2039,"ss":3296,"ten":420,"pie":440,"wd":158,"wdPhys":158}},
  SMN: {"name":"Patch7.55 最終装備（GCD2.48 PW）","source":"https://fuucdayo.com/gearset/8795/","weapon":"ファントムオカルタム・インデックス","ilvl":795,"food":"f49240","stats":{"vit":6822,"crit":3457,"det":2298,"dh":2122,"ss":528,"ten":420,"pie":440,"wd":158,"wdPhys":158}},
  RDM: {"name":"Patch7.55 最終装備（GCD2.50 PW）","source":"https://fuucdayo.com/gearset/8766/","weapon":"ファントムオカルタム・デーゲン","ilvl":795,"food":"f49240","stats":{"vit":6822,"crit":3457,"det":2298,"dh":2230,"ss":420,"ten":420,"pie":440,"wd":158,"wdPhys":158}},
  PCT: {"name":"Patch7.55 最終装備（GCD2.50 PW）","source":"https://fuucdayo.com/gearset/8764/","weapon":"ファントムオカルタム・ラウンドブラシ","ilvl":795,"food":"f49240","stats":{"vit":6822,"crit":3457,"det":2298,"dh":2230,"ss":420,"ten":420,"pie":440,"wd":158,"wdPhys":158}}
};
