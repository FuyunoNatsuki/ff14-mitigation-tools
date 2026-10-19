'use strict';
// ジョブと軽減の定数（data/ のファイルを読み込んだあとに使う）

// ===== ジョブ（data/job-data.js から。読めなかったときの最低限の値）=====
const JOB_DATA = (window.MP_JOB_DATA && typeof window.MP_JOB_DATA === 'object') ? window.MP_JOB_DATA : {};
const ACTION_ICONS = (window.MP_ACTION_ICONS && typeof window.MP_ACTION_ICONS === 'object') ? window.MP_ACTION_ICONS : {};
const JOB_ORDER = ['PLD','WAR','DRK','GNB','WHM','SCH','AST','SGE','MNK','DRG','NIN','SAM','RPR','VPR','BRD','MCH','DNC','BLM','SMN','RDM','PCT'];
const ROLE_FALLBACK = {PLD:'tank',WAR:'tank',DRK:'tank',GNB:'tank',WHM:'healer',SCH:'healer',AST:'healer',SGE:'healer',
  MNK:'melee',DRG:'melee',NIN:'melee',SAM:'melee',RPR:'melee',VPR:'melee',BRD:'ranged',MCH:'ranged',DNC:'ranged',BLM:'caster',SMN:'caster',RDM:'caster',PCT:'caster'};
for (const j of JOB_ORDER) if (!JOB_DATA[j]) JOB_DATA[j] = {ja:j, abbr:j[0], role:ROLE_FALLBACK[j], hp:0, crit:0, det:0, ten:420, pie:0, ss:0};
const JOB_FROM_LOG = {Paladin:'PLD',Warrior:'WAR',DarkKnight:'DRK',Gunbreaker:'GNB',WhiteMage:'WHM',Scholar:'SCH',Astrologian:'AST',Sage:'SGE',
  Monk:'MNK',Dragoon:'DRG',Ninja:'NIN',Samurai:'SAM',Reaper:'RPR',Viper:'VPR',Bard:'BRD',Machinist:'MCH',Dancer:'DNC',
  BlackMage:'BLM',Summoner:'SMN',RedMage:'RDM',Pictomancer:'PCT'};
const DEFAULT_COMP = ['PLD','WAR','WHM','SCH','MNK','DRG','BRD','BLM'];
const SLOT_IDS = ['m1','m2','m3','m4','m5','m6','m7','m8'];
const STAT_KEYS = ['hp','crit','det','ten','pie','ss','def','mdef'];
const STAT_LABEL = {hp:'最大HP', crit:'クリ', det:'意思', ten:'不屈', pie:'信仰', ss:'SS', def:'物理防御', mdef:'魔法防御'};
const roleGroup = r => r === 'tank' ? 'tank' : r === 'healer' ? 'healer' : 'dps';
const ROLE_ORDER = {tank:0, healer:1, melee:2, ranged:3, caster:4};
const FALLBACK_HP = {tank:290000, healer:170000, dps:175000};
const TEN_SUB = 420, TEN_DIV = 2780; // Lv100 の不屈の基準値と除数（防御力の計算にも同じ除数を使う）

// ===== 軽減（data/mitigations.js の MITS を、ID で引けるようにしたもの）=====
const MIT =Object.fromEntries(MITS.map((m, i) => [m.id, {...m, order:i}]));
const TYPE_LABEL = {phys:'物理', mag:'魔法', unique:'特殊'};
const CLUSTER_GAP = 1000; // ms
