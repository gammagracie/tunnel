// Mirror hall — a real reflective floor doubles columns of cool light into
// an infinity well; slow drifting orbs hang in the dark.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { tunnelShell, tunnelRibs, portalRing, neonBars, glowSprite, rng } from '../lib/helpers.js';

export default function mirror({ length = 200, seed = 23 } = {}) {
  return {
    id: `mirror-${seed}`,
    name: 'Mirror Hall',
    length,
    env: {
      fog: 0x04131a, density: 0.030,
      skyTop: 0x020a10, skyBot: 0x04131a,
      sun: 0, ambient: 0.1, ambientColor: 0x9fe8ff,
    },
    audio: { drone: 0.4, pad: 0.5, bells: 0.5, chant: 0.32, wind: 0.04, bright: 0.78, melody: 0.4 },

    build() {
      const g = new THREE.Group();
      const r = rng(seed * 877);
      g.add(tunnelShell({ length, radius: 7, color: 0x030a0e }));
      g.add(tunnelRibs({ length, radius: 7, step: 11, color: 0x0e2630 }));

      const mouthA = portalRing(0x9fe8ff, 5.4); mouthA.position.z = -2; g.add(mouthA);
      const mouthB = portalRing(0x9fe8ff, 5.4); mouthB.position.z = -(length - 2); g.add(mouthB);

      // true mirror floor
      const refl = new Reflector(new THREE.PlaneGeometry(11, length), {
        clipBias: 0.003,
        textureWidth: 512,
        textureHeight: 512,
        color: 0x668899,
      });
      refl.rotation.x = -Math.PI / 2;
      refl.position.set(0, -1.05, -length / 2);
      g.add(refl);

      // vertical light columns down both walls — these double in the mirror
      const bars = [];
      for (let z = 12; z < length - 8; z += 9) {
        for (const side of [-1, 1]) {
          const jitter = (r() - 0.5) * 2.4;
          bars.push({
            from: [side * 4.6, -1, -z + jitter],
            to: [side * 4.6, 5.4, -z + jitter],
            thick: 0.09,
          });
        }
      }
      const cols = neonBars(bars, 0xcff4ff, 0.9);
      g.add(cols);

      // slanted accent bars, warmer tint
      const acc = [];
      for (let z = 20; z < length - 12; z += 27) {
        const side = (Math.floor(z / 27) % 2) ? -1 : 1;
        acc.push({ from: [side * 4.5, 0, -z], to: [side * 4.5, 4.6, -z - 6], thick: 0.07 });
        acc.push({ from: [side * 4.5, 4.6, -z], to: [side * 4.5, 0, -z - 6], thick: 0.07 });
      }
      const accM = neonBars(acc, 0xbcA0ff, 0.75);
      g.add(accM);

      // floating orbs just above the mirror, mirrored below
      const orbs = [];
      for (let i = 0; i < 14; i++) {
        const s = glowSprite(i % 3 === 0 ? 0xffffff : 0x9fe8ff, 1.2 + r() * 1.8, 0.55);
        s.position.set((r() - 0.5) * 7.5, -0.2 + r() * 3.4, -8 - r() * (length - 16));
        orbs.push({ s, ph: r() * 6, y: s.position.y });
        g.add(s);
      }

      return {
        group: g,
        update(t) {
          cols.material.opacity = 0.72 + 0.22 * Math.sin(t * 0.55);
          accM.material.opacity = 0.45 + 0.3 * Math.sin(t * 0.8 + 1.3);
          for (const o of orbs) {
            o.s.position.y = o.y + Math.sin(t * 0.45 + o.ph) * 0.5;
            o.s.material.opacity = 0.35 + 0.25 * Math.sin(t * 1.2 + o.ph * 2);
          }
        },
      };
    },
  };
}
