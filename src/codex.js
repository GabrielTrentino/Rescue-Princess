// Códice: guia do jogo aberto pelo menu inicial. Regras, classes (com skills e perks), economia, itens
// e mecânicas escondidas. Os números vêm direto de config.js e skills.js, então ficam sempre atualizados.
import {
  CLASSES, CLASS_KEYS, MONSTERS, MAX_FAT, PRINCESS_RETURN_TIME, RESPAWN_TIME, LEVEL_XP, MAX_LEVEL, XP, GOLD,
  RARITY, ATTRS, ARMOR, STALL, MERCHANT, FORGE, FORGE_KEYS, BOOSTS, BOOST_KEYS, BOOST_MAX, boostCost, WORKS, WORK_KEYS,
  TOWER, ITEMS, APOTHECARY, SUPPLY, SUMMONER, WEAPON_GROUND_TIME,
} from './config.js';
import { SKILLS, cdOf, soulCost } from './skills.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const TABS = [
  ['rules', '📜 Regras'],
  ['classes', '⚔️ Classes'],
  ['economy', '💰 Economia'],
  ['items', '💉 Itens e eventos'],
  ['hidden', '🔍 Mecânicas escondidas'],
];

function rules() {
  return `
  <div class="cx-cols">
    <section>
      <h3>Objetivo</h3>
      <p>Cada time tem uma princesa, e ela está presa na <b>masmorra do castelo inimigo</b>. Entre lá, pegue-a com <b>E</b> e leve-a até o <b>círculo do trono</b> no seu castelo. Cada entrega vale 1 ponto; vence quem chegar primeiro ao placar escolhido.</p>
      <p>Ao mesmo tempo, a princesa inimiga está presa na sua masmorra. Defenda-a: se alguém a soltar no chão, encoste nela para devolvê-la à cela.</p>
      <h3>Peso da princesa</h3>
      <p>Banquetes aparecem pelo mapa. Leve um até a <b>prisioneira</b> no seu castelo: ela engorda 1 nível (máximo ${MAX_FAT}) e fica mais pesada para o inimigo carregar. Cada nível tira 6% da velocidade de quem a carrega (no máximo até 55% da velocidade normal).</p>
      <p>Para aliviar a <b>sua</b> princesa, use uma <b>seringa</b> (tecla G) perto dela ou enquanto a carrega: ela perde 1 nível de peso.</p>
    </section>
    <section>
      <h3>Controles</h3>
      <ul>
        <li><b>WASD</b> mover · <b>Shift</b> correr · <b>Espaço</b> pular</li>
        <li><b>Botão esquerdo</b> ataque base · <b>Botão direito</b> bloquear (Arqueira: mirar; Invocador: Marcha)</li>
        <li><b>1</b> a <b>5</b> skills · <b>K</b> perks e evolução</li>
        <li><b>E</b> princesa, banquete, itens, ouro, minerar, banca</li>
        <li><b>G</b> usar seringa ou bomba</li>
        <li><b>I</b> mochila · <b>B</b> trocar de classe (dentro do castelo) · <b>Tab</b> placar · <b>Esc</b> pausa</li>
      </ul>
      <h3>Progressão</h3>
      <p>Abates, assistências, banquetes, resgates, curas e obras dão XP. São ${MAX_LEVEL} níveis (${LEVEL_XP[MAX_LEVEL]} XP no total). As 5 skills já vêm liberadas; cada nível dá 1 ponto para escolher <b>um dos dois perks</b> de uma skill. Com os 5 perks escolhidos, os pontos evoluem skills para o <b>Nível II</b> (−20% de recarga; no Mercador, −20% de energia).</p>
      <h3>Times</h3>
      <p>Você é sempre o time <b style="color:#6aa8ff">azul</b>. Anel no chão, marcador, nome e brilho do modelo seguem a cor do time, e a mira fica vermelha sobre inimigos.</p>
    </section>
  </div>`;
}

function classes() {
  let nav = '<div class="cx-classnav">' + CLASS_KEYS.map(k => `<a href="#cx-${k}">${CLASSES[k].icon} ${CLASSES[k].name}</a>`).join('') + '</div>';
  let html = nav;
  for (const k of CLASS_KEYS) {
    const c = CLASSES[k], a = c.attack;
    const dmg = a.damage !== undefined ? `${a.damage} de dano` : a.damageMin !== undefined ? `${a.damageMin} a ${a.damageMax} de dano (tensionando)` : 'gera almas';
    const rmb = c.rmb === 'zoom' ? 'mirar com zoom' : c.rmb === 'march' ? `Marcha: +40% de velocidade para aliados a até ${SUMMONER.marchRadius} m (recarga ${SUMMONER.marchCooldown} s)` : `bloquear (${Math.round(c.block * 100)}% do dano frontal)`;
    html += `<div class="cx-class" id="cx-${k}">
      <div class="cx-chead"><span class="cx-ic">${c.icon}</span><div><b>${c.name}</b> <span class="tag">tecla ${c.hotkey}</span><br><small>${esc(c.desc)}</small></div></div>
      <div class="cx-stats">❤️ ${c.hp} de vida · 🛡️ ${c.armor} de armadura · 👟 ${c.speed} de velocidade · 🎒 ${c.backpack} espaços · ${c.canCarry === false ? '🚫 não carrega a princesa' : `👑 carrega a princesa a ${Math.round(c.carry * 100)}% da velocidade`}</div>
      <div class="cx-stats">🖱️ Esquerdo: <b>${esc(a.name)}</b> (${dmg}) · Direito: ${rmb}</div>
      <div class="cx-skills">${(SKILLS[k] || []).map(sk => {
        const cd = cdOf(sk, null), souls = soulCost(sk, null);
        const meta = [cd ? `recarga ${cd} s` : 'sem recarga', sk.cost ? sk.cost : souls ? `${souls} alma${souls > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
        return `<div class="cx-sk"><div class="cx-skh"><span class="sicon c-${k}">${sk.icon || '✦'}</span><b>${sk.slot}. ${esc(sk.name)}</b> <small>${esc(meta)}</small></div>
          <div class="cx-ske">${esc(sk.effect)}</div>
          <div class="cx-perks"><span><b>A · ${esc(sk.perks.A[0])}</b> ${esc(sk.perks.A[1])}</span><span><b>B · ${esc(sk.perks.B[0])}</b> ${esc(sk.perks.B[1])}</span></div></div>`;
      }).join('')}</div>
    </div>`;
  }
  return html;
}

function economy() {
  const rar = RARITY.map(r => `<span style="color:${r.css}">${r.name} +${Math.round(r.dmg * 100)}%</span>`).join(' · ');
  const boostRows = BOOST_KEYS.map(k => {
    const b = BOOSTS[k];
    const costs = Array.from({ length: BOOST_MAX }, (_, i) => boostCost(i)).join(' → ');
    return `<li>${b.icon} <b>${b.name}</b>: ${b.desc} por nível (até ${BOOST_MAX}). Preço: ${costs} de ouro.</li>`;
  }).join('');
  return `
  <div class="cx-cols">
    <section>
      <h3>Ouro</h3>
      <ul>
        <li>Todos ganham ${GOLD.passive} de ouro por segundo (mais com a Tesouraria).</li>
        <li>Abate de jogador: ${GOLD.kill}. Esqueleto: ${GOLD.skeleton}. Resgate: ${GOLD.rescue} para cada um do time.</li>
        <li>Moedas na estrada (${GOLD.coinMin} a ${GOLD.coinMax}) e baús nos acampamentos (${GOLD.chest}).</li>
        <li>O ouro que o Mercador coleta vai para o <b>cofre do castelo</b>, que paga obras, Oficina, Reino e as compras de itens dos jogadores.</li>
      </ul>
      <h3>Equipamento</h3>
      <p>Arma (só da sua classe), capacete e peitoral (qualquer classe). Cada peça tem raridade, nível (+1 a +5) e um atributo: ${Object.values(ATTRS).map(a => a.name.toLowerCase()).join(', ')}.</p>
      <p>Bônus de dano da arma por raridade: ${rar}.</p>
      <p>Armadura: classe + capacete (básico ${ARMOR.helmet.basic}) + peitoral (básico ${ARMOR.body.basic}). A redução de dano é armadura ÷ (armadura + 100): 50 de armadura = −33%.</p>
      <h3>Banca</h3>
      <p>Compre peças na banca do castelo (E perto dela) e venda as suas por 50% do preço base. ${STALL.slots} expositores, mais ${STALL.shelf} com Expositores extras e ${STALL.vitrine} com o perk Vitrine.</p>
    </section>
    <section>
      <h3>Mercador</h3>
      <p>Sem recargas: o limite é a <b>energia</b> (máx. ${MERCHANT.energyMax}; recupera ${MERCHANT.regenIn}/s na cidade e ${MERCHANT.regenOut}/s fora) e o <b>minério</b> dos veios de cristal (E por ${MERCHANT.mineTime} s).</p>
      <ul>
        <li><b>Oficina</b> (skill 1): abas <b>Fabricar</b> (raridade sorteada; inclui seringas) e <b>Aprimorar</b> (+1 nível com energia e minério).</li>
        <li><b>Posto de suprimentos</b> (skill 3): ${SUPPLY.energy} de energia, ${SUPPLY.duration} s, aliados a ${SUPPLY.radius} m recuperam ${SUPPLY.regen} de vida/s e ganham +${SUPPLY.armor} de armadura.</li>
        <li><b>Sua Oficina</b> (skill 5, individual): ${FORGE_KEYS.map(k => `${FORGE[k].name} (${FORGE[k].cost})`).join(', ')}.</li>
        <li><b>Reino</b> (skill 5, para o time todo):<ul>${boostRows}</ul></li>
        <li><b>Obras</b>: ${WORK_KEYS.map(k => WORKS[k].name).join(', ')}.</li>
      </ul>
      <h3>Torres de defesa</h3>
      <p>Construídas pelo Mercador (obra Torres), ficam <b>do lado de fora do portão</b> e atiram em qualquer inimigo a até ${TOWER.range} m que esteja à vista. O Ladino pode destruí-las com uma bomba.</p>
    </section>
  </div>`;
}

function items() {
  const s = ITEMS.syringe, b = ITEMS.bomb;
  return `
  <div class="cx-cols">
    <section>
      <h3>${s.icon} Seringa</h3>
      <p>Qualquer classe pode usar. Com <b>G</b> perto da sua princesa (até ${s.useRange} m) ou enquanto a carrega, ela perde <b>1 nível de peso</b>. Carregue até ${s.max}.</p>
      <p><b>Ladino:</b> com G perto de um banquete, ele o contamina. Se um inimigo levar esse banquete à prisioneira (que é a princesa do Ladino), ela <b>emagrece</b> em vez de engordar. Só Ladinos veem a marca verde do banquete contaminado.</p>
      <h3>Como conseguir</h3>
      <ul>
        <li><b>Banca</b>, aba Boticário: ${s.price} de ouro, enquanto houver estoque.</li>
        <li><b>Fabricação</b>: o Mercador fabrica na Oficina (${MERCHANT.craftEnergy.syringe} de energia + ${s.craftOre} minérios) e a seringa vai para o estoque da banca.</li>
        <li><b>Esqueletos</b> selvagens têm ${Math.round(s.dropChance * 100)}% de chance de deixar uma seringa ao morrer.</li>
        <li><b>Carroça do boticário</b>: evento a cada ${APOTHECARY.every} s (a primeira aos ${APOTHECARY.first} s), alternando entre as ruínas dos dois lados do rio, com ${APOTHECARY.syringes} seringas. Fica ${APOTHECARY.life} s.</li>
      </ul>
    </section>
    <section>
      <h3>${b.icon} Bomba</h3>
      <p>Só o Ladino compra (banca, aba Boticário, ${b.price} de ouro) e carrega ${b.max}. Com <b>G</b> perto de uma torre inimiga, ele planta a bomba em ${String(b.plantTime).replace(".", ",")} s (tiros da torre não interrompem; golpes de inimigos, sim). A torre explode <b>sozinha</b> ${b.fuse} s depois.</p>
      <h3>Monstros</h3>
      <ul>${Object.values(MONSTERS).map(m => `<li><b>${m.name}</b>: ${m.hp} de vida, ${m.damage} de dano${m.kind === 'ranged' ? `, alcance ${m.range} m` : ''}.</li>`).join('')}</ul>
      <p>Os esqueletos selvagens vivem nos acampamentos e atacam qualquer time. O Arqueiro só aparece invocado pelo Invocador.</p>
    </section>
  </div>`;
}

function hidden() {
  const list = [
    ['Facada pelas costas', 'O golpe do Ladino por trás causa dano triplo.'],
    ['Tiro na cabeça', 'Flechas na cabeça causam até +50% de dano. O capacete reduz esse bônus (mínimo +15%).'],
    ['Bloqueio só pela frente', 'Bloquear só reduz o dano de golpes que vêm da frente; ataques pelas costas e pelos lados passam inteiros.'],
    ['Peso persistente', 'O peso da princesa não volta a zero depois de um resgate: ela volta à cela com o mesmo peso. Só a seringa e o banquete contaminado o reduzem.'],
    ['Princesa no chão', `Se quem a carrega morrer, ela cai. Depois de ${PRINCESS_RETURN_TIME} s no chão, volta sozinha para a cela; um defensor que encosta nela a devolve na hora.`],
    ['Seringa em movimento', 'Quem carrega a princesa pode aplicar a seringa sem parar de correr.'],
    ['Banquete contaminado', 'O veneno só funciona contra o inimigo: se um aliado do Ladino pegar o banquete, ele vale como banquete normal. O Ladino nunca pega um banquete que o inimigo contaminou.'],
    ['Banquete derrubado', 'Ao pegar a princesa, o banquete que você carregava cai no chão (e continua contaminado, se estava). Ele some em 30 s.'],
    ['Arma que cai', `Ao morrer, a arma cai no chão uma raridade abaixo e com 1 nível a menos; uma arma Comum vira ${GOLD.dropPile} de ouro. Capacete e peitoral ficam com você. Itens no chão somem em ${WEAPON_GROUND_TIME} s.`],
    ['Bots e dificuldade', 'No Fácil e no Normal, o dano dos bots contra você é reduzido. Os bots que atiram de longe pausam entre os tiros.'],
    ['Renascimento', `Jogadores renascem em ${RESPAWN_TIME} s; cada nível do Quartel tira 1 s. O Sacerdote pode ressuscitar na hora.`],
    ['Almas', `Toda morte deixa almas por ${SUMMONER.soulLife} s, e só o Invocador as coleta. Túmulos dão 1 alma a cada ${SUMMONER.tombEvery} s ao Invocador que passar.`],
    ['Invocações', 'As invocações não somem com o tempo: o limite é de quantidade por tipo, +1 por nível do Ossuário.'],
    ['Cofre', 'Vender itens a um mercador tira o ouro do cofre. Se o cofre estiver vazio, ninguém consegue vender.'],
    ['Fabricar fora da cidade', 'O Mercador fabrica e aprimora 50% mais devagar fora da cidade, e recupera energia na metade da velocidade.'],
    ['Desconto e sobrecarga', 'Expor um item com desconto dá energia ao Mercador quando ele vende; com sobrecarga, o item custa 50% a mais, mas gasta energia ao expor.'],
    ['Reino para quem renasce', 'As melhorias do Reino valem também para quem troca de classe ou renasce depois da compra.'],
    ['Times sem Mercador', 'Se o time não tiver Mercador, um vendedor do castelo repõe a banca com peças comuns e, aos poucos, o estoque de seringas.'],
    ['Torres e invisibilidade', 'As torres precisam ver o alvo: não atiram através de paredes nem em quem está invisível.'],
  ];
  return '<div class="cx-hidden">' + list.map(([t, d]) => `<div class="cx-h"><b>${t}</b><span>${d}</span></div>`).join('') + '</div>';
}

const RENDER = { rules, classes, economy, items, hidden };

export function initCodex() {
  const root = $('codex'), body = $('codexBody');
  let tab = 'rules';
  const render = () => {
    body.innerHTML = `<h2>📖 Códice</h2>
      <div class="tabs">${TABS.map(([k, n]) => `<button class="${k === tab ? 'sel' : ''}" data-cx="${k}">${n}</button>`).join('')}</div>
      <div class="cx-body">${RENDER[tab]()}</div>
      <div class="mfoot"><button data-cx="close">Fechar (Esc)</button></div>`;
    body.scrollTop = 0;
  };
  body.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#cx-"]');
    if (a) { e.preventDefault(); const el = document.getElementById(a.getAttribute('href').slice(1)); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const b = e.target.closest('[data-cx]');
    if (!b) return;
    if (b.dataset.cx === 'close') { root.classList.add('hidden'); return; }
    tab = b.dataset.cx;
    render();
  });
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && !root.classList.contains('hidden')) root.classList.add('hidden'); });
  $('btnCodex').onclick = () => { render(); root.classList.remove('hidden'); };
}
