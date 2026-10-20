// Mitigation Planner のジョブ別データ。
// メンバーのステータスや最大HPが空欄のときは、ここの値を使います。
// 値は Lv100（パッチ7.x）の零式装備を想定した目安です。パッチや装備に合わせて書き換えてください。
//
//   hp   : 最大HP（ログにHPがあるメンバーはログの値を優先します）
//   crit : クリティカル   det : 意思力   ten : 不屈   pie : 信仰   ss : スキルスピード／スペルスピード
//   hpp  : 回復係数（威力1あたりの回復量。意思力・クリティカルの分は別に掛ける）。回復とバリアの計算に使います
//   def  : 物理防御力     mdef : 魔法防御力（0 は「未設定」。防御力の軽減を入れる設定でも、0 のジョブには掛かりません）
//
// 被ダメージの計算に使うのは hp・ten（不屈）・def・mdef、回復・バリアの計算に使うのは hpp・det（意思力）・crit です。
// 防御力は装備によって大きく変わるので、標準値は 0（未設定）にしています。使う場合は装備の値を入れてください。
window.MP_JOB_DATA = {
  // ----- タンク -----
  PLD: {ja:'ナイト',         abbr:'ナ', role:'tank',   hp:296000, crit:3174, det:2310, ten:868, pie:440, ss:420, def:0, mdef:0, hpp:45},
  WAR: {ja:'戦士',           abbr:'戦', role:'tank',   hp:298000, crit:3174, det:2310, ten:868, pie:440, ss:420, def:0, mdef:0, hpp:45},
  DRK: {ja:'暗黒騎士',       abbr:'暗', role:'tank',   hp:296000, crit:3174, det:2310, ten:868, pie:440, ss:420, def:0, mdef:0, hpp:45},
  GNB: {ja:'ガンブレイカー', abbr:'ガ', role:'tank',   hp:296000, crit:3174, det:2310, ten:868, pie:440, ss:420, def:0, mdef:0, hpp:45},
  // ----- ヒーラー -----
  WHM: {ja:'白魔道士',       abbr:'白', role:'healer', hp:178000, crit:3226, det:2196, ten:420, pie:912, ss:612, def:0, mdef:0, hpp:50},
  SCH: {ja:'学者',           abbr:'学', role:'healer', hp:178000, crit:3226, det:2196, ten:420, pie:912, ss:612, def:0, mdef:0, hpp:50},
  AST: {ja:'占星術師',       abbr:'占', role:'healer', hp:178000, crit:3226, det:2196, ten:420, pie:912, ss:612, def:0, mdef:0, hpp:50},
  SGE: {ja:'賢者',           abbr:'賢', role:'healer', hp:178000, crit:3226, det:2196, ten:420, pie:912, ss:612, def:0, mdef:0, hpp:50},
  // ----- 近接DPS -----
  MNK: {ja:'モンク',         abbr:'モ', role:'melee',  hp:185000, crit:3214, det:2210, ten:420, pie:440, ss:640, def:0, mdef:0, hpp:45},
  DRG: {ja:'竜騎士',         abbr:'竜', role:'melee',  hp:185000, crit:3214, det:2210, ten:420, pie:440, ss:420, def:0, mdef:0, hpp:45},
  NIN: {ja:'忍者',           abbr:'忍', role:'melee',  hp:182000, crit:3214, det:2210, ten:420, pie:440, ss:420, def:0, mdef:0, hpp:45},
  SAM: {ja:'侍',             abbr:'侍', role:'melee',  hp:185000, crit:3214, det:2210, ten:420, pie:440, ss:640, def:0, mdef:0, hpp:45},
  RPR: {ja:'リーパー',       abbr:'リ', role:'melee',  hp:185000, crit:3214, det:2210, ten:420, pie:440, ss:420, def:0, mdef:0, hpp:45},
  VPR: {ja:'ヴァイパー',     abbr:'ヴ', role:'melee',  hp:182000, crit:3214, det:2210, ten:420, pie:440, ss:640, def:0, mdef:0, hpp:45},
  // ----- 遠隔物理DPS -----
  BRD: {ja:'吟遊詩人',       abbr:'詩', role:'ranged', hp:180000, crit:3214, det:2210, ten:420, pie:440, ss:420, def:0, mdef:0, hpp:45},
  MCH: {ja:'機工士',         abbr:'機', role:'ranged', hp:180000, crit:3214, det:2210, ten:420, pie:440, ss:420, def:0, mdef:0, hpp:45},
  DNC: {ja:'踊り子',         abbr:'踊', role:'ranged', hp:180000, crit:3214, det:2210, ten:420, pie:440, ss:420, def:0, mdef:0, hpp:45},
  // ----- 遠隔魔法DPS -----
  BLM: {ja:'黒魔道士',       abbr:'黒', role:'caster', hp:176000, crit:3214, det:2210, ten:420, pie:440, ss:840, def:0, mdef:0, hpp:45},
  SMN: {ja:'召喚士',         abbr:'召', role:'caster', hp:176000, crit:3214, det:2210, ten:420, pie:440, ss:420, def:0, mdef:0, hpp:45},
  RDM: {ja:'赤魔道士',       abbr:'赤', role:'caster', hp:176000, crit:3214, det:2210, ten:420, pie:440, ss:420, def:0, mdef:0, hpp:45},
  PCT: {ja:'ピクトマンサー', abbr:'ピ', role:'caster', hp:176000, crit:3214, det:2210, ten:420, pie:440, ss:420, def:0, mdef:0, hpp:45},
};

// 軽減アイコンの画像を差し替えたいときは、軽減のIDと画像URLを書きます（空ならツール独自のアイコン）。
// 例: reprisal: 'icons/reprisal.png',
// 軽減のIDは data/mitigations.js の MITS を見てください。
window.MP_ACTION_ICONS = {
};
