// Personagens: jogador, bots e monstros. Modelo animado, atributos, movimento e estado.
import * as THREE from 'three';
import { Assets, cloneModel, uniqueMaterials } from './assets.js';
import { CLASSES, MONSTERS, TEAM, TEAM_HEX, TEAM_TINT, CHAR_RADIUS, MAX_FAT } from './config.js';
import { heightAt, inWater, BOUNDS } from './world.js';

const IDLE = { knight: 'Idle_A', barbarian: 'Melee_2H_Idle', ranger: 'Ranged_Bow_Idle', mage: 'Idle_B', rogue: 'Idle_A' };
const OFFHAND_SIDE = { ranger: 'l' };

const markerGeo = new THREE.OctahedronGeometry(0.22, 0);
const barGeo = new THREE.PlaneGeometry(1, 1);

let NEXT_ID = 1;

export class Character {
  constructor(game, { team, classKey = null, monsterType = null, isPlayer = false, name = '' }) {
    this.id = NEXT_ID++;
    this.game = game;
    this.team = team;
    this.isPlayer = isPlayer;
    this.isMonster = !!monsterType;
    this.isBot = !isPlayer && !monsterType;
    this.monsterType = monsterType;
    this.name = name;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.radius = CHAR_RADIUS;
    this.alive = false;
    this.hp = 1; this.maxHp = 1;
    this.cd = { attack: 0, alt: 0, ability: 0 };
    this.status = { slowUntil: 0, slowMul: 1, invisUntil: 0, speedUntil: 0, speedMul: 1 };
    this.blocking = false;
    this.carrying = null;
    this.food = false;
    this.dash = null;
    this.kills = 0; this.deaths = 0; this.rescues = 0; this.feeds = 0;
    this.respawnAt = 0;
    this.lastHurt = -10;
    this.lastAttacker = null;
    this.onGround = true;
    this.vy = 0;
    this.model = null;
    this.mixer = null;
    this.actions = {};
    this.loopName = null;
    this.once = null;
    this.charge = 0;
    this.home = null;
    if (monsterType) {
      this.monster = MONSTERS[monsterType];
      this.classKey = null;
      this.maxHp = this.hp = this.monster.hp;
    } else {
      this.setClass(classKey || 'knight');
    }
  }

  get cls() { return this.classKey ? CLASSES[this.classKey] : null; }
  get displayName() { return this.isPlayer ? 'Você' : this.name; }
  get eyeY() { return this.pos.y + 2.05; }
  get chest() { return new THREE.Vector3(this.pos.x, this.pos.y + 1.3, this.pos.z); }

  setClass(key) {
    this.classKey = key;
    this.maxHp = CLASSES[key].hp;
    if (!this.alive) this.hp = this.maxHp;
    else this.hp = Math.min(this.hp, this.maxHp);
    this.cd.attack = this.cd.alt = this.cd.ability = 0;
    if (!this.isPlayer) this.buildModel();
  }

  // ------------------------------------------------------------ modelo
  buildModel() {
    const scene = this.game.scene;
    if (this.model) scene.remove(this.model);
    const key = this.isMonster ? this.monsterType : this.cls.model;
    const m = cloneModel(key, { skinned: true });
    uniqueMaterials(m, this.isMonster ? undefined : TEAM_TINT[this.team]);
    m.traverse(o => { if (o.isMesh) { o.frustumCulled = false; } });
    this.mats = [];
    m.traverse(o => { if (o.isMesh) this.mats.push(o.material); });

    const handR = m.getObjectByName('handslotr');
    const handL = m.getObjectByName('handslotl');
    const wKey = this.isMonster ? this.monster.weapon : this.cls.weapon;
    const oKey = this.isMonster ? null : this.cls.offhand;
    const side = this.isMonster ? 'r' : (OFFHAND_SIDE[this.classKey] || 'r');
    if (wKey) {
      const w = cloneModel(wKey);
      (side === 'l' ? handL : handR).add(w);
      this.weaponObj = w;
    }
    if (oKey) {
      const o = cloneModel(oKey);
      handL.add(o);
    }
    // marcador do time acima da cabeça
    if (!this.isMonster) {
      const mk = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: TEAM_HEX[this.team] }));
      mk.position.y = 3.05;
      m.add(mk);
      this.markerMesh = mk;
    }
    // barra de vida
    const bar = new THREE.Group();
    const bg = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.7, depthWrite: false }));
    bg.scale.set(1.3, 0.16, 1);
    const fg = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: this.team === TEAM.NEUTRAL ? 0xd8d0b8 : TEAM_HEX[this.team], depthWrite: false }));
    fg.scale.set(1.24, 0.1, 1);
    fg.position.z = 0.001;
    bar.add(bg, fg);
    bar.position.y = this.isMonster ? 2.75 : 2.7;
    bar.visible = false;
    m.add(bar);
    this.bar = bar; this.barFg = fg;

    this.mixer = new THREE.AnimationMixer(m);
    this.actions = {};
    this.loopName = null;
    this.once = null;
    this.model = m;
    m.visible = this.alive;
    scene.add(m);
    this.playLoop(this.idleAnim());
  }

  idleAnim() { return this.isMonster ? 'Idle_B' : IDLE[this.classKey] || 'Idle_A'; }

  action(name) {
    if (!this.actions[name]) {
      const clip = Assets.clips[name];
      if (!clip) return null;
      this.actions[name] = this.mixer.clipAction(clip);
    }
    return this.actions[name];
  }

  playLoop(name, timeScale = 1) {
    if (!this.mixer) return;
    const a = this.action(name);
    if (!a) return;
    a.timeScale = timeScale;
    if (this.loopName === name) return;
    const prev = this.loopName ? this.action(this.loopName) : null;
    this.loopName = name;
    if (this.once) return; // será retomado ao fim da animação única
    a.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.18).play();
    if (prev) prev.fadeOut(0.18);
  }

  playOnce(name, { speed = 1, fade = 0.08, hold = false } = {}) {
    if (!this.mixer) return 0;
    const a = this.action(name);
    if (!a) return 0;
    if (this.once && this.once.action !== a) this.once.action.fadeOut(fade);
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.timeScale = speed;
    a.fadeIn(fade).play();
    if (this.loopName && !this.once) this.action(this.loopName).fadeOut(fade);
    const dur = a.getClip().duration / speed;
    this.once = { action: a, end: this.game.time + dur - 0.12, hold };
    return dur;
  }

  updateAnim(dt) {
    if (!this.mixer) return;
    if (this.once && !this.once.hold && this.game.time >= this.once.end) {
      this.once.action.fadeOut(0.15);
      this.once = null;
      if (this.loopName) {
        const l = this.action(this.loopName);
        l.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.15).play();
      }
    }
    this.mixer.update(dt);
  }

  // ------------------------------------------------------------ estado
  spawn(pos, yaw = 0) {
    this.pos.copy(pos);
    this.pos.y = heightAt(pos.x, pos.z);
    this.vel.set(0, 0, 0);
    this.vy = 0;
    this.yaw = yaw;
    this.pitch = 0;
    this.alive = true;
    this.hp = this.maxHp;
    this.cd.attack = this.cd.alt = 0;
    this.cd.ability = 0;
    this.status.slowUntil = this.status.invisUntil = this.status.speedUntil = 0;
    this.blocking = false;
    this.carrying = null;
    this.food = false;
    this.dash = null;
    this.charge = 0;
    this.spawnTime = this.game.time;
    if (this.model) {
      this.model.visible = true;
      this.once = null;
      this.mixer.stopAllAction();
      this.loopName = null;
      this.playLoop(this.idleAnim());
      this.playOnce('Spawn_Ground', { speed: 1.4 });
      this.setOpacity(1);
    }
  }

  forward(out = new THREE.Vector3()) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  isInvisible() { return this.game.time < this.status.invisUntil; }

  speed() {
    let s = this.isMonster ? this.monster.speed : this.cls.speed;
    if (this.carrying) {
      const carry = this.cls ? this.cls.carry : 0.7;
      s *= Math.max(0.55, carry - this.carrying.fat * 0.06);
    }
    if (this.blocking) s *= 0.5;
    if (this.game.time < this.status.slowUntil) s *= this.status.slowMul;
    if (this.game.time < this.status.speedUntil) s *= this.status.speedMul;
    if (inWater(this.pos.x, this.pos.z)) s *= 0.6;
    return s;
  }

  /** Movimento com aceleração, colisão e gravidade. wish = direção desejada (x,z) com |wish|<=1 */
  move(wx, wz, dt, { sprint = false, jump = false } = {}) {
    const g = this.game;
    if (this.dash) {
      this.dash.time -= dt;
      this.vel.x = this.dash.dir.x * this.dash.speed;
      this.vel.z = this.dash.dir.z * this.dash.speed;
      if (this.dash.onStep) this.dash.onStep(this, dt);
      if (this.dash.time <= 0) this.dash = null;
    } else {
      let sp = this.speed() * (sprint ? 1.32 : 1);
      const tx = wx * sp, tz = wz * sp;
      const acc = this.onGround ? 14 : 3;
      const k = 1 - Math.exp(-acc * dt);
      this.vel.x += (tx - this.vel.x) * k;
      this.vel.z += (tz - this.vel.z) * k;
    }
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    const ground = heightAt(this.pos.x, this.pos.z);
    g.col.resolve(this.pos, this.radius, this.pos.y - ground);
    this.pos.x = Math.max(-BOUNDS.x, Math.min(BOUNDS.x, this.pos.x));
    this.pos.z = Math.max(-BOUNDS.z, Math.min(BOUNDS.z, this.pos.z));
    const gh = heightAt(this.pos.x, this.pos.z);
    if (jump && this.onGround) { this.vy = 9.5; this.onGround = false; }
    if (!this.onGround || this.pos.y > gh + 0.05) {
      this.vy -= 26 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= gh) { this.pos.y = gh; this.vy = 0; this.onGround = true; }
      else this.onGround = false;
      // descer suavemente rampas
      if (!this.onGround && this.vy <= 0 && this.pos.y - gh < 0.35 && !jump) { this.pos.y = gh; this.vy = 0; this.onGround = true; }
    } else {
      this.pos.y = gh;
    }
  }

  setOpacity(o) {
    if (!this.mats) return;
    for (const m of this.mats) {
      m.transparent = o < 1;
      m.opacity = o;
      m.depthWrite = o >= 1;
    }
    if (this.weaponObj) this.weaponObj.visible = o > 0.2;
  }

  flash() { this.flashUntil = this.game.time + 0.12; }

  updateVisual(dt, camera) {
    if (!this.model) return;
    const m = this.model;
    m.position.copy(this.pos);
    // suaviza a rotação
    let d = this.yaw - m.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    m.rotation.y += d * Math.min(1, dt * 14);
    if (!this.alive) return;

    // animação de locomoção
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (!this.once || this.once.hold === false) {
      let loop = this.idleAnim(), ts = 1;
      if (this.blocking) loop = 'Melee_Blocking';
      else if (hs > 0.8) {
        if (this.carrying || hs < 3.2) { loop = 'Walking_A'; ts = Math.max(0.6, hs / 3.4); }
        else { loop = 'Running_A'; ts = Math.max(0.7, hs / 6.6); }
      }
      this.playLoop(loop, ts);
    }

    // invisibilidade
    if (this.isInvisible()) {
      const viewer = this.game.player;
      const ally = viewer && viewer.team === this.team;
      this.setOpacity(ally ? 0.35 : 0.06);
      if (this.markerMesh) this.markerMesh.visible = ally;
      this._invisVisual = true;
    } else if (this._invisVisual) {
      this.setOpacity(1);
      if (this.markerMesh) this.markerMesh.visible = true;
      this._invisVisual = false;
    }

    // clarão de dano
    const flashing = this.game.time < (this.flashUntil || 0);
    if (flashing !== this._flashing) {
      for (const mat of this.mats) { mat.emissive = mat.emissive || new THREE.Color(); mat.emissive.setRGB(flashing ? 0.7 : 0, flashing ? 0.15 : 0, flashing ? 0.1 : 0); }
      this._flashing = flashing;
    }

    // barra de vida
    const showBar = this.hp < this.maxHp && (this.game.time - this.lastHurt < 6 || this.isMonster) && !this.isInvisible();
    this.bar.visible = showBar;
    if (showBar) {
      const r = Math.max(0, this.hp / this.maxHp);
      this.barFg.scale.x = 1.24 * r;
      this.barFg.position.x = -0.62 * (1 - r);
      this.bar.quaternion.copy(camera.quaternion);
      // compensa a rotação do modelo
      this.bar.quaternion.premultiply(m.quaternion.clone().invert());
    }
    if (this.markerMesh) this.markerMesh.rotation.y += dt * 2;
  }

  hideModel() { if (this.model) this.model.visible = false; }
}

export { MAX_FAT };
