import * as THREE from "three";

export const RACING_TRACK_POINTS: [number, number, number][] = [
  [0, 0, 72], [30, 0, 65], [45, 0, 42], [40, 0, 16], [21, 0, 2],
  [38, 0, -24], [29, 0, -52], [0, 0, -66], [-32, 0, -54], [-43, 0, -28],
  [-26, 0, -8], [-42, 0, 17], [-32, 0, 48],
];

export function createRacingTrack() {
  return new THREE.CatmullRomCurve3(
    RACING_TRACK_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    true,
    "centripetal",
    .42,
  );
}

export function createRacingPitLane(track: THREE.CatmullRomCurve3) {
  const samples: THREE.Vector3[] = [];
  const startT = .91;
  const endT = .105;
  const span = endT + 1 - startT;
  const divisions = 84;
  const transitionLength = 12;
  for (let i = 0; i <= divisions; i++) {
    const t = (startT + span * i / divisions) % 1;
    const point = track.getPointAt(t);
    const tangent = track.getTangentAt(t).normalize();
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    // The entry begins at the outside edge of the racing surface, opens
    // outward into a parallel working lane, then returns all the way to the
    // circuit centreline at the exit. The exit must not finish one lane-width
    // outside the track: that left an invisible collision boundary at rejoin.
    const smoothstep = (value: number) => {
      const x = Math.max(0, Math.min(1, value));
      return x * x * (3 - 2 * x);
    };
    const entryBlend = smoothstep(i / transitionLength);
    const exitBlend = smoothstep((divisions - i) / transitionLength);
    const lateralOffset = i < transitionLength
      ? -6.6 - 6.6 * entryBlend
      : i > divisions - transitionLength
        ? -13.2 * exitBlend
        : -13.2;
    point.addScaledVector(side, lateralOffset);
    samples.push(point);
  }
  const pitLane = new THREE.CatmullRomCurve3(samples, false, "centripetal", .35);
  // More arc-length samples prevent small position/tangent steps during the
  // frame-by-frame world-space drive from the garage and through the service lane.
  pitLane.arcLengthDivisions = 2048;
  pitLane.updateArcLengths();
  return pitLane;
}

export function getTrackTurn(track: THREE.CatmullRomCurve3, progress: number, sample = .006) {
  const t = ((progress % 1) + 1) % 1;
  const before = track.getTangentAt((t - sample + 1) % 1).normalize();
  const after = track.getTangentAt((t + sample) % 1).normalize();
  return before.z * after.x - before.x * after.z;
}
