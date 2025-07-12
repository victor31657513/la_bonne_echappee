
import * as THREE from 'three';

export class CyclistSim {
  constructor(curve) {
    this.curve = curve;
    this.length = curve.getLength();
    this.u = 0;
    this.speed = 10; // meters per second
  }


  update(dt, mesh) {
    const tangent = this.curve.getTangentAt(this.u);
    const horiz = Math.hypot(tangent.x, tangent.z);
    const slope = horiz > 0 ? tangent.y / horiz : 0;
    const accel = -9.8 * slope;
    this.speed += accel * dt;
    const distance = this.speed * dt;
    this.u += distance / this.length;
    this.u = Math.min(Math.max(this.u, 0), 1);
    const pos = this.curve.getPointAt(this.u);
    const dir = this.curve.getTangentAt(this.u);
    const yaw = Math.atan2(dir.x, dir.z);
    mesh.position.copy(pos);
    mesh.rotation.set(0, yaw, 0);
  }
}
