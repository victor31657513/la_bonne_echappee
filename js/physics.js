
// No Three.js symbols are needed here anymore

export class CyclistSim {
  constructor(curve, frames) {
    this.curve = curve;
    this.frames = frames;
    this.length = curve.getLength();
    this.u = 0;
    this.speed = 10; // meters per second
  }

  getFrameAt(u) {
    const scaled = u * (this.frames.tangents.length - 1);
    const i = Math.floor(scaled);
    const t = scaled - i;
    const next = Math.min(i + 1, this.frames.tangents.length - 1);
    const tangent = this.frames.tangents[i]
      .clone()
      .lerp(this.frames.tangents[next], t)
      .normalize();
    const normal = this.frames.normals[i]
      .clone()
      .lerp(this.frames.normals[next], t)
      .normalize();
    return { tangent, normal };
  }

  update(dt, mesh) {
    const { tangent, normal } = this.getFrameAt(this.u);
    const horiz = Math.hypot(tangent.x, tangent.z);
    const slope = horiz > 0 ? tangent.y / horiz : 0;
    const accel = -9.8 * slope;
    this.speed += accel * dt;
    const distance = this.speed * dt;
    this.u += distance / this.length;
    this.u = Math.min(Math.max(this.u, 0), 1);
    const pos = this.curve.getPointAt(this.u);
    const lookAtPoint = pos.clone().add(tangent);
    mesh.up.copy(normal);
    mesh.position.copy(pos);
    mesh.lookAt(lookAtPoint);
  }
}
