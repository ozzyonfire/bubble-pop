struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  _pad0: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var albedoSampler: sampler;
@group(0) @binding(2) var albedoTex: texture_2d<f32>;
@group(0) @binding(3) var envSampler: sampler;
@group(0) @binding(4) var envCubeTex: texture_cube<f32>;

struct VertexIn {
  @location(0) center: vec2<f32>,
  @location(1) radius: f32,
  @location(2) kind: f32,
  @location(3) color: vec4<f32>,
}

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) local: vec2<f32>,
  @location(1) world: vec2<f32>,
  @location(2) kind: f32,
  @location(3) color: vec4<f32>,
}

struct BackdropOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

@vertex
fn vsMain(in: VertexIn, @builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, 1.0)
  );

  let local = quad[vertexIndex];
  let world = in.center + local * in.radius;
  let ndc = vec2<f32>(
    (world.x / uniforms.resolution.x) * 2.0 - 1.0,
    1.0 - (world.y / uniforms.resolution.y) * 2.0
  );

  var out: VertexOut;
  out.position = vec4<f32>(ndc, 0.0, 1.0);
  out.local = local;
  out.world = world;
  out.kind = in.kind;
  out.color = in.color;
  return out;
}

fn backdrop(uv: vec2<f32>) -> vec3<f32> {
  let t = uniforms.time;
  let band = 0.5 + 0.5 * sin((uv.x * 6.5 + uv.y * 4.0) + t * 0.7);
  let drift = 0.5 + 0.5 * sin((uv.x * 3.7 - uv.y * 8.3) - t * 0.45);
  let sky = vec3<f32>(0.64, 0.9, 1.0);
  let mint = vec3<f32>(0.62, 0.97, 0.86);
  let peach = vec3<f32>(1.0, 0.86, 0.7);
  let base = mix(sky, mint, band * 0.45 + drift * 0.2);
  return mix(base, peach, drift * 0.2);
}

fn orientCubeDir(dir: vec3<f32>) -> vec3<f32> {
  let yaw = 3.14159265 + uniforms.time * 0.025;
  let pitch = -0.8;
  let roll = -0.06;

  let cr = cos(roll);
  let sr = sin(roll);
  let rolledX = dir.x * cr - dir.y * sr;
  let rolledY = dir.x * sr + dir.y * cr;

  let cy = cos(yaw);
  let sy = sin(yaw);
  let yawedX = rolledX * cy - dir.z * sy;
  let yawedZ = rolledX * sy + dir.z * cy;

  let cp = cos(pitch);
  let sp = sin(pitch);
  let pitchedY = rolledY * cp - yawedZ * sp;
  let pitchedZ = rolledY * sp + yawedZ * cp;
  return normalize(vec3<f32>(yawedX, pitchedY, pitchedZ));
}

const REFRACTION_RATIO: f32 = 1.02;
const FRESNEL_BIAS: f32 = 0.16;
const FRESNEL_SCALE: f32 = 1.1;
const FRESNEL_POWER: f32 = 1.7;

@vertex
fn vsBackdrop(@builtin(vertex_index) vertexIndex: u32) -> BackdropOut {
  var tri = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -3.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(3.0, 1.0)
  );

  let pos = tri[vertexIndex];
  var out: BackdropOut;
  out.position = vec4<f32>(pos, 0.0, 1.0);
  out.uv = pos * 0.5 + vec2<f32>(0.5, 0.5);
  return out;
}

@fragment
fn fsBackdrop(in: BackdropOut) -> @location(0) vec4<f32> {
  let color = backdrop(in.uv);
  return vec4<f32>(color, 1.0);
}

@fragment
fn fsMain(in: VertexOut) -> @location(0) vec4<f32> {
  let dist = length(in.local);
  let sphereMask = 1.0 - smoothstep(0.995, 1.01, dist);
  let particleSoft = 1.0 - smoothstep(0.7, 1.0, dist);

  let sphereZ = sqrt(max(0.0, 1.0 - dist * dist));
  let thickness = sphereZ * 2.0;
  let normal = normalize(vec3<f32>(in.local, sphereZ));
  let incident = normalize(vec3<f32>(in.local, -1.0));
  let reflected = reflect(incident, normal);
  let refractedR = refract(incident, normal, REFRACTION_RATIO);
  let refractedG = refract(incident, normal, REFRACTION_RATIO * 0.99);
  let refractedB = refract(incident, normal, REFRACTION_RATIO * 0.98);

  let uv = in.world / uniforms.resolution;
  let refractScale = mix(0.045, 0.095, 1.0 - sphereZ);
  let refractedColor = vec3<f32>(
    backdrop(uv + refractedR.xy * refractScale).r,
    backdrop(uv + refractedG.xy * refractScale).g,
    backdrop(uv + refractedB.xy * refractScale).b
  );

  let reflectedCubeDir = orientCubeDir(reflected);
  let reflectionColor = textureSample(envCubeTex, envSampler, reflectedCubeDir).rgb * 1.05;
  let bubbleUv = in.local * 0.5 + vec2<f32>(0.5, 0.5);
  let scaledUv = (bubbleUv - vec2<f32>(0.5, 0.5)) * 1.35 + vec2<f32>(0.5, 0.5);
  let swirlUv = scaledUv + reflected.xy * 0.05;
  let albedoSample = textureSample(albedoTex, albedoSampler, swirlUv).rgb;
  let reflectedTinted = mix(reflectionColor, reflectionColor * (0.7 + albedoSample * 0.3), 0.22);

  let reflectionFactor = clamp(
    FRESNEL_BIAS + FRESNEL_SCALE * pow(1.0 + dot(normalize(incident), normal), FRESNEL_POWER),
    0.0,
    1.0
  );

  let shell = mix(
    refractedColor * mix(0.86, 1.0, thickness),
    reflectedTinted,
    clamp(reflectionFactor * 1.12, 0.0, 1.0)
  );
  let bubbleColor = clamp(shell + in.color.rgb * 0.1, vec3<f32>(0.0), vec3<f32>(1.6));
  let bubbleAlpha = in.color.a * mix(0.38, 0.84, reflectionFactor) * mix(0.9, 1.0, thickness);

  let particleColor = in.color.rgb;
  let particleAlpha = in.color.a * particleSoft;

  let isBubble = in.kind >= 0.5;
  let finalColor = select(particleColor, bubbleColor, isBubble);
  let finalAlpha = select(particleAlpha, bubbleAlpha, isBubble) * sphereMask;

  return vec4<f32>(finalColor, finalAlpha);
}
