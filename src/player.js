// Controle em primeira pessoa: mouse/teclado, câmera, arma na mão (viewmodel) e ações do jogador.
import * as THREE from 'three';
import { cloneModel, steelify } from './assets.js';
import { EYE_HEIGHT, RARITY } from './config.js';
import { sfx } from './audio.js';
import { skillList } from './skills.js';

const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];

export class PlayerController {
  constructor(game, ch, camera) {
    this.game = game;
    this.ch = ch;
    this.camera = camera;
    this.keys = {};
    this.pressed = {};
    this.mouse = { left: false, right: false, leftPressed: false, leftReleased: false, rightPressed: false };
    this.mdx = 0; this.mdy = 0;
    this.sens = 0.0022;
    this.stamina = 1;
    this.swingT = 1; this.swingDur = 0.35; this.swingKind = 'slash'; this.swingSide = 1;
    this.bobT = 0;
    this.shake = 0;
    this.fov = 75;
    this.stepT = 0;

    this.viewScene = new THREE.Scene();
    this.viewCam = new THREE.PerspectiveCamera(60, camera.aspect, 0.05, 20);
    this.viewScene.add(new THREE.HemisphereLight(0xffffff, 0x666655, 2.2));
    const dl = new THREE.DirectionalLight(0xfff2dd, 1.6);
    dl.position.set(1, 2, 1);
    this.viewScene.add(dl);
    this.vm = new THREE.Group();
    this.viewScene.add(this.vm);
    this.buildViewmodel();
    this.bind();
  }

  bind() {
    this._kd = (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (this.game.menus && this.game.menus.isOpen) return;
      if (!document.getElementById('classMenu').classList.contains('hidden')) return;
      if (!this.keys[e.code]) this.pressed[e.code] = true;
      this.keys[e.code] = true;
    };
    this._ku = (e) => { this.keys[e.code] = false; };
    this._md = (e) => {
      if (!this.game.locked) return;
      if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; }
      if (e.button === 2) { this.mouse.right = true; this.mouse.rightPressed = true; }
    };
    this._mu = (e) => {
      if (e.button === 0) { if (this.mouse.left) this.mouse.leftReleased = true; this.mouse.left = false; }
      if (e.button === 2) this.mouse.right = false;
    };
    this._mm = (e) => { if (this.game.locked) { this.mdx += e.movementX; this.mdy += e.movementY; } };
    this._cm = (e) => e.preventDefault();
    addEventListener('keydown', this._kd);
    addEventListener('keyup', this._ku);
    addEventListener('mousedown', this._md);
    addEventListener('mouseup', this._mu);
    addEventListener('mousemove', this._mm);
    addEventListener('contextmenu', this._cm);
  }

  dispose() {
    removeEventListener('keydown', this._kd);
    removeEventListener('keyup', this._ku);
    removeEventListener('mousedown', this._md);
    removeEventListener('mouseup', this._mu);
    removeEventListener('mousemove', this._mm);
    removeEventListener('contextmenu', this._cm);
  }

  clearInput() {
    this.keys = {}; this.pressed = {};
    this.mouse.left = this.mouse.right = false;
    this.mouse.leftPressed = this.mouse.leftReleased = this.mouse.rightPressed = false;
    this.mdx = this.mdy = 0;
  }

  // ------------------------------------------------------------ viewmodel
  buildViewmodel() {
    const vm = this.vm;
    while (vm.children.length) vm.remove(vm.children[0]);
    const ch = this.ch, key = ch.classKey;
    this.parts = {};
    const add = (model, x, y, z, rx, ry, rz, s) => {
      const pivot = new THREE.Group();
      const m = cloneModel(model);
      m.scale.setScalar(s);
      pivot.add(m);
      pivot.position.set(x, y, z);
      pivot.rotation.set(rx, ry, rz);
      pivot.userData.base = { p: pivot.position.clone(), r: pivot.rotation.clone() };
      vm.add(pivot);
      return pivot;
    };
    if (key === 'knight') {
      this.parts.main = add('sword_1handed', 0.55, -0.62, -1.1, -0.45, 0.5, -0.3, 0.46);
      this.parts.off = add('shield_round_color', -0.62, -0.58, -1.15, 0.05, Math.PI + 0.45, 0.08, 0.5);
    } else if (key === 'barbarian') {
      this.parts.main = add('axe_2handed', 0.62, -0.9, -1.2, -0.35, -0.3, -0.35, 0.52);
    } else if (key === 'ranger') {
      this.parts.main = add('bow_withString', -0.32, -0.3, -1.0, Math.PI / 2, 0.0, -0.18, 0.62);
      this.parts.arrow = add('arrow_bow', -0.24, -0.3, -0.85, 0, 0, 0, 0.62);
    } else if (key === 'mage') {
      this.parts.main = add('staff', 0.62, -1.2, -1.25, -0.12, 0.6, -0.1, 0.5);
    } else if (key === 'rogue') {
      this.parts.main = add('dagger', 0.5, -0.5, -0.9, -1.35, 0, -0.15, 0.62);
      this.parts.off = add('dagger', -0.5, -0.5, -0.9, -1.35, 0, 0.15, 0.62);
    } else if (key === 'halberdier') {
      this.parts.main = add('halberd', 0.6, -0.9, -1.25, -0.75, 0.35, -0.3, 0.44);
    } else if (key === 'swordsman') {
      this.parts.main = add('sword_A', 0.55, -0.64, -1.1, -0.5, 0.5, -0.38, 0.42);
      steelify(this.parts.main);
    } else if (key === 'merchant') {
      if (ch.mode === 'summoner') this.parts.main = add('spellbook_open', 0.32, -0.42, -0.9, -0.5, -0.25, 0, 0.42);
      else this.parts.main = add('hammer_B', 0.6, -0.62, -1.05, -0.45, 0.4, -0.3, 0.38);
    }
    this.parts.food = add('plate_food_A', -0.42, -0.55, -0.95, 0.35, 0, 0, 0.32);
    this.parts.food.visible = false;
    // brilho da raridade da arma equipada
    const r = ch.weapon ? RARITY[ch.weapon.rarity] : null;
    if (this.parts.main && r) {
      this.parts.main.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(r.color); o.material.emissiveIntensity = 0.35; } });
    }
    this._inv = false;
    this._vmMode = ch.mode;
    this._vmWeapon = ch.weapon;
    vm.visible = true;
  }

  swing(kind = 'slash', dur = 0.35) {
    this.swingT = 0; this.swingDur = dur; this.swingKind = kind; this.swingSide *= -1;
  }

  aim(look, wx = 0, wz = 0) {
    const ch = this.ch;
    return {
      origin: new THREE.Vector3(ch.pos.x, ch.pos.y + EYE_HEIGHT, ch.pos.z).addScaledVector(look, 0.6),
      dir: look.clone(), charge: this.charge || 0,
      moveDir: new THREE.Vector3(wx, 0, wz),
      useMove: true,
    };
  }

  // ------------------------------------------------------------ loop
  update(dt) {
    const g = this.game, ch = this.ch, C = g.combat;
    const menuOpen = g.menus && g.menus.isOpen;
    if (menuOpen) { this.keys = {}; this.mouse.left = this.mouse.right = false; }
    if (ch.alive) {
      ch.yaw -= this.mdx * this.sens * (this.zoomed ? 0.5 : 1);
      ch.pitch -= this.mdy * this.sens * (this.zoomed ? 0.5 : 1);
      ch.pitch = Math.max(-1.45, Math.min(1.45, ch.pitch));
    }
    this.mdx = this.mdy = 0;
    if (this._vmMode !== ch.mode || this._vmWeapon !== ch.weapon) this.buildViewmodel();

    const fwd = new THREE.Vector3(Math.sin(ch.yaw), 0, Math.cos(ch.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const look = new THREE.Vector3(Math.sin(ch.yaw) * Math.cos(ch.pitch), Math.sin(ch.pitch), Math.cos(ch.yaw) * Math.cos(ch.pitch));

    if (ch.alive) {
      let wx = 0, wz = 0;
      if (this.keys.KeyW) { wx += fwd.x; wz += fwd.z; }
      if (this.keys.KeyS) { wx -= fwd.x; wz -= fwd.z; }
      if (this.keys.KeyD) { wx += right.x; wz += right.z; }
      if (this.keys.KeyA) { wx -= right.x; wz -= right.z; }
      const l = Math.hypot(wx, wz);
      if (l > 0) { wx /= l; wz /= l; }
      // mover cancela a canalização (fabricar / aprimorar)
      if (ch.channel && MOVE_KEYS.some(k => this.pressed[k])) g.economy.cancelChannel(ch);
      const wantSprint = (this.keys.ShiftLeft || this.keys.ShiftRight) && this.keys.KeyW && !ch.blocking;
      const sprint = wantSprint && this.stamina > 0.05;
      if (sprint && l > 0) this.stamina = Math.max(0, this.stamina - dt * 0.22);
      else this.stamina = Math.min(1, this.stamina + dt * (l > 0 ? 0.12 : 0.22));
      const wasGround = ch.onGround;
      ch.move(wx, wz, dt, { sprint, jump: this.pressed.Space });
      if (!wasGround && ch.onGround) sfx('step');
      const hs = Math.hypot(ch.vel.x, ch.vel.z);
      if (ch.onGround && hs > 1) {
        this.bobT += dt * hs * 1.15;
        this.stepT += dt * hs;
        if (this.stepT > 3.2) { this.stepT = 0; if (!(g.time < ch.st.silentUntil)) sfx('step'); }
      }

      const a = ch.attackDef();
      const canUse = !menuOpen && !ch.channel;
      // ataque base
      if (canUse) {
        if (a.type === 'arrow') {
          if (this.mouse.left && ch.cd.attack <= 0 && !ch.carrying && !ch.isStunned()) this.charge = Math.min(1, (this.charge || 0) + dt / a.chargeTime);
          if (this.mouse.leftReleased) {
            if ((this.charge || 0) > 0.05 && C.attack(ch, this.aim(look, wx, wz))) this.swing('shoot', 0.25);
            this.charge = 0;
          }
        } else if (this.mouse.left) {
          if (C.attack(ch, this.aim(look, wx, wz))) this.swing(a.swing || 'slash', Math.min(0.45, a.cooldown / ch.attackSpeed() * 0.9));
        }
      }
      // botão direito
      const rmb = ch.cls.rmb;
      this.zoomed = false;
      if (rmb === 'zoom') this.zoomed = this.mouse.right && canUse;
      else if (rmb === 'modes' && ch.mode === 'summoner') {
        const r = canUse ? C.summonerRmb(ch, this.mouse.right, this.aim(look), dt) : C.summonerRmb(ch, false, null, dt);
        if (r === 'march') this.mouse.right = false;
      } else C.block(ch, this.mouse.right && canUse);
      if (rmb === 'modes' && ch.mode !== 'summoner') C.endLink(ch);

      // skills 1-5
      if (canUse) {
        for (let s = 1; s <= 5; s++) {
          if (!this.pressed['Digit' + s] && !this.pressed['Numpad' + s]) continue;
          this.trySkill(s, look, wx, wz);
        }
      }
      // troca de modo do Mercador
      if (!menuOpen && ch.isMerchant && (this.pressed.Backquote || this.pressed.Quote || this.pressed.KeyQ)) {
        if (C.switchMode(ch)) { this.buildViewmodel(); g.hud.status(ch.mode === 'summoner' ? 'Modo Invocador' : 'Modo Mercador'); }
      }
      if (!menuOpen && this.pressed.KeyE) this.interact();
      if (!menuOpen && this.pressed.KeyB) g.openClassMenu(true);
      if (!menuOpen && this.pressed.KeyK) g.menus.open('skills');
      if (!menuOpen && this.pressed.KeyI) g.menus.open('bag');
    } else {
      this.zoomed = false;
      this.charge = 0;
    }

    // câmera
    const cam = this.camera;
    if (ch.alive) {
      const bob = ch.onGround ? Math.sin(this.bobT * 1.0) * 0.06 : 0;
      cam.position.set(ch.pos.x, ch.pos.y + EYE_HEIGHT + bob, ch.pos.z);
      cam.lookAt(cam.position.x + look.x, cam.position.y + look.y, cam.position.z + look.z);
    } else {
      const k = Math.min(1, (g.time - (this.deathTime || g.time)) / 1.2);
      cam.position.set(ch.pos.x, ch.pos.y + EYE_HEIGHT * (1 - k * 0.75) + 0.2, ch.pos.z);
      cam.lookAt(cam.position.x + look.x, cam.position.y + look.y - k * 0.4, cam.position.z + look.z);
      cam.rotateZ(k * 0.5);
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 3);
      cam.rotation.x += (Math.random() - 0.5) * this.shake * 0.05;
      cam.rotation.y += (Math.random() - 0.5) * this.shake * 0.05;
    }
    const targetFov = this.zoomed ? 42 : (this.keys.ShiftLeft && ch.alive && this.keys.KeyW && this.stamina > 0.05 ? 80 : 75);
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 10);
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }

    this.updateViewmodel(dt);
    this.pressed = {};
    this.mouse.leftPressed = this.mouse.leftReleased = this.mouse.rightPressed = false;
  }

  trySkill(slot, look, wx, wz) {
    const g = this.game, ch = this.ch;
    const r = g.combat.useSkill(ch, slot, this.aim(look, wx, wz));
    const sk = skillList(ch).find(s => s.slot === slot);
    if (r === true) {
      const kind = sk && (sk.id.includes('whirl') || sk.id.includes('spin')) ? 'spin' : sk && /dash|charge|lunge|leap|blink/.test(sk.id) ? 'dash' : sk && /kick/.test(sk.id) ? 'kick' : sk && /thrust|hook|throw|knife/.test(sk.id) ? 'thrust' : 'cast';
      this.swing(kind, 0.4);
    } else if (r === 'locked') {
      g.hud.status(`${sk ? sk.name : 'Skill'} bloqueada · aperte K para escolher`);
    } else if (r === 'nosouls') g.hud.status('Almas insuficientes');
    else if (r === 'noenergy') g.hud.status('Energia insuficiente');
    else if (r && r.menu) {
      if (r.menu === 'works' && !g.world.castles[ch.team].inside(ch.pos.x, ch.pos.z)) { g.hud.status('Obras só dentro da cidade'); return; }
      if (r.menu === 'stall') {
        if (!g.economy.nearStall(ch)) g.combat.commitSkill(ch, r.skill); // à distância: paga energia e recarga
      }
      g.menus.open(r.menu, { skill: r.skill, perk: r.perk });
    } else if (r === false && sk && (ch.cd[sk.id] || 0) > 0) {
      g.hud.status(`${sk.name}: ${Math.ceil(ch.cd[sk.id])} s`);
    }
  }

  interact() {
    const g = this.game, ch = this.ch;
    const r = g.objectives.interact(ch);
    if (r === 'full') { g.announce('A prisioneira não aguenta comer mais', ''); return; }
    if (r === 'nocarry') { g.announce(`O ${ch.cls.name} não pode carregar a princesa`, 'Proteja quem a carrega'); return; }
    if (r) return;
    const e = g.economy.interact(ch);
    if (e === 'stall') g.menus.open('stall');
    else if (e === 'sell') g.menus.open('sell');
  }

  updateViewmodel(dt) {
    const ch = this.ch, P = this.parts, t = this.game.time;
    this.vm.visible = ch.alive && !ch.carrying;
    if (!this.vm.visible) return;
    this.swingT = Math.min(1, this.swingT + dt / this.swingDur);
    const s = this.swingT < 1 ? Math.sin(this.swingT * Math.PI) : 0;
    const e = this.swingT;
    const hs = Math.hypot(ch.vel.x, ch.vel.z);
    const bobX = Math.cos(this.bobT * 0.5) * 0.025 * Math.min(1, hs / 6);
    const bobY = Math.abs(Math.sin(this.bobT * 0.5)) * 0.035 * Math.min(1, hs / 6);
    this.vm.position.set(bobX, -bobY, 0);

    const reset = (p) => { if (!p || !p.userData.base) return; p.position.copy(p.userData.base.p); p.rotation.copy(p.userData.base.r); };
    for (const k in P) reset(P[k]);
    const m = P.main;
    const k = this.swingKind;
    if (this.swingT < 1 && m) {
      if (k === 'slash') {
        m.rotation.z += 1.1 - e * 2.4; m.rotation.x -= s * 0.9; m.position.x -= e * 0.5; m.position.y += s * 0.15;
      } else if (k === 'chop') {
        m.rotation.x += 0.9 - e * 2.2; m.position.y += s * 0.25 - e * 0.1; m.position.x -= s * 0.25;
      } else if (k === 'spin') {
        this.vm.rotation.y = e * Math.PI * 2;
      } else if (k === 'stab') {
        const p = this.swingSide > 0 ? m : (P.off || m);
        p.position.z -= s * 0.55; p.rotation.x += s * 0.2;
      } else if (k === 'thrust') {
        m.position.z -= s * 0.9; m.position.x -= s * 0.15;
      } else if (k === 'cast') {
        m.position.z -= s * 0.35; m.position.x -= s * 0.2; m.rotation.x -= s * 0.4;
      } else if (k === 'throw') {
        m.position.z -= s * 0.3; m.rotation.x -= s * 0.7; m.position.y += s * 0.2;
      } else if (k === 'shoot') {
        m.position.z += s * 0.05;
      } else if (k === 'kick') {
        m.position.y -= s * 0.4;
      } else if (k === 'dash') {
        this.vm.rotation.z = s * 0.3;
      }
    } else {
      this.vm.rotation.set(0, 0, 0);
    }
    if (k !== 'spin' || this.swingT >= 1) this.vm.rotation.y = 0;
    // preparo do Golpe pesado / canalização
    if (t < ch.st.windupUntil && m) { m.position.y += 0.25; m.rotation.x += 0.8; }
    if (ch.channel && m) { m.position.y += Math.abs(Math.sin(t * 9)) * 0.15; m.rotation.x -= 0.3; }
    if (P.off && ch.blocking) {
      P.off.position.set(-0.18, -0.38, -0.85);
      P.off.rotation.set(0.05, Math.PI + 0.05, 0);
    } else if (ch.blocking && m) {
      m.position.x -= 0.35; m.position.y += 0.2; m.rotation.z += 1.2;
    }
    if (ch.isPlanted() && m) { m.position.y -= 0.1; m.position.z -= 0.2; }
    // machado arremessado / arco
    if (ch.classKey === 'barbarian' && m) m.visible = !(t < ch.st.axeOutUntil);
    if (P.arrow) {
      const c = this.charge || 0;
      P.arrow.visible = ch.cd.attack <= 0.05;
      P.arrow.position.z += c * 0.28;
      if (c > 0) { m.position.z += c * 0.12; m.position.x += (Math.random() - 0.5) * 0.004 * c; }
    }
    const inv = ch.isInvisible();
    if (inv !== this._inv) {
      this.vm.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = inv; o.material.opacity = inv ? 0.35 : 1; } });
      this._inv = inv;
    }
    P.food.visible = ch.food;
    if (ch.food && P.off) P.off.visible = false; else if (P.off) P.off.visible = true;
  }

  render(renderer) {
    this.viewCam.aspect = this.camera.aspect;
    this.viewCam.updateProjectionMatrix();
    renderer.clearDepth();
    renderer.render(this.viewScene, this.viewCam);
  }
}
