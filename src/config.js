// Configuração geral do jogo: times, classes, monstros, dificuldade, progressão, armaduras e economia.
// Os valores seguem docs/SKILLS.md.

export const TEAM = { BLUE: 0, RED: 1, NEUTRAL: 2 };
export const TEAM_NAME = ['Azul', 'Vermelho', 'Monstros'];
export const TEAM_HEX = [0x3a86ff, 0xff3b30, 0xbfbfbf];
export const TEAM_TINT = [0x9fbcff, 0xffa49a, 0xffffff];
export const TEAM_GLOW = [0x0a2a7a, 0x7a120a, 0x000000];
export const TEAM_CSS = ['b', 'r', 'n'];

export const SETTINGS = {
  scoreToWin: 2,
  teamSize: 6,
  difficulty: 'normal',
};

export const DIFFICULTY = {
  easy:   { botDamage: 0.6, botAccuracy: 0.55, botReaction: 0.9, botAggro: 0.8, botSkill: 0.5, botFirePause: 1.4 },
  normal: { botDamage: 0.85, botAccuracy: 0.72, botReaction: 0.6, botAggro: 1.0, botSkill: 0.8, botFirePause: 1.0 },
  hard:   { botDamage: 1.0, botAccuracy: 0.88, botReaction: 0.35, botAggro: 1.15, botSkill: 1.0, botFirePause: 0.7 },
};

// Altura dos personagens KayKit ~2.4 unidades. 1 unidade ~ 0.75 m.
export const EYE_HEIGHT = 2.05;
export const CHAR_RADIUS = 0.6;
export const RESPAWN_TIME = 7;
export const PRINCESS_RETURN_TIME = 25;
export const MAX_FAT = 5;

// ------------------------------------------------------------------ classes
// armor: armadura própria da classe (soma com capacete e peitoral). Redução de dano = armadura / (armadura + 100).
// block: fração do dano frontal anulada pelo bloqueio. rmb: 'block', 'zoom' (Arqueira) ou 'march' (Invocador).
// canCarry: false = não pode pegar a princesa.
export const CLASSES = {
  knight: {
    key: 'knight', name: 'Cavaleiro', icon: '🛡️', hotkey: 1,
    model: 'Knight', hp: 160, speed: 6.6, carry: 0.86, canCarry: true, backpack: 4, armor: 45,
    weapon: 'sword_1handed', offhand: 'shield_round_color', block: 0.75, rmb: 'block', idle: 'Idle_A',
    desc: 'Linha de frente. Bloqueia com o escudo, avança sobre o inimigo e inspira os aliados.',
    stats: 'Armadura pesada · Corpo a corpo',
    attack: { type: 'melee', name: 'Golpe', icon: '🗡️', damage: 30, range: 3.4, arc: 1.25, cooldown: 0.6, hitDelay: 0.2, anim: 'Melee_1H_Attack_Slice_Diagonal', swing: 'slash' },
  },
  barbarian: {
    key: 'barbarian', name: 'Bárbaro', icon: '🪓', hotkey: 2,
    model: 'Barbarian', hp: 190, speed: 6.2, carry: 0.9, canCarry: true, backpack: 4, armor: 30,
    weapon: 'axe_2handed', offhand: null, block: 0.5, rmb: 'block', idle: 'Melee_2H_Idle',
    desc: 'Força bruta. Golpes lentos e devastadores, fúria e machado arremessado.',
    stats: 'Vida muito alta · Dano alto',
    attack: { type: 'melee', name: 'Machadada', icon: '🪓', damage: 50, range: 3.7, arc: 1.6, cooldown: 1.0, hitDelay: 0.38, anim: 'Melee_2H_Attack_Chop', swing: 'chop', heavy: true },
  },
  ranger: {
    key: 'ranger', name: 'Arqueira', icon: '🏹', hotkey: 3,
    model: 'Ranger', hp: 95, speed: 7.3, carry: 0.86, canCarry: true, backpack: 4, armor: 15,
    weapon: 'bow_withString', offhand: null, offhandSide: 'l', block: 0, rmb: 'zoom', idle: 'Ranged_Bow_Idle',
    desc: 'Mata de longe. Segure o botão para tensionar o arco. Armadilhas e flechas teleguiadas.',
    stats: 'Armadura leve · Longo alcance',
    attack: { type: 'arrow', name: 'Flecha', icon: '🏹', damageMin: 16, damageMax: 58, chargeTime: 1.0, speed: 75, cooldown: 0.35, anim: 'Ranged_Bow_Release', swing: 'shoot' },
  },
  mage: {
    key: 'mage', name: 'Maga', icon: '🔮', hotkey: 4,
    model: 'Mage', hp: 90, speed: 6.9, carry: 0.86, canCarry: true, backpack: 4, armor: 10,
    weapon: 'staff', offhand: null, block: 0.5, rmb: 'block', idle: 'Idle_B',
    desc: 'Dano mágico em área: fogo, gelo, escudo arcano, teleporte e meteoro.',
    stats: 'Armadura leve · Dano em área',
    attack: { type: 'fireball', name: 'Bola de fogo', icon: '🔥', damage: 26, splash: 3.2, speed: 34, cooldown: 0.85, anim: 'Ranged_Magic_Shoot', swing: 'cast' },
  },
  rogue: {
    key: 'rogue', name: 'Ladino', icon: '🗡️', hotkey: 5,
    model: 'Rogue_Hooded', hp: 105, speed: 8.4, carry: 0, canCarry: false, backpack: 4, armor: 15,
    weapon: 'dagger', offhand: 'dagger', block: 0.5, rmb: 'block', idle: 'Idle_A',
    desc: 'Rápido e furtivo. Facadas pelas costas causam dano triplo. Não pode carregar a princesa.',
    stats: 'Muito rápido · Assassino',
    attack: { type: 'melee', name: 'Facada', icon: '🔪', damage: 20, range: 2.9, arc: 1.0, cooldown: 0.34, hitDelay: 0.12, backstab: 3, anim: 'Melee_Dualwield_Attack_Stab', swing: 'stab' },
  },
  halberdier: {
    key: 'halberdier', name: 'Alabardeiro', icon: '🔱', hotkey: 6,
    model: 'Knight', hp: 140, speed: 6.5, carry: 0.86, canCarry: true, backpack: 4, armor: 40,
    weapon: 'halberd', offhand: null, block: 0.5, rmb: 'block', idle: 'Melee_2H_Idle', hideOffhand: true,
    desc: 'Alcance longo com a alabarda. Segura a linha, puxa inimigos e protege quem carrega a princesa.',
    stats: 'Armadura pesada · Alcance longo',
    attack: { type: 'melee', name: 'Estocada', icon: '🔱', damage: 34, range: 4.6, arc: 0.7, cooldown: 0.8, hitDelay: 0.25, anim: 'Melee_2H_Attack_Stab', swing: 'thrust' },
  },
  swordsman: {
    key: 'swordsman', name: 'Espadachim', icon: '⚔️', hotkey: 7,
    model: 'Rogue', hp: 115, speed: 7.6, carry: 0.86, canCarry: true, backpack: 4, armor: 25,
    weapon: 'sword_A', offhand: null, block: 0.5, rmb: 'block', idle: 'Idle_A',
    desc: 'Duelista rápido. Apara golpes, faz combos e deixa os inimigos sangrando.',
    stats: 'Rápido · Dano constante',
    attack: { type: 'melee', name: 'Golpe rápido', icon: '⚔️', damage: 22, range: 3.2, arc: 1.2, cooldown: 0.45, hitDelay: 0.14, anim: 'Melee_1H_Attack_Slice_Horizontal', swing: 'slash' },
  },
  priest: {
    key: 'priest', name: 'Sacerdote', icon: '✨', hotkey: 8,
    model: 'Mage', hp: 110, speed: 6.8, carry: 0.86, canCarry: true, backpack: 4, armor: 25,
    weapon: 'staff', offhand: 'shield_badge_color', block: 0.5, rmb: 'block', idle: 'Idle_B', hideHat: true,
    desc: 'Cura e protege os aliados. A luz sagrada cura amigos e fere inimigos. Ressuscita aliados caídos.',
    stats: 'Suporte · Cura',
    attack: { type: 'holy', name: 'Raio sagrado', icon: '☀️', damage: 12, heal: 10, speed: 36, range: 30, cooldown: 1.0, anim: 'Ranged_Magic_Shoot', swing: 'cast' },
  },
  merchant: {
    key: 'merchant', name: 'Mercador', icon: '💰', hotkey: 9,
    model: 'Barbarian', hp: 110, speed: 6.8, carry: 0, canCarry: false, backpack: 10, armor: 20,
    weapon: 'hammer_B', offhand: null, block: 0.5, rmb: 'block', idle: 'Idle_A', hideOffhand: true,
    desc: 'Economia do time. Minera, fabrica armas e armaduras, vende na banca e constrói obras no castelo. Não carrega a princesa.',
    stats: 'Suporte · Economia',
    attack: { type: 'coin', name: 'Moeda', icon: '🪙', damage: 12, speed: 40, range: 20, cooldown: 0.6, anim: 'Throw', swing: 'throw' },
  },
  summoner: {
    key: 'summoner', name: 'Invocador', icon: '💀', hotkey: 0,
    model: 'Rogue_Hooded', hp: 100, speed: 6.8, carry: 0, canCarry: false, backpack: 4, armor: 10,
    weapon: 'staff_B', offhand: 'spellbook_open', block: 0, rmb: 'march', idle: 'Idle_B',
    desc: 'Gera almas e invoca exércitos de esqueletos que avançam contra o inimigo. Não carrega a princesa.',
    stats: 'Invocações · Almas',
    attack: { type: 'link', name: 'Elo de almas', icon: '🔗', cooldown: 0, range: 15 },
  },
};
export const CLASS_KEYS = ['knight', 'barbarian', 'ranger', 'mage', 'rogue', 'halberdier', 'swordsman', 'priest', 'merchant', 'summoner'];

// kind: melee | ranged. proj: projétil dos ranged ('bolt' ou 'arrow'). model: modelo KayKit (se diferente da chave).
export const MONSTERS = {
  Skeleton_Warrior: { name: 'Esqueleto Guerreiro', hp: 130, speed: 5.4, damage: 22, range: 3.2, cooldown: 1.1, weapon: 'sword_A', anim: 'Melee_1H_Attack_Chop', kind: 'melee', xp: 60 },
  Skeleton_Minion:  { name: 'Esqueleto Lacaio',    hp: 70,  speed: 6.0, damage: 12, range: 2.8, cooldown: 0.8, weapon: 'hammer_B', anim: 'Melee_1H_Attack_Chop', kind: 'melee', xp: 30 },
  Skeleton_Rogue:   { name: 'Esqueleto Ladino',    hp: 80,  speed: 7.2, damage: 16, range: 2.8, cooldown: 0.6, weapon: 'dagger', anim: 'Melee_1H_Attack_Stab', kind: 'melee', xp: 40 },
  Skeleton_Mage:    { name: 'Esqueleto Mago',      hp: 75,  speed: 5.0, damage: 18, range: 18,  cooldown: 1.8, weapon: 'staff_B', anim: 'Ranged_Magic_Shoot', kind: 'ranged', proj: 'bolt', xp: 45 },
  Skeleton_Archer:  { name: 'Esqueleto Arqueiro',  hp: 65,  speed: 5.6, damage: 14, range: 22,  cooldown: 1.7, weapon: 'bow_withString', weaponSide: 'l', anim: 'Ranged_Bow_Release', kind: 'ranged', proj: 'arrow', xp: 40, model: 'Skeleton_Rogue' },
};

export const BOT_NAMES = [
  ['Sir Galvão', 'Dona Brites', 'Tristão', 'Isolda', 'Frei Bento', 'Lourenço', 'Matilde', 'Gaspar', 'Leonor'],
  ['Barão Rubro', 'Malaquias', 'Dona Urraca', 'Vasco Cruel', 'Brunilda', 'Torquato', 'Ximena', 'Rodrigo', 'Morgana'],
];

// ------------------------------------------------------------------ progressão
export const MAX_LEVEL = 10;
// XP total necessário para chegar a cada nível (índice = nível)
export const LEVEL_XP = [0, 0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700];
// As 5 skills já vêm liberadas. Cada nível dá 1 ponto: escolher o perk de uma skill ou, depois, evoluí-la (Nível II).
export const RANK2_CDR = 0.2;

export const XP = {
  kill: 100,
  feed: 50,
  returnPrincess: 40,
  rescue: 300,
  assist: 25,
  workDone: 80,
  resurrect: 60,
  structure: 100,
  healPer: 0.5, // XP por ponto de vida curado em aliados
  // Mercador
  sale: [10, 20, 30, 45, 60], // por raridade
  craft: [15, 20, 30, 45, 60],
  buyFromPlayer: 10,
  scrap: 5,
  upgrade: 12,
  mine: 8,
  forge: 40,
};

// ------------------------------------------------------------------ armaduras
export const ARMOR = {
  helmet: { name: 'Capacete', icon: '⛑️', basic: 5, rarity: [8, 12, 17, 23, 30], price: 0.6 },
  body: { name: 'Peitoral', icon: '🦺', basic: 10, rarity: [15, 22, 30, 40, 52], price: 0.8 },
};
export function armorReduction(armor) { return armor / (armor + 100); }

// ------------------------------------------------------------------ economia
export const GOLD = {
  passive: 1, // por segundo
  kill: 30,
  skeleton: 10,
  rescue: 150,
  coinMin: 10, coinMax: 25, coinRespawn: 45,
  chest: 100, chestRespawn: 120,
  dropPile: 25,
  vaultStart: 250,
};

export const RARITY = [
  { key: 'common', name: 'Comum', color: 0xf2f2f2, css: '#f2f2f2', dmg: 0.05, price: 50, discount: 6, overcharge: 5 },
  { key: 'uncommon', name: 'Incomum', color: 0x5fe36b, css: '#5fe36b', dmg: 0.10, price: 100, discount: 10, overcharge: 9 },
  { key: 'rare', name: 'Rara', color: 0x4aa0ff, css: '#4aa0ff', dmg: 0.15, price: 200, discount: 16, overcharge: 15 },
  { key: 'epic', name: 'Épica', color: 0xb76bff, css: '#b76bff', dmg: 0.22, price: 400, discount: 24, overcharge: 22 },
  { key: 'legendary', name: 'Lendária', color: 0xff9a2a, css: '#ff9a2a', dmg: 0.30, price: 800, discount: 35, overcharge: 32 },
];
export const LEVEL_MULT = [1.0, 1.25, 1.5, 1.75, 2.0]; // +1..+5

export const ATTRS = {
  hp: { name: 'Vida máxima', per: 8, fmt: (v) => `+${v} vida` },
  atkspd: { name: 'Velocidade de ataque', per: 0.03, fmt: (v) => `+${Math.round(v * 100)}% vel. de ataque` },
  move: { name: 'Velocidade de movimento', per: 0.02, fmt: (v) => `+${Math.round(v * 100)}% vel. de movimento` },
  leech: { name: 'Roubo de vida', per: 0.02, fmt: (v) => `${Math.round(v * 100)}% de roubo de vida` },
  cdr: { name: 'Recarga das skills', per: 0.03, fmt: (v) => `−${Math.round(v * 100)}% de recarga` },
  armor: { name: 'Armadura extra', per: 4, fmt: (v) => `+${v} de armadura` },
};
export const ATTR_KEYS = Object.keys(ATTRS);

export const PRICE_MODES = {
  discount: { name: 'Desconto', mult: 0.7 },
  normal: { name: 'Normal', mult: 1.0 },
  overcharge: { name: 'Sobrecarga', mult: 1.5 },
};

export const STALL = { slots: 12, vitrine: 8, shelf: 6, depot: 30, useRange: 6, sellRange: 4 };
export const WEAPON_GROUND_TIME = 30;

// ------------------------------------------------------------------ Mercador
export const MERCHANT = {
  energyMax: 100,
  regenOut: 0.5, regenIn: 1.0,
  pickupEnergy: 3,
  buyEnergy: 2,
  craftEnergy: { weapon: 20, helmet: 14, body: 18, syringe: 20 },
  craftTime: 3, outsideTimeMult: 1.5,
  remoteStallCost: 5,
  mineTime: 1.5, oreMin: 2, oreMax: 4, veinRespawn: 60,
};
/** Chance de cada raridade ao fabricar. luck = nível do mercador − 1 + 3 × melhorias de Sorte; cap = maior raridade liberada. */
export function rarityWeights(level, luckUpgrades, cap) {
  const luck = (level - 1) + 3 * luckUpgrades;
  const w = [Math.max(5, 60 - 4 * luck), 28 + luck, 10 + 2 * luck, cap >= 3 ? 2 + 0.8 * luck : 0, cap >= 4 ? 0.3 * luck : 0];
  const s = w.reduce((a, b) => a + b, 0);
  return w.map(x => x / s);
}
/** Oficina: melhorias individuais de cada mercador, pagas com o ouro do cofre. */
export const FORGE = {
  master: { name: 'Forja de mestre', desc: 'Libera a raridade Épica nas suas fabricações.', cost: 500 },
  legend: { name: 'Forja lendária', desc: 'Libera a raridade Lendária nas suas fabricações.', cost: 1000, req: 'master' },
  luck1: { name: 'Sorte do ferreiro I', desc: 'Aumenta a chance de raridades melhores.', cost: 250 },
  luck2: { name: 'Sorte do ferreiro II', desc: 'Aumenta mais a chance de raridades melhores.', cost: 500, req: 'luck1' },
  luck3: { name: 'Sorte do ferreiro III', desc: 'Chance máxima de raridades melhores.', cost: 800, req: 'luck2' },
  jeweler: { name: 'Ourives', desc: 'Aprimorar custa 30% menos energia e 1 minério a menos.', cost: 300 },
  refine: { name: 'Refino', desc: 'A aba Aprimorar também sobe a raridade das peças (energia e 3 minérios).', cost: 600, req: 'jeweler' },
  shelf: { name: 'Expositores extras', desc: `+${STALL.shelf} espaços de exposição na banca.`, cost: 300 },
};
export const FORGE_KEYS = Object.keys(FORGE);
export const freshForge = () => Object.fromEntries(FORGE_KEYS.map(k => [k, 0]));

/** Reino: melhorias globais compradas pelo mercador com o ouro do cofre. Valem para todos os jogadores do time.
 *  O preço sobe a cada nível: cost × growth^nível. */
export const BOOSTS = {
  hp: { name: 'Vigor', icon: '❤️', desc: '+6% de vida máxima', per: 0.06, fmt: (v) => `+${Math.round(v * 100)}% de vida` },
  atk: { name: 'Força', icon: '⚔️', desc: '+5% de dano', per: 0.05, fmt: (v) => `+${Math.round(v * 100)}% de dano` },
  armor: { name: 'Couraça', icon: '🛡️', desc: '+6 de armadura', per: 6, fmt: (v) => `+${v} de armadura` },
  speed: { name: 'Agilidade', icon: '👟', desc: '+3% de velocidade de movimento', per: 0.03, fmt: (v) => `+${Math.round(v * 100)}% de velocidade` },
};
export const BOOST_KEYS = Object.keys(BOOSTS);
export const BOOST_MAX = 5;
export const BOOST_COST = { base: 150, growth: 1.6 };
export function boostCost(level) { return level >= BOOST_MAX ? null : Math.round(BOOST_COST.base * Math.pow(BOOST_COST.growth, level) / 10) * 10; }

// ------------------------------------------------------------------ consumíveis
// Seringa: tira 1 nível de peso da sua princesa. O Ladino também pode contaminar um banquete com ela.
// Bomba: só o Ladino compra; plantada numa torre inimiga, a destrói sozinha após o pavio.
export const ITEMS = {
  syringe: { name: 'Seringa', icon: '💉', price: 120, max: 2, craftEnergy: 20, craftOre: 2, dropChance: 0.15, useRange: 4 },
  bomb: { name: 'Bomba', icon: '💣', price: 150, max: 1, plantTime: 1.5, fuse: 3, range: 4 },
};
/** Carroça do boticário: evento que deixa seringas perto das ruínas centrais. */
export const APOTHECARY = { first: 75, every: 150, syringes: 2, life: 60 };
/** Posto de suprimentos (skill 3 do Mercador). */
export const SUPPLY = { energy: 30, duration: 25, radius: 7, regen: 5, armor: 15 };

// ------------------------------------------------------------------ Invocador
export const SUMMONER = {
  soulsMax: 15,
  linkRate: 0.5, linkRange: 15,
  soulLife: 30, soulPickup: 2, harvestRange: 50,
  tombEvery: 30,
  marchCooldown: 25, marchDuration: 12, marchRadius: 15, marchSpeed: 0.4,
  limits: { minion: 4, warrior: 2, archer: 3, mage: 2 },
};

// obras do castelo: custo por nível [ouro, energia]
export const WORKS = {
  barracks: { name: 'Quartel', desc: 'Tempo de renascimento −1 s por nível (de 7 s até 4 s).', costs: [[250, 20], [500, 35], [900, 50]] },
  ossuary: { name: 'Ossuário', desc: '+1 no limite de cada tipo de invocação do Invocador por nível.', costs: [[300, 25], [700, 45]] },
  banner: { name: 'Estandarte', desc: '+10% de XP para todo o time por nível.', costs: [[300, 20], [600, 35], [1000, 50]] },
  towers: { name: 'Torres de defesa', desc: 'Torres do lado de fora do portão. Nível 1: uma torre. Nível 2: duas torres. Nível 3: 25 de dano e 500 de vida.', costs: [[400, 30], [700, 45], [1100, 60]] },
  treasury: { name: 'Tesouraria', desc: '+0,5 de ouro por segundo para cada jogador do time por nível.', costs: [[350, 25], [800, 45]] },
};
export const WORK_KEYS = Object.keys(WORKS);
export const WORK_TIME = 20;
export const TOWER = {
  range: 24, interval: 1.5,
  levels: [null, { damage: 15, hp: 300 }, { damage: 15, hp: 300 }, { damage: 25, hp: 500 }],
};
