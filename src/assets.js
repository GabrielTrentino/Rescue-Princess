// Carregamento dos modelos KayKit (glTF) e utilitários de clonagem / instancing.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const BASE = './public/assets/';

const LIST = {
  characters: ['Knight.glb', 'Barbarian.glb', 'Ranger.glb', 'Mage.glb', 'Rogue_Hooded.glb', 'Rogue.glb',
    'Skeleton_Warrior.glb', 'Skeleton_Minion.glb', 'Skeleton_Rogue.glb', 'Skeleton_Mage.glb'],
  anims: ['Rig_Medium_General.glb', 'Rig_Medium_MovementBasic.glb', 'Rig_Medium_CombatMelee.glb', 'Rig_Medium_CombatRanged.glb'],
  weapons: ['sword_1handed', 'shield_round_color', 'shield_badge_color', 'axe_2handed', 'bow_withString', 'arrow_bow', 'staff',
    'dagger', 'spellbook_open', 'sword_A', 'hammer_B', 'halberd', 'staff_B', 'arrow_A'].map(n => n + '.gltf'),
  hex: ['building_castle_blue', 'building_castle_red', 'building_tower_A_blue', 'building_tower_A_red',
    'building_tower_catapult_blue', 'building_tower_catapult_red', 'building_barracks_blue', 'building_barracks_red',
    'building_archeryrange_blue', 'building_archeryrange_red', 'building_blacksmith_blue', 'building_blacksmith_red',
    'building_church_blue', 'building_church_red', 'building_home_A_blue', 'building_home_A_red',
    'building_windmill_blue', 'building_windmill_red', 'building_well_blue', 'building_well_red',
    'building_tavern_blue', 'building_tavern_red',
    'building_bridge_A', 'building_destroyed', 'building_scaffolding', 'fence_wood_straight', 'wall_straight',
    'wall_straight_gate', 'wall_corner_A_outside', 'barrel', 'crate_A_big', 'crate_long_A', 'flag_blue', 'flag_red',
    'tent', 'weaponrack', 'target', 'sack', 'resource_lumber', 'bucket_arrows',
    'mountain_A_grass_trees', 'mountain_B_grass', 'hills_A_trees'].map(n => n + '.gltf'),
  forest: ['Tree_1_A_Color1', 'Tree_2_C_Color1', 'Tree_3_B_Color1', 'Tree_4_A_Color1', 'Tree_Bare_1_A_Color1',
    'Bush_1_E_Color1', 'Bush_2_D_Color1', 'Bush_3_B_Color1', 'Rock_1_J_Color1', 'Grass_2_C_Color1'].map(n => n + '.gltf'),
  dungeon: ['wall', 'wall_doorway', 'wall_corner', 'wall_gated', 'pillar_decorated', 'banner_patternA_blue',
    'banner_patternA_red', 'torch_mounted', 'chest_gold', 'plate_food_A', 'bed_decorated', 'floor_tile_large',
    'barrel_large'].map(n => n + '.gltf'),
};

export const Assets = { models: {}, clips: {} };

export async function loadAll(onProgress) {
  const manager = new THREE.LoadingManager();
  const loader = new GLTFLoader(manager);
  const jobs = [];
  for (const [folder, files] of Object.entries(LIST)) {
    for (const f of files) jobs.push({ folder, f, key: f.replace(/\.(glb|gltf)$/, '') });
  }
  let done = 0;
  await Promise.all(jobs.map(async (j) => {
    const gltf = await loader.loadAsync(BASE + j.folder + '/' + j.f);
    if (j.folder === 'anims') {
      for (const clip of gltf.animations) Assets.clips[clip.name] = clip;
    } else {
      prepare(gltf.scene);
      Assets.models[j.key] = gltf.scene;
    }
    done++;
    onProgress && onProgress(done / jobs.length);
  }));
  // Clip "Running_A" etc.: remove root motion vertical drift that is not useful in FPS.
  return Assets;
}

function prepare(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m.map) { m.map.anisotropy = 4; }
        m.metalness = 0;
        m.roughness = 0.85;
      }
    }
  });
}

/** Clona um modelo. Personagens (skinned) usam SkeletonUtils. */
export function cloneModel(key, { skinned = false } = {}) {
  const src = Assets.models[key];
  if (!src) throw new Error('Modelo não encontrado: ' + key);
  return skinned ? SkeletonUtils.clone(src) : src.clone(true);
}

/** Clona materiais de um objeto (para poder tingir sem afetar outros). */
export function uniqueMaterials(root, tint) {
  root.traverse((o) => {
    if (o.isMesh) {
      if (Array.isArray(o.material)) o.material = o.material.map(m => m.clone());
      else o.material = o.material.clone();
      if (tint !== undefined) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m.color.set(tint);
      }
    }
  });
  return root;
}

/**
 * Cria InstancedMeshes de um modelo estático para muitos transforms.
 * transforms: array de {x, y, z, ry, s} ou Matrix4
 */
export function instanced(key, transforms, { castShadow = true, receiveShadow = true } = {}) {
  const src = Assets.models[key];
  const group = new THREE.Group();
  if (!transforms.length) return group;
  src.updateMatrixWorld(true);
  const tmp = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const mats = transforms.map(t => {
    if (t.isMatrix4) return t;
    q.setFromAxisAngle(up, t.ry || 0);
    const s = t.s || 1;
    return new THREE.Matrix4().compose(new THREE.Vector3(t.x, t.y || 0, t.z), q, new THREE.Vector3(s, s * (t.sy || 1), s));
  });
  src.traverse((o) => {
    if (!o.isMesh) return;
    const im = new THREE.InstancedMesh(o.geometry, o.material, mats.length);
    for (let i = 0; i < mats.length; i++) {
      tmp.multiplyMatrices(mats[i], o.matrixWorld);
      im.setMatrixAt(i, tmp);
    }
    im.castShadow = castShadow;
    im.receiveShadow = receiveShadow;
    im.computeBoundingSphere();
    group.add(im);
  });
  return group;
}

/** Deixa uma arma com aparência de aço (a espada do pacote de peças vem cor de madeira). */
export function steelify(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.map = null;
    o.material.color = new THREE.Color(0xb9c0cc);
    o.material.metalness = 0.55;
    o.material.roughness = 0.35;
    o.material.needsUpdate = true;
  });
  return root;
}
