/**
 * Petals are thin plates, not sprites on a sine wave. Broadside drag turns a
 * tilted fall into a glide, a flow-aligning torque swings each petal back and
 * forth like a falling leaf, and an offset centre of pressure makes some of
 * them tumble. Kept free of DOM access so the motion can be tuned in isolation.
 */
export type Petal = {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  /** Orientation quaternion. */
  qw: number; qx: number; qy: number; qz: number;
  /** World angular velocity, rad/s. */
  wx: number; wy: number; wz: number;
  size: number; kind: number; tumble: number; seed: number;
  age: number; alpha: number;
  /** A personal breeze, px/s, used to steer a petal toward a landing place. */
  drift: number;
};

export type Air = {
  /** Gravity in px/s². Terminal speed is roughly gravity / broadside drag. */
  gravity: number;
  /** Drag across the face of the petal and along it, per second. */
  broadside: number; edgewise: number;
  /** Strength of the torque that turns the face into the airflow. */
  align: number; spinDamping: number;
  /** Steady breeze and the size of its slow gusts, px/s. */
  breeze: number; gust: number;
};

export const AIR: Air = { gravity: 520, broadside: 6.5, edgewise: 1.1, align: 0.085, spinDamping: 1.2, breeze: 8, gust: 26 };

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** A random orientation, mostly face-on so a petal is readable as it appears. */
export function orient(p: Petal, spread = 1.1) {
  const ax = rand(-spread, spread), ay = rand(-spread, spread), az = rand(0, Math.PI * 2);
  // Yaw about the view axis, then tilt. Composed directly as a quaternion.
  const cz = Math.cos(az / 2), sz = Math.sin(az / 2), cx = Math.cos(ax / 2), sx = Math.sin(ax / 2), cy = Math.cos(ay / 2), sy = Math.sin(ay / 2);
  p.qw = cx * cy * cz + sx * sy * sz; p.qx = sx * cy * cz - cx * sy * sz;
  p.qy = cx * sy * cz + sx * cy * sz; p.qz = cx * cy * sz - sx * sy * cz;
}

export function createPetal(x: number, y: number, z: number, size: number, kind: number): Petal {
  const p: Petal = { x, y, z, vx: 0, vy: 0, vz: 0, qw: 1, qx: 0, qy: 0, qz: 0, wx: rand(-2, 2), wy: rand(-2, 2), wz: rand(-1.5, 1.5),
    size, kind, tumble: Math.random() < 0.3 ? rand(-1, 1) * 0.035 : 0, seed: Math.random() * 1000, age: 0, alpha: 1, drift: 0 };
  orient(p);
  return p;
}

/** Local axes in world space: e1 along the petal, e2 across it, n its face. */
export function axes(p: Petal) {
  const { qw: w, qx: x, qy: y, qz: z } = p;
  return {
    e1x: 1 - 2 * (y * y + z * z), e1y: 2 * (x * y + z * w), e1z: 2 * (x * z - y * w),
    e2x: 2 * (x * y - z * w), e2y: 1 - 2 * (x * x + z * z), e2z: 2 * (y * z + x * w),
    nx: 2 * (x * z + y * w), ny: 2 * (y * z - x * w), nz: 1 - 2 * (x * x + y * y),
  };
}

/** Advance one petal. Substeps keep a dropped frame from launching it. */
export function step(p: Petal, dt: number, time: number, air: Air = AIR) {
  const steps = Math.max(1, Math.ceil(dt * 150)), h = dt / steps;
  for (let s = 0; s < steps; s++) {
    const t = time + s * h;
    // Two slow, crossing gust fields. Neighbouring petals drift together, so
    // the air reads as one moving body rather than random jitter per petal.
    const windX = air.breeze + p.drift + air.gust * (Math.sin(p.y * 0.0042 + t * 0.53 + p.seed * 0.001) * 0.7 + Math.sin(p.x * 0.0031 - t * 0.37) * 0.3);
    const windZ = air.gust * 0.6 * Math.sin(p.x * 0.0027 + t * 0.41 + p.seed);
    const ax = p.vx - windX, ay = p.vy, az = p.vz - windZ;
    const { e1x, e1y, e1z, nx, ny, nz } = axes(p);
    const an = ax * nx + ay * ny + az * nz;
    const tx = ax - an * nx, ty = ay - an * ny, tz = az - an * nz;
    p.vx += (-air.broadside * an * nx - air.edgewise * tx) * h;
    p.vy += (air.gravity - air.broadside * an * ny - air.edgewise * ty) * h;
    p.vz += (-air.broadside * an * nz - air.edgewise * tz) * h;
    // Turn the face toward the airflow: dn/dt = (n x a) x n moves n onto a.
    const sign = an >= 0 ? 1 : -1;
    let tqx = air.align * sign * (ny * az - nz * ay);
    let tqy = air.align * sign * (nz * ax - nx * az);
    let tqz = air.align * sign * (nx * ay - ny * ax);
    if (p.tumble) {
      const speed = Math.hypot(ax, ay, az);
      tqx += p.tumble * speed * e1x; tqy += p.tumble * speed * e1y; tqz += p.tumble * speed * e1z;
    }
    const damp = Math.exp(-air.spinDamping * h);
    p.wx = (p.wx + tqx * h) * damp; p.wy = (p.wy + tqy * h) * damp; p.wz = (p.wz + tqz * h) * damp;
    p.x += p.vx * h; p.y += p.vy * h; p.z += p.vz * h;
    rotate(p, p.wx, p.wy, p.wz, h);
  }
  p.age += dt;
}

/** Integrate a world angular velocity into the orientation. */
export function rotate(p: Petal, wx: number, wy: number, wz: number, h: number) {
  const { qw, qx, qy, qz } = p;
  const dw = -(wx * qx + wy * qy + wz * qz), dx = qw * wx + (wy * qz - wz * qy), dy = qw * wy + (wz * qx - wx * qz), dz = qw * wz + (wx * qy - wy * qx);
  p.qw += dw * h * 0.5; p.qx += dx * h * 0.5; p.qy += dy * h * 0.5; p.qz += dz * h * 0.5;
  const length = Math.hypot(p.qw, p.qx, p.qy, p.qz) || 1;
  p.qw /= length; p.qx /= length; p.qy /= length; p.qz /= length;
}

/** A resting orientation: lying flat, face up, turned by yaw about the vertical. */
export function restingQuaternion(yaw: number): [number, number, number, number] {
  // Quarter turn about x lays the face up; then yaw about the vertical axis.
  const f = Math.SQRT1_2, cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2);
  return [cy * f, cy * f, sy * f, -sy * f];
}

/** Ease toward an orientation along the shorter arc. */
export function easeOrientation(p: Petal, q: [number, number, number, number], k: number) {
  const sign = p.qw * q[0] + p.qx * q[1] + p.qy * q[2] + p.qz * q[3] < 0 ? -1 : 1;
  p.qw += (q[0] * sign - p.qw) * k; p.qx += (q[1] * sign - p.qx) * k;
  p.qy += (q[2] * sign - p.qy) * k; p.qz += (q[3] * sign - p.qz) * k;
  const length = Math.hypot(p.qw, p.qx, p.qy, p.qz) || 1;
  p.qw /= length; p.qx /= length; p.qy /= length; p.qz /= length;
}
