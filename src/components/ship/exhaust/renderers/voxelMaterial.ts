// Instanced-cube shader for the "voxels" mode. `instanceMatrix` is injected
// automatically by three.js for any material rendered on an InstancedMesh -
// declaring it ourselves would clash with that injection, so we just use it.

export const voxelVertexShader = /* glsl */ `
  attribute vec3 voxelColor;
  attribute float voxelAlpha;

  varying vec3 vColor;
  varying float vAlpha;
  varying vec3 vNormal;

  void main() {
    vColor = voxelColor;
    vAlpha = voxelAlpha;
    vNormal = normalize(normalMatrix * mat3(instanceMatrix) * normal);

    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const voxelFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying vec3 vNormal;

  void main() {
    if (vAlpha < 0.01) discard;

    vec3 lightDir = normalize(vec3(-0.4, 0.6, 0.7));
    float diffuse = max(dot(normalize(vNormal), lightDir), 0.0);
    vec3 shaded = vColor * (0.62 + diffuse * 0.7);

    gl_FragColor = vec4(shaded, vAlpha);
  }
`;
