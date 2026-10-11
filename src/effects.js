// Efeitos visuais simples: faíscas, explosões, anéis, fumaça, partículas de cura.
import * as THREE from 'three';

const sphereGeo = new THREE.SphereGeometry(1, 12, 8);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const ringGeo = new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2);

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  _add(mesh, life, update) {
    this.scene.add(mesh);
    this.list.push({ mesh, t: 0, life, update });
  }

  sparks(pos, color = 0xffd27a, count = 8, speed = 6) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
      m.scale.setScalar(0.12 + Math.random() * 0.1);
      m.position.copy(pos);
      const v = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2).normalize().multiplyScalar(speed * (0.5 + Math.random()));
      this._add(m, 0.35 + Math.random() * 0.25, (e, dt) => {
        v.y -= 18 * dt;
        e.mesh.position.addScaledVector(v, dt);
        e.mesh.material.opacity = 1 - e.t / e.life;
      });
    }
  }

  blood(pos) { this.sparks(pos, 0xb3261e, 6, 4); }
  bones(pos) { this.sparks(pos, 0xeeeadf, 10, 6); }

  explosion(pos, radius = 3, color = 0xff8a2a) {
    const m = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false }));
    m.position.copy(pos);
    this._add(m, 0.45, (e) => {
      const k = e.t / e.life;
      e.mesh.scale.setScalar(0.3 + radius * Math.sqrt(k));
      e.mesh.material.opacity = 0.85 * (1 - k);
    });
    const light = new THREE.PointLight(color, 40, radius * 4, 2);
    light.position.copy(pos);
    this._add(light, 0.35, (e) => { e.mesh.intensity = 40 * (1 - e.t / e.life); });
    this.sparks(pos, 0xffc04d, 10, 9);
  }

  ring(pos, radius, color, duration = 0.6, y = 0.15) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    m.position.set(pos.x, pos.y + y, pos.z);
    this._add(m, duration, (e) => {
      const k = e.t / e.life;
      e.mesh.scale.setScalar(0.5 + radius * k);
      e.mesh.material.opacity = 0.9 * (1 - k);
    });
  }

  smoke(pos, count = 14, radius = 2.5) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(sphereGeo, new THREE.MeshStandardMaterial({ color: 0x9a9aa2, transparent: true, opacity: 0.75, roughness: 1, depthWrite: false }));
      const a = Math.random() * Math.PI * 2, r = Math.random() * radius;
      m.position.set(pos.x + Math.cos(a) * r, pos.y + 0.5 + Math.random() * 1.8, pos.z + Math.sin(a) * r);
      const s0 = 0.6 + Math.random() * 0.8;
      this._add(m, 1.4 + Math.random() * 0.8, (e, dt) => {
        const k = e.t / e.life;
        e.mesh.scale.setScalar(s0 * (1 + k * 1.5));
        e.mesh.position.y += dt * 0.6;
        e.mesh.material.opacity = 0.75 * (1 - k);
      });
    }
  }

  heal(pos) {
    this.ring(pos, 2.2, 0x6dff8a, 0.6, 0.2);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0x8dffa0, transparent: true }));
      m.scale.set(0.12, 0.35, 0.12);
      const a = Math.random() * Math.PI * 2;
      m.position.set(pos.x + Math.cos(a) * 0.8, pos.y + 0.4 + Math.random(), pos.z + Math.sin(a) * 0.8);
      this._add(m, 0.9, (e, dt) => { e.mesh.position.y += dt * 2; e.mesh.material.opacity = 1 - e.t / e.life; });
    }
  }

  frost(pos, radius) {
    this.ring(pos, radius, 0x9fe6ff, 0.55, 0.3);
    this.ring(pos, radius * 0.7, 0xffffff, 0.45, 0.6);
    this.sparks(new THREE.Vector3(pos.x, pos.y + 1, pos.z), 0xbff0ff, 18, 10);
  }

  puff(pos, color = 0xffffff) {
    const m = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false }));
    m.position.copy(pos);
    this._add(m, 0.5, (e) => { const k = e.t / e.life; e.mesh.scale.setScalar(0.4 + k * 1.6); e.mesh.material.opacity = 0.6 * (1 - k); });
  }

  /** Corda/raio rápido entre dois pontos (Gancho). */
  rope(a, b, color = 0xc8b089) {
    const geo = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 }));
    line.frustumCulled = false;
    this._add(line, 0.35, (e) => { e.mesh.material.opacity = 1 - e.t / e.life; });
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      e.t += dt;
      if (e.t >= e.life) {
        this.scene.remove(e.mesh);
        if (e.mesh.material) e.mesh.material.dispose();
        this.list.splice(i, 1);
        continue;
      }
      e.update(e, dt);
    }
  }
}
