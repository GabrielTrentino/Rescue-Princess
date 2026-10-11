// Progressão: XP, níveis, pontos de habilidade, desbloqueio de skills, perks e evolução (Nível II).
import { LEVEL_XP, MAX_LEVEL, SLOT_LEVEL, RANK2_CDR, XP } from './config.js';
import { SKILLS, skillList } from './skills.js';
import { sfx } from './audio.js';

/** Build (escolhas) do personagem na classe atual: { [slot]: { perks: {skillId: 'A'|'B'}, rank: 1|2 } } */
export function buildOf(ch, classKey = ch.classKey) {
  if (!ch.builds[classKey]) ch.builds[classKey] = {};
  return ch.builds[classKey];
}

export function pointsTotal(ch) { return ch.level; }
export function pointsSpent(ch) {
  let n = 0;
  for (const s of Object.values(buildOf(ch))) n += s.rank || 0;
  return n;
}
export function pointsFree(ch) { return Math.max(0, pointsTotal(ch) - pointsSpent(ch)); }

export function slotState(ch, slot) { return buildOf(ch)[slot] || null; }
export function isUnlocked(ch, slot) { const s = slotState(ch, slot); return !!(s && s.rank >= 1); }

/** Perk escolhido para a skill, ou undefined se a skill ainda não pode ser usada. */
export function perkOf(ch, skill) {
  const s = slotState(ch, skill.slot);
  if (!s || !s.rank) return undefined;
  return s.perks[skill.id];
}
export function rankOf(ch, slot) { const s = slotState(ch, slot); return s ? s.rank || 0 : 0; }
export function cdMultiplier(ch, slot) {
  let k = 1 - ch.attrValue('cdr');
  if (rankOf(ch, slot) >= 2) k *= 1 - RANK2_CDR;
  return k;
}

export function canUnlock(ch, slot) {
  return !isUnlocked(ch, slot) && ch.level >= SLOT_LEVEL[slot] && pointsFree(ch) >= 1;
}
export function canEvolve(ch, slot) {
  const s = slotState(ch, slot);
  return !!(s && s.rank === 1 && pointsFree(ch) >= 1 && Object.keys(s.perks).length > 0);
}

/** Escolhe o perk de uma skill. Se o slot estiver bloqueado, desbloqueia (gasta 1 ponto). */
export function choosePerk(ch, skill, perk) {
  const b = buildOf(ch);
  const s = b[skill.slot];
  if (s && s.rank) {
    if (s.perks[skill.id]) return false; // perk definitivo até o fim da partida
    s.perks[skill.id] = perk;
    return true;
  }
  if (!canUnlock(ch, skill.slot)) return false;
  b[skill.slot] = { rank: 1, perks: { [skill.id]: perk } };
  return true;
}

export function evolve(ch, slot) {
  if (!canEvolve(ch, slot)) return false;
  buildOf(ch)[slot].rank = 2;
  return true;
}

/** Lista de skills de todas as listas da classe (o Mercador tem dois modos). */
export function allSkillsOf(classKey) {
  if (classKey === 'merchant') return [...SKILLS.merchant, ...SKILLS.summoner];
  return SKILLS[classKey] || [];
}

/** Há escolha pendente (ponto livre usável ou perk sem escolher)? */
export function hasPending(ch) {
  if (ch.isMonster) return false;
  for (const sk of allSkillsOf(ch.classKey)) {
    const s = slotState(ch, sk.slot);
    if (s && s.rank && !s.perks[sk.id]) return true;
  }
  for (let slot = 1; slot <= 5; slot++) if (canUnlock(ch, slot)) return true;
  return false;
}

export function xpToNext(ch) {
  if (ch.level >= MAX_LEVEL) return null;
  return { have: ch.xp - LEVEL_XP[ch.level], need: LEVEL_XP[ch.level + 1] - LEVEL_XP[ch.level] };
}

/** Dá XP (com bônus do Estandarte). Invocações passam o XP para o dono. */
export function addXp(ch, amount, reason = '') {
  if (!ch) return;
  if (ch.summon) ch = ch.summon.owner;
  if (!ch || ch.isMonster || ch.isStructure) return;
  const g = ch.game;
  const banner = g.economy ? g.economy.workLevel(ch.team, 'banner') : 0;
  amount = Math.round(amount * (1 + 0.1 * banner));
  ch.xp += amount;
  if (ch.isPlayer && amount > 0) g.hud.xpGain(amount, reason);
  let up = false;
  while (ch.level < MAX_LEVEL && ch.xp >= LEVEL_XP[ch.level + 1]) { ch.level++; up = true; }
  if (up) {
    if (ch.isPlayer) {
      sfx('levelup');
      g.announce(`Nível ${ch.level}!`, hasPending(ch) ? 'Aperte K para escolher skills e perks' : 'Ponto de habilidade ganho (K)');
    }
    if (!ch.isPlayer) botAutoSpend(ch);
  }
}

/** Bots gastam pontos sozinhos: desbloqueiam o próximo slot, depois evoluem. */
export function botAutoSpend(ch) {
  const list = allSkillsOf(ch.classKey);
  let guard = 20;
  while (guard-- > 0) {
    let done = false;
    for (const sk of list) {
      const s = slotState(ch, sk.slot);
      if (s && s.rank && !s.perks[sk.id]) { s.perks[sk.id] = Math.random() < 0.5 ? 'A' : 'B'; done = true; }
    }
    for (let slot = 1; slot <= 5 && !done; slot++) {
      if (canUnlock(ch, slot)) {
        const sk = list.find(s => s.slot === slot);
        choosePerk(ch, sk, Math.random() < 0.5 ? 'A' : 'B');
        done = true;
      }
    }
    for (let slot = 1; slot <= 5 && !done; slot++) if (canEvolve(ch, slot)) { evolve(ch, slot); done = true; }
    if (!done) break;
  }
}

export { XP, skillList };
