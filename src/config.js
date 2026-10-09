// Configuração geral do jogo: times, classes, monstros e dificuldade.

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
  easy:   { botDamage: 0.6, botAccuracy: 0.55, botReaction: 0.9, botAggro: 0.8 },
  normal: { botDamage: 0.85, botAccuracy: 0.75, botReaction: 0.55, botAggro: 1.0 },
  hard:   { botDamage: 1.05, botAccuracy: 0.92, botReaction: 0.3, botAggro: 1.15 },
};

// Altura dos personagens KayKit ~2.4 unidades. 1 unidade ~ 0.75 m.
export const EYE_HEIGHT = 2.05;
export const CHAR_RADIUS = 0.6;
export const RESPAWN_TIME = 7;
export const PRINCESS_RETURN_TIME = 25;
export const MAX_FAT = 5;

export const CLASSES = {
  knight: {
    key: 'knight', name: 'Cavaleiro', icon: '🛡️', hotkey: 1,
    model: 'Knight', hp: 160, speed: 6.6, carry: 0.86,
    weapon: 'sword_1handed', offhand: 'shield_round_color',
    desc: 'Linha de frente. Bloqueia ataques frontais com o escudo e avança sobre o inimigo.',
    stats: 'Vida alta · Corpo a corpo',
    attack: { type: 'melee', name: 'Golpe', damage: 30, range: 3.4, arc: 1.25, cooldown: 0.6, hitDelay: 0.2, anim: 'Melee_1H_Attack_Slice_Diagonal' },
    alt: { type: 'block', name: 'Bloquear', cooldown: 0 },
    ability: { type: 'charge', name: 'Investida', cooldown: 8, damage: 32, distance: 13 },
  },
  barbarian: {
    key: 'barbarian', name: 'Bárbaro', icon: '🪓', hotkey: 2,
    model: 'Barbarian', hp: 190, speed: 6.2, carry: 0.9,
    weapon: 'axe_2handed', offhand: null,
    desc: 'Força bruta. Golpes lentos e devastadores; gira o machado no meio da multidão.',
    stats: 'Vida muito alta · Dano alto',
    attack: { type: 'melee', name: 'Machadada', damage: 50, range: 3.7, arc: 1.6, cooldown: 1.0, hitDelay: 0.38, anim: 'Melee_2H_Attack_Chop' },
    alt: { type: 'kick', name: 'Chute', cooldown: 4, damage: 12, range: 2.8, knock: 14 },
    ability: { type: 'whirl', name: 'Redemoinho', cooldown: 9, damage: 42, radius: 4.8 },
  },
  ranger: {
    key: 'ranger', name: 'Arqueira', icon: '🏹', hotkey: 3,
    model: 'Ranger', hp: 95, speed: 7.3, carry: 0.86,
    weapon: 'bow_withString', offhand: null,
    desc: 'Mata de longe. Segure o botão para tensionar o arco e causar mais dano.',
    stats: 'Vida baixa · Longo alcance',
    attack: { type: 'arrow', name: 'Flecha', damageMin: 16, damageMax: 58, chargeTime: 1.0, speed: 75, cooldown: 0.35, anim: 'Ranged_Bow_Release' },
    alt: { type: 'zoom', name: 'Mirar', cooldown: 0 },
    ability: { type: 'volley', name: 'Rajada', cooldown: 10, damage: 24, count: 7 },
  },
  mage: {
    key: 'mage', name: 'Maga', icon: '🔮', hotkey: 4,
    model: 'Mage', hp: 90, speed: 6.9, carry: 0.86,
    weapon: 'staff', offhand: null,
    desc: 'Bolas de fogo explosivas, cura aliados ao redor e congela inimigos próximos.',
    stats: 'Vida baixa · Suporte e área',
    attack: { type: 'fireball', name: 'Bola de fogo', damage: 26, splash: 3.2, speed: 34, cooldown: 0.85, anim: 'Ranged_Magic_Shoot' },
    alt: { type: 'heal', name: 'Cura', cooldown: 7, amount: 40, radius: 10 },
    ability: { type: 'nova', name: 'Nova gélida', cooldown: 12, damage: 16, radius: 8, slow: 0.45, duration: 3.5 },
  },
  rogue: {
    key: 'rogue', name: 'Ladino', icon: '🗡️', hotkey: 5,
    model: 'Rogue_Hooded', hp: 105, speed: 8.4, carry: 1.0,
    weapon: 'dagger', offhand: 'dagger',
    desc: 'Rápido e furtivo. Facadas pelas costas causam dano triplo. Some numa nuvem de fumaça.',
    stats: 'Muito rápido · Carrega melhor a princesa',
    attack: { type: 'melee', name: 'Facada', damage: 20, range: 2.9, arc: 1.0, cooldown: 0.34, hitDelay: 0.12, backstab: 3, anim: 'Melee_Dualwield_Attack_Stab' },
    alt: { type: 'dash', name: 'Esquiva', cooldown: 5, distance: 8 },
    ability: { type: 'smoke', name: 'Fumaça', cooldown: 16, duration: 5, speedBoost: 1.35 },
  },
};
export const CLASS_KEYS = ['knight', 'barbarian', 'ranger', 'mage', 'rogue'];

export const MONSTERS = {
  Skeleton_Warrior: { name: 'Esqueleto Guerreiro', hp: 130, speed: 5.4, damage: 22, range: 3.2, cooldown: 1.1, weapon: 'sword_A', anim: 'Melee_1H_Attack_Chop', kind: 'melee' },
  Skeleton_Minion:  { name: 'Esqueleto Lacaio',    hp: 70,  speed: 6.0, damage: 12, range: 2.8, cooldown: 0.8, weapon: 'hammer_B', anim: 'Melee_1H_Attack_Chop', kind: 'melee' },
  Skeleton_Rogue:   { name: 'Esqueleto Ladino',    hp: 80,  speed: 7.2, damage: 16, range: 2.8, cooldown: 0.6, weapon: 'dagger', anim: 'Melee_1H_Attack_Stab', kind: 'melee' },
  Skeleton_Mage:    { name: 'Esqueleto Mago',      hp: 75,  speed: 5.0, damage: 18, range: 18,  cooldown: 1.8, weapon: 'staff_B', anim: 'Ranged_Magic_Shoot', kind: 'ranged' },
};

export const BOT_NAMES = [
  ['Sir Galvão', 'Dona Brites', 'Tristão', 'Isolda', 'Frei Bento', 'Lourenço', 'Matilde', 'Gaspar', 'Leonor'],
  ['Barão Rubro', 'Malaquias', 'Dona Urraca', 'Vasco Cruel', 'Brunilda', 'Torquato', 'Ximena', 'Rodrigo', 'Morgana'],
];
