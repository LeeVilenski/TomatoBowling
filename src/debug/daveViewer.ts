// Dev-only page (debug-dave.html): shows Dave in each pose so the model can be checked.
import * as THREE from 'three';
import { buildBench } from '../scene/bench';
import { Dave } from '../scene/dave';
import { HEADS, type HeadId } from '../scene/heads';
import type { ReactionKind } from '../game/reactions';

const params = new URLSearchParams(location.search);
const view = params.get('view') ?? 'front';
const outfit = params.get('outfit');
// ?head=pickle (or any head id) shows a rival's head; ?head=all mixes them across the poses;
// ?head=lineup stands every head side by side
const head = params.get('head');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#1b1026');
scene.add(new THREE.HemisphereLight('#fff3e0', '#2a1838', 1.2));
renderer.setPixelRatio(2);
const sun = new THREE.DirectionalLight('#fff', 1.5);
sun.position.set(2, 5, -3);
scene.add(sun);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 10), new THREE.MeshStandardMaterial({ color: '#c8964f' }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const allHeads = Object.keys(HEADS) as HeadId[];
// ?anim shows the poses between turns: walking, waiting fidgets, watching the other bowler
const anim = params.has('anim');
const only = params.get('only')?.split(',');
const allStates: string[] = anim
  ? ['walk', 'wait-sway', 'wait-arms', 'wait-tap', 'wait-look', 'wait-hips', 'watch-strike', 'watch-gutter', 'watch-split', 'follow-left', 'blink', 'sit-sway', 'sit-arms', 'sit-tap', 'sit-hips', 'sit-watch-strike', 'sit-watch-gutter']
  : head === 'lineup'
    ? allHeads.map(() => 'idle')
    : ['idle', 'charge', 'swing-release', 'follow', 'strike', 'spare', 'good', 'meh', 'gutter', 'split', 'wave'];
// ?only=wait-arms,watch-strike picks some of them
const states = only ? allStates.filter((st) => only.includes(st)) : allStates;
const daves = states.map((s, i) => {
  const d = new Dave();
  if (outfit) d.setOutfit(outfit);
  if (head === 'lineup') d.setHead(allHeads[i]);
  else if (head === 'all') d.setHead(allHeads[i % allHeads.length]);
  else if (head) d.setHead(head as HeadId);
  d.setStance((i - (states.length - 1) / 2) * (head === 'lineup' ? 0.6 : 0.9), 0);
  scene.add(d.root);
  const x = (i - (states.length - 1) / 2) * (head === 'lineup' ? 0.6 : 0.9);
  if (s === 'walk') d.walkTo(x, -20);
  else if (s.startsWith('sit-')) {
    // On a bench, like the one behind the approach
    d.sitAt(x, 0);
    const bench = buildBench();
    bench.position.set(x, 0, 0);
    scene.add(bench);
    if (s.startsWith('sit-watch-')) d.watch(s.slice(10) as ReactionKind);
    else (d as unknown as { fidget: string }).fidget = s.slice(4);
  }
  else if (s.startsWith('wait-')) {
    d.wait();
    (d as unknown as { fidget: string }).fidget = s.slice(5);
  } else if (s.startsWith('watch-')) {
    d.wait();
    d.watch(s.slice(6) as ReactionKind);
  } else if (s === 'follow-left') {
    d.swing(() => {});
    d.setEnglish(-1);
  } else if (s === 'blink') (d as unknown as { blinkIn: number }).blinkIn = 0.5;
  else if (s === 'charge') d.charge(0.8);
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
else if (view === 'close') camera.position.set(-1.8, 1.45, -2.6);
else camera.position.set(-6, 1.3, -0.5);
camera.lookAt(view === 'front' ? 0 : view === 'close' ? -1.8 : -1, view === 'close' ? 1.1 : 1, 0);

// Advance each Dave to the moment shown
const v = new THREE.Vector3();
for (const { d, s } of daves) {
  const t = s === 'swing-release' ? 0.36 : s === 'follow' || s === 'follow-left' ? 1.4 : s === 'charge' ? 1.0 : s === 'walk' ? 0.42 : s === 'blink' ? 0.55 : 0.55;
  for (let i = 0; i < t * 60; i++) d.update(1 / 60);
}
for (const { d, s, ball } of daves) {
  ball.visible = ['idle', 'charge', 'swing-release'].includes(s);
  d.handWorldPosition(v);
  ball.position.set(v.x, v.y - 0.07, v.z);
}
renderer.render(scene, camera);
(window as unknown as { ready: boolean }).ready = true;
