// Inicialização: renderizador, carregamento dos assets e menus.
import * as THREE from 'three';
import { loadAll } from './assets.js';
import { Game } from './game.js';
import { CLASSES, CLASS_KEYS } from './config.js';
import { initAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

let selectedClass = 'knight';
const params = new URLSearchParams(location.search);

const ui = {
  pendingClass: null,
  respawnOpen: false,
  lock() { lock(); },
  showRespawn(text) {
    this.respawnOpen = true;
    this.confirmRespawn = false;
    this.pendingClass = game.player.classKey;
    $('classMenuTitle').textContent = 'Você caiu!';
    $('classMenuSub').textContent = text + '. Escolha a classe para renascer.';
    renderClasses($('respawnClasses'), this.pendingClass, (k) => { this.pendingClass = k; });
    $('btnClassOk').textContent = 'Renascer';
    $('classMenu').classList.remove('hidden');
    document.exitPointerLock && document.exitPointerLock();
    this.respawnTick();
  },
  respawnTick() {
    if (!this.respawnOpen) return;
    const left = Math.max(0, Math.ceil(game.player.respawnAt - game.time));
    $('btnClassOk').textContent = left > 0 ? `Renascer em ${left}s` : 'Renascer';
    $('btnClassOk').disabled = left > 0;
    setTimeout(() => this.respawnTick(), 200);
  },
  hideRespawn() {
    this.respawnOpen = false;
    $('btnClassOk').disabled = false;
    $('classMenu').classList.add('hidden');
    lock();
  },
  showClassChange() {
    this.changeOpen = true;
    this.pendingClass = game.player.classKey;
    $('classMenuTitle').textContent = 'Arsenal do castelo';
    $('classMenuSub').textContent = 'Troque de classe agora (você continua com a mesma porcentagem de vida).';
    renderClasses($('respawnClasses'), this.pendingClass, (k) => { this.pendingClass = k; });
    $('btnClassOk').textContent = 'Trocar';
    $('btnClassOk').disabled = false;
    $('classMenu').classList.remove('hidden');
    document.exitPointerLock && document.exitPointerLock();
  },
  showEnd(win, g) {
    $('endTitle').textContent = win ? 'Vitória!' : 'Derrota...';
    $('endTitle').style.color = win ? '#f3c34a' : '#ff8a7a';
    $('endSub').textContent = win ? 'A Princesa Azul está a salvo no seu trono. O reino celebra!' : 'O time vermelho levou a princesa deles para casa primeiro.';
    const p = g.player;
    $('endStats').innerHTML = `<table><tr><th>Placar</th><th>Seus abates</th><th>Mortes</th><th>Resgates</th><th>Banquetes</th></tr>
      <tr><td>${g.score[0]} x ${g.score[1]}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${p.rescues}</td><td>${p.feeds}</td></tr></table>
      <p>Nível final: <b>${p.level}</b> · Ouro: <b>${Math.floor(p.gold)}</b></p>`;
    $('endScreen').classList.remove('hidden');
    $('classMenu').classList.add('hidden');
    this.respawnOpen = false;
    this.changeOpen = false;
    document.exitPointerLock && document.exitPointerLock();
  },
};

const game = new Game(renderer, ui);
window.__game = game;

function renderClasses(container, selected, onPick) {
  container.innerHTML = '';
  for (const k of CLASS_KEYS) {
    const c = CLASSES[k];
    const b = document.createElement('button');
    b.className = 'cls' + (k === selected ? ' sel' : '');
    b.innerHTML = `<span class="hk">${c.hotkey}</span><div class="ic">${c.icon}</div><div class="nm">${c.name}</div><div class="ds">${c.desc}</div><div class="st">${c.stats}<br>Vida ${c.hp}${c.canCarry === false ? " · não carrega a princesa" : ""}</div>`;
    b.onclick = () => {
      container.querySelectorAll('.cls').forEach(e => e.classList.remove('sel'));
      b.classList.add('sel');
      onPick(k);
    };
    b.dataset.key = k;
    container.appendChild(b);
  }
}
addEventListener('keydown', (e) => {
  const n = parseInt(e.key, 10);
  if (!Number.isNaN(n)) {
    const key = CLASS_KEYS.find(k => CLASSES[k].hotkey === n);
    const vis = !$('classMenu').classList.contains('hidden') ? $('respawnClasses') : !$('menu').classList.contains('hidden') ? $('menuClasses') : null;
    if (key && vis) vis.querySelector(`[data-key="${key}"]`)?.click();
  }
});

renderClasses($('menuClasses'), selectedClass, (k) => { selectedClass = k; });

function lock() {
  if (params.has('nolock')) { game.locked = true; return; }
  canvas.requestPointerLock && canvas.requestPointerLock();
}

document.addEventListener('pointerlockchange', () => {
  game.locked = document.pointerLockElement === canvas;
  if (!game.locked && game.running && !game.over && !ui.respawnOpen && !ui.changeOpen && !(game.menus && game.menus.isOpen)) {
    game.paused = true;
    game.pc.clearInput();
    $('pause').classList.remove('hidden');
  }
});

canvas.addEventListener('click', () => { if (game.running && !game.paused && !game.locked && !ui.respawnOpen && !ui.changeOpen && !(game.menus && game.menus.isOpen)) lock(); });

$('btnPlay').onclick = () => {
  initAudio();
  const settings = {
    difficulty: $('optDifficulty').value,
    teamSize: parseInt($('optTeam').value, 10),
    scoreToWin: parseInt($('optScore').value, 10),
  };
  $('menu').classList.add('hidden');
  game.start(settings, selectedClass);
  lock();
};
$('btnClassOk').onclick = () => {
  if (ui.changeOpen) {
    ui.changeOpen = false;
    game.changePlayerClass(ui.pendingClass, true);
    $('classMenu').classList.add('hidden');
    game.pc.clearInput();
    lock();
  } else {
    // renascimento (o clique também serve para recapturar o mouse)
    if (game.time >= game.player.respawnAt) ui.confirmRespawn = true;
  }
};
$('btnResume').onclick = () => { $('pause').classList.add('hidden'); game.paused = false; lock(); };
$('btnQuit').onclick = () => { location.reload(); };
$('btnAgain').onclick = () => {
  $('endScreen').classList.add('hidden');
  game.stop();
  $('menu').classList.remove('hidden');
};

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  game.resize(innerWidth, innerHeight);
});

// carregamento
loadAll((p) => { $('loadFill').style.width = (p * 100).toFixed(0) + '%'; }).then(() => {
  $('btnPlay').disabled = false;
  $('btnPlay').textContent = 'Jogar';
  $('loadbar').style.visibility = 'hidden';
  if (params.has('autostart')) {
    selectedClass = params.get('class') || 'knight';
    $('menu').classList.add('hidden');
    game.start({ difficulty: params.get('diff') || 'normal', teamSize: parseInt(params.get('team') || '6', 10), scoreToWin: parseInt(params.get('score') || '2', 10) }, selectedClass);
    game.locked = true;
  }
}).catch((e) => {
  console.error(e);
  $('btnPlay').textContent = 'Erro ao carregar (abra via servidor local)';
});

// loop principal
const clock = new THREE.Clock();
function frame() {
  if (params.has('test')) return; // testes automatizados avançam o tempo manualmente
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, clock.getDelta());
  if (game.running) {
    if (!game.paused) game.update(dt);
    game.render();
  }
}
frame();

// ganchos para testes automatizados
window.__step = (seconds, step = 1 / 30, render = true) => {
  for (let t = 0; t < seconds; t += step) game.update(step);
  if (render) game.render();
};
