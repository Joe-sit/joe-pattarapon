import * as THREE from 'three'

/** สี่เหลี่ยมมุมมน (จัดกลาง ทวนเข็ม) — ทรงตั้งต้นของเครื่อง วิดเจ็ต และกรอบต่าง ๆ ในเรื่อง What I do */
export function rrect(w: number, h: number, r: number) {
  const s = new THREE.Shape()
  const x0 = -w / 2
  const y0 = -h / 2
  const rr = Math.min(r, w / 2, h / 2)
  s.moveTo(x0 + rr, y0)
  s.lineTo(x0 + w - rr, y0)
  s.absarc(x0 + w - rr, y0 + rr, rr, -Math.PI / 2, 0, false)
  s.lineTo(x0 + w, y0 + h - rr)
  s.absarc(x0 + w - rr, y0 + h - rr, rr, 0, Math.PI / 2, false)
  s.lineTo(x0 + rr, y0 + h)
  s.absarc(x0 + rr, y0 + h - rr, rr, Math.PI / 2, Math.PI, false)
  s.lineTo(x0, y0 + rr)
  s.absarc(x0 + rr, y0 + rr, rr, Math.PI, Math.PI * 1.5, false)
  return s
}

/**
 * กรอบเส้นมุมมน (wireframe) บนแผ่นเดียว — สนามระยะในเชดเดอร์ เส้นหนาเท่ากันทุกขนาด
 * uSize ขนาดกรอบ · uR รัศมี · uW ความหนาเส้น (หน่วยเดียวกับ uSize) · uA ความทึบ — แผ่นหน่วยเดียว เชดเดอร์ขยายเอง
 */
export function outlineMat() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: { uSize: { value: new THREE.Vector2(1, 1) }, uR: { value: 0 }, uW: { value: 2 }, uA: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform vec2 uSize;
      uniform float uW;
      varying vec2 vP;
      void main() {
        vP = position.xy * (uSize + uW * 4.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(vP, 0.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec2 uSize;
      uniform float uR;
      uniform float uW;
      uniform float uA;
      varying vec2 vP;
      void main() {
        vec2 h = uSize * 0.5;
        float r = min(uR, min(h.x, h.y));
        vec2 q = abs(vP) - (h - r);
        float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
        float aa = max(fwidth(d), 1e-3);
        float a = 1.0 - smoothstep(uW * 0.5 - aa, uW * 0.5 + aa, abs(d));
        if (a < 0.003) discard;
        gl_FragColor = vec4(1.0, 1.0, 1.0, a * uA);
        #include <colorspace_fragment>
      }`,
  })
}
