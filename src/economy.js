// Economia: ouro, armas (raridade, atributo, nível), mochila, queda de armas, banca, cofre, obras do castelo,
// torres de defesa, moedas, baús, almas, túmulos e as ações do Mercador de Almas.
import * as THREE from 'three';
import { cloneModel } from './assets.js';
import {
  TEAM, TEAM_HEX, TEAM_NAME, CLASSES, CLASS_KEYS, RARITY, LEVEL_MULT, ATTRS, ATTR_KEYS, PRICE_MODES, STALL, GOLD,
  MERCHANT, WORKS, WORK_TIME, TOWER, XP, WEAPON_GROUND_TIME, RESPAWN_TIME, MONSTERS,
} from './config.js';
import { heightAt } from './world.js';
import { sfx } from './audio.js';
import { addXp, perkOf } from './progression.js';
import { SKILL_BY_ID } from './skills.js';
import { freshStatus } from './entities.js';
import { hostile } from './combat.js';

let ITEM_ID = 1;

// ------------------------------------------------------------------ armas
export function makeWeapon(cls, rarity, attr, lvl) { return { id: ITEM_ID++, cls, rarity, attr, lvl }; }
export function basePrice(item) { return Math.round(RARITY[item.rarity].price * LEVEL_MULT[item.lvl - 1]); }
export function sellValue(item) { return Math.round(basePrice(item) * 0.5); }
export function stallPrice(item, mode) { return Math.round(basePrice(item) * PRICE_MODES[mode].mult); }
export function weaponLabel(item) {
  if (!item) return 'Arma básica';
  return `${CLASSES[item.cls].icon} ${RARITY[item.rarity].name} +${item.lvl}`;
}
export function weaponDesc(item) {
  if (!item) return 'Sem bônus';
  const r = RARITY[item.rarity];
  return `+${Math.round(r.dmg * 100)}% de dano · ${ATTRS[item.attr].fmt(ATTRS[item.attr].per * item.lvl)}`;
}
export function weaponHtml(item) {
  if (!item) return '<span class="wpn">Arma básica</span>';
  const r = RARITY[item.rarity];
  return `<span class="wpn" style="color:${r.css}">${CLASSES[item.cls].icon} ${CLASSES[item.cls].name} · ${r.name} +${item.lvl}</span><small>${weaponDesc(item)}</small>`;
}
export function weaponScore(item) { return item ? item.rarity * 10 + item.lvl * 2 + 1 : 0; }

export function craftEnergy(rarity, lvl, perk) {
  const e = RARITY[rarity].energy + MERCHANT.levelExtraEnergy * (lvl - 1);
  return Math.round(e * (perk === 'B' ? 0.8 : 1));
}
export function craftTime(rarity, lvl, perk, inside) {
  const t = RARITY[rarity].time + MERCHANT.levelExtraTime * (lvl - 1);
  return t * (perk === 'A' ? 0.7 : 1) * (inside ? 1 : MERCHANT.outsideTimeMult);
}
export function upgradeEnergy(newLvl, perk) { return Math.round(8 * newLvl * (perk === 'A' ? 0.7 : 1)); }
export function refineEnergy(newRarity, perk) { return Math.round(RARITY[newRarity].energy * (perk === 'A' ? 0.7 : 1)); }
export function maxRarityFor(level) { let r = 0; for (let i = 0; i < RARITY.length; i++) if (level >= RARITY[i].level) r = i; return r; }
export function workCost(key, level, perk) {
  const c = WORKS[key].costs[level];
  if (!c) return null;
  return { gold: Math.round(c[0] * (perk === 'A' ? 0.8 : 1)), energy: c[1] };
}

// ------------------------------------------------------------------ torre (estrutura)
class Tower {
  constructor(game, team, pos, level) {
    this.game = game;
    this.isStructure = true;
    this.team = team;
    this.pos = pos.clone();
    this.vel = new THREE.Vector3();
    this.radius = 1.6;
    this.yaw = 0;
    this.st = freshStatus();
    this.dmgBy = new Map();
    this.cd = {};
    this.name = 'Torre de defesa';
    this.blocking = false; this.carrying = null; this.food = false; this.ai = null;
    this.level = level;
    this.maxHp = this.hp = TOWER.levels[level].hp;
    this.alive = true;
    this.lastHurt = -10;
    this.nextShot = 0;
    const tc = team === TEAM.BLUE ? 'blue' : 'red';
    this.model = cloneModel('building_tower_A_' + tc);
    this.model.scale.setScalar(2.4);
    this.model.position.copy(this.pos);
    game.scene.add(this.model);
    this.collider = game.col.addCircle(pos.x, pos.z, 1.5, 7);
  }
  get chest() { return new THREE.Vector3(this.pos.x, this.pos.y + 3, this.pos.z); }
  forward() { return new THREE.Vector3(0, 0, 1); }
  isInvisible() { return false; }
  isStunned() { return false; }
  has() { return false; }
  flash() {}
  attrValue() { return 0; }
  rarityDmg() { return 0; }
  setLevel(level) {
    const ratio = this.alive ? this.hp / this.maxHp : 1;
    this.level = level;
    this.maxHp = TOWER.levels[level].hp;
    this.hp = Math.max(1, Math.round(this.maxHp * ratio));
  }
  rebuild() {
    this.alive = true; this.hp = this.maxHp;
    this.model.visible = true; this.model.scale.setScalar(2.4);
    this.collider.height = 7;
    if (this.ruin) { this.game.scene.remove(this.ruin); this.ruin = null; }
  }
  destroy() {
    this.alive = false;
    this.model.visible = false;
    this.collider.height = 1.2;
    this.ruin = cloneModel('building_destroyed');
    this.ruin.scale.setScalar(1.8);
    this.ruin.position.copy(this.pos);
    this.game.scene.add(this.ruin);
    this.game.effects.explosion(this.chest, 4, 0xc8b089);
  }
  update(dt) {
    if (!this.alive) return;
    const g = this.game, C = g.combat;
    if (g.time < this.nextShot) return;
    const castle = g.world.castles[this.team];
    let best = null, bd = TOWER.range;
    const eye = (o) => {
      // ponto de tiro do lado de fora do colisor da torre, virado para o alvo
      const dx = o.pos.x - this.pos.x, dz = o.pos.z - this.pos.z, l = Math.hypot(dx, dz) || 1;
      return new THREE.Vector3(this.pos.x + dx / l * 2.1, this.pos.y + 5.6, this.pos.z + dz / l * 2.1);
    };
    for (const o of g.characters) {
      if (!hostile(this, o) || o.isInvisible()) continue;
      const near = castle.inside(o.pos.x, o.pos.z) || castle.nearWalls(o.pos.x, o.pos.z, 8);
      if (!near) continue;
      const d = o.pos.distanceTo(this.pos);
      if (d >= bd) continue;
      const e = eye(o);
      if (g.col.los(e.x, e.y, e.z, o.pos.x, o.pos.y + 1.3, o.pos.z, 0)) { bd = d; best = o; }
    }
    if (!best) return;
    this.nextShot = g.time + TOWER.interval;
    const origin = eye(best);
    const tgt = new THREE.Vector3(best.pos.x, best.pos.y + 1.2, best.pos.z).addScaledVector(best.vel, bd / 30 * 0.5);
    C.projectile(this, 'bolt', origin, tgt.sub(origin).normalize(), { speed: 30, damage: TOWER.levels[this.level].damage, range: TOWER.range + 6 });
    sfx('fire', C.dist(this));
  }
}

// ------------------------------------------------------------------ economia
export class Economy {
  constructor(game) {
    this.game = game;
    const w = game.world;
    this.vault = [GOLD.vaultStart, GOLD.vaultStart];
    this.stalls = [0, 1].map(t => ({ team: t, pos: w.castles[t].stallPos, slots: [], depot: [] }));
    this.works = [0, 1].map(() => ({ barracks: 0, ossuary: 0, banner: 0, towers: 0, treasury: 0 }));
    this.building = [null, null];
    this.towers = [[], []];
    this.ground = [];
    this.souls = [];
    this.coins = w.coinSpawns.map(p => this.makeCoin(p));
    this.chests = w.chestSpawns.map(p => this.makeChest(p));
    this.tombs = w.tombSpawns.map(p => this.makeTomb(p));
    this.fallbackAt = 3;
    for (const t of [0, 1]) this.buildStall(t);
  }

  // ------------------------------------------------------------ consultas
  workLevel(team, key) { return team === TEAM.BLUE || team === TEAM.RED ? this.works[team][key] : 0; }
  merchantsOf(team) { return this.game.characters.filter(c => c.isMerchant && c.team === team); }
  stallSlotsMax(team) {
    for (const m of this.merchantsOf(team)) if (perkOf(m, SKILL_BY_ID.m_stall) === 'B') return STALL.slotsVitrine;
    return STALL.slots;
  }
  respawnTime(ch) {
    const base = RESPAWN_TIME + (ch.isPlayer ? 0 : 2);
    return Math.max(ch.isPlayer ? 4 : 6, base - this.workLevel(ch.team, 'barracks'));
  }
  inCity(ch) { return this.game.world.castles[ch.team] && this.game.world.castles[ch.team].inside(ch.pos.x, ch.pos.z); }
  nearStall(ch, r = STALL.useRange) {
    const s = this.stalls[ch.team];
    return s && Math.hypot(ch.pos.x - s.pos.x, ch.pos.z - s.pos.z) < r;
  }

  // ------------------------------------------------------------ visuais fixos
  buildStall(team) {
    const g = this.game, s = this.stalls[team];
    const grp = new THREE.Group();
    grp.position.set(s.pos.x, heightAt(s.pos.x, s.pos.z), s.pos.z);
    grp.rotation.y = team === TEAM.BLUE ? 0 : Math.PI;
    const counter = cloneModel('crate_long_A'); counter.scale.setScalar(5); counter.position.set(0, 0, 0); counter.rotation.y = Math.PI / 2;
    const rack = cloneModel('weaponrack'); rack.scale.setScalar(7); rack.position.set(0, 0, -2.2);
    const chest = cloneModel('chest_gold'); chest.scale.setScalar(1.2); chest.position.set(-3, 0, -0.6); chest.rotation.y = 0.5;
    const tent = cloneModel('tent'); tent.scale.setScalar(8); tent.position.set(0.5, 0, -3.6);
    grp.add(counter, rack, chest, tent);
    // placa
    const sign = this.textSprite('Banca do Mercador', team === TEAM.BLUE ? '#bcd4ff' : '#ffc2b8');
    sign.position.set(0, 3.6, 0);
    grp.add(sign);
    // armas expostas (atualizadas quando muda)
    s.display = new THREE.Group();
    s.display.position.set(0, 1.25, 0);
    grp.add(s.display);
    g.scene.add(grp);
    s.group = grp;
    const x = s.pos.x, z = s.pos.z;
    g.col.addBox(x - 2.6, z - 0.8, x + 2.6, z + 0.8, 1.3);
    s.dirty = true;
  }

  textSprite(text, color = '#fff3d0') {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
    const c = cv.getContext('2d');
    c.fillStyle = 'rgba(20,14,8,0.78)'; c.fillRect(0, 0, 512, 96);
    c.strokeStyle = '#8a6a3a'; c.lineWidth = 6; c.strokeRect(3, 3, 506, 90);
    c.font = 'bold 46px Georgia, serif'; c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 50);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
    sp.scale.set(4.2, 0.8, 1);
    return sp;
  }

  refreshStallDisplay(team) {
    const s = this.stalls[team];
    s.dirty = false;
    const d = s.display;
    while (d.children.length) d.remove(d.children[0]);
    s.slots.slice(0, 6).forEach((sl, i) => {
      const m = cloneModel(CLASSES[sl.item.cls].weapon);
      m.scale.setScalar(0.55);
      m.rotation.set(0, 0, Math.PI / 2);
      m.position.set(-2 + i * 0.8, 0.1, 0);
      const col = RARITY[sl.item.rarity].color;
      m.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(col); o.material.emissiveIntensity = 0.4; } });
      d.add(m);
    });
  }

  makeCoin(p) {
    const g = this.game;
    const grp = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(g.combat.coinGeo, g.combat.coinMat);
      c.position.set((Math.random() - 0.5) * 0.5, 0.05 + i * 0.06, (Math.random() - 0.5) * 0.5);
      c.scale.setScalar(1.4);
      grp.add(c);
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd25a, transparent: true, opacity: 0.7, depthWrite: false }));
    ring.position.y = 0.06;
    grp.add(ring);
    grp.position.set(p.x, heightAt(p.x, p.z), p.z);
    g.scene.add(grp);
    return { pos: grp.position.clone(), mesh: grp, active: true, respawnAt: 0, amount: this.coinAmount() };
  }
  coinAmount() { return GOLD.coinMin + Math.floor(Math.random() * (GOLD.coinMax - GOLD.coinMin + 1)); }

  makeChest(p) {
    const g = this.game;
    const m = cloneModel('chest_gold');
    m.scale.setScalar(1.2);
    m.position.set(p.x, heightAt(p.x, p.z), p.z);
    m.rotation.y = p.ry || 0;
    g.scene.add(m);
    const glow = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.4, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd25a, transparent: true, opacity: 0.8, depthWrite: false }));
    glow.position.set(p.x, m.position.y + 0.07, p.z);
    g.scene.add(glow);
    return { pos: m.position.clone(), mesh: m, glow, active: true, respawnAt: 0 };
  }

  makeTomb(p) {
    const g = this.game;
    const grp = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: 0x8a8a8e, roughness: 1 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.35), stone); slab.position.y = 0.8; grp.add(slab);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.35, 16, 1, false, 0, Math.PI), stone); top.rotation.set(Math.PI / 2, 0, Math.PI / 2); top.position.y = 1.6; grp.add(top);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 2.4), new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 1 })); base.position.set(0, 0.1, 0.9); grp.add(base);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), new THREE.MeshBasicMaterial({ color: 0xb48aff, transparent: true, opacity: 0.8 }));
    glow.position.set(0, 1.0, 0.9);
    grp.add(glow);
    grp.position.set(p.x, heightAt(p.x, p.z), p.z);
    grp.rotation.y = p.ry || 0;
    g.scene.add(grp);
    g.col.addBox(p.x - 0.7, p.z - 0.3, p.x + 0.7, p.z + 0.3, 1.6);
    return { pos: new THREE.Vector3(p.x, grp.position.y, p.z + 0.9), mesh: grp, glow, readyAt: 0 };
  }

  // ------------------------------------------------------------ itens no chão
  spawnGroundWeapon(item, pos) {
    const g = this.game;
    const grp = new THREE.Group();
    const m = cloneModel(CLASSES[item.cls].weapon);
    m.scale.setScalar(0.8);
    m.rotation.set(Math.PI / 2, 0, 0.4);
    m.position.y = 0.25;
    const col = RARITY[item.rarity].color;
    m.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(col); o.material.emissiveIntensity = 0.45; } });
    grp.add(m);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.85, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false }));
    ring.position.y = 0.06; grp.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 4, 8, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 2; grp.add(beam);
    grp.position.set(pos.x, heightAt(pos.x, pos.z), pos.z);
    g.scene.add(grp);
    this.ground.push({ kind: 'weapon', item, pos: grp.position.clone(), mesh: grp, until: g.time + WEAPON_GROUND_TIME });
  }

  spawnGroundGold(amount, pos) {
    const g = this.game;
    const grp = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const c = new THREE.Mesh(g.combat.coinGeo, g.combat.coinMat);
      c.position.set((Math.random() - 0.5) * 0.7, 0.05 + (i % 3) * 0.06, (Math.random() - 0.5) * 0.7);
      c.scale.setScalar(1.3);
      grp.add(c);
    }
    grp.position.set(pos.x, heightAt(pos.x, pos.z), pos.z);
    g.scene.add(grp);
    this.ground.push({ kind: 'gold', amount, pos: grp.position.clone(), mesh: grp, until: g.time + WEAPON_GROUND_TIME });
  }

  removeGround(it) {
    this.game.scene.remove(it.mesh);
    const i = this.ground.indexOf(it);
    if (i >= 0) this.ground.splice(i, 1);
  }

  /** Arma ou ouro mais próximo que o personagem pode pegar. */
  nearestPickup(ch, r = 2.6) {
    let best = null, bd = r;
    const consider = (kind, obj, pos) => {
      const d = Math.hypot(pos.x - ch.pos.x, pos.z - ch.pos.z);
      if (d < bd) { bd = d; best = { kind, obj }; }
    };
    for (const it of this.ground) consider(it.kind, it, it.pos);
    for (const c of this.coins) if (c.active) consider('coin', c, c.pos);
    for (const c of this.chests) if (c.active) consider('chest', c, c.pos);
    return best;
  }

  /** Coleta. Ouro do mercador vai para o cofre; cada coleta dá energia ao mercador. Retorna texto ou null. */
  pickup(ch, p, { silent = false } = {}) {
    const g = this.game;
    let msg = null;
    const giveGold = (n) => {
      if (ch.isMerchant) { this.vault[ch.team] += n; msg = `+${n} de ouro no cofre`; }
      else { ch.gold += n; msg = `+${n} de ouro`; }
    };
    if (p.kind === 'weapon') {
      if (ch.backpack.length >= ch.backpackSize) {
        // troca direto se for da classe e a arma equipada for a básica
        if (p.obj.item.cls === ch.classKey && !ch.weapon) { ch.equip(p.obj.item); this.removeGround(p.obj); msg = 'Arma equipada'; }
        else { if (ch.isPlayer && !silent) g.announce('Mochila cheia', 'Venda ou troque uma arma'); return null; }
      } else {
        const item = p.obj.item;
        this.removeGround(p.obj);
        if (item.cls === ch.classKey && weaponScore(item) > weaponScore(ch.weapon)) {
          if (ch.weapon) ch.backpack.push(ch.weapon);
          ch.equip(item);
          msg = 'Arma equipada: ' + weaponLabel(item);
        } else { ch.backpack.push(item); msg = 'Na mochila: ' + weaponLabel(item); }
      }
    } else if (p.kind === 'gold') { giveGold(p.obj.amount); this.removeGround(p.obj); }
    else if (p.kind === 'coin') { giveGold(p.obj.amount); p.obj.active = false; p.obj.mesh.visible = false; p.obj.respawnAt = g.time + GOLD.coinRespawn; }
    else if (p.kind === 'chest') { giveGold(GOLD.chest); p.obj.active = false; p.obj.mesh.visible = false; p.obj.glow.visible = false; p.obj.respawnAt = g.time + GOLD.chestRespawn; sfx('chest', g.combat.dist(ch)); }
    if (ch.isMerchant) this.addEnergy(ch, MERCHANT.pickupEnergy);
    sfx('coin', g.combat.dist(ch));
    if (ch.isPlayer && msg && !silent) g.hud.status(msg);
    return msg;
  }

  /** Dica da tecla E para o jogador (depois dos objetivos). */
  promptFor(ch) {
    if (!ch.alive) return '';
    const p = this.nearestPickup(ch);
    if (p) {
      if (p.kind === 'weapon') return `<b>[E]</b> Pegar ${weaponLabel(p.obj.item)}`;
      if (p.kind === 'gold') return `<b>[E]</b> Pegar ${p.obj.amount} de ouro`;
      if (p.kind === 'coin') return `<b>[E]</b> Pegar moedas (${p.obj.amount})`;
      if (p.kind === 'chest') return `<b>[E]</b> Abrir o baú (${GOLD.chest} de ouro)`;
    }
    if (this.nearStall(ch)) return '<b>[E]</b> Abrir a banca do mercador';
    const m = this.nearbyMerchant(ch);
    if (m) return `<b>[E]</b> Vender itens ao mercador ${m.isPlayer ? '' : m.name}`;
    return '';
  }

  nearbyMerchant(ch) {
    if (ch.isMerchant) return null;
    for (const m of this.merchantsOf(ch.team)) if (m.alive && m !== ch && m.pos.distanceTo(ch.pos) < STALL.sellRange) return m;
    return null;
  }

  /** Tecla E (jogador): coleta, banca ou venda ao mercador. Retorna o nome do menu a abrir, ou true/false. */
  interact(ch) {
    const p = this.nearestPickup(ch);
    if (p) return !!this.pickup(ch, p);
    if (this.nearStall(ch)) return 'stall';
    if (this.nearbyMerchant(ch)) return 'sell';
    return false;
  }

  // ------------------------------------------------------------ banca e cofre
  buy(ch, idx) {
    const s = this.stalls[ch.team], sl = s.slots[idx];
    if (!sl) return 'Item indisponível';
    if (ch.gold < sl.price) return 'Ouro insuficiente';
    if (ch.backpack.length >= ch.backpackSize && !(sl.item.cls === ch.classKey && !ch.weapon)) return 'Mochila cheia';
    ch.gold -= sl.price;
    s.slots.splice(idx, 1);
    s.dirty = true;
    this.vault[ch.team] += sl.price;
    const it = sl.item;
    if (it.cls === ch.classKey && weaponScore(it) > weaponScore(ch.weapon)) {
      if (ch.weapon) ch.backpack.push(ch.weapon);
      ch.equip(it);
    } else ch.backpack.push(it);
    // energia e XP para o mercador que expôs
    const m = sl.exposedBy;
    if (m && m.isMerchant && m.team === ch.team) {
      if (sl.mode === 'discount') this.addEnergy(m, Math.round(RARITY[it.rarity].discount * LEVEL_MULT[it.lvl - 1]));
      addXp(m, XP.sale[it.rarity], 'venda');
    }
    sfx('buy', this.game.combat.dist(ch));
    return true;
  }

  /** Jogador vende um item da mochila ao time (mercador por perto ou banca). */
  sell(ch, idx, merchant = null) {
    const it = ch.backpack[idx];
    if (!it) return 'Item inválido';
    const v = sellValue(it);
    if (this.vault[ch.team] < v) return 'O cofre do castelo não tem ouro suficiente';
    const s = this.stalls[ch.team];
    let dest = null;
    if (merchant && merchant.alive && merchant.backpack.length < merchant.backpackSize) dest = merchant.backpack;
    else if (s.depot.length < STALL.depot) dest = s.depot;
    if (!dest) return 'Depósito da banca cheio';
    this.vault[ch.team] -= v;
    ch.gold += v;
    ch.backpack.splice(idx, 1);
    dest.push(it);
    const m = merchant || this.merchantsOf(ch.team).find(x => x.alive) || null;
    if (m) this.addEnergy(m, MERCHANT.buyEnergy);
    sfx('buy', this.game.combat.dist(ch));
    return true;
  }

  expose(m, idx, mode) {
    const s = this.stalls[m.team];
    const it = m.backpack[idx];
    if (!it) return 'Item inválido';
    if (s.slots.length >= this.stallSlotsMax(m.team)) return 'A banca está cheia';
    if (mode === 'overcharge') {
      const cost = Math.round(RARITY[it.rarity].overcharge * LEVEL_MULT[it.lvl - 1]);
      if (m.energy < cost) return `Energia insuficiente (${cost})`;
      m.energy -= cost;
    }
    m.backpack.splice(idx, 1);
    s.slots.push({ item: it, mode, price: stallPrice(it, mode), exposedBy: m, at: this.game.time });
    s.dirty = true;
    sfx('coin', this.game.combat.dist(m));
    return true;
  }
  withdraw(m, idx) {
    const s = this.stalls[m.team], sl = s.slots[idx];
    if (!sl) return 'Item inválido';
    if (m.backpack.length >= m.backpackSize) return 'Mochila cheia';
    s.slots.splice(idx, 1); s.dirty = true;
    m.backpack.push(sl.item);
    return true;
  }
  fromDepot(m, idx) {
    const s = this.stalls[m.team], it = s.depot[idx];
    if (!it) return 'Item inválido';
    if (m.backpack.length >= m.backpackSize) return 'Mochila cheia';
    s.depot.splice(idx, 1);
    m.backpack.push(it);
    return true;
  }

  // ------------------------------------------------------------ Mercador: energia, almas, canalização
  addEnergy(m, n) { m.energy = Math.max(0, Math.min(MERCHANT.energyMax, m.energy + n)); }
  addSouls(m, n) {
    const before = m.souls;
    m.souls = Math.min(MERCHANT.soulsMax, m.souls + n);
    const over = n - (m.souls - before);
    if (over > 0.0001) this.addEnergy(m, over * MERCHANT.soulOverflowEnergy);
  }

  startChannel(ch, kind, dur, onDone, refund) {
    ch.channel = { kind, start: this.game.time, until: this.game.time + dur, dur, onDone, refund };
    ch.blocking = false;
    ch.vel.set(0, 0, 0);
  }
  cancelChannel(ch, byDamage = false) {
    const c = ch.channel;
    if (!c) return;
    ch.channel = null;
    if (c.refund) c.refund();
    if (ch.isPlayer) this.game.hud.status(byDamage ? 'Interrompido! A energia voltou.' : 'Cancelado. A energia voltou.');
  }

  craft(m, { cls, rarity, attr, lvl }) {
    const sk = SKILL_BY_ID.m_craft, perk = perkOf(m, sk);
    if (perk === undefined) return 'Skill bloqueada';
    if ((m.cd[sk.id] || 0) > 0 || m.channel) return 'Aguarde';
    if (rarity > maxRarityFor(m.level)) return `Raridade disponível no nível ${RARITY[rarity].level}`;
    const cost = craftEnergy(rarity, lvl, perk);
    if (m.energy < cost) return `Energia insuficiente (${cost})`;
    m.energy -= cost;
    const dur = craftTime(rarity, lvl, perk, this.inCity(m));
    this.game.combat.commitSkill(m, sk);
    this.startChannel(m, 'craft', dur, () => {
      const it = makeWeapon(cls, rarity, attr, lvl);
      this.storeForMerchant(m, it);
      sfx('craft', this.game.combat.dist(m));
      if (m.isPlayer) this.game.announce('Arma fabricada!', weaponLabel(it) + ' · ' + weaponDesc(it));
    }, () => this.addEnergy(m, cost));
    sfx('craft', this.game.combat.dist(m));
    return true;
  }

  storeForMerchant(m, it) {
    if (m.backpack.length < m.backpackSize) m.backpack.push(it);
    else if (this.stalls[m.team].depot.length < STALL.depot) this.stalls[m.team].depot.push(it);
    else this.spawnGroundWeapon(it, m.pos);
  }

  /** Aprimorar: target = {bag: idx} ou {ally: ch}; refine = sobe a raridade (perk Refino). */
  upgrade(m, target, refine = false) {
    const sk = SKILL_BY_ID.m_upgrade, perk = perkOf(m, sk);
    if (perk === undefined) return 'Skill bloqueada';
    if ((m.cd[sk.id] || 0) > 0 || m.channel) return 'Aguarde';
    const item = target.ally ? target.ally.weapon : m.backpack[target.bag];
    if (!item) return 'Sem arma para aprimorar';
    if (target.ally && target.ally.pos.distanceTo(m.pos) > 4.5) return 'O aliado precisa estar a até 4 m';
    let cost;
    if (refine) {
      if (perk !== 'B') return 'Precisa do perk Refino';
      if (item.rarity >= RARITY.length - 1) return 'Já é lendária';
      if (item.rarity + 1 > maxRarityFor(m.level)) return `Raridade disponível no nível ${RARITY[item.rarity + 1].level}`;
      cost = refineEnergy(item.rarity + 1, perk);
    } else {
      if (item.lvl >= 5) return 'Já está no +5';
      cost = upgradeEnergy(item.lvl + 1, perk);
    }
    if (m.energy < cost) return `Energia insuficiente (${cost})`;
    m.energy -= cost;
    this.game.combat.commitSkill(m, sk);
    this.startChannel(m, 'upgrade', 2, () => {
      if (refine) item.rarity++; else item.lvl++;
      if (target.ally) target.ally.recalcStats();
      if (target.ally && target.ally.model) target.ally.refreshWeaponGlow();
      if (target.ally && target.ally.isPlayer) this.game.pc.buildViewmodel();
      sfx('craft', this.game.combat.dist(m));
      if (m.isPlayer) this.game.announce('Arma aprimorada!', weaponLabel(item));
      if (target.ally && target.ally.isPlayer) this.game.announce('Sua arma foi aprimorada!', weaponLabel(item));
    }, () => this.addEnergy(m, cost));
    return true;
  }

  scrap(m, idx) {
    const sk = SKILL_BY_ID.m_scrap, perk = perkOf(m, sk);
    if (perk === undefined) return 'Skill bloqueada';
    if ((m.cd[sk.id] || 0) > 0) return 'Aguarde';
    const it = m.backpack[idx];
    if (!it) return 'Item inválido';
    m.backpack.splice(idx, 1);
    const e = Math.round(craftEnergy(it.rarity, it.lvl, null) * (perk === 'A' ? 0.75 : 0.5));
    this.addEnergy(m, e);
    if (perk === 'B') this.vault[m.team] += Math.round(RARITY[it.rarity].price * 0.25);
    this.game.combat.commitSkill(m, sk);
    sfx('craft', this.game.combat.dist(m));
    return true;
  }

  startWork(m, key) {
    const sk = SKILL_BY_ID.m_works, perk = perkOf(m, sk);
    if (perk === undefined) return 'Skill bloqueada';
    if (!this.inCity(m)) return 'Só dentro da cidade';
    if (this.building[m.team]) return 'Já há uma obra em andamento';
    const lvl = this.works[m.team][key];
    const cost = workCost(key, lvl, perk);
    if (!cost) return 'Nível máximo';
    if (this.vault[m.team] < cost.gold) return `Cofre sem ouro suficiente (${cost.gold})`;
    if (m.energy < cost.energy) return `Energia insuficiente (${cost.energy})`;
    this.vault[m.team] -= cost.gold;
    m.energy -= cost.energy;
    this.game.combat.commitSkill(m, sk);
    this.building[m.team] = { key, doneAt: this.game.time + (perk === 'B' ? 0 : WORK_TIME), by: m };
    sfx('craft', this.game.combat.dist(m));
    if (m.isPlayer && perk !== 'B') this.game.announce(`Obra iniciada: ${WORKS[key].name}`, `Fica pronta em ${WORK_TIME} s`);
    return true;
  }

  rebuildTowers(m) {
    if (!this.inCity(m)) return 'Só dentro da cidade';
    const lvl = this.works[m.team].towers;
    if (!lvl) return 'Sem torres';
    const dead = this.towers[m.team].filter(t => !t.alive);
    if (!dead.length) return 'Nenhuma torre destruída';
    const sk = SKILL_BY_ID.m_works, perk = perkOf(m, sk);
    const gold = Math.round(WORKS.towers.costs[lvl - 1][0] * 0.5 * (perk === 'A' ? 0.8 : 1)) * dead.length;
    if (this.vault[m.team] < gold) return `Cofre sem ouro suficiente (${gold})`;
    this.vault[m.team] -= gold;
    for (const t of dead) t.rebuild();
    return true;
  }

  finishWork(team) {
    const b = this.building[team];
    this.building[team] = null;
    const w = this.works[team];
    w[b.key]++;
    if (b.key === 'towers') this.applyTowers(team);
    if (b.by) addXp(b.by, XP.workDone, 'obra');
    const pl = this.game.player;
    if (pl.team === team) this.game.announce(`Obra concluída: ${WORKS[b.key].name} (nível ${w[b.key]})`, WORKS[b.key].desc, team);
    this.game.feed(`<span class="${team ? 'r' : 'b'}">Time ${TEAM_NAME[team]}</span> concluiu a obra <span class="g">${WORKS[b.key].name} ${w[b.key]}</span>`);
  }

  applyTowers(team) {
    const lvl = this.works[team].towers;
    const want = lvl >= 2 ? 2 : 1;
    const spots = this.game.world.castles[team].towerSpots;
    while (this.towers[team].length < want) {
      const t = new Tower(this.game, team, spots[this.towers[team].length], lvl);
      this.towers[team].push(t);
      this.game.structures.push(t);
    }
    for (const t of this.towers[team]) t.setLevel(lvl);
  }

  revive(m, ally) {
    const sk = SKILL_BY_ID.s_revive, perk = perkOf(m, sk);
    if (perk === undefined) return 'Skill bloqueada';
    if ((m.cd[sk.id] || 0) > 0) return 'Aguarde';
    const cost = perk === 'B' ? 8 : 10;
    if (m.souls < cost) return `Almas insuficientes (${cost})`;
    if (!ally || ally.alive || ally.team !== m.team || ally.isMonster || ally === m) return 'Aliado inválido';
    const g = this.game;
    g.combat.commitSkill(m, sk);
    const f = m.forward();
    const p = new THREE.Vector3(m.pos.x + f.x * 2, 0, m.pos.z + f.z * 2);
    g.col.resolve(p, 0.6, 0);
    g.reviveChar(ally, p, m.yaw);
    ally.st.resUntil = g.time + (perk === 'A' ? 90 : 60);
    addXp(m, XP.resurrect, 'ressurreição');
    sfx('summon', g.combat.dist(m));
    g.effects.ring(p, 3, 0xb48aff, 0.8);
    g.feed(`<span class="${m.team ? 'r' : 'b'}">${m.displayName}</span> ressuscitou <span class="${ally.team ? 'r' : 'b'}">${ally.displayName}</span>`);
    return true;
  }

  harvest(m, r, loot) {
    let n = 0;
    for (const s of this.souls) {
      if (s.owner !== m || s.taken) continue;
      if (s.pos.distanceTo(m.pos) < r) { this.takeSoul(s); n++; }
    }
    if (loot) {
      for (const it of [...this.ground]) if (it.pos.distanceTo(m.pos) < r) { if (this.pickup(m, { kind: it.kind, obj: it }, { silent: true })) n++; }
      for (const c of this.coins) if (c.active && c.pos.distanceTo(m.pos) < r) { this.pickup(m, { kind: 'coin', obj: c }, { silent: true }); n++; }
    }
    return n;
  }

  takeSoul(s) {
    s.taken = true;
    this.addSouls(s.owner, s.value);
    this.game.scene.remove(s.mesh);
    this.game.effects.puff(s.pos, 0xb48aff);
    if (s.owner.isPlayer) this.game.hud.status(`+${s.value} alma${s.value > 1 ? 's' : ''}`);
  }

  spawnSoul(owner, pos, value) {
    const g = this.game;
    const mesh = new THREE.Group();
    mesh.add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), new THREE.MeshBasicMaterial({ color: 0xd8c0ff })));
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), new THREE.MeshBasicMaterial({ color: 0x9a6aff, transparent: true, opacity: 0.35, depthWrite: false }));
    mesh.add(glow);
    mesh.position.set(pos.x, pos.y + 1.2, pos.z);
    g.scene.add(mesh);
    this.souls.push({ owner, pos: mesh.position.clone(), value, until: g.time + MERCHANT.soulLife, mesh, phase: Math.random() * 6 });
  }

  // ------------------------------------------------------------ mortes
  onDeath(target, source, { silent }) {
    const g = this.game, t = g.time;
    const killer = source && source.summon ? source.summon.owner : source;
    if (!silent) {
      if (!target.isMonster) {
        if (killer && killer.cls && killer.team !== target.team) {
          addXp(killer, XP.kill, 'abate');
          killer.gold += GOLD.kill;
          if (killer.isPlayer) g.hud.status(`+${GOLD.kill} de ouro`);
        }
      } else if (killer && killer.cls && killer.team !== target.team) {
        addXp(killer, target.monster.xp, 'esqueleto');
        killer.gold += GOLD.skeleton;
      }
      for (const [src, at] of target.dmgBy) {
        if (src === killer || !src.cls || src.team === target.team || t - at > 10) continue;
        addXp(src, XP.assist, 'assistência');
      }
      if (killer && killer.alive && killer.cls && t < killer.st.ironUntil && killer.st.ironPerk === 'B') g.combat.heal(killer, 30, killer);
      // almas para os mercadores próximos
      for (const m of g.characters) {
        if (!m.isMerchant || !m.alive || m === target) continue;
        if (m.pos.distanceTo(target.pos) > MERCHANT.soulRange) continue;
        let v = 0;
        if (target.isMonster) v = target.team !== m.team ? 1 : 0;
        else v = target.team !== m.team ? 2 : 1;
        if (v) this.spawnSoul(m, target.pos, v);
      }
    }
    // queda da arma
    if (!target.isMonster && target.weapon && !target.resurrectEnd) {
      const it = target.weapon;
      target.weapon = null;
      target.recalcStats();
      if (target.model) target.refreshWeaponGlow();
      if (it.rarity === 0) this.spawnGroundGold(GOLD.dropPile, target.pos);
      else { it.rarity--; it.lvl = Math.max(1, it.lvl - 1); this.spawnGroundWeapon(it, target.pos); }
    }
  }

  onStructureDestroyed(tower, source) {
    tower.destroy();
    const killer = source && source.summon ? source.summon.owner : source;
    if (killer && killer.cls) addXp(killer, XP.structure, 'torre');
    this.game.feed(`Uma <span class="g">torre de defesa</span> do time ${TEAM_NAME[tower.team]} foi destruída!`);
  }

  // ------------------------------------------------------------ bots
  /** Bot ao renascer: vende o que não usa e compra a melhor arma da classe que conseguir pagar. */
  botShop(ch) {
    for (let i = ch.backpack.length - 1; i >= 0; i--) {
      const it = ch.backpack[i];
      if (it.cls === ch.classKey && weaponScore(it) > weaponScore(ch.weapon)) { ch.backpack.splice(i, 1); if (ch.weapon) ch.backpack.push(ch.weapon); ch.equip(it); continue; }
      if (ch.isMerchant) continue;
      this.sell(ch, i);
    }
    const s = this.stalls[ch.team];
    let best = -1, bs = weaponScore(ch.weapon);
    s.slots.forEach((sl, i) => {
      if (sl.item.cls !== ch.classKey || sl.price > ch.gold) return;
      const sc = weaponScore(sl.item);
      if (sc > bs) { bs = sc; best = i; }
    });
    if (best >= 0) this.buy(ch, best);
  }

  // ------------------------------------------------------------ atualização
  update(dt) {
    const g = this.game, t = g.time;
    // renda passiva
    for (const c of g.characters) {
      if (c.isMonster || !c.cls) continue;
      const k = GOLD.passive + 0.5 * this.workLevel(c.team, 'treasury');
      c._goldAcc = (c._goldAcc || 0) + k * dt;
      if (c._goldAcc >= 1) { const n = Math.floor(c._goldAcc); c._goldAcc -= n; c.gold += n; }
      if (c.isMerchant && c.alive) this.addEnergy(c, (this.inCity(c) ? MERCHANT.regenIn : MERCHANT.regenOut) * dt);
      if (c.channel) {
        if (!c.alive) c.channel = null;
        else if (t >= c.channel.until) { const ch = c.channel; c.channel = null; ch.onDone(); }
      }
    }
    // obras
    for (const team of [0, 1]) if (this.building[team] && t >= this.building[team].doneAt) this.finishWork(team);
    // moedas e baús
    for (const c of this.coins) {
      if (!c.active) { if (t >= c.respawnAt) { c.active = true; c.amount = this.coinAmount(); c.mesh.visible = true; } continue; }
      c.mesh.rotation.y += dt * 1.5;
    }
    for (const c of this.chests) if (!c.active && t >= c.respawnAt) { c.active = true; c.mesh.visible = c.glow.visible = true; }
    // itens no chão
    for (let i = this.ground.length - 1; i >= 0; i--) {
      const it = this.ground[i];
      if (t > it.until) { this.removeGround(it); continue; }
      if (it.kind === 'weapon') it.mesh.children[0].rotation.z += dt;
    }
    // coleta automática dos bots
    for (const c of g.characters) {
      if (!c.isBot || !c.alive) continue;
      if ((c._pickAt || 0) > t) continue;
      c._pickAt = t + 0.3;
      const p = this.nearestPickup(c, 1.9);
      if (!p) continue;
      if (p.kind === 'weapon' && c.backpack.length >= c.backpackSize && !(p.obj.item.cls === c.classKey && !c.weapon)) continue;
      this.pickup(c, p);
    }
    // almas
    const showSouls = g.player && g.player.isMerchant;
    for (let i = this.souls.length - 1; i >= 0; i--) {
      const s = this.souls[i];
      if (s.taken || t > s.until || !s.owner.alive && t > s.until - 6) { if (!s.taken) g.scene.remove(s.mesh); this.souls.splice(i, 1); continue; }
      s.mesh.visible = showSouls && s.owner === g.player;
      s.mesh.position.y = s.pos.y + Math.sin(t * 3 + s.phase) * 0.2;
      if (s.owner.alive && Math.hypot(s.owner.pos.x - s.pos.x, s.owner.pos.z - s.pos.z) < MERCHANT.soulPickup) { this.takeSoul(s); this.souls.splice(i, 1); }
    }
    // túmulos
    for (const tb of this.tombs) {
      const ready = t >= tb.readyAt;
      tb.glow.visible = ready && showSouls;
      if (tb.glow.visible) tb.glow.scale.setScalar(1 + Math.sin(t * 4) * 0.15);
      if (!ready) continue;
      for (const m of g.characters) {
        if (!m.isMerchant || !m.alive) continue;
        if (Math.hypot(m.pos.x - tb.pos.x, m.pos.z - tb.pos.z) < 2.2) {
          this.addSouls(m, 1);
          tb.readyAt = t + MERCHANT.tombEvery;
          if (m.isPlayer) g.hud.status('+1 alma (túmulo)');
          break;
        }
      }
    }
    // vendedor fixo para times sem mercador
    if (t >= this.fallbackAt) {
      this.fallbackAt = t + 15;
      for (const team of [0, 1]) {
        if (this.merchantsOf(team).length) continue;
        const s = this.stalls[team];
        const classes = [...new Set(g.characters.filter(c => c.team === team && c.cls).map(c => c.classKey))];
        while (s.slots.length < STALL.slots) {
          const cls = classes.length && Math.random() < 0.75 ? classes[Math.floor(Math.random() * classes.length)] : CLASS_KEYS[Math.floor(Math.random() * 7)];
          const it = makeWeapon(cls === 'merchant' ? 'knight' : cls, 0, ATTR_KEYS[Math.floor(Math.random() * ATTR_KEYS.length)], 1);
          s.slots.push({ item: it, mode: 'normal', price: stallPrice(it, 'normal'), exposedBy: null, at: g.time });
          s.dirty = true;
        }
      }
    }
    for (const team of [0, 1]) if (this.stalls[team].dirty) this.refreshStallDisplay(team);
    for (const tw of g.structures) tw.update(dt);
  }
}

export { TOWER, MONSTERS };
