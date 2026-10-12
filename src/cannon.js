// Canhão de lançamento: um em cada base, do lado de fora do portão. Com E, o personagem entra no canhão
// e é arremessado para perto do meio do mapa, no próprio lado do rio. O ponto de queda é sorteado
// (não dá para mirar), sempre dentro do mapa.
import * as THREE from 'three';
import { CANNON } from './config.js';
import { BOUNDS, RIVER_HALF } from './world.js';
import { sfx } from './audio.js';

export class Cannons {
  constructor(game) {
    this.game = game;
    this.list = game.world.cannons;
  }

  /** Canhão do próprio time ao alcance do personagem. */
  near(ch, r = CANNON.useRange) {
    if (!ch.alive || !ch.cls) return null;
    for (const c of this.list) if (c.team === ch.team && Math.hypot(c.pos.x - ch.pos.x, c.pos.z - ch.pos.z) < r) return c;
    return null;
  }

  canUse(ch) {
    if (ch.carrying) return 'Não dá para entrar no canhão carregando a princesa';
    if (ch.launch) return 'Já está voando';
    if ((ch.cd.cannon || 0) > 0) return `Canhão recarregando (${Math.ceil(ch.cd.cannon)} s)`;
    return true;
  }

  promptFor(ch) {
    if (!this.near(ch)) return '';
    const ok = this.canUse(ch);
    return ok === true ? '<b>[E]</b> Entrar no canhão (arremesso para perto do meio do mapa)' : ok;
  }

  /** Sorteia o ponto de queda: no próprio lado, entre CANNON.zMin e CANNON.zMax do rio, em qualquer faixa do mapa. */
  pickLanding(team) {
    const W = this.game.world;
    const side = team === 0 ? -1 : 1;
    for (let i = 0; i < 30; i++) {
      const x = (Math.random() * 2 - 1) * (BOUNDS.x - 10);
      const z = side * (CANNON.zMin + Math.random() * (CANNON.zMax - CANNON.zMin));
      if (Math.abs(z) < RIVER_HALF + 3) continue;
      const p = new THREE.Vector3(x, 0, z);
      // evita cair dentro de construções e pedras
      const q = p.clone();
      W.col.resolve(q, 1.2, 0);
      if (q.distanceTo(p) > 0.05) continue;
      p.y = W.groundAt(p.x, p.z);
      return p;
    }
    return new THREE.Vector3(0, W.groundAt(0, side * 30), side * 30);
  }

  launch(ch, c = this.near(ch)) {
    if (!c) return null;
    const ok = this.canUse(ch);
    if (ok !== true) { if (ch.isPlayer) this.game.hud.status(ok); return null; }
    const g = this.game;
    const from = new THREE.Vector3(c.pos.x, c.pos.y + 2.2, c.pos.z);
    const to = this.pickLanding(ch.team);
    const dist = Math.hypot(to.x - from.x, to.z - from.z);
    ch.launch = { from, to, start: g.time, dur: CANNON.flightTime + dist / 140, peak: CANNON.peak + dist * 0.12 };
    ch.cd.cannon = CANNON.cooldown;
    ch.blocking = false; ch.channel = null; ch.dash = null; ch.leap = null;
    ch.breakInvis && ch.breakInvis();
    ch.pos.copy(from);
    ch.vel.set(0, 0, 0);
    g.effects.explosion(new THREE.Vector3(c.pos.x, c.pos.y + 3, c.pos.z), 2.2, 0xc8b089);
    sfx('boom', g.combat.dist(ch));
    c.kick = 0.35;
    if (ch.isPlayer) g.hud.status('Fogo! Segure-se...');
    return true;
  }

  /** Movimento do personagem durante o voo (chamado no lugar da física normal). */
  fly(ch) {
    const L = ch.launch, g = this.game;
    const k = Math.min(1, (g.time - L.start) / L.dur);
    ch.pos.x = L.from.x + (L.to.x - L.from.x) * k;
    ch.pos.z = L.from.z + (L.to.z - L.from.z) * k;
    ch.pos.y = L.from.y + (L.to.y - L.from.y) * k + L.peak * 4 * k * (1 - k);
    if (k >= 1) {
      ch.launch = null;
      ch.pos.copy(L.to);
      ch.vel.set(0, 0, 0); ch.vy = 0; ch.onGround = true;
      g.col.resolve(ch.pos, ch.radius, 0);
      g.effects.ring(ch.pos, 2.5, 0xc8b089, 0.5);
      sfx('heavy', g.combat.dist(ch));
    }
  }

  update(dt) {
    for (const c of this.list) {
      if (c.kick > 0) { c.kick = Math.max(0, c.kick - dt); c.barrel.position.z = 0.2 - c.kick * 1.5; }
    }
  }
}
