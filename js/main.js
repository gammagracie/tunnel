// Lumen Rail — engine. Builds the ride from segments/registry.js, moves the
// suspended cab along it, and crossfades fog / sky / light / audio between
// segments. Segments are self-contained; this file shouldn't need editing
// to add new rooms.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ride } from './segments/registry.js';
import { AudioEngine } from './audio.js';
import { createEvents } from './events.js';
import { glowSprite } from './lib/helpers.js';

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xffc9a0, 0.0035);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 1200);
const rig = new THREE.Group();          // moves along the track
rig.add(camera);
scene.add(rig);
camera.position.y = 2.3;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.75, 0.65, 0.5);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// lights
const hemi = new THREE.HemisphereLight(0xfff0dd, 0x33414f, 0.9);
scene.add(hemi);

// ---------- sky dome + sun (engine-owned, blended per segment) ----------
const skyUniforms = {
  topColor: { value: new THREE.Color(0x3c6fb8) },
  botColor: { value: new THREE.Color(0xffcf96) },
};
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(900, 24, 16),
  new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vP; void main(){ vP = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 topColor; uniform vec3 botColor; varying vec3 vP;
      void main(){ float h = clamp(normalize(vP).y * 1.6 + 0.35, 0.0, 1.0);
        gl_FragColor = vec4(mix(botColor, topColor, pow(h, 0.8)), 1.0); }`,
  })
);
sky.renderOrder = -10;
scene.add(sky);
const sun = glowSprite(0xffe9c0, 160, 1);
sun.position.set(-500, 60, -500);
scene.add(sun);

// ---------- cab (attached to rig): hanger arm + canopy edge ----------
{
  const dark = new THREE.MeshBasicMaterial({ color: 0x272b31 });
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.07, 1.0), dark);
  canopy.position.set(0, 3.9, -0.7);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.2, 0.09), dark);
  armL.position.set(-0.65, 5.0, -0.5);
  const armR = armL.clone(); armR.position.x = 0.65;
  rig.add(canopy, armL, armR);
}

// ---------- build the ride ----------
const defs = ride;
const total = defs.reduce((s, d) => s + d.length, 0);
const instances = [];
const ctx = { THREE, scene };
let acc = 0;
for (const def of defs) {
  const inst = def.build(ctx);
  inst.group.position.z = -acc;        // travel is -Z; segment local z in [0,-len]
  scene.add(inst.group);
  instances.push({ def, start: acc, built: inst });
  acc += def.length;
}
// ghost copy of the first segment appended at the end so the loop seam is seamless
{
  const ghost = defs[0].build(ctx);
  ghost.group.position.z = -total;
  scene.add(ghost.group);
  instances.push({ def: defs[0], start: total, built: ghost, ghost: true });
}

// ---------- env blending ----------
const C = (hex) => new THREE.Color(hex);
const envs = defs.map((d) => ({
  fog: C(d.env.fog), density: d.env.density,
  skyTop: C(d.env.skyTop), skyBot: C(d.env.skyBot),
  sun: d.env.sun, ambient: d.env.ambient, ambientColor: C(d.env.ambientColor),
  audio: d.audio, name: d.name,
}));
const BLEND = 28;
const tmpA = { fog: new THREE.Color(), skyTop: new THREE.Color(), skyBot: new THREE.Color(), amb: new THREE.Color() };

function segAt(dist) {
  let i = 0;
  while (i < defs.length - 1 && dist >= instances[i].start + defs[i].length) i++;
  return i;
}
function applyEnv(dist) {
  const i = segAt(dist);
  const local = dist - instances[i].start;
  const len = defs[i].length;
  let j = i, f = 0; // neighbor + blend weight toward neighbor
  if (local < BLEND) { j = (i - 1 + defs.length) % defs.length; f = 0.5 - (local / BLEND) * 0.5; }
  else if (local > len - BLEND) { j = (i + 1) % defs.length; f = 0.5 - ((len - local) / BLEND) * 0.5; }
  const a = envs[i], b = envs[j];
  tmpA.fog.copy(a.fog).lerp(b.fog, f);
  tmpA.skyTop.copy(a.skyTop).lerp(b.skyTop, f);
  tmpA.skyBot.copy(a.skyBot).lerp(b.skyBot, f);
  tmpA.amb.copy(a.ambientColor).lerp(b.ambientColor, f);
  scene.fog.color.copy(tmpA.fog);
  scene.fog.density = a.density + (b.density - a.density) * f;
  skyUniforms.topColor.value.copy(tmpA.skyTop);
  skyUniforms.botColor.value.copy(tmpA.skyBot);
  hemi.color.copy(tmpA.amb);
  hemi.intensity = a.ambient + (b.ambient - a.ambient) * f;
  sun.material.opacity = a.sun + (b.sun - a.sun) * f;
  return { i, j, f };
}
function blendedAudio(i, j, f) {
  const a = envs[i].audio, b = envs[j].audio, out = {};
  for (const k of ['drone', 'pad', 'bells', 'chant', 'wind', 'bright', 'melody'])
    out[k] = (a[k] ?? 0) + ((b[k] ?? 0) - (a[k] ?? 0)) * f;
  return out;
}

// ---------- audio ----------
const audio = new AudioEngine();
let muted = false;

// ---------- journey events (shooting stars, lanterns, sparkle showers) ----------
const events = createEvents(scene);

// ---------- controls ----------
let dist = 0;
let speed = 9, targetSpeed = 9;
let paused = false;
const MINS = 2, MAXS = 28;
let yaw = 0, pitch = 0, tYaw = 0, tPitch = 0;
let dragging = false, lx = 0, ly = 0, lastLook = 0;

addEventListener('wheel', (e) => {
  targetSpeed = Math.max(MINS, Math.min(MAXS, targetSpeed + (e.deltaY > 0 ? 1.2 : -1.2)));
}, { passive: true });
// arrow keys look around (hold); +/- change speed; M mutes
const held = new Set();
addEventListener('keydown', (e) => {
  if (e.key.startsWith('Arrow')) { held.add(e.key); e.preventDefault(); }
  if (e.key === '+' || e.key === '=') targetSpeed = Math.min(MAXS, targetSpeed + 2);
  if (e.key === '-' || e.key === '_') targetSpeed = Math.max(MINS, targetSpeed - 2);
  if (e.key === 'm') toggleMute();
  if (e.key === ' ') {
    e.preventDefault();
    // a previously clicked HUD button must not swallow the spacebar
    if (document.activeElement && document.activeElement.tagName === 'BUTTON')
      document.activeElement.blur();
    if (e.repeat) return;
    const now = performance.now();
    if (now - lastSpace < 450) togglePause();   // double-tap space
    lastSpace = now;
  }
});
let lastSpace = 0;
addEventListener('keyup', (e) => {
  if (e.key.startsWith('Arrow')) { held.delete(e.key); lastLook = performance.now(); }
});
addEventListener('blur', () => held.clear());
const el = renderer.domElement;
el.addEventListener('pointerdown', (e) => { dragging = true; lx = e.clientX; ly = e.clientY; });
addEventListener('pointerup', () => { dragging = false; lastLook = performance.now(); });
addEventListener('pointermove', (e) => {
  if (!dragging) return;
  tYaw += (e.clientX - lx) * 0.004;
  tPitch += (e.clientY - ly) * 0.003;
  tYaw = Math.max(-1.6, Math.min(1.6, tYaw));
  tPitch = Math.max(-0.9, Math.min(0.45, tPitch));
  lx = e.clientX; ly = e.clientY;
  lastLook = performance.now();
});

// HUD
const hud = {
  name: document.getElementById('segname'),
  speedFill: document.getElementById('speedfill'),
  mute: document.getElementById('mute'),
};
document.getElementById('slower').addEventListener('click', () => {
  targetSpeed = Math.max(MINS, targetSpeed - 3);
});
document.getElementById('faster').addEventListener('click', () => {
  targetSpeed = Math.min(MAXS, targetSpeed + 3);
});
const pauseBtn = document.getElementById('pause');
function togglePause() {
  if (!began) return;
  paused = !paused;
  pauseBtn.textContent = paused ? '▶' : '❙❙';
  pauseBtn.classList.toggle('off', paused);
}
pauseBtn.addEventListener('click', togglePause);

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  hud.mute.textContent = muted ? '♪̷' : '♪';
  hud.mute.classList.toggle('off', muted);
}
hud.mute.addEventListener('click', toggleMute);
// buttons must not keep focus, or the spacebar re-activates them
for (const b of document.querySelectorAll('#hud button'))
  b.addEventListener('click', () => b.blur());

// start overlay — first tap starts audio (required by browsers) and the ride
const overlay = document.getElementById('overlay');
let began = false;
function begin() {
  if (began) return;
  began = true;
  audio.start();
  audio.setSpeed(speed);
  overlay.classList.add('gone');
}
overlay.addEventListener('pointerdown', begin);
addEventListener('keydown', begin, { once: true });

// segment name toast
let lastSeg = -1;
function showName(i) {
  hud.name.textContent = envs[i].name;
  hud.name.classList.remove('show');
  void hud.name.offsetWidth;
  hud.name.classList.add('show');
}

// debug / dev hook: ?at=900 jumps there; window.lumen.{jump,dist,speed}
window.lumen = {
  jump(d) { dist = ((d % total) + total) % total; },
  get dist() { return dist; },
  get total() { return total; },
  speed(v) { targetSpeed = Math.max(MINS, Math.min(MAXS, v)); },
  audio,
  renderer,
};
{
  const at = new URLSearchParams(location.search).get('at');
  if (at !== null) dist = ((+at % total) + total) % total;
}

// ---------- main loop ----------
const clock = new THREE.Clock();
let audioTimer = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;

  if (began) {
    const goal = paused ? 0 : targetSpeed;
    speed += (goal - speed) * Math.min(1, dt * 1.5);
    dist = (dist + speed * dt) % total;
  }

  // cab sway + gentle breathing height
  rig.position.set(
    Math.sin(t * 0.5) * 0.12,
    Math.sin(t * 0.9) * 0.05 + Math.sin(t * 0.23) * 0.04,
    -dist
  );
  // held arrow keys steer the gaze
  if (held.size) {
    const rate = 1.7 * dt;
    if (held.has('ArrowLeft')) tYaw -= rate;
    if (held.has('ArrowRight')) tYaw += rate;
    if (held.has('ArrowUp')) tPitch -= rate;
    if (held.has('ArrowDown')) tPitch += rate;
    tYaw = Math.max(-1.6, Math.min(1.6, tYaw));
    tPitch = Math.max(-0.9, Math.min(0.45, tPitch));
    lastLook = performance.now();
  }
  // auto-recenter look a few seconds after the last drag
  if (!dragging && performance.now() - lastLook > 2600) {
    tYaw *= 1 - Math.min(1, dt * 0.5);
    tPitch *= 1 - Math.min(1, dt * 0.5);
  }
  yaw += (tYaw - yaw) * Math.min(1, dt * 6);
  pitch += (tPitch - pitch) * Math.min(1, dt * 6);
  camera.rotation.set(-pitch, -yaw, Math.sin(t * 0.5) * 0.006, 'YXZ');

  sky.position.copy(rig.position);
  sun.position.set(rig.position.x - 500, 60, rig.position.z - 300);

  // env + segment updates
  const { i, j, f } = applyEnv(dist);
  if (i !== lastSeg) {
    const first = lastSeg === -1;
    lastSeg = i;
    showName(i);
    if (!first && began) audio.swell();   // soft riser crossing each threshold
  }
  if (began) events.update(t, dt, rig.position, sun.material.opacity);
  for (const it of instances) {
    const near = dist > it.start - 80 && dist < it.start + it.def.length + 80;
    it.built.group.visible = near || it.ghost === true && dist > total - 120;
    if (near && it.built.update) it.built.update(t, dt, dist - it.start);
  }

  // audio follow
  audioTimer += dt;
  if (audioTimer > 0.3 && audio.started) {
    audioTimer = 0;
    audio.setProfile(blendedAudio(i, j, f), 0.6);
    audio.setSpeed(speed);
  }

  // HUD speed bar
  hud.speedFill.style.width = `${((speed - MINS) / (MAXS - MINS)) * 100}%`;

  composer.render();
}
frame();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});
