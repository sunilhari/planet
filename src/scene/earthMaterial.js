import * as THREE from "three";

/**
 * Blends day/night Earth textures based on real sun direction (object-space).
 * Terminator is a soft band rather than a hard line, and the night side
 * shows dim city lights instead of going fully black.
 */
export function createEarthMaterial(dayTexture, nightTexture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      dayTexture: { value: dayTexture },
      nightTexture: { value: nightTexture },
      sunDirection: { value: new THREE.Vector3(1, 0, 0) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vObjectNormal;
      void main() {
        vUv = uv;
        vObjectNormal = normal; // object-space, matches sunDirection's frame
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D dayTexture;
      uniform sampler2D nightTexture;
      uniform vec3 sunDirection;
      varying vec2 vUv;
      varying vec3 vObjectNormal;

      void main() {
        float intensity = dot(normalize(vObjectNormal), normalize(sunDirection));
        float mixAmount = smoothstep(-0.18, 0.18, intensity);

        vec4 dayColor = texture2D(dayTexture, vUv);
        vec4 nightColor = texture2D(nightTexture, vUv) * 1.6;

        gl_FragColor = mix(nightColor, dayColor, mixAmount);
        gl_FragColor.a = 1.0;
      }
    `,
  });
}
