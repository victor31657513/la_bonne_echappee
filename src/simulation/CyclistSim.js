
import * as THREE from 'three';

const MAX_SPEED = 50 / 3.6; // 50 km/h in m/s
const BRAKE_LOOKAHEAD = 20; // meters
const BRAKING_FACTOR = 5; // tune braking strength
const PEDAL_ACCEL = 2; // m/s^2 at full intensity
const ATTACK_ACCEL = 5; // additional boost when attacking
const ATTACK_DECAY = 40; // attack energy units per second
const ATTACK_RECHARGE = 10; // energy units recharged per second
const ATTACK_ENERGY_MULT = 2; // global energy drains faster when attacking

export class CyclistSim {
  constructor(curve) {
    this.curve = curve;
    this.length = curve.getLength();
    this.u = 0;
    this.speed = 10; // meters per second
    this.energy = 100; // global energy in percent
    this.attackEnergy = 100; // energy available for attack
    this.intensity = 0; // [0,1]
    this.attackActive = false;
    this.attackDuration = 0;
    this.attackEffort = 0;
  }


  setIntensity(percent) {
    this.intensity = Math.min(Math.max(percent, 0), 100) / 100;
  }

  startAttack() {
    if (this.attackEnergy > 0 && !this.attackActive) {
      this.attackActive = true;
      this.attackDuration = this.attackEnergy / ATTACK_DECAY;
      this.attackEffort = Math.min(this.intensity * 1.2, 1);
    }
  }

  
  getSlopeFactor(tangent) {
    const horiz = Math.hypot(tangent.x, tangent.z);
    return horiz > 0 ? tangent.y / horiz : 0;
  }

  getEnergyFactor() {
    return this.energy / 100;
  }

  update(dt, mesh) {
    const tangent = this.curve.getTangentAt(this.u);
    const slope = this.getSlopeFactor(tangent);
    const energyFactor = this.getEnergyFactor();

    let effort = this.intensity;
    if (this.attackActive) {
      this.attackDuration -= dt;
      this.attackEnergy = Math.max(this.attackEnergy - ATTACK_DECAY * dt, 0);
      if (this.attackDuration <= 0 || this.attackEnergy === 0 || this.energy === 0) {
        this.attackActive = false;
      }
      effort = this.attackEffort;
    } else {
      this.attackEnergy = Math.min(this.attackEnergy + ATTACK_RECHARGE * dt, 100);
    }

    const slopeMult = Math.max(0, 1 - slope);
    let targetSpeed = MAX_SPEED * effort * energyFactor * slopeMult;
    if (this.attackActive) {
      targetSpeed += ATTACK_ACCEL * effort;
    }

    this.speed += (targetSpeed - this.speed) * dt;

    const lookAheadU = Math.min(
      this.u + BRAKE_LOOKAHEAD / this.length,
      1
    );
    const futureTangent = this.curve.getTangentAt(lookAheadU);
    const angle = tangent.angleTo(futureTangent);
    this.speed -= BRAKING_FACTOR * angle * dt;

    this.speed = Math.min(Math.max(this.speed, 0), MAX_SPEED);

    const distance = this.speed * dt;
    if (this.energy > 0 && effort > 0) {
      let energyUse = (distance / this.length) * 100 * effort;
      if (this.attackActive) {
        energyUse *= ATTACK_ENERGY_MULT;
      }
      this.energy = Math.max(this.energy - energyUse, 0);
    }
    this.u += distance / this.length;
    this.u = Math.min(Math.max(this.u, 0), 1);
    const pos = this.curve.getPointAt(this.u);
    const dir = this.curve.getTangentAt(this.u);
    const yaw = Math.atan2(dir.x, dir.z);
    mesh.position.copy(pos);
    mesh.rotation.set(0, yaw, 0);
  }

  getEnergy() {
    return this.energy;
  }

  getAttackEnergy() {
    return this.attackEnergy;
  }
}
