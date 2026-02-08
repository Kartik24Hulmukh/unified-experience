/**
 * FluidMaskCursor — WebGL Navier-Stokes fluid simulation that produces
 * a white-on-black luminance mask for CSS mask-image.
 *
 * Architecture:
 *  1. A SMALL hidden canvas (MASK_RES × MASK_RES) runs the full fluid sim.
 *  2. Every frame the canvas is CLEARED before the display pass so white
 *     pixels never accumulate (the sim state lives in FBOs, not the canvas).
 *  3. The display shader converts dye → white luminance with a threshold.
 *  4. canvas.toDataURL() exports the mask as a tiny PNG data-URL.
 *  5. Parent applies it as CSS mask-image on the reveal layer.
 *
 * Cursor coordinates are mapped from viewport space → [0..1] texcoord
 * using window.innerWidth / innerHeight (NOT the tiny canvas size).
 */

import { useEffect, useRef } from 'react';

interface FluidMaskCursorProps {
  onMaskFrame?: (dataUrl: string) => void;
}

/* ─── Fluid config ────────────────────────────────────────────── */
const MASK_RES         = 256;   // Canvas pixel size — small for fast readback
const SIM_RESOLUTION   = 64;   // Fluid sim grid
const DYE_RESOLUTION   = 256;  // Matches canvas for crisp mask
const DENSITY_DISSIPATION = 4.5;  // ★ Faster fade — cleaner, less persistent trails
const VELOCITY_DISSIPATION = 3.0; // ★ Smoother velocity decay — gentle glide
const PRESSURE         = 0.1;
const PRESSURE_ITERATIONS = 20;
const CURL             = 5;    // ★ Minimal curl — controlled organic flow, no chaotic swirls
const SPLAT_RADIUS     = 0.22; // ★ Smaller radius — tighter, more precise splash
const SPLAT_FORCE      = 1800; // ★ Much gentler force — smooth glide instead of splatter
const SHADING          = true;

export default function FluidMaskCursor({ onMaskFrame }: FluidMaskCursorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let alive = true;

    // ★ Fixed low-res canvas — never changes with viewport
    canvas.width = MASK_RES;
    canvas.height = MASK_RES;

    /* ─── Pointer state: Weighted trailing system ─── */
    const pointers = [
      { x: 0, y: 0, px: 0, py: 0, mass: 0.5 },   // ★ Smoother primary — less jittery response
      { x: 0, y: 0, px: 0, py: 0, mass: 0.18 },  // ★ Softer trail — more graceful delayed follow
    ];
    let mouseX = 0, mouseY = 0;
    let initialized = false;

    /* ─── WebGL bootstrap ───────────────────────────────── */
    const params: WebGLContextAttributes = {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: true,   // Needed for toDataURL
    };
    let gl = canvas.getContext('webgl2', params) as WebGL2RenderingContext | null;
    const isWebGL2 = !!gl;
    if (!gl) gl = (canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params)) as WebGL2RenderingContext | null;
    if (!gl) return;

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

    const halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : halfFloat && halfFloat.HALF_FLOAT_OES;

    function getSupportedFormat(gl: WebGL2RenderingContext, intFmt: number, fmt: number, type: number): any {
      if (!supportRenderTextureFormat(gl, intFmt, fmt, type)) {
        switch (intFmt) {
          case (gl as any).R16F: return getSupportedFormat(gl, (gl as any).RG16F, (gl as any).RG, type);
          case (gl as any).RG16F: return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
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
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, intFmt, 4, 4, 0, fmt, type, null);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.deleteTexture(tex);
      gl.deleteFramebuffer(fbo);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return ok;
    }

    let formatRGBA: any, formatRG: any, formatR: any;
    if (isWebGL2) {
      formatRGBA = getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType);
      formatRG = getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType);
      formatR = getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType);
    } else {
      formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
      formatRG = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
      formatR = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
    }

    let dyeResVal = DYE_RESOLUTION;
    let shadingEnabled = SHADING;
    if (!supportLinearFiltering) {
      dyeResVal = 128;
      shadingEnabled = false;
    }

    /* ─── Shader helpers ───────────────────────────────── */
    function hashCode(s: string) {
      let h = 0;
      for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
      return h;
    }

    function compileShader(type: number, source: string, keywords: string[] | null = null) {
      if (keywords) {
        let kw = '';
        keywords.forEach(k => (kw += '#define ' + k + '\n'));
        source = kw + source;
      }
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, source);
      gl!.compileShader(s);
      if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) console.warn(gl!.getShaderInfoLog(s));
      return s;
    }

    function createProgramGL(vs: WebGLShader, fs: WebGLShader) {
      const p = gl!.createProgram()!;
      gl!.attachShader(p, vs);
      gl!.attachShader(p, fs);
      gl!.linkProgram(p);
      if (!gl!.getProgramParameter(p, gl!.LINK_STATUS)) console.warn(gl!.getProgramInfoLog(p));
      return p;
    }

    function getUniforms(program: WebGLProgram) {
      const u: any = {};
      const count = gl!.getProgramParameter(program, gl!.ACTIVE_UNIFORMS);
      for (let i = 0; i < count; i++) {
        const name = gl!.getActiveUniform(program, i)!.name;
        u[name] = gl!.getUniformLocation(program, name);
      }
      return u;
    }

    class Program {
      program: WebGLProgram;
      uniforms: any;
      constructor(vs: WebGLShader, fs: WebGLShader) {
        this.program = createProgramGL(vs, fs);
        this.uniforms = getUniforms(this.program);
      }
      bind() { gl!.useProgram(this.program); }
    }

    class Material {
      vertexShader: WebGLShader;
      fragmentShaderSource: string;
      programs: Record<number, WebGLProgram>;
      activeProgram: WebGLProgram | null = null;
      uniforms: any = {};
      constructor(vs: WebGLShader, fsSrc: string) {
        this.vertexShader = vs;
        this.fragmentShaderSource = fsSrc;
        this.programs = {};
      }
      setKeywords(keywords: string[]) {
        let h = 0;
        for (const k of keywords) h += hashCode(k);
        let p = this.programs[h];
        if (!p) {
          const fs = compileShader(gl!.FRAGMENT_SHADER, this.fragmentShaderSource, keywords);
          p = createProgramGL(this.vertexShader, fs);
          this.programs[h] = p;
        }
        if (p === this.activeProgram) return;
        this.uniforms = getUniforms(p);
        this.activeProgram = p;
      }
      bind() { gl!.useProgram(this.activeProgram); }
    }

    /* ─── Shaders ──────────────────────────────────────── */
    const baseVS = compileShader(gl.VERTEX_SHADER, `
      precision highp float;
      attribute vec2 aPosition;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform vec2 texelSize;
      void main () {
        vUv = aPosition * 0.5 + 0.5;
        vL = vUv - vec2(texelSize.x, 0.0);
        vR = vUv + vec2(texelSize.x, 0.0);
        vT = vUv + vec2(0.0, texelSize.y);
        vB = vUv - vec2(0.0, texelSize.y);
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `);

    const copyFS = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      varying highp vec2 vUv;
      uniform sampler2D uTexture;
      void main () { gl_FragColor = texture2D(uTexture, vUv); }
    `);

    const clearFS = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      varying highp vec2 vUv;
      uniform sampler2D uTexture;
      uniform float value;
      void main () { gl_FragColor = value * texture2D(uTexture, vUv); }
    `);

    const splatFS = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uTarget;
      uniform float aspectRatio;
      uniform vec3 color;
      uniform vec2 point;
      uniform float radius;
      void main () {
        vec2 p = vUv - point.xy;
        p.x *= aspectRatio;
        vec3 splat = exp(-dot(p, p) / radius) * color;
        vec3 base = texture2D(uTarget, vUv).xyz;
        gl_FragColor = vec4(base + splat, 1.0);
      }
    `);

    const advectionFS = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uVelocity;
      uniform sampler2D uSource;
      uniform vec2 texelSize;
      uniform vec2 dyeTexelSize;
      uniform float dt;
      uniform float dissipation;
      vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
        vec2 st = uv / tsize - 0.5;
        vec2 iuv = floor(st);
        vec2 fuv = fract(st);
        vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
        vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
        vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
        vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
        return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
      }
      void main () {
        #ifdef MANUAL_FILTERING
          vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
          vec4 result = bilerp(uSource, coord, dyeTexelSize);
        #else
          vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
          vec4 result = texture2D(uSource, coord);
        #endif
        float decay = 1.0 + dissipation * dt;
        gl_FragColor = result / decay;
      }
    `, supportLinearFiltering ? null : ['MANUAL_FILTERING']);

    const divergenceFS = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uVelocity;
      void main () {
        float L = texture2D(uVelocity, vL).x;
        float R = texture2D(uVelocity, vR).x;
        float T = texture2D(uVelocity, vT).y;
        float B = texture2D(uVelocity, vB).y;
        vec2 C = texture2D(uVelocity, vUv).xy;
        if (vL.x < 0.0) L = -C.x;
        if (vR.x > 1.0) R = -C.x;
        if (vT.y > 1.0) T = -C.y;
        if (vB.y < 0.0) B = -C.y;
        float div = 0.5 * (R - L + T - B);
        gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
      }
    `);

    const curlFS = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uVelocity;
      void main () {
        float L = texture2D(uVelocity, vL).y;
        float R = texture2D(uVelocity, vR).y;
        float T = texture2D(uVelocity, vT).x;
        float B = texture2D(uVelocity, vB).x;
        float vorticity = R - L - T + B;
        gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
      }
    `);

    const vorticityFS = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uVelocity;
      uniform sampler2D uCurl;
      uniform float curl;
      uniform float dt;
      void main () {
        float L = texture2D(uCurl, vL).x;
        float R = texture2D(uCurl, vR).x;
        float T = texture2D(uCurl, vT).x;
        float B = texture2D(uCurl, vB).x;
        float C = texture2D(uCurl, vUv).x;
        vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
        force /= length(force) + 0.0001;
        force *= curl * C;
        force.y *= -1.0;
        vec2 velocity = texture2D(uVelocity, vUv).xy;
        velocity += force * dt;
        velocity = min(max(velocity, -1000.0), 1000.0);
        gl_FragColor = vec4(velocity, 0.0, 1.0);
      }
    `);

    const pressureFS = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uPressure;
      uniform sampler2D uDivergence;
      void main () {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        float divergence = texture2D(uDivergence, vUv).x;
        float pressure = (L + R + B + T - divergence) * 0.25;
        gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
      }
    `);

    const gradSubFS = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uPressure;
      uniform sampler2D uVelocity;
      void main () {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        vec2 velocity = texture2D(uVelocity, vUv).xy;
        velocity.xy -= vec2(R - L, T - B);
        gl_FragColor = vec4(velocity, 0.0, 1.0);
      }
    `);

    /* ── Display shader: output white luminance mask ── */
    const displaySrc = `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uTexture;
      uniform vec2 texelSize;

      void main () {
        vec3 c = texture2D(uTexture, vUv).rgb;

        #ifdef SHADING
          vec3 lc = texture2D(uTexture, vL).rgb;
          vec3 rc = texture2D(uTexture, vR).rgb;
          vec3 tc = texture2D(uTexture, vT).rgb;
          vec3 bc = texture2D(uTexture, vB).rgb;
          float dx = length(rc) - length(lc);
          float dy = length(tc) - length(bc);
          vec3 n = normalize(vec3(dx, dy, length(texelSize)));
          vec3 l = vec3(0.0, 0.0, 1.0);
          float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);
          c *= diffuse;
        #endif

        // Convert to luminance
        float lum = dot(c, vec3(0.299, 0.587, 0.114));

        // Smooth fluid edges: wider range = softer feathering
        //   below 0.02 → 0  (hidden — kills very faint wisps)
        //   above 0.40 → 1  (fully revealed — much wider gradient)
        // The wider 0.02..0.40 range creates buttery soft edges.
        float mask = smoothstep(0.02, 0.40, lum);

        // ★ Output as ALPHA mask.
        gl_FragColor = vec4(0.0, 0.0, 0.0, mask);
      }
    `;

    /* ─── Programs ─────────────────────────────────────── */
    const copyProg = new Program(baseVS, copyFS);
    const clearProg = new Program(baseVS, clearFS);
    const splatProg = new Program(baseVS, splatFS);
    const advProg = new Program(baseVS, advectionFS);
    const divProg = new Program(baseVS, divergenceFS);
    const curlProg = new Program(baseVS, curlFS);
    const vortProg = new Program(baseVS, vorticityFS);
    const presProg = new Program(baseVS, pressureFS);
    const gradProg = new Program(baseVS, gradSubFS);
    const displayMat = new Material(baseVS, displaySrc);

    const displayKeywords: string[] = [];
    if (shadingEnabled) displayKeywords.push('SHADING');
    displayMat.setKeywords(displayKeywords);

    /* ─── Blit helper ──────────────────────────────────── */
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    function blit(target: any, clear = false) {
      if (target == null) {
        gl!.viewport(0, 0, gl!.drawingBufferWidth, gl!.drawingBufferHeight);
        gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
      } else {
        gl!.viewport(0, 0, target.width, target.height);
        gl!.bindFramebuffer(gl!.FRAMEBUFFER, target.fbo);
      }
      if (clear) {
        gl!.clearColor(0.0, 0.0, 0.0, 0.0);
        gl!.clear(gl!.COLOR_BUFFER_BIT);
      }
      gl!.drawElements(gl!.TRIANGLES, 6, gl!.UNSIGNED_SHORT, 0);
    }

    /* ─── FBO management ───────────────────────────────── */
    let dye: any, velocity: any, divergenceFBO: any, curlFBO: any, pressureFBO: any;

    function getResolution(res: number) {
      // Canvas is square, so just return square resolution
      const ar = gl!.drawingBufferWidth / gl!.drawingBufferHeight;
      if (ar >= 1) {
        return { width: Math.round(res * ar), height: Math.round(res) };
      }
      return { width: Math.round(res), height: Math.round(res / ar) };
    }

    function createFBO(w: number, h: number, intFmt: number, fmt: number, type: number, param: number) {
      gl!.activeTexture(gl!.TEXTURE0);
      const texture = gl!.createTexture()!;
      gl!.bindTexture(gl!.TEXTURE_2D, texture);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, param);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, param);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, intFmt, w, h, 0, fmt, type, null);
      const fbo = gl!.createFramebuffer()!;
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo);
      gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, texture, 0);
      gl!.viewport(0, 0, w, h);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      return {
        texture, fbo, width: w, height: h,
        texelSizeX: 1 / w, texelSizeY: 1 / h,
        attach(id: number) {
          gl!.activeTexture(gl!.TEXTURE0 + id);
          gl!.bindTexture(gl!.TEXTURE_2D, texture);
          return id;
        },
      };
    }

    function createDoubleFBO(w: number, h: number, intFmt: number, fmt: number, type: number, param: number) {
      let fbo1 = createFBO(w, h, intFmt, fmt, type, param);
      let fbo2 = createFBO(w, h, intFmt, fmt, type, param);
      return {
        width: w, height: h, texelSizeX: fbo1.texelSizeX, texelSizeY: fbo1.texelSizeY,
        get read() { return fbo1; },
        set read(v) { fbo1 = v; },
        get write() { return fbo2; },
        set write(v) { fbo2 = v; },
        swap() { const t = fbo1; fbo1 = fbo2; fbo2 = t; },
      };
    }

    function resizeFBO(target: any, w: number, h: number, intFmt: number, fmt: number, type: number, param: number) {
      const n = createFBO(w, h, intFmt, fmt, type, param);
      copyProg.bind();
      gl!.uniform1i(copyProg.uniforms.uTexture, target.attach(0));
      blit(n);
      return n;
    }

    function resizeDoubleFBO(target: any, w: number, h: number, intFmt: number, fmt: number, type: number, param: number) {
      if (target.width === w && target.height === h) return target;
      target.read = resizeFBO(target.read, w, h, intFmt, fmt, type, param);
      target.write = createFBO(w, h, intFmt, fmt, type, param);
      target.width = w;
      target.height = h;
      target.texelSizeX = 1 / w;
      target.texelSizeY = 1 / h;
      return target;
    }

    function initFramebuffers() {
      const simRes = getResolution(SIM_RESOLUTION);
      const dRes = getResolution(dyeResVal);
      const texType = halfFloatTexType;
      const filtering = supportLinearFiltering ? gl!.LINEAR : gl!.NEAREST;
      gl!.disable(gl!.BLEND);

      if (!dye) dye = createDoubleFBO(dRes.width, dRes.height, formatRGBA.internalFormat, formatRGBA.format, texType, filtering);
      else dye = resizeDoubleFBO(dye, dRes.width, dRes.height, formatRGBA.internalFormat, formatRGBA.format, texType, filtering);

      if (!velocity) velocity = createDoubleFBO(simRes.width, simRes.height, formatRG.internalFormat, formatRG.format, texType, filtering);
      else velocity = resizeDoubleFBO(velocity, simRes.width, simRes.height, formatRG.internalFormat, formatRG.format, texType, filtering);

      divergenceFBO = createFBO(simRes.width, simRes.height, formatR.internalFormat, formatR.format, texType, gl!.NEAREST);
      curlFBO = createFBO(simRes.width, simRes.height, formatR.internalFormat, formatR.format, texType, gl!.NEAREST);
      pressureFBO = createDoubleFBO(simRes.width, simRes.height, formatR.internalFormat, formatR.format, texType, gl!.NEAREST);
    }

    initFramebuffers();

    /* ─── Simulation helpers ───────────────────────────── */
    function correctRadius(r: number) {
      const ar = canvas!.width / canvas!.height;
      if (ar > 1) r *= ar;
      return r;
    }

    function correctDeltaX(d: number) {
      const ar = canvas!.width / canvas!.height;
      if (ar < 1) d *= ar;
      return d;
    }

    function correctDeltaY(d: number) {
      const ar = canvas!.width / canvas!.height;
      if (ar > 1) d /= ar;
      return d;
    }

    function splat(x: number, y: number, dx: number, dy: number, color: any) {
      splatProg.bind();
      gl!.uniform1i(splatProg.uniforms.uTarget, velocity.read.attach(0));
      gl!.uniform1f(splatProg.uniforms.aspectRatio, canvas!.width / canvas!.height);
      gl!.uniform2f(splatProg.uniforms.point, x, y);
      gl!.uniform3f(splatProg.uniforms.color, dx, dy, 0.0);
      gl!.uniform1f(splatProg.uniforms.radius, correctRadius(SPLAT_RADIUS / 100.0));
      blit(velocity.write);
      velocity.swap();

      gl!.uniform1i(splatProg.uniforms.uTarget, dye.read.attach(0));
      gl!.uniform3f(splatProg.uniforms.color, color.r, color.g, color.b);
      blit(dye.write);
      dye.swap();
    }

    function step(dt: number) {
      gl!.disable(gl!.BLEND);

      curlProg.bind();
      gl!.uniform2f(curlProg.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl!.uniform1i(curlProg.uniforms.uVelocity, velocity.read.attach(0));
      blit(curlFBO);

      vortProg.bind();
      gl!.uniform2f(vortProg.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl!.uniform1i(vortProg.uniforms.uVelocity, velocity.read.attach(0));
      gl!.uniform1i(vortProg.uniforms.uCurl, curlFBO.attach(1));
      gl!.uniform1f(vortProg.uniforms.curl, CURL);
      gl!.uniform1f(vortProg.uniforms.dt, dt);
      blit(velocity.write);
      velocity.swap();

      divProg.bind();
      gl!.uniform2f(divProg.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl!.uniform1i(divProg.uniforms.uVelocity, velocity.read.attach(0));
      blit(divergenceFBO);

      clearProg.bind();
      gl!.uniform1i(clearProg.uniforms.uTexture, pressureFBO.read.attach(0));
      gl!.uniform1f(clearProg.uniforms.value, PRESSURE);
      blit(pressureFBO.write);
      pressureFBO.swap();

      presProg.bind();
      gl!.uniform2f(presProg.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl!.uniform1i(presProg.uniforms.uDivergence, divergenceFBO.attach(0));
      for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
        gl!.uniform1i(presProg.uniforms.uPressure, pressureFBO.read.attach(1));
        blit(pressureFBO.write);
        pressureFBO.swap();
      }

      gradProg.bind();
      gl!.uniform2f(gradProg.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl!.uniform1i(gradProg.uniforms.uPressure, pressureFBO.read.attach(0));
      gl!.uniform1i(gradProg.uniforms.uVelocity, velocity.read.attach(1));
      blit(velocity.write);
      velocity.swap();

      advProg.bind();
      gl!.uniform2f(advProg.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      if (!supportLinearFiltering)
        gl!.uniform2f(advProg.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
      const velId = velocity.read.attach(0);
      gl!.uniform1i(advProg.uniforms.uVelocity, velId);
      gl!.uniform1i(advProg.uniforms.uSource, velId);
      gl!.uniform1f(advProg.uniforms.dt, dt);
      gl!.uniform1f(advProg.uniforms.dissipation, VELOCITY_DISSIPATION);
      blit(velocity.write);
      velocity.swap();

      if (!supportLinearFiltering)
        gl!.uniform2f(advProg.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
      gl!.uniform1i(advProg.uniforms.uVelocity, velocity.read.attach(0));
      gl!.uniform1i(advProg.uniforms.uSource, dye.read.attach(1));
      gl!.uniform1f(advProg.uniforms.dissipation, DENSITY_DISSIPATION);
      blit(dye.write);
      dye.swap();
    }

    function render() {
      // ★★★ CRITICAL: clear the canvas BEFORE drawing the display pass.
      // With preserveDrawingBuffer=true, old frames accumulate otherwise,
      // turning the entire mask white → entire reveal layer visible → all black.
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
      gl!.viewport(0, 0, gl!.drawingBufferWidth, gl!.drawingBufferHeight);
      gl!.clearColor(0.0, 0.0, 0.0, 0.0); // Transparent = hidden in alpha mask
      gl!.clear(gl!.COLOR_BUFFER_BIT);

      gl!.blendFunc(gl!.ONE, gl!.ONE_MINUS_SRC_ALPHA);
      gl!.enable(gl!.BLEND);
      displayMat.bind();
      if (shadingEnabled)
        gl!.uniform2f(displayMat.uniforms.texelSize, 1 / gl!.drawingBufferWidth, 1 / gl!.drawingBufferHeight);
      gl!.uniform1i(displayMat.uniforms.uTexture, dye.read.attach(0));
      blit(null);
    }

    /* ─── Main loop ────────────────────────────────────── */
    let lastTime = Date.now();

    function loop() {
      if (!alive) return;
      const now = Date.now();
      let dt = (now - lastTime) / 1000;
      dt = Math.min(dt, 0.016666);
      lastTime = now;

      pointers.forEach((p, i) => {
        // Each follow point has a different weight/mass
        p.x += (mouseX - p.x) * p.mass;
        p.y += (mouseY - p.y) * p.mass;

        const dx = correctDeltaX(p.x - p.px);
        const dy = correctDeltaY(p.y - p.py);

        if (Math.abs(dx) > 1e-5 || Math.abs(dy) > 1e-5) {
          splat(p.x, p.y, dx * SPLAT_FORCE, dy * SPLAT_FORCE, { r: 1, g: 1, b: 1 });
          p.px = p.x;
          p.py = p.y;
        }
      });

      step(dt);
      render();

      // Export mask every frame — 256×256 canvas.
      // ★ Use WebP (lossy, fast encode) instead of PNG for smoother frame rate.
      // Falls back to PNG on browsers without WebP canvas support.
      if (onMaskFrame) {
        onMaskFrame(canvas!.toDataURL('image/webp', 0.8));
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    /* ─── Event listeners ──────────────────────────────── */
    // ★ Map cursor from VIEWPORT coords → [0..1] texcoords
    // using window.innerWidth/Height, NOT the tiny canvas pixel size.
    function onMouseMove(e: MouseEvent) {
      mouseX = e.clientX / window.innerWidth;
      mouseY = 1.0 - e.clientY / window.innerHeight;
      if (!initialized) {
        pointers.forEach(p => { p.x = p.px = mouseX; p.y = p.py = mouseY; });
        initialized = true;
      }
    }

    function onTouchMove(e: TouchEvent) {
      const t = e.targetTouches[0];
      if (!t) return;
      mouseX = t.clientX / window.innerWidth;
      mouseY = 1.0 - t.clientY / window.innerHeight;
    }

    function onTouchStart(e: TouchEvent) {
      const t = e.targetTouches[0];
      if (!t) return;
      mouseX = t.clientX / window.innerWidth;
      mouseY = 1.0 - t.clientY / window.innerHeight;
      if (!initialized) {
        pointers.forEach(p => { p.x = p.px = mouseX; p.y = p.py = mouseY; });
        initialized = true;
      }
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    loop();

    /* ─── Cleanup ──────────────────────────────────────── */
    return () => {
      alive = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={MASK_RES}
      height={MASK_RES}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '1px',
        height: '1px',
        pointerEvents: 'none',
        opacity: 0,
        zIndex: -1,
      }}
    />
  );
}
