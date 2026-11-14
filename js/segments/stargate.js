// Stargate — a colorful galaxy passage. You ride THROUGH a dense nebula of
// drifting colored specks while dandelion/jellyfish light-blooms open around
// you and slow rainbow rings sweep down the tube. Inspired by projected
// galaxy-bloom dark-ride footage: immersive, not screens on walls.
import * as THREE from 'three';
import { tunnelShell, tunnelRibs, portalRing, glowSprite, sharedGlow, rng } from '../lib/helpers.js';

// A "bloom": radial filament burst (like a dandelion seed head / jellyfish)
// built from line segments + a glowing core sprite.
function makeBloom(r, color) {
  const g = new THREE.Group();
  const rays = 26 + Math.floor(r() * 22);
  const rad = 1.1 + r() * 2.2;
  const pos = new Float32Array(rays * 6);
  for (let i = 0; i < rays; i++) {
    const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
    const dx = Math.sin(ph) * Math.cos(th), dy = Math.sin(ph) * Math.sin(th), dz = Math.cos(ph);
    const inner = rad * (0.15 + r() * 0.15);
    pos[i * 6 + 0] = dx * inner; pos[i * 6 + 1] = dy * inner; pos[i * 6 + 2] = dz * inner;
    pos[i * 6 + 3] = dx * rad; pos[i * 6 + 4] = dy * rad; pos[i * 6 + 5] = dz * rad;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
    color, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  g.add(lines);
  const core = glowSprite(color, rad * 1.5, 0.8);
  g.add(core);
  // seed tips: tiny points at ray ends
  const tips = new Float32Array(rays * 3);
  for (let i = 0; i < rays; i++) {
    tips[i * 3] = pos[i * 6 + 3]; tips[i * 3 + 1] = pos[i * 6 + 4]; tips[i * 3 + 2] = pos[i * 6 + 5];
  }
  const tgeo = new THREE.BufferGeometry();
  tgeo.setAttribute('position', new THREE.BufferAttribute(tips, 3));
  g.add(new THREE.Points(tgeo, new THREE.PointsMaterial({
    map: sharedGlow(), color: 0xffffff, size: 0.22, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })));
  return { g, lines, core };
}

export default function stargate({ length = 240, seed = 311 } = {}) {
  return {
    id: `stargate-${seed}`,
    name: 'Stargate',
    length,
    env: {
      fog: 0x05030c, density: 0.026,
      skyTop: 0x020108, skyBot: 0x05030c,
      sun: 0, ambient: 0.08, ambientColor: 0x9a7bff,
    },
    audio: { drone: 0.5, pad: 0.6, bells: 0.5, chant: 0.35, wind: 0, bright: 0.8, melody: 0.5 },

    build() {
      const g = new THREE.Group();
      const r = rng(seed * 617);
      g.add(tunnelShell({ length, radius: 12, color: 0x030209 }));
      g.add(tunnelRibs({ length, radius: 12, step: 16, color: 0x17102e }));

      const mouthA = portalRing(0xcf9bff, 5.6); mouthA.position.z = -2; g.add(mouthA);
      const mouthB = portalRing(0xcf9bff, 5.6); mouthB.position.z = -(length - 2); g.add(mouthB);

      const PALETTE = [0xff8c4a, 0xffd36b, 0x7bffb0, 0x66c9ff, 0xcf7bff, 0xff6bd0, 0xf2f2ff];

      // ---- the nebula: thousands of colored specks filling the tube volume
      const N = 3400;
      const pos = new Float32Array(N * 3);
      const col = new Float32Array(N * 3);
      const drift = new Float32Array(N * 2);           // per-point phase, rate
      const c = new THREE.Color();
      for (let i = 0; i < N; i++) {
        const a = r() * Math.PI * 2;
        const rad = 2.2 + Math.pow(r(), 0.6) * 9;      // keep a loose clear bore
        pos[i * 3] = Math.cos(a) * rad;
        pos[i * 3 + 1] = Math.sin(a) * rad * 0.8 + 2;
        pos[i * 3 + 2] = -r() * length;
        c.set(PALETTE[Math.floor(r() * PALETTE.length)]);
        const dim = 0.55 + r() * 0.45;
        col[i * 3] = c.r * dim; col[i * 3 + 1] = c.g * dim; col[i * 3 + 2] = c.b * dim;
        drift[i * 2] = r() * Math.PI * 2;
        drift[i * 2 + 1] = 0.2 + r() * 0.8;
      }
      const pgeo = new THREE.BufferGeometry();
      pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      pgeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const dust = new THREE.Points(pgeo, new THREE.PointsMaterial({
        map: sharedGlow(), vertexColors: true, size: 0.26,
        transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      g.add(dust);
      const base = pos.slice();                         // for drift animation

      // ---- light blooms scattered through the passage
      const blooms = [];
      for (let z = 14; z < length - 10; z += 11 + r() * 9) {
        const color = PALETTE[Math.floor(r() * PALETTE.length)];
        const b = makeBloom(r, color);
        const a = r() * Math.PI * 2;
        const rad = 3.6 + r() * 5.5;
        b.g.position.set(Math.cos(a) * rad, Math.sin(a) * rad * 0.75 + 2.4, -z);
        b.ph = r() * Math.PI * 2;
        b.rate = 0.25 + r() * 0.5;
        b.spin = (r() - 0.5) * 0.3;
        blooms.push(b);
        g.add(b.g);
      }

      // ---- slow rainbow gate-rings sweeping down the tube
      const rings = [];
      for (let i = 0; i < 7; i++) {
        const ring = portalRing(PALETTE[i % PALETTE.length], 7.5 + (i % 3) * 0.8, 0.07);
        ring.material.opacity = 0.35;
        ring.position.set(0, 2, -r() * length);
        ring.v = 3 + r() * 5;
        rings.push(ring);
        g.add(ring);
      }

      return {
        group: g,
        update(t, dt) {
          // nebula drift: gentle per-point orbit
          const a = pgeo.attributes.position.array;
          const n = Math.min(N, 900);                   // animate a subset/frame budget
          const off = (Math.floor(t * 60) % 3) * n;     // rotate through thirds
          for (let k = 0; k < n; k++) {
            const i = (off + k) % N;
            const ph = drift[i * 2] + t * drift[i * 2 + 1];
            a[i * 3] = base[i * 3] + Math.sin(ph) * 0.4;
            a[i * 3 + 1] = base[i * 3 + 1] + Math.cos(ph * 0.8) * 0.3;
          }
          pgeo.attributes.position.needsUpdate = true;
          for (const b of blooms) {
            const pulse = 0.6 + 0.4 * Math.sin(t * b.rate + b.ph);
            b.lines.material.opacity = 0.25 + pulse * 0.45;
            b.core.material.opacity = 0.35 + pulse * 0.55;
            b.g.rotation.y += b.spin * dt;
            b.g.rotation.z += b.spin * 0.6 * dt;
          }
          for (const ring of rings) {
            ring.position.z += ring.v * dt;
            if (ring.position.z > 0) ring.position.z -= length;
            ring.rotation.z += dt * 0.2;
          }
        },
      };
    },
  };
}
