// Light cathedral — tall golden arches, shafts of heavenly light falling
// through haze, motes drifting. The brightest, most chant-heavy room.
import * as THREE from 'three';
import { tunnelShell, portalRing, glowSprite, gradientTexture, rng } from '../lib/helpers.js';

export default function cathedral({ length = 240, seed = 67 } = {}) {
  return {
    id: `cathedral-${seed}`,
    name: 'Light Cathedral',
    length,
    env: {
      fog: 0x2a2114, density: 0.020,
      skyTop: 0x1a140a, skyBot: 0x2a2114,
      sun: 0, ambient: 0.35, ambientColor: 0xffe9b8,
    },
    audio: { drone: 0.32, pad: 0.6, bells: 0.3, chant: 0.8, wind: 0.04, bright: 1.0 },

    build() {
      const g = new THREE.Group();
      const r = rng(seed * 101);
      g.add(tunnelShell({ length, radius: 12, color: 0x0f0b06 }));

      const mouthA = portalRing(0xffd98a, 6); mouthA.position.set(0, 1.5, -2); g.add(mouthA);
      const mouthB = portalRing(0xffd98a, 6); mouthB.position.set(0, 1.5, -(length - 2)); g.add(mouthB);

      // golden arches marching down the nave
      const archMat = new THREE.MeshBasicMaterial({
        color: 0xffd98a, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const arches = [];
      for (let z = 8; z < length - 4; z += 14) {
        const arch = new THREE.Mesh(
          new THREE.TorusGeometry(7.2, 0.16, 10, 48, Math.PI), archMat.clone());
        arch.position.set(0, -0.5, -z);
        arches.push({ m: arch, ph: z * 0.11 });
        g.add(arch);
        // inner halo arch
        const halo = new THREE.Mesh(
          new THREE.TorusGeometry(6.4, 0.05, 8, 40, Math.PI), archMat.clone());
        halo.material.opacity = 0.4;
        halo.position.set(0, -0.5, -z);
        g.add(halo);
      }

      // god-ray shafts: tall additive gradient planes slanting down
      const shaftTex = gradientTexture([
        [0, 'rgba(255,240,200,0.55)'],
        [0.6, 'rgba(255,220,160,0.18)'],
        [1, 'rgba(255,220,160,0)'],
      ]);
      const shafts = [];
      for (let z = 18; z < length - 12; z += 22) {
        const w = 2.2 + r() * 2.4;
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(w, 14),
          new THREE.MeshBasicMaterial({
            map: shaftTex, transparent: true, opacity: 0.8,
            blending: THREE.AdditiveBlending, depthWrite: false,
            side: THREE.DoubleSide,
          })
        );
        m.position.set((r() - 0.5) * 7, 4.5, -z);
        m.rotation.z = (r() - 0.5) * 0.5;
        m.rotation.y = (r() - 0.5) * 0.8;
        shafts.push({ m, ph: r() * 6 });
        g.add(m);
        // source bloom at the top of each shaft
        const src = glowSprite(0xfff3d0, 5, 0.9);
        src.position.set(m.position.x, 11, -z);
        g.add(src);
      }

      // central high altar of light at the midpoint
      const altar = glowSprite(0xfff7e0, 18, 0.95);
      altar.position.set(0, 7, -length / 2);
      g.add(altar);

      // drifting motes
      const n = 320;
      const pos = new Float32Array(n * 3);
      const ph = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = (r() - 0.5) * 16;
        pos[i * 3 + 1] = -0.5 + r() * 11;
        pos[i * 3 + 2] = -r() * length;
        ph[i] = r() * 6.28;
      }
      const pgeo = new THREE.BufferGeometry();
      pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const motes = new THREE.Points(pgeo, new THREE.PointsMaterial({
        color: 0xffe9b8, size: 0.1, transparent: true, opacity: 0.75,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      g.add(motes);

      return {
        group: g,
        update(t, dt) {
          for (const a of arches) a.m.material.opacity = 0.6 + 0.3 * Math.sin(t * 0.4 + a.ph);
          for (const s of shafts) s.m.material.opacity = 0.5 + 0.3 * Math.sin(t * 0.3 + s.ph);
          altar.material.opacity = 0.8 + 0.15 * Math.sin(t * 0.25);
          const arr = pgeo.attributes.position.array;
          for (let i = 0; i < n; i++) {
            arr[i * 3] += Math.sin(t * 0.2 + ph[i]) * 0.003;
            arr[i * 3 + 1] += Math.cos(t * 0.15 + ph[i]) * 0.002 - dt * 0.05;
            if (arr[i * 3 + 1] < -0.5) arr[i * 3 + 1] = 10.5;
          }
          pgeo.attributes.position.needsUpdate = true;
        },
      };
    },
  };
}
