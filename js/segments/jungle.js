// Jungle — a deep rainforest passage. The track runs beneath a dense canopy:
// layered leaf silhouettes close overhead, hanging vines brush past, green
// god-rays slant through gaps, bioluminescent flowers glow in the understory
// and fireflies drift everywhere. Misty, humid, alive.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { glowSprite, sharedGlow, gradientTexture, rng } from '../lib/helpers.js';

// Painted frond/leaf-cluster texture on transparent canvas.
function frondTexture(r, fill) {
  const w = 256, h = 256;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.translate(w / 2, h);
  g.fillStyle = fill;
  for (let i = 0; i < 9; i++) {                       // fan of long leaves
    const a = -Math.PI / 2 + (i - 4) * 0.28 + (r() - 0.5) * 0.1;
    const len = h * (0.55 + r() * 0.4);
    g.save();
    g.rotate(a + Math.PI / 2);
    g.beginPath();
    g.ellipse(0, -len / 2, 10 + r() * 9, len / 2, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;   // keep the painted greens dark
  return t;
}

export default function jungle({ length = 230, seed = 47 } = {}) {
  return {
    id: `jungle-${seed}`,
    name: 'Deep Jungle',
    length,
    env: {
      fog: 0x0c2416, density: 0.021,
      skyTop: 0x1c4a2a, skyBot: 0x3f7a3c,
      sun: 0.12, ambient: 0.5, ambientColor: 0x7fb573,
    },
    audio: { drone: 0.3, pad: 0.4, bells: 0.45, chant: 0.15, wind: 0.5, bright: 0.55, melody: 0.35 },

    build() {
      const g = new THREE.Group();
      const r = rng(seed * 991);

      // ground far below (we're suspended) — dark undergrowth
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(260, length + 30),
        new THREE.MeshLambertMaterial({ color: 0x08150c })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(0, -20, -length / 2);
      g.add(ground);

      // canopy ceiling: big dark leaf planes overlapping just above the cab
      const canopyTex = frondTexture(r, 'rgba(8,30,16,0.96)');
      const canopyTex2 = frondTexture(r, 'rgba(14,44,22,0.92)');
      const canopyMat = (tex) => new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      });
      for (let z = 0; z < length; z += 7) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(16 + r() * 10, 16 + r() * 10),
          canopyMat(r() < 0.5 ? canopyTex : canopyTex2));
        m.position.set((r() - 0.5) * 14, 7.5 + r() * 4, -z - r() * 6);
        m.rotation.set(-Math.PI / 2 + (r() - 0.5) * 0.7, r() * Math.PI, 0);
        g.add(m);
      }

      // wall foliage: frond fans crowding both sides (closer than other rooms —
      // the jungle presses in)
      const wallTexA = frondTexture(r, 'rgba(16,52,26,0.95)');
      const wallTexB = frondTexture(r, 'rgba(24,70,34,0.9)');
      for (let z = 4; z < length; z += 6) {
        for (const side of [-1, 1]) {
          if (r() < 0.3) continue;
          const s = 6 + r() * 8;
          const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s),
            canopyMat(r() < 0.5 ? wallTexA : wallTexB));
          m.position.set(side * (5.2 + r() * 5), -1 + r() * 7, -z);
          m.rotation.y = -side * (Math.PI / 2) + (r() - 0.5) * 0.9;
          m.rotation.z = (r() - 0.5) * 0.8;
          g.add(m);
        }
      }

      // hanging vines: thin dark cylinders at varying depths, some close enough
      // to whip past the canopy edge
      const vineGeos = [];
      for (let i = 0; i < 90; i++) {
        const len = 3 + r() * 9;
        const v = new THREE.CylinderGeometry(0.02 + r() * 0.035, 0.015, len, 4);
        const side = r() < 0.5 ? -1 : 1;
        v.translate(side * (1.8 + r() * 7), 9 - len / 2 - r() * 2, -r() * length);
        vineGeos.push(v);
      }
      g.add(new THREE.Mesh(mergeGeometries(vineGeos),
        new THREE.MeshLambertMaterial({ color: 0x1a3320 })));

      // god-rays slanting through canopy gaps
      const rayTex = gradientTexture([
        [0, 'rgba(220,255,190,0.0)'], [0.25, 'rgba(210,255,180,0.28)'],
        [0.8, 'rgba(190,240,160,0.06)'], [1, 'rgba(190,240,160,0)'],
      ]);
      const rays = [];
      for (let z = 18; z < length - 10; z += 26 + r() * 18) {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(2.2 + r() * 2.5, 22),
          new THREE.MeshBasicMaterial({
            map: rayTex, transparent: true, depthWrite: false,
            blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
          })
        );
        m.position.set((r() - 0.5) * 10, 0, -z);
        m.rotation.z = 0.3 + r() * 0.25;
        m.rotation.y = r() * Math.PI;
        rays.push({ m, ph: r() * 6 });
        g.add(m);
      }

      // bioluminescent flowers in the understory (teal / magenta glows)
      const flowers = [];
      for (let i = 0; i < 46; i++) {
        const color = r() < 0.6 ? 0x3fe8c8 : 0xe86bd8;
        const s = glowSprite(color, 0.5 + r() * 0.9, 0.8);
        const side = r() < 0.5 ? -1 : 1;
        s.position.set(side * (3 + r() * 8), -2 - r() * 10, -r() * length);
        flowers.push({ s, ph: r() * 6, rate: 0.4 + r() * 0.8 });
        g.add(s);
      }

      // fireflies: small warm points drifting through the corridor
      const FN = 260;
      const fpos = new Float32Array(FN * 3);
      const fph = new Float32Array(FN * 2);
      for (let i = 0; i < FN; i++) {
        fpos[i * 3] = (r() - 0.5) * 14;
        fpos[i * 3 + 1] = -2 + r() * 9;
        fpos[i * 3 + 2] = -r() * length;
        fph[i * 2] = r() * Math.PI * 2;
        fph[i * 2 + 1] = 0.5 + r();
      }
      const fgeo = new THREE.BufferGeometry();
      fgeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
      const fireflies = new THREE.Points(fgeo, new THREE.PointsMaterial({
        map: sharedGlow(), color: 0xd8ff9a, size: 0.14,
        transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      g.add(fireflies);
      const fbase = fpos.slice();

      // low mist layer drifting between the trunks
      const mist = [];
      for (let i = 0; i < 12; i++) {
        const s = glowSprite(0x9fd8a8, 8 + r() * 9, 0.05);
        s.position.set((r() - 0.5) * 16, -4 - r() * 6, -r() * length);
        mist.push({ s, v: 0.2 + r() * 0.3 });
        g.add(s);
      }

      return {
        group: g,
        update(t, dt) {
          for (const f of flowers)
            f.s.material.opacity = 0.4 + 0.45 * Math.sin(t * f.rate + f.ph);
          for (const ry of rays)
            ry.m.material.opacity = 0.65 + 0.3 * Math.sin(t * 0.3 + ry.ph);
          const a = fgeo.attributes.position.array;
          for (let i = 0; i < FN; i++) {
            const ph = fph[i * 2] + t * fph[i * 2 + 1];
            a[i * 3] = fbase[i * 3] + Math.sin(ph) * 0.8;
            a[i * 3 + 1] = fbase[i * 3 + 1] + Math.sin(ph * 0.7 + 1) * 0.5;
          }
          fgeo.attributes.position.needsUpdate = true;
          for (const m of mist) {
            m.s.position.x += m.v * dt;
            if (m.s.position.x > 10) m.s.position.x = -10;
          }
        },
      };
    },
  };
}
