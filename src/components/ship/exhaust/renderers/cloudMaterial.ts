// Point-sprite shader for the "clouds" mode: a billboarded cluster of soft
// overlapping lobes, each shaded like a fake-lit hemisphere (rather than a
// flat painted circle) so the cluster reads as a puffy 3D cloud of spheres.

export const cloudVertexShader = /* glsl */ `
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

export const cloudFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRotation;

  // Folds one lobe's contribution into the running opacity (d) and, when
  // this lobe is the closest-to-camera one at this pixel (biggest fake
  // height), into the shading normal used for the puff's fake-3D lighting.
  void evalLobe(
    vec2 uv,
    vec2 center,
    float radius,
    inout float d,
    inout float bestHeight,
    inout vec2 bestOffset
  ) {
    vec2 offset = uv - center;
    float dist = length(offset);
    d = max(d, 1.0 - smoothstep(radius * 0.65, radius, dist));

    float normDist = clamp(dist / radius, 0.0, 1.0);
    float height = sqrt(max(0.0, 1.0 - normDist * normDist));
    if (height > bestHeight) {
      bestHeight = height;
      bestOffset = offset / radius;
    }
  }

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float c = cos(vRotation);
    float s = sin(vRotation);
    uv = mat2(c, -s, s, c) * uv;

    // A handful of offset, overlapping lobes fake a puffy cumulus silhouette.
    float d = 0.0;
    float bestHeight = 0.0;
    vec2 bestOffset = vec2(0.0);
    evalLobe(uv, vec2(0.0, 0.06), 0.34, d, bestHeight, bestOffset);
    evalLobe(uv, vec2(-0.24, -0.06), 0.26, d, bestHeight, bestOffset);
    evalLobe(uv, vec2(0.24, -0.06), 0.26, d, bestHeight, bestOffset);
    evalLobe(uv, vec2(-0.1, -0.24), 0.22, d, bestHeight, bestOffset);
    evalLobe(uv, vec2(0.14, -0.22), 0.22, d, bestHeight, bestOffset);

    if (d < 0.02) discard;

    // Fake-sphere shading on the dominant lobe: a simple directional light
    // against the hemisphere normal gives each lobe a lit/shadowed side
    // instead of a flat wash of color.
    vec3 normal = normalize(vec3(-bestOffset, bestHeight * 1.4));
    vec3 lightDir = normalize(vec3(-0.4, 0.6, 0.7));
    float diffuse = max(dot(normal, lightDir), 0.0);
    vec3 shaded = vColor * (0.55 + diffuse * 0.55);

    // Darken the rim slightly for a cel-shaded / cartoon outline feel.
    float rim = smoothstep(0.0, 0.14, d) - smoothstep(0.14, 0.26, d);
    shaded = mix(shaded, shaded * 0.7, rim * 0.5);

    gl_FragColor = vec4(shaded, d * vAlpha);
  }
`;
