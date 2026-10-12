// Personagens: jogador, bots, monstros e invocações. Modelo animado, atributos, status, movimento e estado.
import * as THREE from 'three';
import { Assets, cloneModel, uniqueMaterials, steelify } from './assets.js';
import { CLASSES, MONSTERS, TEAM, TEAM_HEX, TEAM_TINT, TEAM_GLOW, CHAR_RADIUS, MAX_FAT, RARITY, ATTRS, ARMOR, armorReduction, freshForge } from './config.js';
import { heightAt, inWater, BOUNDS } from './world.js';

const markerGeo = new THREE.OctahedronGeometry(0.34, 0);
const ringGeo = new THREE.RingGeometry(0.62, 0.86, 28).rotateX(-Math.PI / 2);
const barGeo = new THREE.PlaneGeometry(1, 1);

let NEXT_ID = 1;

/** Plaquinha com o nome, na cor do time. */
function nameSprite(text, team) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const c = cv.getContext('2d');
  c.font = 'bold 30px Segoe UI, sans-serif';
  const w = Math.min(250, c.measureText(text).width + 24);
  c.fillStyle = team === TEAM.BLUE ? 'rgba(20,50,130,0.78)' : 'rgba(130,20,15,0.78)';
  c.beginPath(); c.roundRect((256 - w) / 2, 10, w, 44, 10); c.fill();
  c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, 128, 33);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, depthTest: false, transparent: true }));
  sp.renderOrder = 6;
  sp.scale.set(1.9, 0.48, 1);
  return sp;
}

export function freshStatus() {
  return {
    slowUntil: 0, slowMul: 1,
    speedUntil: 0, speedMul: 1, // fumaça
    stepUntil: 0, stepMul: 1, // passo leve
    marchUntil: 0,
    invisUntil: 0, veil: false, veilPerk: null,
    stunUntil: 0, rootUntil: 0, knockImmuneUntil: 0,
    dmgUpUntil: 0,
    furyUntil: 0, furyPerk: null,
    ironUntil: 0, ironPerk: null,
    oathUntil: 0, oathPerk: null,
    counterUntil: 0,
    guardUntil: 0,
    windupUntil: 0,
    tempHp: 0, tempHpUntil: 0,
    shield: 0, shieldUntil: 0, shieldReflect: 0,
    hotUntil: 0, hotRate: 0, hotSrc: null,
    markedUntil: 0,
    poison: null, bleed: null,
    bladePoison: null, bladeBleed: null,
    backstabUntil: 0, backstabCarrier: false,
    parryUntil: 0, parryPerk: null,
    wallUntil: 0, wallPerk: null, wallTick: 0,
    huntUntil: 0, huntPerk: null,
    silentUntil: 0,
    axeOutUntil: 0,
    resUntil: 0, resBonusUntil: 0,
  };
}

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
    this.cd = { attack: 0 };
    this.st = freshStatus();
    this.blocking = false;
    this.carrying = null;
    this.food = false;
    this.dash = null;
    this.leap = null;
    this.channel = null;
    this.kills = 0; this.deaths = 0; this.rescues = 0; this.feeds = 0;
    this.respawnAt = 0;
    this.lastHurt = -10;
    this.lastAttacker = null;
    this.dmgBy = new Map();
    this.onGround = true;
    this.vy = 0;
    this.model = null;
    this.mixer = null;
    this.actions = {};
    this.loopName = null;
    this.once = null;
    this.charge = 0;
    this.home = null;
    // progressão e economia (não usados por monstros)
    this.level = 1; this.xp = 0; this.builds = {};
    this.gold = 0;
    this.weapon = null; // null = arma básica
    this.helmet = null; this.body = null; // capacete e peitoral (null = peças básicas)
    this.backpack = [];
    // Mercador e Invocador
    this.mode = 'merchant';
    this.energy = 30; this.ore = 2; this.souls = 0;
    this.forge = freshForge(); // Oficina individual do mercador
    this.syringes = 0; this.bombs = 0; this.foodPoison = null;
    this.supplyArmor = 0; this.supplyDmg = 0;
    this.modeCd = 0;
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
  get isMerchant() { return this.classKey === 'merchant'; }
  get isSummoner() { return this.classKey === 'summoner'; }
  get backpackSize() { return this.cls ? this.cls.backpack : 0; }

  setClass(key) {
    const old = this.classKey;
    this.classKey = key;
    // arma de outra classe vai para a mochila
    if (old && old !== key && this.weapon && this.weapon.cls !== key) {
      if (this.backpack.length < CLASSES[key].backpack) this.backpack.push(this.weapon);
      this.weapon = null;
    }
    while (this.backpack.length > CLASSES[key].backpack) this.backpack.pop();
    this.recalcStats();
    if (!this.alive) this.hp = this.maxHp;
    for (const k in this.cd) this.cd[k] = 0;
    if (!this.isPlayer && this.game.scene) this.buildModel();
  }

  attackDef() { return this.cls.attack; }

  // ------------------------------------------------------------ arma equipada
  /** Soma do atributo secundário na arma, no capacete e no peitoral. */
  attrValue(key) {
    let v = 0;
    for (const it of [this.weapon, this.helmet, this.body]) if (it && it.attr === key) v += ATTRS[key].per * it.lvl;
    return v;
  }
  /** Armadura total: da classe + capacete + peitoral (+ atributo de armadura). */
  armorValue() {
    if (this.isMonster || !this.cls) return this.summon ? 5 : 0;
    const h = this.helmet ? ARMOR.helmet.rarity[this.helmet.rarity] : ARMOR.helmet.basic;
    const c = this.body ? ARMOR.body.rarity[this.body.rarity] : ARMOR.body.basic;
    return this.cls.armor + h + c + this.attrValue('armor') + this.teamBoost('armor') + (this.supplyArmor || 0);
  }
  /** Melhoria global do Reino comprada pelo time (vida, dano, armadura, velocidade). */
  teamBoost(key) {
    const E = this.game && this.game.economy;
    return E && this.cls && !this.isMonster ? E.boostValue(this.team, key) : 0;
  }
  helmetArmor() { return this.isMonster ? 0 : (this.helmet ? ARMOR.helmet.rarity[this.helmet.rarity] : ARMOR.helmet.basic); }
  damageReduction() { return armorReduction(this.armorValue()); }
  rarityDmg() { return this.weapon ? RARITY[this.weapon.rarity].dmg : 0; }
  recalcStats() {
    if (this.isMonster) return;
    const ratio = this.maxHp > 1 ? this.hp / this.maxHp : 1;
    this.maxHp = Math.round((this.cls.hp + this.attrValue('hp')) * (1 + this.teamBoost('hp')));
    if (this.alive) this.hp = Math.max(1, Math.min(this.maxHp, Math.round(this.maxHp * ratio)));
  }
  /** Equipa uma peça no espaço certo (arma, capacete ou peitoral). Retorna a peça que saiu. */
  equip(item, slot = null) {
    const kind = slot || (item ? item.kind || 'weapon' : 'weapon');
    const old = this[kind === 'weapon' ? 'weapon' : kind];
    this[kind === 'weapon' ? 'weapon' : kind] = item;
    this.recalcStats();
    if (this.model) this.refreshWeaponGlow();
    return old;
  }

  // ------------------------------------------------------------ modelo
  buildModel() {
    const scene = this.game.scene;
    if (this.model) scene.remove(this.model);
    const key = this.isMonster ? (this.monster.model || this.monsterType) : this.cls.model;
    const m = cloneModel(key, { skinned: true });
    const tint = this.isMonster ? (this.summon ? (this.team === TEAM.BLUE ? 0xb8ccff : 0xffc0b8) : undefined) : TEAM_TINT[this.team];
    uniqueMaterials(m, tint);
    m.traverse(o => { if (o.isMesh) { o.frustumCulled = false; } });
    this.mats = [];
    m.traverse(o => { if (o.isMesh) this.mats.push(o.material); });
    // o alabardeiro usa o modelo do cavaleiro sem o escudo nas costas / o mercador sem o chapéu de maga
    if (this.cls && this.cls.hideOffhand) m.traverse(o => { if (/shield/i.test(o.name)) o.visible = false; });
    if (this.cls && this.cls.hideHat) m.traverse(o => { if (/hat/i.test(o.name)) o.visible = false; });
    // brilho na cor do time (identificação de aliado e inimigo)
    this.baseGlow = new THREE.Color(this.team === TEAM.NEUTRAL ? 0x000000 : TEAM_GLOW[this.team]);
    for (const mat of this.mats) { mat.emissive = this.baseGlow.clone(); mat.emissiveIntensity = 1; }

    this.handR = m.getObjectByName('handslotr');
    this.handL = m.getObjectByName('handslotl');
    this.weaponObj = null; this.offObj = null;
    this.attachWeapons();
    if (!this.isMonster || this.summon) {
      const mk = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: TEAM_HEX[this.team], depthTest: false, transparent: true }));
      mk.renderOrder = 5;
      mk.position.y = 3.15;
      mk.scale.set(1, 1.3, 1);
      if (this.summon) mk.scale.setScalar(0.6);
      m.add(mk);
      this.markerMesh = mk;
      // anel no chão na cor do time
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: TEAM_HEX[this.team], transparent: true, opacity: 0.85, depthWrite: false }));
      ring.position.y = 0.06;
      if (this.summon) ring.scale.setScalar(0.75);
      m.add(ring);
      this.teamRing = ring;
      // nome acima da cabeça
      if (!this.isPlayer && !this.summon) {
        const tag = nameSprite(this.name, this.team);
        tag.position.y = 3.62;
        m.add(tag);
        this.nameTag = tag;
      }
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

  attachWeapons() {
    if (!this.handR) return;
    if (this.weaponObj) this.weaponObj.parent && this.weaponObj.parent.remove(this.weaponObj);
    if (this.offObj) this.offObj.parent && this.offObj.parent.remove(this.offObj);
    this.weaponObj = this.offObj = null;
    const wKey = this.isMonster ? this.monster.weapon : this.cls.weapon;
    const oKey = this.isMonster ? null : this.cls.offhand;
    const side = this.isMonster ? (this.monster.weaponSide || 'r') : (this.cls.offhandSide || 'r');
    if (wKey) {
      const w = cloneModel(wKey);
      if (wKey === 'sword_A' && !this.isMonster) steelify(w);
      (side === 'l' ? this.handL : this.handR).add(w);
      this.weaponObj = w;
    }
    if (oKey) { const o = cloneModel(oKey); this.handL.add(o); this.offObj = o; }
    this.refreshWeaponGlow();
  }

  refreshWeaponGlow() {
    const w = this.weaponObj;
    if (!w) return;
    const r = this.weapon ? RARITY[this.weapon.rarity] : null;
    w.traverse(o => {
      if (!o.isMesh) return;
      if (!o.userData.ownMat) { o.material = o.material.clone(); o.userData.ownMat = true; }
      o.material.emissive = new THREE.Color(r ? r.color : 0x000000);
      o.material.emissiveIntensity = r ? 0.35 : 0;
    });
  }

  idleAnim() { return this.isMonster ? 'Idle_B' : (this.cls.idle || 'Idle_A'); }

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
    if (this.once) return;
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
    this.recalcStats();
    this.hp = this.maxHp;
    this.cd.attack = 0;
    const keepRes = this.st.resBonusUntil;
    this.st = freshStatus();
    this.st.resBonusUntil = keepRes;
    this.blocking = false;
    this.carrying = null;
    this.food = false;
    this.dash = null;
    this.leap = null;
    this.channel = null;
    this.charge = 0;
    this.dmgBy.clear();
    this.spawnTime = this.game.time;
    if (this.model) {
      this.model.visible = true;
      this.once = null;
      this.mixer.stopAllAction();
      this.loopName = null;
      this.playLoop(this.idleAnim());
      this.playOnce('Spawn_Ground', { speed: 1.4 });
      this.setOpacity(1);
      this._invisVisual = false;
      if (this.markerMesh) this.markerMesh.visible = true;
    }
  }

  forward(out = new THREE.Vector3()) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  has(key) { return this.game.time < this.st[key]; }
  isInvisible() { return this.game.time < this.st.invisUntil; }
  isStunned() { return this.game.time < this.st.stunUntil; }
  isRooted() { return this.game.time < this.st.rootUntil; }
  isPlanted() { return this.game.time < this.st.wallUntil; }
  canAct() { return this.alive && !this.isStunned() && !this.channel; }

  /** Quebra a invisibilidade (ataques). Véu: recarga começa agora. */
  breakInvis() {
    if (!this.isInvisible()) return;
    this.st.invisUntil = this.game.time;
    if (this.st.veil) {
      this.st.veil = false;
      this.game.combat.onVeilEnd(this);
    }
  }

  speed() {
    const t = this.game.time, st = this.st;
    if (t < st.stunUntil || t < st.rootUntil || t < st.wallUntil || this.channel) return 0;
    let s = this.isMonster ? this.monster.speed : this.cls.speed;
    if (this.carrying) {
      const carry = this.cls ? this.cls.carry : 0.7;
      s *= Math.max(0.55, carry - this.carrying.fat * 0.06);
    }
    if (this.blocking) s *= 0.5;
    if (t < st.windupUntil) s *= 0.4;
    if (t < st.slowUntil) s *= st.slowMul;
    if (t < st.speedUntil) s *= st.speedMul;
    if (t < st.stepUntil) s *= st.stepMul;
    if (t < st.furyUntil) s *= 1.1;
    if (t < st.marchUntil) s *= 1.4;
    if (st.veil && st.veilPerk === 'A' && this.isInvisible()) s *= 1.2;
    s *= 1 + this.attrValue('move') + this.teamBoost('speed');
    if (inWater(this.pos.x, this.pos.z)) s *= 0.6;
    return s;
  }

  /** Multiplicador da velocidade de ataque (recarga do ataque base é dividida por ele). */
  attackSpeed() {
    const t = this.game.time, st = this.st;
    let k = 1 + this.attrValue('atkspd');
    if (t < st.furyUntil && st.furyPerk === 'B') k += 0.4;
    if (t < st.resUntil || t < st.resBonusUntil) k += 0.2;
    return k;
  }

  /** Movimento com aceleração, colisão e gravidade. wish = direção desejada (x,z) com |wish|<=1 */
  move(wx, wz, dt, { sprint = false, jump = false } = {}) {
    const g = this.game;
    if (this.isStunned() && this.dash) this.dash = null;
    if (this.dash) {
      this.dash.time -= dt;
      this.vel.x = this.dash.dir.x * this.dash.speed;
      this.vel.z = this.dash.dir.z * this.dash.speed;
      if (this.dash.onStep) this.dash.onStep(this, dt);
      if (this.dash && this.dash.time <= 0) {
        const d = this.dash; this.dash = null;
        if (d.onEnd) d.onEnd(this);
        if (!this.leap) { this.vel.x *= 0.3; this.vel.z *= 0.3; }
      }
    } else {
      let sp = this.speed() * (sprint ? 1.32 : 1);
      const tx = wx * sp, tz = wz * sp;
      const acc = this.onGround ? 14 : 3;
      const k = 1 - Math.exp(-acc * dt);
      this.vel.x += (tx - this.vel.x) * k;
      this.vel.z += (tz - this.vel.z) * k;
    }
    if (this.isRooted() || this.isPlanted() || this.isStunned()) {
      if (!this.dash) { this.vel.x *= Math.max(0, 1 - dt * 12); this.vel.z *= Math.max(0, 1 - dt * 12); }
    }
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    const ground = heightAt(this.pos.x, this.pos.z);
    g.col.resolve(this.pos, this.radius, this.pos.y - ground);
    this.pos.x = Math.max(-BOUNDS.x, Math.min(BOUNDS.x, this.pos.x));
    this.pos.z = Math.max(-BOUNDS.z, Math.min(BOUNDS.z, this.pos.z));
    const gh = heightAt(this.pos.x, this.pos.z);
    if (jump && this.onGround && this.speed() > 0) { this.vy = 9.5; this.onGround = false; }
    if (!this.onGround || this.pos.y > gh + 0.05) {
      this.vy -= 26 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= gh) { this.pos.y = gh; this.vy = 0; this.onGround = true; this.land(); }
      else this.onGround = false;
      if (!this.onGround && this.vy <= 0 && this.pos.y - gh < 0.35 && !jump && !this.leap) { this.pos.y = gh; this.vy = 0; this.onGround = true; this.land(); }
    } else {
      this.pos.y = gh;
    }
  }

  land() {
    if (this.leap) {
      const l = this.leap; this.leap = null; this.dash = null;
      this.vel.x *= 0.2; this.vel.z *= 0.2;
      l.onLand(this);
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
    if (this.offObj) this.offObj.visible = o > 0.2;
  }

  flash() { this.flashUntil = this.game.time + 0.12; }

  updateVisual(dt, camera) {
    if (!this.model) return;
    const m = this.model;
    m.position.copy(this.pos);
    let d = this.yaw - m.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    m.rotation.y += d * Math.min(1, dt * 14);
    if (!this.alive) return;

    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (!this.once || this.once.hold === false) {
      let loop = this.idleAnim(), ts = 1;
      if (this.isStunned()) loop = 'Hit_B';
      else if (this.blocking || this.isPlanted()) loop = 'Melee_Blocking';
      else if (this.channel) loop = 'Ranged_Magic_Spellcasting_Long';
      else if (hs > 0.8) {
        if (this.carrying || hs < 3.2) { loop = 'Walking_A'; ts = Math.max(0.6, hs / 3.4); }
        else { loop = 'Running_A'; ts = Math.max(0.7, hs / 6.6); }
      }
      this.playLoop(loop, ts);
    }

    // invisibilidade (com piscada ao levar dano no Véu)
    const blink = this.st.veil && this.game.time - this.lastHurt < 0.5;
    if (this.isInvisible() && !blink) {
      const viewer = this.game.player;
      const ally = viewer && viewer.team === this.team;
      this.setOpacity(ally ? 0.35 : 0.06);
      if (this.markerMesh) this.markerMesh.visible = ally;
      if (this.teamRing) this.teamRing.visible = ally;
      if (this.nameTag) this.nameTag.visible = ally;
      this._invisVisual = true;
    } else if (this._invisVisual) {
      this.setOpacity(1);
      if (this.markerMesh) this.markerMesh.visible = true;
      if (this.teamRing) this.teamRing.visible = true;
      this._invisVisual = false;
    }
    if (this.nameTag && !this._invisVisual) {
      const pl = this.game.player;
      this.nameTag.visible = !!pl && pl.pos.distanceTo(this.pos) < 38;
    }

    const flashing = this.game.time < (this.flashUntil || 0);
    if (flashing !== this._flashing) {
      for (const mat of this.mats) { mat.emissive = mat.emissive || new THREE.Color(); if (flashing) mat.emissive.setRGB(0.7, 0.15, 0.1); else mat.emissive.copy(this.baseGlow || new THREE.Color(0)); }
      this._flashing = flashing;
    }

    const showBar = this.hp < this.maxHp && (this.game.time - this.lastHurt < 6 || this.isMonster) && !this.isInvisible();
    this.bar.visible = showBar;
    if (showBar) {
      const r = Math.max(0, this.hp / this.maxHp);
      this.barFg.scale.x = 1.24 * r;
      this.barFg.position.x = -0.62 * (1 - r);
      this.bar.quaternion.copy(camera.quaternion);
      this.bar.quaternion.premultiply(m.quaternion.clone().invert());
    }
    if (this.markerMesh) this.markerMesh.rotation.y += dt * 2;
  }

  hideModel() { if (this.model) this.model.visible = false; }
}

export { MAX_FAT };
