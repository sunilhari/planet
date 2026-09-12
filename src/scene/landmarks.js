import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { latLonToBodyFixedVector } from "../orientation.js";

/** A small clickable marker parented to a body's mesh, at a given lat/lon. */
export function buildLandmarkMarker(name, color, className = "body-label--minor") {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 10), new THREE.MeshBasicMaterial({ color }));
  group.add(mesh);

  const el = document.createElement("div");
  el.className = `body-label ${className}`;
  el.textContent = name;
  const label = new CSS2DObject(el);
  label.position.set(0, 0.09, 0);
  group.add(label);

  return { group, mesh, label };
}

export function placeLandmark(marker, parentMesh, latDeg, lonDeg, radiusScale = 1.03) {
  const vec = latLonToBodyFixedVector(latDeg, lonDeg);
  marker.group.position.copy(vec).multiplyScalar(radiusScale);
  parentMesh.add(marker.group);
  return vec; // handy for callers that need to re-derive the direction later
}

/** Builds one marker per site and attaches them to `parentMesh`. Returns [{marker, site}]. */
export function buildLandmarkSet(sites, parentMesh, color, className) {
  return sites.map((site) => {
    const marker = buildLandmarkMarker(site.name, color, className);
    placeLandmark(marker, parentMesh, site.lat, site.lon);
    return { marker, site };
  });
}
