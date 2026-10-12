// Combate: ataque base, bloqueio, skills, projéteis, status (atordoar, prender, lentidão, veneno, sangramento),
// dano com todos os modificadores, cura e mortes.
import * as THREE from 'three';
import { cloneModel } from './assets.js';
import { TEAM, DIFFICULTY, SETTINGS, SUMMONER, XP, HIT_RADIUS } from './config.js';
import { heightAt } from './world.js';
import { sfx } from './audio.js';
import { skillList, cdOf, soulCost, energyCost, SKILL_BY_ID } from './skills.js';
import { perkOf, cdMultiplier, energyMultiplier, addXp } from './progression.js';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

export function hostile(a, b) {
  return a !== b && a.team !== b.team && a.alive && b.alive;
}

// distância entre segmentos 3D (projétil x cápsula)
let _segS = 0; // parâmetro (0..1) do ponto mais próximo no primeiro segmento
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
  _segS = s;
  const cx = p1.x + d1.x * s - (p2.x + d2.x * t);
  const cy = p1.y + d1.y * s - (p2.y + d2.y * t);
  const cz = p1.z + d1.z * s - (p2.z + d2.z * t);
  return cx * cx + cy * cy + cz * cz;
}

const flat = (v) => { const d = v.clone(); d.y = 0; if (d.lengthSq() < 1e-6) d.set(0, 0, 1); return d.normalize(); };

export class Combat {
  constructor(game) {
    this.game = game;
    this.projectiles = [];
    this.pending = [];
    this.traps = [];
    this.smokes = [];
    this.links = new Map();
    this.fireballMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a });
    this.fireGlowMat = new THREE.MeshBasicMaterial({ color: 0xffd25a, transparent: true, opacity: 0.5, depthWrite: false });
    this.boltMat = new THREE.MeshBasicMaterial({ color: 0xb46bff });
    this.shadowMat = new THREE.MeshBasicMaterial({ color: 0x3a1650 });
    this.shadowGlow = new THREE.MeshBasicMaterial({ color: 0x9a5aff, transparent: true, opacity: 0.45, depthWrite: false });
    this.coinMat = new THREE.MeshStandardMaterial({ color: 0xffcf3a, metalness: 0.7, roughness: 0.3, emissive: 0x6a4a00, emissiveIntensity: 0.5 });
    this.iceMat = new THREE.MeshBasicMaterial({ color: 0xbfefff });
    this.holyMat = new THREE.MeshBasicMaterial({ color: 0xfff2a0 });
    this.holyGlow = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.45, depthWrite: false });
    this.ballGeo = new THREE.SphereGeometry(0.35, 12, 8);
    this.lanceGeo = new THREE.ConeGeometry(0.16, 1.3, 6).rotateX(Math.PI / 2);
    this.coinGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.05, 14);
  }

  get diff() { return DIFFICULTY[SETTINGS.difficulty]; }
  get time() { return this.game.time; }
  get fx() { return this.game.effects; }

  after(sec, fn) { this.pending.push({ at: this.game.time + sec, fn }); }

  // ------------------------------------------------------------ consultas de alvo
  /** Alvos atacáveis: personagens e estruturas (torres). */
  targets() {
    const g = this.game;
    if (this._tAt !== g.time) { this._t = g.structures.length ? g.characters.concat(g.structures) : g.characters; this._tAt = g.time; }
    return this._t;
  }

  enemiesNear(ch, x, z, r) {
    const out = [];
    for (const o of this.targets()) {
      if (!hostile(ch, o)) continue;
      if (Math.hypot(o.pos.x - x, o.pos.z - z) > r + o.radius) continue;
      if (Math.abs(o.pos.y - ch.pos.y) > 3.5 && !o.isStructure) continue;
      out.push(o);
    }
    return out;
  }

  alliesNear(ch, x, z, r) {
    const out = [];
    for (const o of this.game.characters) {
      if (!o.alive || o.team !== ch.team) continue;
      if (Math.hypot(o.pos.x - x, o.pos.z - z) > r) continue;
      out.push(o);
    }
    return out;
  }

  dirTo(a, b) { return new THREE.Vector3(b.pos.x - a.pos.x, 0, b.pos.z - a.pos.z).normalize(); }

  losTo(ch, o) {
    return this.game.col.los(ch.pos.x, ch.pos.y + 1.3, ch.pos.z, o.pos.x, o.pos.y + 1.3, o.pos.z, ch.pos.y);
  }

  /** Inimigos num arco à frente, ordenados pela distância. */
  cone(ch, dir, range, arc, max = Infinity) {
    const f = flat(dir), out = [];
    for (const o of this.targets()) {
      if (!hostile(ch, o)) continue;
      const dx = o.pos.x - ch.pos.x, dz = o.pos.z - ch.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > range + o.radius) continue;
      if (Math.abs(o.pos.y - ch.pos.y) > 2.5 && !o.isStructure) continue;
      const ang = Math.acos(Math.max(-1, Math.min(1, (dx * f.x + dz * f.z) / (d || 1))));
      if (d > 1.2 + o.radius && ang > arc / 2) continue;
      if (!this.losTo(ch, o)) continue;
      out.push([o, d]);
    }
    return out.sort((a, b) => a[1] - b[1]).slice(0, max).map(a => a[0]);
  }

  /** Inimigos numa faixa reta à frente (estocadas, gancho), ordenados. */
  line(ch, dir, range, width) {
    const f = flat(dir), out = [];
    for (const o of this.targets()) {
      if (!hostile(ch, o)) continue;
      const dx = o.pos.x - ch.pos.x, dz = o.pos.z - ch.pos.z;
      const along = dx * f.x + dz * f.z;
      if (along < -0.5 || along > range + o.radius) continue;
      const side = Math.abs(dx * f.z - dz * f.x);
      if (side > width + o.radius) continue;
      if (Math.abs(o.pos.y - ch.pos.y) > 2.5 && !o.isStructure) continue;
      if (!this.losTo(ch, o)) continue;
      out.push([o, along]);
    }
    return out.sort((a, b) => a[1] - b[1]).map(a => a[0]);
  }

  pointNearLine(ch, dir, range, width, p) {
    const f = flat(dir);
    const dx = p.x - ch.pos.x, dz = p.z - ch.pos.z;
    const along = dx * f.x + dz * f.z;
    return along > -0.5 && along < range && Math.abs(dx * f.z - dz * f.x) < width;
  }

  _aimPick(ch, aim, range, pred) {
    let best = null, bestA = 0.2;
    const eye = new THREE.Vector3(ch.pos.x, ch.eyeY, ch.pos.z);
    for (const o of this.targets()) {
      if (!pred(o)) continue;
      const to = new THREE.Vector3(o.pos.x, o.pos.y + 1.3, o.pos.z).sub(eye);
      const d = to.length();
      if (d > range) continue;
      const a = to.normalize().angleTo(aim.dir);
      if (a < bestA && this.losTo(ch, o)) { bestA = a; best = o; }
    }
    return best;
  }
  aimEnemy(ch, aim, range) { return this._aimPick(ch, aim, range, (o) => hostile(ch, o)); }
  aimAlly(ch, aim, range) { return this._aimPick(ch, aim, range, (o) => o !== ch && o.alive && o.team === ch.team && !o.isStructure); }

  /** Ponto no chão para onde o jogador está mirando (até maxDist). */
  aimPoint(ch, aim, maxDist) {
    const g = this.game;
    const o = aim.origin.clone(), d = aim.dir.clone().normalize();
    const p = new THREE.Vector3();
    let last = o.clone();
    for (let s = 0.5; s <= maxDist; s += 0.5) {
      p.copy(o).addScaledVector(d, s);
      const gh = heightAt(p.x, p.z);
      if (p.y <= gh) { p.y = gh; return p.clone(); }
      if (g.col.raycast(last.x, last.y, last.z, p.x, p.y, p.z, gh) >= 0) { last.y = heightAt(last.x, last.z); return last.clone(); }
      last.copy(p);
    }
    p.copy(o).addScaledVector(flat(d), maxDist);
    p.y = heightAt(p.x, p.z);
    return p;
  }

  groundAhead(ch, aim, max) {
    const p = this.aimPoint(ch, aim, max);
    if (p.distanceTo(ch.pos) < 1.5) { const f = ch.forward(); p.set(ch.pos.x + f.x * 2, 0, ch.pos.z + f.z * 2); p.y = heightAt(p.x, p.z); }
    return p;
  }

  isStunned(ch) { return ch.isStunned && ch.isStunned(); }

  // ------------------------------------------------------------ movimento especial e status
  dash(ch, dir, dist, speed, { onStep = null, onEnd = null, stopNear = 0 } = {}) {
    const step = onStep;
    ch.dash = {
      dir, speed, time: dist / speed,
      onStep: (c, dt) => {
        if (stopNear) for (const o of this.enemiesNear(c, c.pos.x + dir.x * stopNear * 0.6, c.pos.z + dir.z * stopNear * 0.6, stopNear * 0.6)) { if (c.dash) c.dash.time = 0; break; }
        if (step) step(c, dt);
      },
      onEnd,
    };
  }

  leap(ch, dir, dist, onLand) {
    const air = 2 * 9 / 26;
    ch.vy = 9; ch.onGround = false; ch.pos.y += 0.05;
    ch.dash = { dir, speed: dist / air, time: air * 0.98 };
    ch.leap = { onLand };
  }

  blink(ch, dir, dist) {
    const g = this.game;
    const p = ch.pos.clone();
    let ok = p.clone();
    for (let s = 0.5; s <= dist; s += 0.5) {
      const q = ch.pos.clone().addScaledVector(dir, s);
      if (g.col.raycast(ok.x, ch.pos.y + 1.2, ok.z, q.x, ch.pos.y + 1.2, q.z, 0) >= 0) break;
      ok = q;
    }
    ch.pos.set(ok.x, heightAt(ok.x, ok.z), ok.z);
    g.col.resolve(ch.pos, ch.radius, 0);
    ch.vel.set(0, 0, 0);
    ch.dash = null;
    return ch.pos.clone();
  }

  stun(o, t, knockdown = false) {
    if (!o.alive || o.isStructure) return;
    if (this.game.time < o.st.knockImmuneUntil || this.game.time < (o.st.cleanseUntil || 0)) return;
    o.st.stunUntil = Math.max(o.st.stunUntil, this.game.time + t);
    o.dash = null; o.blocking = false;
    if (o.channel) this.game.economy.cancelChannel(o, true);
    if (o.model) o.playOnce(knockdown ? 'Death_A' : 'Hit_B', { speed: knockdown ? 2.5 : 1.2 });
    if (o.isPlayer) this.game.hud.status('Atordoado!');
  }
  root(o, t) {
    if (!o.alive || o.isStructure || this.game.time < (o.st.cleanseUntil || 0)) return;
    o.st.rootUntil = Math.max(o.st.rootUntil, this.game.time + t);
    o.dash = null;
    if (o.isPlayer) this.game.hud.status('Preso!');
  }
  slow(o, mul, t) {
    if (!o.alive || o.isStructure || this.game.time < (o.st.cleanseUntil || 0)) return;
    const now = this.game.time;
    if (now < o.st.slowUntil && o.st.slowMul < mul) { o.st.slowUntil = Math.max(o.st.slowUntil, now + t * 0.5); return; }
    o.st.slowMul = mul; o.st.slowUntil = Math.max(o.st.slowUntil, now + t);
  }
  pullTo(o, ch) {
    if (!o.alive || o.isStructure) return;
    const f = ch.forward();
    o.pos.set(ch.pos.x + f.x * 1.8, o.pos.y, ch.pos.z + f.z * 1.8);
    this.game.col.resolve(o.pos, o.radius, 0);
    o.pos.y = heightAt(o.pos.x, o.pos.z);
    o.vel.set(0, 0, 0); o.dash = null;
  }

  /** Purificar: remove efeitos negativos e dá imunidade a eles por alguns segundos. */
  cleanse(o, immune) {
    const st = o.st, t = this.game.time;
    st.stunUntil = st.rootUntil = st.slowUntil = st.markedUntil = 0;
    st.poison = st.bleed = null;
    st.cleanseUntil = t + immune;
    this.fx.sparks(o.chest, 0xbfe8ff, 8, 3);
  }

  /** Luz em cadeia: salta para o alvo mais próximo (aliado ferido ou inimigo) a até 8 m. */
  chainLight(src, from, dmg, heal) {
    let best = null, bd = 8;
    for (const o of this.game.characters) {
      if (!o.alive || o === from || o === src || o.isStructure) continue;
      const ally = o.team === src.team;
      if (ally && o.hp >= o.maxHp) continue;
      const d = o.pos.distanceTo(from.pos);
      if (d < bd) { bd = d; best = o; }
    }
    if (!best) return;
    this.fx.rope(from.chest, best.chest, 0xffe066);
    if (best.team === src.team) this.heal(best, heal, src);
    else this.damage(best, dmg, src, { dir: this.dirTo(from, best), knock: 2 });
  }

  smokeCloud(pos, r, life) {
    this.smokes.push({ x: pos.x, z: pos.z, r, until: this.game.time + life });
    this.fx.smoke(pos, 3, r * 0.6);
  }
  /** A fumaça bloqueia a visão entre dois pontos? */
  smokeBlocks(ax, az, bx, bz) {
    for (const s of this.smokes) {
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
      let t = ((s.x - ax) * dx + (s.z - az) * dz) / l2; t = Math.max(0, Math.min(1, t));
      if (Math.hypot(ax + dx * t - s.x, az + dz * t - s.z) < s.r) return true;
    }
    return false;
  }

  // ------------------------------------------------------------ ataque base
  /** aim = {origin, dir (normalizado), charge 0..1, moveDir} */
  attack(ch, aim) {
    const t = this.game.time;
    if (!ch.alive || ch.carrying || ch.cd.attack > 0 || ch.dash || ch.channel) return false;
    if (ch.isStunned()) return false;
    if (ch.isMonster) return this.monsterAttack(ch, aim);
    if (t < ch.st.axeOutUntil || t < ch.st.windupUntil) return false;
    const a = ch.attackDef();
    ch.breakInvis();
    ch.cd.attack = a.cooldown / ch.attackSpeed();
    ch.blocking = false;
    if (a.type === 'melee') {
      ch.playOnce(a.anim, { speed: 1.5 * ch.attackSpeed() });
      sfx(a.heavy ? 'heavy' : 'swing', this.dist(ch));
      this.after(a.hitDelay, () => this.meleeHit(ch, { damage: a.damage, range: a.range, arc: a.arc, backstab: a.backstab, dir: aim.dir, base: true }));
    } else if (a.type === 'arrow') {
      ch.playOnce(a.anim, { speed: 1.6 });
      const k = Math.min(1, aim.charge || 0);
      const dmg = a.damageMin + (a.damageMax - a.damageMin) * k;
      this.arrow(ch, aim.origin, aim.dir, a.speed * (0.6 + 0.4 * k), dmg);
      sfx('bow', this.dist(ch));
    } else if (a.type === 'fireball') {
      ch.playOnce(a.anim, { speed: 1.5 });
      this.projectile(ch, 'fire', aim.origin, aim.dir, { speed: a.speed, damage: a.damage, splash: a.splash, range: 100 });
      sfx('fire', this.dist(ch));
    } else if (a.type === 'coin') {
      ch.playOnce(a.anim, { speed: 2 });
      this.projectile(ch, 'coin', aim.origin, aim.dir, { speed: a.speed, damage: a.damage, range: a.range });
      sfx('coin', this.dist(ch));
    } else if (a.type === 'holy') {
      ch.playOnce(a.anim, { speed: 1.6 });
      this.projectile(ch, 'holy', aim.origin, aim.dir, { speed: a.speed, damage: a.damage, heal: a.heal, range: a.range, hitsAllies: true, small: true });
      sfx('heal', this.dist(ch));
    }
    return true;
  }

  /** Bloqueio (botão direito). */
  block(ch, held) {
    const can = held && ch.alive && !ch.carrying && !ch.dash && !ch.isStunned() && !ch.channel && ch.cls && ch.cls.block > 0;
    ch.blocking = !!can;
    return ch.blocking;
  }

  monsterAttack(ch, aim) {
    const m = ch.monster, su = ch.summon || {};
    ch.cd.attack = m.cooldown;
    ch.playOnce(m.anim, { speed: 1.3 });
    const dmg = m.damage * (su.dmgMul || 1) * (this.game.time < ch.st.dmgUpUntil ? 1.3 : 1);
    if (m.kind === 'melee') {
      sfx('swing', this.dist(ch));
      this.after(0.3, () => this.meleeHit(ch, { damage: dmg, range: m.range, arc: 1.3, dir: aim.dir }));
    } else if (m.proj === 'arrow') {
      sfx('bow', this.dist(ch));
      this.projectile(ch, 'arrow', aim.origin, aim.dir, { speed: 55, damage: dmg, gravity: 4, range: 70, explode: su.explode || null });
    } else {
      sfx('fire', this.dist(ch));
      const slowHit = su.slowHit;
      this.projectile(ch, 'bolt', aim.origin, aim.dir, { speed: 24, damage: dmg, range: 60, explode: su.explode || null, onHit: slowHit ? (o) => this.slow(o, 0.7, 2) : null });
    }
    return true;
  }

  // ------------------------------------------------------------ skills
  /** Usa a skill do slot (1-5). Retorna true, false, 'locked', 'nosouls', 'noenergy' ou {menu}. */
  useSkill(ch, slot, aim) {
    const g = this.game, t = g.time;
    if (!ch.alive || ch.isMonster) return false;
    const sk = skillList(ch).find(s => s.slot === slot);
    if (!sk) return false;
    const perk = perkOf(ch, sk);
    // Muralha: usar de novo encerra
    if (sk.id === 'halb_wall' && ch.isPlanted()) { ch.st.wallUntil = t; ch.st.knockImmuneUntil = t; return true; }
    if (ch.carrying || ch.isStunned() || ch.channel || ch.dash) return false;
    if ((ch.cd[sk.id] || 0) > 0) return false;
    const souls = soulCost(sk, perk);
    if (souls && ch.souls < souls) return 'nosouls';
    const energy = Math.round(energyCost(sk, perk) * energyMultiplier(ch, slot));
    if (energy && ch.energy < energy) return 'noenergy';
    if (sk.menu) return { menu: sk.menu, skill: sk, perk };
    const r = sk.cast(this, ch, aim, perk);
    if (r === false) return false;
    if (souls) ch.souls -= souls;
    if (energy) ch.energy = Math.max(0, ch.energy - energy);
    ch.cd[sk.id] = cdOf(sk, perk) * cdMultiplier(ch, slot);
    if (sk.dmg !== '—' && !sk.keepsVeil) ch.breakInvis();
    return true;
  }

  /** Paga custo e recarga de uma skill de menu (chamado quando a ação do menu é confirmada). */
  commitSkill(ch, sk, { energy = true } = {}) {
    const perk = perkOf(ch, sk);
    if (energy) { const e = Math.round(energyCost(sk, perk) * energyMultiplier(ch, sk.slot)); if (e) ch.energy -= e; }
    const s = soulCost(sk, perk);
    if (s) ch.souls -= s;
    ch.cd[sk.id] = cdOf(sk, perk) * cdMultiplier(ch, sk.slot);
  }

  onVeilEnd() {}

  /** Marcha do Invocador (botão direito): aliados próximos ganham velocidade. */
  march(ch) {
    const g = this.game;
    if (!ch.alive || (ch.cd.march || 0) > 0 || ch.isStunned()) return false;
    ch.cd.march = SUMMONER.marchCooldown;
    for (const o of this.alliesNear(ch, ch.pos.x, ch.pos.z, SUMMONER.marchRadius)) o.st.marchUntil = g.time + SUMMONER.marchDuration;
    sfx('warcry', this.dist(ch));
    this.fx.ring(ch.pos, SUMMONER.marchRadius, 0x9a6aff, 0.8);
    if (ch.isPlayer) g.hud.status(`Marcha! +40% de velocidade por ${SUMMONER.marchDuration} s`);
    return true;
  }

  /** Elo de almas do Invocador (botão esquerdo segurado): liga num inimigo e gera almas. */
  soulLink(ch, held, aim, dt) {
    const g = this.game;
    let link = this.links.get(ch);
    if (!held || !ch.alive || ch.isStunned() || ch.carrying) { this.endLink(ch); return false; }
    let tgt = link && link.target;
    const range = SUMMONER.linkRange;
    const valid = (o) => o && o.alive && !o.isStructure && hostile(ch, o) && o.pos.distanceTo(ch.pos) <= range && this.losTo(ch, o);
    if (!valid(tgt)) {
      tgt = aim && aim.target && valid(aim.target) ? aim.target : (aim ? this.aimEnemy(ch, aim, range) : null);
      if (!valid(tgt)) { this.endLink(ch); return false; }
    }
    if (!link) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xb48aff, transparent: true, opacity: 0.85 }));
      line.frustumCulled = false;
      g.scene.add(line);
      link = { target: tgt, line };
      this.links.set(ch, link);
      sfx('soul', this.dist(ch));
    }
    link.target = tgt;
    ch.breakInvis();
    g.economy.addSouls(ch, SUMMONER.linkRate * dt);
    const a = new THREE.Vector3(ch.pos.x, ch.pos.y + 1.4, ch.pos.z), b = tgt.chest;
    const p = link.line.geometry.attributes.position;
    p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, b.x, b.y, b.z); p.needsUpdate = true;
    link.line.material.opacity = 0.6 + Math.sin(g.time * 20) * 0.25;
    return 'link';
  }
  endLink(ch) {
    const l = this.links.get(ch);
    if (!l) return;
    this.game.scene.remove(l.line);
    l.line.geometry.dispose();
    this.links.delete(ch);
  }

  // ------------------------------------------------------------ resolução
  meleeHit(ch, { damage, range, arc, backstab = 1, knock = 4, dir, base = false }) {
    if (!ch.alive) return false;
    const g = this.game, t = g.time;
    const hits = this.cone(ch, dir || ch.forward(), range, arc);
    let any = false;
    for (const o of hits) {
      const n = this.dirTo(ch, o);
      let dmg = damage, crit = false;
      if (base && !o.isStructure) {
        const of = o.forward();
        const behind = of.x * n.x + of.z * n.z > 0.35;
        if (t < ch.st.backstabUntil) {
          dmg *= 3; crit = true;
          if (ch.st.backstabCarrier && o.carrying) dmg *= 2;
          ch.st.backstabUntil = 0;
        } else if (backstab > 1 && behind) { dmg *= backstab; crit = true; }
      }
      this.damage(o, dmg, ch, { dir: n, knock, crit, melee: true });
      if (base && !o.isStructure && o.alive) this.applyBlade(ch, o);
      any = true;
    }
    return any;
  }

  applyBlade(ch, o) {
    const t = this.game.time, st = ch.st;
    if (st.bladePoison && t < st.bladePoison.until && st.bladePoison.charges > 0) {
      const bp = st.bladePoison;
      bp.charges--;
      this.applyDot(o, 'poison', bp.dps, 4, ch);
      if (bp.spread) for (const e of this.enemiesNear(ch, o.pos.x, o.pos.z, 4)) if (e !== o && !e.isStructure) this.applyDot(e, 'poison', bp.dps, 4, ch);
      if (bp.charges <= 0) st.bladePoison = null;
    }
    if (st.bladeBleed && t < st.bladeBleed.until) this.applyDot(o, 'bleed', st.bladeBleed.dps, 5, ch);
  }

  applyDot(o, kind, dps, dur, src) {
    if (!o.alive || o.isStructure) return;
    o.st[kind] = { dps, until: this.game.time + dur, src, tick: 0 };
    this.fx.sparks(o.chest, kind === 'poison' ? 0x7dff5a : 0xc0202a, 4, 2);
  }

  /** Dano com todos os modificadores. opts: dir (do atacante para o alvo), knock, crit, melee, ignoreBlock, raw (sem modificadores). */
  damage(target, amount, source, { dir = null, knock = 4, crit = false, melee = false, ignoreBlock = false, raw = false, dot = false } = {}) {
    if (!target.alive) return 0;
    const g = this.game, t = g.time, st = target.st;
    if (!target.isStructure && target.spawnTime && t - target.spawnTime < 1.5) return 0;
    let dmg = amount;
    if (source && !raw) {
      if ((source.isBot || source.isMonster || source.isStructure) && target.isPlayer && !(source.summon && source.summon.owner.isPlayer)) dmg *= this.diff.botDamage;
      if (source.cls && !source.isMonster) {
        let k = 1 + source.rarityDmg() + source.teamBoost('atk') + (source.supplyDmg || 0);
        if (t < source.st.dmgUpUntil) k += 0.15;
        if (t < source.st.furyUntil && source.st.furyPerk === 'A') k += 0.35;
        if (source.classKey === 'swordsman' && st.bleed && t < st.bleed.until && this.perkFor(source, 'sword_bleed') === 'B') k += 0.25;
        dmg *= k;
      }
    }
    if (t < st.markedUntil) dmg *= 1.2;
    let blocked = false;
    if (!raw && !target.isStructure) {
      // aparar (Espadachim)
      if (melee && t < st.parryUntil && source && source.alive) {
        st.parryUntil = 0;
        sfx('block', this.dist(target));
        this.fx.sparks(target.chest, 0xffffff, 10, 6);
        if (target.isPlayer || (source && source.isPlayer)) g.hud.floater(target, 'Aparado!', 'heal');
        if (st.parryPerk === 'A') this.damage(source, dmg, target, { raw: true, dir: this.dirTo(target, source), knock: 4 });
        if (st.parryPerk === 'B') this.stun(source, 1.2);
        return 0;
      }
      const f = target.forward();
      const dot = dir ? -(f.x * dir.x + f.z * dir.z) : 0; // >0.3: frontal
      const frontal = dir && dot > 0.3;
      const side = dir && Math.abs(dot) <= 0.3;
      // contra-golpe da Escudada
      if (melee && frontal && t < st.counterUntil && source && source.alive) this.damage(source, 20, target, { raw: true });
      let reduce = 0;
      if (target.blocking && frontal && !ignoreBlock) {
        reduce = t < st.oathUntil ? 1 : target.cls.block;
        blocked = true;
      }
      if (t < st.wallUntil && !ignoreBlock) {
        if (frontal) { reduce = 1; blocked = true; } else if (side && st.wallPerk === 'B') reduce = Math.max(reduce, 0.5);
      }
      if (t < st.oathUntil && st.oathPerk === 'B' && !frontal) reduce = Math.max(reduce, 0.3);
      dmg *= 1 - reduce;
      if (t < st.ironUntil) dmg *= 0.75;
      // armadura (classe + capacete + peitoral)
      dmg *= 1 - target.damageReduction();
      if (t < st.guardUntil) dmg *= 0.5;
      if (blocked) {
        sfx('block', this.dist(target));
        g.effects.sparks(target.chest.add(f.multiplyScalar(0.8)), 0xfff2b0, 6, 5);
        knock *= reduce >= 1 ? 0 : 0.3;
      }
      // escudo arcano e vida temporária
      if (st.shield > 0 && t < st.shieldUntil && dmg > 0) {
        const abs = Math.min(st.shield, dmg);
        st.shield -= abs; dmg -= abs;
        if (st.shieldReflect && source && source.alive && !raw) this.damage(source, abs * st.shieldReflect, target, { raw: true });
        this.fx.sparks(target.chest, 0x8fd0ff, 4, 3);
      }
      if (st.tempHp > 0 && t < st.tempHpUntil && dmg > 0) {
        const abs = Math.min(st.tempHp, dmg);
        st.tempHp -= abs; dmg -= abs;
      }
    }
    dmg = Math.round(dmg);
    if (dmg <= 0) {
      if (source && source.isPlayer && blocked) g.hud.floater(target, 'Bloqueado', '');
      return 0;
    }
    target.hp -= dmg;
    target.lastHurt = t;
    target.lastAttacker = source;
    if (source) target.dmgBy.set(source.summon ? source.summon.owner : source, t);
    target.flash();
    // roubo de vida
    if (source && source.alive && source.cls && !source.isMonster && !dot) {
      const leech = source.attrValue('leech');
      if (leech > 0) source.hp = Math.min(source.maxHp, source.hp + dmg * leech);
    }
    if (dir && knock && !target.isStructure && t >= st.knockImmuneUntil) { target.vel.x += dir.x * knock; target.vel.z += dir.z * knock; }
    // tiros de torre não interrompem quem planta a bomba (só golpes de personagens)
    if (target.channel && !(target.channel.kind === 'bomb' && source && source.isStructure)) g.economy.cancelChannel(target, true);
    if (!dot) {
      if (target.isMonster) g.effects.bones(target.chest);
      else if (target.isStructure) g.effects.sparks(target.chest, 0xc8b089, 6, 4);
      else g.effects.blood(target.chest);
      sfx('hit', this.dist(target));
    }
    const credit = source && source.summon ? source.summon.owner : source;
    if (credit && credit.isPlayer) g.hud.hitMarker(target, dmg, crit, dot);
    if (target.isPlayer) g.hud.hurt(source);
    if (target.ai) target.ai.onHurt(source);
    if (target.hp <= 0) this.kill(target, source);
    else if (!target.isPlayer && !target.isStructure && !dot && Math.random() < 0.35 && !target.once) target.playOnce('Hit_A', { speed: 1.6 });
    return dmg;
  }

  perkFor(ch, skillId) { const sk = SKILL_BY_ID[skillId]; return sk ? perkOf(ch, sk) : undefined; }

  heal(target, amount, source) {
    if (!target.alive || target.isStructure) return;
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + amount);
    this.game.effects.heal(target.pos);
    const healed = target.hp - before;
    if (source && source !== target && source.classKey === 'priest' && healed > 0 && !target.isMonster) {
      source._healXp = (source._healXp || 0) + healed * XP.healPer;
      if (source._healXp >= 10) { const n = Math.floor(source._healXp); source._healXp -= n; addXp(source, n, 'cura'); }
    }
    if (source && source.isPlayer && target.hp > before) this.game.hud.healMarker(target, Math.round(target.hp - before));
  }

  kill(target, source, { silent = false } = {}) {
    const g = this.game;
    target.hp = 0;
    target.alive = false;
    if (target.isStructure) { g.economy.onStructureDestroyed(target, source); return; }
    target.deaths++;
    target.blocking = false;
    target.dash = null; target.leap = null;
    if (target.launch) { target.launch = null; target.pos.y = this.game.world.groundAt(target.pos.x, target.pos.z); }
    if (target.channel) g.economy.cancelChannel(target, true);
    this.endLink(target);
    const killer = source && source.summon ? source.summon.owner : source;
    if (killer && killer !== target && !silent) killer.kills++;
    if (target.carrying) g.objectives.dropPrincess(target);
    if (target.food) { target.food = false; g.objectives.dropFood(target); }
    if (!silent) sfx(target.isMonster ? 'bones' : 'death', this.dist(target));
    if (target.model) {
      target.playOnce(Math.random() < 0.5 ? 'Death_A' : 'Death_B', { speed: 1.1, hold: true });
      target.bar.visible = false;
      if (target.markerMesh) target.markerMesh.visible = false;
    }
    g.economy.onDeath(target, source, { silent });
    g.onKill(target, source, { silent });
  }

  // ------------------------------------------------------------ projéteis
  arrow(ch, origin, dir, speed, damage, opts = {}) {
    const g = this.game;
    let homing = null, prey = false;
    if (ch.st && g.time < ch.st.huntUntil) {
      homing = this.huntTarget(ch, origin, dir);
      prey = ch.st.huntPerk === 'B';
    }
    return this.projectile(ch, 'arrow', origin, dir, { speed, damage, gravity: opts.gravity ?? 9, range: 200, homing, prey, ...opts });
  }

  huntTarget(ch, origin, dir) {
    let best = null, bestA = 25 * Math.PI / 180;
    for (const o of this.targets()) {
      if (!hostile(ch, o) || o.isStructure) continue;
      const to = new THREE.Vector3(o.pos.x, o.pos.y + 1.3, o.pos.z).sub(origin);
      if (to.length() > 40) continue;
      const a = to.normalize().angleTo(dir);
      if (a < bestA && this.losTo(ch, o)) { bestA = a; best = o; }
    }
    return best;
  }

  projectile(ch, kind, origin, dir, { speed = 30, damage = 10, gravity = 0, range = 60, splash = 0, pierce = 1, homing = null, prey = false, patience = false, explode = null, onHit = null, spin = false, trail = false, heal = 0, hitsAllies = false, small = false } = {}) {
    let mesh;
    if (kind === 'arrow') { mesh = cloneModel('arrow_bow'); mesh.scale.setScalar(1.1); }
    else if (kind === 'dagger') { mesh = new THREE.Group(); const d = cloneModel('dagger'); d.rotation.x = Math.PI / 2; d.scale.setScalar(1.2); mesh.add(d); }
    else if (kind === 'axe') { mesh = new THREE.Group(); const a = cloneModel('axe_2handed'); a.rotation.x = Math.PI / 2; a.scale.setScalar(0.9); mesh.add(a); }
    else if (kind === 'coin') { mesh = new THREE.Mesh(this.coinGeo, this.coinMat); mesh.scale.setScalar(1.3); }
    else if (kind === 'cannon') { mesh = cloneModel('projectile_catapult'); mesh.scale.setScalar(3); }
    else if (kind === 'fire') {
      mesh = new THREE.Group();
      mesh.add(new THREE.Mesh(this.ballGeo, this.fireballMat));
      const glow = new THREE.Mesh(this.ballGeo, this.fireGlowMat); glow.scale.setScalar(1.8); mesh.add(glow);
      mesh.add(new THREE.PointLight(0xff8a2a, 15, 10, 2));
    } else if (kind === 'ice') {
      mesh = new THREE.Group();
      mesh.add(new THREE.Mesh(this.lanceGeo, this.iceMat));
      mesh.add(new THREE.PointLight(0x9fe6ff, 8, 7, 2));
    } else if (kind === 'holy') {
      mesh = new THREE.Group();
      const c = new THREE.Mesh(this.ballGeo, this.holyMat); c.scale.setScalar(small ? 0.55 : 0.8); mesh.add(c);
      const glow = new THREE.Mesh(this.ballGeo, this.holyGlow); glow.scale.setScalar(small ? 1.1 : 1.7); mesh.add(glow);
      if (!small) mesh.add(new THREE.PointLight(0xffe066, 10, 8, 2));
    } else if (kind === 'shadow') {
      mesh = new THREE.Group();
      const c = new THREE.Mesh(this.ballGeo, this.shadowMat); c.scale.setScalar(0.7); mesh.add(c);
      const glow = new THREE.Mesh(this.ballGeo, this.shadowGlow); glow.scale.setScalar(1.3); mesh.add(glow);
    } else {
      mesh = new THREE.Group();
      mesh.add(new THREE.Mesh(this.ballGeo, this.boltMat));
      mesh.add(new THREE.PointLight(0xb46bff, 10, 8, 2));
    }
    const p = {
      mesh, pos: origin.clone(), vel: dir.clone().normalize().multiplyScalar(speed), speed, gravity: homing ? 0 : gravity, damage, splash,
      owner: ch, team: ch.team, kind, radius: kind === 'arrow' ? 0.25 : 0.4, life: range / speed, pierce, hit: new Set(),
      homing, prey, patience, explode, onHit, spin, trail, heal, hitsAllies,
    };
    p.mesh.position.copy(p.pos);
    this.game.scene.add(p.mesh);
    this.projectiles.push(p);
    return p;
  }

  meteor(ch, at, { delay, radius, center, edge }) {
    const g = this.game;
    const warn = new THREE.Mesh(new THREE.RingGeometry(radius * 0.92, radius, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xff4a1a, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
    warn.position.set(at.x, at.y + 0.12, at.z);
    g.scene.add(warn);
    const rock = new THREE.Group();
    rock.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 + radius * 0.08, 0), new THREE.MeshBasicMaterial({ color: 0x5a2a12 })));
    const gl = new THREE.Mesh(this.ballGeo, this.fireGlowMat); gl.scale.setScalar(4); rock.add(gl);
    rock.add(new THREE.PointLight(0xff6a1a, 30, 20, 2));
    g.scene.add(rock);
    const start = g.time;
    const tick = () => {
      const k = Math.min(1, (g.time - start) / delay);
      rock.position.set(at.x + (1 - k) * 8, at.y + (1 - k) * 34, at.z);
      warn.material.opacity = 0.3 + 0.4 * Math.abs(Math.sin(g.time * 10));
      if (k < 1) { this.after(0, tick); return; }
      g.scene.remove(rock); g.scene.remove(warn);
      g.effects.explosion(at.clone().setY(at.y + 0.5), radius, 0xff6a1a);
      sfx('boom', this.dist({ pos: at }));
      if (g.pc && g.player.alive && g.player.pos.distanceTo(at) < radius * 2.5) g.pc.shake = Math.min(1, g.pc.shake + 0.6);
      for (const o of this.targets()) {
        if (!o.alive || o.team === ch.team) continue;
        const d = Math.hypot(o.pos.x - at.x, o.pos.z - at.z);
        if (d > radius + o.radius) continue;
        const k2 = Math.min(1, d / radius);
        this.damage(o, center + (edge - center) * k2, ch, { dir: new THREE.Vector3(o.pos.x - at.x, 0, o.pos.z - at.z).normalize(), knock: 10 });
      }
    };
    this.after(0, tick);
  }

  trap(ch, pos, perk) {
    const g = this.game;
    const mine = this.traps.filter(t => t.owner === ch);
    if (mine.length >= 2) this.removeTrap(mine[0]);
    const mesh = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.08, 16), new THREE.MeshStandardMaterial({ color: 0x5a4a35, roughness: 1 }));
    mesh.add(base);
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0xb8b2a6, metalness: 0.6, roughness: 0.4 });
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 5), spikeMat);
      s.position.set(Math.cos(a) * 0.55, 0.15, Math.sin(a) * 0.55);
      mesh.add(s);
    }
    mesh.position.set(pos.x, pos.y + 0.03, pos.z);
    g.scene.add(mesh);
    this.traps.push({ owner: ch, team: ch.team, pos: pos.clone(), perk, until: g.time + 30, mesh });
    sfx('trap', this.dist(ch));
  }
  removeTrap(tr) {
    this.game.scene.remove(tr.mesh);
    const i = this.traps.indexOf(tr);
    if (i >= 0) this.traps.splice(i, 1);
  }

  // ------------------------------------------------------------ atualização
  update(dt) {
    const g = this.game, t = g.time;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      if (t >= this.pending[i].at) { const f = this.pending[i].fn; this.pending.splice(i, 1); f(); }
    }
    this.updateStatus(dt);
    this.updateTraps();
    for (let i = this.smokes.length - 1; i >= 0; i--) if (t > this.smokes[i].until) this.smokes.splice(i, 1);
    this.updateProjectiles(dt);
  }

  updateStatus(dt) {
    const g = this.game, t = g.time;
    for (const c of g.characters) {
      for (const k in c.cd) if (c.cd[k] > 0) c.cd[k] = Math.max(0, c.cd[k] - dt);
      if (c.modeCd > 0) c.modeCd = Math.max(0, c.modeCd - dt);
      if (!c.alive) continue;
      const st = c.st;
      for (const kind of ['poison', 'bleed']) {
        const d = st[kind];
        if (!d) continue;
        if (t >= d.until) { st[kind] = null; continue; }
        d.tick += dt;
        if (d.tick >= 0.5) { d.tick -= 0.5; this.damage(c, d.dps * 0.5, d.src, { raw: true, dot: true }); if (!c.alive) break; }
      }
      if (!c.alive) continue;
      if (t < st.hotUntil) { st.hotAcc = (st.hotAcc || 0) + st.hotRate * dt; if (st.hotAcc >= 4) { this.heal(c, st.hotAcc, st.hotSrc); st.hotAcc = 0; } }
      if (t < st.oathUntil && st.oathPerk === 'A' && c.blocking) c.hp = Math.min(c.maxHp, c.hp + 8 * dt);
      if (st.shield > 0 && t >= st.shieldUntil) st.shield = 0;
      if (st.tempHp > 0 && t >= st.tempHpUntil) st.tempHp = 0;
      if (st.bladePoison && t >= st.bladePoison.until) st.bladePoison = null;
      if (st.bladeBleed && t >= st.bladeBleed.until) st.bladeBleed = null;
      // Muralha: dano em quem entra na frente
      if (t < st.wallUntil) {
        st.wallTick -= dt;
        if (st.wallTick <= 0) {
          st.wallTick = 1;
          for (const o of this.cone(c, c.forward(), 3, Math.PI * 0.66)) {
            if (o.isStructure) continue;
            this.damage(o, 15, c, { dir: this.dirTo(c, o), knock: 3, melee: true });
            if (st.wallPerk === 'A') this.root(o, 1.5);
          }
        }
      }
    }
  }

  updateTraps() {
    const g = this.game, t = g.time;
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const tr = this.traps[i];
      if (t > tr.until || !tr.owner) { this.removeTrap(tr); continue; }
      for (const o of g.characters) {
        if (!o.alive || o.team === tr.team || o.isStructure) continue;
        if (Math.hypot(o.pos.x - tr.pos.x, o.pos.z - tr.pos.z) > 1.2 || o.pos.y - tr.pos.y > 1) continue;
        sfx('trap', this.dist(o));
        this.fx.sparks(o.pos.clone().setY(o.pos.y + 0.4), 0xb8b2a6, 8, 4);
        this.root(o, 1);
        if (tr.perk === 'A') { const v = o; this.after(1, () => this.slow(v, 0.5, 3)); }
        if (tr.perk === 'B') this.damage(o, 35, tr.owner, {});
        else o.dmgBy.set(tr.owner, t);
        if (o.isPlayer) g.announce('Armadilha!', '');
        this.removeTrap(tr);
        break;
      }
    }
  }

  updateProjectiles(dt) {
    const g = this.game;
    const prev = new THREE.Vector3(), next = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      prev.copy(p.pos);
      if (p.homing && p.homing.alive) {
        const to = new THREE.Vector3(p.homing.pos.x, p.homing.pos.y + 1.3, p.homing.pos.z).sub(p.pos).normalize();
        const cur = p.vel.clone().normalize();
        cur.lerp(to, Math.min(1, dt * 7)).normalize();
        p.vel.copy(cur.multiplyScalar(p.speed));
      }
      p.vel.y -= p.gravity * dt;
      next.copy(p.pos).addScaledVector(p.vel, dt);
      let hitT = 2, hitChar = null;
      for (const o of this.targets()) {
        if (!o.alive || o === p.owner || p.hit.has(o)) continue;
        if (o.team === p.team && !(p.hitsAllies && !o.isStructure && o.hp < o.maxHp)) continue;
        // cápsula de acerto: personagens usam HIT_RADIUS (maior que o raio de colisão); torres, a altura toda
        const h = o.isStructure ? o.hitHeight || 8 : 2.35;
        a.set(o.pos.x, o.pos.y + (o.isStructure ? 0 : 0.15), o.pos.z); b.set(o.pos.x, o.pos.y + h, o.pos.z);
        const r = (o.isStructure ? o.hitRadius || o.radius : HIT_RADIUS) + p.radius;
        if (segSegDist2(prev, next, a, b) < r * r) {
          const len = prev.distanceTo(next) + 1e-6;
          const tt = Math.max(0, _segS - (o.isStructure ? r / len : 0));
          if (tt < hitT) { hitT = tt; hitChar = o; }
        }
      }
      const tw = g.col.raycast(prev.x, prev.y, prev.z, next.x, next.y, next.z, heightAt(next.x, next.z));
      const gh = heightAt(next.x, next.z);
      const hitWorld = (tw >= 0) || next.y < gh;
      let done = false;
      // a torre tem colisor próprio: um tiro que bate nele conta como acerto na torre
      if (hitChar && hitChar.isStructure && tw >= 0) {
        const at = prev.clone().lerp(next, tw);
        if (Math.hypot(at.x - hitChar.pos.x, at.z - hitChar.pos.z) < (hitChar.hitRadius || hitChar.radius) + 1) hitT = Math.min(hitT, tw);
      }
      if (hitChar && (tw < 0 || hitT <= tw + 0.05)) {
        this.impact(p, next.clone(), hitChar);
        p.hit.add(hitChar);
        p.pierce--;
        if (p.pierce <= 0) done = true;
      } else if (hitWorld) {
        const at = tw >= 0 ? prev.clone().lerp(next, tw) : next.clone();
        if (at.y < gh) at.y = gh + 0.05;
        this.impact(p, at, null);
        done = true;
      } else if (p.life <= 0) done = true;
      if (done) {
        if (p.kind === 'arrow' && !hitChar && p.life > 0) {
          p.mesh.position.copy(p.pos.lerp(next, 0.9));
          const m = p.mesh;
          g.after(6, () => g.scene.remove(m));
        } else g.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }
      p.pos.copy(next);
      p.mesh.position.copy(p.pos);
      if (p.kind === 'arrow' || p.kind === 'dagger' || p.kind === 'ice') p.mesh.lookAt(_v.copy(p.pos).add(p.vel));
      else if (p.kind === 'axe') { p.mesh.lookAt(_v.copy(p.pos).add(p.vel)); p.mesh.rotateX(g.time * 25); }
      else if (p.kind === 'coin') { p.mesh.rotation.x += dt * 20; p.mesh.rotation.z += dt * 7; }
      if (p.trail && Math.random() < 0.5) this.fx.sparks(p.pos, 0xfff2c0, 1, 0.5);
    }
  }

  impact(p, at, target) {
    const g = this.game;
    if (p.kind === 'fire') {
      g.effects.explosion(at, p.splash, 0xff8a2a);
      sfx('boom', this.dist({ pos: at }));
      for (const o of this.targets()) {
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
    if (p.kind === 'cannon') {
      // bala de canhão da torre (nível 3): explode e fere todos por perto
      g.effects.explosion(at, p.splash, 0xc8b089);
      sfx('boom', this.dist({ pos: at }));
      for (const o of this.targets()) {
        if (!o.alive || o.team === p.team || o.isStructure) continue;
        const d = Math.hypot(o.pos.x - at.x, o.pos.z - at.z);
        if (d < p.splash + HIT_RADIUS && Math.abs(o.pos.y + 1 - at.y) < 3) {
          const k = o === target ? 1 : Math.max(0.45, 1 - d / (p.splash + 1));
          this.damage(o, p.damage * k, p.owner, { dir: _v.subVectors(o.pos, at).setY(0).normalize().clone(), knock: 7 });
        }
      }
      return;
    }
    if (p.kind === 'ice') g.effects.sparks(at, 0xbff0ff, 8, 4);
    if (p.kind === 'holy') g.effects.sparks(at, 0xffe066, 6, 3);
    // luz sagrada em aliado: cura
    if (target && p.hitsAllies && target.team === p.team) {
      this.heal(target, p.heal, p.owner);
      if (p.onHit && p.owner.alive) p.onHit(target, at);
      return;
    }
    if (p.kind === 'shadow') g.effects.explosion(at, 1.0, 0x7a3aff);
    if (p.explode) {
      g.effects.explosion(at, p.explode.radius, 0xffa040);
      for (const o of this.targets()) {
        if (!o.alive || o.team === p.team) continue;
        if (o.chest.distanceTo(at) < p.explode.radius + o.radius) this.damage(o, p.explode.damage, p.owner, {});
      }
    }
    if (target) {
      const dir = p.vel.clone().setY(0).normalize();
      const head = p.kind === 'arrow' && !target.isStructure && at.y > target.pos.y + 1.75;
      // o capacete reduz o bônus do tiro na cabeça (1,5× sem capacete; até 1,15× com capacete forte)
      const headMul = head ? Math.max(1.15, 1.5 - (target.helmetArmor ? target.helmetArmor() : 0) / 100) : 1;
      let dmg = p.damage * headMul;
      if (p.patience && Math.hypot(target.vel.x, target.vel.z) < 0.6) dmg *= 1.5;
      this.damage(target, dmg, p.owner, { dir, knock: p.kind === 'axe' ? 6 : 3, crit: head });
      if (p.prey && target.alive) { target.st.markedUntil = g.time + 4; target.st.markedTeam = p.team; }
      if (p.onHit && target.alive && p.owner.alive) p.onHit(target, at);
    } else if (p.kind === 'arrow' || p.kind === 'dagger' || p.kind === 'axe' || p.kind === 'coin') {
      g.effects.sparks(at, 0xc8b089, 4, 3);
    }
  }

  dist(ch) {
    const pl = this.game.player;
    if (!pl || !ch || !ch.pos) return 0;
    return pl.pos.distanceTo(ch.pos);
  }
}

export { TEAM };
