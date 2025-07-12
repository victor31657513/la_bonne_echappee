
import * as THREE from 'three';

const MAX_SPEED = 50 / 3.6; // 50 km/h in m/s
const BRAKE_LOOKAHEAD = 20; // meters
const BRAKING_FACTOR = 5; // tune braking strength
const PEDAL_ACCEL = 2; // m/s^2 at full intensity
const ENERGY_DECAY = 10; // energy units per second at full intensity
const ATTACK_ACCEL = 5; // additional boost when attacking
const ATTACK_DECAY = 40; // attack energy units per second
const ATTACK_RECHARGE = 10; // energy units recharged per second
const ATTACK_INTENSITY_BOOST = 1.2; // intensity multiplier during attack
const ATTACK_ENERGY_FACTOR = 2; // how much faster global energy depletes

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
    this.attackTimeRemaining = 0;
    this.attackBoost = 0;
  }


  setIntensity(percent) {
    this.intensity = Math.min(Math.max(percent, 0), 100) / 100;
  }

  startAttack() {
    if (this.attackEnergy > 0 && this.energy > 0 && !this.attackActive) {
      this.attackActive = true;
      this.attackBoost = Math.min(this.intensity * ATTACK_INTENSITY_BOOST, 1);
      const energyLimit = this.energy / (ENERGY_DECAY * this.attackBoost * ATTACK_ENERGY_FACTOR);
      const attackLimit = this.attackEnergy / ATTACK_DECAY;
      this.attackTimeRemaining = Math.min(energyLimit, attackLimit);
    }
  }

  
  update(dt, mesh) {
    const tangent = this.curve.getTangentAt(this.u);
    const horiz = Math.hypot(tangent.x, tangent.z);
    const slope = horiz > 0 ? tangent.y / horiz : 0;

    let accel = -9.8 * slope;

    let effort = this.intensity;
    if (this.attackActive) {
      const boosted = this.attackBoost;
      accel += ATTACK_ACCEL;
      effort = boosted;
      this.attackEnergy = Math.max(this.attackEnergy - ATTACK_DECAY * dt, 0);
      this.energy = Math.max(this.energy - ENERGY_DECAY * boosted * ATTACK_ENERGY_FACTOR * dt, 0);
      this.attackTimeRemaining -= dt;
      if (this.attackTimeRemaining <= 0 || this.attackEnergy === 0 || this.energy === 0) {
        this.attackActive = false;
        this.attackBoost = 0;
        this.attackTimeRemaining = 0;
      }
    } else {
      this.attackEnergy = Math.min(this.attackEnergy + ATTACK_RECHARGE * dt, 100);
    }

    if (this.energy > 0 && effort > 0) {
      accel += PEDAL_ACCEL * effort;
      if (!this.attackActive) {
        const stepDist = this.speed * dt;
        const remaining = Math.max(this.length * (1 - this.u), stepDist);
        if (effort === 1) {
          const energyUse = (this.energy * stepDist) / remaining;
          this.energy = Math.max(this.energy - energyUse, 0);
        } else {
          this.energy = Math.max(this.energy - ENERGY_DECAY * effort * dt, 0);
        }
      }
    } else if (this.energy === 0) {
      effort = 0;
    }

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

  getEnergy() {
    return this.energy;
  }

  getAttackEnergy() {
    return this.attackEnergy;
  }

  isAttacking() {
    return this.attackActive;
  }
}
