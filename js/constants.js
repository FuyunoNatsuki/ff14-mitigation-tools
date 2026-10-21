'use strict';
// ジョブと軽減の定数（data/ のファイルを読み込んだあとに使う）

// ===== ジョブ（data/job-data.js から。読めなかったときの最低限の値）=====
const JOB_DATA = (window.MP_JOB_DATA && typeof window.MP_JOB_DATA === 'object') ? window.MP_JOB_DATA : {};
// スキルとジョブのアイコン：公式のもの（data/icons.js）に、data/job-data.js の MP_ACTION_ICONS の差し替えを重ねる
const OFFICIAL_ICONS = (window.MP_OFFICIAL_ICONS && typeof window.MP_OFFICIAL_ICONS === 'object') ? window.MP_OFFICIAL_ICONS : {};
const ACTION_ICONS = {...OFFICIAL_ICONS.actions, ...((window.MP_ACTION_ICONS && typeof window.MP_ACTION_ICONS === 'object') ? window.MP_ACTION_ICONS : {})};
const JOB_ICONS = OFFICIAL_ICONS.jobs || {};
const JOB_ORDER = ['PLD','WAR','DRK','GNB','WHM','SCH','AST','SGE','MNK','DRG','NIN','SAM','RPR','VPR','BRD','MCH','DNC','BLM','SMN','RDM','PCT'];
const ROLE_FALLBACK = {PLD:'tank',WAR:'tank',DRK:'tank',GNB:'tank',WHM:'healer',SCH:'healer',AST:'healer',SGE:'healer',
  MNK:'melee',DRG:'melee',NIN:'melee',SAM:'melee',RPR:'melee',VPR:'melee',BRD:'ranged',MCH:'ranged',DNC:'ranged',BLM:'caster',SMN:'caster',RDM:'caster',PCT:'caster'};
for (const j of JOB_ORDER) if (!JOB_DATA[j]) JOB_DATA[j] = {ja:j, abbr:j[0], role:ROLE_FALLBACK[j], hp:0, crit:0, det:0, ten:420, pie:0, ss:0};
// 装備プリセット（data/gear.js）の値を、ジョブの標準ステータスにする（食事の分は含まない）
const GEAR = (typeof window.MP_GEAR === 'object' && window.MP_GEAR) || {};
for (const j of JOB_ORDER) { const g = GEAR[j]; if (g && g.stats) Object.assign(JOB_DATA[j], g.stats, {food:g.food, gearName:g.name, gearAttrs:g.gearAttrs || null}); }
// 種族とジョブの補正（data/modifiers.js）。能力値は STR・DEX・VIT・INT・MND の順
const ATTR_KEYS = ['str', 'dex', 'vit', 'int', 'mnd'];
const CLANS = Array.isArray(window.MP_CLANS) ? window.MP_CLANS : [];
const CLAN = Object.fromEntries(CLANS.map(c => [c.id, c]));
const DEFAULT_CLAN = CLAN[window.MP_DEFAULT_CLAN] ? window.MP_DEFAULT_CLAN : ((CLANS[0] || {}).id || '');
const JOB_MODS = (window.MP_JOB_MODS && typeof window.MP_JOB_MODS === 'object') ? window.MP_JOB_MODS : {};
// スキルのゲーム内ID（data/action-ids.js）から、スキルの id を引く（ログで使われたスキルを見分ける）
// スキルの id → ゲーム内ID の一覧、HoT・バリアの効果（Status）のゲーム内ID の一覧（FF Logs では 1000000 を足した番号）
const SKILL_GAME_IDS = (window.MP_ACTION_IDS && typeof window.MP_ACTION_IDS === 'object') ? window.MP_ACTION_IDS : {};
const SKILL_STATUS_IDS = (window.MP_STATUS_IDS && typeof window.MP_STATUS_IDS === 'object') ? window.MP_STATUS_IDS : {};
const SKILL_BY_GAME_ID = new Map();
for (const [id, list] of Object.entries(window.MP_ACTION_IDS || {})) if (Array.isArray(list)) for (const g of list) SKILL_BY_GAME_ID.set(g, id);
// 食事（data/foods.js）
const FOODS = Array.isArray(window.MP_FOODS) ? window.MP_FOODS : [];
const FOOD = Object.fromEntries(FOODS.map(f => [f.id, f]));
const FOOD_STATS = new Set(['crit', 'det', 'dh', 'ss', 'ten', 'pie']);
const JOB_FROM_LOG = {Paladin:'PLD',Warrior:'WAR',DarkKnight:'DRK',Gunbreaker:'GNB',WhiteMage:'WHM',Scholar:'SCH',Astrologian:'AST',Sage:'SGE',
  Monk:'MNK',Dragoon:'DRG',Ninja:'NIN',Samurai:'SAM',Reaper:'RPR',Viper:'VPR',Bard:'BRD',Machinist:'MCH',Dancer:'DNC',
  BlackMage:'BLM',Summoner:'SMN',RedMage:'RDM',Pictomancer:'PCT'};
const DEFAULT_COMP = ['PLD','WAR','WHM','SCH','MNK','DRG','BRD','BLM'];
const SLOT_IDS = ['m1','m2','m3','m4','m5','m6','m7','m8'];
const STAT_KEYS = ['hp','vit','crit','det','ten','pie','ss','def','mdef','mnd','wd','hpp'];
const STAT_LABEL = {hp:'最大HP', vit:'VIT', crit:'クリ', det:'意思', ten:'不屈', pie:'信仰', ss:'SS', def:'物理防御', mdef:'魔法防御', mnd:'精神', wd:'武器(魔)', hpp:'回復係数'};
const roleGroup = r => r === 'tank' ? 'tank' : r === 'healer' ? 'healer' : 'dps';
const ROLE_ORDER = {tank:0, healer:1, melee:2, ranged:3, caster:4};
const FALLBACK_HP = {tank:290000, healer:170000, dps:175000};
// レベルごとの定数（data/job-data.js の MP_LEVEL。読めなかったときは Lv100 の値）
const LV = Object.assign({main:440, sub:420, div:2780, hmp:268, hp:4000, hpPerVit:{tank:43, other:30.1}, partyBonus:5,
  attr:{tank:100, healer:115, melee:100, ranged:100, caster:100}, trait:{tank:100, healer:130, melee:100, ranged:100, caster:100}},
  (typeof window.MP_LEVEL === 'object' && window.MP_LEVEL) || {});
const TEN_SUB = LV.sub, TEN_DIV = LV.div; // サブステータスの基準値と除数（不屈・防御力・クリティカルの計算に使う）

// ===== スキル（data/mitigations.js の軽減と data/heals.js のヒール・バリアを、ID で引けるようにしたもの）=====
// tab: 'mit' は「軽減」タブ、'heal' は「ヒール・バリア」タブに並ぶ。回復の効果も持つ軽減は MIT_HEAL_EXTRAS で足す
const HEAL_LIST = typeof HEALS !== 'undefined' ? HEALS : [];
const HEAL_EXTRAS = typeof MIT_HEAL_EXTRAS !== 'undefined' ? MIT_HEAL_EXTRAS : {};
const MIT = Object.fromEntries([
  ...MITS.map(m => ({...m, ...(HEAL_EXTRAS[m.id] || {}), tab:'mit'})),
  ...HEAL_LIST.map(h => ({p:0, m:0, ...h, tab:'heal'})),
].map((m, i) => [m.id, {...m, order:i}]));
const ACTIONS = Object.values(MIT);
// 回復・バリア・回復アップの効果があるか（HP の推移の計算に使う）
const hasHealEffect = d => !!(d && (d.heal || d.hot || d.shield || d.healUp || d.recv || d.recit || d.ns || d.trigger));
const TYPE_LABEL = {phys:'物理', mag:'魔法', unique:'特殊'};
const CLUSTER_GAP = 1000; // ms
