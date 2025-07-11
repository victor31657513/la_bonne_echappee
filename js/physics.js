
// No Three.js symbols are needed here anymore

export class CyclistSim {
  constructor(curve, frames) {
    this.curve = curve;
    this.frames = frames;
    this.length = curve.getLength();
    this.u = 0;
    this.speed = 10; // meters per second
  }

  update(dt, mesh) {
    const index = Math.floor(this.u * (this.frames.tangents.length - 1));
    const tangent = this.frames.tangents[index];
    const horiz = Math.hypot(tangent.x, tangent.z);
    const slope = horiz > 0 ? tangent.y / horiz : 0;
    const accel = -9.8 * slope;
    this.speed += accel * dt;
    const distance = this.speed * dt;
    this.u += distance / this.length;
    this.u = Math.min(Math.max(this.u, 0), 1);
    const pos = this.curve.getPointAt(this.u);
    const lookAtPoint = pos.clone().add(tangent);
    mesh.up.copy(this.frames.normals[index]);
    mesh.position.copy(pos);
    mesh.lookAt(lookAtPoint);
  }
}
