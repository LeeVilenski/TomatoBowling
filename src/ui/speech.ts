import * as THREE from 'three';
import type { Dave } from '../scene/dave';

/** Comic speech bubble that floats above Dave's head. */
export class SpeechBubble {
  private visible = false;
  private v = new THREE.Vector3();

  constructor(private el: HTMLElement) {
    el.hidden = true;
  }

  show(text: string) {
    this.el.textContent = text;
    this.el.hidden = false;
    this.visible = true;
    // Restart the pop-in animation
    this.el.classList.remove('pop');
    void this.el.offsetWidth;
    this.el.classList.add('pop');
  }

  hide() {
    this.el.hidden = true;
    this.visible = false;
  }

  /** Keeps the bubble pinned above Dave's head on screen. */
  update(dave: Dave, camera: THREE.Camera) {
    if (!this.visible) return;
    dave.headWorldPosition(this.v);
    this.v.y += 0.12;
    this.v.project(camera);
    const x = ((this.v.x + 1) / 2) * window.innerWidth;
    const y = ((1 - this.v.y) / 2) * window.innerHeight;
    const half = this.el.offsetWidth / 2;
    const clampedX = Math.min(window.innerWidth - 12 - half, Math.max(12 + half, x));
    // Never cover the scorecard and status text at the top
    const hud = document.getElementById('hud');
    const minTop = hud && !hud.hidden ? hud.getBoundingClientRect().bottom + 8 : 12;
    const top = Math.max(minTop, y - this.el.offsetHeight - 14);
    this.el.style.transform = `translate(${clampedX - half}px, ${top}px)`;
  }
}
