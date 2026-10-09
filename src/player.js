// Controle em primeira pessoa: mouse/teclado, câmera, arma na mão (viewmodel) e ações do jogador.
import * as THREE from 'three';
import { cloneModel } from './assets.js';
import { EYE_HEIGHT } from './config.js';
import { sfx } from './audio.js';

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

    // cena separada para a arma em primeira pessoa
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
    const key = this.ch.classKey;
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
    }
    this.parts.food = add('plate_food_A', -0.42, -0.55, -0.95, 0.35, 0, 0, 0.32);
    this.parts.food.visible = false;
    vm.visible = true;
  }

  swing(kind = 'slash', dur = 0.35) {
    this.swingT = 0; this.swingDur = dur; this.swingKind = kind; this.swingSide *= -1;
  }

  // ------------------------------------------------------------ loop
  update(dt) {
    const g = this.game, ch = this.ch, C = g.combat;
    // olhar
    if (ch.alive) {
      ch.yaw -= this.mdx * this.sens * (this.zoomed ? 0.5 : 1);
      ch.pitch -= this.mdy * this.sens * (this.zoomed ? 0.5 : 1);
      ch.pitch = Math.max(-1.45, Math.min(1.45, ch.pitch));
    }
    this.mdx = this.mdy = 0;

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
        if (this.stepT > 3.2) { this.stepT = 0; sfx('step'); }
      }

      const aim = () => ({
        origin: new THREE.Vector3(ch.pos.x, ch.pos.y + EYE_HEIGHT, ch.pos.z).addScaledVector(look, 0.6),
        dir: look.clone(), charge: this.charge || 0,
        moveDir: new THREE.Vector3(wx, 0, wz),
      });
      const a = ch.cls.attack;

      // ataque principal
      if (a.type === 'arrow') {
        if (this.mouse.left && ch.cd.attack <= 0 && !ch.carrying) this.charge = Math.min(1, (this.charge || 0) + dt / a.chargeTime);
        if (this.mouse.leftReleased) {
          if ((this.charge || 0) > 0.05 && C.attack(ch, aim())) this.swing('shoot', 0.25);
          this.charge = 0;
        }
      } else if (this.mouse.left) {
        if (C.attack(ch, aim())) {
          this.swing(ch.classKey === 'barbarian' ? 'chop' : ch.classKey === 'rogue' ? 'stab' : ch.classKey === 'mage' ? 'cast' : 'slash', Math.min(0.45, a.cooldown * 0.9));
        }
      }
      // secundário
      const alt = ch.cls.alt;
      if (alt.type === 'block') C.alt(ch, aim(), this.mouse.right);
      else if (alt.type === 'zoom') this.zoomed = this.mouse.right && ch.alive;
      else if (this.mouse.rightPressed) {
        if (C.alt(ch, aim(), true)) this.swing(alt.type === 'kick' ? 'kick' : alt.type === 'heal' ? 'cast' : 'dash', 0.3);
      }
      // especial
      if (this.pressed.KeyQ) {
        if (C.ability(ch, aim())) this.swing(ch.classKey === 'barbarian' ? 'spin' : 'cast', 0.45);
      }
      if (this.pressed.KeyE) {
        const r = g.objectives.interact(ch);
        if (r === 'full') g.announce('A prisioneira não aguenta comer mais', '');
      }
      if (this.pressed.KeyB) g.openClassMenu(true);
    } else {
      this.zoomed = false;
      this.charge = 0;
    }
    if (!ch.alive) this.zoomed = false;

    // câmera
    const cam = this.camera;
    if (ch.alive) {
      const bob = ch.onGround ? Math.sin(this.bobT * 1.0) * 0.06 : 0;
      cam.position.set(ch.pos.x, ch.pos.y + EYE_HEIGHT + bob, ch.pos.z);
      cam.lookAt(cam.position.x + look.x, cam.position.y + look.y, cam.position.z + look.z);
    } else {
      // câmera de morte: desce e inclina
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

  updateViewmodel(dt) {
    const ch = this.ch, P = this.parts;
    this.vm.visible = ch.alive && !ch.carrying;
    if (!this.vm.visible) return;
    this.swingT = Math.min(1, this.swingT + dt / this.swingDur);
    const s = this.swingT < 1 ? Math.sin(this.swingT * Math.PI) : 0;
    const e = this.swingT; // 0..1
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
      } else if (k === 'cast') {
        m.position.z -= s * 0.35; m.position.x -= s * 0.2; m.rotation.x -= s * 0.4;
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
    if (P.off && ch.blocking) {
      P.off.position.set(-0.18, -0.38, -0.85);
      P.off.rotation.set(0.05, Math.PI + 0.05, 0);
    }
    if (P.arrow) {
      const c = this.charge || 0;
      P.arrow.visible = ch.cd.attack <= 0.05;
      P.arrow.position.z += c * 0.28;
      if (c > 0) { m.position.z += c * 0.12; m.position.x += (Math.random() - 0.5) * 0.004 * c; }
    }
    // invisível: viewmodel transparente
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
