export type VehicleBox = { x: number; z: number; yaw: number; halfWidth: number; halfLength: number };
export type ContactManifold = { normalX: number; normalZ: number; penetration: number };

const axes = (yaw: number) => [
  { x: Math.cos(yaw), z: -Math.sin(yaw) },
  { x: -Math.sin(yaw), z: -Math.cos(yaw) },
];

export function vehicleContact(a: VehicleBox, b: VehicleBox): ContactManifold | null {
  const aAxes = axes(a.yaw);
  const bAxes = axes(b.yaw);
  const dx = a.x - b.x, dz = a.z - b.z;
  let penetration = Number.POSITIVE_INFINITY;
  let normalX = 0, normalZ = 0;
  for (const axis of [...aAxes, ...bAxes]) {
    const distance = Math.abs(dx * axis.x + dz * axis.z);
    const radiusA = a.halfWidth * Math.abs(aAxes[0].x * axis.x + aAxes[0].z * axis.z)
      + a.halfLength * Math.abs(aAxes[1].x * axis.x + aAxes[1].z * axis.z);
    const radiusB = b.halfWidth * Math.abs(bAxes[0].x * axis.x + bAxes[0].z * axis.z)
      + b.halfLength * Math.abs(bAxes[1].x * axis.x + bAxes[1].z * axis.z);
    const overlap = radiusA + radiusB - distance;
    if (overlap <= 0) return null;
    if (overlap < penetration) {
      penetration = overlap;
      const sign = dx * axis.x + dz * axis.z < 0 ? -1 : 1;
      normalX = axis.x * sign;
      normalZ = axis.z * sign;
    }
  }
  return { normalX, normalZ, penetration };
}
