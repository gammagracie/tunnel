// Neon lattice tunnel — electric violet-white diamond geometry on dark walls,
// inspired by the LED lattice corridor footage.
import * as THREE from 'three';
import { tunnelShell, portalRing, neonBars, glowSprite, rng } from '../lib/helpers.js';

export default function neon({ length = 220, seed = 11 } = {}) {
  return {
    id: `neon-${seed}`,
    name: 'Neon Lattice',
    length,
    env: {
      fog: 0x0b0718, density: 0.028,
      skyTop: 0x060412, skyBot: 0x0b0718,
      sun: 0, ambient: 0.12, ambientColor: 0x8f7bff,
    },
    audio: { drone: 0.5, pad: 0.4, bells: 0.4, chant: 0.18, wind: 0.08, bright: 0.6 },

    build() {
      const g = new THREE.Group();
      const r = rng(seed * 313);
      g.add(tunnelShell({ length, radius: 6.5, color: 0x07060e }));

      const mouthA = portalRing(0xb9a4ff); mouthA.position.z = -2; g.add(mouthA);
      const mouthB = portalRing(0xb9a4ff); mouthB.position.z = -(length - 2); g.add(mouthB);

      // Diamond/X lattice panels on both walls, two phase groups for pulsing.
      const groupsBars = [[], []];
      const wallX = 5.0;
      for (let z = 14; z < length - 10; z += 13) {
        const phase = Math.floor(z / 13) % 2;
        for (const side of [-1, 1]) {
          const x = side * wallX;
          const zz = -z, h = 2.6, w = 5.2;
          const y0 = 0.4, y1 = y0 + h, ym = (y0 + y1) / 2;
          const bars = [
            // X
            { from: [x, y0, zz - w / 2], to: [x, y1, zz + w / 2] },
            { from: [x, y1, zz - w / 2], to: [x, y0, zz + w / 2] },
            // diamond
            { from: [x, ym, zz - w / 2], to: [x, y1 + 0.9, zz] },
            { from: [x, y1 + 0.9, zz], to: [x, ym, zz + w / 2] },
            { from: [x, ym, zz + w / 2], to: [x, y0 - 0.9, zz] },
            { from: [x, y0 - 0.9, zz], to: [x, ym, zz - w / 2] },
          ];
          if (r() > 0.5) bars.push(
            { from: [x, y0 - 1.6, zz - w / 2], to: [x, y1 + 1.6, zz + w / 2] });
          groupsBars[phase].push(...bars);
        }
      }
      const latA = neonBars(groupsBars[0], 0xcbb8ff, 0.95);
      const latB = neonBars(groupsBars[1], 0xeae2ff, 0.95);
      g.add(latA, latB);

      // ceiling runner lights
      const runner = [];
      for (let z = 8; z < length - 6; z += 6.5) {
        runner.push({ from: [-0.6, 5.6, -z], to: [0.6, 5.6, -z - 3.2], thick: 0.05 });
      }
      g.add(neonBars(runner, 0x8f7bff, 0.8));

      // sparse hovering glow orbs
      const orbs = [];
      for (let i = 0; i < 10; i++) {
        const s = glowSprite(i % 2 ? 0xb9a4ff : 0xffffff, 2 + r() * 2, 0.5);
        s.position.set((r() - 0.5) * 7, 1 + r() * 4, -r() * length);
        orbs.push({ s, ph: r() * 6 });
        g.add(s);
      }

      return {
        group: g,
        update(t) {
          latA.material.opacity = 0.62 + 0.38 * Math.sin(t * 1.1);
          latB.material.opacity = 0.62 + 0.38 * Math.sin(t * 1.1 + Math.PI);
          for (const o of orbs) {
            o.s.position.y += Math.sin(t * 0.8 + o.ph) * 0.004;
            o.s.material.opacity = 0.32 + 0.22 * Math.sin(t * 1.7 + o.ph);
          }
        },
      };
    },
  };
}
