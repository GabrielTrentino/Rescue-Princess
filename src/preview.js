// Página de pré-visualização do mapa (apenas para desenvolvimento): preview.html?cam=x,y,z,tx,ty,tz
import * as THREE from 'three';
import { loadAll } from './assets.js';
import { World } from './world.js';
import { Collision } from './collision.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 1500);
await loadAll();
const world = new World(scene, new Collision());
world.build();
window.__world = world;
const br = new URLSearchParams(location.search).get('br');
if (br) { const [r, sx, sy, sz] = br.split(',').map(Number); for (const b of world.bridges) { b.rotation.y = r; b.scale.set(sx, sy, sz); b.position.y = 0.22 - 0.25 * sy; } }
const q = new URLSearchParams(location.search).get('cam') || '0,60,-120,0,0,-170';
const [x, y, z, tx, ty, tz] = q.split(',').map(Number);
cam.position.set(x, y, z); cam.lookAt(tx, ty, tz);
world.followSun(new THREE.Vector3(tx, 0, tz));
renderer.render(scene, cam);
window.__ready = true;
