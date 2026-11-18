# Lumen Rail

An interactive meditative ride: a suspended monorail glides through open-air
coastline and a sequence of glowing tunnel worlds, with generative ambient
audio (drones, pads, bells, synthesized chanting).

Run it: start the `tunnel-static` server (port 8935) and open
http://localhost:8935/

Controls: tap/click to board · arrow keys (hold) or drag to look around
(you can spin all the way around) ·
scroll wheel, − / + keys or the on-screen − + to change speed
(keep slowing past zero to ride in reverse) ·
double-tap space (or ❙❙) to pause and resume · M (or ♪) to mute.
The gaze drifts back to center a couple of seconds after you let go.

## Architecture — adding rooms, paths, experiences

The whole ride is defined by one array in `js/segments/registry.js`.
Each entry is a **segment**: a self-contained module that owns its geometry,
animation, atmosphere, and sound mix. The engine (`js/main.js`) strings them
end to end, loops seamlessly, and crossfades fog, sky, lighting, and audio
across boundaries. You should never need to touch the engine to add content.

### Segment contract

A segment file exports a factory returning:

```js
export default function myRoom({ length = 200 } = {}) {
  return {
    id: 'my-room',          // unique string
    name: 'My Room',        // shown as the toast when entering
    length,                 // ride-units long (camera moves ~9/sec by default)
    env: {                  // atmosphere, crossfaded automatically
      fog: 0x160709,        // fog color
      density: 0.026,       // fog density (outdoors ~0.0035, tunnels 0.02–0.03)
      skyTop: 0x0c0406,     // sky dome gradient
      skyBot: 0x160709,
      sun: 0,               // sun visibility 0–1 (1 outdoors)
      ambient: 0.1,         // hemisphere light intensity
      ambientColor: 0xff9a5a,
    },
    audio: {                // layer mix 0–1, crossfaded automatically
      drone: 0.6, pad: 0.45, bells: 0.2, chant: 0.5, wind: 0, bright: 0.4,
    },
    build(ctx) {            // called once at startup
      const group = new THREE.Group();
      // Build everything in LOCAL coordinates:
      //   travel direction: z from 0 (entrance) to -length (exit)
      //   camera passes at x=0, y≈2.3; keep a clear corridor ±1.5 around that
      return {
        group,
        update(t, dt, camZ) { /* optional; camZ = how far into your segment */ },
      };
    },
  };
}
```

Then register it:

```js
// registry.js
import myRoom from './my-room.js';
export const ride = [ ..., myRoom({ length: 180 }), ... ];
```

### Toolkit (`js/lib/helpers.js`)

- `tunnelShell({length, radius, color})` — dark enclosing tube
- `portalRing(color, radius)` — glowing tunnel-mouth ring
- `neonBars(bars, color)` — many thin glowing bars merged into ONE mesh (cheap)
- `glowSprite(color, scale, opacity)` — soft bloom-friendly light blob
- `gradientTexture(stops)` / `liquidTexture(stops)` — canvas textures (shafts, liquids)
- `rng(seed)` — deterministic random, so a segment always builds identically

Bloom post-processing makes anything emissive/additive glow — bright additive
materials read as "light" automatically.

### Audio

`js/audio.js` synthesizes everything (Web Audio): each named layer feeds one
gain node, and segments only set levels. To swap a layer for a real recording
later, decode the file into a looping `AudioBufferSourceNode` and connect it
to that same layer gain — the per-segment mixes keep working unchanged.

### Existing segments

| file | world |
|---|---|
| `openair.js` | sunset coast / pine forest, suspended track + open lattice truss pylons |
| `neon.js` | violet LED lattice tunnel |
| `mirror.js` | reflective-floor infinity hall |
| `liquid.js` | glowing liquid columns, molten pools, rising bubbles |
| `cathedral.js` | golden arches, god-rays, drifting motes, heavy chant |
| `cosmos.js` | dark gallery of projected nebulae / pixel starbursts, overhead pipes, spark streams |
| `jungle.js` | deep rainforest: canopy pressing in, vines, god-rays, bioluminescent flowers, fireflies |
| `stargate.js` | immersive galaxy passage: 3,400-speck nebula, dandelion light-blooms, drifting gate rings |
| `gallery.js` | night museum: framed artworks with picture lamps + plaques, driven by `artworks.js` |
| `mars.js` | Martian desert under a butterscotch sky; NASA's newest Mars surface photos stand as lamplit steles (`assets/mars/`, NASA/JPL-Caltech) |

### The Night Gallery's collection

`js/segments/artworks.js` lists the pieces. Drop image files into
`assets/art/` and reference them there (`src`, `aspect`, `title`, `artist`);
the room auto-sizes to the list and hangs everything with a lamp and plaque,
each canvas curving with the tunnel wall. Pieces without an image get a
painted placeholder. The current hang is eight public-domain classics
(Van Gogh, Whistler, Hokusai, Munch, Monet, Friedrich, Klimt, Turner)
via Wikimedia Commons.

### Journey events (`js/events.js`)

Rare one-off moments layered over any segment — shooting stars over open
stretches, a lantern-bearer drifting past in tunnels, sparkle showers. Each
event declares its own timing and when it may fire (how "outdoor" the current
environment is); add more by pushing an entry into the `defs` array.

### Structure helpers

`tunnelRibs` sweeps structural rings down any shell (depth cues — you feel
*inside* a built tube); `trussPylonGeometry` builds the Tibidabo-style open
lattice towers used by the open-air segments.
