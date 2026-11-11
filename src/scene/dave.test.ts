import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ReactionKind } from '../game/reactions';

// Dave draws his face and suit fabrics on canvases. Tests only need his skeleton, so give
// him a stand-in canvas whose drawing calls do nothing.
beforeAll(() => {
  const noop: object = new Proxy(function () {}, { get: () => noop, apply: () => noop });
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => noop }),
  };
});

/** Closest the hands and forearms get to the outside of the head over `seconds`, in metres (negative = inside). */
async function clearance(start: (d: import('./dave').Dave) => void, seconds = 4) {
  const { Dave } = await import('./dave');
  const d = new Dave();
  d.setStance(0, 0);
  start(d);
  const parts = d as unknown as {
    arms: Record<'R' | 'L', { elbow: THREE.Object3D }>;
    headPivot: THREE.Object3D;
  };
  const head = parts.headPivot.children.find((c) => c instanceof THREE.Mesh && c.geometry instanceof THREE.SphereGeometry)!;
  const HEAD_R = 0.23;
  // Points down the forearm to the hand, with the limb's radius there
  const forearm: [number, number][] = [
    [0, 0.062],
    [-0.1, 0.058],
    [-0.18, 0.055],
    [-0.26, 0.054],
    [-0.32, 0.055],
  ];
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  let worst = Infinity;
  for (let i = 0; i < seconds * 60; i++) {
    d.update(1 / 60);
    d.root.updateMatrixWorld(true);
    for (const side of ['R', 'L'] as const) {
      for (const [y, r] of forearm) {
        parts.arms[side].elbow.localToWorld(p.set(0, y, 0));
        head.worldToLocal(p); // head space: a sphere of HEAD_R, squashed in y by the mesh scale
        head.getWorldScale(s);
        // Distance from the head's surface, measured back in world units
        const dist = p.length() - HEAD_R;
        const scale = Math.min(s.x, s.y, s.z);
        worst = Math.min(worst, dist * scale - r);
      }
    }
  }
  return worst;
}

const MIN_GAP = 0.04; // 4 cm of daylight, so a hand never looks like it's in his head

describe("Dave's hands stay out of his head", () => {
  const reactions: ReactionKind[] = ['strike', 'spare', 'good', 'meh', 'miss', 'gutter', 'split'];
  for (const kind of reactions) {
    it(`reacting to a ${kind}`, async () => {
      expect(await clearance((d) => d.react(kind))).toBeGreaterThan(MIN_GAP);
    });
  }

  it('waving on the menu', async () => {
    expect(await clearance((d) => d.wave())).toBeGreaterThan(MIN_GAP);
  });

  it('charging and throwing', async () => {
    expect(
      await clearance((d) => {
        d.charge(1);
        d.swing(() => {});
      }),
    ).toBeGreaterThan(MIN_GAP);
  });
});
