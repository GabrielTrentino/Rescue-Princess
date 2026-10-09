// HUD: placar, vida, habilidades, minimapa, marcadores de objetivo, mensagens e números de dano.
import * as THREE from 'three';
import { TEAM, TEAM_NAME, CLASSES, MAX_FAT } from './config.js';
import { BOUNDS } from './world.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(game) {
    this.game = game;
    this.root = $('hud');
    this.el = {
      scoreBlue: $('scoreBlue'), scoreRed: $('scoreRed'), statusBlue: $('statusBlue'), statusRed: $('statusRed'), goal: $('goalText'),
      feed: $('feed'), prompt: $('prompt'), big: $('bigmsg'), className: $('className'), hpFill: $('hpFill'), hpText: $('hpText'),
      stFill: $('stFill'), carry: $('carry'), markers: $('markers'), floaters: $('floaters'), crosshair: $('crosshair'),
      scoreboard: $('scoreboard'), minimap: $('minimap'),
      sk: { attack: $('skLMB'), alt: $('skRMB'), ability: $('skQ') },
    };
    this.mm = this.el.minimap.getContext('2d');
    this.mmBg = null;
    this.mmAt = 0;
    this.floaters = [];
    this.markerEls = {};
    this.bigUntil = 0;
    this.lastClass = null;
    this.feed('Bem-vindo! Resgate a <span class="b">Princesa Azul</span> no castelo vermelho.');
  }

  show(v) { this.root.classList.toggle('hidden', !v); }

  feed(html) {
    const d = document.createElement('div');
    d.className = 'item';
    d.innerHTML = html;
    this.el.feed.prepend(d);
    while (this.el.feed.children.length > 6) this.el.feed.lastChild.remove();
    setTimeout(() => d.remove(), 7000);
  }

  announce(title, sub = '', team = null) {
    this.el.big.innerHTML = title + (sub ? `<small>${sub}</small>` : '');
    this.el.big.style.color = team === TEAM.BLUE ? '#bcd4ff' : team === TEAM.RED ? '#ffc2b8' : '#fff3d0';
    this.el.big.classList.add('show');
    this.bigUntil = this.game.time + 3.2;
  }

  hitMarker(target, amount, crit) {
    this.el.crosshair.classList.add('hit');
    clearTimeout(this._hitT);
    this._hitT = setTimeout(() => this.el.crosshair.classList.remove('hit'), 120);
    this.floater(target, '-' + amount, crit ? 'crit' : '');
  }
  healMarker(target, amount) { if (amount > 0) this.floater(target, '+' + amount, 'heal'); }

  floater(target, text, cls) {
    const d = document.createElement('div');
    d.className = 'fl ' + (cls || '');
    d.textContent = text;
    this.el.floaters.appendChild(d);
    this.floaters.push({ el: d, pos: new THREE.Vector3(target.pos.x + (Math.random() - 0.5) * 0.6, target.pos.y + 2.6, target.pos.z), t: 0 });
  }

  hurt(source) {
    const p = this.game.pc;
    if (p) p.shake = Math.min(1, p.shake + 0.5);
    this.root.animate([{ boxShadow: 'inset 0 0 120px rgba(255,0,0,.55)' }, { boxShadow: 'inset 0 0 0 rgba(255,0,0,0)' }], { duration: 350 });
  }

  project(pos, cam, w, h) {
    const v = pos.clone().project(cam);
    const behind = v.z > 1;
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, behind };
  }

  setMarker(id, pos, icon, label, cls, cam, w, h, alwaysEdge = true) {
    let el = this.markerEls[id];
    if (!el) {
      el = document.createElement('div');
      el.className = 'mk';
      el.innerHTML = '<div class="ico"></div><div class="lb"></div>';
      this.el.markers.appendChild(el);
      this.markerEls[id] = el;
    }
    el._used = true;
    const p = this.project(pos, cam, w, h);
    let x = p.x, y = p.y, edge = false;
    const m = 40;
    if (p.behind) { x = w - x; y = h - m; edge = true; }
    if (x < m || x > w - m || y < m + 40 || y > h - m) edge = true;
    if (edge && !alwaysEdge) { el.style.display = 'none'; return; }
    x = Math.max(m, Math.min(w - m, x));
    y = Math.max(m + 70, Math.min(h - m - 60, y));
    el.style.display = '';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.className = 'mk ' + cls + (edge ? ' edge' : '');
    el.firstChild.textContent = icon;
    el.lastChild.textContent = label;
  }

  update(dt) {
    const g = this.game, ch = g.player, O = g.objectives;
    if (!ch) return;
    const cam = g.camera, w = innerWidth, h = innerHeight;

    // placar
    this.el.scoreBlue.textContent = g.score[0];
    this.el.scoreRed.textContent = g.score[1];
    this.el.goal.textContent = `Primeiro a ${g.settings.scoreToWin} resgate${g.settings.scoreToWin > 1 ? 's' : ''}`;
    const st = (p) => {
      if (p.state === 'captive') return [`Presa · peso ${p.fat}/${MAX_FAT}`, false];
      if (p.state === 'carried') return ['SENDO RESGATADA!', true];
      if (p.state === 'dropped') return [`Caída no chão (${Math.max(0, Math.ceil(25 - (g.time - p.dropTime)))}s)`, true];
      return ['Resgatada!', true];
    };
    for (const [p, el] of [[O.princesses[0], this.el.statusBlue], [O.princesses[1], this.el.statusRed]]) {
      const [t, alert] = st(p);
      el.textContent = t;
      el.classList.toggle('alert', alert);
    }

    // vida
    const r = Math.max(0, ch.hp / ch.maxHp);
    this.el.hpFill.style.width = (r * 100) + '%';
    this.el.hpText.textContent = Math.max(0, Math.ceil(ch.hp)) + ' / ' + ch.maxHp;
    this.el.stFill.style.width = (g.pc.stamina * 100) + '%';
    this.root.classList.toggle('lowhp', ch.alive && r < 0.3);
    if (this.lastClass !== ch.classKey) {
      const c = CLASSES[ch.classKey];
      this.el.className.textContent = c.icon + ' ' + c.name;
      this.el.sk.attack.querySelector('.sname').textContent = c.attack.name;
      this.el.sk.alt.querySelector('.sname').textContent = c.alt.name;
      this.el.sk.ability.querySelector('.sname').textContent = c.ability.name;
      this.lastClass = ch.classKey;
    }
    const c = CLASSES[ch.classKey];
    for (const [k, def] of [['attack', c.attack], ['alt', c.alt], ['ability', c.ability]]) {
      const el = this.el.sk[k];
      const cdv = ch.cd[k];
      const frac = def.cooldown > 0 ? Math.max(0, cdv / def.cooldown) : 0;
      el.querySelector('.cd').style.height = (frac * 100) + '%';
      el.classList.toggle('ready', frac <= 0 && k === 'ability');
    }
    let carry = '';
    if (ch.carrying) carry = `👑 Carregando a ${ch.carrying.name} — leve-a ao trono!`;
    else if (ch.food) carry = '🍗 Banquete na mão — leve à prisioneira no seu castelo';
    else if (ch.isInvisible()) carry = '💨 Invisível';
    this.el.carry.textContent = carry;

    this.el.prompt.innerHTML = O.promptFor(ch) || (g.world.castles[ch.team].inside(ch.pos.x, ch.pos.z) && ch.alive ? '<b>[B]</b> Trocar de classe' : '');
    if (g.time > this.bigUntil) this.el.big.classList.remove('show');

    // marcadores
    for (const k in this.markerEls) this.markerEls[k]._used = false;
    const own = O.princessOf(ch.team), captive = O.captiveOf(ch.team);
    const dist = (p) => Math.round(Math.hypot(p.x - ch.pos.x, p.z - ch.pos.z) * 0.75) + 'm';
    if (!(own.carrier === ch)) {
      const lp = own.pos.clone(); lp.y += 3.4;
      const label = own.state === 'captive' ? 'Sua princesa · ' : own.state === 'carried' ? 'Escolte! · ' : own.state === 'dropped' ? 'Pegue-a! · ' : '';
      this.setMarker('own', lp, '👑', label + dist(own.pos), 'blue', cam, w, h);
    }
    if (captive.state !== 'captive' || ch.food) {
      const lp = captive.pos.clone(); lp.y += 3.4;
      const label = captive.state === 'carried' ? 'Pare o sequestro! · ' : captive.state === 'dropped' ? 'Devolva-a! · ' : 'Prisioneira · ';
      this.setMarker('cap', lp, '⛓️', label + dist(captive.pos), 'red', cam, w, h);
    }
    if (ch.carrying) {
      const t = g.world.castles[ch.team].throne.clone(); t.y += 2;
      this.setMarker('throne', t, '🏰', 'Trono · ' + dist(t), 'gold', cam, w, h);
    }
    for (const k in this.markerEls) if (!this.markerEls[k]._used) this.markerEls[k].style.display = 'none';

    // números flutuantes
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      f.pos.y += dt * 1.2;
      const p = this.project(f.pos, cam, w, h);
      if (f.t > 0.9 || p.behind) { f.el.remove(); this.floaters.splice(i, 1); continue; }
      f.el.style.left = p.x + 'px'; f.el.style.top = p.y + 'px';
      f.el.style.opacity = String(1 - Math.max(0, f.t - 0.5) / 0.4);
    }

    // placar detalhado
    const showSb = g.pc.keys.Tab;
    this.el.scoreboard.classList.toggle('hidden', !showSb);
    if (showSb && (!this._sbAt || g.time > this._sbAt)) { this.renderScoreboard(); this._sbAt = g.time + 0.5; }

    if (g.time > this.mmAt) { this.drawMinimap(); this.mmAt = g.time + 0.1; }
  }

  renderScoreboard() {
    const g = this.game;
    const html = [0, 1].map(t => {
      const rows = g.characters.filter(c => !c.isMonster && c.team === t).sort((a, b) => b.kills - a.kills)
        .map(c => `<tr class="${c.isPlayer ? 'me' : ''}"><td>${c.isPlayer ? 'Você' : c.name}</td><td>${CLASSES[c.classKey].icon} ${CLASSES[c.classKey].name}</td><td>${c.kills}</td><td>${c.deaths}</td><td>${c.rescues}</td><td>${c.feeds}</td></tr>`).join('');
      return `<div><h4 style="color:${t ? '#ffaaa0' : '#9cc0ff'}">Time ${TEAM_NAME[t]} — ${g.score[t]}</h4><table><tr><th>Nome</th><th>Classe</th><th>Abates</th><th>Mortes</th><th>Resgates</th><th>Banquetes</th></tr>${rows}</table></div>`;
    }).join('');
    this.el.scoreboard.innerHTML = html;
  }

  // ------------------------------------------------------------ minimapa
  mmXY(x, z) {
    const W = this.el.minimap.width, H = this.el.minimap.height;
    return [(75 - x) / 150 * W, (205 - z) / 410 * H];
  }

  drawMinimap() {
    const g = this.game, ctx = this.mm, W = this.el.minimap.width, H = this.el.minimap.height;
    if (!this.mmBg) {
      const bg = document.createElement('canvas');
      bg.width = W; bg.height = H;
      const b = bg.getContext('2d');
      const src = g.world.groundCanvas;
      const S = src.width / 220;
      // recorte x∈[-75,75], z∈[-205,205]; o canvas do chão tem z=-240 no topo, então inverte verticalmente
      b.save();
      b.translate(W, H); b.scale(-1, -1); // vista do lado azul: +z para cima, -x à direita
      b.drawImage(src, (110 - 75) * S, (240 - 205) * S, 150 * S, 410 * S, 0, 0, W, H);
      b.restore();
      b.fillStyle = 'rgba(0,0,0,0.15)'; b.fillRect(0, 0, W, H);
      // castelos
      for (const t of [0, 1]) {
        const z0 = t === 0 ? -170 : 170;
        const [x1, y1] = this.mmXY(28, z0 + 20), [x2, y2] = this.mmXY(-28, z0 - 20);
        b.strokeStyle = t === 0 ? '#4a8cff' : '#ff5050'; b.lineWidth = 2;
        b.strokeRect(x1, y1, x2 - x1, y2 - y1);
      }
      b.fillStyle = '#4fa3e0';
      const [, ry1] = this.mmXY(0, 6), [, ry2] = this.mmXY(0, -6);
      b.fillRect(0, ry1, W, ry2 - ry1);
      this.mmBg = bg;
    }
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(this.mmBg, 0, 0);
    const pl = g.player;
    const dot = (x, z, color, r = 2.6) => { const [px, py] = this.mmXY(x, z); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); };
    for (const f of g.objectives.activeFoods()) dot(f.pos.x, f.pos.z, '#ffd25a', 2.2);
    for (const c of g.characters) {
      if (!c.alive || c === pl) continue;
      if (c.isMonster) { if (c.pos.distanceTo(pl.pos) < 40) dot(c.pos.x, c.pos.z, '#d8d0b8', 2); continue; }
      if (c.team === pl.team) dot(c.pos.x, c.pos.z, '#7fb0ff');
      else {
        const visible = !c.isInvisible() && (c.pos.distanceTo(pl.pos) < 35 || c.carrying || g.time - c.lastHurt < 2);
        if (visible) dot(c.pos.x, c.pos.z, '#ff6a5a');
      }
    }
    for (const p of g.objectives.princesses) {
      const [px, py] = this.mmXY(p.pos.x, p.pos.z);
      ctx.font = '13px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = p.team === 0 ? '#bcd4ff' : '#ffc2b8';
      ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillText('👑', px, py - 1);
    }
    if (pl.alive) {
      const [px, py] = this.mmXY(pl.pos.x, pl.pos.z);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-pl.yaw); // yaw 0 = +z = para cima no mapa
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 4); ctx.lineTo(0, 2); ctx.lineTo(-4, 4); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
}
