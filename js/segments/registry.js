// ─────────────────────────────────────────────────────────────────────────
// THE RIDE. This array *is* the experience — an ordered loop of segments.
//
// To add a new room/path/experience:
//   1. Create js/segments/your-room.js exporting a factory like the others:
//        export default function yourRoom(opts) {
//          return { id, name, length, env: {...}, audio: {...},
//                   build() { return { group, update(t, dt, camZ) {...} } } }
//        }
//   2. Import it below and splice it into the array anywhere.
// The engine handles placement, fog/sky/audio crossfades and looping.
// (See README.md for the full segment contract.)
// ─────────────────────────────────────────────────────────────────────────
import openAir from './openair.js';
import neon from './neon.js';
import mirror from './mirror.js';
import liquid from './liquid.js';
import cathedral from './cathedral.js';
import cosmos from './cosmos.js';
import jungle from './jungle.js';
import stargate from './stargate.js';
import gallery from './gallery.js';
import mars from './mars.js';

export const ride = [
  openAir({ length: 240, variant: 'coast', seed: 7 }),
  neon({ length: 210 }),
  openAir({ length: 150, variant: 'forest', seed: 19 }),
  jungle({ length: 230 }),
  mirror({ length: 200 }),
  liquid({ length: 220 }),
  cosmos({ length: 230 }),
  stargate({ length: 240 }),
  mars({ length: 250 }),
  openAir({ length: 150, variant: 'coast', seed: 31 }),
  gallery(),                       // length auto-sizes to the artwork list
  cathedral({ length: 240 }),
];
