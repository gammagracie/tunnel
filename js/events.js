// Journey events — rare one-off moments layered over any segment, so the
// ride never feels identical twice. The engine calls update() each frame
// with where the cab is and how outdoor the current environment is.
//
// To add an event: push an entry into EVENTS with
//   { minGap, maxGap, when(outdoor) -> bool, fire(ctx) -> {update(dt)->alive} }
import * as THREE from 'three';
import { glowSprite } from './lib/helpers.js';

export function createEvents(scene) {
  const active = [];
  const defs = [
    {
      // shooting star arcing across the open sky
      minGap: 14, maxGap: 30,
      when: (outdoor) => outdoor > 0.5,
      fire: (rig) => {
        const s = glowSprite(0xfff6e0, 2.2, 0);
        const trail = glowSprite(0xffe9c0, 5.5, 0);
        trail.scale.set(9, 0.5, 1);
        const dir = Math.random() < 0.5 ? -1 : 1;
        const p = new THREE.Vector3(
          rig.x + dir * (40 + Math.random() * 60),
          55 + Math.random() * 40,
          rig.z - 120 - Math.random() * 120
        );
        s.position.copy(p); trail.position.copy(p);
        scene.add(s, trail);
        const v = new THREE.Vector3(-dir * (26 + Math.random() * 14), -9, 6);
        let life = 2.6;
        return {
          update(dt) {
            life -= dt;
            p.addScaledVector(v, dt);
            s.position.copy(p);
            trail.position.copy(p).addScaledVector(v, -0.12);
            const a = Math.min(1, Math.max(0, life / 2.6)) * Math.min(1, (2.6 - life) * 3);
            s.material.opacity = a;
            trail.material.opacity = a * 0.5;
            if (life <= 0) { scene.remove(s, trail); return false; }
            return true;
          },
        };
      },
    },
    {
      // a lantern-bearer: warm orb drifting past on the opposite track
      minGap: 22, maxGap: 48,
      when: (outdoor) => outdoor < 0.3,
      fire: (rig) => {
        const s = glowSprite(0xffc988, 1.8, 0);
        const halo = glowSprite(0xff9a50, 4.5, 0);
        const side = Math.random() < 0.5 ? -1 : 1;
        const p = new THREE.Vector3(rig.x + side * 3.4, 1.6, rig.z - 110);
        s.position.copy(p); halo.position.copy(p);
        scene.add(s, halo);
        let life = 7;
        const sway = Math.random() * 6;
        return {
          update(dt, t) {
            life -= dt;
            p.z += 18 * dt;                        // drifts toward and past you
            p.y = 1.6 + Math.sin(t * 2 + sway) * 0.25;
            s.position.copy(p); halo.position.copy(p);
            const a = Math.min(1, (7 - life)) * Math.min(1, life / 1.5);
            s.material.opacity = a * 0.95;
            halo.material.opacity = a * 0.3;
            if (life <= 0) { scene.remove(s, halo); return false; }
            return true;
          },
        };
      },
    },
    {
      // brief sparkle shower falling ahead (any dark passage)
      minGap: 30, maxGap: 70,
      when: (outdoor) => outdoor < 0.4,
      fire: (rig) => {
        const n = 60;
        const pos = new Float32Array(n * 3);
        const vel = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          pos[i * 3] = rig.x + (Math.random() - 0.5) * 8;
          pos[i * 3 + 1] = 7 + Math.random() * 3;
          pos[i * 3 + 2] = rig.z - 50 - Math.random() * 30;
          vel[i] = 1.2 + Math.random() * 2.2;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const pts = new THREE.Points(geo, new THREE.PointsMaterial({
          color: 0xcfe8ff, size: 0.1, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        scene.add(pts);
        let life = 6;
        return {
          update(dt) {
            life -= dt;
            const a = geo.attributes.position.array;
            for (let i = 0; i < n; i++) a[i * 3 + 1] -= vel[i] * dt;
            geo.attributes.position.needsUpdate = true;
            pts.material.opacity = Math.min(0.9, (6 - life) * 2) * Math.min(1, life / 2);
            if (life <= 0) { scene.remove(pts); geo.dispose(); return false; }
            return true;
          },
        };
      },
    },
  ];
  const next = defs.map((d) => 6 + Math.random() * d.maxGap);

  return {
    update(t, dt, rigPos, outdoor) {
      defs.forEach((d, i) => {
        next[i] -= dt;
        if (next[i] <= 0) {
          next[i] = d.minGap + Math.random() * (d.maxGap - d.minGap);
          if (d.when(outdoor)) active.push(d.fire(rigPos));
        }
      });
      for (let i = active.length - 1; i >= 0; i--)
        if (!active[i].update(dt, t)) active.splice(i, 1);
    },
  };
}
