// Liquid grotto — clusters of glowing amber/magenta liquid columns in a wide
// dark chamber, bubbles rising, molten pools pulsing on the floor.
import * as THREE from 'three';
import { tunnelShell, portalRing, glowSprite, liquidTexture, rng } from '../lib/helpers.js';

export default function liquid({ length = 220, seed = 41 } = {}) {
  return {
    id: `liquid-${seed}`,
    name: 'Liquid Grotto',
    length,
    env: {
      fog: 0x160709, density: 0.026,
      skyTop: 0x0c0406, skyBot: 0x160709,
      sun: 0, ambient: 0.1, ambientColor: 0xff9a5a,
    },
    audio: { drone: 0.6, pad: 0.45, bells: 0.18, chant: 0.5, wind: 0, bright: 0.38 },

    build() {
      const g = new THREE.Group();
      const r = rng(seed * 509);
      g.add(tunnelShell({ length, radius: 10, color: 0x0a0506 }));

      const mouthA = portalRing(0xff9a5a, 5.6); mouthA.position.z = -2; g.add(mouthA);
      const mouthB = portalRing(0xff9a5a, 5.6); mouthB.position.z = -(length - 2); g.add(mouthB);

      // floor
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(18, length),
        new THREE.MeshBasicMaterial({ color: 0x120808 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(0, -1.1, -length / 2);
      g.add(floor);

      const texAmber = liquidTexture(
        [[0, 'rgba(255,196,90,0.95)'], [0.5, 'rgba(255,110,60,0.9)'], [1, 'rgba(210,40,80,0.95)']],
        'rgba(255,240,200,0.55)');
      const texRose = liquidTexture(
        [[0, 'rgba(255,150,190,0.95)'], [0.5, 'rgba(220,60,140,0.9)'], [1, 'rgba(120,30,160,0.95)']],
        'rgba(255,220,240,0.5)');
      const texUV = liquidTexture(
        [[0, 'rgba(120,255,170,0.95)'], [0.5, 'rgba(40,200,220,0.9)'], [1, 'rgba(40,90,255,0.95)']],
        'rgba(210,255,230,0.5)');
      const textures = [texAmber, texRose, texUV];

      // column clusters
      const columns = [];
      for (let z = 24; z < length - 18; z += 34) {
        const side = (Math.floor(z / 34) % 2) ? -1 : 1;
        const cx = side * (5.2 + r() * 1.6);
        const count = 4 + Math.floor(r() * 4);
        for (let i = 0; i < count; i++) {
          const h = 1.6 + r() * 3.8;
          const rad = 0.35 + r() * 0.5;
          const tex = textures[Math.floor(r() * textures.length)].clone();
          tex.needsUpdate = true;
          tex.repeat.set(1, h / 3);
          const mat = new THREE.MeshBasicMaterial({
            map: tex, transparent: true, opacity: 0.92,
            blending: THREE.AdditiveBlending, depthWrite: false,
          });
          const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, h, 14, 1, true), mat);
          m.position.set(cx + (r() - 0.5) * 3.2, -1.1 + h / 2, -z + (r() - 0.5) * 7);
          columns.push({ m, tex, speed: 0.02 + r() * 0.05 });
          g.add(m);
          // cap glow
          const cap = glowSprite(0xffd9a8, rad * 4.5, 0.5);
          cap.position.set(m.position.x, -1.1 + h + 0.2, m.position.z);
          g.add(cap);
        }
        // overhead lamp above each cluster
        const lamp = glowSprite(0xdfe8ff, 7, 0.8);
        lamp.position.set(cx, 6.5, -z);
        g.add(lamp);
      }

      // molten pools on the floor
      const pools = [];
      for (let i = 0; i < 9; i++) {
        const rad = 1 + r() * 2.4;
        const m = new THREE.Mesh(
          new THREE.CircleGeometry(rad, 26),
          new THREE.MeshBasicMaterial({
            color: i % 2 ? 0xff6a2a : 0xff2a66, transparent: true, opacity: 0.5,
            blending: THREE.AdditiveBlending, depthWrite: false,
          })
        );
        m.rotation.x = -Math.PI / 2;
        m.position.set((r() - 0.5) * 10, -1.05, -10 - r() * (length - 24));
        pools.push({ m, ph: r() * 6 });
        g.add(m);
      }

      // rising bubble particles
      const n = 240;
      const pos = new Float32Array(n * 3);
      const vel = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = (r() - 0.5) * 14;
        pos[i * 3 + 1] = -1 + r() * 7;
        pos[i * 3 + 2] = -r() * length;
        vel[i] = 0.2 + r() * 0.6;
      }
      const pgeo = new THREE.BufferGeometry();
      pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(pgeo, new THREE.PointsMaterial({
        color: 0xffc9a0, size: 0.14, transparent: true, opacity: 0.8,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      g.add(pts);

      return {
        group: g,
        update(t, dt) {
          for (const c of columns) c.tex.offset.y -= c.speed * dt;
          for (const p of pools) {
            p.m.material.opacity = 0.32 + 0.25 * Math.sin(t * 0.7 + p.ph);
            const s = 1 + 0.08 * Math.sin(t * 0.5 + p.ph * 2);
            p.m.scale.set(s, s, 1);
          }
          const a = pgeo.attributes.position.array;
          for (let i = 0; i < n; i++) {
            a[i * 3 + 1] += vel[i] * dt;
            if (a[i * 3 + 1] > 7) a[i * 3 + 1] = -1;
          }
          pgeo.attributes.position.needsUpdate = true;
        },
      };
    },
  };
}
