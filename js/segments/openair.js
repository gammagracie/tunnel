// Open-air stretch: suspended monorail gliding above a sunset coastline.
// variant: 'coast' (sea + city lights + sun glint) or 'forest' (pines).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { glowSprite, rng } from '../lib/helpers.js';

export default function openAir({ length = 240, variant = 'coast', seed = 7 } = {}) {
  return {
    id: `openair-${variant}-${seed}`,
    name: variant === 'coast' ? 'The Coast' : 'The Pines',
    length,
    env: {
      fog: 0xffc9a0, density: 0.0035,
      skyTop: 0x3c6fb8, skyBot: 0xffcf96,
      sun: 1.0, ambient: 0.9, ambientColor: 0xfff0dd,
    },
    audio: { drone: 0.12, pad: 0.34, bells: 0.14, chant: 0.0, wind: 0.5, bright: 1.0 },

    build(ctx) {
      const g = new THREE.Group();
      const r = rng(seed * 1000 + length);

      // ground falling away below the elevated track
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(1600, length + 600),
        new THREE.MeshLambertMaterial({ color: variant === 'coast' ? 0x4a5a38 : 0x3d5133 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(0, -22, -length / 2);
      g.add(ground);

      // rolling hills — flattened cones
      const hillMat = new THREE.MeshLambertMaterial({ color: 0x46603c });
      const farMat = new THREE.MeshLambertMaterial({ color: 0x6d7a8f });
      for (let i = 0; i < 10; i++) {
        const far = i > 5;
        const h = new THREE.Mesh(new THREE.ConeGeometry(80 + r() * 160, 26 + r() * 55, 7), far ? farMat : hillMat);
        const side = r() > 0.5 ? 1 : -1;
        h.position.set(side * (far ? 320 + r() * 260 : 90 + r() * 160), -22, -r() * length);
        h.scale.y = 0.75;
        g.add(h);
      }

      if (variant === 'coast') {
        // sea to the left, with a sun-glint lane
        const sea = new THREE.Mesh(
          new THREE.PlaneGeometry(1200, length + 800),
          new THREE.MeshBasicMaterial({ color: 0x33537d })
        );
        sea.rotation.x = -Math.PI / 2;
        sea.position.set(-700, -21, -length / 2);
        g.add(sea);
        const glint = new THREE.Mesh(
          new THREE.PlaneGeometry(60, length + 700),
          new THREE.MeshBasicMaterial({
            color: 0xffd9a0, transparent: true, opacity: 0.5,
            blending: THREE.AdditiveBlending, depthWrite: false,
          })
        );
        glint.rotation.x = -Math.PI / 2;
        glint.position.set(-430, -20.8, -length / 2);
        g.add(glint);

        // distant city sparkle along the shoreline
        const n = 260, pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          pos[i * 3] = -180 - r() * 420;
          pos[i * 3 + 1] = -20 + r() * 4;
          pos[i * 3 + 2] = -r() * (length + 500) + 200;
        }
        const pg = new THREE.BufferGeometry();
        pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const city = new THREE.Points(pg, new THREE.PointsMaterial({
          color: 0xffe9c4, size: 1.6, sizeAttenuation: true,
          transparent: true, opacity: 0.85, depthWrite: false,
        }));
        g.add(city);
      }

      // pine trees near the line (merged into one mesh)
      const treeGeos = [];
      const treeCount = variant === 'forest' ? 70 : 28;
      for (let i = 0; i < treeCount; i++) {
        const s = 1 + r() * 2.2;
        const cone = new THREE.ConeGeometry(2.2 * s, 7 * s, 6);
        const side = r() > 0.5 ? 1 : -1;
        const x = side * (9 + r() * 46);
        const z = -r() * length;
        const y = -22 + 3.5 * s + Math.max(0, 10 - Math.abs(x)) * 0.4;
        cone.translate(x, y, z);
        treeGeos.push(cone);
      }
      g.add(new THREE.Mesh(mergeGeometries(treeGeos),
        new THREE.MeshLambertMaterial({ color: 0x2f4a2c })));

      // ----- the suspended monorail structure -----
      const steel = new THREE.MeshLambertMaterial({ color: 0xcfd6dd, emissive: 0x3a3f46 });
      // overhead beam, continuous
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, length + 8), steel);
      beam.position.set(0, 6, -length / 2);
      g.add(beam);
      // pylons every 30u — lattice towers off to the side, arm over the top
      const pylonGeos = [];
      for (let z = 10; z < length; z += 30) {
        const px = 4.4;
        const col = new THREE.BoxGeometry(0.9, 29, 0.9); col.translate(px, -7.5, -z);
        const col2 = new THREE.BoxGeometry(0.7, 26, 0.7); col2.translate(px + 2.4, -9, -z);
        const arm = new THREE.BoxGeometry(7.4, 0.6, 0.8); arm.translate(px - 2.2, 6.8, -z);
        const brace = new THREE.BoxGeometry(0.4, 9.5, 0.4);
        brace.rotateZ(0.6); brace.translate(px + 1.2, 1.5, -z);
        pylonGeos.push(col, col2, arm, brace);
      }
      g.add(new THREE.Mesh(mergeGeometries(pylonGeos), steel));

      // a few drifting birds (sprites)
      const birds = [];
      for (let i = 0; i < 5; i++) {
        const b = glowSprite(0x222b33, 0.8, 0.9);
        b.material.blending = THREE.NormalBlending;
        b.position.set(-30 - r() * 60, 10 + r() * 14, -r() * length);
        birds.push({ s: b, ph: r() * 6 });
        g.add(b);
      }

      return {
        group: g,
        update(t) {
          for (const b of birds) {
            b.s.position.x += Math.sin(t * 0.3 + b.ph) * 0.02;
            b.s.position.y += Math.cos(t * 0.6 + b.ph) * 0.01;
          }
        },
      };
    },
  };
}
