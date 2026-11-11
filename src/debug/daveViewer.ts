// Dev-only page (debug-dave.html): shows Dave in each pose so the model can be checked.
import * as THREE from 'three';
import { Dave } from '../scene/dave';
import type { ReactionKind } from '../game/reactions';

const params = new URLSearchParams(location.search);
const view = params.get('view') ?? 'front';
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#1b1026');
scene.add(new THREE.HemisphereLight('#fff3e0', '#2a1838', 1.2));
const sun = new THREE.DirectionalLight('#fff', 1.5);
sun.position.set(2, 5, -3);
scene.add(sun);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 10), new THREE.MeshStandardMaterial({ color: '#c8964f' }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const states: (string)[] = ['idle', 'charge', 'swing-release', 'follow', 'strike', 'spare', 'good', 'meh', 'gutter', 'split', 'wave'];
const daves = states.map((s, i) => {
  const d = new Dave();
  d.setStance((i - (states.length - 1) / 2) * 0.9, 0);
  scene.add(d.root);
  if (s === 'charge') d.charge(0.8);
  else if (s === 'swing-release') d.swing(() => {});
  else if (s === 'follow') d.swing(() => {});
  else if (s === 'wave') d.wave();
  else if (s !== 'idle') d.react(s as ReactionKind);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.109, 16, 12), new THREE.MeshStandardMaterial({ color: '#e0261b' }));
  scene.add(ball);
  return { d, s, ball };
});

const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 50);
if (view === 'front') camera.position.set(0, 1.4, -7.5);
else camera.position.set(-6, 1.3, -0.5);
camera.lookAt(view === 'front' ? 0 : -1, 1, 0);

// Advance each Dave to the moment shown
const v = new THREE.Vector3();
for (const { d, s } of daves) {
  const t = s === 'swing-release' ? 0.36 : s === 'follow' ? 1.0 : s === 'charge' ? 1.0 : 0.55;
  for (let i = 0; i < t * 60; i++) d.update(1 / 60);
}
for (const { d, s, ball } of daves) {
  ball.visible = ['idle', 'charge', 'swing-release'].includes(s);
  d.handWorldPosition(v);
  ball.position.set(v.x, v.y - 0.07, v.z);
}
renderer.render(scene, camera);
(window as unknown as { ready: boolean }).ready = true;
