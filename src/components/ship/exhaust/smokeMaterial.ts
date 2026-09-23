// Custom point-sprite shader for cartoonish, pastel smoke puffs. Each point is
// drawn as a cluster of soft overlapping "lobes" (a cel-shaded cloud blob)
// rather than a plain dot, so a trail of them reads as voluminous smoke.

export const smokeVertexShader = /* glsl */ `
  attribute vec3 color;
  attribute float alpha;
  attribute float size;
  attribute float rotation;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vRotation;

  void main() {
    vColor = color;
    vAlpha = alpha;
    vRotation = rotation;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (260.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const smokeFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRotation;

  float puffLobe(vec2 p, vec2 center, float radius) {
    return 1.0 - smoothstep(radius * 0.65, radius, length(p - center));
  }

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float c = cos(vRotation);
    float s = sin(vRotation);
    uv = mat2(c, -s, s, c) * uv;

    // A handful of offset, overlapping lobes fake a puffy cumulus silhouette.
    float d = 0.0;
    d = max(d, puffLobe(uv, vec2(0.0, 0.06), 0.34));
    d = max(d, puffLobe(uv, vec2(-0.24, -0.06), 0.26));
    d = max(d, puffLobe(uv, vec2(0.24, -0.06), 0.26));
    d = max(d, puffLobe(uv, vec2(-0.1, -0.24), 0.22));
    d = max(d, puffLobe(uv, vec2(0.14, -0.22), 0.22));

    if (d < 0.02) discard;

    // Darken the rim slightly for a cel-shaded / cartoon outline feel.
    float rim = smoothstep(0.0, 0.14, d) - smoothstep(0.14, 0.26, d);
    vec3 shaded = mix(vColor, vColor * 0.7, rim * 0.6);

    gl_FragColor = vec4(shaded, d * vAlpha);
  }
`;
