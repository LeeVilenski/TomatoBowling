import * as THREE from 'three';

const MAX_DROPS = 700;
const MAX_SPLATS = 36;
const GRAVITY = 9.8;
const COLOURS = ['#e0261b', '#ff4a2a', '#c41a12', '#ff7a3a'].map((c) => new THREE.Color(c));

/** A round droplet with a glossy highlight, so drops aren't square when seen up close. */
function dropTexture() {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size * 0.38, size * 0.36, 1, size / 2, size / 2, size / 2);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.25, '#f2f2f2');
  grad.addColorStop(1, '#bbbbbb');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Tomato juice: droplets that fly on impact, then land as splats that fade. */
export class Juice {
  private positions = new Float32Array(MAX_DROPS * 3);
  private colours = new Float32Array(MAX_DROPS * 3);
  private velocity = new Float32Array(MAX_DROPS * 3);
  private life = new Float32Array(MAX_DROPS);
  private next = 0;
  private geo = new THREE.BufferGeometry();
  private splats: { mesh: THREE.Mesh; life: number }[] = [];
  private nextSplat = 0;

  constructor(scene: THREE.Scene) {
    this.positions.fill(-100);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colours, 3));
    const points = new THREE.Points(
      this.geo,
      new THREE.PointsMaterial({ size: 0.032, vertexColors: true, sizeAttenuation: true, depthWrite: false, map: dropTexture(), alphaTest: 0.5 }),
    );
    points.frustumCulled = false;
    scene.add(points);

    const splatGeo = new THREE.CircleGeometry(1, 28);
    splatGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < MAX_SPLATS; i++) {
      const mesh = new THREE.Mesh(
        splatGeo,
        new THREE.MeshBasicMaterial({ color: '#b3170f', transparent: true, opacity: 0, depthWrite: false }),
      );
      mesh.visible = false;
      scene.add(mesh);
      this.splats.push({ mesh, life: 0 });
    }
  }

  /**
   * @param at where the splash starts
   * @param strength 0–1.5, how big
   * @param direction travel direction of the ball (droplets spray forward)
   */
  splash(at: THREE.Vector3, strength: number, direction = new THREE.Vector3(0, 0, -1)) {
    const count = Math.round(25 + 90 * strength);
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX_DROPS;
      const speed = (0.8 + Math.random() * 2.6) * (0.6 + strength * 0.6);
      const angle = Math.random() * Math.PI * 2;
      const up = 0.4 + Math.random() * 0.9;
      const fwd = 0.5 + Math.random();
      this.positions.set([at.x, at.y, at.z], i * 3);
      this.velocity.set(
        [
          (Math.cos(angle) * 0.8 + direction.x * fwd) * speed,
          up * speed,
          (Math.sin(angle) * 0.8 + direction.z * fwd) * speed,
        ],
        i * 3,
      );
      const c = COLOURS[Math.floor(Math.random() * COLOURS.length)];
      this.colours.set([c.r, c.g, c.b], i * 3);
      this.life[i] = 1.2 + Math.random() * 0.8;
    }
    // A few splats on the deck around the impact
    const splats = Math.round(2 + 4 * strength);
    for (let s = 0; s < splats; s++) {
      const r = 0.05 + Math.random() * 0.25 * strength;
      this.addSplat(at.x + (Math.random() - 0.5) * 0.5, at.z + direction.z * Math.random() * 0.6 + (Math.random() - 0.5) * 0.3, 0.025 + Math.random() * 0.05 * (0.5 + strength), r);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }

  private addSplat(x: number, z: number, size: number, _spread: number) {
    const s = this.splats[this.nextSplat];
    this.nextSplat = (this.nextSplat + 1) % MAX_SPLATS;
    s.mesh.position.set(x, 0.003 + Math.random() * 0.002, z);
    s.mesh.scale.setScalar(size);
    s.mesh.visible = true;
    s.life = 3.5;
  }

  /** Wipe every droplet and splat (e.g. before a replay re-splashes the same throw). */
  clear() {
    this.life.fill(0);
    this.positions.fill(-100);
    this.geo.attributes.position.needsUpdate = true;
    for (const s of this.splats) {
      s.life = 0;
      s.mesh.visible = false;
    }
  }

  update(dt: number) {
    let any = false;
    for (let i = 0; i < MAX_DROPS; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      const p = i * 3;
      if (this.life[i] <= 0) {
        this.positions[p + 1] = -100;
        continue;
      }
      if (this.positions[p + 1] > 0.004) {
        this.velocity[p + 1] -= GRAVITY * dt;
        this.positions[p] += this.velocity[p] * dt;
        this.positions[p + 1] += this.velocity[p + 1] * dt;
        this.positions[p + 2] += this.velocity[p + 2] * dt;
        // Land on the lane (droplets that go over the edge drop into the dark)
        if (this.positions[p + 1] <= 0.004 && Math.abs(this.positions[p]) < 0.53) this.positions[p + 1] = 0.004;
        else if (this.positions[p + 1] < -0.5) this.life[i] = 0;
      }
    }
    if (any) this.geo.attributes.position.needsUpdate = true;

    for (const s of this.splats) {
      if (s.life <= 0) continue;
      s.life -= dt;
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(0.8, s.life / 1.5);
      if (s.life <= 0) s.mesh.visible = false;
    }
  }
}
