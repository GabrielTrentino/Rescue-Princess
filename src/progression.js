// Progressão: XP, níveis e pontos. As 5 skills de cada classe já vêm liberadas; cada nível dá 1 ponto,
// que escolhe o perk de uma skill (um dos dois) ou, com todos os perks escolhidos, evolui uma skill para o Nível II.
import { LEVEL_XP, MAX_LEVEL, RANK2_CDR, XP } from './config.js';
import { SKILLS, skillList } from './skills.js';
import { sfx } from './audio.js';

/** Escolhas do personagem na classe atual: { [slot]: { perk: 'A'|'B'|null, rank: 1|2 } } */
export function buildOf(ch, classKey = ch.classKey) {
  if (!ch.builds[classKey]) ch.builds[classKey] = {};
  return ch.builds[classKey];
}

export function pointsTotal(ch) { return ch.level; }
export function pointsSpent(ch) {
  let n = 0;
  for (const s of Object.values(buildOf(ch))) n += (s.perk ? 1 : 0) + (s.rank >= 2 ? 1 : 0);
  return n;
}
export function pointsFree(ch) { return Math.max(0, pointsTotal(ch) - pointsSpent(ch)); }

export function slotState(ch, slot) { return buildOf(ch)[slot] || null; }
/** As skills estão sempre liberadas. */
export function isUnlocked() { return true; }

/** Perk escolhido para a skill ('A', 'B') ou null se ainda não escolheu. */
export function perkOf(ch, skill) {
  const s = slotState(ch, skill.slot);
  return s && s.perk ? s.perk : null;
}
export function rankOf(ch, slot) { const s = slotState(ch, slot); return s && s.rank >= 2 ? 2 : 1; }
/** Skills sem recarga (Mercador): o Nível II reduz 20% da energia em vez da recarga. */
export function energyMultiplier(ch, slot) { return rankOf(ch, slot) >= 2 ? 1 - RANK2_CDR : 1; }
export function cdMultiplier(ch, slot) {
  let k = 1 - ch.attrValue('cdr');
  if (rankOf(ch, slot) >= 2) k *= 1 - RANK2_CDR;
  return k;
}

export function allPerksChosen(ch) {
  return skillList(ch).every(sk => perkOf(ch, sk));
}
export function canChoosePerk(ch, skill) { return !perkOf(ch, skill) && pointsFree(ch) >= 1; }
export function canEvolve(ch, slot) {
  const s = slotState(ch, slot);
  return !!(s && s.perk && (s.rank || 1) < 2 && pointsFree(ch) >= 1 && allPerksChosen(ch));
}

/** Escolhe o perk de uma skill (gasta 1 ponto). Definitivo até o fim da partida. */
export function choosePerk(ch, skill, perk) {
  if (!canChoosePerk(ch, skill)) return false;
  const b = buildOf(ch);
  b[skill.slot] = { perk, rank: 1 };
  return true;
}

export function evolve(ch, slot) {
  if (!canEvolve(ch, slot)) return false;
  buildOf(ch)[slot].rank = 2;
  return true;
}

export function allSkillsOf(classKey) { return SKILLS[classKey] || []; }

/** Há ponto livre que possa ser gasto? */
export function hasPending(ch) {
  if (ch.isMonster || pointsFree(ch) < 1) return false;
  for (const sk of skillList(ch)) if (!perkOf(ch, sk)) return true;
  for (let slot = 1; slot <= 5; slot++) if (canEvolve(ch, slot)) return true;
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
  if (amount <= 0) return;
  ch.xp += amount;
  if (ch.isPlayer) g.hud.xpGain(amount, reason);
  let up = false;
  while (ch.level < MAX_LEVEL && ch.xp >= LEVEL_XP[ch.level + 1]) { ch.level++; up = true; }
  if (up) {
    if (ch.isPlayer) {
      sfx('levelup');
      g.announce(`Nível ${ch.level}!`, 'Novo ponto: aperte K para escolher um perk');
    } else botAutoSpend(ch);
  }
}

/** Bots gastam pontos sozinhos: perks primeiro, depois evoluções. */
export function botAutoSpend(ch) {
  let guard = 20;
  while (guard-- > 0 && pointsFree(ch) > 0) {
    const open = skillList(ch).filter(sk => !perkOf(ch, sk));
    if (open.length) { choosePerk(ch, open[Math.floor(Math.random() * open.length)], Math.random() < 0.5 ? 'A' : 'B'); continue; }
    let done = false;
    for (let slot = 1; slot <= 5 && !done; slot++) if (canEvolve(ch, slot)) { evolve(ch, slot); done = true; }
    if (!done) break;
  }
}

export { XP, skillList };
