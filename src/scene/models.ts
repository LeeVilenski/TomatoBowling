import * as THREE from 'three';
import { BALL_RADIUS, PIN_PROFILE } from '../game/dimensions';

/** A white pin with two red neck stripes. Origin is at the base. */
export function createPinMesh(): THREE.Group {
  const pts = PIN_PROFILE.map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.Mesh(
    new THREE.LatheGeometry(pts, 24),
    new THREE.MeshStandardMaterial({ color: '#f7f4ee', roughness: 0.25 }),
  );
  body.castShadow = true;
  body.receiveShadow = true;

  const stripeMat = new THREE.MeshStandardMaterial({ color: '#d0201a', roughness: 0.3 });
  const group = new THREE.Group();
  group.add(body);
  for (const [y, r] of [
    [0.247, 0.0234],
    [0.262, 0.0238],
  ]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.0012, r + 0.0012, 0.008, 24, 1, true), stripeMat);
    ring.position.y = y;
    group.add(ring);
  }
  return group;
}

/** A red bowling ball made to look like a tomato: soft lobes, a leafy top and a stalk. */
export function createTomatoBall(): THREE.Group {
  const geo = new THREE.SphereGeometry(BALL_RADIUS, 48, 32);
  // Gentle vertical grooves like a tomato, without changing the round silhouette much
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const lon = Math.atan2(v.z, v.x);
    const lat = Math.abs(v.y) / BALL_RADIUS;
    const groove = 1 - 0.035 * Math.pow(Math.abs(Math.cos(lon * 3)), 6) * (1 - lat);
    v.multiplyScalar(groove);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();

  const ball = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: '#e0261b', roughness: 0.18, metalness: 0.05 }),
  );
  ball.castShadow = true;

  const group = new THREE.Group();
  group.add(ball);

  // Leafy star on top
  const leafMat = new THREE.MeshStandardMaterial({ color: '#2f8f2a', roughness: 0.6, side: THREE.DoubleSide });
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.012, 0.025, 0, 0.05);
  leafShape.quadraticCurveTo(-0.012, 0.025, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(leafShape);
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    const pivot = new THREE.Group();
    pivot.position.y = BALL_RADIUS - 0.002;
    pivot.rotation.y = (i / 5) * Math.PI * 2;
    leaf.rotation.x = -Math.PI / 2 - 0.2; // lie almost flat, drooping over the top
    pivot.add(leaf);
    group.add(pivot);
  }

  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.022, 8), leafMat);
  stalk.position.y = BALL_RADIUS + 0.008;
  group.add(stalk);

  return group;
}
