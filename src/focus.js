import * as THREE from "three";

const DURATION_MS = 900;

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Drives the "full-screen" close-up view: tweens the camera in to orbit a
 * clicked body, then follows it each frame as it continues moving along its
 * real orbit (so rotation/day-night stay visible), and tweens back out to
 * the saved wide view on exit.
 */
export function createFocusController({ camera, controls }) {
  let active = false;
  let body = null;
  let transitioning = false;
  const previousWorldPos = new THREE.Vector3();
  const savedCameraPos = new THREE.Vector3();
  const savedTarget = new THREE.Vector3();
  const _worldPos = new THREE.Vector3();
  const _worldScale = new THREE.Vector3();
  const _delta = new THREE.Vector3();

  function tween(fromPos, toPos, fromTarget, toTarget, onDone) {
    transitioning = true;
    controls.enabled = false;
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const e = easeInOutQuad(t);
      camera.position.lerpVectors(fromPos, toPos, e);
      controls.target.lerpVectors(fromTarget, toTarget, e);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        transitioning = false;
        controls.enabled = true;
        onDone?.();
      }
    }
    requestAnimationFrame(step);
  }

  /** mesh: the Object3D to focus on; distanceMultiplier: radii away to orbit at. */
  function focusOn(mesh, distanceMultiplier = 4.5) {
    if (!active) {
      savedCameraPos.copy(camera.position);
      savedTarget.copy(controls.target);
    }
    active = true;
    body = mesh;

    mesh.getWorldPosition(_worldPos);
    mesh.getWorldScale(_worldScale);
    previousWorldPos.copy(_worldPos);

    const dist = Math.max(_worldScale.x * distanceMultiplier, 0.6);
    const dir = camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(0.4, 0.35, 1);
    dir.normalize();

    const fromPos = camera.position.clone();
    const fromTarget = controls.target.clone();
    const toTarget = _worldPos.clone();
    const toPos = toTarget.clone().add(dir.multiplyScalar(dist));
    tween(fromPos, toPos, fromTarget, toTarget);
  }

  function exit(onDone, immediate = false) {
    if (!active) return;
    if (immediate) {
      transitioning = false;
      controls.enabled = true;
      camera.position.copy(savedCameraPos);
      controls.target.copy(savedTarget);
      active = false;
      body = null;
      onDone?.();
      return;
    }
    const fromPos = camera.position.clone();
    const fromTarget = controls.target.clone();
    tween(fromPos, savedCameraPos.clone(), fromTarget, savedTarget.clone(), () => {
      active = false;
      body = null;
      onDone?.();
    });
  }

  /** Call every frame: keeps the camera locked on the body as it orbits. */
  function update() {
    if (!active || !body || transitioning) return;
    body.getWorldPosition(_worldPos);
    _delta.subVectors(_worldPos, previousWorldPos);
    if (_delta.lengthSq() > 0) {
      camera.position.add(_delta);
      controls.target.add(_delta);
    }
    previousWorldPos.copy(_worldPos);
  }

  return {
    focusOn,
    exit,
    update,
    get isActive() {
      return active;
    },
    get isTransitioning() {
      return transitioning;
    },
    get body() {
      return body;
    },
  };
}
