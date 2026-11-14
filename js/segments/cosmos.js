// Cosmos gallery — a dark hall where huge projection screens wash the walls
// with drifting nebulae and pixel-starbursts; shadowy pipes and machinery
// hang overhead, lit by a single headlamp glow far down the line.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { tunnelShell, portalRing, glowSprite, rng } from '../lib/helpers.js';

// Painted nebula projection: colored cloud blobs + pixel-block "data" specks.
function nebulaTexture(seedR, palette) {
  const w = 512, h = 256;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#020205';
  g.fillRect(0, 0, w, h);
  // soft cloud cores
  for (let i = 0; i < 26; i++) {
    const col = palette[Math.floor(seedR() * palette.length)];
    const x = seedR() * w, y = seedR() * h, r = 14 + seedR() * 66;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, col.replace('A', (0.35 + seedR() * 0.3).toFixed(2)));
    grad.addColorStop(1, col.replace('A', '0'));
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // pixel-glitch specks (the projected "data dust" look)
  for (let i = 0; i < 420; i++) {
    const col = palette[Math.floor(seedR() * palette.length)];
    g.fillStyle = col.replace('A', (0.3 + seedR() * 0.7).toFixed(2));
    const s = seedR() < 0.85 ? 1 + seedR() * 2 : 3 + seedR() * 4;
    g.fillRect(seedR() * w, seedR() * h, s, s * (seedR() < 0.3 ? 3 : 1));
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export default function cosmos({ length = 230, seed = 83 } = {}) {
  return {
    id: `cosmos-${seed}`,
    name: 'Cosmos Gallery',
    length,
    env: {
      fog: 0x030308, density: 0.030,
      skyTop: 0x010104, skyBot: 0x030308,
      sun: 0, ambient: 0.07, ambientColor: 0x6677ff,
      },
    audio: { drone: 0.65, pad: 0.4, bells: 0.28, chant: 0.4, wind: 0, bright: 0.3 },

    build() {
      const g = new THREE.Group();
      const r = rng(seed * 733);
      g.add(tunnelShell({ length, radius: 9, color: 0x020206 }));

      const mouthA = portalRing(0x8899ff, 5.4); mouthA.position.z = -2; g.add(mouthA);
      const mouthB = portalRing(0x8899ff, 5.4); mouthB.position.z = -(length - 2); g.add(mouthB);

      const cool = ['rgba(120,80,255,A)', 'rgba(60,160,255,A)', 'rgba(255,90,200,A)', 'rgba(220,220,255,A)'];
      const fire = ['rgba(255,170,60,A)', 'rgba(255,110,40,A)', 'rgba(255,220,150,A)', 'rgba(255,60,80,A)'];

      // projection screens angled along both walls, like a gallery corridor
      const screens = [];
      for (let z = 16; z < length - 14; z += 24) {
        const idx = Math.floor(z / 24);
        const palette = idx % 3 === 2 ? fire : cool;
        const tex = nebulaTexture(r, palette);
        for (const side of [-1, 1]) {
          if (r() < 0.25) continue;               // leave dark gaps
          const wPlane = 14 + r() * 6;
          const m = new THREE.Mesh(
            new THREE.PlaneGeometry(wPlane, 5.6),
            new THREE.MeshBasicMaterial({
              map: tex, transparent: true, opacity: 0.85,
              blending: THREE.AdditiveBlending, depthWrite: false,
            })
          );
          m.position.set(side * (6.2 + r() * 1.2), 2.4, -z - r() * 6);
          m.rotation.y = side * (-Math.PI / 2 + (r() - 0.5) * 0.3);
          screens.push({ m, tex, ph: r() * 6, drift: 0.004 + r() * 0.01 });
          g.add(m);
        }
      }

      // overhead pipes & conduit silhouettes (barely-lit machinery)
      const pipeGeos = [];
      for (let i = 0; i < 16; i++) {
        const rad = 0.12 + r() * 0.25;
        const len = 20 + r() * 50;
        const p = new THREE.CylinderGeometry(rad, rad, len, 6);
        p.rotateX(Math.PI / 2);
        p.translate((r() - 0.5) * 8, 5.2 + r() * 2.2, -r() * length);
        pipeGeos.push(p);
        if (r() < 0.5) {
          const box = new THREE.BoxGeometry(0.8 + r(), 0.5, 1.5 + r() * 2);
          box.translate((r() - 0.5) * 7, 5.6 + r() * 1.6, -r() * length);
          pipeGeos.push(box);
        }
      }
      g.add(new THREE.Mesh(mergeGeometries(pipeGeos),
        new THREE.MeshLambertMaterial({ color: 0x3a4152 })));

      // lone headlamp far down the line + a few dim service lamps
      const lamp = glowSprite(0xfff4dd, 4, 0.9);
      lamp.position.set(0.8, 4.8, -length * 0.62);
      g.add(lamp);
      for (let i = 0; i < 4; i++) {
        const s = glowSprite(0x99aaff, 1.6, 0.35);
        s.position.set((r() - 0.5) * 6, 5.4, -r() * length);
        g.add(s);
      }

      // streaming spark particles (the golden spray in the projections)
      const n = 200;
      const pos = new Float32Array(n * 3);
      const spd = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = (r() - 0.5) * 15;
        pos[i * 3 + 1] = 0.5 + r() * 5.5;
        pos[i * 3 + 2] = -r() * length;
        spd[i] = 1.2 + r() * 3.5;
      }
      const pgeo = new THREE.BufferGeometry();
      pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const sparks = new THREE.Points(pgeo, new THREE.PointsMaterial({
        color: 0xffcf88, size: 0.09, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      g.add(sparks);

      return {
        group: g,
        update(t, dt) {
          for (const s of screens) {
            s.tex.offset.x += s.drift * dt;
            s.m.material.opacity = 0.6 + 0.3 * Math.sin(t * 0.35 + s.ph);
          }
          lamp.material.opacity = 0.75 + 0.2 * Math.sin(t * 2.3) * Math.sin(t * 0.7);
          const a = pgeo.attributes.position.array;
          for (let i = 0; i < n; i++) {
            a[i * 3] += spd[i] * dt * 0.4;
            if (a[i * 3] > 8) a[i * 3] = -8;
          }
          pgeo.attributes.position.needsUpdate = true;
        },
      };
    },
  };
}
