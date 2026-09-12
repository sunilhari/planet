import * as THREE from "three";
import * as Astronomy from "astronomy-engine";

const DEG2RAD = Math.PI / 180;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

// Same EQJ -> ecliptic rotation astro.js uses for positions, expressed as a
// quaternion so it can be composed with the orientation quaternions below.
const ECL_ROT = Astronomy.Rotation_EQJ_ECL();
function buildEqjToEclQuaternion() {
  const bx = Astronomy.RotateVector(ECL_ROT, { x: 1, y: 0, z: 0 });
  const by = Astronomy.RotateVector(ECL_ROT, { x: 0, y: 1, z: 0 });
  const bz = Astronomy.RotateVector(ECL_ROT, { x: 0, y: 0, z: 1 });
  const m = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(bx.x, bx.y, bx.z),
    new THREE.Vector3(by.x, by.y, by.z),
    new THREE.Vector3(bz.x, bz.y, bz.z)
  );
  return new THREE.Quaternion().setFromRotationMatrix(m);
}
const EQJ_TO_ECL_QUAT = buildEqjToEclQuaternion();

// Ecliptic -> scene, as a rotation (matches coords.js's eclipticToScene).
const ECL_TO_SCENE_QUAT = new THREE.Quaternion().setFromAxisAngle(X_AXIS, -Math.PI / 2);

// The IAU pole/spin formula below is defined with the spin axis along Z;
// THREE.SphereGeometry's pole is +Y. This fixed rotation bridges the two,
// so lat/lon points (Y-pole convention) and the mesh's own geometry agree.
const Z_TO_Y_QUAT_INV = new THREE.Quaternion().setFromAxisAngle(X_AXIS, Math.PI / 2);

const _qRa = new THREE.Quaternion();
const _qDec = new THREE.Quaternion();
const _qSpin = new THREE.Quaternion();

/**
 * True orientation (real axial tilt direction + real rotational phase) for
 * any body, from astronomy-engine's IAU pole/spin model — not an
 * approximation, and not Earth-specific. Returns a quaternion mapping
 * body-fixed (Y-pole) coordinates into three.js scene space; assign it
 * directly to an Object3D that sits at the body's position with no other
 * rotation in between.
 */
export function getBodyOrientationQuaternion(bodyName, astroTime, target = new THREE.Quaternion()) {
  const axis = Astronomy.RotationAxis(Astronomy.Body[bodyName], astroTime);
  const ra0Deg = axis.ra * 15; // astronomy-engine gives RA in hours
  const dec0Deg = axis.dec;

  _qRa.setFromAxisAngle(Z_AXIS, (ra0Deg + 90) * DEG2RAD);
  _qDec.setFromAxisAngle(X_AXIS, (90 - dec0Deg) * DEG2RAD);
  _qSpin.setFromAxisAngle(Z_AXIS, axis.spin * DEG2RAD);

  return target
    .copy(ECL_TO_SCENE_QUAT)
    .multiply(EQJ_TO_ECL_QUAT)
    .multiply(_qRa)
    .multiply(_qDec)
    .multiply(_qSpin)
    .multiply(Z_TO_Y_QUAT_INV);
}

/** Unit vector for a lat/lon point, in the same body-fixed (Y-pole) convention used above. */
export function latLonToBodyFixedVector(latDeg, lonDeg, target = new THREE.Vector3()) {
  const lat = latDeg * DEG2RAD;
  const lon = lonDeg * DEG2RAD;
  return target.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
}
