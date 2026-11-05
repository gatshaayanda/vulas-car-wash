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
  for (let i = 0; i <= 42; i++) {
    const t = (startT + span * i / 42) % 1;
    const point = track.getPointAt(t);
    const tangent = track.getTangentAt(t).normalize();
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const blend = Math.min(1, i / 7, (42 - i) / 7);
    point.addScaledVector(side, -13 * Math.max(0, blend));
    samples.push(point);
  }
  return new THREE.CatmullRomCurve3(samples, false, "centripetal", .35);
}

export function getTrackTurn(track: THREE.CatmullRomCurve3, progress: number, sample = .006) {
  const t = ((progress % 1) + 1) % 1;
  const before = track.getTangentAt((t - sample + 1) % 1).normalize();
  const after = track.getTangentAt((t + sample) % 1).normalize();
  return before.z * after.x - before.x * after.z;
}
