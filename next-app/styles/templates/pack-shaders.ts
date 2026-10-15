export const foilVertex = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const foilFragment = `
uniform float time;
uniform float strength;
uniform float opaque;
uniform float fade;
uniform vec2 touch;
uniform vec2 size;
uniform vec3 tint;
varying vec2 vUv;
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
void main() {
  vec2 p = (vUv - .5) * size;
  vec2 q = abs(p) - size * .5 + 24.;
  float distance = length(max(q, 0.)) + min(max(q.x, q.y), 0.) - 24.;
  if (distance > 0.) discard;
  float ribbonCenter = mix(-.18, 1.12, vUv.y) + (touch.x - .5) * .12 + sin(time * .22) * .025;
  float ribbon = exp(-pow(abs(vUv.x - ribbonCenter) * 8.5, 1.7));
  float core = exp(-pow(abs(vUv.x - ribbonCenter) * 29., 1.45));
  vec3 spectrum = .52 + .48 * cos(6.28318 * (vUv.y * .32 + vec3(.02, .30, .68)));
  float glint = pow(max(0., 1. - length((vUv - touch) * vec2(.82, 1.12))), 11.);
  float grain = hash21(floor(vUv * size * .62) + floor(time * 2.)) - .5;
  float edge = smoothstep(24., 2., abs(distance));
  vec3 darkFoil = vec3(.018, .021, .038) + tint * .055;
  vec3 sealedColor = darkFoil + spectrum * ribbon * .30 + mix(tint, vec3(1.), .5) * core * .72 + grain * .022 + edge * tint * .055;
  vec3 cardLight = spectrum * ribbon * .36 + mix(tint, vec3(1.), .45) * (core * .72 + glint * .42);
  vec3 color = mix(cardLight, sealedColor, opaque);
  float alpha = mix((ribbon * .20 + core * .18 + glint * .14 + .018) * strength, 1., opaque);
  gl_FragColor = vec4(color, alpha * fade);
}`;

export const sparkVertex = `
attribute float seed;
uniform float age;
uniform float pixelRatio;
uniform float spread;
uniform float pointScale;
uniform float gravity;
varying float brightness;
varying float sparkle;
void main() {
  vec3 p = position * (30. + age * spread);
  p.y -= age * age * gravity;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
  gl_PointSize = (3. + seed * 4.) * pointScale * pixelRatio * (1. - age * .55);
  brightness = (1. - age) * (.68 + seed * .42);
  sparkle = seed;
}`;

export const sparkFragment = `
uniform vec3 tint;
varying float brightness;
varying float sparkle;
void main() {
  vec2 p = (gl_PointCoord - .5) * 2.;
  float d = length(p);
  if (d > 1.) discard;
  float core = pow(1. - d, 2.8);
  float horizontal = pow(max(0., 1. - abs(p.y) * 10.), 3.) * pow(max(0., 1. - abs(p.x)), 2.);
  float vertical = pow(max(0., 1. - abs(p.x) * 10.), 3.) * pow(max(0., 1. - abs(p.y)), 2.);
  float star = (horizontal + vertical) * smoothstep(.72, 1., sparkle);
  vec3 color = mix(tint, vec3(1.), .58 + sparkle * .24);
  gl_FragColor = vec4(color, (core + star * .82) * brightness);
}`;
