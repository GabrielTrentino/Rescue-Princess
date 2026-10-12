// HUD: placar, vida, XP, ouro, energia e almas, barra de skills, efeitos ativos, minimapa, marcadores,
// mensagens e números de dano.
import * as THREE from 'three';
import { TEAM, TEAM_NAME, CLASSES, MAX_FAT, MERCHANT, SUMMONER, RARITY, armorReduction } from './config.js';
import { BOUNDS } from './world.js';
import { skillList, cdOf, soulCost, energyCost } from './skills.js';
import { perkOf, rankOf, pointsFree, hasPending, xpToNext, cdMultiplier } from './progression.js';
import { weaponLabel } from './economy.js';
import { skillIcon } from './menus.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(game) {
    this.game = game;
    this.root = $('hud');
    this.el = {
      scoreBlue: $('scoreBlue'), scoreRed: $('scoreRed'), statusBlue: $('statusBlue'), statusRed: $('statusRed'), goal: $('goalText'),
      feed: $('feed'), prompt: $('prompt'), big: $('bigmsg'), className: $('className'), hpFill: $('hpFill'), hpText: $('hpText'),
      stFill: $('stFill'), carry: $('carry'), markers: $('markers'), floaters: $('floaters'), crosshair: $('crosshair'),
      scoreboard: $('scoreboard'), minimap: $('minimap'), skills: $('skills'),
      xpFill: $('xpFill'), xpText: $('xpText'), gold: $('gold'), points: $('pointsBadge'), weapon: $('weaponLine'),
      merchant: $('merchantBox'), mode: $('modeLabel'), enFill: $('enFill'), enText: $('enText'), souls: $('soulPips'), vault: $('vaultLine'),
      channel: $('channel'), chFill: $('chFill'), chText: $('chText'), status: $('statusMsg'), buffs: $('buffs'), xpPop: $('xpPop'),
    };
    this.mm = this.el.minimap.getContext('2d');
    this.mmBg = null;
    this.mmAt = 0;
    this.floaters = [];
    this.markerEls = {};
    this.bigUntil = 0;
    this.statusUntil = 0;
    this.lastClass = null;
    this.skillKey = '';
    this.feed('Bem-vindo! Resgate a <span class="b">Princesa Azul</span> no castelo vermelho. Aperte <b>K</b> para escolher skills.');
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

  status(text) {
    this.el.status.textContent = text;
    this.el.status.classList.add('show');
    this.statusUntil = this.game.time + 2.2;
  }

  xpGain(amount, reason) {
    const d = document.createElement('div');
    d.className = 'xpg';
    d.textContent = `+${amount} XP${reason ? ' · ' + reason : ''}`;
    this.el.xpPop.appendChild(d);
    setTimeout(() => d.remove(), 1600);
  }

  hitMarker(target, amount, crit, dot) {
    if (!dot) {
      this.el.crosshair.classList.add('hit');
      clearTimeout(this._hitT);
      this._hitT = setTimeout(() => this.el.crosshair.classList.remove('hit'), 120);
    }
    this.floater(target, '-' + amount, crit ? 'crit' : dot ? 'dot' : '');
  }
  healMarker(target, amount) { if (amount > 0) this.floater(target, '+' + amount, 'heal'); }

  floater(target, text, cls) {
    const d = document.createElement('div');
    d.className = 'fl ' + (cls || '');
    d.textContent = text;
    this.el.floaters.appendChild(d);
    this.floaters.push({ el: d, pos: new THREE.Vector3(target.pos.x + (Math.random() - 0.5) * 0.6, target.pos.y + (target.isStructure ? 6 : 2.6), target.pos.z), t: 0 });
  }

  hurt() {
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

  // ------------------------------------------------------------ barra de skills
  buildSkillBar() {
    const ch = this.game.player;
    const c = CLASSES[ch.classKey];
    const a = ch.attackDef();
    const rmb = c.rmb === 'zoom' ? ['🔭', 'Mirar'] : c.rmb === 'march' ? ['🥁', 'Marcha'] : ['🛡️', 'Bloquear'];
    let html = `<div class="skill base" id="skLMB"><div class="key">LMB</div><span class="sicon c-${ch.classKey}">${a.icon || '⚔️'}</span><div class="sname">${a.name}</div><div class="cd"></div></div>`;
    html += `<div class="skill base" id="skRMB"><div class="key">RMB</div><span class="sicon c-${ch.classKey}">${rmb[0]}</span><div class="sname">${rmb[1]}</div><div class="cd"></div><div class="cdt"></div></div>`;
    for (const sk of skillList(ch)) {
      html += `<div class="skill" id="sk${sk.slot}"><div class="key">${sk.slot}</div>${skillIcon(sk, ch.classKey)}<div class="sname">${sk.name}</div><div class="badge"></div><div class="cd"></div><div class="cdt"></div></div>`;
    }
    this.el.skills.innerHTML = html;
  }

  updateSkillBar() {
    const g = this.game, ch = g.player;
    const key = ch.classKey + ch.level + JSON.stringify(ch.builds[ch.classKey] || {});
    if (key !== this.skillKey) { this.skillKey = key; this.buildSkillBar(); }
    const a = ch.attackDef();
    const lmb = $('skLMB');
    if (lmb) {
      lmb.querySelector('.cd').style.height = a.cooldown ? Math.min(100, ch.cd.attack / (a.cooldown / ch.attackSpeed()) * 100) + '%' : '0%';
      lmb.classList.toggle('active', !!(g.pc.linking));
    }
    const rmb = $('skRMB');
    if (rmb && ch.cls.rmb === 'march') {
      rmb.querySelector('.cd').style.height = Math.min(100, (ch.cd.march || 0) / SUMMONER.marchCooldown * 100) + '%';
      rmb.querySelector('.cdt').textContent = (ch.cd.march || 0) > 0 ? Math.ceil(ch.cd.march) : '';
    }
    for (const sk of skillList(ch)) {
      const el = $('sk' + sk.slot);
      if (!el) continue;
      const perk = perkOf(ch, sk);
      const locked = false;
      const cdv = ch.cd[sk.id] || 0;
      const full = cdOf(sk, perk) * cdMultiplier(ch, sk.slot);
      el.classList.toggle('locked', locked);
      const souls = soulCost(sk, perk), energy = energyCost(sk, perk);
      const lacks = (souls && ch.souls < souls) || (energy && ch.energy < energy);
      el.classList.toggle('lacks', !locked && !!lacks);
      el.classList.toggle('ready', !locked && cdv <= 0 && !lacks);
      el.classList.toggle('active', (sk.id === 's_veil' && ch.st.veil) || (sk.id === 'halb_wall' && ch.isPlanted()));
      el.querySelector('.cd').style.height = locked ? '0%' : Math.min(100, cdv / (full || 1) * 100) + '%';
      el.querySelector('.cdt').textContent = !locked && cdv > 0 ? Math.ceil(cdv) : '';
      const b = el.querySelector('.badge');
      b.textContent = (perk || '·') + (rankOf(ch, sk.slot) >= 2 ? ' II' : '') + (souls ? ` · ${souls}💀` : '') + (energy ? ` · ${energy}⚡` : '');
    }
  }

  buffList(ch) {
    const t = this.game.time, st = ch.st, out = [];
    const add = (cond, icon, name, until, cls = '') => { if (cond) out.push(`<span class="bf ${cls}">${icon} ${name}${until && isFinite(until) ? ' ' + Math.ceil(until - t) + 's' : ''}</span>`); };
    add(t < st.stunUntil, '💫', 'Atordoado', st.stunUntil, 'bad');
    add(t < st.rootUntil, '⛓️', 'Preso', st.rootUntil, 'bad');
    add(t < st.slowUntil, '🐌', 'Lento', st.slowUntil, 'bad');
    add(st.poison && t < st.poison.until, '☠️', 'Envenenado', st.poison && st.poison.until, 'bad');
    add(st.bleed && t < st.bleed.until, '🩸', 'Sangrando', st.bleed && st.bleed.until, 'bad');
    add(t < st.markedUntil, '🎯', 'Marcado', st.markedUntil, 'bad');
    add(t < st.dmgUpUntil, '📯', '+15% dano', st.dmgUpUntil);
    add(st.tempHp > 0 && t < st.tempHpUntil, '❤️', `+${Math.ceil(st.tempHp)} vida`, st.tempHpUntil);
    add(t < st.furyUntil, '😡', 'Fúria', st.furyUntil);
    add(t < st.ironUntil, '🛡️', 'Pele de ferro', st.ironUntil);
    add(t < st.oathUntil, '⚜️', 'Juramento', st.oathUntil);
    add(st.shield > 0 && t < st.shieldUntil, '🔷', `Escudo ${Math.ceil(st.shield)}`, st.shieldUntil);
    add(t < st.huntUntil, '🏹', 'Marca do caçador', st.huntUntil);
    add(t < st.stepUntil, '🍃', 'Passo leve', st.stepUntil);
    add(st.bladePoison && t < st.bladePoison.until, '🧪', `Lâmina envenenada ×${st.bladePoison && st.bladePoison.charges}`, st.bladePoison && st.bladePoison.until);
    add(st.bladeBleed && t < st.bladeBleed.until, '🩸', 'Lâmina sangrenta', st.bladeBleed && st.bladeBleed.until);
    add(t < st.backstabUntil, '🗡️', 'Golpe traiçoeiro', st.backstabUntil);
    add(t < st.parryUntil, '⚔️', 'Aparando', st.parryUntil);
    add(t < st.wallUntil, '🔱', 'Muralha', st.wallUntil);
    add(t < st.marchUntil, '🥁', 'Marcha', st.marchUntil);
    add(ch.isInvisible(), '💨', 'Invisível', st.invisUntil);
    add(t < (st.cleanseUntil || 0), '💧', 'Purificado', st.cleanseUntil);
    add(t < st.speedUntil && !ch.isInvisible(), '🪶', 'Veloz', st.speedUntil);
    add(t < st.axeOutUntil, '🪓', 'Machado no ar', st.axeOutUntil);
    return out.join('');
  }

  // ------------------------------------------------------------ atualização
  update(dt) {
    const g = this.game, ch = g.player, O = g.objectives, E = g.economy;
    if (!ch) return;
    const cam = g.camera, w = innerWidth, h = innerHeight;

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

    // vida, XP, ouro
    const r = Math.max(0, ch.hp / ch.maxHp);
    this.el.hpFill.style.width = (r * 100) + '%';
    const extra = (ch.st.shield > 0 && g.time < ch.st.shieldUntil ? ch.st.shield : 0) + (ch.st.tempHp > 0 && g.time < ch.st.tempHpUntil ? ch.st.tempHp : 0);
    this.el.hpText.textContent = Math.max(0, Math.ceil(ch.hp)) + ' / ' + ch.maxHp + (extra ? ` (+${Math.ceil(extra)})` : '');
    this.el.stFill.style.width = (g.pc.stamina * 100) + '%';
    this.el.stFill.parentElement.classList.toggle('tired', g.pc.exhausted);
    this.root.classList.toggle('lowhp', ch.alive && r < 0.3);
    const c = CLASSES[ch.classKey];
    this.el.className.innerHTML = `${c.icon} ${c.name} <span class="lvl">Nível ${ch.level}</span>`;
    const xp = xpToNext(ch);
    this.el.xpFill.style.width = (xp ? xp.have / xp.need * 100 : 100) + '%';
    this.el.xpText.textContent = xp ? `${xp.have} / ${xp.need} XP` : 'Nível máximo';
    this.el.gold.textContent = `🪙 ${Math.floor(ch.gold)}`;
    const free = pointsFree(ch), pend = hasPending(ch);
    this.el.points.textContent = pend ? `[K] ${free ? free + ' ponto' + (free > 1 ? 's' : '') : 'escolher perk'}` : '';
    this.el.points.classList.toggle('show', pend);
    const piece = (it, empty) => it ? `<span style="color:${RARITY[it.rarity].css}">${weaponLabel(it)}</span>` : empty;
    const armor = ch.armorValue();
    this.el.weapon.innerHTML = `${piece(ch.weapon, 'Arma básica')} · ${piece(ch.helmet, '⛑️ básico')} · ${piece(ch.body, '🦺 básico')}<br>🛡️ Armadura ${armor} (−${Math.round(armorReduction(armor) * 100)}% de dano) · [I] mochila ${ch.backpack.length}/${ch.backpackSize}` +
      (ch.syringes || ch.bombs ? `<br><b>[G]</b> ${ch.syringes ? `💉 ${ch.syringes}` : ''}${ch.syringes && ch.bombs ? ' · ' : ''}${ch.bombs ? `💣 ${ch.bombs}` : ''}` : '');

    // Mercador e Invocador
    this.el.merchant.classList.toggle('hidden', !ch.isMerchant && !ch.isSummoner);
    this.el.enFill.parentElement.classList.toggle('hidden', !ch.isMerchant);
    this.el.souls.classList.toggle('hidden', !ch.isSummoner);
    if (ch.isMerchant) {
      this.el.mode.textContent = `💰 Mercador · ⛏️ ${ch.ore} minério`;
      this.el.enFill.style.width = (ch.energy / MERCHANT.energyMax * 100) + '%';
      this.el.enText.textContent = `⚡ ${Math.floor(ch.energy)} / ${MERCHANT.energyMax}`;
      const b = E.building[ch.team];
      this.el.vault.textContent = `Cofre 🪙 ${Math.floor(E.vault[ch.team])}` + (b ? ` · Obra: ${Math.ceil(Math.max(0, b.doneAt - g.time))}s` : '');
    } else if (ch.isSummoner) {
      const n = (k) => g.summonsOf(ch, k).length;
      this.el.mode.textContent = `💀 Invocações: 💀${n('minion')} ☠️${n('warrior')} 🦴${n('archer')} 🪄${n('mage')}`;
      const s = Math.floor(ch.souls);
      let pips = '';
      for (let i = 0; i < SUMMONER.soulsMax; i++) pips += `<i class="${i < s ? 'on' : ''}"></i>`;
      this.el.souls.innerHTML = pips + `<span>${s}</span>`;
      this.el.vault.textContent = g.pc.linking ? '🔗 Elo ativo: gerando almas' : 'Segure LMB num inimigo para gerar almas';
    }
    // canalização
    const chn = ch.channel;
    this.el.channel.classList.toggle('hidden', !chn);
    if (chn) {
      const k = Math.min(1, (g.time - chn.start) / chn.dur);
      this.el.chFill.style.width = (k * 100) + '%';
      this.el.chText.textContent = ({ craft: 'Fabricando', upgrade: 'Aprimorando', mine: 'Minerando', bomb: 'Plantando a bomba' }[chn.kind] || '') + ` · ${Math.max(0, chn.until - g.time).toFixed(1)} s (andar cancela)`;
    }
    this.el.buffs.innerHTML = ch.alive ? this.buffList(ch) : '';
    // mira: vermelha sobre inimigo, azul sobre aliado
    if (g.time > (this._aimAt || 0)) {
      this._aimAt = g.time + 0.08;
      let kind = '';
      if (ch.alive) {
        const look = { origin: cam.position, dir: cam.getWorldDirection(new THREE.Vector3()) };
        let best = null, bestA = 0.06;
        for (const o of g.characters) {
          if (!o.alive || o === ch || o.pos.distanceTo(ch.pos) > 45) continue;
          if (o.isInvisible() && o.team !== ch.team) continue;
          const to = new THREE.Vector3(o.pos.x, o.pos.y + 1.3, o.pos.z).sub(look.origin);
          const a = to.normalize().angleTo(look.dir);
          if (a < bestA) { bestA = a; best = o; }
        }
        if (best) kind = best.team === ch.team ? 'ally' : 'enemy';
      }
      this.el.crosshair.classList.toggle('enemy', kind === 'enemy');
      this.el.crosshair.classList.toggle('ally', kind === 'ally');
    }
    this.updateSkillBar();

    let carry = '';
    if (ch.carrying) carry = `👑 Carregando a ${ch.carrying.name} — leve-a ao trono!`;
    else if (ch.food) carry = '🍗 Banquete na mão — leve à prisioneira no seu castelo';
    this.el.carry.textContent = carry;

    const op = O.promptFor(ch), ia = op ? E.itemAction(ch) : null;
    let prompt = g.cannons.promptFor(ch) || (op ? (ia ? `${op} &nbsp;·&nbsp; ${ia.label}` : op) : E.promptFor(ch));
    if (!prompt && g.world.castles[ch.team].inside(ch.pos.x, ch.pos.z) && ch.alive) prompt = '<b>[B]</b> Trocar de classe';
    this.el.prompt.innerHTML = prompt;
    if (g.time > this.bigUntil) this.el.big.classList.remove('show');
    if (g.time > this.statusUntil) this.el.status.classList.remove('show');

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
    // inimigos marcados pela Presa: visíveis através das paredes
    for (const o of g.characters) {
      if (!o.alive || o.team === ch.team || !(g.time < o.st.markedUntil) || o.st.markedTeam !== ch.team) continue;
      const p = o.pos.clone(); p.y += 2.9;
      this.setMarker('mark' + o.id, p, '🎯', '', 'red', cam, w, h, false);
    }
    // carroça do boticário
    const ap = E.apothecary;
    if (ap.active) this.setMarker('apoth', new THREE.Vector3(ap.pos.x, ap.pos.y + 4, ap.pos.z), '💉', 'Boticário · ' + dist(ap.pos), 'gold', cam, w, h);
    // Ladino com bomba: torres inimigas
    if (ch.bombs > 0 && ch.classKey === 'rogue') {
      for (const tw of g.structures) {
        if (!tw.alive || tw.team === ch.team) continue;
        this.setMarker('tw' + tw.pos.x.toFixed(0), new THREE.Vector3(tw.pos.x, tw.pos.y + 8, tw.pos.z), '💣', 'Torre · ' + dist(tw.pos), 'red', cam, w, h);
      }
    }
    // banca quando perto do castelo
    const sp = E.stalls[ch.team].pos;
    if (g.world.castles[ch.team].inside(ch.pos.x, ch.pos.z) && Math.hypot(sp.x - ch.pos.x, sp.z - ch.pos.z) > 7) {
      this.setMarker('stall', new THREE.Vector3(sp.x, 4.5, sp.z), '🏪', 'Banca', 'gold', cam, w, h, false);
    }
    for (const k in this.markerEls) if (!this.markerEls[k]._used) this.markerEls[k].style.display = 'none';

    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      f.pos.y += dt * 1.2;
      const p = this.project(f.pos, cam, w, h);
      if (f.t > 0.9 || p.behind) { f.el.remove(); this.floaters.splice(i, 1); continue; }
      f.el.style.left = p.x + 'px'; f.el.style.top = p.y + 'px';
      f.el.style.opacity = String(1 - Math.max(0, f.t - 0.5) / 0.4);
    }

    const showSb = g.pc.keys.Tab;
    this.el.scoreboard.classList.toggle('hidden', !showSb);
    if (showSb && (!this._sbAt || g.time > this._sbAt)) { this.renderScoreboard(); this._sbAt = g.time + 0.5; }

    if (g.time > this.mmAt) { this.drawMinimap(); this.mmAt = g.time + 0.1; }
  }

  renderScoreboard() {
    const g = this.game;
    const html = [0, 1].map(t => {
      const rows = g.characters.filter(c => !c.isMonster && c.team === t).sort((a, b) => b.kills - a.kills)
        .map(c => `<tr class="${c.isPlayer ? 'me' : ''}"><td>${c.isPlayer ? 'Você' : c.name}</td><td>${CLASSES[c.classKey].icon} ${CLASSES[c.classKey].name}</td><td>${c.level}</td><td>${c.kills}</td><td>${c.deaths}</td><td>${c.rescues}</td><td>${c.feeds}</td><td>${Math.floor(c.gold)}</td></tr>`).join('');
      const w = g.economy.works[t];
      const works = `Quartel ${w.barracks} · Ossuário ${w.ossuary} · Estandarte ${w.banner} · Torres ${w.towers} · Tesouraria ${w.treasury}`;
      return `<div><h4 style="color:${t ? '#ffaaa0' : '#9cc0ff'}">Time ${TEAM_NAME[t]} — ${g.score[t]}</h4><table><tr><th>Nome</th><th>Classe</th><th>Nv</th><th>Abates</th><th>Mortes</th><th>Resg.</th><th>Banq.</th><th>Ouro</th></tr>${rows}</table><p class="works">Cofre 🪙 ${Math.floor(g.economy.vault[t])} · ${works}</p></div>`;
    }).join('');
    this.el.scoreboard.innerHTML = html;
  }

  // ------------------------------------------------------------ minimapa
  mmXY(x, z) {
    const W = this.el.minimap.width, H = this.el.minimap.height;
    return [(75 - x) / 150 * W, (205 - z) / 410 * H];
  }

  drawMinimap() {
    const g = this.game, ctx = this.mm, W = this.el.minimap.width, H = this.el.minimap.height, E = g.economy;
    if (!this.mmBg) {
      const bg = document.createElement('canvas');
      bg.width = W; bg.height = H;
      const b = bg.getContext('2d');
      const src = g.world.groundCanvas;
      const S = src.width / 220;
      b.save();
      b.translate(W, H); b.scale(-1, -1);
      b.drawImage(src, (110 - 75) * S, (240 - 205) * S, 150 * S, 410 * S, 0, 0, W, H);
      b.restore();
      b.fillStyle = 'rgba(0,0,0,0.15)'; b.fillRect(0, 0, W, H);
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
    const sq = (x, z, color, s = 3) => { const [px, py] = this.mmXY(x, z); ctx.fillStyle = color; ctx.fillRect(px - s, py - s, s * 2, s * 2); };
    for (const f of g.objectives.activeFoods()) dot(f.pos.x, f.pos.z, pl.classKey === 'rogue' && f.poison !== null && f.poison !== undefined ? '#6aff3a' : '#ffd25a', 2.2);
    if (E.apothecary.active) sq(E.apothecary.pos.x, E.apothecary.pos.z, '#5aff8a', 3);
    for (const c of E.coins) if (c.active) dot(c.pos.x, c.pos.z, '#ffe27a', 1.4);
    for (const c of E.chests) if (c.active) sq(c.pos.x, c.pos.z, '#ffcf3a', 2.4);
    for (const it of E.ground) if (it.pos.distanceTo(pl.pos) < 60) dot(it.pos.x, it.pos.z, it.kind === 'gold' ? '#ffe27a' : it.kind === 'syringe' ? '#5aff8a' : RARITY[it.item.rarity].css, 1.8);
    if (pl.isSummoner) {
      for (const tb of E.tombs) sq(tb.pos.x, tb.pos.z, g.time >= tb.readyAt ? '#b48aff' : '#6a5a8a', 2);
      for (const s of E.souls) dot(s.pos.x, s.pos.z, '#d8c0ff', 1.6 + s.value * 0.4);
    }
    if (pl.isMerchant) for (const v of E.veins) sq(v.pos.x, v.pos.z, v.active ? '#6ee6ff' : '#3a5a66', 2);
    const st = E.stalls[pl.team].pos;
    sq(st.x, st.z, '#ffd25a', 2.2);
    for (const tw of g.structures) if (tw.alive) sq(tw.pos.x, tw.pos.z, tw.team === 0 ? '#4a8cff' : '#ff5050', 2.4);
    for (const c of g.characters) {
      if (!c.alive || c === pl) continue;
      if (c.isMonster && !c.summon) { if (c.pos.distanceTo(pl.pos) < 40) dot(c.pos.x, c.pos.z, '#d8d0b8', 2); continue; }
      if (c.team === pl.team) dot(c.pos.x, c.pos.z, c.summon ? '#a0b8e8' : '#7fb0ff', c.summon ? 1.8 : 2.6);
      else {
        const marked = g.time < c.st.markedUntil && c.st.markedTeam === pl.team;
        const visible = marked || (!c.isInvisible() && (c.pos.distanceTo(pl.pos) < 35 || c.carrying || g.time - c.lastHurt < 2));
        if (visible) dot(c.pos.x, c.pos.z, '#ff6a5a', c.summon ? 1.8 : 2.6);
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
      ctx.rotate(-pl.yaw);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 4); ctx.lineTo(0, 2); ctx.lineTo(-4, 4); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
}

export { BOUNDS };
