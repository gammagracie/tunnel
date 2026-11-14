// Shared helpers for segment builders.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

let _glowTex = null;

// Soft radial glow texture, shared.
export function sharedGlow() {
  if (_glowTex) return _glowTex;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  _glowTex = new THREE.CanvasTexture(c);
  return _glowTex;
}

export function glowSprite(color = 0xffffff, scale = 4, opacity = 1) {
  const m = new THREE.SpriteMaterial({
    map: sharedGlow(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(scale);
  return s;
}

// Dark enclosing tube for a tunnel segment. Local z runs 0 .. -length.
export function tunnelShell({ length, radius = 6, color = 0x04050a }) {
  const geo = new THREE.CylinderGeometry(radius, radius, length + 4, 24, 1, true);
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.z = -length / 2;
  return mesh;
}

// Glowing ring that marks a tunnel mouth.
export function portalRing(color, radius = 5.2, tube = 0.14) {
  const geo = new THREE.TorusGeometry(radius, tube, 10, 56);
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  return new THREE.Mesh(geo, mat);
}

// Merge many thin "neon bar" boxes into one mesh (one draw call).
// bars: [{from:[x,y,z], to:[x,y,z], thick}]
export function neonBars(bars, color, opacity = 1) {
  const geos = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (const b of bars) {
    const a = new THREE.Vector3(...b.from);
    const z = new THREE.Vector3(...b.to);
    const len = a.distanceTo(z);
    const t = b.thick ?? 0.07;
    const g = new THREE.BoxGeometry(t, len, t);
    const mid = a.clone().add(z).multiplyScalar(0.5);
    const dir = z.clone().sub(a).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
    const m = new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    geos.push(g);
  }
  const merged = mergeGeometries(geos);
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  return new THREE.Mesh(merged, mat);
}

// Vertical linear-gradient canvas texture (for light shafts, liquid columns).
export function gradientTexture(stops, w = 4, h = 256) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, h);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Animated "liquid" texture: gradient plus bubbles/blobs; scroll offset.y for motion.
export function liquidTexture(baseStops, blobColor = 'rgba(255,230,180,0.5)') {
  const w = 64, h = 512;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, h);
  for (const [o, col] of baseStops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.fillStyle = blobColor;
  for (let i = 0; i < 46; i++) {
    const r = 1.5 + Math.random() * 5;
    g.beginPath();
    g.arc(Math.random() * w, Math.random() * h, r, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Structural ribs along a tunnel — rings sweeping past give strong depth
// cues and make the tube feel physically built around you. One merged mesh.
export function tunnelRibs({ length, radius = 6, step = 8, color = 0x11131c, thick = 0.22, sides = 18 }) {
  const geos = [];
  for (let z = step / 2; z < length; z += step) {
    const g = new THREE.TorusGeometry(radius - 0.15, thick, 5, sides);
    g.translate(0, 0, -z);
    geos.push(g);
  }
  return new THREE.Mesh(
    mergeGeometries(geos),
    new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.25 })
  );
}

// Open lattice truss pylon (Tibidabo style): four corner legs + zig-zag
// cross-bracing, tapering slightly. Returns ONE merged geometry (caller
// translates/merges further), so a whole row of pylons stays one draw call.
export function trussPylonGeometry({ height = 26, base = 2.2, top = 1.1 } = {}) {
  const geos = [];
  const leg = 0.09;
  const lerp = (a, b, f) => a + (b - a) * f;
  const bar = (x1, y1, z1, x2, y2, z2, t = leg) => {
    const a = new THREE.Vector3(x1, y1, z1), b = new THREE.Vector3(x2, y2, z2);
    const len = a.distanceTo(b);
    const g = new THREE.BoxGeometry(t, len, t);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
    geos.push(g);
  };
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  // legs
  for (const [cx, cz] of corners)
    bar(cx * base / 2, 0, cz * base / 2, cx * top / 2, height, cz * top / 2, 0.12);
  // horizontal rings + zig-zag braces on each face
  const bands = 6;
  for (let i = 0; i < bands; i++) {
    const y0 = (height / bands) * i, y1 = (height / bands) * (i + 1);
    const w0 = lerp(base, top, y0 / height) / 2, w1 = lerp(base, top, y1 / height) / 2;
    for (let f = 0; f < 4; f++) {
      const [ax, az] = corners[f], [bx, bz] = corners[(f + 1) % 4];
      bar(ax * w0, y0, az * w0, bx * w0, y0, bz * w0, 0.06);           // ring
      if (i % 2 === 0) bar(ax * w0, y0, az * w0, bx * w1, y1, bz * w1, 0.055); // diag
      else bar(bx * w0, y0, bz * w0, ax * w1, y1, az * w1, 0.055);
    }
  }
  return mergeGeometries(geos);
}

// Simple deterministic pseudo-random (so rebuilds look identical per seed).
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
