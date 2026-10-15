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
  float tilt = mix(.48, .82, touch.y);
  float reflectionCenter = mix(.02, tilt, vUv.y) + (touch.x - .5) * .48 + sin(vUv.y * 4.6 + touch.y * 2.) * .024 + sin(time * .18) * .012;
  float axis = vUv.x - reflectionCenter;
  float reflectionFocus = .58 + .42 * exp(-pow(abs(vUv.y - mix(.38, .62, touch.y)) * 2.35, 2.0));
  float reflection = exp(-pow(abs(axis) * 3.15, 2.1)) * (.76 + reflectionFocus * .24);
  float specular = exp(-pow(abs(axis) * 6.3, 2.0)) * reflectionFocus;
  float highlight = exp(-pow(abs(axis) * 10.5, 1.8)) * reflectionFocus;
  float prismA = exp(-pow(abs(axis - .15) * 9., 2.0));
  float prismB = exp(-pow(abs(axis + .15) * 9., 2.0));
  float pearlFlow = vUv.x * .62 - vUv.y * .26 + sin(vUv.y * 4.2 + touch.y * 1.8) * .072 + sin(vUv.x * 3.4 - touch.x * 1.4) * .045;
  vec3 pearl = .5 + .5 * cos(6.28318 * (pearlFlow + vec3(.03, .34, .68)));
  vec3 spectrum = .5 + .5 * cos(6.28318 * (vUv.y * .2 + touch.y * .12 + vec3(.02, .30, .68)));
  vec3 reverseSpectrum = spectrum.bgr;
  float glint = pow(max(0., 1. - length((vUv - touch) * vec2(.68, .92))), 7.);
  float grain = hash21(floor(vUv * size * .62) + floor(time * 2.)) - .5;
  float edge = 1. - smoothstep(2., 24., abs(distance));
  vec3 pearlFoil = vec3(.034, .041, .064) + pearl * .22 + tint * .03;
  vec3 diffraction = mix(spectrum, pearl, .62) * prismA * .13 + mix(reverseSpectrum, pearl.bgr, .58) * prismB * .11;
  vec3 whiteReflection = mix(tint, vec3(1.), .82) * (specular * .20 + highlight * .10);
  vec3 sealedColor = pearlFoil + tint * reflection * .07 + diffraction + whiteReflection + glint * .10 + grain * .006 + edge * mix(tint, vec3(1.), .42) * .15;
  vec3 cardLight = diffraction * 1.18 + mix(tint, vec3(1.), .72) * (specular * .34 + highlight * .20 + glint * .28);
  vec3 color = mix(cardLight, sealedColor, opaque);
  float alpha = mix((reflection * .08 + specular * .13 + highlight * .08 + glint * .10 + .014) * strength, 1., opaque);
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
