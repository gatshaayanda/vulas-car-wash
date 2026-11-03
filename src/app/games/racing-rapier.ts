import type * as RapierTypes from "@dimforge/rapier3d-compat";

type Track = {
  getPointAt(t: number): { x: number; y: number; z: number };
  getTangentAt(t: number): { x: number; y: number; z: number };
  getLength(): number;
};
export type VehicleInput = { steer: number; throttle: number; brake: number; boost: boolean };
export type VehicleSnapshot = {
  x: number; y: number; z: number; yaw: number;
  vx: number; vy: number; vz: number; speed: number;
  botX: number; botY: number; botZ: number; botYaw: number; botSpeed: number;
  botProgress: number; botLateral: number; botDrift: number;
  impact: number; rivalImpact: number; yawRate: number; botYawRate: number;
};
type RapierModule = typeof RapierTypes;
type Vehicle = { body: RapierTypes.RigidBody; controller: RapierTypes.DynamicRayCastVehicleController };

const FIXED_STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 4;
let rapierInitPromise: Promise<void> | null = null;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const wrap = (value: number) => ((value % 1) + 1) % 1;
// Rapier 0.12's vehicle controller drives along local +X. Rotate the chassis
// by +90° so local +X maps to the game's established world-space -Z forward axis.
const yawQuaternion = (yaw: number) => {
  const bodyYaw = yaw + Math.PI / 2;
  return { x: 0, y: Math.sin(bodyYaw / 2), z: 0, w: Math.cos(bodyYaw / 2) };
};

export class RapierRacePhysics {
  private accumulator = 0;
  private world: RapierTypes.World;
  private player: Vehicle;
  private rival: Vehicle;
  private track: Track;
  private botProgress = 0.025;
  private botLateral = 0;
  private targetLane = -2.45;
  private impact = 0;
  private rivalImpact = 0;
  private disposed = false;

  private constructor(world: RapierTypes.World, track: Track, player: Vehicle, rival: Vehicle) {
    this.world = world;
    this.track = track;
    this.player = player;
    this.rival = rival;
  }

  static async create(track: Track, start: { x: number; z: number; yaw: number }): Promise<RapierRacePhysics> {
    const R = await import("@dimforge/rapier3d-compat");
    try {
      rapierInitPromise ??= R.init();
      await rapierInitPromise;
    } catch (error) {
      rapierInitPromise = null;
      throw error;
    }
    const world = new R.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = FIXED_STEP;
    world.numSolverIterations = 6;

    const groundBody = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0, -0.55, 0));
    world.createCollider(R.ColliderDesc.cuboid(500, 0.5, 500).setFriction(1.15), groundBody);

    // Physical panels use the same centreline, spacing, offsets and yaw as the visible safety rails.
    const railBody = world.createRigidBody(R.RigidBodyDesc.fixed());
    for (let i = 0; i < 440; i++) {
      const t = (i % 220) / 220;
      const sideSign = i < 220 ? -1 : 1;
      const p = track.getPointAt(t);
      const tangent = track.getTangentAt(t);
      const yaw = Math.atan2(tangent.x, tangent.z);
      const collider = R.ColliderDesc.cuboid(0.12, 0.38, 1.52)
        .setTranslation(p.x - tangent.z * sideSign * 8.4, 0.58, p.z + tangent.x * sideSign * 8.4)
        .setRotation(yawQuaternion(yaw))
        .setFriction(0.82)
        .setRestitution(0.12);
      world.createCollider(collider, railBody);
    }

    const makeVehicle = (x: number, z: number, yaw: number): Vehicle => {
      const bodyDesc = R.RigidBodyDesc.dynamic()
        .setTranslation(x, 0.72, z)
        .setRotation(yawQuaternion(yaw))
        .setLinearDamping(0.035)
        .setAngularDamping(0.72)
        .setCanSleep(false)
        .setCcdEnabled(true)
        .setAdditionalSolverIterations(4);
      const body = world.createRigidBody(bodyDesc);
      world.createCollider(
        R.ColliderDesc.cuboid(1.58, 0.34, 0.91).setDensity(100).setFriction(0.72).setRestitution(0.08),
        body,
      );
      const controller = world.createVehicleController(body);
      controller.indexUpAxis = 1;
      const wheelPoints = [
        [-0.78, -0.12, -1.08], [0.78, -0.12, -1.08],
        [-0.78, -0.12, 1.08], [0.78, -0.12, 1.08],
      ];
      wheelPoints.forEach((point, index) => {
        controller.addWheel(
          { x: point[0], y: point[1], z: point[2] },
          { x: 0, y: -1, z: 0 },
          { x: 1, y: 0, z: 0 },
          0.26,
          0.37,
        );
        controller.setWheelSuspensionStiffness(index, 100);
        controller.setWheelSuspensionCompression(index, 10);
        controller.setWheelSuspensionRelaxation(index, 10);
        controller.setWheelMaxSuspensionForce(index, 14000);
        controller.setWheelSideFrictionStiffness(index, 2.4);
        controller.setWheelFrictionSlip(index, 4.2);
      });
      return { body, controller };
    };

    const player = makeVehicle(start.x, start.z, start.yaw);
    const botPoint = track.getPointAt(0.025);
    const botTangent = track.getTangentAt(0.025);
    const botYaw = Math.atan2(-botTangent.x, -botTangent.z);
    const rival = makeVehicle(botPoint.x + botTangent.z * 2.45, botPoint.z - botTangent.x * 2.45, botYaw);
    return new RapierRacePhysics(world, track, player, rival);
  }

  reset(start: { x: number; z: number; yaw: number }): void {
    this.accumulator = 0;
    this.botProgress = 0.025;
    this.botLateral = 0;
    this.targetLane = -2.45;
    const resetVehicle = (vehicle: Vehicle, x: number, z: number, yaw: number) => {
      vehicle.body.setTranslation({ x, y: 0.72, z }, true);
      vehicle.body.setRotation(yawQuaternion(yaw), true);
      vehicle.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      vehicle.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    };
    resetVehicle(this.player, start.x, start.z, start.yaw);
    const point = this.track.getPointAt(this.botProgress);
    const tangent = this.track.getTangentAt(this.botProgress);
    resetVehicle(this.rival, point.x + tangent.z * 2.45, point.z - tangent.x * 2.45, Math.atan2(-tangent.x, -tangent.z));
  }

  step(frameDelta: number, input: VehicleInput, difficulty: "Easy" | "Normal" | "Hard"): VehicleSnapshot {
    if (this.disposed) throw new Error("Rapier race physics has been disposed");
    this.accumulator = Math.min(this.accumulator + Math.min(frameDelta, 0.05), FIXED_STEP * MAX_STEPS_PER_FRAME);
    let steps = 0;
    let previousPlayer = this.readVehicle(this.player);
    let previousRival = this.readVehicle(this.rival);
    this.impact = 0;
    this.rivalImpact = 0;
    while (this.accumulator >= FIXED_STEP && steps < MAX_STEPS_PER_FRAME) {
      this.applyPlayerInput(input);
      this.applyRivalAI(difficulty);
      this.applyAerodynamicDrag(this.player.body);
      this.applyAerodynamicDrag(this.rival.body);
      this.player.controller.updateVehicle(FIXED_STEP);
      this.rival.controller.updateVehicle(FIXED_STEP);
      previousPlayer = this.readVehicle(this.player);
      previousRival = this.readVehicle(this.rival);
      const playerVelocityBefore = this.player.body.linvel();
      const rivalVelocityBefore = this.rival.body.linvel();
      this.world.step();
      const playerVelocityAfter = this.player.body.linvel();
      const rivalVelocityAfter = this.rival.body.linvel();
      const playerImpulseDelta = Math.hypot(
        playerVelocityAfter.x - playerVelocityBefore.x,
        playerVelocityAfter.y - playerVelocityBefore.y,
        playerVelocityAfter.z - playerVelocityBefore.z,
      );
      const rivalImpulseDelta = Math.hypot(
        rivalVelocityAfter.x - rivalVelocityBefore.x,
        rivalVelocityAfter.y - rivalVelocityBefore.y,
        rivalVelocityAfter.z - rivalVelocityBefore.z,
      );
      if (playerImpulseDelta > 2.8) this.impact = Math.max(this.impact, clamp(playerImpulseDelta / 12, 0, 1));
      if (rivalImpulseDelta > 2.8) this.rivalImpact = Math.max(this.rivalImpact, clamp(rivalImpulseDelta / 12, 0, 1));
      this.accumulator -= FIXED_STEP;
      steps++;
    }
    const playerCurrent = this.readVehicle(this.player);
    const rivalCurrent = this.readVehicle(this.rival);
    const alpha = clamp(this.accumulator / FIXED_STEP, 0, 1);
    const interpolate = (a: number, b: number) => a + (b - a) * alpha;
    const interpolateAngle = (a: number, b: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * alpha;
    const player = {
      x: interpolate(previousPlayer.x, playerCurrent.x),
      y: interpolate(previousPlayer.y, playerCurrent.y),
      z: interpolate(previousPlayer.z, playerCurrent.z),
      yaw: interpolateAngle(previousPlayer.yaw, playerCurrent.yaw),
      vx: interpolate(previousPlayer.vx, playerCurrent.vx),
      vy: interpolate(previousPlayer.vy, playerCurrent.vy),
      vz: interpolate(previousPlayer.vz, playerCurrent.vz),
      speed: interpolate(previousPlayer.speed, playerCurrent.speed),
    };
    const rival = {
      x: interpolate(previousRival.x, rivalCurrent.x),
      y: interpolate(previousRival.y, rivalCurrent.y),
      z: interpolate(previousRival.z, rivalCurrent.z),
      yaw: interpolateAngle(previousRival.yaw, rivalCurrent.yaw),
      vx: interpolate(previousRival.vx, rivalCurrent.vx),
      vy: interpolate(previousRival.vy, rivalCurrent.vy),
      vz: interpolate(previousRival.vz, rivalCurrent.vz),
      speed: interpolate(previousRival.speed, rivalCurrent.speed),
    };
    const botPoint = this.track.getPointAt(this.botProgress);
    const botTangent = this.track.getTangentAt(this.botProgress);
    const botSideX = -botTangent.z;
    const botSideZ = botTangent.x;
    const relativeX = rival.x - botPoint.x;
    const relativeZ = rival.z - botPoint.z;
    this.botLateral = clamp(relativeX * botSideX + relativeZ * botSideZ + 2.45, -3.3, 7.8);
    const botYaw = Math.atan2(-botTangent.x, -botTangent.z);
    const botDrift = clamp(Math.atan2(Math.sin(botYaw - rival.yaw), Math.cos(botYaw - rival.yaw)) * 1.2, -1, 1);
    return {
      ...player, botX: rival.x, botY: rival.y, botZ: rival.z, botYaw: rival.yaw, botSpeed: rival.speed,
      botProgress: this.botProgress, botLateral: this.botLateral, botDrift,
      impact: this.impact, rivalImpact: this.rivalImpact, yawRate: this.player.body.angvel().y, botYawRate: this.rival.body.angvel().y,
    };
  }

  private applyAerodynamicDrag(body: RapierTypes.RigidBody): void {
    const velocity = body.linvel();
    const speed = Math.hypot(velocity.x, velocity.z);
    if (speed < 0.1) return;
    const dragAcceleration = 0.18 + speed * speed * 0.024;
    const impulse = dragAcceleration * FIXED_STEP * body.mass();
    body.applyImpulse({ x: -velocity.x / speed * impulse, y: 0, z: -velocity.z / speed * impulse }, true);
  }

  private applyPlayerInput(input: VehicleInput): void {
    const frontSteer = -clamp(input.steer, -1, 1) * 0.42;
    const engine = input.throttle * (input.boost ? 1450 : 1120);
    const brake = input.brake * 1450;
    for (let i = 0; i < 4; i++) {
      this.player.controller.setWheelSteering(i, i < 2 ? frontSteer : 0);
      this.player.controller.setWheelEngineForce(i, engine);
      this.player.controller.setWheelBrake(i, brake);
    }
  }

  private applyRivalAI(difficulty: "Easy" | "Normal" | "Hard"): void {
    const point = this.track.getPointAt(this.botProgress);
    const tangent = this.track.getTangentAt(this.botProgress);
    const lookAheadT = wrap(this.botProgress + 0.012);
    const lookAhead = this.track.getPointAt(lookAheadT);
    const lookAheadTangent = this.track.getTangentAt(lookAheadT);
    const sideX = -tangent.z;
    const sideZ = tangent.x;
    const playerPosition = this.player.body.translation();
    const playerDx = playerPosition.x - point.x;
    const playerDz = playerPosition.z - point.z;
    const playerAlong = playerDx * tangent.x + playerDz * tangent.z;
    const playerAcross = playerDx * sideX + playerDz * sideZ;
    const playerInPassingWindow = Math.abs(playerAlong) < 24
      && Math.abs(playerAcross - this.targetLane) < 3.6;
    if (playerInPassingWindow && this.targetLane < 0) this.targetLane = 2.45;
    else if (Math.abs(playerAlong) > 32) this.targetLane = -2.45;
    const lookSideX = -lookAheadTangent.z;
    const lookSideZ = lookAheadTangent.x;
    const targetX = lookAhead.x + lookSideX * this.targetLane;
    const targetZ = lookAhead.z + lookSideZ * this.targetLane;
    const current = this.rival.body.translation();
    const currentYaw = this.readYaw(this.rival.body.rotation());
    const targetYaw = Math.atan2(-(targetX - current.x), -(targetZ - current.z));
    const steeringError = Math.atan2(Math.sin(targetYaw - currentYaw), Math.cos(targetYaw - currentYaw));
    const steer = clamp(steeringError * 1.8, -1, 1);
    const pathYaw = Math.atan2(-tangent.x, -tangent.z);
    const turn = Math.abs(Math.atan2(Math.sin(targetYaw - pathYaw), Math.cos(targetYaw - pathYaw)));
    const targetSpeed = difficulty === "Easy" ? 12.5 : difficulty === "Hard" ? 19.2 : 16.1;
    const speed = this.rival.controller.currentVehicleSpeed();
    const throttle = speed < targetSpeed - turn * 10 ? 1 : 0.35;
    const brake = speed > targetSpeed + turn * 13 ? 1600 : 0;
    for (let i = 0; i < 4; i++) {
      this.rival.controller.setWheelSteering(i, i < 2 ? steer * 0.42 : 0);
      this.rival.controller.setWheelEngineForce(i, throttle * 1120);
      this.rival.controller.setWheelBrake(i, brake);
    }
    // AI progress follows the chassis' real displacement, not a kinematic spline speed.
    const forwardX = -Math.sin(currentYaw);
    const forwardZ = -Math.cos(currentYaw);
    const velocity = this.rival.body.linvel();
    const forwardSpeed = Math.max(0, velocity.x * forwardX + velocity.z * forwardZ);
    this.botProgress = wrap(this.botProgress + forwardSpeed * FIXED_STEP / this.track.getLength());
    if (current.y < -2) {
      const recovery = this.track.getPointAt(this.botProgress);
      const direction = this.track.getTangentAt(this.botProgress);
      this.rival.body.setTranslation({ x: recovery.x, y: 0.72, z: recovery.z }, true);
      this.rival.body.setRotation(yawQuaternion(Math.atan2(-direction.x, -direction.z)), true);
      this.rival.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
  }

  private readVehicle(vehicle: Vehicle) {
    const translation = vehicle.body.translation();
    const velocity = vehicle.body.linvel();
    const yaw = this.readYaw(vehicle.body.rotation());
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const forwardSpeed = velocity.x * forwardX + velocity.z * forwardZ;
    return {
      x: translation.x, y: translation.y, z: translation.z, yaw,
      vx: velocity.x, vy: velocity.y, vz: velocity.z,
      speed: Math.max(0, forwardSpeed) * 3.6 / 0.28,
    };
  }

  private readYaw(rotation: { x: number; y: number; z: number; w: number }): number {
    return Math.atan2(
      2 * (rotation.w * rotation.y + rotation.x * rotation.z),
      1 - 2 * (rotation.y * rotation.y + rotation.z * rotation.z),
    );
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.world.free();
  }
}
