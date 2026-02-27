/**
 * FluidMaskCursor — WebGL Navier-Stokes fluid simulation for hover-reveal masking.
 *
 * Renders on a hidden 48x48 canvas and exports an inverted luminance mask
 * via toDataURL at ~24fps. Parent applies this as CSS mask-image on a cover
 * layer: white = layer visible, black = layer erased (reveals content beneath).
 *
 * The fluid sim produces organic, deforming edges with inertia — the mask
 * follows the cursor with weighted trailing pointers for smooth, delayed motion.
 */

import { useEffect, useRef, memo } from 'react';

interface FluidMaskCursorProps {
  onMaskFrame?: (dataUrl: string) => void;
  paused?: boolean;
}

/* ─── Fluid config — EXTREME PERFORMANCE (Low CPU Load) ─── */
const MASK_RES = 48;
const SIM_RESOLUTION = 64;
const DYE_RESOLUTION = 128;
const DENSITY_DISSIPATION = 3.5;
const VELOCITY_DISSIPATION = 0.98;
const PRESSURE = 0.1;
const PRESSURE_ITERATIONS = 12;
const CURL = 10;
const SPLAT_RADIUS = 0.16;
const SPLAT_FORCE = 10000;
const SHADING = true;

function FluidMaskCursor({ onMaskFrame, paused = false }: FluidMaskCursorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const pausedRef = useRef(paused);
  const onMaskFrameRef = useRef(onMaskFrame);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    onMaskFrameRef.current = onMaskFrame;
  }, [onMaskFrame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let alive = true;
    let pageHidden = document.hidden;

    // Low resolution is key for mask performance
    canvas.width = MASK_RES;
    canvas.height = MASK_RES;

    const handleVisibilityChange = () => { pageHidden = document.hidden; };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const pointers = [
      { x: 0, y: 0, px: 0, py: 0, mass: 0.18 },
      { x: 0, y: 0, px: 0, py: 0, mass: 0.10 },
    ];
    let mouseX = 0, mouseY = 0;
    let initialized = false;

    // Use WebGL2 for better performance if available
    const params: WebGLContextAttributes = {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: false, // Set to false for better perf
    };

    let gl = canvas.getContext('webgl2', params) as WebGL2RenderingContext | null;
    const isWebGL2 = !!gl;
    if (!gl) gl = (canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params)) as WebGL2RenderingContext | null;
    if (!gl) return;

    let contextLost = false;
    const onLost = (e: Event) => { e.preventDefault(); contextLost = true; };
    canvas.addEventListener('webglcontextlost', onLost);

    let halfFloat: any;
    let supportLinearFiltering: any;
    if (isWebGL2) {
      gl.getExtension('EXT_color_buffer_float');
      supportLinearFiltering = gl.getExtension('OES_texture_float_linear');
    } else {
      halfFloat = gl.getExtension('OES_texture_half_float');
      supportLinearFiltering = gl.getExtension('OES_texture_half_float_linear');
    }

    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    const halfFloatTexType = isWebGL2 ? (gl as any).HALF_FLOAT : halfFloat && halfFloat.HALF_FLOAT_OES;

    // ... (rest of the WebGL glue code remains similar but we optimize the loop)

    function getSupportedFormat(gl: WebGL2RenderingContext, intFmt: number, fmt: number, type: number): any {
      if (!supportRenderTextureFormat(gl, intFmt, fmt, type)) {
        switch (intFmt) {
          case (gl as any).R16F: return getSupportedFormat(gl, (gl as any).RG16F, (gl as any).RG, type);
          case (gl as any).RG16F: return getSupportedFormat(gl, (gl as any).RGBA16F, (gl as any).RGBA, type);
          default: return null;
        }
      }
      return { internalFormat: intFmt, format: fmt };
    }

    function supportRenderTextureFormat(gl: WebGL2RenderingContext, intFmt: number, fmt: number, type: number) {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texImage2D(gl.TEXTURE_2D, 0, intFmt, 4, 4, 0, fmt, type, null);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, (gl as any).COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.deleteTexture(tex); gl.deleteFramebuffer(fbo); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return ok;
    }

    let formatRGBA = isWebGL2 ? getSupportedFormat(gl, (gl as any).RGBA16F, (gl as any).RGBA, halfFloatTexType) : getSupportedFormat(gl, (gl as any).RGBA, (gl as any).RGBA, halfFloatTexType);
    let formatRG = isWebGL2 ? getSupportedFormat(gl, (gl as any).RG16F, (gl as any).RG, halfFloatTexType) : getSupportedFormat(gl, (gl as any).RGBA, (gl as any).RGBA, halfFloatTexType);
    let formatR = isWebGL2 ? getSupportedFormat(gl, (gl as any).R16F, (gl as any).RED, halfFloatTexType) : getSupportedFormat(gl, (gl as any).RGBA, (gl as any).RGBA, halfFloatTexType);

    function compileShader(type: number, source: string) {
      const s = gl!.createShader(type)!; gl!.shaderSource(s, source); gl!.compileShader(s); return s;
    }
    function createProgramGL(vs: WebGLShader, fs: WebGLShader) {
      const p = gl!.createProgram()!; gl!.attachShader(p, vs); gl!.attachShader(p, fs); gl!.linkProgram(p); return p;
    }
    function getUniforms(program: WebGLProgram) {
      const u: any = {}; const count = gl!.getProgramParameter(program, (gl as any).ACTIVE_UNIFORMS);
      for (let i = 0; i < count; i++) { const name = gl!.getActiveUniform(program, i)!.name; u[name] = gl!.getUniformLocation(program, name); }
      return u;
    }

    class Program {
      program: WebGLProgram; uniforms: any;
      constructor(vs: WebGLShader, fs: WebGLShader) { this.program = createProgramGL(vs, fs); this.uniforms = getUniforms(this.program); }
      bind() { gl!.useProgram(this.program); }
    }

    const baseVS = compileShader(gl.VERTEX_SHADER, `precision highp float; attribute vec2 aPosition; varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB; uniform vec2 texelSize; void main () { vUv = aPosition * 0.5 + 0.5; vL = vUv - vec2(texelSize.x, 0.0); vR = vUv + vec2(texelSize.x, 0.0); vT = vUv + vec2(0.0, texelSize.y); vB = vUv - vec2(0.0, texelSize.y); gl_Position = vec4(aPosition, 0.0, 1.0); }`);
    const copyFS = compileShader(gl.FRAGMENT_SHADER, `precision mediump float; varying highp vec2 vUv; uniform sampler2D uTexture; void main () { gl_FragColor = texture2D(uTexture, vUv); }`);
    const clearFS = compileShader(gl.FRAGMENT_SHADER, `precision mediump float; varying highp vec2 vUv; uniform sampler2D uTexture; uniform float value; void main () { gl_FragColor = value * texture2D(uTexture, vUv); }`);
    const divergenceFS = compileShader(gl.FRAGMENT_SHADER, `precision mediump float; varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB; uniform sampler2D uVelocity; void main () { float L = texture2D(uVelocity, vL).x; float R = texture2D(uVelocity, vR).x; float T = texture2D(uVelocity, vT).y; float B = texture2D(uVelocity, vB).y; vec2 C = texture2D(uVelocity, vUv).xy; if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x; if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y; gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0); }`);
    const curlFS = compileShader(gl.FRAGMENT_SHADER, `precision mediump float; varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB; uniform sampler2D uVelocity; void main () { float L = texture2D(uVelocity, vL).y; float R = texture2D(uVelocity, vR).y; float T = texture2D(uVelocity, vT).x; float B = texture2D(uVelocity, vB).x; gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0); }`);
    const pressureFS = compileShader(gl.FRAGMENT_SHADER, `precision mediump float; varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB; uniform sampler2D uPressure; uniform sampler2D uDivergence; void main () { float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x; float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x; float divergence = texture2D(uDivergence, vUv).x; gl_FragColor = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0); }`);
    const gradSubFS = compileShader(gl.FRAGMENT_SHADER, `precision mediump float; varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB; uniform sampler2D uPressure; uniform sampler2D uVelocity; void main () { float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x; float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x; vec2 velocity = texture2D(uVelocity, vUv).xy; velocity.xy -= vec2(R - L, T - B); gl_FragColor = vec4(velocity, 0.0, 1.0); }`);
    const splatFS = compileShader(gl.FRAGMENT_SHADER, `precision highp float; varying vec2 vUv; uniform sampler2D uTarget; uniform float aspectRatio; uniform vec3 color; uniform vec2 point; uniform float radius; void main () { vec2 p = vUv - point.xy; p.x *= aspectRatio; vec3 splat = exp(-dot(p, p) / radius) * color; gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + splat, 1.0); }`);
    const advectionFS = compileShader(gl.FRAGMENT_SHADER, `precision highp float; varying vec2 vUv; uniform sampler2D uVelocity; uniform sampler2D uSource; uniform vec2 texelSize; uniform float dt; uniform float dissipation; void main () { vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize; gl_FragColor = texture2D(uSource, coord) / (1.0 + dissipation * dt); }`);
    const displayFS = compileShader(gl.FRAGMENT_SHADER, `precision highp float; varying vec2 vUv; uniform sampler2D uTexture; void main () { vec3 c = texture2D(uTexture, vUv).rgb; float lum = dot(c, vec3(0.299, 0.587, 0.114)); float mask = 1.0 - smoothstep(0.01, 0.5, lum); gl_FragColor = vec4(vec3(mask), 1.0); }`);

    const copyProg = new Program(baseVS, copyFS);
    const clearProg = new Program(baseVS, clearFS);
    const splatProg = new Program(baseVS, splatFS);
    const advProg = new Program(baseVS, advectionFS);
    const divProg = new Program(baseVS, divergenceFS);
    const curlProg = new Program(baseVS, curlFS);
    const presProg = new Program(baseVS, pressureFS);
    const gradProg = new Program(baseVS, gradSubFS);
    const displayProg = new Program(baseVS, displayFS);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    const elementBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elementBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    function blit(target: any) {
      if (target == null) { gl!.viewport(0, 0, gl!.drawingBufferWidth, gl!.drawingBufferHeight); gl!.bindFramebuffer(gl!.FRAMEBUFFER, null); }
      else { gl!.viewport(0, 0, target.width, target.height); gl!.bindFramebuffer(gl!.FRAMEBUFFER, target.fbo); }
      gl!.drawElements(gl!.TRIANGLES, 6, gl!.UNSIGNED_SHORT, 0);
    }

    let dye: any, velocity: any, divergenceFBO: any, curlFBO: any, pressureFBO: any;
    function createFBO(w: number, h: number, intFmt: number, fmt: number, type: number, param: number) {
      const tex = gl!.createTexture()!;
      gl!.bindTexture(gl!.TEXTURE_2D, tex); gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, param); gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, param);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, intFmt, w, h, 0, fmt, type, null);
      const fbo = gl!.createFramebuffer()!; gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo); gl!.framebufferTexture2D(gl!.FRAMEBUFFER, (gl as any).COLOR_ATTACHMENT0, gl!.TEXTURE_2D, tex, 0);
      return { texture: tex, fbo, width: w, height: h, texelSizeX: 1 / w, texelSizeY: 1 / h, attach(id: number) { gl!.activeTexture((gl as any).TEXTURE0 + id); gl!.bindTexture(gl!.TEXTURE_2D, tex); return id; } };
    }
    function createDoubleFBO(w: number, h: number, intFmt: number, fmt: number, type: number, param: number) {
      let f1 = createFBO(w, h, intFmt, fmt, type, param); let f2 = createFBO(w, h, intFmt, fmt, type, param);
      return { width: w, height: h, texelSizeX: 1 / w, texelSizeY: 1 / h, get read() { return f1; }, get write() { return f2; }, swap() { let t = f1; f1 = f2; f2 = t; } };
    }

    function initFBOs() {
      const texType = halfFloatTexType; const filtering = gl!.LINEAR;
      dye = createDoubleFBO(MASK_RES, MASK_RES, formatRGBA.internalFormat, formatRGBA.format, texType, filtering);
      velocity = createDoubleFBO(SIM_RESOLUTION, SIM_RESOLUTION, formatRG.internalFormat, formatRG.format, texType, filtering);
      divergenceFBO = createFBO(SIM_RESOLUTION, SIM_RESOLUTION, formatR.internalFormat, formatR.format, texType, gl!.NEAREST);
      curlFBO = createFBO(SIM_RESOLUTION, SIM_RESOLUTION, formatR.internalFormat, formatR.format, texType, gl!.NEAREST);
      pressureFBO = createDoubleFBO(SIM_RESOLUTION, SIM_RESOLUTION, formatR.internalFormat, formatR.format, texType, gl!.NEAREST);
    }
    initFBOs();

    const MASK_EXPORT_INTERVAL = 1000 / 20; // 20fps is plenty for a mask
    let lastExportTime = 0;
    let frameCount = 0;

    function loop() {
      if (!alive) return;
      if (pausedRef.current || pageHidden || contextLost) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const now = Date.now();
      let dt = Math.min((now - lastUpdateTime) / 1000, 0.017);
      lastUpdateTime = now;

      let activePointers = 0;
      pointers.forEach(p => {
        p.x += (mouseX - p.x) * p.mass; p.y += (mouseY - p.y) * p.mass;
        let dx = (p.x - p.px) * SPLAT_FORCE; let dy = (p.y - p.py) * SPLAT_FORCE;
        if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
          activePointers++;
          splatProg.bind(); gl!.uniform1f(splatProg.uniforms.aspectRatio, 1.0); gl!.uniform2f(splatProg.uniforms.point, p.x, p.y); gl!.uniform1f(splatProg.uniforms.radius, SPLAT_RADIUS / 100);
          gl!.uniform1i(splatProg.uniforms.uTarget, velocity.read.attach(0)); gl!.uniform3f(splatProg.uniforms.color, dx, dy, 0); blit(velocity.write); velocity.swap();
          gl!.uniform1i(splatProg.uniforms.uTarget, dye.read.attach(0)); gl!.uniform3f(splatProg.uniforms.color, 1, 1, 1); blit(dye.write); dye.swap();
          p.px = p.x; p.py = p.y;
        }
      });

      // Keep dirty while fluid is moving/visible
      if (activePointers > 0) frameCount = 60; // Keep updating for ~1sec after stop
      else if (frameCount > 0) frameCount--;

      curlProg.bind(); gl!.uniform2f(curlProg.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY); gl!.uniform1i(curlProg.uniforms.uVelocity, velocity.read.attach(0)); blit(curlFBO);
      divProg.bind(); gl!.uniform2f(divProg.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY); gl!.uniform1i(divProg.uniforms.uVelocity, velocity.read.attach(0)); blit(divergenceFBO);
      clearProg.bind(); gl!.uniform1i(clearProg.uniforms.uTexture, pressureFBO.read.attach(0)); gl!.uniform1f(clearProg.uniforms.value, PRESSURE); blit(pressureFBO.write); pressureFBO.swap();
      presProg.bind(); gl!.uniform2f(presProg.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY); gl!.uniform1i(presProg.uniforms.uDivergence, divergenceFBO.attach(0));
      for (let i = 0; i < PRESSURE_ITERATIONS; i++) { gl!.uniform1i(presProg.uniforms.uPressure, pressureFBO.read.attach(1)); blit(pressureFBO.write); pressureFBO.swap(); }
      gradProg.bind(); gl!.uniform2f(gradProg.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY); gl!.uniform1i(gradProg.uniforms.uPressure, pressureFBO.read.attach(0)); gl!.uniform1i(gradProg.uniforms.uVelocity, velocity.read.attach(1)); blit(velocity.write); velocity.swap();
      advProg.bind(); gl!.uniform2f(advProg.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY); gl!.uniform1f(advProg.uniforms.dt, dt);
      gl!.uniform1i(advProg.uniforms.uVelocity, velocity.read.attach(0)); gl!.uniform1i(advProg.uniforms.uSource, velocity.read.attach(0)); gl!.uniform1f(advProg.uniforms.dissipation, VELOCITY_DISSIPATION); blit(velocity.write); velocity.swap();
      gl!.uniform1i(advProg.uniforms.uVelocity, velocity.read.attach(0)); gl!.uniform1i(advProg.uniforms.uSource, dye.read.attach(1)); gl!.uniform1f(advProg.uniforms.dissipation, DENSITY_DISSIPATION); blit(dye.write); dye.swap();

      gl!.bindFramebuffer((gl as any).FRAMEBUFFER, null);
      gl!.clear((gl as any).COLOR_BUFFER_BIT);
      displayProg.bind();
      gl!.uniform1i(displayProg.uniforms.uTexture, dye.read.attach(0));
      blit(null);

      // Async Export: throttle to 20fps and only while simulation is active
      if (onMaskFrameRef.current && (now - lastExportTime >= MASK_EXPORT_INTERVAL) && frameCount > 0) {
        lastExportTime = now;
        onMaskFrameRef.current(canvas!.toDataURL('image/webp', 0.1));
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    function onMouseMove(e: MouseEvent) {
      mouseX = e.clientX / window.innerWidth;
      mouseY = 1.0 - e.clientY / window.innerHeight;
      _maskCursorDirty = true;
      if (!initialized) { pointers.forEach(p => { p.x = p.px = mouseX; p.y = p.py = mouseY; }); initialized = true; }
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true });

    return () => {
      alive = false;
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      canvas.removeEventListener('webglcontextlost', onLost);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      if (gl) {
        const deleteFBO = (f: any) => {
          if (!f) return;
          if (f.texture) gl!.deleteTexture(f.texture);
          if (f.fbo) gl!.deleteFramebuffer(f.fbo);
        };
        const deleteDoubleFBO = (f: any) => {
          if (!f) return;
          deleteFBO(f.read);
          deleteFBO(f.write);
        };

        deleteDoubleFBO(dye);
        deleteDoubleFBO(velocity);
        deleteDoubleFBO(pressureFBO);
        deleteFBO(divergenceFBO);
        deleteFBO(curlFBO);

        if (positionBuffer) gl!.deleteBuffer(positionBuffer);
        if (elementBuffer) gl!.deleteBuffer(elementBuffer);

        const progs = [copyProg, clearProg, splatProg, advProg, divProg, curlProg, presProg, gradProg, displayProg];
        progs.forEach(p => { if (p && p.program) gl!.deleteProgram(p.program); });

        const shaders = [baseVS, copyFS, clearFS, divergenceFS, curlFS, pressureFS, gradSubFS, splatFS, advectionFS, displayFS];
        shaders.forEach(s => { if (s) gl!.deleteShader(s); });
      }
    };
  }, []);

  return (<canvas ref={canvasRef} className="hidden" style={{ width: MASK_RES, height: MASK_RES }} />);
}

export default memo(FluidMaskCursor);
