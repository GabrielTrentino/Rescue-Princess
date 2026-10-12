// Objetivos: as duas princesas (resgate/captura) e os banquetes que engordam a prisioneira.
import * as THREE from 'three';
import { Assets, cloneModel, uniqueMaterials } from './assets.js';
import { TEAM, TEAM_HEX, TEAM_NAME, PRINCESS_RETURN_TIME, MAX_FAT } from './config.js';
import { heightAt } from './world.js';
import { sfx } from './audio.js';
import { addXp } from './progression.js';
import { XP } from './config.js';

/** Ladino, Mercador e Invocador não podem pegar a princesa. */
export function canCarry(ch) { return !!(ch && ch.cls && ch.cls.canCarry !== false && !ch.isMonster); }

const PRINCESS_TINT = [0xd9c8ff, 0xffc4dc];

function makeCrown(team) {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xffcf3a, metalness: 0.6, roughness: 0.3, emissive: 0x6a4a00, emissiveIntensity: 0.4 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.22, 10, 1, true), gold);
  band.material.side = THREE.DoubleSide;
  g.add(band);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 6), gold);
    spike.position.set(Math.cos(a) * 0.42, 0.22, Math.sin(a) * 0.42);
    g.add(spike);
  }
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), new THREE.MeshStandardMaterial({ color: TEAM_HEX[team], emissive: TEAM_HEX[team], emissiveIntensity: 0.6 }));
  gem.position.set(0, 0.02, 0.45);
  g.add(gem);
  return g;
}

export class Princess {
  constructor(game, team) {
    this.game = game;
    this.team = team; // a qual time ela pertence
    this.captor = 1 - team;
    this.state = 'captive';
    this.fat = 0;
    this.pos = new THREE.Vector3();
    this.carrier = null;
    this.dropTime = 0;
    this.yaw = 0;
    this.buildModel();
    this.returnToCell(true);
  }

  get name() { return 'Princesa ' + TEAM_NAME[this.team]; }
  get cellPos() { return this.game.world.castles[this.captor].cellPos; }

  buildModel() {
    const m = cloneModel('Mage', { skinned: true });
    uniqueMaterials(m, PRINCESS_TINT[this.team]);
    const hat = m.getObjectByName('Mage_Hat');
    if (hat) hat.visible = false;
    m.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    const head = m.getObjectByName('head');
    const crown = makeCrown(this.team);
    crown.position.set(0, 1.22, 0.02);
    crown.scale.setScalar(1.1);
    (head || m).add(crown);
    // aura colorida no chão
    const aura = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: TEAM_HEX[this.team], transparent: true, opacity: 0.7, depthWrite: false }));
    aura.position.y = 0.06;
    m.add(aura);
    this.aura = aura;
    this.model = m;
    this.mixer = new THREE.AnimationMixer(m);
    this.game.scene.add(m);
    this.playLoop('Idle_B');
  }

  playLoop(name) {
    if (this.loop === name) return;
    const clip = Assets.clips[name];
    if (!clip) return;
    const a = this.mixer.clipAction(clip);
    a.reset().fadeIn(0.25).play();
    if (this.loopAction) this.loopAction.fadeOut(0.25);
    this.loopAction = a; this.loop = name;
  }

  playOnce(name) {
    const clip = Assets.clips[name];
    if (!clip) return;
    const a = this.mixer.clipAction(clip);
    a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = false; a.fadeIn(0.1).play();
    a.weight = 1;
    this.game.after(Math.max(0.1, clip.duration - 0.3), () => a.fadeOut(0.3));
  }

  setFatScale() {
    const k = this.fat / MAX_FAT;
    this.model.scale.set(1 + k * 0.85, 1 + k * 0.12, 1 + k * 0.85);
  }

  returnToCell(silent = false) {
    this.state = 'captive';
    if (this.carrier) this.carrier.carrying = null;
    this.carrier = null;
    this.pos.copy(this.cellPos);
    this.pos.y = heightAt(this.pos.x, this.pos.z);
    this.yaw = this.captor === TEAM.BLUE ? 0 : Math.PI;
    this.playLoop('Idle_B');
    if (!silent) {
      this.game.announce(`${this.name} voltou para a masmorra`, '', this.team);
    }
  }

  pickUp(ch) {
    if (ch.carrying || !ch.alive || !canCarry(ch)) return false;
    const wasCaptive = this.state === 'captive';
    this.state = 'carried';
    this.carrier = ch;
    ch.carrying = this;
    ch.blocking = false;
    if (ch.food) { ch.food = false; this.game.objectives.dropFood(ch); }
    ch.breakInvis();
    ch.channel = null;
    this.playLoop('Jump_Idle');
    sfx('pickup', this.game.combat.dist(ch));
    const who = ch.isPlayer ? 'Você' : ch.name;
    if (wasCaptive) {
      this.game.announce(`${who} libertou a ${this.name}!`, 'Ela está sendo levada para casa', this.team);
      sfx('alarm');
    }
    this.game.feed(`<span class="${ch.team === 0 ? 'b' : 'r'}">${who}</span> pegou a <span class="g">${this.name}</span>`);
    return true;
  }

  drop() {
    const c = this.carrier;
    if (!c) return;
    c.carrying = null;
    this.carrier = null;
    this.state = 'dropped';
    this.dropTime = this.game.time;
    this.pos.copy(c.pos);
    this.pos.y = heightAt(this.pos.x, this.pos.z);
    this.playLoop('Idle_A');
    this.game.feed(`A <span class="g">${this.name}</span> caiu no chão!`);
  }

  update(dt) {
    const g = this.game;
    if (this.state === 'carried') {
      const c = this.carrier;
      if (!c || !c.alive) { this.drop(); }
      else {
        this.pos.set(c.pos.x, c.pos.y + 1.55, c.pos.z);
        this.yaw = c.yaw;
        const throne = g.world.castles[this.team].throne;
        if (Math.hypot(c.pos.x - throne.x, c.pos.z - throne.z) < g.world.castles[this.team].throneRadius) {
          g.onRescue(this, c);
        }
      }
    } else if (this.state === 'dropped') {
      if (g.time - this.dropTime > PRINCESS_RETURN_TIME) this.returnToCell();
      else {
        for (const o of g.characters) {
          if (!o.alive || o.team !== this.captor || o.isMonster) continue;
          if (Math.hypot(o.pos.x - this.pos.x, o.pos.z - this.pos.z) < 1.8) {
            const who = o.isPlayer ? 'Você' : o.name;
            addXp(o, XP.returnPrincess, 'princesa devolvida');
            g.feed(`<span class="${o.team === 0 ? 'b' : 'r'}">${who}</span> devolveu a <span class="g">${this.name}</span> à masmorra`);
            this.returnToCell(true);
            break;
          }
        }
      }
    }
    // visual
    const m = this.model;
    const hideForPlayer = this.state === 'carried' && this.carrier && this.carrier.isPlayer;
    m.visible = !hideForPlayer;
    m.position.copy(this.pos);
    m.rotation.y = this.yaw;
    this.aura.visible = this.state !== 'carried';
    if (this.state === 'carried') m.scale.multiplyScalar(1); // mantém
    this.setFatScale();
    if (this.state === 'carried') m.scale.multiplyScalar(0.8);
    this.mixer.update(dt);
  }

  feed() {
    if (this.fat >= MAX_FAT) return false;
    this.fat++;
    this.playOnce('Use_Item');
    return true;
  }
}

export class Objectives {
  constructor(game) {
    this.game = game;
    this.princesses = [new Princess(game, TEAM.BLUE), new Princess(game, TEAM.RED)];
    this.foods = [];
    for (const p of game.world.foodSpawns) this.foods.push(this.makeFood(p, true));
    this.loose = []; // comida derrubada
  }

  makeFood(pos, spawner) {
    const m = cloneModel('plate_food_A');
    m.scale.setScalar(0.9);
    m.position.copy(pos);
    this.game.scene.add(m);
    const glow = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd25a, transparent: true, opacity: 0.8, depthWrite: false }));
    glow.position.copy(pos); glow.position.y += 0.18;
    this.game.scene.add(glow);
    // marca de contaminação: só aparece para quem joga de Ladino
    const mark = new THREE.Group();
    const green = new THREE.MeshBasicMaterial({ color: 0x6aff3a, transparent: true, opacity: 0.85, depthWrite: false });
    mark.add(new THREE.Mesh(new THREE.RingGeometry(1.0, 1.25, 24).rotateX(-Math.PI / 2), green));
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), green);
    skull.position.y = 1.5; mark.add(skull);
    mark.position.copy(pos); mark.position.y += 0.2;
    mark.visible = false;
    this.game.scene.add(mark);
    return { pos: pos.clone(), mesh: m, glow, mark, active: true, respawnAt: 0, spawner, phase: Math.random() * 6, poison: null, poisoner: null };
  }

  /** Princesa que pertence ao time t. */
  princessOf(t) { return this.princesses[t]; }
  /** Prisioneira guardada no castelo do time t (pertence ao inimigo). */
  captiveOf(t) { return this.princesses[1 - t]; }

  dropPrincess(ch) { if (ch.carrying) ch.carrying.drop(); }

  dropFood(ch) {
    const p = ch.pos.clone(); p.y = heightAt(p.x, p.z);
    const f = this.makeFood(p, false);
    f.expire = this.game.time + 30;
    f.poison = ch.foodPoison; f.poisoner = ch.foodPoisoner || null;
    ch.foodPoison = null; ch.foodPoisoner = null;
    this.foods.push(f);
  }
  removeFood(f) {
    const g = this.game;
    g.scene.remove(f.mesh); g.scene.remove(f.glow); g.scene.remove(f.mark);
    const i = this.foods.indexOf(f);
    if (i >= 0) this.foods.splice(i, 1);
  }

  /** Interação do jogador/bot (tecla E). Retorna texto do que fez ou null. */
  interact(ch) {
    if (!ch.alive) return null;
    if (ch.carrying) { ch.carrying.drop(); return 'drop'; }
    const own = this.princessOf(ch.team);
    if (own.state !== 'carried' && own.state !== 'rescued' && Math.hypot(own.pos.x - ch.pos.x, own.pos.z - ch.pos.z) < 3) {
      if (!canCarry(ch)) return 'nocarry';
      own.pickUp(ch); return 'pickup';
    }
    const captive = this.captiveOf(ch.team);
    if (ch.food && captive.state === 'captive' && Math.hypot(captive.pos.x - ch.pos.x, captive.pos.z - ch.pos.z) < 3.4) {
      return this.feedCaptive(ch) ? 'feed' : 'full';
    }
    return null;
  }

  feedCaptive(ch) {
    const captive = this.captiveOf(ch.team);
    // banquete contaminado por um Ladino inimigo: a prisioneira (princesa do Ladino) perde 1 nível de peso
    if (ch.foodPoison !== null && ch.foodPoison !== undefined && ch.foodPoison !== ch.team) {
      const by = ch.foodPoisoner;
      ch.food = false; ch.foodPoison = null; ch.foodPoisoner = null;
      captive.fat = Math.max(0, captive.fat - 1);
      captive.playOnce('Use_Item');
      sfx('poison', this.game.combat.dist(ch));
      if (by && by.cls) addXp(by, XP.feed, 'banquete contaminado');
      const who = ch.isPlayer ? 'Você' : ch.name;
      this.game.feed(`<span class="${ch.team === 0 ? 'b' : 'r'}">${who}</span> deu um banquete <span class="g">contaminado</span>: a ${captive.name} emagreceu (peso ${captive.fat}/${MAX_FAT})`);
      if (ch.isPlayer) this.game.announce('O banquete estava contaminado!', `A prisioneira ficou mais leve (${captive.fat}/${MAX_FAT})`);
      else if (by && by.isPlayer) this.game.announce('Seu banquete contaminado funcionou!', `A sua princesa ficou mais leve (${captive.fat}/${MAX_FAT})`);
      return true;
    }
    if (!captive.feed()) return false;
    ch.food = false; ch.foodPoison = null; ch.foodPoisoner = null;
    ch.feeds++;
    addXp(ch, XP.feed, 'banquete');
    sfx('eat', this.game.combat.dist(ch));
    const who = ch.isPlayer ? 'Você' : ch.name;
    this.game.feed(`<span class="${ch.team === 0 ? 'b' : 'r'}">${who}</span> alimentou a <span class="g">${captive.name}</span> (peso ${captive.fat}/${MAX_FAT})`);
    if (ch.isPlayer) this.game.announce('A prisioneira comeu o banquete!', `Ela está mais pesada para o inimigo carregar (${captive.fat}/${MAX_FAT})`);
    return true;
  }

  /** Dica de interação para o jogador. */
  promptFor(ch) {
    if (!ch.alive) return '';
    if (ch.carrying) return '<b>[E]</b> Soltar a princesa · leve-a ao <b>círculo do trono</b>';
    const own = this.princessOf(ch.team);
    if (own.state !== 'carried' && own.state !== 'rescued' && Math.hypot(own.pos.x - ch.pos.x, own.pos.z - ch.pos.z) < 3) {
      return canCarry(ch) ? '<b>[E]</b> Pegar a sua princesa' : `O ${ch.cls.name} não pode carregar a princesa`;
    }
    const captive = this.captiveOf(ch.team);
    if (ch.food && captive.state === 'captive' && Math.hypot(captive.pos.x - ch.pos.x, captive.pos.z - ch.pos.z) < 3.4) {
      return captive.fat >= MAX_FAT ? 'A prisioneira não aguenta comer mais' : '<b>[E]</b> Dar o banquete à prisioneira';
    }
    return '';
  }

  update(dt) {
    const g = this.game;
    for (const p of this.princesses) p.update(dt);
    const seePoison = g.player && g.player.classKey === 'rogue';
    // comida
    for (let i = this.foods.length - 1; i >= 0; i--) {
      const f = this.foods[i];
      if (!f.active) {
        f.mark.visible = false;
        if (f.spawner && g.time >= f.respawnAt) { f.active = true; f.mesh.visible = f.glow.visible = true; f.poison = null; f.poisoner = null; }
        continue;
      }
      if (f.expire && g.time > f.expire) { this.removeFood(f); continue; }
      f.mark.visible = f.poison !== null && f.poison !== undefined && seePoison;
      if (f.mark.visible) f.mark.rotation.y += dt * 2;
      f.mesh.rotation.y += dt;
      f.mesh.position.y = f.pos.y + 0.35 + Math.sin(g.time * 2 + f.phase) * 0.12;
      for (const o of g.characters) {
        if (!o.alive || o.isMonster || o.food || o.carrying) continue;
        // o Ladino reconhece o banquete contaminado pelo inimigo e não o pega
        if (o.classKey === 'rogue' && f.poison !== null && f.poison !== undefined && f.poison !== o.team) continue;
        if (Math.hypot(o.pos.x - f.pos.x, o.pos.z - f.pos.z) < 1.6) {
          o.food = true;
          o.foodPoison = f.poison; o.foodPoisoner = f.poisoner;
          sfx('pickup', g.combat.dist(o));
          if (o.isPlayer) g.announce('Você pegou um banquete!', 'Leve-o à prisioneira na masmorra do seu castelo');
          if (f.spawner) { f.active = false; f.respawnAt = g.time + 50; f.mesh.visible = f.glow.visible = false; }
          else this.removeFood(f);
          break;
        }
      }
    }
    // bots alimentam automaticamente
    for (const o of g.characters) {
      if (!o.isBot || !o.alive || !o.food) continue;
      const captive = this.captiveOf(o.team);
      if (captive.state === 'captive' && captive.fat < MAX_FAT && Math.hypot(captive.pos.x - o.pos.x, captive.pos.z - o.pos.z) < 3.2) this.feedCaptive(o);
    }
  }

  activeFoods() { return this.foods.filter(f => f.active); }
}
