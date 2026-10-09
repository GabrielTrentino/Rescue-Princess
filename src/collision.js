// Colisão 2D (plano XZ) com altura: caixas alinhadas aos eixos e círculos,
// indexados numa grade espacial. Usado para movimento, linha de visão e projéteis.

export class Collision {
  constructor(cellSize = 12) {
    this.cell = cellSize;
    this.grid = new Map();
    this.items = [];
    this._stamp = 0;
  }

  _key(i, j) { return i * 100003 + j; }

  _insert(c) {
    c._s = 0;
    this.items.push(c);
    const i0 = Math.floor(c.minX / this.cell), i1 = Math.floor(c.maxX / this.cell);
    const j0 = Math.floor(c.minZ / this.cell), j1 = Math.floor(c.maxZ / this.cell);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = this._key(i, j);
      let arr = this.grid.get(k);
      if (!arr) { arr = []; this.grid.set(k, arr); }
      arr.push(c);
    }
    return c;
  }

  addBox(minX, minZ, maxX, maxZ, height = 10, tag = null) {
    if (minX > maxX) [minX, maxX] = [maxX, minX];
    if (minZ > maxZ) [minZ, maxZ] = [maxZ, minZ];
    return this._insert({ type: 'box', minX, minZ, maxX, maxZ, height, tag });
  }

  addCircle(x, z, r, height = 10, tag = null) {
    return this._insert({ type: 'circle', x, z, r, minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r, height, tag });
  }

  query(minX, minZ, maxX, maxZ, out = []) {
    out.length = 0;
    const s = ++this._stamp;
    const i0 = Math.floor(minX / this.cell), i1 = Math.floor(maxX / this.cell);
    const j0 = Math.floor(minZ / this.cell), j1 = Math.floor(maxZ / this.cell);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const arr = this.grid.get(this._key(i, j));
      if (!arr) continue;
      for (const c of arr) {
        if (c._s === s) continue;
        c._s = s;
        if (c.maxX < minX || c.minX > maxX || c.maxZ < minZ || c.minZ > maxZ) continue;
        out.push(c);
      }
    }
    return out;
  }

  /** Empurra um círculo (pos.x/pos.z, raio r) para fora dos colisores. y = altura dos pés acima do chão. */
  resolve(pos, r, feetY = 0) {
    const list = this.query(pos.x - r, pos.z - r, pos.x + r, pos.z + r, this._q || (this._q = []));
    let hit = false;
    for (let iter = 0; iter < 2; iter++) {
      for (const c of list) {
        if (feetY > c.height - 0.3) continue; // por cima do obstáculo
        if (c.type === 'circle') {
          const dx = pos.x - c.x, dz = pos.z - c.z;
          const d2 = dx * dx + dz * dz, rr = r + c.r;
          if (d2 < rr * rr) {
            const d = Math.sqrt(d2) || 0.0001;
            const push = rr - d;
            pos.x += (dx / d) * push; pos.z += (dz / d) * push;
            hit = true;
          }
        } else {
          const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
          const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
          let dx = pos.x - cx, dz = pos.z - cz;
          const d2 = dx * dx + dz * dz;
          if (d2 === 0) {
            // centro dentro da caixa: sai pelo lado mais próximo
            const l = pos.x - c.minX, rr2 = c.maxX - pos.x, t = pos.z - c.minZ, b = c.maxZ - pos.z;
            const m = Math.min(l, rr2, t, b);
            if (m === l) pos.x = c.minX - r; else if (m === rr2) pos.x = c.maxX + r;
            else if (m === t) pos.z = c.minZ - r; else pos.z = c.maxZ + r;
            hit = true;
          } else if (d2 < r * r) {
            const d = Math.sqrt(d2);
            const push = r - d;
            pos.x += (dx / d) * push; pos.z += (dz / d) * push;
            hit = true;
          }
        }
      }
    }
    return hit;
  }

  /**
   * Interseção de segmento 3D (a->b) com colisores. Retorna fração t (0..1) do primeiro impacto ou -1.
   * groundA/groundB: altura do terreno, para comparar com a altura do colisor.
   */
  raycast(ax, ay, az, bx, by, bz, ground = 0) {
    const minX = Math.min(ax, bx), maxX = Math.max(ax, bx), minZ = Math.min(az, bz), maxZ = Math.max(az, bz);
    const list = this.query(minX, minZ, maxX, maxZ, this._r || (this._r = []));
    const dx = bx - ax, dz = bz - az, dy = by - ay;
    let best = -1;
    for (const c of list) {
      let t0;
      if (c.type === 'circle') {
        const fx = ax - c.x, fz = az - c.z;
        const A = dx * dx + dz * dz;
        if (A < 1e-9) { if (fx * fx + fz * fz < c.r * c.r) t0 = 0; else continue; }
        else {
          const B = 2 * (fx * dx + fz * dz), C = fx * fx + fz * fz - c.r * c.r;
          const disc = B * B - 4 * A * C;
          if (disc < 0) continue;
          const sq = Math.sqrt(disc);
          t0 = (-B - sq) / (2 * A);
          const t1 = (-B + sq) / (2 * A);
          if (t1 < 0 || t0 > 1) continue;
          if (t0 < 0) t0 = 0;
        }
      } else {
        let tmin = 0, tmax = 1;
        if (Math.abs(dx) < 1e-9) { if (ax < c.minX || ax > c.maxX) continue; }
        else {
          let t1 = (c.minX - ax) / dx, t2 = (c.maxX - ax) / dx;
          if (t1 > t2) [t1, t2] = [t2, t1];
          tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
          if (tmin > tmax) continue;
        }
        if (Math.abs(dz) < 1e-9) { if (az < c.minZ || az > c.maxZ) continue; }
        else {
          let t1 = (c.minZ - az) / dz, t2 = (c.maxZ - az) / dz;
          if (t1 > t2) [t1, t2] = [t2, t1];
          tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
          if (tmin > tmax) continue;
        }
        t0 = tmin;
      }
      const y = ay + dy * t0;
      if (y - ground > c.height) continue;
      if (best < 0 || t0 < best) best = t0;
    }
    return best;
  }

  /** Linha de visão livre entre dois pontos (altura dos olhos). */
  los(ax, ay, az, bx, by, bz, ground = 0) {
    return this.raycast(ax, ay, az, bx, by, bz, ground) < 0;
  }
}
