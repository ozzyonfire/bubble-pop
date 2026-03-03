import bubblesShaderSource from "./shaders/bubbles.wgsl?raw";

type Bubble = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  wobble: number;
  wobbleSpeed: number;
  color: [number, number, number, number];
};

type Particle = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  color: [number, number, number, number];
};

type RenderCircle = {
  x: number;
  y: number;
  r: number;
  kind: number;
  color: [number, number, number, number];
};

type BubbleRenderer = {
  resize: (width: number, height: number, dpr: number) => void;
  render: (circles: RenderCircle[], timeSeconds: number) => void;
};

const INITIAL_BUBBLES = 100;
const HITBOX_EXTRA = 10;
const INSTANCE_FLOATS = 8;
const GPU_BUFFER_USAGE_COPY_DST = 0x0008;
const GPU_BUFFER_USAGE_VERTEX = 0x0020;
const GPU_BUFFER_USAGE_UNIFORM = 0x0040;
const GPU_SHADER_STAGE_VERTEX = 0x1;
const GPU_SHADER_STAGE_FRAGMENT = 0x2;
const GPU_TEXTURE_USAGE_COPY_DST = 0x02;
const GPU_TEXTURE_USAGE_TEXTURE_BINDING = 0x04;
const GPU_TEXTURE_USAGE_RENDER_ATTACHMENT = 0x10;
const ENV_CUBE_FACES = ["px", "nx", "py", "ny", "pz", "nz"] as const;
const ENV_CUBEMAP_STRIP_PATH = "/textures/env/cubemap2.png";

const canvasEl = document.querySelector<HTMLCanvasElement>("#game");
if (!canvasEl) {
  throw new Error("Missing #game canvas element");
}
const canvas: HTMLCanvasElement = canvasEl;

const scoreNode = document.querySelector<HTMLElement>("#score");
if (!scoreNode) {
  throw new Error("Missing #score element");
}
const scoreEl: HTMLElement = scoreNode;

const hintEl = document.querySelector<HTMLElement>("#hint");
const resetBtn = document.querySelector<HTMLButtonElement>("#resetBtn");

let renderer: BubbleRenderer | null = null;
let fallbackCtx: CanvasRenderingContext2D | null = null;

let dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
let W = 0;
let H = 0;
let bubbles: Bubble[] = [];
let particles: Particle[] = [];
let score = 0;
let lastTs = 0;

const COLORS = ["#60a5fa", "#34d399", "#fbbf24", "#fb7185", "#a78bfa", "#22d3ee"];

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[(Math.random() * arr.length) | 0] as T;
}

function hexToRgba(hex: string, alpha: number): [number, number, number, number] {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
    alpha,
  ];
}

function setScore(v: number): void {
  scoreEl.textContent = String(v);
}

function resize(): void {
  dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const rect = canvas.getBoundingClientRect();
  W = Math.max(1, Math.floor(rect.width));
  H = Math.max(1, Math.floor(rect.height));

  if (renderer) {
    renderer.resize(W, H, dpr);
    return;
  }

  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  fallbackCtx?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function spawnBubble(initial = false): void {
  const r = rand(16, 34);
  bubbles.push({
    x: rand(r + 8, W - r - 8),
    y: initial ? rand(r + 60, H - r - 8) : H + r + rand(0, 120),
    r,
    vx: rand(-18, 18),
    vy: -rand(24, 86),
    wobble: rand(0, Math.PI * 2),
    wobbleSpeed: rand(1.2, 2.8),
    color: hexToRgba(pick(COLORS), 0.72),
  });
}

function recycleBubble(b: Bubble): void {
  b.r = rand(16, 34);
  b.x = rand(b.r + 8, W - b.r - 8);
  b.y = H + b.r + rand(0, 140);
  b.vx = rand(-18, 18);
  b.vy = -rand(24, 86);
  b.wobble = rand(0, Math.PI * 2);
  b.wobbleSpeed = rand(1.2, 2.8);
  b.color = hexToRgba(pick(COLORS), 0.72);
}

function reset(): void {
  bubbles = [];
  particles = [];
  score = 0;
  setScore(score);
  for (let i = 0; i < INITIAL_BUBBLES; i++) {
    spawnBubble(true);
  }
}

function spawnPopParticles(x: number, y: number, color: [number, number, number, number]): void {
  const count = 16;
  for (let i = 0; i < count; i++) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(55, 210);
    particles.push({
      x,
      y,
      r: rand(1.5, 4.5),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: rand(0.35, 0.75),
      age: 0,
      color: [color[0], color[1], color[2], rand(0.45, 0.85)],
    });
  }
}

function popAt(x: number, y: number): void {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    const dx = x - b.x;
    const dy = y - b.y;
    const rr = b.r + HITBOX_EXTRA;
    if (dx * dx + dy * dy <= rr * rr) {
      score += 1;
      setScore(score);
      hintEl?.style.setProperty("opacity", "0");
      spawnPopParticles(b.x, b.y, b.color);
      recycleBubble(b);
      return;
    }
  }
}

function update(dt: number): void {
  for (const b of bubbles) {
    b.wobble += dt * b.wobbleSpeed;
    b.x += b.vx * dt + Math.sin(b.wobble) * 8 * dt;
    b.y += b.vy * dt;

    if (b.x < b.r + 6) {
      b.x = b.r + 6;
      b.vx = Math.abs(b.vx) * 0.9;
    } else if (b.x > W - b.r - 6) {
      b.x = W - b.r - 6;
      b.vx = -Math.abs(b.vx) * 0.9;
    }

    if (b.y < -b.r - 100) {
      recycleBubble(b);
    }
  }

  for (const p of particles) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 480 * dt;
    p.vx *= Math.pow(0.05, dt);
    p.vy *= Math.pow(0.08, dt);
  }
  particles = particles.filter((p) => p.age < p.life);
}

function renderFallback2D(timeSeconds: number): void {
  if (!fallbackCtx) {
    return;
  }

  fallbackCtx.clearRect(0, 0, W, H);
  const driftX = Math.sin(timeSeconds * 0.14) * W * 0.12;
  const driftY = Math.cos(timeSeconds * 0.11) * H * 0.16;
  const bg = fallbackCtx.createLinearGradient(-driftX, driftY, W + driftX, H - driftY);
  bg.addColorStop(0, "#9de8ff");
  bg.addColorStop(0.36, "#b8f8dd");
  bg.addColorStop(0.72, "#ffe6b0");
  bg.addColorStop(1, "#ffc8dd");
  fallbackCtx.fillStyle = bg;
  fallbackCtx.fillRect(0, 0, W, H);

  for (const b of bubbles) {
    const grad = fallbackCtx.createRadialGradient(
      b.x - b.r * 0.25,
      b.y - b.r * 0.35,
      b.r * 0.15,
      b.x,
      b.y,
      b.r
    );
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.2, "rgba(255,255,255,0.35)");
    grad.addColorStop(1, "rgba(255,255,255,0.15)");

    fallbackCtx.beginPath();
    fallbackCtx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    fallbackCtx.fillStyle = grad;
    fallbackCtx.fill();
    fallbackCtx.lineWidth = 2;
    fallbackCtx.strokeStyle = "rgba(255,255,255,0.55)";
    fallbackCtx.stroke();
  }

  for (const p of particles) {
    const t = 1 - p.age / p.life;
    fallbackCtx.globalAlpha = Math.max(0, t);
    fallbackCtx.fillStyle = `rgba(${Math.round(p.color[0] * 255)}, ${Math.round(p.color[1] * 255)}, ${Math.round(p.color[2] * 255)}, ${p.color[3]})`;
    fallbackCtx.beginPath();
    fallbackCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    fallbackCtx.fill();
  }
  fallbackCtx.globalAlpha = 1;
}

function getGpuApi() {
  return navigator.gpu;
}

async function createAlbedoTexture(device: GPUDevice): Promise<GPUTexture> {
  const fallbackTexture = device.createTexture({
    size: { width: 1, height: 1 },
    format: "rgba8unorm",
    usage:
      GPU_TEXTURE_USAGE_TEXTURE_BINDING |
      GPU_TEXTURE_USAGE_COPY_DST |
      GPU_TEXTURE_USAGE_RENDER_ATTACHMENT,
  });

  device.queue.writeTexture(
    { texture: fallbackTexture },
    new Uint8Array([255, 255, 255, 255]),
    { bytesPerRow: 4 },
    { width: 1, height: 1 }
  );

  try {
    const response = await fetch("/textures/albedo.png");
    if (!response.ok) {
      console.warn("Albedo texture request failed, using fallback", response.status);
      return fallbackTexture;
    }

    const blob = await response.blob();
    const imageBitmap = await createImageBitmap(blob);
    const texture = device.createTexture({
      size: { width: imageBitmap.width, height: imageBitmap.height },
      format: "rgba8unorm",
      usage:
        GPU_TEXTURE_USAGE_TEXTURE_BINDING |
        GPU_TEXTURE_USAGE_COPY_DST |
        GPU_TEXTURE_USAGE_RENDER_ATTACHMENT,
    });

    device.queue.copyExternalImageToTexture(
      { source: imageBitmap },
      { texture },
      { width: imageBitmap.width, height: imageBitmap.height }
    );
    imageBitmap.close();
    return texture;
  } catch (error) {
    console.error("Failed to load albedo texture, using fallback", error);
    return fallbackTexture;
  }
}

function writeSolidCubeFace(device: GPUDevice, texture: GPUTexture, layer: number, rgba: readonly [number, number, number, number]): void {
  device.queue.writeTexture(
    { texture, origin: { x: 0, y: 0, z: layer } },
    new Uint8Array(rgba),
    { bytesPerRow: 4 },
    { width: 1, height: 1, depthOrArrayLayers: 1 }
  );
}

async function createEnvironmentCubeTexture(device: GPUDevice): Promise<GPUTexture> {
  const fallbackCube = device.createTexture({
    size: { width: 1, height: 1, depthOrArrayLayers: 6 },
    dimension: "2d",
    format: "rgba8unorm",
    usage:
      GPU_TEXTURE_USAGE_TEXTURE_BINDING |
      GPU_TEXTURE_USAGE_COPY_DST |
      GPU_TEXTURE_USAGE_RENDER_ATTACHMENT,
  });

  const fallbackFaces: [number, number, number, number][] = [
    [130, 188, 255, 255],
    [130, 188, 255, 255],
    [175, 220, 255, 255],
    [245, 214, 170, 255],
    [140, 196, 255, 255],
    [140, 196, 255, 255],
  ];
  for (let i = 0; i < 6; i++) {
    writeSolidCubeFace(device, fallbackCube, i, fallbackFaces[i]);
  }

  try {
    const stripResponse = await fetch(ENV_CUBEMAP_STRIP_PATH);
    if (stripResponse.ok) {
      const stripBitmap = await createImageBitmap(await stripResponse.blob());
      const faceWidth = Math.floor(stripBitmap.width / 6);
      const faceHeight = stripBitmap.height;
      const validStrip =
        faceWidth > 0 &&
        faceHeight > 0 &&
        faceWidth * 6 === stripBitmap.width &&
        faceWidth === faceHeight;

      if (validStrip) {
        const cube = device.createTexture({
          size: { width: faceWidth, height: faceHeight, depthOrArrayLayers: 6 },
          dimension: "2d",
          format: "rgba8unorm",
          usage:
            GPU_TEXTURE_USAGE_TEXTURE_BINDING |
            GPU_TEXTURE_USAGE_COPY_DST |
            GPU_TEXTURE_USAGE_RENDER_ATTACHMENT,
        });

        for (let i = 0; i < 6; i++) {
          const faceBitmap = await createImageBitmap(stripBitmap, i * faceWidth, 0, faceWidth, faceHeight);
          device.queue.copyExternalImageToTexture(
            { source: faceBitmap },
            { texture: cube, origin: { x: 0, y: 0, z: i } },
            { width: faceWidth, height: faceHeight, depthOrArrayLayers: 1 }
          );
          faceBitmap.close();
        }

        stripBitmap.close();
        console.info(
          "Loaded environment cubemap strip",
          ENV_CUBEMAP_STRIP_PATH,
          `${faceWidth}x${faceHeight} per face`,
          "order: +X, -X, +Y, -Y, +Z, -Z"
        );
        return cube;
      }

      stripBitmap.close();
      console.warn("Environment cubemap strip has invalid dimensions, trying per-face images");
    }

    const bitmaps = await Promise.all(
      ENV_CUBE_FACES.map(async (face) => {
        const response = await fetch(`/textures/env/${face}.png`);
        if (!response.ok) {
          throw new Error(`Missing env face ${face}.png (${response.status})`);
        }
        return createImageBitmap(await response.blob());
      })
    );

    const width = bitmaps[0].width;
    const height = bitmaps[0].height;
    const sameDimensions = bitmaps.every((bmp) => bmp.width === width && bmp.height === height);
    if (!sameDimensions || width <= 0 || height <= 0) {
      bitmaps.forEach((bmp) => bmp.close());
      console.warn("Environment cube faces invalid dimensions, using fallback cube");
      return fallbackCube;
    }

    const cube = device.createTexture({
      size: { width, height, depthOrArrayLayers: 6 },
      dimension: "2d",
      format: "rgba8unorm",
      usage:
        GPU_TEXTURE_USAGE_TEXTURE_BINDING |
        GPU_TEXTURE_USAGE_COPY_DST |
        GPU_TEXTURE_USAGE_RENDER_ATTACHMENT,
    });

    for (let i = 0; i < bitmaps.length; i++) {
      device.queue.copyExternalImageToTexture(
        { source: bitmaps[i] },
        { texture: cube, origin: { x: 0, y: 0, z: i } },
        { width, height, depthOrArrayLayers: 1 }
      );
      bitmaps[i].close();
    }

    return cube;
  } catch (error) {
    console.warn("Environment cube texture load failed, using fallback", error);
    return fallbackCube;
  }
}

async function createWebGpuRenderer(canvasEl: HTMLCanvasElement): Promise<BubbleRenderer | null> {
  const gpu = getGpuApi();
  if (!gpu) {
    console.info("WebGPU unavailable: navigator.gpu is missing");
    return null;
  }

  let device: GPUDevice;
  {
    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      console.info("WebGPU unavailable: could not acquire GPU adapter");
      return null;
    }
    device = await adapter.requestDevice();
  }

  const context = canvasEl.getContext("webgpu");
  if (!context) {
    console.info("WebGPU unavailable: canvas webgpu context not supported");
    return null;
  }

  const format = gpu.getPreferredCanvasFormat();
  const uniformBuffer = device.createBuffer({
    size: 16,
    usage: GPU_BUFFER_USAGE_UNIFORM | GPU_BUFFER_USAGE_COPY_DST,
  });
  let instanceCapacity = INITIAL_BUBBLES;
  let instanceBuffer = device.createBuffer({
    size: instanceCapacity * INSTANCE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: GPU_BUFFER_USAGE_VERTEX | GPU_BUFFER_USAGE_COPY_DST,
  });

  const shaderModule = device.createShaderModule({
    code: bubblesShaderSource,
  });
  const albedoTexture = await createAlbedoTexture(device);
  const envCubeTexture = await createEnvironmentCubeTexture(device);
  const albedoSampler = device.createSampler({
    addressModeU: "repeat",
    addressModeV: "repeat",
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
  });
  const envCubeSampler = device.createSampler({
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
  });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPU_SHADER_STAGE_VERTEX | GPU_SHADER_STAGE_FRAGMENT,
        buffer: { type: "uniform" },
      },
      {
        binding: 1,
        visibility: GPU_SHADER_STAGE_FRAGMENT,
        sampler: { type: "filtering" },
      },
      {
        binding: 2,
        visibility: GPU_SHADER_STAGE_FRAGMENT,
        texture: { sampleType: "float" },
      },
      {
        binding: 3,
        visibility: GPU_SHADER_STAGE_FRAGMENT,
        sampler: { type: "filtering" },
      },
      {
        binding: 4,
        visibility: GPU_SHADER_STAGE_FRAGMENT,
        texture: { sampleType: "float", viewDimension: "cube" },
      },
    ],
  });

  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

  const backdropPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: "vsBackdrop",
      buffers: [],
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fsBackdrop",
      targets: [{ format }],
    },
    primitive: { topology: "triangle-list" },
  });

  const pipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: "vsMain",
      buffers: [
        {
          arrayStride: INSTANCE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
          stepMode: "instance",
          attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x2" },
            { shaderLocation: 1, offset: 2 * Float32Array.BYTES_PER_ELEMENT, format: "float32" },
            { shaderLocation: 2, offset: 3 * Float32Array.BYTES_PER_ELEMENT, format: "float32" },
            { shaderLocation: 3, offset: 4 * Float32Array.BYTES_PER_ELEMENT, format: "float32x4" },
          ],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fsMain",
      targets: [
        {
          format,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
          },
        },
      ],
    },
    primitive: { topology: "triangle-list" },
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: albedoSampler },
      { binding: 2, resource: albedoTexture.createView() },
      { binding: 3, resource: envCubeSampler },
      { binding: 4, resource: envCubeTexture.createView({ dimension: "cube" }) },
    ],
  });

  let instanceData = new Float32Array(instanceCapacity * INSTANCE_FLOATS);

  function ensureInstanceCapacity(count: number): void {
    if (count <= instanceCapacity) {
      return;
    }

    while (instanceCapacity < count) {
      instanceCapacity *= 2;
    }

    instanceBuffer.destroy();
    instanceBuffer = device.createBuffer({
      size: instanceCapacity * INSTANCE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      usage: GPU_BUFFER_USAGE_VERTEX | GPU_BUFFER_USAGE_COPY_DST,
    });
    instanceData = new Float32Array(instanceCapacity * INSTANCE_FLOATS);
  }

  return {
    resize(width: number, height: number, pixelRatio: number): void {
      canvasEl.width = Math.floor(width * pixelRatio);
      canvasEl.height = Math.floor(height * pixelRatio);
      context.configure({
        device,
        format,
        alphaMode: "opaque",
      });
      device.queue.writeBuffer(
        uniformBuffer,
        0,
        new Float32Array([width, height, 0, 0])
      );
    },
    render(items: RenderCircle[], timeSeconds: number): void {
      device.queue.writeBuffer(
        uniformBuffer,
        0,
        new Float32Array([W, H, timeSeconds, 0])
      );
      ensureInstanceCapacity(items.length);

      for (let i = 0; i < items.length; i++) {
        const b = items[i];
        const o = i * INSTANCE_FLOATS;
        instanceData[o] = b.x;
        instanceData[o + 1] = b.y;
        instanceData[o + 2] = b.r;
        instanceData[o + 3] = b.kind;
        instanceData[o + 4] = b.color[0];
        instanceData[o + 5] = b.color[1];
        instanceData[o + 6] = b.color[2];
        instanceData[o + 7] = b.color[3];
      }

      const instanceCount = items.length * INSTANCE_FLOATS;
      device.queue.writeBuffer(instanceBuffer, 0, instanceData.subarray(0, instanceCount));

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(backdropPipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(3, 1, 0, 0);

      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, instanceBuffer);
      pass.draw(6, items.length, 0, 0);
      pass.end();
      device.queue.submit([encoder.finish()]);
    },
  };
}

function getPointerPos(ev: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
}

function step(ts: number): void {
  if (!lastTs) {
    lastTs = ts;
  }
  const dt = Math.min(0.033, (ts - lastTs) / 1000);
  lastTs = ts;

  update(dt);

  if (renderer) {
    const circles: RenderCircle[] = [];
    for (const b of bubbles) {
      circles.push({ x: b.x, y: b.y, r: b.r, kind: 1, color: b.color });
    }
    for (const p of particles) {
      const t = 1 - p.age / p.life;
      circles.push({
        x: p.x,
        y: p.y,
        r: p.r,
        kind: 0,
        color: [p.color[0], p.color[1], p.color[2], Math.max(0, p.color[3] * t)],
      });
    }
    renderer.render(circles, ts * 0.001);
  } else {
    renderFallback2D(ts * 0.001);
  }

  requestAnimationFrame(step);
}

async function bootstrap(): Promise<void> {
  renderer = await createWebGpuRenderer(canvas);
  if (!renderer) {
    fallbackCtx = canvas.getContext("2d", { alpha: true });
    if (!fallbackCtx) {
      throw new Error("Could not create a rendering context (WebGPU or 2D)");
    }
    console.info("Renderer mode: Canvas 2D fallback");
  } else {
    console.info("Renderer mode: WebGPU");
  }

  resize();
  reset();
  requestAnimationFrame(step);
}

canvas.addEventListener("pointerdown", (ev) => {
  ev.preventDefault();
  canvas.setPointerCapture?.(ev.pointerId);
  const { x, y } = getPointerPos(ev);
  popAt(x, y);
});

window.addEventListener("keydown", (ev) => {
  if (ev.key.toLowerCase() === "r") {
    reset();
  }
});

resetBtn?.addEventListener("click", () => {
  reset();
});

window.addEventListener("resize", resize);

window.addEventListener(
  "touchmove",
  (ev) => {
    if (ev.target === canvas) {
      ev.preventDefault();
    }
  },
  { passive: false }
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed", error);
    });
  });
}

bootstrap().catch((error) => {
  console.error("Failed to bootstrap game", error);
});
