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
void main() {
  vec2 p = (vUv - .5) * size;
  vec2 q = abs(p) - size * .5 + 24.;
  float distance = length(max(q, 0.)) + min(max(q.x, q.y), 0.) - 24.;
  if (distance > 0.) discard;
  float band = pow(max(0., sin(vUv.x * 9. + vUv.y * 5. + touch.x * 3. + time * .4)), 12.);
  vec3 rainbow = .5 + .5 * cos(6.28318 * (vUv.x + vUv.y * .55 + touch.x * .3 + vec3(0., .33, .67)));
  float glint = pow(max(0., 1. - length(vUv - touch) * 1.3), 8.);
  float ribs = .5 + .5 * sin(vUv.y * 260.);
  vec3 metal = mix(tint * .18, tint * .65, ribs * .12 + band * .5 + glint * .3);
  vec3 color = mix(rainbow + glint * .5, metal + rainbow * band * .4, opaque);
  float alpha = mix((band * .2 + glint * .16 + .025) * strength, 1., opaque);
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
void main() {
  vec3 p = position * (30. + age * spread);
  p.y -= age * age * gravity;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
  gl_PointSize = (3. + seed * 4.) * pointScale * pixelRatio * (1. - age * .55);
  brightness = (1. - age) * (.68 + seed * .42);
}`;

export const sparkFragment = `
uniform vec3 tint;
varying float brightness;
void main() {
  float d = length(gl_PointCoord - .5) * 2.;
  if (d > 1.) discard;
  float core = pow(1. - d, 2.4);
  gl_FragColor = vec4(tint + vec3(.34), core * brightness);
}`;
