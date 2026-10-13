import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

/**
 * ม่านของด่านโหลดเป็นเชดเดอร์ตัวเดียว — เปิดทุกชั้นด้วยหน้ากาก ไม่มีการจางทั้งแผ่นเลย
 *
 * 1. ขาว → ฟ้า: รูทรงอินทรีย์ขอบนุ่มบานออกจากกลางจอ (ท่าอินโทร Brand Kit ของ ElevenLabs) ในรูคือฟ้าของ hero
 * 2. ฟ้า → ฉากจริง: พอบานหน้าต่างลงล็อก รูทรงเดียวกันบานออกจาก *ปากบานแต่ละใบ* จนกินทั้งจอ
 *    ในรูคือหน้าเว็บจริงข้างใต้ (เมฆ หญ้า ริบบิ้น) — โลกไหลออกมาจากพอร์ทัล
 *
 * ทำไมฟ้าวาดที่นี่ ไม่ใช่ div ไล่สี CSS อีกชั้น: ขั้นที่ 2 ต้องเจาะรูบนฟ้า — div เจาะรูทรงอิสระไม่ได้
 * ของเดิมจึงจางทั้งแผ่นตอนท้าย ซึ่งเห็นเป็นภาพซ้อน (ฟ้าจริงมีเมฆลายจุดกับพื้น ฟ้าจำลองไม่มี)
 * ไล่สีทอดตามค่า CSS เดิมของด่าน (SKY ใน Final2026Gate) ทุกตัวเลข + dither กันแถบสี
 *
 * ผู้เรียกตัดกรอบมุมมนของการ์ดด้วย CSS เอง (นอกกรอบคือขาวของหน้า) · ครึ่งความละเอียด — ภาพฟุ้งทั้งภาพ
 * วาดเฉพาะตอนสั่ง set() · ไม่มี WebGL → set() คืน false ผู้เรียกตกไปใช้ทางเดิม (div ฟ้า + จาง)
 */
export type BlobRevealHandle = {
  /**
   * q = ขั้นที่ 1 (0..1) · wins = ขั้นที่ 2 ต่อบาน: [กลาง x, กลาง y, รัศมีปากบาน, ความคืบหน้า] × 3 (px ของจอ y ลง)
   */
  set: (q: number, wins?: ArrayLike<number>) => boolean
}

const RES = 0.5
const WINS = 3

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uQ;
uniform vec4 uWin[${WINS}];
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 w = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), w.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), w.x), w.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = r * p * 2.03 + 3.1; a *= 0.5; }
  return v;
}

/* ฟ้าของด่าน = SKY ของ Final2026Gate: linear-gradient(176deg, …) + แสงดวงอาทิตย์ radial ที่ (57%, 20%) */
vec3 sky(vec2 px) {
  vec2 dir = vec2(0.069756, 0.997564);
  float len = abs(uRes.x * dir.x) + abs(uRes.y * dir.y);
  float t = clamp(dot(px - uRes * 0.5, dir) / len + 0.5, 0.0, 1.0);
  vec3 c0 = vec3(29.0, 98.0, 169.0) / 255.0;
  vec3 c1 = vec3(60.0, 126.0, 196.0) / 255.0;
  vec3 c2 = vec3(127.0, 182.0, 228.0) / 255.0;
  vec3 c3 = vec3(188.0, 223.0, 245.0) / 255.0;
  vec3 c = t < 0.38 ? mix(c0, c1, t / 0.38) : t < 0.72 ? mix(c1, c2, (t - 0.38) / 0.34) : mix(c2, c3, (t - 0.72) / 0.28);
  float d = length((px - uRes * vec2(0.57, 0.2)) / (uRes * vec2(0.54, 0.46)));
  float a = d < 0.46 ? mix(0.115, 0.082, d / 0.46) : mix(0.082, 0.0, clamp((d - 0.46) / 0.54, 0.0, 1.0));
  return mix(c, vec3(1.0, 212.0 / 255.0, 188.0 / 255.0), a);
}

void main() {
  /* px แบบ CSS (y ลง) ของแคนวาสครึ่งความละเอียด */
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  float H = uRes.y;

  /*
   * ขั้นที่ 1: รูทรงอินทรีย์จากกลางจอ — ขอบหยักด้วยนอยส์ตามทิศ ขอบนุ่ม
   * นอยส์อ่านจาก *ทิศบนวงกลม* ไม่ใช่มุม atan: มุมกระโดด π → −π ตรงเส้นซ้ายของจุดกลาง
   * ขอบฝั่งบนกับล่างของเส้นนั้นได้ความหยักคนละค่า เห็นเป็นรอยตัดแนวนอนคม ๆ
   */
  vec2 d = (px - uRes * 0.5) / H;
  d.y *= 1.1;
  vec2 dv = d / max(length(d), 1e-4);
  float wob = fbm(dv * 1.3 + vec2(uQ * 2.2, uQ * 1.7)) - 0.5;
  float r = length(d) * (1.0 + wob * 0.42);
  float g = smoothstep(0.0, 1.0, uQ);
  float R = mix(0.0, 1.5 * max(1.0, uRes.x / H), g * g);
  float soft = 0.06 + 0.08 * g;
  float inSky = 1.0 - smoothstep(R - soft, R, r);
  vec3 col = mix(vec3(1.0), sky(px), inSky);
  /* dither ±1 ระดับสี — ไล่สียาวทั้งจอไม่เป็นแถบ */
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;

  /* ขั้นที่ 2: รูบานออกจากปากบานแต่ละใบ — รวมกันด้วย max (ซ้อนกันไม่กลับเป็นทึบ) */
  float diag = length(uRes);
  float open = 0.0;
  for (int i = 0; i < ${WINS}; i++) {
    vec4 w = uWin[i];
    if (w.w <= 0.0) continue;
    vec2 q = px - w.xy;
    vec2 qv = q / max(length(q), 1e-4);
    float wb = fbm(qv * 1.5 + vec2(float(i) * 3.7 + w.w * 1.4, float(i) + w.w)) - 0.5;
    float rr = length(q) * (1.0 + wb * 0.38);
    float k = w.w * w.w;
    float Ri = mix(w.z * 0.55, diag * 1.25, k);
    float sf = H * (0.05 + 0.1 * w.w);
    open = max(open, 1.0 - smoothstep(Ri - sf, Ri, rr));
  }
  float alpha = 1.0 - open;
  gl_FragColor = vec4(col * alpha, alpha);
}
`

export const BlobReveal = forwardRef<BlobRevealHandle, { style?: React.CSSProperties }>(function BlobReveal({ style }, ref) {
  const cvs = useRef<HTMLCanvasElement>(null)
  const api = useRef<(q: number, wins?: ArrayLike<number>) => boolean>(() => false)

  useImperativeHandle(ref, () => ({ set: (q, wins) => api.current(q, wins) }), [])

  useEffect(() => {
    const el = cvs.current
    if (!el) return
    const gl = el.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false })
    if (!gl) return
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type) as WebGLShader
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return s
    }
    const prog = gl.createProgram() as WebGLProgram
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const uRes = gl.getUniformLocation(prog, 'uRes')
    const uQ = gl.getUniformLocation(prog, 'uQ')
    const uWin = gl.getUniformLocation(prog, 'uWin')
    const win = new Float32Array(WINS * 4)
    api.current = (q, wins) => {
      const w = Math.max(1, Math.round(el.clientWidth * RES))
      const h = Math.max(1, Math.round(el.clientHeight * RES))
      if (el.width !== w || el.height !== h) {
        el.width = w
        el.height = h
      }
      /* px ของจอ → px ของแคนวาส (y ลงเหมือนกัน — เชดเดอร์คิดแบบ CSS) */
      const k = w / Math.max(1, el.clientWidth)
      win.fill(0)
      if (wins) for (let i = 0; i < Math.min(win.length, wins.length); i += 1) win[i] = (i % 4 === 3 ? 1 : k) * wins[i]
      gl.viewport(0, 0, w, h)
      gl.uniform2f(uRes, w, h)
      gl.uniform1f(uQ, q)
      gl.uniform4fv(uWin, win)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      return true
    }
    /* เฟรมแรก = ขาวล้วน (ยังไม่เปิดรู) — ทับฉากไว้ตั้งแต่ก่อนมอร์ฟ */
    api.current(0)
    return () => {
      api.current = () => false
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
    }
  }, [])

  return <canvas ref={cvs} className="pointer-events-none absolute inset-0 h-full w-full" style={style} aria-hidden />
})
