// Configuração geral do jogo: times, classes, monstros, dificuldade, progressão e economia.
// Os valores seguem docs/SKILLS.md.

export const TEAM = { BLUE: 0, RED: 1, NEUTRAL: 2 };
export const TEAM_NAME = ['Azul', 'Vermelho', 'Monstros'];
export const TEAM_HEX = [0x4a8cff, 0xff5050, 0xbfbfbf];
export const TEAM_TINT = [0xc4d6ff, 0xffc8c0, 0xffffff];
export const TEAM_CSS = ['b', 'r', 'n'];

export const SETTINGS = {
  scoreToWin: 2,
  teamSize: 6,
  difficulty: 'normal',
};

export const DIFFICULTY = {
  easy:   { botDamage: 0.6, botAccuracy: 0.55, botReaction: 0.9, botAggro: 0.8, botSkill: 0.5 },
  normal: { botDamage: 0.85, botAccuracy: 0.75, botReaction: 0.55, botAggro: 1.0, botSkill: 0.8 },
  hard:   { botDamage: 1.05, botAccuracy: 0.92, botReaction: 0.3, botAggro: 1.15, botSkill: 1.0 },
};

// Altura dos personagens KayKit ~2.4 unidades. 1 unidade ~ 0.75 m.
export const EYE_HEIGHT = 2.05;
export const CHAR_RADIUS = 0.6;
export const RESPAWN_TIME = 7;
export const PRINCESS_RETURN_TIME = 25;
export const MAX_FAT = 5;

// ------------------------------------------------------------------ classes
// block: fração do dano frontal anulada pelo bloqueio (botão direito).
// rmb: 'block' (padrão), 'zoom' (Arqueira) ou 'modes' (Mercador de Almas: depende do modo).
// canCarry: false = não pode pegar a princesa.
export const CLASSES = {
  knight: {
    key: 'knight', name: 'Cavaleiro', icon: '🛡️', hotkey: 1,
    model: 'Knight', hp: 160, speed: 6.6, carry: 0.86, canCarry: true, backpack: 4,
    weapon: 'sword_1handed', offhand: 'shield_round_color', block: 0.75, rmb: 'block', idle: 'Idle_A',
    desc: 'Linha de frente. Bloqueia com o escudo, avança sobre o inimigo e inspira os aliados.',
    stats: 'Vida alta · Corpo a corpo',
    attack: { type: 'melee', name: 'Golpe', damage: 30, range: 3.4, arc: 1.25, cooldown: 0.6, hitDelay: 0.2, anim: 'Melee_1H_Attack_Slice_Diagonal', swing: 'slash' },
  },
  barbarian: {
    key: 'barbarian', name: 'Bárbaro', icon: '🪓', hotkey: 2,
    model: 'Barbarian', hp: 190, speed: 6.2, carry: 0.9, canCarry: true, backpack: 4,
    weapon: 'axe_2handed', offhand: null, block: 0.5, rmb: 'block', idle: 'Melee_2H_Idle',
    desc: 'Força bruta. Golpes lentos e devastadores, fúria e machado arremessado.',
    stats: 'Vida muito alta · Dano alto',
    attack: { type: 'melee', name: 'Machadada', damage: 50, range: 3.7, arc: 1.6, cooldown: 1.0, hitDelay: 0.38, anim: 'Melee_2H_Attack_Chop', swing: 'chop', heavy: true },
  },
  ranger: {
    key: 'ranger', name: 'Arqueira', icon: '🏹', hotkey: 3,
    model: 'Ranger', hp: 95, speed: 7.3, carry: 0.86, canCarry: true, backpack: 4,
    weapon: 'bow_withString', offhand: null, offhandSide: 'l', block: 0, rmb: 'zoom', idle: 'Ranged_Bow_Idle',
    desc: 'Mata de longe. Segure o botão para tensionar o arco. Armadilhas e flechas teleguiadas.',
    stats: 'Vida baixa · Longo alcance',
    attack: { type: 'arrow', name: 'Flecha', damageMin: 16, damageMax: 58, chargeTime: 1.0, speed: 75, cooldown: 0.35, anim: 'Ranged_Bow_Release', swing: 'shoot' },
  },
  mage: {
    key: 'mage', name: 'Maga', icon: '🔮', hotkey: 4,
    model: 'Mage', hp: 90, speed: 6.9, carry: 0.86, canCarry: true, backpack: 4,
    weapon: 'staff', offhand: null, block: 0.5, rmb: 'block', idle: 'Idle_B',
    desc: 'Bolas de fogo, cura, escudo arcano, teleporte e meteoro.',
    stats: 'Vida baixa · Suporte e área',
    attack: { type: 'fireball', name: 'Bola de fogo', damage: 26, splash: 3.2, speed: 34, cooldown: 0.85, anim: 'Ranged_Magic_Shoot', swing: 'cast' },
  },
  rogue: {
    key: 'rogue', name: 'Ladino', icon: '🗡️', hotkey: 5,
    model: 'Rogue_Hooded', hp: 105, speed: 8.4, carry: 0, canCarry: false, backpack: 4,
    weapon: 'dagger', offhand: 'dagger', block: 0.5, rmb: 'block', idle: 'Idle_A',
    desc: 'Rápido e furtivo. Facadas pelas costas causam dano triplo. Não pode carregar a princesa.',
    stats: 'Muito rápido · Assassino',
    attack: { type: 'melee', name: 'Facada', damage: 20, range: 2.9, arc: 1.0, cooldown: 0.34, hitDelay: 0.12, backstab: 3, anim: 'Melee_Dualwield_Attack_Stab', swing: 'stab' },
  },
  halberdier: {
    key: 'halberdier', name: 'Alabardeiro', icon: '🔱', hotkey: 6,
    model: 'Knight', hp: 140, speed: 6.5, carry: 0.86, canCarry: true, backpack: 4,
    weapon: 'halberd', offhand: null, block: 0.5, rmb: 'block', idle: 'Melee_2H_Idle', hideOffhand: true,
    desc: 'Alcance longo com a alabarda. Segura a linha, puxa inimigos e protege quem carrega a princesa.',
    stats: 'Vida alta · Alcance longo',
    attack: { type: 'melee', name: 'Estocada', damage: 34, range: 4.6, arc: 0.7, cooldown: 0.8, hitDelay: 0.25, anim: 'Melee_2H_Attack_Stab', swing: 'thrust' },
  },
  swordsman: {
    key: 'swordsman', name: 'Espadachim', icon: '⚔️', hotkey: 7,
    model: 'Rogue', hp: 115, speed: 7.6, carry: 0.86, canCarry: true, backpack: 4,
    weapon: 'sword_A', offhand: null, block: 0.5, rmb: 'block', idle: 'Idle_A',
    desc: 'Duelista rápido. Apara golpes, faz combos e deixa os inimigos sangrando.',
    stats: 'Rápido · Dano constante',
    attack: { type: 'melee', name: 'Golpe rápido', damage: 22, range: 3.2, arc: 1.2, cooldown: 0.45, hitDelay: 0.14, anim: 'Melee_1H_Attack_Slice_Horizontal', swing: 'slash' },
  },
  merchant: {
    key: 'merchant', name: 'Mercador de Almas', icon: '💰', hotkey: 8,
    model: 'Mage', hp: 100, speed: 6.8, carry: 0, canCarry: false, backpack: 10,
    weapon: 'hammer_B', weaponSummoner: 'spellbook_open', offhand: null, block: 0.5, rmb: 'modes', idle: 'Idle_B',
    desc: 'Suporte e economia. Fabrica e vende armas, faz obras no castelo e invoca esqueletos com almas. Tecla \' troca o modo.',
    stats: 'Dois modos · Quase não luta',
    attack: { type: 'coin', name: 'Moeda', damage: 12, speed: 40, range: 20, cooldown: 0.6, anim: 'Throw', swing: 'throw' },
    attackSummoner: { type: 'shadow', name: 'Raio sombrio', damage: 14, speed: 38, range: 25, cooldown: 0.7, anim: 'Ranged_Magic_Shoot', swing: 'cast' },
  },
};
export const CLASS_KEYS = ['knight', 'barbarian', 'ranger', 'mage', 'rogue', 'halberdier', 'swordsman', 'merchant'];

export const MONSTERS = {
  Skeleton_Warrior: { name: 'Esqueleto Guerreiro', hp: 130, speed: 5.4, damage: 22, range: 3.2, cooldown: 1.1, weapon: 'sword_A', anim: 'Melee_1H_Attack_Chop', kind: 'melee', xp: 60 },
  Skeleton_Minion:  { name: 'Esqueleto Lacaio',    hp: 70,  speed: 6.0, damage: 12, range: 2.8, cooldown: 0.8, weapon: 'hammer_B', anim: 'Melee_1H_Attack_Chop', kind: 'melee', xp: 30 },
  Skeleton_Rogue:   { name: 'Esqueleto Ladino',    hp: 80,  speed: 7.2, damage: 16, range: 2.8, cooldown: 0.6, weapon: 'dagger', anim: 'Melee_1H_Attack_Stab', kind: 'melee', xp: 40 },
  Skeleton_Mage:    { name: 'Esqueleto Mago',      hp: 75,  speed: 5.0, damage: 18, range: 18,  cooldown: 1.8, weapon: 'staff_B', anim: 'Ranged_Magic_Shoot', kind: 'ranged', xp: 45 },
};

export const BOT_NAMES = [
  ['Sir Galvão', 'Dona Brites', 'Tristão', 'Isolda', 'Frei Bento', 'Lourenço', 'Matilde', 'Gaspar', 'Leonor'],
  ['Barão Rubro', 'Malaquias', 'Dona Urraca', 'Vasco Cruel', 'Brunilda', 'Torquato', 'Ximena', 'Rodrigo', 'Morgana'],
];

// ------------------------------------------------------------------ progressão
export const MAX_LEVEL = 10;
// XP total necessário para chegar a cada nível (índice = nível)
export const LEVEL_XP = [0, 0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700];
// nível em que cada slot de skill pode ser desbloqueado
export const SLOT_LEVEL = { 1: 1, 2: 2, 3: 4, 4: 6, 5: 8 };
// Um ponto extra numa skill já desbloqueada a evolui para o Nível II (−20% de recarga).
export const RANK2_CDR = 0.2;

export const XP = {
  kill: 100,
  feed: 50,
  returnPrincess: 40,
  rescue: 300,
  assist: 25,
  workDone: 80,
  resurrect: 50,
  structure: 100,
  sale: [10, 20, 30, 45, 60], // por raridade
};

// ------------------------------------------------------------------ economia
export const GOLD = {
  passive: 1, // por segundo
  kill: 30,
  skeleton: 10,
  rescue: 150,
  coinMin: 10, coinMax: 25, coinRespawn: 45,
  chest: 100, chestRespawn: 120,
  dropPile: 25,
  vaultStart: 200,
};

export const RARITY = [
  { key: 'common', name: 'Comum', color: 0xf2f2f2, css: '#f2f2f2', dmg: 0.05, price: 50, energy: 10, time: 2, discount: 6, overcharge: 5, level: 1 },
  { key: 'uncommon', name: 'Incomum', color: 0x5fe36b, css: '#5fe36b', dmg: 0.10, price: 100, energy: 18, time: 3, discount: 10, overcharge: 9, level: 2 },
  { key: 'rare', name: 'Rara', color: 0x4aa0ff, css: '#4aa0ff', dmg: 0.15, price: 200, energy: 30, time: 5, discount: 16, overcharge: 15, level: 4 },
  { key: 'epic', name: 'Épica', color: 0xb76bff, css: '#b76bff', dmg: 0.22, price: 400, energy: 45, time: 7, discount: 24, overcharge: 22, level: 6 },
  { key: 'legendary', name: 'Lendária', color: 0xff9a2a, css: '#ff9a2a', dmg: 0.30, price: 800, energy: 65, time: 10, discount: 35, overcharge: 32, level: 8 },
];
export const LEVEL_MULT = [1.0, 1.25, 1.5, 1.75, 2.0]; // +1..+5

export const ATTRS = {
  hp: { name: 'Vida máxima', per: 8, fmt: (v) => `+${v} vida` },
  atkspd: { name: 'Velocidade de ataque', per: 0.03, fmt: (v) => `+${Math.round(v * 100)}% vel. de ataque` },
  move: { name: 'Velocidade de movimento', per: 0.02, fmt: (v) => `+${Math.round(v * 100)}% vel. de movimento` },
  leech: { name: 'Roubo de vida', per: 0.02, fmt: (v) => `${Math.round(v * 100)}% de roubo de vida` },
  cdr: { name: 'Recarga das skills', per: 0.03, fmt: (v) => `−${Math.round(v * 100)}% de recarga` },
};
export const ATTR_KEYS = Object.keys(ATTRS);

export const PRICE_MODES = {
  discount: { name: 'Desconto', mult: 0.7 },
  normal: { name: 'Normal', mult: 1.0 },
  overcharge: { name: 'Sobrecarga', mult: 1.5 },
};

export const STALL = { slots: 8, slotsVitrine: 12, depot: 20, useRange: 6, sellRange: 4 };
export const WEAPON_GROUND_TIME = 30;

// ------------------------------------------------------------------ Mercador de Almas
export const MERCHANT = {
  energyMax: 100,
  regenOut: 0.5, regenIn: 1.0,
  pickupEnergy: 3,
  buyEnergy: 2,
  soulOverflowEnergy: 5,
  soulsMax: 10,
  soulLinkRate: 0.3, soulLinkRange: 15,
  soulLife: 8, soulRange: 15, soulPickup: 2,
  tombEvery: 30,
  switchTime: 0.3, switchCooldown: 1.5,
  marchCost: 1, marchCooldown: 30, marchDuration: 15, marchRadius: 15, marchSpeed: 0.4,
  remoteStallCost: 5,
  levelExtraEnergy: 5, levelExtraTime: 1, outsideTimeMult: 1.5,
};

// obras do castelo: custo por nível [ouro, energia]
export const WORKS = {
  barracks: { name: 'Quartel', desc: 'Tempo de renascimento −1 s por nível (de 7 s até 4 s).', costs: [[250, 20], [500, 35], [900, 50]] },
  ossuary: { name: 'Ossuário', desc: '+1 no limite de lacaios do invocador. No nível 2, também +1 no limite de guerreiros.', costs: [[300, 25], [700, 45]] },
  banner: { name: 'Estandarte', desc: '+10% de XP para todo o time por nível.', costs: [[300, 20], [600, 35], [1000, 50]] },
  towers: { name: 'Torres de defesa', desc: 'Nível 1: uma torre. Nível 2: duas torres. Nível 3: 25 de dano e 500 de vida.', costs: [[400, 30], [700, 45], [1100, 60]] },
  treasury: { name: 'Tesouraria', desc: '+0,5 de ouro por segundo para cada jogador do time por nível.', costs: [[350, 25], [800, 45]] },
};
export const WORK_KEYS = Object.keys(WORKS);
export const WORK_TIME = 20;
export const TOWER = {
  range: 22, interval: 1.5,
  levels: [null, { damage: 15, hp: 300 }, { damage: 15, hp: 300 }, { damage: 25, hp: 500 }],
};
