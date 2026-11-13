import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PinSet } from './models';

describe('PinSet', () => {
  it('places pins from the plain {x,y,z,w} objects the physics engine returns', () => {
    const pins = new PinSet(2);
    const half = Math.SQRT1_2;
    pins.set(0, { x: 1, y: 2, z: -18 }, { x: half, y: 0, z: 0, w: half }); // knocked flat
    pins.set(1, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 }, false); // swept away
    pins.commit();

    const body = pins.group.children[0] as THREE.InstancedMesh;
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    body.getMatrixAt(0, m);
    m.decompose(pos, quat, scale);
    expect(pos.toArray()).toEqual([1, 2, -18]);
    expect(quat.x).toBeCloseTo(half);
    expect(scale.x).toBeCloseTo(1);
    body.getMatrixAt(1, m);
    expect(m.elements.every((v, i) => (i === 15 ? v === 1 : v === 0))).toBe(true); // hidden: scaled to nothing
  });
});

describe("rivals' balls", () => {
  it('every rival has a strike ball and a spare ball, regulation size so their tuning holds', async () => {
    const { RIVALS } = await import('../game/rivals');
    const { BALL_STYLES } = await import('./models');
    const { BALL_RADIUS } = await import('../game/dimensions');
    for (const r of RIVALS) {
      for (const kind of ['strike', 'spare']) {
        const style = BALL_STYLES[`${r.id}-${kind}`];
        expect(style, `${r.name}'s ${kind} ball`).toBeDefined();
        expect(style.radius).toBe(BALL_RADIUS);
      }
    }
  });
});
