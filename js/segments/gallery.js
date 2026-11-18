// Night Gallery — a hushed museum passage. Framed artworks hang on both
// walls, each washed by its own warm picture lamp; the list of pieces lives
// in artworks.js (drop files into assets/art/ and name them there).
// Images load async; until then (or on failure) a painted placeholder hangs.
import * as THREE from 'three';
import { tunnelShell, tunnelRibs, portalRing, glowSprite, rng } from '../lib/helpers.js';
import { artworks } from './artworks.js';

// Soft abstract placeholder painting (unique per seed).
function placeholderTexture(r) {
  const w = 256, h = 192;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const hue = Math.floor(r() * 360);
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, `hsl(${hue},50%,26%)`);
  grad.addColorStop(1, `hsl(${(hue + 60) % 360},55%,42%)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 7; i++) {
    const x = r() * w, y = r() * h, rad = 12 + r() * 50;
    const gl = g.createRadialGradient(x, y, 0, x, y, rad);
    gl.addColorStop(0, `hsla(${(hue + 120 + r() * 120) % 360},80%,65%,0.5)`);
    gl.addColorStop(1, 'hsla(0,0%,0%,0)');
    g.fillStyle = gl;
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  return new THREE.CanvasTexture(c);
}

// Small etched plaque: title / artist.
function plaqueTexture(title, artist) {
  const w = 256, h = 64;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#17141f';
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(235,225,205,0.9)';
  g.font = 'italic 22px Georgia';
  g.textAlign = 'center';
  g.fillText(title, w / 2, 28, w - 16);
  g.font = '15px Georgia';
  g.fillStyle = 'rgba(235,225,205,0.55)';
  g.fillText(artist, w / 2, 50, w - 16);
  return new THREE.CanvasTexture(c);
}

// A cylindrical patch hugging the inside of the tunnel wall: the artwork's
// width runs along the direction of travel, its height curves with the wall.
// side: -1 left wall, +1 right wall. zc: centre z. CY: hanging height.
function curvedPanelGeometry(W, H, R, side, zc, segs = 20) {
  const CY = 2.6;
  const phiC = side > 0 ? Math.asin(CY / R) : Math.PI - Math.asin(CY / R);
  const dPhi = H / R;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const s = i / segs;                                // 0 bottom → 1 top
    const phi = phiC + side * (s - 0.5) * dPhi;
    for (let j = 0; j <= 1; j++) {
      pos.push(R * Math.cos(phi), R * Math.sin(phi), zc + side * (j - 0.5) * W);
      uv.push(j, s);
    }
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export default function gallery({ length = 0, seed = 203 } = {}) {
  const SPACING = 26;
  const autoLen = Math.max(140, artworks.length * SPACING + 40);
  const len = length || autoLen;
  return {
    id: `gallery-${seed}`,
    name: 'Night Gallery',
    length: len,
    env: {
      fog: 0x0a0810, density: 0.020,
      skyTop: 0x060510, skyBot: 0x0a0810,
      sun: 0, ambient: 0.3, ambientColor: 0xc9b89a,
    },
    audio: { drone: 0.45, pad: 0.5, bells: 0.3, chant: 0.25, wind: 0, bright: 0.5, melody: 0.3 },

    build() {
      const g = new THREE.Group();
      const r = rng(seed * 419);
      g.add(tunnelShell({ length: len, radius: 8, color: 0x070609 }));
      g.add(tunnelRibs({ length: len, radius: 8, step: 13, color: 0x191326 }));

      const mA = portalRing(0xd8c190, 5.4); mA.position.z = -2; g.add(mA);
      const mB = portalRing(0xd8c190, 5.4); mB.position.z = -(len - 2); g.add(mB);

      const loader = new THREE.TextureLoader();
      const lamps = [];
      artworks.forEach((art, i) => {
        const side = i % 2 === 0 ? -1 : 1;
        const z = -(28 + i * SPACING);
        const aspect = art.aspect || 1.4;
        // portraits hang tall, landscapes wide; curve radius just inside the wall
        const H = aspect >= 1 ? 4.6 : 5.4;
        const W = Math.min(7.5, H * aspect);

        // curved backing frame, a hair behind the canvas
        const frame = new THREE.Mesh(
          curvedPanelGeometry(W + 0.5, H + 0.55, 7.35, side, z),
          new THREE.MeshLambertMaterial({
            color: 0x4a3b22, emissive: 0x241c0e, emissiveIntensity: 0.4,
            side: THREE.DoubleSide,
          })
        );
        g.add(frame);

        // curved canvas — placeholder now, real image swapped in when it loads
        const mat = new THREE.MeshBasicMaterial({
          map: placeholderTexture(r), side: THREE.DoubleSide,
        });
        g.add(new THREE.Mesh(curvedPanelGeometry(W, H, 7.1, side, z), mat));
        if (art.src) loader.load(art.src, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          mat.map = tex;
          mat.needsUpdate = true;
        });

        // plaque beneath the bottom edge
        const plaque = new THREE.Mesh(
          new THREE.PlaneGeometry(2.1, 0.5),
          new THREE.MeshBasicMaterial({ map: plaqueTexture(art.title, art.artist), transparent: true })
        );
        plaque.position.set(side * 6.55, Math.max(-0.2, 2.6 - H / 2 - 0.55), z);
        plaque.rotation.y = -side * Math.PI / 2;
        g.add(plaque);

        // picture lamp: warm glow above the frame + light pool on the canvas
        const lamp = glowSprite(0xffe2b0, 1.8, 0.85);
        lamp.position.set(side * 5.4, 2.6 + H / 2 + 1.0, z);
        lamps.push({ lamp, ph: r() * 6 });
        g.add(lamp);
        const pool = glowSprite(0xffe8c8, 6.4, 0.3);
        pool.position.set(side * 5.9, 2.6, z);
        g.add(pool);
      });

      // a bench silhouette mid-gallery and drifting dust in the lamplight
      const bench = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.18, 0.7),
        new THREE.MeshLambertMaterial({ color: 0x241d2e })
      );
      bench.position.set(0, -0.4, -len / 2);
      g.add(bench);

      const DN = 120;
      const dpos = new Float32Array(DN * 3);
      for (let i = 0; i < DN; i++) {
        dpos[i * 3] = (r() - 0.5) * 12;
        dpos[i * 3 + 1] = r() * 6;
        dpos[i * 3 + 2] = -r() * len;
      }
      const dgeo = new THREE.BufferGeometry();
      dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
      const dust = new THREE.Points(dgeo, new THREE.PointsMaterial({
        color: 0xd8c9a8, size: 0.035, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      g.add(dust);

      return {
        group: g,
        update(t, dt) {
          for (const l of lamps)
            l.lamp.material.opacity = 0.75 + 0.1 * Math.sin(t * 1.3 + l.ph);
          const a = dgeo.attributes.position.array;
          for (let i = 0; i < DN; i++) {
            a[i * 3 + 1] -= dt * 0.12;
            if (a[i * 3 + 1] < 0) a[i * 3 + 1] = 6;
          }
          dgeo.attributes.position.needsUpdate = true;
        },
      };
    },
  };
}
