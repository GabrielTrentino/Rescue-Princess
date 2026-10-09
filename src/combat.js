// Combate: ataques corpo a corpo, projéteis, habilidades, dano e cura.
import * as THREE from 'three';
import { cloneModel } from './assets.js';
import { TEAM, DIFFICULTY, SETTINGS } from './config.js';
import { heightAt } from './world.js';
import { sfx } from './audio.js';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

export function hostile(a, b) {
  return a !== b && a.team !== b.team && a.alive && b.alive;
}

// distância entre segmentos 3D (para colisão projétil x cápsula)
function segSegDist2(p1, q1, p2, q2) {
  const d1 = _v.subVectors(q1, p1), d2 = _w.subVectors(q2, p2);
  const rx = p1.x - p2.x, ry = p1.y - p2.y, rz = p1.z - p2.z;
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.x * rx + d2.y * ry + d2.z * rz;
  let s, t;
  if (a <= 1e-9 && e <= 1e-9) return rx * rx + ry * ry + rz * rz;
  if (a <= 1e-9) { s = 0; t = Math.min(1, Math.max(0, f / e)); }
  else {
    const c = d1.x * rx + d1.y * ry + d1.z * rz;
    if (e <= 1e-9) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
    else {
      const b = d1.dot(d2), den = a * e - b * b;
      s = den !== 0 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
      else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
    }
  }
  const cx = p1.x + d1.x * s - (p2.x + d2.x * t);
  const cy = p1.y + d1.y * s - (p2.y + d2.y * t);
  const cz = p1.z + d1.z * s - (p2.z + d2.z * t);
  return cx * cx + cy * cy + cz * cz;
}

export class Combat {
  constructor(game) {
    this.game = game;
    this.projectiles = [];
    this.pending = []; // golpes com atraso (sincronizados com a animação)
    this.fireballMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a });
    this.fireGlowMat = new THREE.MeshBasicMaterial({ color: 0xffd25a, transparent: true, opacity: 0.5, depthWrite: false });
    this.boltMat = new THREE.MeshBasicMaterial({ color: 0xb46bff });
    this.ballGeo = new THREE.SphereGeometry(0.35, 12, 8);
  }

  get diff() { return DIFFICULTY[SETTINGS.difficulty]; }

  // ------------------------------------------------------------ ações
  /** Ataque principal. aim = {origin: Vector3, dir: Vector3 normalizado, charge: 0..1} */
  attack(ch, aim) {
    if (!ch.alive || ch.carrying || ch.cd.attack > 0 || ch.dash) return false;
    const c = ch.cls;
    if (ch.isInvisible()) ch.status.invisUntil = 0;
    if (ch.isMonster) return this.monsterAttack(ch, aim);
    const a = c.attack;
    ch.cd.attack = a.cooldown;
    ch.blocking = false;
    if (a.type === 'melee') {
      ch.playOnce(a.anim, { speed: 1.5 });
      sfx(c.key === 'barbarian' ? 'heavy' : 'swing', this.dist(ch));
      this.pending.push({ at: this.game.time + a.hitDelay, fn: () => this.meleeHit(ch, { damage: a.damage, range: a.range, arc: a.arc, backstab: a.backstab, dir: aim.dir }) });
    } else if (a.type === 'arrow') {
      ch.playOnce(a.anim, { speed: 1.6 });
      const k = Math.min(1, aim.charge || 0);
      const dmg = a.damageMin + (a.damageMax - a.damageMin) * k;
      this.spawnArrow(ch, aim.origin, aim.dir, a.speed * (0.6 + 0.4 * k), dmg);
      sfx('bow', this.dist(ch));
    } else if (a.type === 'fireball') {
      ch.playOnce(a.anim, { speed: 1.5 });
      this.spawnFireball(ch, aim.origin, aim.dir, a);
      sfx('fire', this.dist(ch));
    }
    return true;
  }

  /** Ação secundária (botão direito). */
  alt(ch, aim, held) {
    if (!ch.alive || ch.isMonster) return false;
    const a = ch.cls.alt;
    if (a.type === 'block') { ch.blocking = held && !ch.carrying && !ch.dash; return ch.blocking; }
    if (a.type === 'zoom') return held;
    if (!held || ch.cd.alt > 0 || ch.carrying || ch.dash) return false;
    ch.cd.alt = a.cooldown;
    if (a.type === 'heal') {
      ch.playOnce('Ranged_Magic_Raise', { speed: 1.6 });
      sfx('heal', this.dist(ch));
      let n = 0;
      for (const o of this.game.characters) {
        if (!o.alive || o.team !== ch.team) continue;
        if (o.pos.distanceTo(ch.pos) > a.radius) continue;
        this.heal(o, a.amount, ch); n++;
      }
      this.game.effects.ring(ch.pos, a.radius, 0x6dff8a, 0.7);
      return true;
    }
    if (a.type === 'kick') {
      ch.playOnce('Melee_Unarmed_Attack_Kick', { speed: 1.6 });
      sfx('swing', this.dist(ch));
      this.pending.push({ at: this.game.time + 0.2, fn: () => this.meleeHit(ch, { damage: a.damage, range: a.range, arc: 1.4, knock: a.knock, dir: aim.dir }) });
      return true;
    }
    if (a.type === 'dash') {
      const d = aim.moveDir && aim.moveDir.lengthSq() > 0.01 ? aim.moveDir.clone() : ch.forward();
      d.y = 0; d.normalize();
      ch.dash = { dir: d, speed: 32, time: a.distance / 32 };
      ch.playOnce('Jump_Full_Short', { speed: 2 });
      sfx('dash', this.dist(ch));
      this.game.effects.puff(ch.chest, 0xdddddd);
      return true;
    }
    return false;
  }

  /** Habilidade especial (Q). */
  ability(ch, aim) {
    if (!ch.alive || ch.isMonster || ch.cd.ability > 0 || ch.carrying || ch.dash) return false;
    const a = ch.cls.ability;
    ch.cd.ability = a.cooldown;
    const g = this.game;
    if (a.type === 'charge') {
      const d = aim.dir.clone(); d.y = 0; d.normalize();
      const hit = new Set();
      ch.playOnce('Melee_1H_Attack_Stab', { speed: 1.1 });
      sfx('dash', this.dist(ch));
      ch.dash = {
        dir: d, speed: 28, time: a.distance / 28,
        onStep: (c) => {
          for (const o of g.characters) {
            if (!hostile(c, o) || hit.has(o)) continue;
            if (Math.hypot(o.pos.x - c.pos.x, o.pos.z - c.pos.z) < 2.1) {
              hit.add(o);
              this.damage(o, a.damage, c, { dir: d, knock: 16 });
            }
          }
        },
      };
    } else if (a.type === 'whirl') {
      ch.playOnce('Melee_2H_Attack_Spin', { speed: 1.5 });
      sfx('heavy', this.dist(ch));
      g.effects.ring(ch.pos, a.radius, 0xffe0a0, 0.4, 1.0);
      this.pending.push({ at: g.time + 0.25, fn: () => {
        for (const o of g.characters) {
          if (!hostile(ch, o)) continue;
          if (o.pos.distanceTo(ch.pos) < a.radius + o.radius) this.damage(o, a.damage, ch, { dir: _v.subVectors(o.pos, ch.pos).setY(0).normalize().clone(), knock: 10 });
        }
      } });
    } else if (a.type === 'volley') {
      ch.playOnce('Ranged_Bow_Release_Up', { speed: 1.6 });
      sfx('bow', this.dist(ch));
      const right = new THREE.Vector3().crossVectors(aim.dir, new THREE.Vector3(0, 1, 0)).normalize();
      for (let i = 0; i < a.count; i++) {
        const t = (i / (a.count - 1) - 0.5) * 0.42;
        const d = aim.dir.clone().addScaledVector(right, t).normalize();
        d.y += (Math.random() - 0.5) * 0.04;
        this.spawnArrow(ch, aim.origin, d, 68, a.damage);
      }
    } else if (a.type === 'nova') {
      ch.playOnce('Ranged_Magic_Summon', { speed: 1.8 });
      sfx('frost', this.dist(ch));
      g.effects.frost(ch.pos, a.radius);
      for (const o of g.characters) {
        if (!hostile(ch, o)) continue;
        if (o.pos.distanceTo(ch.pos) < a.radius) {
          this.damage(o, a.damage, ch, {});
          o.status.slowUntil = g.time + a.duration;
          o.status.slowMul = a.slow;
        }
      }
    } else if (a.type === 'smoke') {
      ch.playOnce('Throw', { speed: 1.8 });
      sfx('smoke', this.dist(ch));
      g.effects.smoke(ch.pos);
      ch.status.invisUntil = g.time + a.duration;
      ch.status.speedUntil = g.time + a.duration;
      ch.status.speedMul = a.speedBoost;
    }
    return true;
  }

  monsterAttack(ch, aim) {
    const m = ch.monster;
    ch.cd.attack = m.cooldown;
    ch.playOnce(m.anim, { speed: 1.3 });
    if (m.kind === 'melee') {
      sfx('swing', this.dist(ch));
      this.pending.push({ at: this.game.time + 0.3, fn: () => this.meleeHit(ch, { damage: m.damage, range: m.range, arc: 1.3, dir: aim.dir }) });
    } else {
      sfx('fire', this.dist(ch));
      this.spawnBolt(ch, aim.origin, aim.dir, m.damage);
    }
    return true;
  }

  // ------------------------------------------------------------ resolução
  meleeHit(ch, { damage, range, arc, backstab = 1, knock = 4, dir }) {
    if (!ch.alive) return;
    const fwd = dir ? _w.set(dir.x, 0, dir.z).normalize().clone() : ch.forward();
    let any = false;
    for (const o of this.game.characters) {
      if (!hostile(ch, o)) continue;
      const dx = o.pos.x - ch.pos.x, dz = o.pos.z - ch.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > range + o.radius) continue;
      if (Math.abs(o.pos.y - ch.pos.y) > 2.5) continue;
      const nx = dx / (dist || 1), nz = dz / (dist || 1);
      const ang = Math.acos(Math.max(-1, Math.min(1, nx * fwd.x + nz * fwd.z)));
      if (dist > 1.2 && ang > arc / 2) continue;
      if (!this.game.col.los(ch.pos.x, ch.pos.y + 1.3, ch.pos.z, o.pos.x, o.pos.y + 1.3, o.pos.z, ch.pos.y)) continue;
      let dmg = damage;
      let crit = false;
      if (backstab > 1) {
        const of = o.forward();
        if (of.x * nx + of.z * nz > 0.35) { dmg *= backstab; crit = true; }
      }
      this.damage(o, dmg, ch, { dir: new THREE.Vector3(nx, 0, nz), knock, crit });
      any = true;
    }
    return any;
  }

  damage(target, amount, source, { dir = null, knock = 4, crit = false, splash = false } = {}) {
    if (!target.alive) return;
    const g = this.game;
    if (target.spawnTime && g.time - target.spawnTime < 1.5) return; // proteção ao renascer
    if (source && (source.isBot || source.isMonster) && target.isPlayer) amount *= this.diff.botDamage;
    // bloqueio frontal do cavaleiro
    if (target.blocking && dir) {
      const f = target.forward();
      if (-(f.x * dir.x + f.z * dir.z) > 0.3) {
        amount *= 0.25;
        sfx('block', this.dist(target));
        g.effects.sparks(target.chest.add(f.multiplyScalar(0.8)), 0xfff2b0, 6, 5);
        knock *= 0.3;
      }
    }
    amount = Math.round(amount);
    target.hp -= amount;
    target.lastHurt = g.time;
    target.lastAttacker = source;
    target.flash();
    if (dir && knock) { target.vel.x += dir.x * knock; target.vel.z += dir.z * knock; }
    if (target.isMonster) g.effects.bones(target.chest); else g.effects.blood(target.chest);
    sfx('hit', this.dist(target));
    if (source && source.isPlayer) g.hud.hitMarker(target, amount, crit);
    if (target.isPlayer) g.hud.hurt(source);
    if (target.ai) target.ai.onHurt(source);
    if (target.hp <= 0) this.kill(target, source);
    else if (!target.isPlayer && Math.random() < 0.35 && !target.once) target.playOnce('Hit_A', { speed: 1.6 });
  }

  heal(target, amount, source) {
    if (!target.alive) return;
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + amount);
    this.game.effects.heal(target.pos);
    if (source && source.isPlayer && target.hp > before) this.game.hud.healMarker(target, Math.round(target.hp - before));
  }

  kill(target, source) {
    const g = this.game;
    target.hp = 0;
    target.alive = false;
    target.deaths++;
    target.blocking = false;
    target.dash = null;
    if (source && source !== target) source.kills++;
    if (target.carrying) g.objectives.dropPrincess(target);
    if (target.food) { target.food = false; g.objectives.dropFood(target); }
    sfx(target.isMonster ? 'bones' : 'death', this.dist(target));
    if (target.model) {
      target.playOnce(Math.random() < 0.5 ? 'Death_A' : 'Death_B', { speed: 1.1, hold: true });
      target.bar.visible = false;
      if (target.markerMesh) target.markerMesh.visible = false;
    }
    g.onKill(target, source);
  }

  // ------------------------------------------------------------ projéteis
  spawnArrow(ch, origin, dir, speed, damage) {
    const mesh = cloneModel('arrow_bow');
    mesh.scale.setScalar(1.1);
    const p = { mesh, pos: origin.clone(), vel: dir.clone().multiplyScalar(speed), gravity: 9, damage, owner: ch, team: ch.team, kind: 'arrow', radius: 0.25, life: 4 };
    this._addProj(p);
  }

  spawnFireball(ch, origin, dir, a) {
    const mesh = new THREE.Group();
    mesh.add(new THREE.Mesh(this.ballGeo, this.fireballMat));
    const glow = new THREE.Mesh(this.ballGeo, this.fireGlowMat);
    glow.scale.setScalar(1.8);
    mesh.add(glow);
    const light = new THREE.PointLight(0xff8a2a, 15, 10, 2);
    mesh.add(light);
    const p = { mesh, pos: origin.clone(), vel: dir.clone().multiplyScalar(a.speed), gravity: 0, damage: a.damage, splash: a.splash, owner: ch, team: ch.team, kind: 'fire', radius: 0.45, life: 3 };
    this._addProj(p);
  }

  spawnBolt(ch, origin, dir, damage) {
    const mesh = new THREE.Group();
    mesh.add(new THREE.Mesh(this.ballGeo, this.boltMat));
    mesh.add(new THREE.PointLight(0xb46bff, 10, 8, 2));
    const p = { mesh, pos: origin.clone(), vel: dir.clone().multiplyScalar(24), gravity: 0, damage, owner: ch, team: ch.team, kind: 'bolt', radius: 0.4, life: 3 };
    this._addProj(p);
  }

  _addProj(p) {
    p.mesh.position.copy(p.pos);
    this.game.scene.add(p.mesh);
    this.projectiles.push(p);
  }

  update(dt) {
    const g = this.game;
    // golpes agendados
    for (let i = this.pending.length - 1; i >= 0; i--) {
      if (g.time >= this.pending[i].at) { const f = this.pending[i].fn; this.pending.splice(i, 1); f(); }
    }
    const prev = new THREE.Vector3(), next = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      prev.copy(p.pos);
      p.vel.y -= p.gravity * dt;
      next.copy(p.pos).addScaledVector(p.vel, dt);
      let hitT = 2, hitChar = null;
      // personagens
      for (const o of g.characters) {
        if (!o.alive || o === p.owner) continue;
        if (o.team === p.team) continue;
        a.set(o.pos.x, o.pos.y + 0.4, o.pos.z); b.set(o.pos.x, o.pos.y + 2.1, o.pos.z);
        const r = o.radius + p.radius;
        if (segSegDist2(prev, next, a, b) < r * r) {
          const t = prev.distanceTo(o.pos) / (prev.distanceTo(next) + 1e-6);
          if (t < hitT) { hitT = t; hitChar = o; }
        }
      }
      // paredes / chão
      const tw = g.col.raycast(prev.x, prev.y, prev.z, next.x, next.y, next.z, heightAt(next.x, next.z));
      const gh = heightAt(next.x, next.z);
      let hitWorld = (tw >= 0) || next.y < gh;
      let done = false;
      if (hitChar && (tw < 0 || hitT <= tw + 0.05)) {
        this.impact(p, next, hitChar);
        done = true;
      } else if (hitWorld) {
        const at = tw >= 0 ? prev.clone().lerp(next, tw) : next.clone();
        if (at.y < gh) at.y = gh + 0.05;
        this.impact(p, at, null);
        done = true;
      } else if (p.life <= 0) done = true;
      if (done) {
        if (p.kind === 'arrow' && !hitChar && p.life > 0) {
          // flecha fica cravada por um tempo
          p.mesh.position.copy(p.pos.lerp(next, 0.9));
          const m = p.mesh;
          g.after(6, () => g.scene.remove(m));
        } else g.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }
      p.pos.copy(next);
      p.mesh.position.copy(p.pos);
      if (p.kind === 'arrow') {
        p.mesh.lookAt(_v.copy(p.pos).add(p.vel));
      }
    }
  }

  impact(p, at, target) {
    const g = this.game;
    if (p.kind === 'fire') {
      g.effects.explosion(at, p.splash, 0xff8a2a);
      sfx('boom', this.dist({ pos: at }));
      for (const o of g.characters) {
        if (!o.alive || o.team === p.team) continue;
        const d = o.chest.distanceTo(at);
        if (d < p.splash + o.radius) {
          const k = o === target ? 1 : Math.max(0.4, 1 - d / (p.splash + 1));
          this.damage(o, p.damage * k, p.owner, { dir: _v.subVectors(o.pos, at).setY(0).normalize().clone(), knock: 8 });
        }
      }
      return;
    }
    if (p.kind === 'bolt') g.effects.explosion(at, 1.2, 0xb46bff);
    if (target) {
      const dir = p.vel.clone().setY(0).normalize();
      // flechas na cabeça causam dano extra
      const head = at.y > target.pos.y + 1.75;
      this.damage(target, p.damage * (head ? 1.5 : 1), p.owner, { dir, knock: 3, crit: head });
    } else if (p.kind === 'arrow') {
      g.effects.sparks(at, 0xc8b089, 4, 3);
    }
  }

  dist(ch) {
    const pl = this.game.player;
    if (!pl || !ch || !ch.pos) return 0;
    return pl.pos.distanceTo(ch.pos);
  }
}
