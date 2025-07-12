
import * as THREE from 'three';

const MAX_SPEED = 50 / 3.6; // 50 km/h in m/s
const BRAKE_LOOKAHEAD = 20; // meters
const BRAKING_FACTOR = 5; // tune braking strength

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

    const lookAheadU = Math.min(
      this.u + BRAKE_LOOKAHEAD / this.length,
      1
    );
    const futureTangent = this.curve.getTangentAt(lookAheadU);
    const angle = tangent.angleTo(futureTangent);
    this.speed -= BRAKING_FACTOR * angle * dt;

    this.speed = Math.min(Math.max(this.speed, 0), MAX_SPEED);

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
