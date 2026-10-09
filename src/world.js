// Construção do mapa: terreno, rio, pontes, dois castelos, floresta, acampamentos e grafo de navegação.
import * as THREE from 'three';
import { Assets, cloneModel, instanced } from './assets.js';
import { TEAM, TEAM_HEX } from './config.js';

export const BOUNDS = { x: 70, z: 203 };
export const RIVER_HALF = 7;
export const BRIDGES = [-48, 0, 48];
export const LANE_X = 48;
export const CASTLE_Z = 170;
const GROUND_W = 220, GROUND_H = 480;

// ---------------------------------------------------------------- terreno
function smooth(t) { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); }

export function terrainHeight(x, z) {
  let h = 0;
  const d = Math.abs(z);
  if (d < RIVER_HALF) h = -1.7 * (1 - smooth((d - 2.5) / (RIVER_HALF - 2.5)));
  const ax = Math.abs(x);
  if (ax > 64) h += (ax - 64) * 0.5;
  if (d > 198) h += (d - 198) * 0.6;
  return h;
}

export function onBridge(x, z) {
  if (Math.abs(z) > 7.4) return false;
  for (const bx of BRIDGES) if (Math.abs(x - bx) < 3.6) return true;
  return false;
}

export function heightAt(x, z) {
  const h = terrainHeight(x, z);
  if (onBridge(x, z)) return Math.max(h, 0.22);
  return h;
}

export function inWater(x, z) { return !onBridge(x, z) && terrainHeight(x, z) < -0.6; }

// gerador pseudo-aleatório determinístico
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// estradas (polilinhas no mundo) — usadas para pintar o chão e evitar árvores
const ROADS = [
  { w: 7, pts: [[0, -150], [0, 150]] },
  { w: 6, pts: [[-28, -170], [-42, -168], [-48, -158], [-48, 158], [-42, 168], [-28, 170]] },
  { w: 6, pts: [[28, -170], [42, -168], [48, -158], [48, 158], [42, 168], [28, 170]] },
  { w: 5, pts: [[-48, -70], [48, -70]] },
  { w: 5, pts: [[-48, 70], [48, 70]] },
  { w: 4, pts: [[-48, 35], [-62, 35]] },
  { w: 4, pts: [[48, -35], [62, -35]] },
];

function distToSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + dx * t, cz = az + dz * t;
  return Math.hypot(px - cx, pz - cz);
}
export function distToRoad(x, z) {
  let best = 1e9;
  for (const r of ROADS) for (let i = 0; i < r.pts.length - 1; i++) {
    const d = distToSeg(x, z, r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1]) - r.w / 2;
    if (d < best) best = d;
  }
  return best;
}

// ---------------------------------------------------------------- mundo
export class World {
  constructor(scene, collision) {
    this.scene = scene;
    this.col = collision;
    this.castles = [];
    this.animated = [];
    this.foodSpawns = [];
    this.camps = [];
    this.nav = new NavGraph(collision);
    this.time = 0;
  }

  build() {
    this.buildSky();
    this.buildLights();
    this.buildGround();
    this.buildWater();
    this.buildBridges();
    this.castles[TEAM.BLUE] = this.buildCastle(TEAM.BLUE);
    this.castles[TEAM.RED] = this.buildCastle(TEAM.RED);
    this.buildMiddle();
    this.buildScenery();
    this.buildBorders();
    this.buildNav();
  }

  // transformação de simetria pontual: o castelo vermelho é o azul girado 180°
  tp(team, x, z) { return team === TEAM.RED ? { x: -x, z: -z } : { x, z }; }

  place(key, x, z, { ry = 0, s = 1, y = null, team = TEAM.BLUE, parent = this.scene } = {}) {
    const p = this.tp(team, x, z);
    const o = cloneModel(key);
    o.position.set(p.x, y === null ? terrainHeight(p.x, p.z) : y, p.z);
    o.rotation.y = ry + (team === TEAM.RED ? Math.PI : 0);
    o.scale.setScalar(s);
    parent.add(o);
    return o;
  }
  box(team, minX, minZ, maxX, maxZ, h = 8, tag = null) {
    if (team === TEAM.RED) return this.col.addBox(-maxX, -maxZ, -minX, -minZ, h, tag);
    return this.col.addBox(minX, minZ, maxX, maxZ, h, tag);
  }
  circ(team, x, z, r, h = 8) {
    const p = this.tp(team, x, z);
    return this.col.addCircle(p.x, p.z, r, h);
  }

  buildSky() {
    const geo = new THREE.SphereGeometry(900, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x4f9be8) }, mid: { value: new THREE.Color(0xa9d4f5) }, bot: { value: new THREE.Color(0xe8f1ea) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.55, h)) : mix(mid, bot, smoothstep(0.0, -0.2, h)); gl_FragColor = vec4(c, 1.0); }',
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);
    this.scene.fog = new THREE.Fog(0xb9d9ef, 110, 380);
  }

  buildLights() {
    const hemi = new THREE.HemisphereLight(0xdff0ff, 0x6a8a45, 1.35);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
    sun.position.set(60, 100, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 10; sc.far = 300;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
  }

  followSun(pos) {
    const t = this.sun.target.position;
    // alinha à grade de texels para evitar tremulação das sombras
    const snap = 140 / 2048;
    t.set(Math.round(pos.x / snap) * snap, 0, Math.round(pos.z / snap) * snap);
    this.sun.position.set(t.x + 60, 100, t.z + 40);
  }

  buildGround() {
    const S = 4; // px por unidade
    const cw = GROUND_W * S, ch = GROUND_H * S;
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const g = cv.getContext('2d');
    const rnd = mulberry32(7);
    const X = (x) => (x + GROUND_W / 2) * S, Z = (z) => (z + GROUND_H / 2) * S;

    g.fillStyle = '#79ad4c'; g.fillRect(0, 0, cw, ch);
    // regiões: floresta oeste mais escura, colinas leste mais amareladas
    let grad = g.createLinearGradient(X(-70), 0, X(70), 0);
    grad.addColorStop(0, 'rgba(60,110,45,0.55)');
    grad.addColorStop(0.35, 'rgba(60,110,45,0.0)');
    grad.addColorStop(0.65, 'rgba(160,170,80,0.0)');
    grad.addColorStop(1, 'rgba(160,170,80,0.45)');
    g.fillStyle = grad; g.fillRect(0, 0, cw, ch);
    // manchas de ruído
    for (let i = 0; i < 9000; i++) {
      const x = rnd() * cw, y = rnd() * ch, r = 2 + rnd() * 18;
      const c = rnd();
      g.fillStyle = c < 0.5 ? `rgba(40,90,30,${0.05 + rnd() * 0.08})` : c < 0.85 ? `rgba(150,200,90,${0.05 + rnd() * 0.08})` : `rgba(120,100,60,${0.04 + rnd() * 0.05})`;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    // margens do rio
    g.fillStyle = '#cdb985'; g.fillRect(0, Z(-9), cw, Z(9) - Z(-9));
    g.fillStyle = '#9c946c'; g.fillRect(0, Z(-6.5), cw, Z(6.5) - Z(-6.5));
    g.fillStyle = '#5d7d68'; g.fillRect(0, Z(-4), cw, Z(4) - Z(-4));
    // pátios dos castelos
    for (const sgn of [-1, 1]) {
      const z0 = sgn * CASTLE_Z;
      g.fillStyle = '#a29d90';
      g.fillRect(X(-28), Z(z0 - 20), 56 * S, 40 * S);
      g.strokeStyle = 'rgba(70,65,55,0.35)'; g.lineWidth = 1;
      for (let x = -28; x <= 28; x += 4) { g.beginPath(); g.moveTo(X(x), Z(z0 - 20)); g.lineTo(X(x), Z(z0 + 20)); g.stroke(); }
      for (let z = -20; z <= 20; z += 4) { g.beginPath(); g.moveTo(X(-28), Z(z0 + z)); g.lineTo(X(28), Z(z0 + z)); g.stroke(); }
    }
    // clareiras
    for (const [x, z, r] of [[-62, 35, 13], [62, -35, 13], [20, 27, 9], [-20, -27, 9]]) {
      const rg = g.createRadialGradient(X(x), Z(z), 0, X(x), Z(z), r * S);
      rg.addColorStop(0, 'rgba(170,140,95,0.95)'); rg.addColorStop(0.7, 'rgba(170,140,95,0.7)'); rg.addColorStop(1, 'rgba(170,140,95,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(X(x), Z(z), r * S, 0, Math.PI * 2); g.fill();
    }
    // estradas
    g.lineCap = 'round'; g.lineJoin = 'round';
    const stroke = (w, color) => {
      for (const r of ROADS) {
        g.strokeStyle = color; g.lineWidth = (r.w + w) * S;
        g.beginPath(); g.moveTo(X(r.pts[0][0]), Z(r.pts[0][1]));
        for (const p of r.pts.slice(1)) g.lineTo(X(p[0]), Z(p[1]));
        g.stroke();
      }
    };
    stroke(1.6, 'rgba(120,95,55,0.55)');
    stroke(0, '#b8996a');
    stroke(-2.2, '#c6aa7b');
    for (let i = 0; i < 5000; i++) {
      const x = (rnd() - 0.5) * 150, z = (rnd() - 0.5) * 360;
      if (distToRoad(x, z) > 0) continue;
      g.fillStyle = rnd() < 0.5 ? 'rgba(90,70,40,0.35)' : 'rgba(230,210,170,0.35)';
      g.fillRect(X(x), Z(z), 2 + rnd() * 3, 2 + rnd() * 3);
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const geo = new THREE.PlaneGeometry(GROUND_W, GROUND_H, 110, 480);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 });
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.ground = ground;
    this.groundCanvas = cv;
  }

  buildWater() {
    const geo = new THREE.PlaneGeometry(GROUND_W, RIVER_HALF * 2, 60, 6);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3d9bd6, transparent: true, opacity: 0.78, roughness: 0.25, metalness: 0.1 });
    const water = new THREE.Mesh(geo, mat);
    water.position.y = -0.55;
    this.scene.add(water);
    this.water = water;
    this.waterBase = geo.attributes.position.array.slice();
  }

  buildBridges() {
    this.bridges = [];
    for (const bx of BRIDGES) {
      // a ponte hexagonal fica na diagonal: gira o modelo (150°) para alinhar o tabuleiro ao eixo Z
      // e escala o grupo externo nos eixos do mundo (largura em X, vão em Z)
      const inner = cloneModel('building_bridge_A');
      inner.rotation.y = 5 * Math.PI / 6;
      const b = new THREE.Group();
      b.add(inner);
      b.scale.set(19, 6, 8.6);
      b.position.set(bx, 0.22 - 0.25 * 6, 0);
      this.scene.add(b);
      this.bridges.push(b);
    }
  }

  // ------------------------------------------------------------ castelos
  buildCastle(team) {
    const tc = team === TEAM.BLUE ? 'blue' : 'red';
    const z0 = -CASTLE_Z; // coordenadas no referencial azul
    const P = (key, x, z, o = {}) => this.place(key, x, z, { team, ...o });

    // muralhas (parede da masmorra 4x4x1 em escala 2 = 8x8x2)
    const W = 2, L = 8;
    for (const x of [-24, -16, -8, 8, 16, 24]) { P('wall', x, z0 + 20, { s: W }); this.box(team, x - 4, z0 + 19, x + 4, z0 + 21, 8); }
    for (const x of [-24, -16, -8, 0, 8, 16, 24]) { P('wall', x, z0 - 20, { s: W, ry: Math.PI }); this.box(team, x - 4, z0 - 21, x + 4, z0 - 19, 8); }
    for (const sx of [-28, 28]) {
      for (const dz of [-16, -8, 8, 16]) {
        P('wall', sx, z0 + dz, { s: W, ry: sx < 0 ? -Math.PI / 2 : Math.PI / 2 });
        this.box(team, sx - 1, z0 + dz - 4, sx + 1, z0 + dz + 4, 8);
      }
    }
    // pilares dos portões
    for (const x of [-5.6, 5.6]) { P('pillar_decorated', x, z0 + 20.2, { s: 2 }); this.circ(team, x, z0 + 20, 2.1, 8); }
    for (const sx of [-28, 28]) for (const dz of [-5.6, 5.6]) {
      P('pillar_decorated', sx, z0 + dz, { s: 2, ry: Math.PI / 2 }); this.circ(team, sx, z0 + dz, 2.1, 8);
    }
    // torres nos cantos
    const towers = [];
    for (const [x, z] of [[-28, z0 + 20], [28, z0 + 20], [-28, z0 - 20], [28, z0 - 20]]) {
      towers.push(P('building_tower_A_' + tc, x, z, { s: 6.5, ry: Math.PI / 6 }));
      this.circ(team, x, z, 3.4, 14);
      const f = P('flag_' + tc, x, z, { s: 9, y: 14.1 });
      this.animated.push({ type: 'flag', obj: f, phase: x * 0.1 + z });
    }
    // estandartes e tochas na face externa da muralha
    for (const x of [-16, 16]) P('banner_patternA_' + tc, x, z0 + 20, { s: 2 });
    for (const x of [-8, 8]) P('torch_mounted', x * 1.05, z0 + 21.1, { s: 2, y: 3.4 });
    for (const x of [-24, 0, 24]) P('banner_patternA_' + tc, x, z0 - 20, { s: 2, ry: Math.PI });

    // torre principal (castelo hexagonal ampliado) ao fundo
    P('building_castle_' + tc, 0, z0 - 13, { s: 7 });
    this.box(team, -7, z0 - 21, 7, z0 - 5.2, 28);
    for (const x of [-4.5, 4.5]) P('banner_patternA_' + tc, x, z0 - 5.4, { s: 1.4, y: 6 });

    // masmorra da princesa: paredes 6x6 (escala 1.5) em frente à torre
    const cz0 = z0 - 5, cz1 = z0 + 7; // fundo e frente da cela
    const cs = 1.5;
    for (const sx of [-6, 6]) for (const dz of [3, 9]) {
      P('wall_gated', sx, cz0 + dz, { s: cs, ry: Math.PI / 2 });
    }
    this.box(team, -6.75, cz0, -5.25, cz1, 6, 'cell');
    this.box(team, 5.25, cz0, 6.75, cz1, 6, 'cell');
    P('wall_gated', -3, cz1, { s: cs });
    this.box(team, -6, cz1 - 0.75, 0, cz1 + 0.75, 6, 'cell');
    const doorway = P('wall_doorway', 3, cz1, { s: cs });
    const door = doorway.getObjectByName('wall_doorway_door');
    if (door) door.rotation.y = -1.9;
    this.box(team, 0, cz1 - 0.75, 1.4, cz1 + 0.75, 6, 'cell');
    this.box(team, 4.6, cz1 - 0.75, 6, cz1 + 0.75, 6, 'cell');
    for (const x of [-3, 3]) for (const dz of [3, 9]) P('floor_tile_large', x, cz0 + dz, { s: cs, y: 0.06 });
    P('bed_decorated', -3.6, cz0 + 2.6, { s: 1.1, ry: 0 });
    this.box(team, -5.2, cz0 + 0.5, -2.2, cz0 + 4.2, 1.2);
    P('torch_mounted', 3.5, cz0 + 0.1, { s: 1.4, y: 3 });
    P('barrel_large', 4.3, cz0 + 1.5, { s: 0.6 });

    // círculo do trono (zona de resgate)
    const throne = this.tp(team, 0, z0 + 12.5);
    const ringGeo = new THREE.RingGeometry(2.6, 3.4, 48);
    ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: TEAM_HEX[team], transparent: true, opacity: 0.85 }));
    ring.position.set(throne.x, 0.08, throne.z);
    this.scene.add(ring);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(2.6, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: TEAM_HEX[team], transparent: true, opacity: 0.18 }));
    inner.position.set(throne.x, 0.07, throne.z);
    this.scene.add(inner);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.2, 12, 32, 1, true),
      new THREE.MeshBasicMaterial({ color: TEAM_HEX[team], transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.set(throne.x, 6, throne.z);
    this.scene.add(beam);
    this.animated.push({ type: 'pulse', obj: ring, beam });

    // edifícios do pátio
    P('building_barracks_' + tc, -18, z0 - 12, { s: 4.5, ry: Math.PI });
    this.box(team, -21.5, z0 - 16, -14.5, z0 - 8.5, 8);
    P('building_blacksmith_' + tc, 18, z0 - 12, { s: 4.5, ry: Math.PI });
    this.box(team, 14.5, z0 - 15.5, 21.5, z0 - 8.5, 8);
    // decoração do pátio
    for (const [x, z] of [[-24, z0 + 15], [24, z0 + 15], [-24, z0 + 11], [-23, z0 - 3]]) { P('barrel', x, z, { s: 8, ry: x }); this.circ(team, x, z, 0.9, 1.6); }
    for (const [x, z] of [[24, z0 - 3], [24, z0 + 11]]) { P('crate_A_big', x, z, { s: 7, ry: z }); this.circ(team, x, z, 1.1, 1.8); }
    for (const [x, z, ry] of [[-12, z0 - 3, 0.3], [12, z0 - 3, -0.3]]) P('weaponrack', x, z, { s: 8, ry });
    P('target', 21, z0 + 6, { s: 9, ry: -Math.PI / 2 });
    P('bucket_arrows', 18, z0 + 6, { s: 8 });
    // torres de catapulta do lado de fora
    for (const x of [-14, 14]) { P('building_tower_catapult_' + tc, x, z0 + 27, { s: 5, ry: Math.PI }); this.circ(team, x, z0 + 27, 2.6, 8); }
    // vilarejo ao redor
    const wm1 = P('building_windmill_' + tc, -60, z0 - 22, { s: 7, ry: 0.4 });
    this.circ(team, -60, z0 - 22, 3.2, 10);
    const wm2 = P('building_windmill_' + tc, 60, z0 - 16, { s: 7, ry: -0.5 });
    this.circ(team, 60, z0 - 16, 3.2, 10);
    for (const wm of [wm1, wm2]) {
      wm.traverse(o => { if (o.name && o.name.includes('fan')) this.animated.push({ type: 'fan', obj: o }); });
    }
    P('building_church_' + tc, -62, z0 + 6, { s: 5, ry: Math.PI / 2 }); this.circ(team, -62, z0 + 6, 3, 10);
    P('building_tavern_' + tc, 62, z0 + 8, { s: 5, ry: -Math.PI / 2 }); this.circ(team, 62, z0 + 8, 3.4, 10);
    P('building_home_A_' + tc, -60, z0 + 22, { s: 5, ry: 2 }); this.circ(team, -60, z0 + 22, 2.4, 8);
    P('building_home_A_' + tc, 60, z0 + 26, { s: 5, ry: -2 }); this.circ(team, 60, z0 + 26, 2.4, 8);
    P('building_well_' + tc, 58, z0 - 2, { s: 4 }); this.circ(team, 58, z0 - 2, 1.6, 3);
    for (const [x, z] of [[-38, z0 + 26], [38, z0 + 28]]) { P('tent', x, z, { s: 9, ry: x > 0 ? -0.6 : 0.6 }); this.circ(team, x, z, 2, 4); }

    const v = (x, z, y = 0) => { const p = this.tp(team, x, z); return new THREE.Vector3(p.x, y, p.z); };
    const castle = {
      team,
      z0: team === TEAM.BLUE ? -CASTLE_Z : CASTLE_Z,
      throne: v(0, z0 + 12.5),
      throneRadius: 3.4,
      cellPos: v(-0.5, cz0 + 5.5),
      cellCenter: v(0, cz0 + 6),
      spawns: [v(-10.5, z0 - 17), v(10.5, z0 - 17), v(-10.5, z0 - 13), v(10.5, z0 - 13), v(-24, z0 - 16), v(24, z0 - 16), v(-12, z0 - 6), v(12, z0 - 6)],
      gateOut: v(0, z0 + 25),
      defendPoints: [v(0, z0 + 24), v(-10, z0 + 13), v(10, z0 + 13), v(3, z0 + 10), v(-32, z0), v(32, z0)],
      facing: team === TEAM.BLUE ? 0 : Math.PI, // yaw olhando para o inimigo
    };
    castle.inside = (x, z) => {
      const p = this.tp(team, x, z);
      return p.x > -28 && p.x < 28 && p.z > z0 - 20 && p.z < z0 + 20;
    };
    return castle;
  }

  // ------------------------------------------------------------ meio do mapa
  buildMiddle() {
    // ruínas centrais
    for (const team of [TEAM.BLUE, TEAM.RED]) {
      this.place('building_destroyed', -22, -28, { s: 6, ry: 0.7, team });
      this.circ(team, -22, -28, 4, 6);
      this.place('building_scaffolding', -30, -18, { s: 4.5, ry: -0.4, team });
      this.circ(team, -30, -18, 2.6, 6);
      this.place('resource_lumber', -14, -32, { s: 7, ry: 1.2, team });
      this.place('crate_long_A', -26, -20, { s: 6, ry: 0.2, team });
      this.place('sack', -17, -21, { s: 7, team });
      // acampamento de esqueletos (a leste no referencial azul)
      const cx = 62, cz = -35;
      this.place('tent', cx + 5, cz - 6, { s: 10, ry: -2.2, team }); this.circ(team, cx + 5, cz - 6, 2.2, 4);
      this.place('tent', cx - 4, cz - 8, { s: 9, ry: 2.6, team }); this.circ(team, cx - 4, cz - 8, 2, 4);
      this.place('building_destroyed', cx + 6, cz + 7, { s: 5, ry: 2.4, team }); this.circ(team, cx + 6, cz + 7, 3.4, 5);
      this.place('chest_gold', cx + 1, cz - 3, { s: 1.1, ry: Math.PI, team }); this.circ(team, cx + 1, cz - 3, 1, 1.2);
      for (const [dx, dz] of [[-6, 3], [-2, 8]]) { this.place('barrel', cx + dx, cz + dz, { s: 8, team }); this.circ(team, cx + dx, cz + dz, 0.9, 1.6); }
      const p = this.tp(team, cx, cz);
      this.camps.push({ x: p.x, z: p.z });
      for (const [x, z] of [[62, -35], [-16, -24], [30, -100]]) {
        const q = this.tp(team, x, z);
        this.foodSpawns.push(new THREE.Vector3(q.x, terrainHeight(q.x, q.z), q.z));
      }
    }
    // placas de pedra sob a comida: marcadores
    for (const f of this.foodSpawns) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 0.2, 16), new THREE.MeshStandardMaterial({ color: 0x9a8f7a, roughness: 1 }));
      m.position.set(f.x, f.y + 0.05, f.z);
      m.receiveShadow = true;
      this.scene.add(m);
    }
  }

  // ------------------------------------------------------------ vegetação
  buildScenery() {
    const rnd = mulberry32(1337);
    const occupied = [];
    const clear = (x, z, margin) => {
      if (Math.abs(x) > 68 || Math.abs(z) > 200) return false;
      if (Math.abs(z) < RIVER_HALF + 2) return false;
      if (distToRoad(x, z) < margin) return false;
      if (Math.abs(x) < 44 && Math.abs(z) > 136) return false; // castelos
      if (Math.abs(Math.abs(x) - 60) < 8 && Math.abs(z) > 140) return false; // vilarejos
      for (const [cx, cz, r] of [[-62, 35, 14], [62, -35, 14], [20, 27, 12], [-20, -27, 12], [30, 100, 5], [-30, -100, 5], [16, 24, 6], [-16, -24, 6]]) {
        if (Math.hypot(x - cx, z - cz) < r + margin) return false;
      }
      for (const o of occupied) if (Math.hypot(x - o[0], z - o[1]) < o[2] + margin) return false;
      return true;
    };
    const trees = { Tree_1_A_Color1: [], Tree_2_C_Color1: [], Tree_3_B_Color1: [], Tree_4_A_Color1: [], Tree_Bare_1_A_Color1: [] };
    const treeKeys = Object.keys(trees);
    const tryPlace = (n, fx, fz, keyPick, r, scale, colR) => {
      for (let i = 0, placed = 0; i < n * 8 && placed < n; i++) {
        const x = fx(), z = fz();
        if (!clear(x, z, r)) continue;
        const k = keyPick(x);
        const s = scale();
        trees[k].push({ x, z, y: terrainHeight(x, z), ry: rnd() * Math.PI * 2, s });
        occupied.push([x, z, colR * s]);
        this.col.addCircle(x, z, colR * s, 9);
        placed++;
      }
    };
    // floresta densa a oeste, mata rala a leste
    const westKey = () => { const r = rnd(); return r < 0.35 ? 'Tree_3_B_Color1' : r < 0.6 ? 'Tree_1_A_Color1' : r < 0.85 ? 'Tree_2_C_Color1' : 'Tree_4_A_Color1'; };
    const eastKey = () => { const r = rnd(); return r < 0.45 ? 'Tree_4_A_Color1' : r < 0.75 ? 'Tree_Bare_1_A_Color1' : 'Tree_1_A_Color1'; };
    tryPlace(170, () => -68 + rnd() * 62, () => -200 + rnd() * 400, westKey, 3.2, () => 1.1 + rnd() * 0.9, 0.55);
    tryPlace(70, () => 6 + rnd() * 62, () => -200 + rnd() * 400, eastKey, 3.5, () => 1.0 + rnd() * 0.7, 0.45);
    for (const k of treeKeys) this.scene.add(instanced(k, trees[k]));

    // rochas e arbustos
    const rocks = [];
    for (let i = 0, n = 0; i < 600 && n < 55; i++) {
      const east = rnd() < 0.75;
      const x = east ? 6 + rnd() * 62 : -68 + rnd() * 62, z = -200 + rnd() * 400;
      if (!clear(x, z, 3)) continue;
      const s = 0.5 + rnd() * 0.9;
      rocks.push({ x, z, y: terrainHeight(x, z) - 0.2, ry: rnd() * 6.28, s });
      occupied.push([x, z, 1.8 * s]);
      this.col.addCircle(x, z, 1.7 * s, 3 * s);
      n++;
    }
    this.scene.add(instanced('Rock_1_J_Color1', rocks));
    const bushes = { Bush_1_E_Color1: [], Bush_2_D_Color1: [], Bush_3_B_Color1: [] };
    const bk = Object.keys(bushes);
    for (let i = 0, n = 0; i < 1500 && n < 200; i++) {
      const x = -68 + rnd() * 136, z = -200 + rnd() * 400;
      if (!clear(x, z, 1.5)) continue;
      bushes[bk[Math.floor(rnd() * 3)]].push({ x, z, y: terrainHeight(x, z), ry: rnd() * 6.28, s: 1 + rnd() * 1.2 });
      n++;
    }
    for (const k of bk) this.scene.add(instanced(k, bushes[k], { castShadow: false }));
    const grass = [];
    for (let i = 0; i < 1600; i++) {
      const x = -68 + rnd() * 136, z = -200 + rnd() * 400;
      if (Math.abs(z) < RIVER_HALF + 1 || distToRoad(x, z) < 0.5) continue;
      if (Math.abs(x) < 30 && Math.abs(z) > 149 && Math.abs(z) < 191) continue;
      grass.push({ x, z, y: terrainHeight(x, z), ry: rnd() * 6.28, s: 0.6 + rnd() * 0.7 });
    }
    this.scene.add(instanced('Grass_2_C_Color1', grass, { castShadow: false }));
  }

  buildBorders() {
    const m = [];
    for (let z = -240; z <= 240; z += 26) {
      m.push({ k: 'mountain_A_grass_trees', x: -96 - (Math.abs(z) % 3) * 3, z, s: 17 + (Math.abs(z) % 5) });
      m.push({ k: 'mountain_B_grass', x: 98 + (Math.abs(z) % 4) * 2, z: z + 9, s: 18 + (Math.abs(z) % 4) });
    }
    for (let x = -90; x <= 90; x += 26) {
      m.push({ k: 'mountain_A_grass_trees', x, z: -238, s: 18 });
      m.push({ k: 'mountain_B_grass', x: x + 10, z: 240, s: 18 });
    }
    for (let z = -200; z <= 200; z += 30) {
      m.push({ k: 'hills_A_trees', x: -80, z: z + 11, s: 11 });
      m.push({ k: 'hills_A_trees', x: 80, z: z - 4, s: 11 });
    }
    const groups = {};
    for (const o of m) (groups[o.k] = groups[o.k] || []).push({ x: o.x, z: o.z, y: terrainHeight(o.x, o.z) - 1, ry: (o.x * 13 + o.z * 7) % 6.28, s: o.s });
    for (const k in groups) this.scene.add(instanced(k, groups[k], { castShadow: false }));
  }

  // ------------------------------------------------------------ navegação
  buildNav() {
    const N = this.nav;
    // metade azul (z < 0); a vermelha é espelhada pela simetria pontual
    const half = [
      ['cell', 2.5, -168], ['door', 3.2, -160.5], ["throne", 0, -157.5], ['gateOut', 0, -144],
      ['courtL', -14, -160], ['courtR', 14, -160], ['sideInL', -22, -170], ['sideInR', 22, -170],
      ['sideOutL', -35, -170], ['sideOutR', 35, -170], ['backL', -12, -172], ['backR', 12, -172],
      ['c1', 0, -128], ['c2', 0, -100], ['c3', 0, -70], ['c4', 0, -35], ['c5', 0, -10],
      ['wl0', -46, -160], ['wl1', -48, -130], ['wl2', -48, -100], ['wl3', -48, -70], ['wl4', -48, -35], ['wl5', -48, -10],
      ['el0', 46, -160], ['el1', 48, -130], ['el2', 48, -100], ['el3', 48, -70], ['el4', 48, -35], ['el5', 48, -10],
      ['campE', 58, -35], ['foodW', -30, -100], ['foodE', 30, -100], ['ruin', -12, -22],
      ['m1', -24, -70], ['m2', 24, -70],
    ];
    const edges = [
      ['cell', 'door'], ['door', 'throne'], ['door', 'courtR'], ['throne', 'gateOut'], ['throne', 'courtL'], ['throne', 'courtR'],
      ['courtL', 'sideInL'], ['courtR', 'sideInR'], ['sideInL', 'sideOutL'], ['sideInR', 'sideOutR'],
      ['backL', 'courtL'], ['backL', 'sideInL'], ['backR', 'courtR'], ['backR', 'sideInR'],
      ['gateOut', 'c1'], ['c1', 'c2'], ['c2', 'c3'], ['c3', 'c4'], ['c4', 'c5'],
      ['sideOutL', 'wl0'], ['wl0', 'wl1'], ['wl1', 'wl2'], ['wl2', 'wl3'], ['wl3', 'wl4'], ['wl4', 'wl5'],
      ['sideOutR', 'el0'], ['el0', 'el1'], ['el1', 'el2'], ['el2', 'el3'], ['el3', 'el4'], ['el4', 'el5'],
      ['wl3', 'm1'], ['m1', 'c3'], ['c3', 'm2'], ['m2', 'el3'], ['el4', 'campE'],
      ['c2', 'foodW'], ['wl2', 'foodW'], ['c2', 'foodE'], ['el2', 'foodE'], ['c4', 'ruin'], ['c5', 'ruin'],
    ];
    const id = (name, red) => (red ? 'R_' : 'B_') + name;
    for (const red of [false, true]) {
      for (const [n, x, z] of half) N.add(id(n, red), red ? -x : x, red ? -z : z);
      for (const [a, b] of edges) N.link(id(a, red), id(b, red));
    }
    // pontes no meio: (x,0) liga o lado azul ao vermelho
    N.add('bridgeC', 0, 0); N.add('bridgeW', -48, 0); N.add('bridgeE', 48, 0);
    N.link('bridgeC', 'B_c5'); N.link('bridgeC', 'R_c5');
    N.link('bridgeW', 'B_wl5'); N.link('bridgeW', 'R_el5'); // (48,-10) espelhado = (-48,10)
    N.link('bridgeE', 'B_el5'); N.link('bridgeE', 'R_wl5');
    N.finalize();
  }

  update(dt) {
    this.time += dt;
    for (const a of this.animated) {
      if (a.type === 'fan') a.obj.rotation.z += dt * 0.8;
      else if (a.type === 'flag') a.obj.rotation.y = Math.sin(this.time * 1.7 + a.phase) * 0.25;
      else if (a.type === 'pulse') {
        a.obj.material.opacity = 0.6 + Math.sin(this.time * 3) * 0.25;
        a.beam.material.opacity = 0.08 + Math.sin(this.time * 2) * 0.04;
      }
    }
    // ondulação da água
    const p = this.water.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = this.waterBase[i * 3], z = this.waterBase[i * 3 + 2];
      p.setY(i, Math.sin(x * 0.3 + this.time * 1.5) * 0.06 + Math.cos(z * 0.9 + this.time) * 0.04);
    }
    p.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- grafo de navegação
export class NavGraph {
  constructor(col) { this.col = col; this.nodes = []; this.byId = new Map(); }
  add(id, x, z) { const n = { id, x, z, links: [], i: this.nodes.length }; this.nodes.push(n); this.byId.set(id, n); return n; }
  link(a, b) {
    const A = this.byId.get(a), B = this.byId.get(b);
    if (!A || !B) { console.warn('nav link inválido', a, b); return; }
    A.links.push(B); B.links.push(A);
  }
  finalize() {}

  nearestVisible(x, z) {
    const sorted = this.nodes.map(n => [n, (n.x - x) ** 2 + (n.z - z) ** 2]).sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < Math.min(6, sorted.length); i++) {
      const n = sorted[i][0];
      if (this.col.los(x, 1.2, z, n.x, 1.2, n.z)) return n;
    }
    return sorted[0][0];
  }

  /** Caminho de 'from' até 'to' (Vector3). Retorna lista de pontos {x,z}. */
  path(from, to) {
    if (this.col.los(from.x, 1.2, from.z, to.x, 1.2, to.z) && Math.hypot(from.x - to.x, from.z - to.z) < 60) {
      return [{ x: to.x, z: to.z }];
    }
    const s = this.nearestVisible(from.x, from.z);
    const e = this.nearestVisible(to.x, to.z);
    const open = [s], came = new Map(), g = new Map([[s, 0]]), f = new Map([[s, this.h(s, e)]]);
    const closed = new Set();
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (f.get(open[i]) < f.get(open[bi])) bi = i;
      const cur = open.splice(bi, 1)[0];
      if (cur === e) break;
      closed.add(cur);
      for (const nb of cur.links) {
        if (closed.has(nb)) continue;
        const ng = g.get(cur) + this.h(cur, nb);
        if (ng < (g.get(nb) ?? Infinity)) {
          came.set(nb, cur); g.set(nb, ng); f.set(nb, ng + this.h(nb, e));
          if (!open.includes(nb)) open.push(nb);
        }
      }
    }
    const out = [{ x: to.x, z: to.z }];
    let c = e;
    out.unshift({ x: c.x, z: c.z });
    while (came.has(c)) { c = came.get(c); out.unshift({ x: c.x, z: c.z }); }
    return out;
  }
  h(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
}
