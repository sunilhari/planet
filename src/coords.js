import * as THREE from "three";

/**
 * Our ecliptic-frame ephemeris vectors (x,y = orbital plane, z = small
 * out-of-plane component) mapped into three.js scene space (x,z = ground
 * plane, y = up). This is a genuine rotation (Rx -90°), not a mirror, which
 * matters because orientation quaternions (src/orientation.js) are composed
 * with this same mapping — a mirror wouldn't compose correctly and would
 * silently flip which way bodies appear to spin.
 */
export function eclipticToScene({ x, y, z }, target = new THREE.Vector3()) {
  return target.set(x, z, -y);
}
