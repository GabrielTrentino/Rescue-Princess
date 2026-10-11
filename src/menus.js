// Menus do jogo (janela por cima da partida, que continua rodando):
// skills e perks (K), mochila (I), banca (E perto da banca ou skill 2 do Mercador), venda ao mercador,
// fabricar, aprimorar, desmanchar, obras e ressurreição.
import { CLASSES, CLASS_KEYS, RARITY, ATTRS, ATTR_KEYS, PRICE_MODES, LEVEL_MULT, SLOT_LEVEL, WORKS, WORK_KEYS, MERCHANT, STALL, WORK_TIME } from './config.js';
import { SKILLS, SKILL_BY_ID, cdOf, soulCost } from './skills.js';
import {
  perkOf, slotState, canUnlock, canEvolve, choosePerk, evolve, pointsFree, isUnlocked, rankOf, xpToNext,
} from './progression.js';
import {
  weaponHtml, weaponLabel, sellValue, stallPrice, basePrice, craftEnergy, craftTime, maxRarityFor, upgradeEnergy,
  refineEnergy, workCost, weaponScore,
} from './economy.js';
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Menus {
  constructor(game) {
    this.game = game;
    this.root = $('modal');
    this.body = $('modalBody');
    this.isOpen = false;
    this.view = null;
    this.state = {};
    this.refreshAt = 0;
    this.body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      this.act(b.dataset.act, b.dataset);
    });
    addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.code === 'Escape' || (e.code === 'KeyK' && this.view === 'skills') || (e.code === 'KeyI' && this.view === 'bag')) {
        e.preventDefault();
        this.close();
      }
    });
  }

  get ch() { return this.game.player; }

  open(view, opts = {}) {
    const g = this.game;
    if (!g.running || g.over || !this.ch.alive && view !== 'skills') return;
    this.view = view;
    this.opts = opts;
    this.msg = '';
    if (view === 'craft' && !this.state.craft) this.state.craft = { cls: this.ch.classKey === 'merchant' ? 'knight' : this.ch.classKey, rarity: 0, attr: 'hp', lvl: 1 };
    if (view === 'stall') this.state.tab = this.ch.isMerchant ? 'expose' : 'buy';
    this.isOpen = true;
    this.root.classList.remove('hidden');
    g.pc.clearInput();
    document.exitPointerLock && document.exitPointerLock();
    this.render();
  }

  close(silent = false) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.view = null;
    this.root.classList.add('hidden');
    const g = this.game;
    if (!silent && g.running && !g.over && g.player.alive) g.ui.lock();
  }

  update() {
    if (!this.isOpen) return;
    const g = this.game;
    if (!this.ch.alive && this.view !== 'skills') { this.close(true); return; }
    if (this.view === 'stall' && !this.ch.isMerchant && !g.economy.nearStall(this.ch, STALL.useRange + 2)) { this.close(); return; }
    if (this.view === 'sell' && !g.economy.nearbyMerchant(this.ch)) { this.close(); return; }
    if (g.time > this.refreshAt) { this.refreshAt = g.time + 0.5; this.render(); }
  }

  flash(msg, ok = false) { this.msg = msg ? `<div class="mmsg ${ok ? 'ok' : ''}">${esc(msg)}</div>` : ''; }

  result(r, okMsg) {
    if (r === true) { this.flash(okMsg, true); sfx('pickup'); return true; }
    this.flash(r || 'Não foi possível'); sfx('hurt');
    return false;
  }

  // ------------------------------------------------------------ ações
  act(a, d) {
    const g = this.game, ch = this.ch, E = g.economy;
    if (a === 'close') { this.close(); return; }
    if (a === 'tab') { this.state.tab = d.tab; this.msg = ''; }
    else if (a === 'perk') {
      const sk = SKILL_BY_ID[d.skill];
      if (choosePerk(ch, sk, d.perk)) { this.flash(`${sk.name}: perk ${sk.perks[d.perk][0]}`, true); sfx('levelup'); }
      else { this.flash('Não é possível escolher agora'); }
    } else if (a === 'evolve') {
      if (evolve(ch, +d.slot)) { this.flash('Skill evoluída para o Nível II', true); sfx('levelup'); }
    } else if (a === 'equip') {
      const i = +d.i, it = ch.backpack[i];
      if (it && it.cls === ch.classKey) {
        ch.backpack.splice(i, 1);
        if (ch.weapon) ch.backpack.push(ch.weapon);
        ch.equip(it);
        g.pc.buildViewmodel();
        this.flash('Equipada: ' + weaponLabel(it), true);
      }
    } else if (a === 'unequip') {
      if (ch.weapon && ch.backpack.length < ch.backpackSize) { ch.backpack.push(ch.weapon); ch.equip(null); g.pc.buildViewmodel(); }
      else this.flash('Mochila cheia');
    } else if (a === 'drop') {
      const it = ch.backpack.splice(+d.i, 1)[0];
      if (it) E.spawnGroundWeapon(it, ch.pos);
    } else if (a === 'buy') this.result(E.buy(ch, +d.i), 'Comprado!'), g.pc.buildViewmodel();
    else if (a === 'sell') this.result(E.sell(ch, +d.i, this.view === 'sell' ? E.nearbyMerchant(ch) : null), 'Vendido!');
    else if (a === 'expose') this.result(E.expose(ch, +d.i, d.mode), 'Exposto na banca');
    else if (a === 'withdraw') this.result(E.withdraw(ch, +d.i), 'Retirado da banca');
    else if (a === 'depot') this.result(E.fromDepot(ch, +d.i), 'Pego do depósito');
    else if (a === 'craftSet') { const s = this.state.craft; s[d.k] = d.k === 'cls' || d.k === 'attr' ? d.v : +d.v; }
    else if (a === 'craft') { if (this.result(E.craft(ch, this.state.craft), 'Fabricando...')) { this.close(); return; } }
    else if (a === 'upgrade' || a === 'refine') {
      const target = d.ally ? { ally: g.characters.find(c => c.id === +d.ally) } : { bag: +d.i };
      if (this.result(E.upgrade(ch, target, a === 'refine'), 'Aprimorando...')) { this.close(); return; }
    } else if (a === 'scrap') this.result(E.scrap(ch, +d.i), 'Desmanchada');
    else if (a === 'work') { if (this.result(E.startWork(ch, d.k), 'Obra iniciada')) { this.close(); return; } }
    else if (a === 'rebuild') this.result(E.rebuildTowers(ch), 'Torres reconstruídas');
    else if (a === 'revive') {
      const ally = g.characters.find(c => c.id === +d.id);
      if (this.result(E.revive(ch, ally), 'Ressuscitado!')) { this.close(); return; }
    }
    this.render();
  }

  // ------------------------------------------------------------ telas
  render() {
    if (!this.isOpen) return;
    const sc = this.body.scrollTop;
    const v = this.view;
    let html = '';
    if (v === 'skills') html = this.viewSkills();
    else if (v === 'bag') html = this.viewBag();
    else if (v === 'stall') html = this.viewStall();
    else if (v === 'sell') html = this.viewSell();
    else if (v === 'craft') html = this.viewCraft();
    else if (v === 'upgrade') html = this.viewUpgrade();
    else if (v === 'scrap') html = this.viewScrap();
    else if (v === 'works') html = this.viewWorks();
    else if (v === 'revive') html = this.viewRevive();
    this.body.innerHTML = html + `<div class="mfoot">${this.msg || ''}<button data-act="close">Fechar (Esc)</button></div>`;
    this.body.scrollTop = sc;
  }

  header(title, sub = '') {
    return `<h2>${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}`;
  }

  skillCard(sk, extra = '') {
    const ch = this.ch;
    const st = slotState(ch, sk.slot);
    const unlocked = isUnlocked(ch, sk.slot);
    const chosen = st && st.perks[sk.id];
    const canPick = unlocked ? !chosen : canUnlock(ch, sk.slot);
    const req = SLOT_LEVEL[sk.slot];
    const cd = cdOf(sk, chosen || null);
    const souls = soulCost(sk, chosen || null);
    const meta = [`Dano: ${sk.dmg}`, `Duração: ${sk.dur}`, `Recarga: ${cd} s`];
    if (sk.cost) meta.push(`Custo: ${sk.cost}`);
    else if (souls) meta.push(`Custo: ${souls} alma${souls > 1 ? 's' : ''}`);
    const perkBtn = (p) => {
      const [name, desc] = sk.perks[p];
      const sel = chosen === p;
      const dis = !canPick || (chosen && !sel);
      return `<button class="perk ${sel ? 'sel' : ''}" data-act="perk" data-skill="${sk.id}" data-perk="${p}" ${dis ? 'disabled' : ''}><b>${p} · ${esc(name)}</b><span>${esc(desc)}</span></button>`;
    };
    let state = '';
    if (!unlocked) state = ch.level >= req ? (pointsFree(ch) ? '<span class="tag go">Escolha um perk para desbloquear (1 ponto)</span>' : '<span class="tag">Sem pontos livres</span>') : `<span class="tag lock">🔒 Nível ${req}</span>`;
    else if (!chosen) state = '<span class="tag go">Escolha o perk</span>';
    else if (rankOf(ch, sk.slot) >= 2) state = '<span class="tag ok">Nível II</span>';
    return `<div class="skc ${unlocked && chosen ? 'on' : ''}">
      <div class="skh"><span class="slot">${sk.slot}</span><b>${esc(sk.name)}</b>${state}</div>
      <div class="skm">${meta.map(esc).join(' · ')}</div>
      <div class="ske">${esc(sk.effect)}</div>
      <div class="perks">${perkBtn('A')}${perkBtn('B')}</div>${extra}
    </div>`;
  }

  viewSkills() {
    const ch = this.ch;
    const xp = xpToNext(ch);
    const free = pointsFree(ch);
    let html = this.header(`${CLASSES[ch.classKey].icon} Skills e perks · ${CLASSES[ch.classKey].name}`,
      `Nível ${ch.level}${xp ? ` · ${xp.have}/${xp.need} XP para o próximo` : ' (máximo)'} · <b>${free}</b> ponto${free === 1 ? '' : 's'} livre${free === 1 ? '' : 's'}. ` +
      `Cada skill tem 2 perks e você escolhe só um (vale até o fim da partida). Slots liberam nos níveis 1, 2, 4, 6 e 8. ` +
      `Um ponto extra numa skill já liberada a evolui para o Nível II (−20% de recarga).` +
      (ch.isMerchant ? ' <br>Mercador de Almas: um ponto libera o mesmo slot nos dois modos; o perk é escolhido para cada skill.' : ''));
    const evo = (slot) => canEvolve(ch, slot) ? `<button class="evo" data-act="evolve" data-slot="${slot}">⬆ Evoluir o slot ${slot} para o Nível II (1 ponto)</button>` : '';
    if (ch.isMerchant) {
      html += '<div class="cols2"><div><h3>💰 Modo Mercador</h3>' + SKILLS.merchant.map(s => this.skillCard(s)).join('') + '</div>';
      html += '<div><h3>💀 Modo Invocador</h3>' + SKILLS.summoner.map(s => this.skillCard(s)).join('') + '</div></div>';
      html += '<div class="evos">' + [1, 2, 3, 4, 5].map(evo).join('') + '</div>';
    } else {
      html += '<div class="skgrid">' + SKILLS[ch.classKey].map(s => this.skillCard(s, evo(s.slot))).join('') + '</div>';
    }
    return html;
  }

  itemRow(it, buttons) {
    return `<div class="irow"><div class="iname">${weaponHtml(it)}</div><div class="ibtn">${buttons}</div></div>`;
  }

  viewBag() {
    const ch = this.ch;
    let html = this.header('🎒 Mochila', `Ouro: <b>🪙 ${Math.floor(ch.gold)}</b> · Espaços: ${ch.backpack.length}/${ch.backpackSize}. Você só equipa armas da sua classe; as outras servem para vender ao mercador.`);
    html += '<h3>Equipada</h3>' + this.itemRow(ch.weapon, ch.weapon ? '<button data-act="unequip">Guardar</button>' : '');
    html += '<h3>Na mochila</h3>';
    if (!ch.backpack.length) html += '<p class="empty">Vazia.</p>';
    ch.backpack.forEach((it, i) => {
      html += this.itemRow(it, `${it.cls === ch.classKey ? `<button data-act="equip" data-i="${i}">Equipar</button>` : ''}<button data-act="drop" data-i="${i}">Largar</button>`);
    });
    return html;
  }

  viewStall() {
    const g = this.game, ch = this.ch, E = g.economy, s = E.stalls[ch.team];
    const vault = Math.floor(E.vault[ch.team]);
    const tabs = ch.isMerchant ? [['expose', 'Expor'], ['withdraw', 'Retirar'], ['depot', `Depósito (${s.depot.length})`], ['buy', 'Comprar']] : [['buy', 'Comprar'], ['sell', 'Vender']];
    const tab = this.state.tab || tabs[0][0];
    let html = this.header('🏪 Banca do Mercador', `Seu ouro: <b>🪙 ${Math.floor(ch.gold)}</b> · Cofre do castelo: <b>🪙 ${vault}</b> · Exposição: ${s.slots.length}/${E.stallSlotsMax(ch.team)}` + (ch.isMerchant ? ` · Energia: <b>⚡ ${Math.floor(ch.energy)}</b>` : ''));
    html += '<div class="tabs">' + tabs.map(([k, n]) => `<button class="${tab === k ? 'sel' : ''}" data-act="tab" data-tab="${k}">${n}</button>`).join('') + '</div>';
    if (tab === 'buy') {
      if (!s.slots.length) html += '<p class="empty">Nada à venda agora.</p>';
      s.slots.forEach((sl, i) => {
        const can = ch.gold >= sl.price;
        const tag = sl.mode !== 'normal' ? ` <span class="tag">${PRICE_MODES[sl.mode].name}</span>` : '';
        html += this.itemRow(sl.item, `${tag}<button data-act="buy" data-i="${i}" ${can ? '' : 'disabled'}>Comprar 🪙 ${sl.price}</button>`);
      });
    } else if (tab === 'sell') {
      html += `<p class="hint">Venda por 50% do preço base. O ouro sai do cofre do castelo e o item vai para o depósito da banca.</p>`;
      if (!ch.backpack.length) html += '<p class="empty">Mochila vazia.</p>';
      ch.backpack.forEach((it, i) => {
        const v = sellValue(it);
        html += this.itemRow(it, `<button data-act="sell" data-i="${i}" ${vault >= v ? '' : 'disabled'}>Vender 🪙 ${v}</button>`);
      });
    } else if (tab === 'expose') {
      html += `<p class="hint">Desconto (70%): ganha energia na venda. Normal (100%). Sobrecarga (150%): gasta energia ao expor. O ouro das vendas vai para o cofre.</p>`;
      if (!ch.backpack.length) html += '<p class="empty">Mochila vazia. Fabrique armas com a skill 1.</p>';
      ch.backpack.forEach((it, i) => {
        const gain = Math.round(RARITY[it.rarity].discount * LEVEL_MULT[it.lvl - 1]);
        const cost = Math.round(RARITY[it.rarity].overcharge * LEVEL_MULT[it.lvl - 1]);
        html += this.itemRow(it,
          `<button data-act="expose" data-i="${i}" data-mode="discount">Desconto 🪙${stallPrice(it, 'discount')} (+${gain}⚡)</button>` +
          `<button data-act="expose" data-i="${i}" data-mode="normal">Normal 🪙${stallPrice(it, 'normal')}</button>` +
          `<button data-act="expose" data-i="${i}" data-mode="overcharge" ${ch.energy >= cost ? '' : 'disabled'}>Sobrecarga 🪙${stallPrice(it, 'overcharge')} (−${cost}⚡)</button>`);
      });
    } else if (tab === 'withdraw') {
      if (!s.slots.length) html += '<p class="empty">Banca vazia.</p>';
      s.slots.forEach((sl, i) => html += this.itemRow(sl.item, `<span class="tag">${PRICE_MODES[sl.mode].name} 🪙${sl.price}</span><button data-act="withdraw" data-i="${i}">Retirar</button>`));
    } else if (tab === 'depot') {
      html += `<p class="hint">Itens que os jogadores venderam quando você não estava por perto.</p>`;
      if (!s.depot.length) html += '<p class="empty">Depósito vazio.</p>';
      s.depot.forEach((it, i) => html += this.itemRow(it, `<button data-act="depot" data-i="${i}">Pegar</button>`));
    }
    return html;
  }

  viewSell() {
    const g = this.game, ch = this.ch, E = g.economy;
    const m = E.nearbyMerchant(ch);
    const vault = Math.floor(E.vault[ch.team]);
    let html = this.header('💰 Vender ao mercador', `${m ? m.displayName : 'Mercador'} compra por 50% do preço base, pagando com o cofre do castelo (🪙 ${vault}).`);
    if (!ch.backpack.length) html += '<p class="empty">Mochila vazia.</p>';
    ch.backpack.forEach((it, i) => {
      const v = sellValue(it);
      html += this.itemRow(it, `<button data-act="sell" data-i="${i}" ${vault >= v ? '' : 'disabled'}>Vender 🪙 ${v}</button>`);
    });
    return html;
  }

  viewCraft() {
    const g = this.game, ch = this.ch, E = g.economy, s = this.state.craft;
    const perk = perkOf(ch, SKILL_BY_ID.m_craft);
    const maxR = maxRarityFor(ch.level);
    if (s.rarity > maxR) s.rarity = maxR;
    const inside = E.inCity(ch);
    const cost = craftEnergy(s.rarity, s.lvl, perk);
    const time = craftTime(s.rarity, s.lvl, perk, inside);
    const it = { cls: s.cls, rarity: s.rarity, attr: s.attr, lvl: s.lvl };
    let html = this.header('🔨 Fabricar arma', `Energia: <b>⚡ ${Math.floor(ch.energy)}</b> · Mochila ${ch.backpack.length}/${ch.backpackSize}${inside ? '' : ' · <b>Fora da cidade: +50% de tempo</b>'}`);
    const opt = (k, v, label, extra = '', dis = false) => `<button class="opt ${String(s[k]) === String(v) ? 'sel' : ''}" data-act="craftSet" data-k="${k}" data-v="${v}" ${dis ? 'disabled' : ''} ${extra}>${label}</button>`;
    html += '<h3>Classe</h3><div class="opts2">' + CLASS_KEYS.map(k => opt('cls', k, `${CLASSES[k].icon} ${CLASSES[k].name}`)).join('') + '</div>';
    html += '<h3>Raridade</h3><div class="opts2">' + RARITY.map((r, i) => opt('rarity', i, `<span style="color:${r.css}">${r.name}</span>${i > maxR ? ` 🔒${r.level}` : ''}`, '', i > maxR)).join('') + '</div>';
    html += '<h3>Atributo secundário</h3><div class="opts2">' + ATTR_KEYS.map(k => opt('attr', k, ATTRS[k].name)).join('') + '</div>';
    html += '<h3>Nível</h3><div class="opts2">' + [1, 2, 3, 4, 5].map(l => opt('lvl', l, '+' + l)).join('') + '</div>';
    const ok = ch.energy >= cost && !ch.channel && (ch.cd.m_craft || 0) <= 0;
    html += `<div class="summary">${weaponHtml(it)}<div>Custo: <b>⚡ ${cost}</b> · Tempo: <b>${time.toFixed(1)} s</b> · Preço base: 🪙 ${basePrice(it)}</div>
      <button class="primary" data-act="craft" ${ok ? '' : 'disabled'}>Fabricar</button></div>
      <p class="hint">Você fica parado fabricando. Se levar dano ou andar, cancela e a energia volta.</p>`;
    return html;
  }

  viewUpgrade() {
    const g = this.game, ch = this.ch;
    const perk = perkOf(ch, SKILL_BY_ID.m_upgrade);
    const maxR = maxRarityFor(ch.level);
    let html = this.header('✨ Aprimorar', `Energia: <b>⚡ ${Math.floor(ch.energy)}</b>. Sobe +1 o atributo (máximo +5). ${perk === 'B' ? 'Refino: também sobe a raridade.' : ''}`);
    const row = (it, data) => {
      let b = '';
      if (it.lvl < 5) { const c = upgradeEnergy(it.lvl + 1, perk); b += `<button data-act="upgrade" ${data} ${ch.energy >= c ? '' : 'disabled'}>+${it.lvl + 1} (⚡${c})</button>`; }
      if (perk === 'B' && it.rarity < RARITY.length - 1) { const c = refineEnergy(it.rarity + 1, perk); b += `<button data-act="refine" ${data} ${ch.energy >= c && it.rarity + 1 <= maxR ? '' : 'disabled'}>→ ${RARITY[it.rarity + 1].name} (⚡${c})</button>`; }
      return this.itemRow(it, b || '<span class="tag">Máximo</span>');
    };
    html += '<h3>Mochila</h3>';
    if (!ch.backpack.length) html += '<p class="empty">Mochila vazia.</p>';
    ch.backpack.forEach((it, i) => html += row(it, `data-i="${i}"`));
    const allies = g.characters.filter(o => o.alive && o.team === ch.team && o !== ch && o.weapon && !o.isMonster && o.pos.distanceTo(ch.pos) < 4.5);
    html += '<h3>Aliados a até 4 m</h3>';
    if (!allies.length) html += '<p class="empty">Nenhum aliado com arma por perto.</p>';
    allies.forEach(o => html += `<div class="who">${esc(o.displayName)}</div>` + row(o.weapon, `data-ally="${o.id}"`));
    return html;
  }

  viewScrap() {
    const ch = this.ch;
    const perk = perkOf(ch, SKILL_BY_ID.m_scrap);
    let html = this.header('⚒️ Desmanchar', `Energia: <b>⚡ ${Math.floor(ch.energy)}</b>. Devolve ${perk === 'A' ? '75' : '50'}% da energia de fabricação${perk === 'B' ? ' e 25% do preço base em ouro para o cofre' : ''}.`);
    if (!ch.backpack.length) html += '<p class="empty">Mochila vazia.</p>';
    ch.backpack.forEach((it, i) => {
      const e = Math.round(craftEnergy(it.rarity, it.lvl, null) * (perk === 'A' ? 0.75 : 0.5));
      html += this.itemRow(it, `<button data-act="scrap" data-i="${i}">Desmanchar (+⚡${e})</button>`);
    });
    return html;
  }

  viewWorks() {
    const g = this.game, ch = this.ch, E = g.economy;
    const perk = perkOf(ch, SKILL_BY_ID.m_works);
    const b = E.building[ch.team];
    let html = this.header('🏗️ Obras do castelo', `Cofre: <b>🪙 ${Math.floor(E.vault[ch.team])}</b> · Energia: <b>⚡ ${Math.floor(ch.energy)}</b> · Uma obra por vez, pronta em ${perk === 'B' ? '0' : WORK_TIME} s.`);
    if (b) html += `<p class="hint">Em construção: <b>${WORKS[b.key].name}</b> (${Math.max(0, Math.ceil(b.doneAt - g.time))} s)</p>`;
    for (const k of WORK_KEYS) {
      const w = WORKS[k], lvl = E.works[ch.team][k], max = w.costs.length;
      const cost = workCost(k, lvl, perk);
      const can = cost && !b && E.vault[ch.team] >= cost.gold && ch.energy >= cost.energy;
      html += `<div class="irow"><div class="iname"><b>${w.name}</b> <span class="tag">${lvl}/${max}</span><small>${esc(w.desc)}</small></div><div class="ibtn">${cost ? `<button data-act="work" data-k="${k}" ${can ? '' : 'disabled'}>Construir 🪙${cost.gold} + ⚡${cost.energy}</button>` : '<span class="tag ok">Completo</span>'}</div></div>`;
    }
    const dead = E.towers[ch.team].filter(t => !t.alive).length;
    if (dead) html += `<button data-act="rebuild">Reconstruir ${dead} torre${dead > 1 ? 's' : ''} (metade do preço)</button>`;
    return html;
  }

  viewRevive() {
    const g = this.game, ch = this.ch;
    const perk = perkOf(ch, SKILL_BY_ID.s_revive);
    const cost = perk === 'B' ? 8 : 10;
    let html = this.header('💀 Ressurreição', `Almas: <b>${Math.floor(ch.souls)}/${MERCHANT.soulsMax}</b> · Custo: ${cost} almas. O aliado volta ao seu lado por ${perk === 'A' ? 90 : 60} s com +20% de velocidade de ataque.`);
    const dead = g.characters.filter(o => !o.alive && o.team === ch.team && !o.isMonster && o !== ch);
    if (!dead.length) html += '<p class="empty">Nenhum aliado morto.</p>';
    for (const o of dead) {
      const left = Math.max(0, Math.ceil(o.respawnAt - g.time));
      html += `<div class="irow"><div class="iname"><b>${esc(o.displayName)}</b> · ${CLASSES[o.classKey].icon} ${CLASSES[o.classKey].name}<small>Renasce em ${left} s</small></div><div class="ibtn"><button data-act="revive" data-id="${o.id}" ${ch.souls >= cost ? '' : 'disabled'}>Ressuscitar</button></div></div>`;
    }
    return html;
  }
}

export { weaponScore };
