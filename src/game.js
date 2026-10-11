// Partida: cria o mundo, os times, monstros, objetivos e economia, e roda o loop principal.
import * as THREE from 'three';
import { Collision } from './collision.js';
import { World } from './world.js';
import { Character } from './entities.js';
import { Combat } from './combat.js';
import { Effects } from './effects.js';
import { Objectives } from './objectives.js';
import { Economy } from './economy.js';
import { Menus } from './menus.js';
import { BotAI, MonsterAI } from './ai.js';
import { PlayerController } from './player.js';
import { HUD } from './hud.js';
import { TEAM, TEAM_NAME, TEAM_CSS, CLASSES, CLASS_KEYS, BOT_NAMES, SETTINGS, XP, GOLD, MONSTERS } from './config.js';
import { botAutoSpend, addXp } from './progression.js';
import { sfx } from './audio.js';
import { cloneModel } from './assets.js';

const ROLES = ['attacker', 'defender', 'attacker', 'attacker', 'forager', 'defender', 'attacker', 'attacker'];
const BOT_CLASSES = ['knight', 'ranger', 'barbarian', 'priest', 'halberdier', 'mage', 'swordsman', 'summoner', 'rogue', 'knight', 'ranger', 'barbarian'];
const COMBAT_CLASSES = CLASS_KEYS.filter(k => k !== 'merchant');
/** Papel do bot conforme a classe (classes de suporte têm papel próprio). */
function roleFor(cls, base) {
  if (cls === 'merchant') return 'merchant';
  if (cls === 'priest') return 'support';
  if (cls === 'summoner') return 'attacker';
  return base;
}

export class Game {
  constructor(renderer, ui) {
    this.renderer = renderer;
    this.ui = ui;
    this.running = false;
    this.locked = false;
  }

  start(settings, playerClass) {
    this.settings = { ...settings };
    Object.assign(SETTINGS, settings);
    this.time = 0;
    this.dt = 0;
    this.score = [0, 0];
    this.over = false;
    this.timers = [];
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1200);
    this.col = new Collision(12);
    this.world = new World(this.scene, this.col);
    this.world.build();
    this.effects = new Effects(this.scene);
    this.combat = new Combat(this);
    this.characters = [];
    this.structures = [];

    // jogador
    const castles = this.world.castles;
    this.player = new Character(this, { team: TEAM.BLUE, classKey: playerClass, isPlayer: true, name: 'Você' });
    this.characters.push(this.player);
    this.pc && this.pc.dispose();
    this.pc = new PlayerController(this, this.player, this.camera);
    this.hud && this.hud.floaters.forEach(f => f.el.remove());
    document.getElementById('markers').innerHTML = '';
    document.getElementById('feed').innerHTML = '';
    this.hud = new HUD(this);
    this.menus = this.menus || new Menus(this);
    this.menus.close(true);
    this.objectives = new Objectives(this);
    this.economy = new Economy(this);

    // bots
    const n = this.settings.teamSize;
    for (const team of [TEAM.BLUE, TEAM.RED]) {
      const count = team === TEAM.BLUE ? n - 1 : n;
      const offset = Math.floor(Math.random() * BOT_CLASSES.length);
      const wantMerchant = n >= 6 && !(team === TEAM.BLUE && playerClass === 'merchant');
      for (let i = 0; i < count; i++) {
        let cls = BOT_CLASSES[(i + offset) % BOT_CLASSES.length];
        let role = ROLES[i % ROLES.length];
        if (wantMerchant && i === count - 1) cls = 'merchant';
        const ch = new Character(this, { team, classKey: cls, name: BOT_NAMES[team][i % BOT_NAMES[team].length] });
        new BotAI(ch, roleFor(cls, role));
        ch.ai.baseRole = role;
        botAutoSpend(ch);
        ch.gold = 40 + Math.floor(Math.random() * 30);
        this.characters.push(ch);
        this.spawnChar(ch, i);
      }
    }
    this.player.gold = 60;
    // monstros nos acampamentos
    for (const camp of this.world.camps) {
      const types = ['Skeleton_Warrior', 'Skeleton_Minion', 'Skeleton_Mage', 'Skeleton_Rogue', 'Skeleton_Minion'];
      types.forEach((t, i) => {
        const ch = new Character(this, { team: TEAM.NEUTRAL, monsterType: t, name: t });
        ch.name = ch.monster.name;
        const a = (i / types.length) * Math.PI * 2;
        const home = new THREE.Vector3(camp.x + Math.cos(a) * 4, 0, camp.z + Math.sin(a) * 4);
        ch.home = home;
        new MonsterAI(ch, home);
        ch.buildModel();
        this.characters.push(ch);
        ch.spawn(home, Math.random() * 6);
      });
    }
    this.spawnChar(this.player, 0);
    this.player.yaw = castles[TEAM.BLUE].facing;
    this.pc.buildViewmodel();
    this.hud.show(true);
    this.hud.lastClass = null;
    this.running = true;
    this.paused = false;
    this.announce('Resgate a Princesa Azul!', 'Skills nas teclas 1 a 5 · aperte K para escolher um perk. Ela está presa no castelo vermelho.', TEAM.BLUE);
    this.foodMeshes = new Map();
  }

  spawnChar(ch, i = 0) {
    const castle = this.world.castles[ch.team];
    const sp = castle.spawns[(i + Math.floor(Math.random() * castle.spawns.length)) % castle.spawns.length];
    const p = sp.clone();
    p.x += (Math.random() - 0.5) * 2; p.z += (Math.random() - 0.5) * 2;
    ch.spawn(p, castle.facing);
    if (ch.ai) ch.ai.reset();
    if (ch.isBot && this.economy) this.economy.botShop(ch);
  }

  /** Volta à vida no lugar indicado (Ressurreição do Sacerdote). */
  reviveChar(ch, pos, yaw) {
    ch.spawn(pos, yaw);
    ch.respawnAt = 0;
    if (ch.ai) ch.ai.reset();
    if (ch.isPlayer) {
      this.ui.confirmRespawn = false;
      this.ui.hideRespawn();
      this.pc.buildViewmodel();
      this.announce('Você foi ressuscitado!', 'Um sacerdote trouxe você de volta');
    }
  }

  // ------------------------------------------------------------ invocações
  /** Invocação do Invocador: não tem limite de tempo (o limite é de quantidade) e avança contra o inimigo. */
  summon(owner, type, kind, hpMul = 1, extra = {}) {
    const ch = new Character(this, { team: owner.team, monsterType: type, name: MONSTERS[type].name });
    ch.summon = { owner, kind, ...extra };
    ch.maxHp = Math.round(ch.monster.hp * hpMul);
    new MonsterAI(ch, null);
    ch.buildModel();
    const a = Math.random() * Math.PI * 2;
    const p = new THREE.Vector3(owner.pos.x + Math.cos(a) * 2.2, 0, owner.pos.z + Math.sin(a) * 2.2);
    this.col.resolve(p, 0.6, 0);
    ch.spawn(p, owner.yaw);
    ch.hp = ch.maxHp;
    ch.spawnTime = -10;
    this.characters.push(ch);
    this.effects.ring(p, 1.8, 0xb48aff, 0.6);
    return ch;
  }
  summonsOf(owner, kind) { return this.characters.filter(c => c.summon && c.summon.owner === owner && c.summon.kind === kind && c.alive); }

  onKill(target, source, { silent = false } = {}) {
    const name = (c) => c ? `<span class="${TEAM_CSS[c.team]}">${c.isPlayer ? 'Você' : c.name}</span>` : 'O ambiente';
    const killer = source && source.summon ? source.summon.owner : source;
    if (!silent && (!target.isMonster || (killer && killer.isPlayer)) && !target.summon) {
      this.feed(`${name(killer)} abateu ${name(target)}`);
    }
    target.diedAt = this.time;
    if (target.summon) { target.respawnAt = Infinity; return; }
    target.respawnAt = this.time + (target.isMonster ? 45 : this.economy.respawnTime(target));
    if (target.isPlayer) {
      this.pc.deathTime = this.time;
      const killerName = killer ? (killer.isMonster ? killer.name : killer.name + ' (' + CLASSES[killer.classKey].name + ')') : 'o destino';
      this.menus.close(true);
      this.ui.showRespawn(`Você foi abatido por ${killerName}`);
    }
  }

  onRescue(princess, carrier) {
    const team = princess.team;
    this.score[team]++;
    carrier.rescues++;
    carrier.carrying = null;
    princess.carrier = null;
    princess.state = 'rescued';
    const throne = this.world.castles[team].throne;
    princess.pos.copy(throne);
    princess.playLoop('Idle_A');
    addXp(carrier, XP.rescue, 'resgate');
    for (const c of this.characters) if (c.team === team && c.cls) c.gold += GOLD.rescue;
    const who = carrier.isPlayer ? 'Você' : carrier.name;
    if (team === this.player.team) { sfx('fanfare'); this.announce(`${who} resgatou a ${princess.name}!`, `Placar: ${this.score[0]} x ${this.score[1]} · +${GOLD.rescue} de ouro para o time`, team); }
    else { sfx('sad'); this.announce(`O time ${TEAM_NAME[team]} resgatou a princesa deles!`, `Placar: ${this.score[0]} x ${this.score[1]}`, team); }
    this.feed(`<span class="${TEAM_CSS[team]}">${who}</span> <span class="g">resgatou a ${princess.name}!</span>`);
    if (this.score[team] >= this.settings.scoreToWin) {
      this.after(2.5, () => this.endMatch(team));
      return;
    }
    this.after(5, () => {
      princess.returnToCell(true);
      this.feed(`O inimigo sequestrou a <span class="g">${princess.name}</span> de novo!`);
    });
  }

  endMatch(winner) {
    if (this.over) return;
    this.over = true;
    this.menus.close(true);
    this.ui.showEnd(winner === this.player.team, this);
  }

  after(sec, fn) { this.timers.push({ at: this.time + sec, fn }); }

  announce(t, s, team) { this.hud && this.hud.announce(t, s, team); }
  feed(html) { this.hud && this.hud.feed(html); }

  openClassMenu() {
    if (!this.player.alive) return;
    if (!this.world.castles[this.player.team].inside(this.player.pos.x, this.player.pos.z)) {
      this.announce('Só é possível trocar de classe dentro do seu castelo', '');
      return;
    }
    this.ui.showClassChange();
  }

  changePlayerClass(key, immediate) {
    const p = this.player;
    if (p.classKey === key) return;
    const ratio = p.alive ? p.hp / p.maxHp : 1;
    this.combat.endLink(p);
    p.setClass(key);
    if (immediate && p.alive) p.hp = Math.max(1, Math.round(p.maxHp * ratio));
    this.pc.buildViewmodel();
    this.hud.lastClass = null;
  }

  update(dt) {
    this.dt = dt;
    this.time += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (this.time >= this.timers[i].at) { const t = this.timers[i]; this.timers.splice(i, 1); t.fn(); }
    }

    this.pc.update(dt);
    let cleanup = false;
    for (const c of this.characters) {
      if (!c.alive) {
        if (c.summon) { if (this.time - c.diedAt > 3) cleanup = true; else if (c.model && this.time - c.diedAt > 2.5) c.hideModel(); continue; }
        if (c.respawnAt && this.time >= c.respawnAt && !this.over) {
          if (c.isPlayer) {
            if (!this.ui.confirmRespawn) continue;
            this.ui.confirmRespawn = false;
            if (this.ui.pendingClass && this.ui.pendingClass !== c.classKey) this.changePlayerClass(this.ui.pendingClass);
            this.spawnChar(c);
            c.yaw = this.world.castles[c.team].facing;
            this.pc.buildViewmodel();
            this.ui.hideRespawn();
          } else if (c.isMonster) {
            c.spawn(c.home, Math.random() * 6);
            c.ai.reset();
          } else {
            if (!c.isMerchant && Math.random() < 0.25) {
              c.setClass(COMBAT_CLASSES[Math.floor(Math.random() * COMBAT_CLASSES.length)]);
              botAutoSpend(c);
              c.ai.role = roleFor(c.classKey, c.ai.baseRole || 'attacker');
            }
            this.spawnChar(c);
          }
        } else if (c.model && c.model.visible && c.diedAt !== undefined && this.time - c.diedAt > 3.5) {
          c.hideModel();
        }
        continue;
      }
      if (c.ai) c.ai.update(dt);
    }
    if (cleanup) {
      for (let i = this.characters.length - 1; i >= 0; i--) {
        const c = this.characters[i];
        if (c.summon && !c.alive && this.time - c.diedAt > 3) {
          if (c.model) this.scene.remove(c.model);
          this.characters.splice(i, 1);
        }
      }
    }
    // separação entre personagens
    const chars = this.characters;
    for (let i = 0; i < chars.length; i++) {
      const a = chars[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < chars.length; j++) {
        const b = chars[j];
        if (!b.alive) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const d2 = dx * dx + dz * dz, rr = a.radius + b.radius;
        if (d2 < rr * rr && d2 > 1e-6) {
          const d = Math.sqrt(d2), push = (rr - d) * 0.5;
          const nx = dx / d, nz = dz / d;
          const af = a.isPlanted() ? 0 : 1, bf = b.isPlanted() ? 0 : 1;
          a.pos.x -= nx * push * af; a.pos.z -= nz * push * af;
          b.pos.x += nx * push * bf; b.pos.z += nz * push * bf;
        }
      }
    }
    this.combat.update(dt);
    this.economy.update(dt);
    this.objectives.update(dt);
    this.effects.update(dt);
    this.world.update(dt);
    for (const c of this.characters) {
      if (c.model) {
        c.updateAnim(dt);
        c.updateVisual(dt, this.camera);
        this.updateFoodCarry(c);
      }
    }
    this.world.followSun(this.player.pos);
    this.hud.update(dt);
    this.menus.update(dt);
  }

  updateFoodCarry(c) {
    let m = this.foodMeshes.get(c);
    if (c.food && c.alive) {
      if (!m) { m = cloneModel('plate_food_A'); m.scale.setScalar(0.55); this.scene.add(m); this.foodMeshes.set(c, m); }
      m.visible = true;
      m.position.set(c.pos.x, c.pos.y + 3.5, c.pos.z);
      m.rotation.y += 0.03;
    } else if (m) m.visible = false;
  }

  render() {
    const r = this.renderer;
    r.autoClear = false;
    r.clear();
    r.render(this.scene, this.camera);
    this.pc.render(r);
  }

  resize(w, h) {
    if (!this.camera) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  stop() {
    this.running = false;
    this.hud && this.hud.show(false);
    this.menus && this.menus.close(true);
  }
}
