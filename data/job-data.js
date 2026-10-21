// Mitigation Planner のジョブ別データ。
// メンバーのステータスや最大HPが空欄のときは、ここの値を使います。
// ※ クリ・意思・不屈・信仰・SS・精神・武器・防御は、data/gear.js（装備プリセット。etro.gg の各部位の値から積み上げたもの）の値が優先されます。
//   最大HPは、装備プリセットの VIT（種族の補正とパーティボーナス込み）から下の MP_LEVEL の式で出します。
//   ここの hp は、その式が使えないときだけ使う目安です。
// 値は Lv100（パッチ7.x）の零式装備を想定した目安です。パッチや装備に合わせて書き換えてください。
//
//   hp   : 最大HP（ログにHPがあるメンバーはログの値を優先します）
//   crit : クリティカル   det : 意思力   ten : 不屈   pie : 信仰   ss : スキルスピード／スペルスピード
//   mnd  : 精神（回復魔法力）  wd : 武器の魔法性能。どちらも 0 は「未設定」
//          メンバーに精神と武器の魔法性能が入っていれば、回復量は記事どおりの式（下の MP_LEVEL を使う）で計算します。
//          入っていなければ、代わりに hpp（回復係数）で簡易計算します。
//   hpp  : 回復係数（威力1あたりの回復量の目安。精神・武器を入れないときだけ使う）
//   def  : 物理防御力     mdef : 魔法防御力（data/gear.js の装備プリセットの値が優先されます）
//
// 被ダメージの計算に使うのは hp・ten（不屈）・def・mdef、回復・バリアの計算に使うのは hpp・det（意思力）・crit です。
// 物理防御・魔法防御の標準値は、装備プリセットの各部位の値を etro.gg から取って足したものです（data/gear.js）。
window.MP_JOB_DATA = {
  // ----- タンク -----
  PLD: {ja:'ナイト',         abbr:'ナ', role:'tank',   hp:296000, crit:3174, det:2310, ten:868, pie:440, ss:420, def:0, mdef:0, hpp:45, mnd:0, wd:0},
  WAR: {ja:'戦士',           abbr:'戦', role:'tank',   hp:298000, crit:3174, det:2310, ten:868, pie:440, ss:420, def:0, mdef:0, hpp:45, mnd:0, wd:0},
  DRK: {ja:'暗黒騎士',       abbr:'暗', role:'tank',   hp:296000, crit:3174, det:2310, ten:868, pie:440, ss:420, def:0, mdef:0, hpp:45, mnd:0, wd:0},
  GNB: {ja:'ガンブレイカー', abbr:'ガ', role:'tank',   hp:296000, crit:3174, det:2310, ten:868, pie:440, ss:420, def:0, mdef:0, hpp:45, mnd:0, wd:0},
  // ----- ヒーラー -----
  WHM: {ja:'白魔道士',       abbr:'白', role:'healer', hp:178000, crit:3226, det:2196, ten:420, pie:912, ss:612, def:0, mdef:0, hpp:50, mnd:0, wd:0},
  SCH: {ja:'学者',           abbr:'学', role:'healer', hp:178000, crit:3226, det:2196, ten:420, pie:912, ss:612, def:0, mdef:0, hpp:50, mnd:0, wd:0},
  AST: {ja:'占星術師',       abbr:'占', role:'healer', hp:178000, crit:3226, det:2196, ten:420, pie:912, ss:612, def:0, mdef:0, hpp:50, mnd:0, wd:0},
  SGE: {ja:'賢者',           abbr:'賢', role:'healer', hp:178000, crit:3226, det:2196, ten:420, pie:912, ss:612, def:0, mdef:0, hpp:50, mnd:0, wd:0},
  // ----- 近接DPS -----
  MNK: {ja:'モンク',         abbr:'モ', role:'melee',  hp:185000, crit:3214, det:2210, ten:420, pie:440, ss:640, def:0, mdef:0, hpp:45, mnd:0, wd:0},
  DRG: {ja:'竜騎士',         abbr:'竜', role:'melee',  hp:185000, crit:3214, det:2210, ten:420, pie:440, ss:420, def:0, mdef:0, hpp:45, mnd:0, wd:0},
  NIN: {ja:'忍者',           abbr:'忍', role:'melee',  hp:182000, crit:3214, det:2210, ten:420, pie:440, ss:420, def:0, mdef:0, hpp:45, mnd:0, wd:0},
  SAM: {ja:'侍',             abbr:'侍', role:'melee',  hp:185000, crit:3214, det:2210, ten:420, pie:440, ss:640, def:0, mdef:0, hpp:45, mnd:0, wd:0},
  RPR: {ja:'リーパー',       abbr:'リ', role:'melee',  hp:185000, crit:3214, det:2210, ten:420, pie:440, ss:420, def:0, mdef:0, hpp:45, mnd:0, wd:0},
  VPR: {ja:'ヴァイパー',     abbr:'ヴ', role:'melee',  hp:182000, crit:3214, det:2210, ten:420, pie:440, ss:640, def:0, mdef:0, hpp:45, mnd:0, wd:0},
  // ----- 遠隔物理DPS -----
  BRD: {ja:'吟遊詩人',       abbr:'詩', role:'ranged', hp:180000, crit:3214, det:2210, ten:420, pie:440, ss:420, def:0, mdef:0, hpp:45, mnd:0, wd:0},
  MCH: {ja:'機工士',         abbr:'機', role:'ranged', hp:180000, crit:3214, det:2210, ten:420, pie:440, ss:420, def:0, mdef:0, hpp:45, mnd:0, wd:0},
  DNC: {ja:'踊り子',         abbr:'踊', role:'ranged', hp:180000, crit:3214, det:2210, ten:420, pie:440, ss:420, def:0, mdef:0, hpp:45, mnd:0, wd:0},
  // ----- 遠隔魔法DPS -----
  BLM: {ja:'黒魔道士',       abbr:'黒', role:'caster', hp:176000, crit:3214, det:2210, ten:420, pie:440, ss:840, def:0, mdef:0, hpp:45, mnd:0, wd:0},
  SMN: {ja:'召喚士',         abbr:'召', role:'caster', hp:176000, crit:3214, det:2210, ten:420, pie:440, ss:420, def:0, mdef:0, hpp:45, mnd:0, wd:0},
  RDM: {ja:'赤魔道士',       abbr:'赤', role:'caster', hp:176000, crit:3214, det:2210, ten:420, pie:440, ss:420, def:0, mdef:0, hpp:45, mnd:0, wd:0},
  PCT: {ja:'ピクトマンサー', abbr:'ピ', role:'caster', hp:176000, crit:3214, det:2210, ten:420, pie:440, ss:420, def:0, mdef:0, hpp:45, mnd:0, wd:0},
};

// スキルのアイコンは data/icons.js の公式アイコンを使います。別の画像に差し替えたいときは、スキルのIDと画像URLを書きます。
// 例: reprisal: 'icons/reprisal.png',
// スキルのIDは data/mitigations.js の MITS と data/heals.js の HEALS を見てください。
window.MP_ACTION_ICONS = {
};

// 回復量の計算式で使うレベルごとの定数（https://sarachantubuyaki.jp/column/detailed-explanation-of-the-heel-calculation-formula の式）。
//   main / sub / div : メインステータス・サブステータスの基準値と除数（Lv100 は 440 / 420 / 2780。Allagan Studies の Level Modifiers と一致）
//   hmp   : f(回復魔法力) の係数。f(HMP) = ⌊100 × (精神 − main) ÷ hmp⌋ + 100
//           ※ Lv100 の値は確認できていません。記事にある Lv90 の値（268）を仮に入れています。
//             ゲーム内の実際の回復量と比べて合わない場合は、ここを直してください。
//   attr  : ジョブの能力補正（精神）。f(武器) = ⌊main × attr ÷ 1000 + 武器の魔法性能⌋。ヒーラーは 115、それ以外は目安
//   trait : 特性による回復量の補正（%）。ヒーラーは 130（アクションダメージ・回復量アップII）
//   hp / hpPerVit : 最大HP = ⌊hp × ジョブのHP補正 ÷ 100⌋ + ⌊(VIT − main) × hpPerVit⌋（ジョブのHP補正は data/modifiers.js）。
//           Lv100 の値は xivgear（https://github.com/xiv-gear-planner/gear-planner の xivconstants.ts、検証済みとされている値）。
//           Allagan Studies の Level Modifiers には Lv71 以降の HP の値が載っていません
//   partyBonus : パーティボーナス（%）。ロールがそろったパーティで STR・DEX・VIT・INT・MND が上がる分
window.MP_LEVEL = {
  main: 440, sub: 420, div: 2780,
  hmp: 268,
  hp: 4000,
  hpPerVit: {tank: 43, other: 30.1},
  partyBonus: 5,
  attr:  {tank: 100, healer: 115, melee: 100, ranged: 100, caster: 100},
  trait: {tank: 100, healer: 130, melee: 100, ranged: 100, caster: 100},
};
