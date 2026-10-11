// Skills e perks das classes (docs/SKILLS.md, seção 4).
// Cada skill: { id, slot, name, dmg, effect, dur, cd, perks:{A,B}, cast(S, ch, aim, perk), ai(ctx, perk) }
//  - S é o Combat (helpers de dano, área, projéteis e status).
//  - perk é 'A', 'B' ou null.
//  - cast retorna false se não foi usada (não gasta recarga nem custo).
//  - menu: a skill abre um menu para o jogador (o custo é pago na confirmação).
//  - icon: ícone da skill no HUD e nos menus.
import * as THREE from 'three';
import { sfx } from './audio.js';
import { MERCHANT, SUMMONER } from './config.js';

const UP = new THREE.Vector3(0, 1, 0);
const flat = (v) => { const d = v.clone(); d.y = 0; if (d.lengthSq() < 1e-6) d.set(0, 0, 1); return d.normalize(); };
const pk = (p, a, b, base) => (p === 'A' ? a : p === 'B' ? b : base);

// ======================================================================== Cavaleiro
const KNIGHT = [
  {
    id: 'knight_charge', icon: '🐎', slot: 1, name: 'Investida', dmg: '32', effect: 'Avança 13 m e empurra quem atingir no caminho.', dur: 'Instantâneo', cd: 8,
    perks: { A: ['Impacto', 'Avança 17 m e derruba o alvo por 1 s.'], B: ['Escudo erguido', 'Recebe 50% menos dano durante a investida.'] },
    cast(S, ch, aim, p) {
      const dist = p === 'A' ? 17 : 13, d = flat(aim.dir), hit = new Set();
      ch.playOnce('Melee_1H_Attack_Stab', { speed: 1.1 });
      sfx('dash', S.dist(ch));
      if (p === 'B') ch.st.guardUntil = S.time + dist / 28 + 0.2;
      S.dash(ch, d, dist, 28, {
        onStep: (c) => {
          for (const o of S.enemiesNear(c, c.pos.x, c.pos.z, 2.1)) {
            if (hit.has(o)) continue;
            hit.add(o);
            S.damage(o, 32, c, { dir: d, knock: 16, melee: true });
            if (p === 'A') S.stun(o, 1, true);
          }
        },
      });
    },
    ai: (c) => c.d > 4 && c.d < 15 && c.facing,
  },
  {
    id: 'knight_bash', icon: '🛡️', slot: 2, name: 'Escudada', dmg: '15', effect: 'Golpe curto com o escudo que empurra o alvo.', dur: 'Instantâneo', cd: 6,
    perks: { A: ['Empurrão', 'Atordoa o alvo por 1 s.'], B: ['Contra-golpe', 'Por 1 s, quem atacar o cavaleiro de frente leva 20 de dano.'] },
    cast(S, ch, aim, p) {
      ch.playOnce('Melee_Block_Attack', { speed: 1.6 });
      sfx('block', S.dist(ch));
      if (p === 'B') ch.st.counterUntil = S.time + 1;
      S.after(0.15, () => {
        for (const o of S.cone(ch, aim.dir, 2.8, 1.5)) {
          S.damage(o, 15, ch, { dir: S.dirTo(ch, o), knock: 15, melee: true });
          if (p === 'A') S.stun(o, 1);
        }
      });
    },
    ai: (c) => c.d < 2.8 && c.facing,
  },
  {
    id: 'knight_warcry', icon: '📯', slot: 3, name: 'Grito de guerra', dmg: '—', effect: 'Aliados num raio de 10 m ganham +15% de dano.', dur: '6 s', cd: 20,
    perks: { A: ['Coragem', 'Aliados também ganham 30 de vida extra temporária (6 s).'], B: ['Intimidação', 'Inimigos no raio ficam 30% mais lentos por 3 s.'] },
    cast(S, ch, aim, p) {
      ch.playOnce('Melee_Block', { speed: 1.4 });
      sfx('warcry', S.dist(ch));
      S.fx.ring(ch.pos, 10, 0xffc04d, 0.7);
      for (const o of S.alliesNear(ch, ch.pos.x, ch.pos.z, 10)) {
        o.st.dmgUpUntil = S.time + 6;
        if (p === 'A') { o.st.tempHp = 30; o.st.tempHpUntil = S.time + 6; }
      }
      if (p === 'B') for (const o of S.enemiesNear(ch, ch.pos.x, ch.pos.z, 10)) S.slow(o, 0.7, 3);
    },
    ai: (c) => c.inFight && c.d < 10 && (c.alliesNear >= 1 || c.near >= 1),
  },
  {
    id: 'knight_heavy', icon: '🔨', slot: 4, name: 'Golpe pesado', dmg: '55', effect: 'Golpe lento, com 0,5 s de preparo.', dur: 'Instantâneo', cd: 10,
    perks: { A: ['Carregado', 'Preparo de 1 s e o dano dobra (110).'], B: ['Quebra-escudo', 'Ignora o bloqueio do alvo.'] },
    cast(S, ch, aim, p) {
      const wind = p === 'A' ? 1.0 : 0.5, dmg = p === 'A' ? 110 : 55;
      ch.cd.attack = Math.max(ch.cd.attack, wind + 0.2);
      ch.st.windupUntil = S.time + wind;
      ch.playOnce('Melee_1H_Attack_Chop', { speed: 0.7 / wind });
      S.after(wind, () => {
        if (!ch.alive || S.isStunned(ch)) return;
        sfx('heavy', S.dist(ch));
        for (const o of S.cone(ch, ch.forward(), 3.6, 1.4)) S.damage(o, dmg, ch, { dir: S.dirTo(ch, o), knock: 10, melee: true, ignoreBlock: p === 'B', crit: true });
      });
    },
    ai: (c) => c.d < 3.2 && c.facing,
  },
  {
    id: 'knight_oath', icon: '⚜️', slot: 5, name: 'Juramento', dmg: '—', effect: 'O bloqueio anula todo o dano frontal e o cavaleiro não pode ser empurrado.', dur: '5 s', cd: 25,
    perks: { A: ['Regeneração', 'Recupera 8 de vida por segundo enquanto bloqueia.'], B: ['Armadura', 'Também reduz 30% do dano vindo dos lados e das costas.'] },
    cast(S, ch, aim, p) {
      ch.st.oathUntil = S.time + 5; ch.st.oathPerk = p;
      ch.st.knockImmuneUntil = S.time + 5;
      sfx('block', S.dist(ch));
      S.fx.ring(ch.pos, 2.5, 0xfff0b0, 0.6);
    },
    ai: (c) => c.inFight && c.d < 8 && (c.hp < 0.7 || c.near >= 2),
  },
];

// ======================================================================== Bárbaro
const BARBARIAN = [
  {
    id: 'barb_whirl', icon: '🌪️', slot: 1, name: 'Redemoinho', dmg: '42', effect: 'Gira o machado e atinge todos num raio de 4,8 m, empurrando.', dur: 'Instantâneo', cd: 9,
    perks: { A: ['Raio maior', 'Raio de 6,5 m.'], B: ['Centro mortal', '+50% de dano (63) em quem está a até 2 m.'] },
    cast(S, ch, aim, p) {
      const r = p === 'A' ? 6.5 : 4.8;
      ch.playOnce('Melee_2H_Attack_Spin', { speed: 1.5 });
      sfx('heavy', S.dist(ch));
      S.fx.ring(ch.pos, r, 0xffe0a0, 0.4, 1.0);
      S.after(0.25, () => {
        for (const o of S.enemiesNear(ch, ch.pos.x, ch.pos.z, r)) {
          const close = Math.hypot(o.pos.x - ch.pos.x, o.pos.z - ch.pos.z) <= 2 + o.radius;
          S.damage(o, p === 'B' && close ? 63 : 42, ch, { dir: S.dirTo(ch, o), knock: 10, melee: true });
        }
      });
    },
    ai: (c) => c.near >= 2 || (c.near >= 1 && c.roll < 0.12),
  },
  {
    id: 'barb_kick', icon: '🦶', slot: 2, name: 'Chute', dmg: '12', effect: 'Chute curto (2,8 m) que empurra o alvo com força.', dur: 'Instantâneo', cd: 4,
    perks: { A: ['Coice', 'Empurra bem mais longe.'], B: ['Atordoar', 'Atordoa o alvo por 1 s.'] },
    cast(S, ch, aim, p) {
      ch.playOnce('Melee_Unarmed_Attack_Kick', { speed: 1.6 });
      sfx('swing', S.dist(ch));
      S.after(0.2, () => {
        for (const o of S.cone(ch, aim.dir, 2.8, 1.4)) {
          S.damage(o, 12, ch, { dir: S.dirTo(ch, o), knock: p === 'A' ? 28 : 14, melee: true });
          if (p === 'B') S.stun(o, 1);
        }
      });
    },
    ai: (c) => c.d < 2.6 && c.facing && c.roll < 0.15,
  },
  {
    id: 'barb_fury', icon: '😡', slot: 3, name: 'Fúria', dmg: '—', effect: 'Entra em fúria: +10% de velocidade de movimento.', dur: '5 s', cd: 18,
    perks: { A: ['Sede de sangue', '+35% de dano durante a fúria.'], B: ['Frenesi', '+40% de velocidade de ataque durante a fúria.'] },
    cast(S, ch, aim, p) {
      ch.st.furyUntil = S.time + 5; ch.st.furyPerk = p;
      sfx('warcry', S.dist(ch));
      S.fx.ring(ch.pos, 3, 0xff4a2a, 0.5);
    },
    ai: (c) => c.inFight && c.d < 8,
  },
  {
    id: 'barb_throw', icon: '🪓', slot: 4, name: 'Arremesso de machado', dmg: '35', effect: 'Arremessa o machado (alcance 20 m). Fica sem ataque base até o machado voltar (1,5 s).', dur: 'Instantâneo', cd: 12,
    perks: { A: ['Cravar', 'Prende o alvo no chão por 1,5 s.'], B: ['Gancho', 'O machado volta puxando o alvo até o bárbaro.'] },
    cast(S, ch, aim, p) {
      ch.playOnce('Throw', { speed: 1.6 });
      sfx('swing', S.dist(ch));
      ch.st.axeOutUntil = S.time + 1.5;
      S.projectile(ch, 'axe', aim.origin, aim.dir, {
        speed: 32, damage: 35, range: 20, spin: true,
        onHit: (o) => { if (p === 'A') S.root(o, 1.5); if (p === 'B') S.pullTo(o, ch); },
      });
    },
    ai: (c) => c.d > 6 && c.d < 19 && c.facing && c.roll < 0.15,
  },
  {
    id: 'barb_iron', icon: '🪨', slot: 5, name: 'Pele de ferro', dmg: '—', effect: 'Recebe 25% menos dano.', dur: '6 s', cd: 25,
    perks: { A: ['Inabalável', 'Imune a empurrões e atordoamentos durante o efeito.'], B: ['Banquete de guerra', 'Recupera 30 de vida a cada abate durante o efeito.'] },
    cast(S, ch, aim, p) {
      ch.st.ironUntil = S.time + 6; ch.st.ironPerk = p;
      if (p === 'A') ch.st.knockImmuneUntil = S.time + 6;
      sfx('block', S.dist(ch));
      S.fx.ring(ch.pos, 2.5, 0xb0b0b8, 0.6);
    },
    ai: (c) => c.inFight && (c.hp < 0.6 || c.near >= 2),
  },
];

// ======================================================================== Arqueira
function volley(S, ch, aim, count, damage, explode) {
  const right = new THREE.Vector3().crossVectors(aim.dir, UP).normalize();
  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1) - 0.5) * 0.42;
    const d = aim.dir.clone().addScaledVector(right, t).normalize();
    d.y += (Math.random() - 0.5) * 0.04;
    S.arrow(ch, aim.origin, d, 68, damage, explode ? { explode: { damage: 12, radius: 2 } } : {});
  }
}
const RANGER = [
  {
    id: 'ranger_volley', icon: '🌠', slot: 1, name: 'Rajada', dmg: '24 por flecha', effect: 'Dispara 7 flechas em leque.', dur: 'Instantâneo', cd: 10,
    perks: { A: ['Mais flechas', '9 flechas.'], B: ['Flechas explosivas', 'Cada flecha explode (12 de dano num raio de 2 m).'] },
    cast(S, ch, aim, p) {
      ch.playOnce('Ranged_Bow_Release_Up', { speed: 1.6 });
      sfx('bow', S.dist(ch));
      volley(S, ch, aim, p === 'A' ? 9 : 7, 24, p === 'B');
    },
    ai: (c) => c.d > 6 && c.d < 26 && c.facing && c.roll < 0.15,
  },
  {
    id: 'ranger_pierce', icon: '🎯', slot: 2, name: 'Tiro perfurante', dmg: '45', effect: 'Flecha reta e muito rápida, sem queda.', dur: 'Instantâneo', cd: 8,
    perks: { A: ['Perfurar', 'Atravessa até 3 inimigos.'], B: ['Paciência', '+50% de dano contra alvos parados.'] },
    cast(S, ch, aim, p) {
      ch.playOnce('Ranged_Bow_Release', { speed: 1.8 });
      sfx('bow', S.dist(ch));
      S.arrow(ch, aim.origin, aim.dir, 140, 45, { gravity: 0, pierce: p === 'A' ? 3 : 1, patience: p === 'B', trail: true });
    },
    ai: (c) => c.d > 6 && c.d < 40 && c.facing && c.roll < 0.2,
  },
  {
    id: 'ranger_trap', icon: '🪤', slot: 3, name: 'Armadilha de espinhos', dmg: '—', effect: 'Coloca uma armadilha no chão que prende o inimigo por 1 s. Máximo de 2 armadilhas.', dur: 'Até 30 s ou até disparar', cd: 12,
    perks: { A: ['Espinhos lentos', 'Depois de solto, o alvo fica 50% mais lento por 3 s.'], B: ['Espinhos afiados', 'Causa 35 de dano ao pisar.'] },
    cast(S, ch, aim, p) {
      const pos = S.groundAhead(ch, aim, 6);
      ch.playOnce('Interact', { speed: 1.6 });
      S.trap(ch, pos, p);
    },
    ai: (c) => (c.inFight && c.d < 10) || ((c.mode === 'patrol' || c.mode === 'escort') && c.roll < 0.03),
  },
  {
    id: 'ranger_step', icon: '🍃', slot: 4, name: 'Passo leve', dmg: '—', effect: '+25% de velocidade de movimento.', dur: '4 s', cd: 14,
    perks: { A: ['Vento', '+45% de velocidade.'], B: ['Silêncio', 'Não faz barulho; bots só percebem a arqueira a menos de 8 m.'] },
    cast(S, ch, aim, p) {
      ch.st.stepUntil = S.time + 4; ch.st.stepMul = p === 'A' ? 1.45 : 1.25;
      if (p === 'B') ch.st.silentUntil = S.time + 4;
      sfx('dash', S.dist(ch));
      S.fx.puff(ch.chest, 0xcff7ff);
    },
    ai: (c) => (c.hp < 0.4 && c.inFight) || (!c.inFight && c.mode === 'attack' && c.roll < 0.005),
  },
  {
    id: 'ranger_hunt', icon: '🦅', slot: 5, name: 'Marca do caçador', dmg: 'Da flecha', effect: 'Todas as flechas disparadas viram teleguiadas: curvam até o inimigo mais próximo da mira (cone de 25°, até 40 m). Vale para o ataque base e para as skills 1 e 2.', dur: '8 s', cd: 18,
    perks: { A: ['Caçada longa', 'Dura 12 s.'], B: ['Presa', 'Quem for atingido fica marcado por 4 s, recebe +20% de dano de todas as fontes e fica visível para o time através das paredes.'] },
    cast(S, ch, aim, p) {
      ch.st.huntUntil = S.time + (p === 'A' ? 12 : 8); ch.st.huntPerk = p;
      sfx('heal', S.dist(ch));
      S.fx.ring(ch.pos, 2, 0xff6a5a, 0.5);
    },
    ai: (c) => c.inFight && c.d > 8,
  },
];

// ======================================================================== Maga
const MAGE = [
  {
    id: 'mage_nova', icon: '❄️', slot: 1, name: 'Nova gélida', dmg: '16', effect: 'Inimigos num raio de 8 m ficam 45% mais lentos.', dur: '3,5 s', cd: 12,
    perks: { A: ['Inverno longo', 'A lentidão dura 5 s.'], B: ['Gelo cortante', 'Dano 30.'] },
    cast(S, ch, aim, p) {
      ch.playOnce('Ranged_Magic_Summon', { speed: 1.8 });
      sfx('frost', S.dist(ch));
      S.fx.frost(ch.pos, 8);
      for (const o of S.enemiesNear(ch, ch.pos.x, ch.pos.z, 8)) {
        S.damage(o, p === 'B' ? 30 : 16, ch, {});
        S.slow(o, 0.55, p === 'A' ? 5 : 3.5);
      }
    },
    ai: (c) => c.inFight && (c.d < 8.5 || c.near >= 1),
  },
  {
    id: 'mage_lance', icon: '🧊', slot: 2, name: 'Lança de gelo', dmg: '35', effect: 'Lança rápida de gelo que deixa o alvo 40% mais lento por 2 s.', dur: 'Instantâneo', cd: 6,
    perks: { A: ['Lança perfurante', 'Atravessa até 3 inimigos.'], B: ['Congelar', 'Prende o alvo no lugar por 1 s.'] },
    cast(S, ch, aim, p) {
      ch.playOnce('Ranged_Magic_Shoot', { speed: 1.8 });
      sfx('frost', S.dist(ch));
      S.projectile(ch, 'ice', aim.origin, aim.dir, { speed: 55, damage: 35, range: 40, pierce: p === 'A' ? 3 : 1, onHit: (o) => { S.slow(o, 0.6, 2); if (p === 'B') S.root(o, 1); } });
    },
    ai: (c) => c.d > 4 && c.d < 30 && c.facing && c.roll < 0.25,
  },
  {
    id: 'mage_shield', icon: '🔷', slot: 3, name: 'Escudo arcano', dmg: '—', effect: 'Escudo que absorve 50 de dano, na maga ou no aliado mirado (alcance 15 m).', dur: '6 s', cd: 15,
    perks: { A: ['Escudo reforçado', 'Absorve 80.'], B: ['Espelho', 'Devolve ao atacante 30% do dano absorvido.'] },
    cast(S, ch, aim, p) {
      const t = aim.ally || S.aimAlly(ch, aim, 15) || ch;
      t.st.shield = p === 'A' ? 80 : 50; t.st.shieldUntil = S.time + 6; t.st.shieldReflect = p === 'B' ? 0.3 : 0;
      ch.playOnce('Ranged_Magic_Raise', { speed: 1.8 });
      sfx('shield', S.dist(ch));
      S.fx.ring(t.pos, 1.6, 0x8fd0ff, 0.6, 1.2);
    },
    ai: (c) => c.inFight && (c.hp < 0.7 || c.allyLow),
  },
  {
    id: 'mage_blink', icon: '🌀', slot: 4, name: 'Teleporte curto', dmg: '—', effect: 'Teleporta 10 m na direção da mira.', dur: 'Instantâneo', cd: (p) => (p === 'A' ? 7 : 12),
    perks: { A: ['Passo rápido', 'Recarga de 7 s.'], B: ['Portal', 'Leva junto o aliado mais próximo (até 3 m).'] },
    cast(S, ch, aim, p) {
      const d = flat(aim.moveDir && aim.moveDir.lengthSq() > 0.01 && aim.useMove ? aim.moveDir : aim.dir);
      let buddy = null;
      if (p === 'B') {
        let bd = 3;
        for (const o of S.alliesNear(ch, ch.pos.x, ch.pos.z, 3)) { if (o === ch) continue; const dd = o.pos.distanceTo(ch.pos); if (dd < bd) { bd = dd; buddy = o; } }
      }
      const from = ch.pos.clone();
      const to = S.blink(ch, d, 10);
      if (buddy) { buddy.pos.set(to.x - d.x * 1.4, buddy.pos.y, to.z - d.z * 1.4); S.game.col.resolve(buddy.pos, buddy.radius, 0); buddy.vel.set(0, 0, 0); }
      sfx('blink', S.dist(ch));
      S.fx.puff(from.setY(from.y + 1.2), 0xb46bff);
      S.fx.puff(ch.chest, 0xb46bff);
    },
    ai: (c) => c.hp < 0.35 && c.inFight && c.d < 6,
    useMove: true,
  },
  {
    id: 'mage_meteor', icon: '☄️', slot: 5, name: 'Meteoro', dmg: '80 no centro, 40 na borda', effect: 'Meteoro cai no ponto mirado (alcance 30 m, raio 5 m) após 1,2 s.', dur: 'Instantâneo', cd: 30,
    perks: { A: ['Cataclismo', 'Atraso de 2 s e raio de 7 m.'], B: ['Chuva de meteoros', 'Caem três meteoros menores (50 de dano, raio 3,5 m cada).'] },
    cast(S, ch, aim, p) {
      const at = aim.point || S.aimPoint(ch, aim, 30);
      ch.playOnce('Ranged_Magic_Spellcasting', { speed: 1.6 });
      sfx('fire', S.dist(ch));
      if (p === 'B') {
        for (let i = 0; i < 3; i++) {
          const a = i / 3 * Math.PI * 2 + Math.random();
          const q = at.clone().add(new THREE.Vector3(Math.cos(a) * 3.2, 0, Math.sin(a) * 3.2));
          S.meteor(ch, q, { delay: 1.2 + i * 0.25, radius: 3.5, center: 50, edge: 50 });
        }
      } else S.meteor(ch, at, { delay: p === 'A' ? 2 : 1.2, radius: p === 'A' ? 7 : 5, center: 80, edge: 40 });
    },
    ai: (c) => c.d > 6 && c.d < 28 && (c.targetNear >= 2 || c.roll < 0.1),
  },
];

// ======================================================================== Ladino
const ROGUE = [
  {
    id: 'rogue_smoke', icon: '💨', slot: 1, name: 'Fumaça', dmg: '—', effect: 'Fica invisível e ganha +35% de velocidade.', dur: '5 s', cd: 16,
    perks: { A: ['Sombra longa', 'Dura 7 s.'], B: ['Sombra veloz', '+60% de velocidade.'] },
    cast(S, ch, aim, p) {
      const dur = p === 'A' ? 7 : 5;
      ch.playOnce('Throw', { speed: 1.8 });
      sfx('smoke', S.dist(ch));
      S.fx.smoke(ch.pos);
      ch.st.invisUntil = S.time + dur;
      ch.st.speedUntil = S.time + dur; ch.st.speedMul = p === 'B' ? 1.6 : 1.35;
    },
    ai: (c) => (c.hp < 0.4 && c.inFight) || (c.nearEnemyCell && c.roll < 0.05),
  },
  {
    id: 'rogue_dash', icon: '💫', slot: 2, name: 'Esquiva', dmg: '—', effect: 'Avança 8 m rapidamente.', dur: 'Instantâneo', cd: 5,
    perks: { A: ['Salto longo', 'Avança 12 m.'], B: ['Rastro', 'Deixa uma trilha de fumaça que bloqueia a visão por 3 s.'] },
    cast(S, ch, aim, p) {
      const d = flat(aim.moveDir && aim.moveDir.lengthSq() > 0.01 ? aim.moveDir : aim.dir);
      const dist = p === 'A' ? 12 : 8;
      let next = 0;
      ch.playOnce('Jump_Full_Short', { speed: 2 });
      sfx('dash', S.dist(ch));
      S.fx.puff(ch.chest, 0xdddddd);
      S.dash(ch, d, dist, 32, {
        onStep: (c) => { if (p === 'B' && S.time >= next) { next = S.time + 0.08; S.smokeCloud(c.pos, 2.2, 3); } },
      });
    },
    ai: (c) => c.d > 4.5 && c.d < 10 && c.roll < 0.15,
  },
  {
    id: 'rogue_poison', icon: '🧪', slot: 3, name: 'Veneno', dmg: '6/s', effect: 'Os próximos 3 acertos da lâmina envenenam o alvo (24 de dano no total).', dur: 'Lâmina: 8 s. Veneno: 4 s', cd: 14,
    perks: { A: ['Peçonha', '10 de dano por segundo (40 no total).'], B: ['Contágio', 'O veneno se espalha para inimigos a até 4 m do alvo.'] },
    cast(S, ch, aim, p) {
      ch.st.bladePoison = { charges: 3, until: S.time + 8, dps: p === 'A' ? 10 : 6, spread: p === 'B' };
      sfx('poison', S.dist(ch));
      S.fx.puff(ch.chest, 0x7dff5a);
    },
    ai: (c) => c.inFight && c.d < 8,
  },
  {
    id: 'rogue_knife', icon: '🔪', slot: 4, name: 'Adaga arremessada', dmg: '30', effect: 'Arremessa uma adaga (alcance 25 m).', dur: 'Instantâneo', cd: 6,
    perks: { A: ['Lâmina pesada', 'Dano 45.'], B: ['Nocaute', 'Atordoa o alvo por 0,8 s.'] },
    cast(S, ch, aim, p) {
      ch.playOnce('Throw', { speed: 1.8 });
      sfx('swing', S.dist(ch));
      S.projectile(ch, 'dagger', aim.origin, aim.dir, { speed: 48, damage: p === 'A' ? 45 : 30, range: 25, onHit: (o) => { if (p === 'B') S.stun(o, 0.8); } });
    },
    ai: (c) => c.d > 4 && c.d < 22 && c.facing && c.roll < 0.2,
  },
  {
    id: 'rogue_treach', icon: '🌑', slot: 5, name: 'Golpe traiçoeiro', dmg: '—', effect: 'O próximo ataque base, em até 3 s, conta como pelas costas, de qualquer ângulo.', dur: '3 s', cd: 20,
    perks: { A: ['Passo sombrio', 'Teleporta para as costas do alvo mirado (alcance 12 m).'], B: ['Sequestrador', 'Dano dobrado se o alvo estiver carregando a princesa.'] },
    cast(S, ch, aim, p) {
      if (p === 'A') {
        const t = aim.target && aim.target.alive ? aim.target : S.aimEnemy(ch, aim, 12);
        if (!t || t.isStructure || t.pos.distanceTo(ch.pos) > 12) return false;
        const back = t.forward().multiplyScalar(-1.6);
        S.fx.puff(ch.chest, 0x443355);
        ch.pos.set(t.pos.x + back.x, t.pos.y, t.pos.z + back.z);
        S.game.col.resolve(ch.pos, ch.radius, 0);
        ch.yaw = t.yaw;
        ch.vel.set(0, 0, 0);
        S.fx.puff(ch.chest, 0x443355);
        sfx('blink', S.dist(ch));
      }
      ch.st.backstabUntil = S.time + 3; ch.st.backstabCarrier = p === 'B';
      ch.cd.attack = Math.min(ch.cd.attack, 0.05);
    },
    ai: (c) => c.d < (c.perk === 'A' ? 11 : 3) && c.roll < 0.15,
  },
];

// ======================================================================== Alabardeiro
const HALBERDIER = [
  {
    id: 'halb_thrust', icon: '🔱', slot: 1, name: 'Estocada', dmg: '40', effect: 'Estocada longa (5,5 m) que atinge todos em linha.', dur: 'Instantâneo', cd: 6,
    perks: { A: ['Repelir', 'Empurra os alvos para trás.'], B: ['Ponta afiada', '+50% de dano no primeiro alvo.'] },
    cast(S, ch, aim, p) {
      ch.playOnce('Melee_2H_Attack_Stab', { speed: 1.4 });
      sfx('swing', S.dist(ch));
      S.after(0.2, () => {
        S.line(ch, aim.dir, 5.5, 1.0).forEach((o, i) => S.damage(o, p === 'B' && i === 0 ? 60 : 40, ch, { dir: flat(aim.dir), knock: p === 'A' ? 20 : 4, melee: true }));
      });
    },
    ai: (c) => c.d < 5.3 && c.facing,
  },
  {
    id: 'halb_sweep', icon: '🌙', slot: 2, name: 'Varredura', dmg: '28', effect: 'Golpe em arco de 180°, alcance 4,5 m, até 2 alvos.', dur: 'Instantâneo', cd: 7,
    perks: { A: ['Haste longa', 'Alcance de 6 m.'], B: ['Ceifa', 'Até 4 alvos.'] },
    cast(S, ch, aim, p) {
      ch.playOnce('Melee_2H_Attack_Slice', { speed: 1.5 });
      sfx('heavy', S.dist(ch));
      S.after(0.25, () => {
        S.cone(ch, aim.dir, p === 'A' ? 6 : 4.5, Math.PI, p === 'B' ? 4 : 2).forEach(o => S.damage(o, 28, ch, { dir: S.dirTo(ch, o), knock: 8, melee: true }));
      });
    },
    ai: (c) => c.near >= 2 || (c.d < 4.3 && c.roll < 0.12),
  },
  {
    id: 'halb_wall', icon: '🧱', slot: 3, name: 'Muralha', dmg: '15', effect: 'Finca a alabarda e fica parado: bloqueia todo o dano frontal, e quem entrar a 3 m na frente leva dano. Use de novo para sair.', dur: 'Até 4 s', cd: 16,
    perks: { A: ['Barreira', 'Prende por 1,5 s quem tentar passar.'], B: ['Postura firme', 'Também reduz 50% do dano dos lados.'] },
    cast(S, ch, aim, p) {
      ch.st.wallUntil = S.time + 4; ch.st.wallPerk = p; ch.st.wallTick = 0;
      ch.st.knockImmuneUntil = S.time + 4;
      ch.playOnce('Melee_Block', { speed: 1.2 });
      sfx('block', S.dist(ch));
      S.fx.ring(ch.pos, 3, 0xd8c48a, 0.5);
    },
    ai: (c) => c.inFight && c.d < 4.5 && (c.near >= 2 || c.targetCarrier || c.roll < 0.08),
  },
  {
    id: 'halb_lunge', icon: '⚡', slot: 4, name: 'Investida com haste', dmg: '38', effect: 'Avança 9 m e estoca no final.', dur: 'Instantâneo', cd: 10,
    perks: { A: ['Arremetida', 'Avança 13 m.'], B: ['Derrubar', 'Derruba o alvo por 1 s.'] },
    cast(S, ch, aim, p) {
      const d = flat(aim.dir), dist = p === 'A' ? 13 : 9;
      ch.playOnce('Melee_2H_Attack_Stab', { speed: 0.9 });
      sfx('dash', S.dist(ch));
      S.dash(ch, d, dist, 26, {
        stopNear: 2.2,
        onEnd: (c) => {
          sfx('swing', S.dist(c));
          for (const o of S.line(c, d, 3.8, 1.2)) { S.damage(o, 38, c, { dir: d, knock: 8, melee: true }); if (p === 'B') S.stun(o, 1); }
        },
      });
    },
    ai: (c) => c.d > 5 && c.d < 12 && c.facing && c.roll < 0.15,
  },
  {
    id: 'halb_hook', icon: '🪝', slot: 5, name: 'Gancho', dmg: '15', effect: 'Puxa o primeiro inimigo na linha (alcance 9 m) para a frente do alabardeiro.', dur: 'Instantâneo', cd: 14,
    perks: { A: ['Fisgar', 'Atordoa o alvo puxado por 0,8 s.'], B: ['Resgate', 'Também puxa a princesa caída.'] },
    cast(S, ch, aim, p) {
      ch.playOnce('Melee_2H_Attack_Stab', { speed: 1.6 });
      sfx('hook', S.dist(ch));
      const hits = S.line(ch, aim.dir, 9, 1.3).filter(o => !o.isStructure);
      const end = ch.chest.addScaledVector(flat(aim.dir), 9);
      if (hits.length) {
        const o = hits[0];
        S.fx.rope(ch.chest, o.chest);
        S.pullTo(o, ch);
        S.damage(o, 15, ch, { melee: true });
        if (p === 'A') S.stun(o, 0.8);
      } else S.fx.rope(ch.chest, end);
      if (p === 'B') {
        for (const pr of S.game.objectives.princesses) {
          if (pr.state !== 'dropped') continue;
          if (S.pointNearLine(ch, aim.dir, 9, 1.6, pr.pos)) {
            const f = ch.forward();
            pr.pos.set(ch.pos.x + f.x * 1.8, pr.pos.y, ch.pos.z + f.z * 1.8);
            S.fx.rope(ch.chest, pr.pos.clone().setY(pr.pos.y + 1.2));
          }
        }
      }
    },
    ai: (c) => (c.d > 4 && c.d < 9 && c.facing && (c.targetCarrier || c.roll < 0.12)) || (c.perk === 'B' && c.princessDroppedNear),
  },
];

// ======================================================================== Espadachim
const SWORDSMAN = [
  {
    id: 'sword_parry', icon: '🤺', slot: 1, name: 'Contra-ataque', dmg: '—', effect: 'Postura de aparar: anula o próximo golpe corpo a corpo recebido.', dur: '0,6 s', cd: 6,
    perks: { A: ['Riposta', 'Devolve ao atacante todo o dano anulado.'], B: ['Desarme', 'Atordoa o atacante por 1,2 s.'] },
    cast(S, ch, aim, p) {
      ch.st.parryUntil = S.time + 0.6; ch.st.parryPerk = p;
      ch.playOnce('Melee_Block', { speed: 1.8 });
      sfx('block', S.dist(ch));
    },
    ai: (c) => c.d < 3.6 && c.targetAttacking && c.roll < 0.4,
  },
  {
    id: 'sword_combo', icon: '💥', slot: 2, name: 'Combo rápido', dmg: '20 por golpe', effect: 'Dois golpes seguidos em 0,4 s.', dur: 'Instantâneo', cd: 8,
    perks: { A: ['Três golpes', 'Três golpes seguidos.'], B: ['Finalização', 'O último golpe causa 40.'] },
    cast(S, ch, aim, p) {
      const n = p === 'A' ? 3 : 2;
      ch.cd.attack = Math.max(ch.cd.attack, 0.2 * n + 0.1);
      for (let i = 0; i < n; i++) {
        S.after(i * 0.2, () => {
          if (!ch.alive) return;
          ch.playOnce(i % 2 ? 'Melee_1H_Attack_Slice_Diagonal' : 'Melee_1H_Attack_Slice_Horizontal', { speed: 2.2 });
          sfx('swing', S.dist(ch));
          const dmg = p === 'B' && i === n - 1 ? 40 : 20;
          S.meleeHit(ch, { damage: dmg, range: 3.3, arc: 1.3, dir: ch.forward(), base: true });
          if (ch.isPlayer) S.game.pc.swing('slash', 0.18);
        });
      }
    },
    ai: (c) => c.d < 3 && c.facing,
  },
  {
    id: 'sword_spin', icon: '🔄', slot: 3, name: 'Corte giratório', dmg: '30', effect: 'Atinge todos num raio de 3,5 m.', dur: 'Instantâneo', cd: 10,
    perks: { A: ['Giro amplo', 'Raio de 5 m.'], B: ['Vampírico', 'Recupera 10 de vida por alvo atingido.'] },
    cast(S, ch, aim, p) {
      const r = p === 'A' ? 5 : 3.5;
      ch.playOnce('Melee_2H_Attack_Spin', { speed: 1.7 });
      sfx('swing', S.dist(ch));
      S.fx.ring(ch.pos, r, 0xe8e8ff, 0.35, 1.0);
      S.after(0.2, () => {
        let n = 0;
        for (const o of S.enemiesNear(ch, ch.pos.x, ch.pos.z, r)) { S.damage(o, 30, ch, { dir: S.dirTo(ch, o), knock: 6, melee: true }); n++; }
        if (p === 'B' && n) S.heal(ch, 10 * n, ch);
      });
    },
    ai: (c) => c.near >= 2 || (c.near >= 1 && c.roll < 0.12),
  },
  {
    id: 'sword_leap', icon: '🦘', slot: 4, name: 'Salto', dmg: '35', effect: 'Salta 8 m e golpeia ao cair (raio de 3 m).', dur: 'Instantâneo', cd: 12,
    perks: { A: ['Salto longo', 'Salta 12 m.'], B: ['Duplo salto', 'Pode ser usado no ar.'] },
    cast(S, ch, aim, p) {
      if (!ch.onGround && p !== 'B') return false;
      const d = flat(aim.dir), dist = p === 'A' ? 12 : 8;
      ch.playOnce('Melee_1H_Attack_Jump_Chop', { speed: 1.1 });
      sfx('dash', S.dist(ch));
      S.leap(ch, d, dist, (c) => {
        sfx('heavy', S.dist(c));
        S.fx.ring(c.pos, 3, 0xe8e8ff, 0.4);
        for (const o of S.enemiesNear(c, c.pos.x, c.pos.z, 3)) S.damage(o, 35, c, { dir: S.dirTo(c, o), knock: 10, melee: true });
      });
    },
    ai: (c) => c.d > 5 && c.d < 11 && c.roll < 0.15,
  },
  {
    id: 'sword_bleed', icon: '🩸', slot: 5, name: 'Lâmina sangrenta', dmg: '5/s', effect: 'Os ataques aplicam sangramento.', dur: 'Lâmina: 6 s. Sangramento: 5 s', cd: 20,
    perks: { A: ['Hemorragia', '8 de dano por segundo.'], B: ['Instinto', '+25% de dano contra quem está sangrando.'] },
    cast(S, ch, aim, p) {
      ch.st.bladeBleed = { until: S.time + 6, dps: p === 'A' ? 8 : 5 };
      sfx('poison', S.dist(ch));
      S.fx.puff(ch.chest, 0xc0202a);
    },
    ai: (c) => c.inFight && c.d < 6,
    passive: { B: 'instinct' },
  },
];

// ======================================================================== Sacerdote
const PRIEST = [
  {
    id: 'p_heal', icon: '💖', slot: 1, name: 'Cura', dmg: '—', effect: 'Cura 40 de vida do sacerdote e dos aliados num raio de 10 m.', dur: 'Instantâneo', cd: 8,
    perks: { A: ['Cura maior', 'Cura 60.'], B: ['Renovar', 'Cura mais 8 por segundo durante 3 s (24 extra).'] },
    cast(S, ch, aim, p) {
      ch.playOnce('Ranged_Magic_Raise', { speed: 1.6 });
      sfx('heal', S.dist(ch));
      for (const o of S.alliesNear(ch, ch.pos.x, ch.pos.z, 10)) {
        S.heal(o, p === 'A' ? 60 : 40, ch);
        if (p === 'B') { o.st.hotUntil = S.time + 3; o.st.hotRate = 8; o.st.hotSrc = ch; }
      }
      S.fx.ring(ch.pos, 10, 0x6dff8a, 0.7);
    },
    ai: (c) => c.allyLow || c.hp < 0.6,
  },
  {
    id: 'p_light', icon: '🌟', slot: 2, name: 'Luz sagrada', dmg: '25 (cura 35)', effect: 'Raio de luz que atravessa os alvos: cura os aliados e fere os inimigos.', dur: 'Instantâneo', cd: 5,
    perks: { A: ['Luz forte', 'Cura 50 e causa 35 de dano.'], B: ['Luz em cadeia', 'Cada acerto salta para mais um alvo a até 8 m.'] },
    cast(S, ch, aim, p) {
      ch.playOnce('Ranged_Magic_Shoot', { speed: 1.6 });
      sfx('heal', S.dist(ch));
      const dmg = p === 'A' ? 35 : 25, heal = p === 'A' ? 50 : 35;
      S.projectile(ch, 'holy', aim.origin, aim.dir, {
        speed: 60, damage: dmg, heal, range: 40, pierce: 4, hitsAllies: true,
        onHit: (o) => { if (p === 'B') S.chainLight(ch, o, dmg, heal); },
      });
    },
    ai: (c) => (c.allyLow && c.roll < 0.4) || (c.inFight && c.d < 30 && c.facing && c.roll < 0.15),
  },
  {
    id: 'p_bless', icon: '😇', slot: 3, name: 'Bênção', dmg: '—', effect: 'Escudo de luz que absorve 60 de dano, no aliado mirado (até 20 m) ou no sacerdote.', dur: '6 s', cd: 12,
    perks: { A: ['Graça', 'Absorve 90.'], B: ['Asas', 'O abençoado também ganha +20% de velocidade.'] },
    cast(S, ch, aim, p) {
      const t = aim.ally || S.aimAlly(ch, aim, 20) || ch;
      t.st.shield = p === 'A' ? 90 : 60; t.st.shieldUntil = S.time + 6; t.st.shieldReflect = 0;
      if (p === 'B') { t.st.speedUntil = S.time + 6; t.st.speedMul = 1.2; }
      ch.playOnce('Ranged_Magic_Raise', { speed: 1.8 });
      sfx('shield', S.dist(ch));
      S.fx.ring(t.pos, 1.6, 0xfff0a0, 0.6, 1.2);
    },
    ai: (c) => c.inFight && (c.hp < 0.7 || c.allyLow),
  },
  {
    id: 'p_purify', icon: '💧', slot: 4, name: 'Purificar', dmg: '—', effect: 'Remove atordoamento, prisão, lentidão, veneno, sangramento e marcas dos aliados num raio de 10 m, que ficam imunes a eles por 2 s.', dur: '2 s', cd: 14,
    perks: { A: ['Água benta', 'Também cura 20 de vida.'], B: ['Clarão', 'Inimigos no raio ficam 30% mais lentos por 3 s.'] },
    cast(S, ch, aim, p) {
      ch.playOnce('Ranged_Magic_Summon', { speed: 1.8 });
      sfx('shield', S.dist(ch));
      S.fx.ring(ch.pos, 10, 0xbfe8ff, 0.7);
      for (const o of S.alliesNear(ch, ch.pos.x, ch.pos.z, 10)) {
        S.cleanse(o, 2);
        if (p === 'A') S.heal(o, 20, ch);
      }
      if (p === 'B') for (const o of S.enemiesNear(ch, ch.pos.x, ch.pos.z, 10)) S.slow(o, 0.7, 3);
    },
    ai: (c) => c.allyDebuffed || (c.perk === 'B' && c.near >= 2),
  },
  {
    id: 'p_revive', icon: '🕊️', slot: 5, name: 'Ressurreição', dmg: '—', effect: 'Escolhe um aliado morto. Ele volta na hora, ao lado do sacerdote, com 50% da vida.', dur: 'Instantâneo', cd: (p) => (p === 'B' ? 60 : 90),
    perks: { A: ['Milagre', 'O aliado volta com a vida cheia.'], B: ['Fé', 'Recarga de 60 s.'] },
    menu: 'revive',
  },
];

// ======================================================================== Mercador
const MERCHANT_SKILLS = [
  {
    id: 'm_craft', icon: '⚒️', slot: 1, name: 'Fabricar', cost: 'Energia (arma 20, capacete 14, peitoral 18)', dmg: '—', effect: 'Escolhe o tipo (arma de uma classe, capacete ou peitoral) e o atributo. A raridade é sorteada: o nível do mercador e as melhorias da Oficina aumentam as chances. A peça sai com +1.', dur: '3 s canalizados (+50% fora da cidade)', cd: 1,
    perks: { A: ['Mestre ferreiro', 'Fabrica 30% mais rápido.'], B: ['Economia', 'Fabricar custa 20% menos energia.'] },
    menu: 'craft',
  },
  {
    id: 'm_stall', icon: '🏪', slot: 2, name: 'Banca à distância', cost: '5 de energia', dmg: '—', effect: 'Abre a banca do castelo de qualquer lugar do mapa. Perto da banca, a tecla E é livre.', dur: 'Instantâneo', cd: (p) => (p === 'A' ? 8 : 20),
    perks: { A: ['Mascate', 'Recarga de 8 s e não custa energia.'], B: ['Vitrine', '+8 espaços de exposição na banca.'] },
    menu: 'stall',
    energy: (p) => (p === 'A' ? 0 : MERCHANT.remoteStallCost),
  },
  {
    id: 'm_upgrade', icon: '💎', slot: 3, name: 'Aprimorar', cost: 'Energia 8 × nível novo e minério igual ao nível novo', dmg: '—', effect: 'Sobe +1 o atributo de uma peça da mochila ou da arma de um aliado a até 4 m (máximo +5).', dur: '2 s (canalizado)', cd: 4,
    perks: { A: ['Ourives', '30% menos energia e 1 minério a menos.'], B: ['Refino', 'Também pode subir a raridade de uma peça (custa energia e 3 minérios).'] },
    menu: 'upgrade',
  },
  {
    id: 'm_scrap', icon: '♻️', slot: 4, name: 'Desmanchar', cost: '—', dmg: '—', effect: 'Destrói uma peça da mochila e devolve 50% da energia de fabricação, mais minério (1 + raridade).', dur: 'Instantâneo', cd: 1,
    perks: { A: ['Reciclagem', 'Devolve 75% da energia e +1 minério.'], B: ['Sucata valiosa', 'Também rende ao cofre 25% do preço base da peça em ouro.'] },
    menu: 'scrap',
  },
  {
    id: 'm_works', icon: '🏗️', slot: 5, name: 'Obras do castelo', cost: 'Ouro do cofre + energia', dmg: '—', effect: 'Abre o menu de obras e da Oficina. Só funciona dentro da cidade.', dur: 'A obra fica pronta em 20 s', cd: 5,
    perks: { A: ['Mestre de obras', 'Obras custam 20% menos ouro.'], B: ['Mutirão', 'Obras ficam prontas na hora.'] },
    menu: 'works',
  },
];

// ======================================================================== Invocador
function summonSkill({ id, icon, slot, name, type, kind, souls, cd, dmg, effect, perks, hpMul, extra, ai }) {
  return {
    id, icon, slot, name, souls, cd, dmg, effect, dur: 'Até morrer', perks, keepsVeil: true,
    cost: `${souls} alma${souls > 1 ? 's' : ''}`,
    cast(S, ch, aim, p) {
      const g = S.game;
      const max = SUMMONER.limits[kind] + g.economy.workLevel(ch.team, 'ossuary');
      const have = g.summonsOf(ch, kind).length;
      if (have >= max) { if (ch.isPlayer) g.hud.status(`Limite de ${name.replace('Invocar ', '')}s: ${max}`); return false; }
      const n = kind === 'minion' && p === 'A' ? Math.min(2, max - have) : 1;
      const mType = typeof type === 'function' ? type(p) : type;
      for (let i = 0; i < n; i++) g.summon(ch, mType, kind, hpMul(p), extra(p));
      ch.playOnce('Ranged_Magic_Summon', { speed: 1.6 });
      sfx('summon', S.dist(ch));
    },
    ai,
  };
}

const SUMMONER_SKILLS = [
  summonSkill({
    id: 's_minion', icon: '💀', slot: 1, name: 'Invocar lacaio', type: 'Skeleton_Minion', kind: 'minion', souls: 1, cd: 3, dmg: '12 por golpe',
    effect: 'Invoca um Esqueleto Lacaio (70 de vida) que avança contra os inimigos. Máximo de 4.',
    perks: { A: ['Ninhada', 'Invoca dois lacaios de uma vez, cada um com 60% da vida.'], B: ['Ossos duros', 'O lacaio tem +50% de vida (105).'] },
    hpMul: (p) => (p === 'A' ? 0.6 : p === 'B' ? 1.5 : 1), extra: () => ({}),
    ai: (c) => c.souls >= 1 && (c.inFight || c.roll < 0.1),
  }),
  summonSkill({
    id: 's_warrior', icon: '☠️', slot: 2, name: 'Invocar guerreiro', type: 'Skeleton_Warrior', kind: 'warrior', souls: 3, cd: 8, dmg: '22 por golpe',
    effect: 'Invoca um Esqueleto Guerreiro (130 de vida). Máximo de 2.',
    perks: { A: ['Campeão', 'O guerreiro tem 200 de vida.'], B: ['Fúria óssea', 'O guerreiro causa +30% de dano.'] },
    hpMul: (p) => (p === 'A' ? 200 / 130 : 1), extra: (p) => (p === 'B' ? { dmgMul: 1.3 } : {}),
    ai: (c) => c.souls >= 3 && (c.inFight || c.roll < 0.05),
  }),
  summonSkill({
    id: 's_archer', icon: '🦴', slot: 3, name: 'Invocar arqueiro', type: 'Skeleton_Archer', kind: 'archer', souls: 2, cd: 6, dmg: '14 por flecha',
    effect: 'Invoca um Esqueleto Arqueiro (65 de vida, alcance 22 m). Máximo de 3.',
    perks: { A: ['Flechas de fogo', 'As flechas explodem: +8 de dano num raio de 2 m.'], B: ['Olho de águia', 'Alcance de 30 m e +20% de dano.'] },
    hpMul: () => 1, extra: (p) => (p === 'A' ? { explode: { damage: 8, radius: 2 } } : p === 'B' ? { rangeMul: 30 / 22, dmgMul: 1.2 } : {}),
    ai: (c) => c.souls >= 2 && (c.inFight || c.roll < 0.05),
  }),
  summonSkill({
    id: 's_mage', icon: '🪄', slot: 4, name: 'Invocar mago', type: 'Skeleton_Mage', kind: 'mage', souls: 3, cd: 8, dmg: '18 por raio',
    effect: 'Invoca um Esqueleto Mago (75 de vida, alcance 18 m). Máximo de 2.',
    perks: { A: ['Gelo', 'Os raios deixam o alvo 30% mais lento por 2 s.'], B: ['Explosão', 'Os raios explodem num raio de 2,5 m.'] },
    hpMul: () => 1, extra: (p) => (p === 'A' ? { slowHit: true } : p === 'B' ? { explode: { damage: 10, radius: 2.5 } } : {}),
    ai: (c) => c.souls >= 3 && (c.inFight || c.roll < 0.05),
  }),
  {
    id: 's_harvest', icon: '👻', slot: 5, name: 'Colheita de almas', dmg: '—', effect: 'Puxa todas as almas no chão num raio de 50 m.', dur: 'Instantâneo', cd: 12, keepsVeil: true,
    perks: { A: ['Banquete de almas', 'Cada alma colhida cura 15 de vida do invocador e das invocações a até 15 m.'], B: ['Ímpeto', 'As invocações ganham +30% de velocidade e de dano por 8 s.'] },
    cast(S, ch, aim, p) {
      const g = S.game;
      const n = g.economy.harvest(ch, SUMMONER.harvestRange);
      ch.playOnce('Ranged_Magic_Raise', { speed: 1.8 });
      sfx('soul', S.dist(ch));
      S.fx.ring(ch.pos, 12, 0x9a6aff, 0.6);
      if (p === 'A' && n) for (const o of S.alliesNear(ch, ch.pos.x, ch.pos.z, 15)) if (o === ch || (o.summon && o.summon.owner === ch)) S.heal(o, 15 * n, ch);
      if (p === 'B') for (const o of g.characters) if (o.summon && o.summon.owner === ch && o.alive) { o.st.speedUntil = S.time + 8; o.st.speedMul = 1.3; o.st.dmgUpUntil = S.time + 8; }
      if (!n && ch.isPlayer && p !== 'B') g.hud.status('Nenhuma alma no chão a até 50 m');
    },
    ai: (c) => c.soulsNear >= 1 || (c.perk === 'B' && c.inFight && c.summons >= 2),
  },
];

export const SKILLS = {
  knight: KNIGHT,
  barbarian: BARBARIAN,
  ranger: RANGER,
  mage: MAGE,
  rogue: ROGUE,
  halberdier: HALBERDIER,
  swordsman: SWORDSMAN,
  priest: PRIEST,
  merchant: MERCHANT_SKILLS,
  summoner: SUMMONER_SKILLS,
};

export const SKILL_BY_ID = {};
for (const list of Object.values(SKILLS)) for (const s of list) SKILL_BY_ID[s.id] = s;

/** Lista de skills da classe. */
export function skillList(ch) { return SKILLS[ch.classKey] || []; }

export function cdOf(skill, perk) { return typeof skill.cd === 'function' ? skill.cd(perk) : skill.cd; }
export function soulCost(skill, perk) { return typeof skill.souls === 'function' ? skill.souls(perk) : (skill.souls || 0); }
export function energyCost(skill, perk) { return typeof skill.energy === 'function' ? skill.energy(perk) : (skill.energy || 0); }
