// Mars Overlook — the rail crosses a Martian desert under a butterscotch
// sky: rust terrain, scattered boulders, mesas dissolving into dust-haze,
// and NASA's newest Mars surface photographs standing in the landscape as
// giant illuminated steles, each with a caption plaque.
// Images: assets/mars/ (NASA/JPL-Caltech, public domain — see captions).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { glowSprite, sharedGlow, rng } from '../lib/helpers.js';

// The exhibition. aspect = width/height of the source file.
const PHOTOS = [
  { src: 'assets/mars/PIA26727.jpg', aspect: 952 / 1280,
    title: 'Martian Sulfur Crystals', note: 'Curiosity · 2026 · NASA/JPL-Caltech' },
  { src: 'assets/mars/PIA26680.jpg', aspect: 1920 / 1080,
    title: 'Postcard from Mount Sharp', note: 'Curiosity · boxwork region · NASA/JPL-Caltech' },
  { src: 'assets/mars/PIA26559.jpg', aspect: 1920 / 507,
    title: 'Boxwork Patterns in 360°', note: 'Curiosity · Gale Crater · NASA/JPL-Caltech' },
  { src: 'assets/mars/PIA26695.jpg', aspect: 1280 / 1141,
    title: "'Nevado Sajama' at Night", note: 'Curiosity, lit by rover lamp · NASA/JPL-Caltech' },
  { src: 'assets/mars/PIA26644.jpg', aspect: 1920 / 469,
    title: "Perseverance at 'Falbreen'", note: 'Jezero Crater rim · NASA/JPL-Caltech' },
  { src: 'assets/mars/PIA26671.jpg', aspect: 1920 / 192,
    title: 'Ancient River Channel', note: "Curiosity views Gale's rim · NASA/JPL-Caltech" },
];

function plaqueTexture(title, note) {
  const w = 512, h = 72;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#241410';
  g.fillRect(0, 0, w, h);
  g.textAlign = 'center';
  g.fillStyle = 'rgba(255,224,196,0.92)';
  g.font = 'italic 26px Georgia';
  g.fillText(title, w / 2, 32, w - 20);
  g.font = '17px Georgia';
  g.fillStyle = 'rgba(255,224,196,0.55)';
  g.fillText(note, w / 2, 58, w - 20);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default function mars({ length = 250, seed = 571 } = {}) {
  return {
    id: `mars-${seed}`,
    name: 'Mars Overlook',
    length,
    env: {
      fog: 0xc98a58, density: 0.006,
      skyTop: 0x7a4a36, skyBot: 0xdfa066,
      sun: 0.55, ambient: 0.75, ambientColor: 0xe8b088,
    },
    audio: { drone: 0.3, pad: 0.3, bells: 0.12, chant: 0.08, wind: 0.65, bright: 0.7, melody: 0.25 },

    build() {
      const g = new THREE.Group();
      const r = rng(seed * 137);

      // rust desert floor
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(1400, length + 500),
        new THREE.MeshLambertMaterial({ color: 0x8a4a2c })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(0, -22, -length / 2);
      g.add(ground);

      // mesas dissolving into the haze (flat-topped cylinders)
      const mesaMat = new THREE.MeshLambertMaterial({ color: 0x9c5634 });
      for (let i = 0; i < 9; i++) {
        const rad = 50 + r() * 120;
        const m = new THREE.Mesh(
          new THREE.CylinderGeometry(rad * (0.5 + r() * 0.3), rad, 18 + r() * 30, 9),
          mesaMat
        );
        const side = r() > 0.5 ? 1 : -1;
        m.position.set(side * (160 + r() * 320), -22, -r() * length);
        g.add(m);
      }

      // scattered boulders near the line, one merged mesh
      const rockGeos = [];
      for (let i = 0; i < 80; i++) {
        const s = 0.5 + r() * 2.4;
        const rock = new THREE.DodecahedronGeometry(s, 0);
        const side = r() > 0.5 ? 1 : -1;
        rock.rotateY(r() * Math.PI);
        rock.rotateX(r() * 0.6);
        rock.translate(side * (8 + r() * 60), -22 + s * 0.5, -r() * length);
        rockGeos.push(rock);
      }
      g.add(new THREE.Mesh(mergeGeometries(rockGeos),
        new THREE.MeshLambertMaterial({ color: 0x6e3a24 })));

      // the suspended beam continues (same steel as openair, dust-tinted)
      const steel = new THREE.MeshLambertMaterial({ color: 0xc9a98a, emissive: 0x46342a });
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, length + 8), steel);
      beam.position.set(0, 6, -length / 2);
      g.add(beam);

      // ---- the NASA photo steles
      const loader = new THREE.TextureLoader();
      const lamps = [];
      const spacing = (length - 60) / PHOTOS.length;
      PHOTOS.forEach((ph, i) => {
        const side = i % 2 === 0 ? -1 : 1;
        const z = -(36 + i * spacing);
        // size from aspect: portraits stand tall, panoramas stretch long
        const H = ph.aspect > 2.5 ? Math.min(4.6, 24 / ph.aspect) : 5.2;
        const W = Math.min(24, H * ph.aspect);
        const x = side * (8.5 + (W > 12 ? 4 : 0));

        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(W + 0.44, H + 0.44, 0.2),
          new THREE.MeshLambertMaterial({ color: 0x2c1a12, emissive: 0x140a06 })
        );
        frame.position.set(x, 2.8, z);
        frame.rotation.y = -side * Math.PI / 2;
        g.add(frame);

        const mat = new THREE.MeshBasicMaterial({ color: 0x9a6a4c });
        const pane = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
        pane.position.set(x - side * 0.12, 2.8, z);
        pane.rotation.y = -side * Math.PI / 2;
        g.add(pane);
        loader.load(ph.src, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          mat.map = tex;
          mat.color.set(0xffffff);
          mat.needsUpdate = true;
        });

        const plaque = new THREE.Mesh(
          new THREE.PlaneGeometry(2.6, 0.38),
          new THREE.MeshBasicMaterial({ map: plaqueTexture(ph.title, ph.note), transparent: true })
        );
        plaque.position.set(x - side * 0.14, 2.8 - H / 2 - 0.5, z);
        plaque.rotation.y = -side * Math.PI / 2;
        g.add(plaque);

        // warm exhibition lamp above each stele
        const lamp = glowSprite(0xffd9a8, 1.8, 0.8);
        lamp.position.set(x - side * 0.4, 2.8 + H / 2 + 0.9, z);
        lamps.push({ lamp, ph: r() * 6 });
        g.add(lamp);
      });

      // wind-blown dust streaming low across the ground
      const DN = 420;
      const dpos = new Float32Array(DN * 3);
      const dspd = new Float32Array(DN);
      for (let i = 0; i < DN; i++) {
        dpos[i * 3] = (r() - 0.5) * 120;
        dpos[i * 3 + 1] = -21 + r() * 10;
        dpos[i * 3 + 2] = -r() * length;
        dspd[i] = 2 + r() * 5;
      }
      const dgeo = new THREE.BufferGeometry();
      dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
      const dust = new THREE.Points(dgeo, new THREE.PointsMaterial({
        map: sharedGlow(), color: 0xd9a070, size: 0.5,
        transparent: true, opacity: 0.22,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      g.add(dust);

      // two tiny moons low in the sky (Phobos & Deimos, suggested)
      const phobos = glowSprite(0xd8c8b8, 1.6, 0.7);
      phobos.position.set(90, 55, -length * 0.4);
      const deimos = glowSprite(0xcfc0b0, 0.9, 0.55);
      deimos.position.set(-140, 70, -length * 0.7);
      g.add(phobos, deimos);

      return {
        group: g,
        update(t, dt) {
          for (const l of lamps)
            l.lamp.material.opacity = 0.7 + 0.12 * Math.sin(t * 1.1 + l.ph);
          const a = dgeo.attributes.position.array;
          for (let i = 0; i < DN; i++) {
            a[i * 3] += dspd[i] * dt;
            if (a[i * 3] > 60) a[i * 3] = -60;
          }
          dgeo.attributes.position.needsUpdate = true;
        },
      };
    },
  };
}
