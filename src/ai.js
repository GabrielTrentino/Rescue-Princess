// Inteligência dos bots (aliados e inimigos), dos bots Mercador, Invocador e Sacerdote, dos esqueletos e das invocações.
import * as THREE from 'three';
import { DIFFICULTY, SETTINGS, MAX_FAT, ATTR_KEYS, FORGE, FORGE_KEYS, SUMMONER, BOOST_KEYS, ITEMS } from './config.js';
import { hostile } from './combat.js';
import { skillList, SKILL_BY_ID } from './skills.js';
import { perkOf } from './progression.js';
import { canCarry } from './objectives.js';
import { craftEnergy, workCost, upgradeCost, itemKind, isUpgrade, boostPrice } from './economy.js';

function angleDiff(a, b) { let d = a - b; return Math.atan2(Math.sin(d), Math.cos(d)); }
function dist2d(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

class Steering {
  constructor(ch) {
    this.ch = ch;
    this.path = [];
    this.goal = null;
    this.repathAt = 0;
    this.stuckT = 0;
    this.lastCheck = ch.pos.clone();
    this.lastCheckT = 0;
    this.sidestep = 0;
    this.sideDir = 1;
  }

  setGoal(goal, force = false) {
    const g = this.ch.game;
    if (!goal) { this.goal = null; this.path = []; return; }
    if (!force && this.goal && dist2d(this.goal, goal) < 5 && g.time < this.repathAt) { this.goal.copy(goal); return; }
    this.goal = goal.clone();
    this.path = g.world.nav.path(this.ch.pos, this.goal);
    this.repathAt = g.time + 2.5 + Math.random();
  }

  steer(arrive = 1.8) {
    const ch = this.ch, g = ch.game;
    if (!this.goal) return null;
    if (g.time > this.repathAt) this.setGoal(this.goal, true);
    while (this.path.length > 1) {
      const n = this.path[1];
      if (dist2d(ch.pos, this.path[0]) < 3.5 || (g.col.los(ch.pos.x, 1.2, ch.pos.z, n.x, 1.2, n.z) && dist2d(ch.pos, n) < 45)) this.path.shift();
      else break;
    }
    const wp = this.path[0];
    if (!wp) return null;
    const dx = wp.x - ch.pos.x, dz = wp.z - ch.pos.z;
    const d = Math.hypot(dx, dz);
    if (this.path.length === 1 && d < arrive) return null;
    let x = dx / d, z = dz / d;
    if (g.time - this.lastCheckT > 0.8) {
      const moved = dist2d(ch.pos, this.lastCheck);
      if (moved < 0.6 && ch.speed() > 0) {
        this.stuckT++;
        if (this.stuckT >= 2) { this.sidestep = 0.9; this.sideDir = Math.random() < 0.5 ? -1 : 1; this.repathAt = 0; this.stuckT = 0; }
      } else this.stuckT = 0;
      this.lastCheck.copy(ch.pos); this.lastCheckT = g.time;
    }
    if (this.sidestep > 0) {
      this.sidestep -= g.dt;
      const sx = -z * this.sideDir, sz = x * this.sideDir;
      x = x * 0.3 + sx; z = z * 0.3 + sz;
      const l = Math.hypot(x, z); x /= l; z /= l;
    }
    return { x, z };
  }
}

const RANGED = new Set(['ranger', 'mage', 'merchant', 'priest', 'summoner']);

// ======================================================================= bots
export class BotAI {
  constructor(ch, role) {
    this.ch = ch;
    ch.ai = this;
    this.role = role; // 'attacker' | 'defender' | 'forager' | 'merchant'
    this.nav = new Steering(ch);
    this.target = null;
    this.perceiveAt = 0;
    this.goalAt = 0;
    this.mode = 'idle';
    this.patrol = null;
    this.patrolUntil = 0;
    this.strafeDir = 1;
    this.strafeUntil = 0;
    this.reactUntil = 0;
    this.blockUntil = 0;
    this.skillAt = 0;
    this.econAt = 2 + Math.random() * 2;
    this.nextShotAt = 0;
    this.draw = null;
  }

  get game() { return this.ch.game; }
  get diff() { return DIFFICULTY[SETTINGS.difficulty]; }

  onHurt(src) {
    if (!src || !src.alive || src.team === this.ch.team) return;
    if (!this.target || !this.target.alive || dist2d(src.pos, this.ch.pos) < dist2d(this.target.pos, this.ch.pos) * 0.8) {
      this.target = src;
      this.reactUntil = this.game.time + this.diff.botReaction * 0.5;
    }
  }

  reset() { this.useCannon = Math.random() < 0.6; this.target = null; this.nav.setGoal(null); this.mode = 'idle'; this.patrol = null; this.lane = undefined; this.rallied = false; this.rallyStart = 0; this.draw = null; this.roam = null; }

  canSee(o, range) {
    const ch = this.ch, g = this.game;
    const d = dist2d(o.pos, ch.pos);
    if (d > range) return false;
    if (o.isInvisible() && d > 3.5) return false;
    if (o.st && g.time < o.st.silentUntil && d > 8) return false;
    if (o.st && g.time < o.st.markedUntil && o.st.markedTeam === ch.team) return d < range; // marcado: visível através das paredes
    if (g.combat.smokeBlocks(ch.pos.x, ch.pos.z, o.pos.x, o.pos.z)) return false;
    return g.col.los(ch.pos.x, ch.eyeY, ch.pos.z, o.pos.x, o.pos.y + 1.6, o.pos.z, ch.pos.y);
  }

  perceive() {
    const ch = this.ch, g = this.game;
    const captive = g.objectives.captiveOf(ch.team);
    let best = null, bestScore = Infinity;
    for (const o of g.characters) {
      if (!hostile(ch, o)) continue;
      const d = dist2d(o.pos, ch.pos);
      const range = o.isMonster ? 14 : 34;
      if (d > range) continue;
      if (!this.canSee(o, range)) continue;
      let score = d;
      if (o.carrying === captive) score -= 40;
      if (o.isMonster && o.ai && o.ai.target !== ch && !o.summon) score += 12;
      if (o.hp < o.maxHp * 0.35) score -= 5;
      if (score < bestScore) { bestScore = score; best = o; }
    }
    // torres inimigas próximas, se não houver ninguém para lutar
    if (!best) {
      for (const s of g.structures) {
        if (!hostile(ch, s)) continue;
        const d = dist2d(s.pos, ch.pos);
        if (d < 12 && d < bestScore) { bestScore = d; best = s; }
      }
    }
    if (this.target && this.target.alive && this.target !== best && !this.target.isStructure) {
      const dt = dist2d(this.target.pos, ch.pos);
      if (dt < 34 && this.canSee(this.target, 34) && bestScore > dt - 4) best = this.target;
    }
    if (best !== this.target) { this.reactUntil = g.time + this.diff.botReaction; this.draw = null; }
    this.target = best;
  }

  chooseGoal() {
    const ch = this.ch, g = this.game, O = g.objectives;
    const own = O.princessOf(ch.team);
    const captive = O.captiveOf(ch.team);
    const home = g.world.castles[ch.team];
    const T = new THREE.Vector3();
    const carrier = canCarry(ch);

    if (ch.carrying) { this.mode = 'carry'; return T.copy(home.throne); }

    if (captive.state === 'carried' && captive.carrier) {
      const d = dist2d(captive.carrier.pos, ch.pos);
      if (this.role === 'defender' || d < 55 || (this.role === 'forager' && d < 90) || (this.role === 'merchant' && d < 35)) {
        this.mode = 'chase'; this.target = captive.carrier; return T.copy(captive.carrier.pos);
      }
    }
    if (captive.state === 'dropped') {
      const d = dist2d(captive.pos, ch.pos);
      if (this.role === 'defender' || d < 50) { this.mode = 'return'; return T.copy(captive.pos); }
    }
    if (ch.food) {
      if (captive.state === 'captive' && captive.fat < MAX_FAT) { this.mode = 'feed'; return T.copy(captive.pos); }
    }
    if (this.role === 'merchant') return this.merchantGoal(T);
    // Ladino com bomba: vai explodir uma torre inimiga
    if (ch.classKey === 'rogue' && ch.bombs > 0) {
      let tw = null, bd = 1e9;
      for (const o of g.structures) { if (!o.alive || o.team === ch.team || o.bomb) continue; const d = dist2d(o.pos, ch.pos); if (d < bd) { bd = d; tw = o; } }
      if (tw) { this.mode = 'bomb'; return T.copy(tw.pos); }
    }
    // Ladino com seringa: contamina um banquete
    if (ch.classKey === 'rogue' && ch.syringes > 0) {
      if (!this.poisonFood || !this.poisonFood.active || this.poisonFood.poison != null) {
        this.poisonFood = null;
        let bd = 110;
        for (const f of O.activeFoods()) { if (f.poison != null) continue; const d = dist2d(f.pos, ch.pos); if (d < bd) { bd = d; this.poisonFood = f; } }
      }
      if (this.poisonFood) { this.mode = 'poison'; return T.copy(this.poisonFood.pos); }
    }
    // carroça do boticário por perto
    const ap = g.economy.apothecary;
    if (ap.active && ch.syringes < 1 && (carrier || ch.classKey === 'rogue') && dist2d(ap.pos, ch.pos) < 70) { this.mode = 'forage'; return T.copy(ap.pos); }
    if (this.role === 'support') {
      // sacerdote: acompanha o aliado mais importante (quem carrega a princesa, ou o atacante mais próximo)
      let best = null, bd = 1e9;
      for (const o of g.characters) {
        if (!o.alive || o.team !== ch.team || o === ch || o.isMonster || o.isMerchant) continue;
        let d = dist2d(o.pos, ch.pos);
        if (o.carrying) d -= 200;
        if (o.ai && o.ai.role === 'attacker') d -= 20;
        if (d < bd) { bd = d; best = o; }
      }
      if (best) {
        this.mode = best.carrying ? 'escort' : 'follow';
        const behind = best.forward().multiplyScalar(-5);
        return T.copy(best.pos).add(behind);
      }
    }
    if (own.state === 'dropped' && carrier) {
      const d = dist2d(own.pos, ch.pos);
      if (this.role !== 'defender' || d < 40) { this.mode = 'grab'; return T.copy(own.pos); }
    }
    if (own.state === 'carried' && own.carrier && own.carrier !== ch) {
      if (this.role === 'attacker' || dist2d(own.carrier.pos, ch.pos) < 40) {
        this.mode = 'escort';
        const c = own.carrier;
        const behind = c.forward().multiplyScalar(-4);
        const side = new THREE.Vector3(-behind.z, 0, behind.x).normalize().multiplyScalar(((ch.id % 3) - 1) * 3);
        return T.copy(c.pos).add(behind).add(side);
      }
    }
    if (this.role === 'forager' && !ch.food && captive.fat < MAX_FAT) {
      let bestF = null, bd = 1e9;
      for (const f of O.activeFoods()) {
        const d = dist2d(f.pos, ch.pos);
        if (d < bd) { bd = d; bestF = f; }
      }
      if (bestF && bd < 170) { this.mode = 'forage'; return T.copy(bestF.pos); }
    }
    if (this.role === 'defender') {
      if (!this.patrol || g.time > this.patrolUntil) {
        const pts = home.defendPoints;
        this.patrol = pts[Math.floor(Math.random() * pts.length)];
        this.patrolUntil = g.time + 8 + Math.random() * 8;
      }
      this.mode = 'patrol';
      return T.copy(this.patrol);
    }
    // atacante: vai até a masmorra inimiga, escolhendo uma das três rotas
    this.mode = 'attack';
    if (this.lane === undefined) this.lane = [-48, 0, 0, 48][Math.floor(Math.random() * 4)];
    const ownSide = ch.team === 0 ? ch.pos.z < -9 : ch.pos.z > 9;
    // perto de casa: às vezes usa o canhão de lançamento para chegar mais rápido ao meio do mapa
    const cn = g.world.castles[ch.team].cannon;
    if (this.useCannon && cn && !this.rallied && (ch.cd.cannon || 0) <= 0 && g.world.castles[ch.team].nearWalls(ch.pos.x, ch.pos.z, 12)) {
      this.mode = 'cannon';
      const home = g.world.castles[ch.team];
      // sai pelo portão (até passar dele) e só então vai ao canhão
      const rz = ch.team === 0 ? ch.pos.z : -ch.pos.z, gz = ch.team === 0 ? home.gateOut.z : -home.gateOut.z;
      return rz < gz - 3 ? T.copy(home.gateOut) : T.copy(cn.pos);
    }
    const rally = T.set(this.lane, 0, ch.team === 0 ? -14 : 14);
    if (ownSide && !this.rallied) {
      if (dist2d(rally, ch.pos) < 9) {
        if (!this.rallyStart) this.rallyStart = g.time;
        let friends = 0;
        for (const o of g.characters) if (o !== ch && o.alive && o.team === ch.team && o.ai && !o.summon && dist2d(o.pos, ch.pos) < 16) friends++;
        if (friends >= 2 || g.time - this.rallyStart > 14) this.rallied = true;
      }
      if (!this.rallied) return rally;
    }
    // quem não carrega (ladino): ataca os defensores perto da cela, mas para do lado de fora
    if (!carrier) {
      const cell = g.world.castles[1 - ch.team].cellPos;
      return T.set(cell.x + (ch.id % 2 ? 6 : -6), 0, cell.z + (ch.team === 0 ? -14 : 14));
    }
    return T.copy(own.pos);
  }

  merchantGoal(T) {
    const g = this.game, ch = this.ch, E = g.economy;
    this.mode = 'patrol';
    // sai para minerar no veio mais próximo do próprio lado quando falta minério
    if (this.roam) {
      if (g.time > this.roamUntil || !this.roam.active || ch.ore >= 8) this.roam = null;
      else { this.mode = 'roam'; return T.copy(this.roam.pos); }
    }
    if (ch.ore < 3 && Math.random() < 0.05) {
      const side = ch.team === 0 ? -1 : 1;
      let best = null, bd = 1e9;
      for (const v of E.veins) {
        if (!v.active || Math.sign(v.pos.z) !== side) continue;
        const d = dist2d(v.pos, ch.pos);
        if (d < bd) { bd = d; best = v; }
      }
      if (best && bd < 120) { this.roam = best; this.roamUntil = g.time + 50; this.mode = 'roam'; return T.copy(best.pos); }
    }
    const s = E.stalls[ch.team].pos;
    return T.set(s.x + (ch.team === 0 ? 2.5 : -2.5), 0, s.z + (ch.team === 0 ? 3 : -3));
  }

  update(dt) {
    const ch = this.ch, g = this.game;
    if (!ch.alive) return;
    if (g.time > this.perceiveAt) { this.perceive(); this.perceiveAt = g.time + 0.25 + Math.random() * 0.15; }
    if (g.time > this.goalAt) {
      const goal = this.chooseGoal();
      this.nav.setGoal(goal);
      this.goalAt = g.time + 0.5;
    }
    if (ch.isMerchant) {
      this.merchantEconomy();
      if (this.roam && this.roam.active && dist2d(this.roam.pos, ch.pos) < 2.8 && !ch.channel) g.economy.mine(ch, this.roam);
    }
    if (ch.classKey === 'priest') this.priestRevive();
    // seringa e bomba (tecla G)
    if ((ch.syringes || ch.bombs) && g.time > (this._itemAt || 0) && !ch.channel) {
      this._itemAt = g.time + (ch.classKey === 'rogue' ? 0.15 : 0.5);
      const a = g.economy.itemAction(ch);
      if (a) g.economy.useItem(ch);
    }

    if (this.mode === 'cannon' && g.cannons.near(ch)) { g.cannons.launch(ch); this.goalAt = 0; }
    const own = g.objectives.princessOf(ch.team);
    if (!ch.carrying && canCarry(ch) && (own.state === 'captive' || own.state === 'dropped') && dist2d(own.pos, ch.pos) < 2.4) {
      own.pickUp(ch);
      this.nav.setGoal(g.world.castles[ch.team].throne, true);
    }

    if (ch.channel || ch.isStunned()) { ch.move(0, 0, dt); return; }

    const t = this.target && this.target.alive ? this.target : null;
    let fight = false;
    if (t && !ch.carrying) {
      const d = dist2d(t.pos, ch.pos);
      const ranged = RANGED.has(ch.classKey);
      const engage = (this.mode === 'attack' || this.mode === 'forage' || this.mode === 'feed' || this.mode === 'grab') ? (ranged ? 22 : 13) : (ranged ? 30 : 22);
      if (d < engage * this.diff.botAggro || this.mode === 'chase' || t.carrying) fight = true;
      // Ladino em missão (bomba ou veneno): evita brigas, só reage a quem está colado nele
      if ((this.mode === 'bomb' || this.mode === 'poison') && d > 3.5 && !t.carrying) fight = false;
    }

    let wish = null;
    let face = null;
    if (fight) {
      const r = this.fight(t, dt);
      wish = r.wish; face = r.face;
    } else {
      ch.blocking = false;
      g.combat.endLink(ch);
      this.draw = null;
      wish = this.nav.steer(this.mode === 'patrol' || this.mode === 'follow' ? 3 : 1.5);
      this.useSkills(null, 99, false);
      // invocador: marcha quando o time avança junto
      if (ch.isSummoner && (ch.cd.march || 0) <= 0 && (this.mode === 'attack' || this.mode === 'escort') && Math.random() < 0.01) {
        let n = 0; for (const o of g.characters) if (o.alive && o.team === ch.team && !o.isMonster && dist2d(o.pos, ch.pos) < 12) n++;
        if (n >= 3) g.combat.march(ch);
      }
    }

    if (wish) {
      ch.move(wish.x, wish.z, dt);
      if (!face) face = Math.atan2(wish.x, wish.z);
    } else ch.move(0, 0, dt);
    if (face !== null && face !== undefined) {
      ch.yaw += angleDiff(face, ch.yaw) * Math.min(1, dt * 10);
    }
  }

  // ------------------------------------------------------------ skills
  context(t, d, facing) {
    const ch = this.ch, g = this.game;
    let near = 0, alliesNear = 0, allyLow = false, targetNear = 0;
    for (const o of g.characters) {
      if (!o.alive) continue;
      const dd = dist2d(o.pos, ch.pos);
      if (hostile(ch, o) && dd < 4.8) near++;
      if (o.team === ch.team && o !== ch && dd < 10) { alliesNear++; if (o.hp < o.maxHp * 0.6 && dd < 9) allyLow = true; }
      if (t && hostile(ch, o) && dist2d(o.pos, t.pos) < 5) targetNear++;
    }
    const enemyCell = g.world.castles[1 - ch.team].cellPos;
    const own = g.objectives.princessOf(ch.team);
    let soulsNear = 0, summons = 0, allyDebuffed = false;
    if (ch.isSummoner) {
      for (const s of g.economy.souls) { const dd = s.pos.distanceTo(ch.pos); if (dd < SUMMONER.harvestRange && dd > 3) soulsNear += s.value; }
      for (const o of g.characters) if (o.summon && o.summon.owner === ch && o.alive) summons++;
    }
    if (ch.classKey === 'priest') {
      const now = g.time;
      for (const o of g.characters) {
        if (!o.alive || o.team !== ch.team || dist2d(o.pos, ch.pos) > 10) continue;
        if (now < o.st.stunUntil || now < o.st.rootUntil || (o.st.poison && now < o.st.poison.until) || (o.st.bleed && now < o.st.bleed.until) || now < o.st.slowUntil) { allyDebuffed = true; break; }
      }
    }
    return {
      t, d, facing, near, alliesNear, allyLow, targetNear,
      hp: ch.hp / ch.maxHp,
      inFight: !!t,
      roll: Math.random(),
      mode: this.mode,
      targetCarrier: !!(t && t.carrying),
      targetAttacking: !!(t && t.cd && t.cd.attack > 0.15 && d < 4),
      nearEnemyCell: dist2d(enemyCell, ch.pos) < 40,
      princessDroppedNear: own.state === 'dropped' && dist2d(own.pos, ch.pos) < 9,
      carrierEscort: this.mode === 'escort',
      souls: ch.souls, soulsNear, summons, allyDebuffed,
      inCity: g.world.castles[ch.team].inside(ch.pos.x, ch.pos.z),
      facingOk: facing,
    };
  }

  useSkills(t, d, facing) {
    const ch = this.ch, g = this.game, C = g.combat;
    if (g.time < this.skillAt || ch.carrying) return;
    this.skillAt = g.time + 0.3 + Math.random() * 0.25;
    if (Math.random() > this.diff.botSkill) return;
    const ctx = this.context(t, d, facing);
    for (const sk of skillList(ch)) {
      if (sk.menu) continue;
      const perk = perkOf(ch, sk);
      if ((ch.cd[sk.id] || 0) > 0) continue;
      if (!sk.ai) continue;
      ctx.perk = perk;
      let ok = false;
      try { ok = sk.ai(ctx, perk); } catch (e) { ok = false; }
      if (!ok) continue;
      const aim = this.aimAt(t, sk.id === 'ranger_pierce' ? 140 : sk.id.startsWith('ranger') ? 68 : 40);
      aim.target = t;
      aim.point = t ? new THREE.Vector3(t.pos.x, t.pos.y, t.pos.z).addScaledVector(t.vel || new THREE.Vector3(), 1.0) : null;
      if (sk.id === 'mage_shield' || sk.id === 'p_bless') aim.ally = this.lowestAlly(20) || ch;
      if (sk.id === 'p_light' && !t) { const a = this.lowestAlly(30); if (!a) continue; Object.assign(aim, this.aimAt(a, 60)); }
      if (sk.id === 'mage_blink' && t) { aim.moveDir = new THREE.Vector3(ch.pos.x - t.pos.x, 0, ch.pos.z - t.pos.z).normalize(); aim.useMove = true; }
      if (sk.id === 'rogue_dash' && t) aim.moveDir = new THREE.Vector3(t.pos.x - ch.pos.x, 0, t.pos.z - ch.pos.z).normalize();
      if (C.useSkill(ch, sk.slot, aim) === true) break;
    }
  }

  lowestAlly(range) {
    const ch = this.ch;
    let best = null, br = 0.7;
    for (const o of this.game.characters) {
      if (!o.alive || o.team !== ch.team || o === ch || o.isStructure) continue;
      if (dist2d(o.pos, ch.pos) > range) continue;
      const r = o.hp / o.maxHp;
      if (r < br) { br = r; best = o; }
    }
    return best;
  }

  aimAt(o, projSpeed = 0) {
    const ch = this.ch;
    const origin = new THREE.Vector3(ch.pos.x, ch.eyeY - 0.3, ch.pos.z).addScaledVector(ch.forward(), 0.7);
    if (!o) return { origin, dir: ch.forward(), charge: 1 };
    const tgt = new THREE.Vector3(o.pos.x, o.pos.y + (o.isStructure ? 2.5 : 1.3), o.pos.z);
    const d = origin.distanceTo(tgt);
    if (projSpeed > 0 && o.vel) {
      const tt = d / projSpeed;
      tgt.addScaledVector(o.vel, tt * this.diff.botAccuracy);
      if (projSpeed < 100 && ch.classKey === 'ranger') tgt.y += 0.5 * 9 * tt * tt;
    }
    const err = (1 - this.diff.botAccuracy) * (0.6 + d * 0.06);
    tgt.x += (Math.random() - 0.5) * err * 2; tgt.y += (Math.random() - 0.5) * err; tgt.z += (Math.random() - 0.5) * err * 2;
    const dir = tgt.sub(origin).normalize();
    return { origin, dir, charge: 0.55 + Math.random() * 0.45 };
  }

  fight(t, dt) {
    const ch = this.ch, g = this.game, C = g.combat;
    const d = dist2d(t.pos, ch.pos);
    const toT = Math.atan2(t.pos.x - ch.pos.x, t.pos.z - ch.pos.z);
    const facing = Math.abs(angleDiff(toT, ch.yaw)) < 0.45;
    const see = t.isStructure || g.col.los(ch.pos.x, ch.eyeY, ch.pos.z, t.pos.x, t.pos.y + 1.4, t.pos.z, ch.pos.y);
    const ready = g.time > this.reactUntil;
    let wish = null;
    const cls = ch.classKey;
    if (g.time > this.strafeUntil) { this.strafeDir = Math.random() < 0.5 ? -1 : 1; this.strafeUntil = g.time + 0.8 + Math.random() * 1.4; }
    const dirX = (t.pos.x - ch.pos.x) / (d || 1), dirZ = (t.pos.z - ch.pos.z) / (d || 1);

    if (!see) {
      g.combat.endLink(ch);
      this.draw = null;
      this.nav.setGoal(t.pos);
      wish = this.nav.steer(1);
      return { wish, face: null };
    }
    if (ready) this.useSkills(t, d, facing);

    if (RANGED.has(cls)) {
      const ideal = cls === 'ranger' ? 17 : cls === 'merchant' ? 14 : 13;
      let fx = 0, fz = 0;
      if (d > ideal + 5) { fx = dirX; fz = dirZ; }
      else if (d < ideal - 6) { fx = -dirX; fz = -dirZ; }
      fx += -dirZ * this.strafeDir * 0.7; fz += dirX * this.strafeDir * 0.7;
      const l = Math.hypot(fx, fz) || 1;
      wish = { x: fx / l, z: fz / l };
      if (cls === 'summoner') this.summonerFight(t, d, ready);
      else if (ready && facing) this.rangedFire(t);
    } else {
      const range = ch.attackDef().range + (t.isStructure ? 1 : 0);
      if (d > range * 0.8) { wish = { x: dirX, z: dirZ }; }
      else if (d < 1.4) { wish = { x: -dirX * 0.6, z: -dirZ * 0.6 }; }
      else { wish = { x: -dirZ * this.strafeDir * 0.4, z: dirX * this.strafeDir * 0.4 }; }
      // bloqueio quando o alvo está golpeando de perto
      if (ch.cls.block > 0 && !t.isStructure) {
        const chance = cls === 'knight' ? 0.05 : 0.025;
        if (d < 4.5 && t.cd && t.cd.attack > 0.3 && Math.random() < chance && ch.cd.attack > 0.1) this.blockUntil = g.time + 0.7;
        C.block(ch, g.time < this.blockUntil);
      }
      if (cls === 'rogue' && d < 4 && d > 1.5) { wish = { x: dirX * 0.5 - dirZ * this.strafeDir, z: dirZ * 0.5 + dirX * this.strafeDir }; }
      if (ready && d < range + t.radius && facing && !ch.blocking) C.attack(ch, this.aimAt(t));
    }
    return { wish, face: toT };
  }

  /** Tiro dos bots à distância, com tempo de reação: a arqueira tensiona o arco antes de soltar e todos pausam entre tiros. */
  rangedFire(t) {
    const ch = this.ch, g = this.game, C = g.combat, a = ch.attackDef();
    if (g.time < this.nextShotAt || ch.cd.attack > 0) return;
    const pause = this.diff.botFirePause;
    if (a.type === 'arrow') {
      if (!this.draw) { this.draw = { start: g.time, need: 0.5 + Math.random() * 0.6 }; return; }
      ch.charge = Math.min(1, (g.time - this.draw.start) / a.chargeTime);
      if (g.time - this.draw.start < this.draw.need) return;
      const aim = this.aimAt(t, a.speed * (0.6 + 0.4 * ch.charge) * 0.9);
      aim.charge = ch.charge;
      C.attack(ch, aim);
      this.draw = null; ch.charge = 0;
      this.nextShotAt = g.time + (0.7 + Math.random() * 0.9) * pause;
      return;
    }
    if (C.attack(ch, this.aimAt(t, a.speed || 40))) this.nextShotAt = g.time + (0.25 + Math.random() * 0.5) * pause;
  }

  /** Invocador: liga o Elo de almas no alvo para gerar almas e deixa as invocações lutarem. */
  summonerFight(t, d, ready) {
    const ch = this.ch, g = this.game, C = g.combat;
    if (ready && !t.isStructure && d < SUMMONER.linkRange - 1 && ch.souls < SUMMONER.soulsMax - 1) C.soulLink(ch, true, { ...this.aimAt(t), target: t }, g.dt);
    else C.endLink(ch);
  }

  /** Sacerdote: ressuscita um aliado morto que ainda vai demorar a renascer. */
  priestRevive() {
    const ch = this.ch, g = this.game, sk = SKILL_BY_ID.p_revive;
    if ((ch.cd[sk.id] || 0) > 0 || (this.target && this.target.alive && dist2d(this.target.pos, ch.pos) < 12)) return;
    if (g.time < (this._revAt || 0)) return;
    this._revAt = g.time + 1;
    const dead = g.characters.find(o => !o.alive && o.team === ch.team && !o.isMonster && o !== ch && o.respawnAt - g.time > 3);
    if (dead) g.economy.revive(ch, dead);
  }

  merchantEconomy() {
    const ch = this.ch, g = this.game, E = g.economy, t = g.time;
    if (t < this.econAt || ch.channel) return;
    this.econAt = t + 1.5 + Math.random();
    if (!E.inCity(ch)) return;
    if (this.target && this.target.alive && dist2d(this.target.pos, ch.pos) < 20) return;
    const stall = E.stalls[ch.team];
    while (stall.depot.length && ch.backpack.length < ch.backpackSize) E.fromDepot(ch, 0);
    const team = g.characters.filter(o => o.team === ch.team && o.cls && !o.isMerchant);
    const wanted = (it) => team.some(o => isUpgrade(o, it));
    // itens parados há muito tempo, ou que ninguém do time quer: retira e desmancha
    for (let i = stall.slots.length - 1; i >= 0; i--) {
      const sl = stall.slots[i];
      if (t - (sl.at || 0) < 150 && wanted(sl.item)) continue;
      if (ch.backpack.length >= ch.backpackSize) break;
      E.withdraw(ch, i);
      E.scrap(ch, ch.backpack.length - 1);
      break;
    }
    const vault = E.vault[ch.team];
    // Reino (melhorias globais do time) e Oficina individual, alternando, se sobrar ouro no cofre
    const wperk = perkOf(ch, SKILL_BY_ID.m_works);
    const bs = E.boosts[ch.team];
    let bk = null, bp = Infinity;
    for (const k of BOOST_KEYS) { const p = boostPrice(bs[k], wperk); if (p !== null && p < bp) { bp = p; bk = k; } }
    const f = ch.forge;
    let fk = null;
    for (const k of ['luck1', 'master', 'jeweler', 'shelf', 'luck2', 'refine', 'legend', 'luck3']) {
      const def = FORGE[k];
      if (f[k] || (def.req && !f[def.req])) continue;
      fk = k; break;
    }
    const preferBoost = (this._buyFlip = !this._buyFlip);
    if (bk && preferBoost && vault >= bp + 350) { E.buyBoost(ch, bk); return; }
    if (fk && vault >= FORGE[fk].cost + 400) { E.buyForge(ch, fk); return; }
    if (bk && vault >= bp + 350) { E.buyBoost(ch, bk); return; }
    // obras
    if (!E.building[ch.team]) {
      if (E.towers[ch.team].some(tw => !tw.alive) && vault > 400) { E.rebuildTowers(ch); return; }
      const order = ['towers', 'barracks', 'treasury', 'banner', 'ossuary', 'towers', 'barracks', 'banner', 'treasury', 'towers', 'barracks', 'banner', 'ossuary'];
      for (const key of order) {
        const cost = workCost(key, E.works[ch.team][key], wperk);
        if (!cost) continue;
        if (vault >= cost.gold + 60 && ch.energy >= cost.energy + 5) { E.startWork(ch, key); return; }
        break;
      }
    }
    // expõe o que alguém do time quer; desmancha o resto
    const max = E.stallSlotsMax(ch.team);
    for (let i = ch.backpack.length - 1; i >= 0; i--) {
      const it = ch.backpack[i];
      if (!wanted(it)) { E.scrap(ch, i); continue; }
      if (stall.slots.length >= max) continue;
      const mode = ch.energy < 45 ? 'discount' : ch.energy > 80 ? 'overcharge' : 'normal';
      if (E.expose(ch, i, mode) !== true) E.expose(ch, i, 'discount');
    }
    // aprimora peças boas com minério (aba Aprimorar da Oficina)
    if (ch.energy > 50) {
      const i = ch.backpack.findIndex(it => it.lvl < 3 && it.rarity >= 1);
      if (i >= 0) {
        const c = upgradeCost(ch.backpack[i].lvl + 1, ch.forge.jeweler);
        if (ch.energy >= c.energy + 20 && ch.ore >= c.ore) { E.upgrade(ch, { bag: i }); return; }
      }
    }
    const craft = SKILL_BY_ID.m_craft, cperk = perkOf(ch, craft);
    // seringas: mantém o estoque da banca
    if (E.syringeStock[ch.team] < 2 && ch.ore >= ITEMS.syringe.craftOre + 1 && ch.energy >= craftEnergy('syringe', cperk) + 15) { E.craft(ch, { kind: 'syringe' }); return; }
    // fabrica para quem do time está pior equipado (arma, peitoral ou capacete)
    if (ch.backpack.length < ch.backpackSize && stall.slots.length < max) {
      const onSale = new Set(stall.slots.map(sl => itemKind(sl.item) + ':' + (sl.item.cls || '')));
      const needs = [];
      for (const o of team) {
        if (!o.weapon && !onSale.has('weapon:' + o.classKey)) needs.push({ kind: 'weapon', cls: o.classKey });
        if (!o.body && !onSale.has('body:')) needs.push({ kind: 'body' });
        if (!o.helmet && !onSale.has('helmet:')) needs.push({ kind: 'helmet' });
      }
      if (!needs.length) return;
      const n = needs[Math.floor(Math.random() * needs.length)];
      if (craftEnergy(n.kind, cperk) <= ch.energy - 10) E.craft(ch, { kind: n.kind, cls: n.cls, attr: ATTR_KEYS[Math.floor(Math.random() * ATTR_KEYS.length)] });
    }
  }
}

// ======================================================================= monstros e invocações
export class MonsterAI {
  constructor(ch, home) {
    this.ch = ch;
    ch.ai = this;
    this.home = home ? home.clone() : null;
    this.target = null;
    this.nav = new Steering(ch);
    this.perceiveAt = 0;
    this.wanderAt = 0;
    this.wander = null;
    this.reactUntil = 0;
  }
  get game() { return this.ch.game; }
  onHurt(src) { if (src && src.alive && src.team !== this.ch.team && !src.isStructure) this.target = src; }
  reset() { this.target = null; this.wander = null; }

  /** Âncora: a casa (acampamento) ou a própria posição (invocações avançam sem coleira). */
  anchor() { return this.ch.summon ? this.ch.pos : this.home; }

  update(dt) {
    const ch = this.ch, g = this.game;
    if (!ch.alive) return;
    const summon = ch.summon;
    const anchor = this.anchor();
    const fromHome = dist2d(ch.pos, anchor);
    const leash = summon ? 26 : 34;
    if (g.time > this.perceiveAt) {
      this.perceiveAt = g.time + 0.4;
      if (this.target && (!this.target.alive || dist2d(this.target.pos, anchor) > leash || (this.target.isInvisible() && dist2d(this.target.pos, ch.pos) > 3))) this.target = null;
      if (!this.target) {
        let best = null, bd = summon ? 18 : 13;
        for (const o of g.characters) {
          if (!hostile(ch, o)) continue;
          if (!summon && o.isMonster && !o.summon) continue;
          const d = dist2d(o.pos, ch.pos);
          if (d < bd && !o.isInvisible() && g.col.los(ch.pos.x, ch.eyeY, ch.pos.z, o.pos.x, o.pos.y + 1.5, o.pos.z, ch.pos.y)) { bd = d; best = o; }
        }
        if (summon && !best) {
          const la = summon.owner.lastAttacker;
          if (la && la.alive && hostile(ch, la) && g.time - summon.owner.lastHurt < 4 && dist2d(la.pos, ch.pos) < 25) best = la;
        }
        if (best) { this.target = best; this.reactUntil = g.time + 0.4; }
      }
    }
    if (ch.isStunned()) { ch.move(0, 0, dt); return; }
    let wish = null, face = null;
    const t = this.target;
    if (t) {
      const d = dist2d(t.pos, ch.pos);
      face = Math.atan2(t.pos.x - ch.pos.x, t.pos.z - ch.pos.z);
      const m = ch.monster;
      const dx = (t.pos.x - ch.pos.x) / (d || 1), dz = (t.pos.z - ch.pos.z) / (d || 1);
      if (m.kind === 'ranged') {
        const range = m.range * (summon && summon.rangeMul ? summon.rangeMul : 1);
        if (d > range - 3) wish = { x: dx, z: dz };
        else if (d < 7) wish = { x: -dx, z: -dz };
        if (d < range && g.time > this.reactUntil && Math.abs(angleDiff(face, ch.yaw)) < 0.4) {
          const origin = new THREE.Vector3(ch.pos.x, ch.eyeY - 0.2, ch.pos.z).addScaledVector(ch.forward(), 0.8);
          const sp = m.proj === 'arrow' ? 55 : 24;
          const tgt = new THREE.Vector3(t.pos.x, t.pos.y + 1.3, t.pos.z).addScaledVector(t.vel, d / sp * 0.6);
          if (m.proj === 'arrow') tgt.y += 0.5 * 4 * (d / sp) ** 2;
          g.combat.attack(ch, { origin, dir: tgt.sub(origin).normalize() });
        }
      } else {
        if (d > m.range * 0.8) {
          this.nav.setGoal(t.pos);
          wish = this.nav.steer(0.5) || { x: dx, z: dz };
        }
        if (d < m.range + t.radius && g.time > this.reactUntil && Math.abs(angleDiff(face, ch.yaw)) < 0.5) {
          g.combat.attack(ch, { origin: ch.chest, dir: new THREE.Vector3(dx, 0, dz) });
        }
      }
      if (!summon && fromHome > 30) this.target = null;
    } else if (summon) {
      // avança contra o inimigo: vai até a masmorra do outro castelo pela rota mais curta
      if (!this.goal || g.time > (this.goalAt || 0)) {
        const cell = g.world.castles[1 - ch.team].cellPos;
        this.goal = new THREE.Vector3(cell.x + (Math.random() - 0.5) * 8, 0, cell.z + (ch.team === 0 ? -8 : 8));
        this.goalAt = g.time + 4;
        this.nav.setGoal(this.goal);
      }
      wish = this.nav.steer(3) || null;
      if (wish) { wish.x *= 0.85; wish.z *= 0.85; }
    } else {
      if (fromHome > 4) {
        const dx = this.home.x - ch.pos.x, dz = this.home.z - ch.pos.z, l = Math.hypot(dx, dz);
        wish = { x: dx / l, z: dz / l };
      } else {
        ch.hp = Math.min(ch.maxHp, ch.hp + dt * 15);
        if (!this.wander || g.time > this.wanderAt) {
          const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 5;
          this.wander = new THREE.Vector3(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r);
          this.wanderAt = g.time + 3 + Math.random() * 4;
        }
        const dx = this.wander.x - ch.pos.x, dz = this.wander.z - ch.pos.z, l = Math.hypot(dx, dz);
        if (l > 1) wish = { x: dx / l * 0.35, z: dz / l * 0.35 };
      }
    }
    if (wish) { ch.move(wish.x, wish.z, dt); if (face === null) face = Math.atan2(wish.x, wish.z); }
    else ch.move(0, 0, dt);
    if (face !== null) ch.yaw += angleDiff(face, ch.yaw) * Math.min(1, dt * 8);
  }
}
