// A flat, dashed ribbon lying on the lane along a path: the aim line and the practice
// helper's "last throw" line. (WebGL lines are always one pixel thin, which all but
// disappears on a phone, so the path is drawn as a strip of triangles instead.)
import * as THREE from 'three';

let dashTexture: THREE.Texture | null = null;
function dashes() {
  if (dashTexture) return dashTexture;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 4;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 40, 4);
  dashTexture = new THREE.CanvasTexture(c);
  dashTexture.wrapS = THREE.RepeatWrapping;
  return dashTexture;
}

export class PathRibbon {
  readonly mesh: THREE.Mesh;
  private geo = new THREE.BufferGeometry();
  private positions: Float32Array;
  private uvs: Float32Array;

  constructor(
    private count: number,
    colour: string,
    private width = 0.03,
    opacity = 0.85,
    /** Length of one dash plus its gap, in metres. */
    private dash = 0.3,
  ) {
    this.positions = new Float32Array(count * 2 * 3);
    this.uvs = new Float32Array(count * 2 * 2);
    const index: number[] = [];
    for (let i = 0; i < count - 1; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geo.setIndex(index);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2));
    this.mesh = new THREE.Mesh(
      this.geo,
      new THREE.MeshBasicMaterial({
        color: colour,
        map: dashes(),
        transparent: true,
        opacity,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -4,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }

  get visible() {
    return this.mesh.visible;
  }
  set visible(v: boolean) {
    this.mesh.visible = v;
  }

  /** Lay the ribbon along `points` (exactly `count` of them, ground positions) at height `y`. */
  set(points: { x: number; z: number }[], y = 0.004) {
    const n = this.count;
    const half = this.width / 2;
    let dist = 0;
    for (let i = 0; i < n; i++) {
      const p = points[i];
      const prev = points[Math.max(0, i - 1)];
      const next = points[Math.min(n - 1, i + 1)];
      let tx = next.x - prev.x;
      let tz = next.z - prev.z;
      const len = Math.hypot(tx, tz) || 1;
      tx /= len;
      tz /= len;
      if (i > 0) dist += Math.hypot(p.x - prev.x, p.z - prev.z);
      // Sideways from the direction of travel
      const nx = -tz * half;
      const nz = tx * half;
      this.positions.set([p.x + nx, y, p.z + nz, p.x - nx, y, p.z - nz], i * 6);
      const u = dist / this.dash;
      this.uvs.set([u, 0, u, 1], i * 4);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.uv.needsUpdate = true;
  }
}
