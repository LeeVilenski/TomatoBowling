import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ReactionKind } from '../game/reactions';
import { HEADS, type HeadId } from './heads';

// Dave draws his face and suit fabrics on canvases. Tests only need his skeleton, so give
// him a stand-in canvas whose drawing calls do nothing.
beforeAll(() => {
  const noop: object = new Proxy(function () {}, { get: () => noop, apply: () => noop });
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => noop }),
  };
});

/** Closest the hands and forearms get to the outside of the head over `seconds`, in metres (negative = inside). */
async function clearance(head: HeadId, start: (d: import('./dave').Dave) => void, seconds = 4) {
  const { Dave } = await import('./dave');
  const d = new Dave();
  d.setHead(head);
  d.setStance(0, 0);
  start(d);
  const arms = (d as unknown as { arms: Record<'R' | 'L', { elbow: THREE.Object3D }> }).arms;
  const { pivot, bounds: b } = d.head;
  // Points down the forearm to the hand, with the limb's radius there
  const forearm: [number, number][] = [
    [0, 0.062],
    [-0.1, 0.058],
    [-0.18, 0.055],
    [-0.26, 0.054],
    [-0.32, 0.055],
  ];
  const p = new THREE.Vector3();
  let worst = Infinity;
  for (let i = 0; i < seconds * 60; i++) {
    d.update(1 / 60);
    d.root.updateMatrixWorld(true);
    for (const side of ['R', 'L'] as const) {
      for (const [y, r] of forearm) {
        arms[side].elbow.localToWorld(p.set(0, y, 0));
        pivot.worldToLocal(p); // head space (the head turns and tilts with this)
        // How far outside the head's enclosing ellipsoid, in metres: the first-order distance
        // (k - 1) / |∇k|, which holds up for flat heads (a cookie) as well as round ones
        const dy = p.y - b.y;
        const k = Math.hypot(p.x / b.rx, dy / b.ry, p.z / b.rz);
        const grad = Math.hypot(p.x / b.rx ** 2, dy / b.ry ** 2, p.z / b.rz ** 2) / k;
        worst = Math.min(worst, (k - 1) / grad - r);
      }
    }
  }
  return worst;
}

const MIN_GAP = 0.04; // 4 cm of daylight, so a hand never looks like it's in a head

const heads = Object.keys(HEADS) as HeadId[];
describe.each(heads)("hands stay out of the %s head", (head) => {
  const reactions: ReactionKind[] = ['strike', 'spare', 'good', 'meh', 'miss', 'gutter', 'split'];
  for (const kind of reactions) {
    it(`reacting to a ${kind}`, async () => {
      expect(await clearance(head, (d) => d.react(kind))).toBeGreaterThan(MIN_GAP);
    });
  }

  it('waving on the menu', async () => {
    expect(await clearance(head, (d) => d.wave())).toBeGreaterThan(MIN_GAP);
  });

  it('charging and throwing', async () => {
    expect(
      await clearance(head, (d) => {
        d.charge(1);
        d.swing(() => {});
      }),
    ).toBeGreaterThan(MIN_GAP);
  });
});
