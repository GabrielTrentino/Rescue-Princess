// Inteligência dos bots (aliados e inimigos) e dos monstros esqueletos.
import * as THREE from 'three';
import { DIFFICULTY, SETTINGS, MAX_FAT } from './config.js';
import { hostile } from './combat.js';

const tmp = new THREE.Vector3();

function angleDiff(a, b) { let d = a - b; return Math.atan2(Math.sin(d), Math.cos(d)); }
function yawTo(from, to) { return Math.atan2(to.x - from.x, to.z - from.z); }
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

  /** Retorna direção (x,z) desejada para seguir o caminho. */
  steer(arrive = 1.8) {
    const ch = this.ch, g = ch.game;
    if (!this.goal) return null;
    if (g.time > this.repathAt) this.setGoal(this.goal, true);
    // pula waypoints visíveis
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
    // detecção de travamento
    if (g.time - this.lastCheckT > 0.8) {
      const moved = dist2d(ch.pos, this.lastCheck);
      if (moved < 0.6) {
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

// ======================================================================= bots
export class BotAI {
  constructor(ch, role) {
    this.ch = ch;
    ch.ai = this;
    this.role = role; // 'attacker' | 'defender' | 'forager'
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
    this.chargeHold = 0;
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

  reset() { this.target = null; this.nav.setGoal(null); this.mode = 'idle'; this.patrol = null; this.lane = undefined; this.rallied = false; this.rallyStart = 0; }

  canSee(o, range) {
    const ch = this.ch;
    const d = dist2d(o.pos, ch.pos);
    if (d > range) return false;
    if (o.isInvisible() && d > 3.5) return false;
    return this.game.col.los(ch.pos.x, ch.eyeY, ch.pos.z, o.pos.x, o.pos.y + 1.6, o.pos.z, ch.pos.y);
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
      if (o.carrying === captive) score -= 40; // prioridade máxima: quem carrega nossa prisioneira
      if (o.isMonster && o.ai && o.ai.target !== ch) score += 12;
      if (o.hp < o.maxHp * 0.35) score -= 5;
      if (score < bestScore) { bestScore = score; best = o; }
    }
    if (this.target && this.target.alive && this.target !== best) {
      const dt = dist2d(this.target.pos, ch.pos);
      if (dt < 34 && this.canSee(this.target, 34) && bestScore > dt - 4) best = this.target;
    }
    if (best !== this.target) this.reactUntil = g.time + this.diff.botReaction;
    this.target = best;
  }

  chooseGoal() {
    const ch = this.ch, g = this.game, O = g.objectives;
    const own = O.princessOf(ch.team);
    const captive = O.captiveOf(ch.team);
    const home = g.world.castles[ch.team];
    const T = new THREE.Vector3();

    if (ch.carrying) { this.mode = 'carry'; return T.copy(home.throne); }

    // a prisioneira foi levada pelo inimigo: todo mundo por perto persegue
    if (captive.state === 'carried' && captive.carrier) {
      const d = dist2d(captive.carrier.pos, ch.pos);
      if (this.role === 'defender' || d < 55 || (this.role === 'forager' && d < 90)) {
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
    if (own.state === 'dropped') {
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
    const rally = T.set(this.lane, 0, ch.team === 0 ? -14 : 14);
    if (ownSide && !this.rallied) {
      // reagrupa perto do rio antes de invadir (até chegar outro atacante ou passar o tempo)
      if (dist2d(rally, ch.pos) < 9) {
        if (!this.rallyStart) this.rallyStart = g.time;
        let friends = 0;
        for (const o of g.characters) if (o !== ch && o.alive && o.team === ch.team && o.ai && dist2d(o.pos, ch.pos) < 16) friends++;
        if (friends >= 2 || g.time - this.rallyStart > 14) this.rallied = true;
      }
      if (!this.rallied) return rally;
    }
    return T.copy(own.pos);
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

    // pegar a princesa / alimentar quando chegar perto
    const own = g.objectives.princessOf(ch.team);
    if (!ch.carrying && (own.state === 'captive' || own.state === 'dropped') && dist2d(own.pos, ch.pos) < 2.4) {
      own.pickUp(ch);
      this.nav.setGoal(g.world.castles[ch.team].throne, true);
    }

    const t = this.target && this.target.alive ? this.target : null;
    let fight = false;
    if (t && !ch.carrying) {
      const d = dist2d(t.pos, ch.pos);
      const ranged = ch.classKey === 'ranger' || ch.classKey === 'mage';
      const engage = (this.mode === 'attack' || this.mode === 'forage' || this.mode === 'feed' || this.mode === 'grab') ? (ranged ? 22 : 13) : (ranged ? 30 : 22);
      if (d < engage * this.diff.botAggro || this.mode === 'chase' || t.carrying) fight = true;
    }

    let wish = null;
    let face = null;
    if (fight) {
      const r = this.fight(t, dt);
      wish = r.wish; face = r.face;
    } else {
      ch.blocking = false;
      wish = this.nav.steer(this.mode === 'patrol' ? 3 : 1.5);
      this.supportAbilities();
    }

    if (wish) {
      ch.move(wish.x, wish.z, dt);
      if (!face) face = Math.atan2(wish.x, wish.z);
    } else ch.move(0, 0, dt);
    if (face !== null && face !== undefined) {
      ch.yaw += angleDiff(face, ch.yaw) * Math.min(1, dt * 10);
    }
  }

  supportAbilities() {
    const ch = this.ch, g = this.game;
    if (ch.classKey === 'mage' && ch.cd.alt <= 0) {
      for (const o of g.characters) {
        if (o.alive && o.team === ch.team && o.hp < o.maxHp * 0.6 && dist2d(o.pos, ch.pos) < 9) {
          g.combat.alt(ch, this.aimAt(o), true); break;
        }
      }
    }
    if (ch.classKey === 'rogue' && ch.cd.ability <= 0 && (this.mode === 'attack' || this.mode === 'grab')) {
      const enemyCell = g.world.castles[1 - ch.team].cellPos;
      if (dist2d(enemyCell, ch.pos) < 40) g.combat.ability(ch, this.aimAt(null));
    }
  }

  aimAt(o, projSpeed = 0) {
    const ch = this.ch;
    const origin = new THREE.Vector3(ch.pos.x, ch.eyeY - 0.3, ch.pos.z).addScaledVector(ch.forward(), 0.7);
    if (!o) return { origin, dir: ch.forward(), charge: 1 };
    const tgt = new THREE.Vector3(o.pos.x, o.pos.y + 1.3, o.pos.z);
    const d = origin.distanceTo(tgt);
    if (projSpeed > 0) {
      const tt = d / projSpeed;
      tgt.addScaledVector(o.vel, tt * this.diff.botAccuracy);
      if (projSpeed < 100 && ch.classKey === 'ranger') tgt.y += 0.5 * 9 * tt * tt; // compensa gravidade
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
    const see = g.col.los(ch.pos.x, ch.eyeY, ch.pos.z, t.pos.x, t.pos.y + 1.4, t.pos.z, ch.pos.y);
    const ready = g.time > this.reactUntil;
    let wish = null;
    const cls = ch.classKey;
    if (g.time > this.strafeUntil) { this.strafeDir = Math.random() < 0.5 ? -1 : 1; this.strafeUntil = g.time + 0.8 + Math.random() * 1.4; }
    const dirX = (t.pos.x - ch.pos.x) / (d || 1), dirZ = (t.pos.z - ch.pos.z) / (d || 1);

    if (!see) {
      this.nav.setGoal(t.pos);
      wish = this.nav.steer(1);
      return { wish, face: null };
    }

    if (cls === 'ranger' || cls === 'mage') {
      const ideal = cls === 'ranger' ? 17 : 13;
      let fx = 0, fz = 0;
      if (d > ideal + 5) { fx = dirX; fz = dirZ; }
      else if (d < ideal - 6) { fx = -dirX; fz = -dirZ; }
      fx += -dirZ * this.strafeDir * 0.7; fz += dirX * this.strafeDir * 0.7;
      const l = Math.hypot(fx, fz) || 1;
      wish = { x: fx / l, z: fz / l };
      if (ready && facing) {
        const speed = cls === 'ranger' ? 75 : 34;
        if (cls === 'mage') {
          if (d < 6.5 && ch.cd.ability <= 0) C.ability(ch, this.aimAt(t));
          else if (ch.hp < ch.maxHp * 0.55 && ch.cd.alt <= 0) C.alt(ch, this.aimAt(t), true);
          else C.attack(ch, this.aimAt(t, speed));
        } else {
          if (d > 9 && d < 26 && ch.cd.ability <= 0 && Math.random() < 0.02) C.ability(ch, this.aimAt(t, 68));
          else C.attack(ch, this.aimAt(t, speed * 0.85));
        }
      }
    } else {
      // corpo a corpo
      const range = ch.cls.attack.range;
      if (d > range * 0.8) { wish = { x: dirX, z: dirZ }; }
      else if (d < 1.4) { wish = { x: -dirX * 0.6, z: -dirZ * 0.6 }; }
      else { wish = { x: -dirZ * this.strafeDir * 0.4, z: dirX * this.strafeDir * 0.4 }; }
      if (cls === 'knight') {
        if (ready && d > 5 && d < 12 && facing && ch.cd.ability <= 0 && Math.random() < 0.05) C.ability(ch, this.aimAt(t));
        if (d < 4.5 && t.cd && t.cd.attack > 0.3 && Math.random() < 0.04 && ch.cd.attack > 0.1) this.blockUntil = g.time + 0.7;
        ch.blocking = g.time < this.blockUntil;
        C.alt(ch, null, ch.blocking);
      }
      if (cls === 'barbarian') {
        let near = 0;
        for (const o of g.characters) if (hostile(ch, o) && dist2d(o.pos, ch.pos) < 4.5) near++;
        if (ready && ch.cd.ability <= 0 && (near >= 2 || (near >= 1 && Math.random() < 0.02))) C.ability(ch, this.aimAt(t));
        else if (ready && d < 2.6 && ch.cd.alt <= 0 && Math.random() < 0.02) C.alt(ch, this.aimAt(t), true);
      }
      if (cls === 'rogue') {
        if (ready && d > 4.5 && d < 9 && ch.cd.alt <= 0 && Math.random() < 0.04) C.alt(ch, { ...this.aimAt(t), moveDir: new THREE.Vector3(dirX, 0, dirZ) }, true);
        if (ch.hp < ch.maxHp * 0.4 && ch.cd.ability <= 0) C.ability(ch, this.aimAt(t));
        // tenta rodear para atacar pelas costas
        if (d < 4 && d > 1.5) { wish = { x: dirX * 0.5 - dirZ * this.strafeDir, z: dirZ * 0.5 + dirX * this.strafeDir }; }
      }
      if (ready && d < range + t.radius && facing && !ch.blocking) C.attack(ch, this.aimAt(t));
    }
    return { wish, face: toT };
  }
}

// ======================================================================= monstros
export class MonsterAI {
  constructor(ch, home) {
    this.ch = ch;
    ch.ai = this;
    this.home = home.clone();
    this.target = null;
    this.nav = new Steering(ch);
    this.perceiveAt = 0;
    this.wanderAt = 0;
    this.wander = null;
    this.reactUntil = 0;
  }
  get game() { return this.ch.game; }
  onHurt(src) { if (src && src.alive && src.team !== this.ch.team) this.target = src; }
  reset() { this.target = null; this.wander = null; }

  update(dt) {
    const ch = this.ch, g = this.game;
    if (!ch.alive) return;
    const fromHome = dist2d(ch.pos, this.home);
    if (g.time > this.perceiveAt) {
      this.perceiveAt = g.time + 0.4;
      if (this.target && (!this.target.alive || dist2d(this.target.pos, this.home) > 34 || (this.target.isInvisible() && dist2d(this.target.pos, ch.pos) > 3))) this.target = null;
      if (!this.target) {
        let best = null, bd = 13;
        for (const o of g.characters) {
          if (!hostile(ch, o) || o.isMonster) continue;
          const d = dist2d(o.pos, ch.pos);
          if (d < bd && !o.isInvisible() && g.col.los(ch.pos.x, ch.eyeY, ch.pos.z, o.pos.x, o.pos.y + 1.5, o.pos.z, ch.pos.y)) { bd = d; best = o; }
        }
        if (best) { this.target = best; this.reactUntil = g.time + 0.4; }
      }
    }
    let wish = null, face = null;
    const t = this.target;
    if (t) {
      const d = dist2d(t.pos, ch.pos);
      face = Math.atan2(t.pos.x - ch.pos.x, t.pos.z - ch.pos.z);
      const m = ch.monster;
      const dx = (t.pos.x - ch.pos.x) / (d || 1), dz = (t.pos.z - ch.pos.z) / (d || 1);
      if (m.kind === 'ranged') {
        if (d > 15) wish = { x: dx, z: dz };
        else if (d < 7) wish = { x: -dx, z: -dz };
        if (d < m.range && g.time > this.reactUntil && Math.abs(angleDiff(face, ch.yaw)) < 0.4) {
          const origin = new THREE.Vector3(ch.pos.x, ch.eyeY - 0.2, ch.pos.z).addScaledVector(ch.forward(), 0.8);
          const tgt = new THREE.Vector3(t.pos.x, t.pos.y + 1.3, t.pos.z).addScaledVector(t.vel, d / 24 * 0.6);
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
      if (fromHome > 30) this.target = null;
    } else {
      // volta para casa e regenera
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
