import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'

/**
 * ฉากหลังของเวทีไอโซ: กำลังร่วงลงจากฟ้า — ภาษาภาพเดียวกับฟ้าของ hero (เมฆจุดครึ่งโทน ดู newhero/NewHeroScene)
 *
 *   เมฆ    fbm พิมพ์ลงตะแกรงจุดในพิกัดพิกเซลของจอ (จุดโตตาม √ความหนาแน่น) สองชั้นความลึก:
 *          ชั้นใกล้จุดโต พุ่งขึ้นเร็ว · ชั้นไกลจุดเล็ก จาง ช้า — หนาที่ขอบจอซ้ายขวา กลางจอโปร่งให้เวที
 *          ก่อนร่วง (fall 0) ไม่มีเมฆ: เมฆไหลขึ้นมาจากขอบล่างตามระยะร่วง ไม่โผล่กลางจอ
 *   ภูเขา  ทิวเขาไกลสามชั้น (ridged noise) สีจมไปทางฟ้า ยอดพิมพ์จุดขาวเป็นหิมะ — โผล่จากขอบล่าง
 *          สูงขึ้นตามที่ร่วงลง (ชั้นใกล้ขึ้นมาก ชั้นไกลขึ้นน้อย)
 *
 * แผ่นเต็มจอแผ่นเดียว (หนึ่ง draw call) วาดหลังสุด โปร่งใสตรงที่ไม่มีอะไร — ฟ้าไล่สีของ section อยู่ข้างหลัง
 */
export type FallPose = { on: boolean; iso: number; fall: number; prog: number; lift: number }

const Z = -5000

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = /* glsl */ `
  uniform float uFall;
  uniform float uProg;
  uniform float uIn;
  uniform float uAspect;
  uniform float uDot;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 w = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), w.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), w.x), w.y);
  }
  /* หมุนทุกชั้น — ไม่หมุน ก้อนเมฆจะเป็นปื้นสี่เหลี่ยมตามแกน (บทเรียนจากฟ้าของ hero) */
  float fbm(vec2 p, int oct) {
    mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
    float v = 0.0, a = 0.5, s = 0.0;
    for (int i = 0; i < 4; i++) {
      if (i >= oct) break;
      v += a * vnoise(p);
      s += a;
      p = rot * p * 2.03 + 7.13;
      a *= 0.5;
    }
    return v / s;
  }
  /* สันเขาแหลม: 1 − |2n − 1| ยกกำลังสอง → ยอดคม หุบมน */
  float ridge(float x, float seed) {
    float h = 0.0, a = 0.55, f = 1.0;
    for (int i = 0; i < 4; i++) {
      float n = 1.0 - abs(2.0 * vnoise(vec2(x * f + seed, seed)) - 1.0);
      h += a * pow(n, i == 0 ? 3.0 : 2.0);
      f *= 2.1;
      a *= 0.45;
    }
    return h;
  }
  /* จุดครึ่งโทน: รัศมี √ความหนาแน่น ในช่องขนาด size พิกเซล */
  float halftone(float dens, float size, vec2 shift) {
    vec2 cell = fract((gl_FragCoord.xy + shift) / size) - 0.5;
    float rad = sqrt(clamp(dens, 0.0, 1.0)) * 0.62;
    return 1.0 - smoothstep(rad - 0.06, rad + 0.02, length(cell));
  }

  void main() {
    vec2 uv = vUv;
    /* สะสมแบบ premultiplied — ผสมจากดำตรง ๆ ทำให้ขอบเมฆที่จางเป็นคราบเทา */
    vec3 pm = vec3(0.0);
    float alpha = 0.0;

    /* ── ภูเขา (ไกลไปใกล้ ชั้นใกล้ทับ) ── */
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float top = mix(-0.08, 0.30 - fi * 0.075, uProg);
      float amp = 0.2 - fi * 0.03;
      float h = top - amp + amp * ridge(uv.x * uAspect * (1.15 + fi * 0.45), 3.7 + fi * 11.0) * 1.35;
      if (uv.y < h) {
        /* ไกล = จางไปทางฟ้า · ใกล้ = น้ำเงินเข้มขึ้นนิด */
        vec3 base = mix(vec3(0.56, 0.73, 0.98), vec3(0.27, 0.48, 0.88), fi / 2.0);
        float a = 0.6 + fi * 0.2;
        /* หิมะ: จุดขาวหนาแน่นใกล้สัน บางลงตามความลึก — เฉพาะยอดที่สูงพอ */
        float snow = smoothstep(0.075, 0.0, h - uv.y) * smoothstep(top - amp * 0.55, top, h);
        /* หิมะกับไอหมอกตีนเขาเป็นเนื้อนุ่มแบบเมฆ ไม่ใช่จุด — ฉากหลังเงียบ */
        float d = smoothstep(0.0, 0.7, snow) * 0.85;
        d = max(d, smoothstep(h - 0.12, h - 0.34, uv.y) * 0.35);
        float am = a + (1.0 - a) * d;
        pm = mix(base, vec3(0.96, 0.98, 1.0), d) * am + pm * (1.0 - am);
        alpha = am + alpha * (1.0 - am);
      }
    }

    /* ── เมฆสองชั้น: ไกลก่อน ใกล้ทับ ── */
    for (int L = 0; L < 2; L++) {
      float near = float(L);
      float speed = mix(0.55, 1.35, near);
      float scale = mix(4.2, 2.3, near);
      vec2 p = vec2(uv.x * uAspect, uv.y - uFall * speed) * scale;
      p.y *= 1.7;
      float mass = fbm(p * 0.35 + near * 9.0, 2);
      float n = fbm(p + near * 4.0, 3) * 0.6 + mass * 0.55;
      /* หนาที่ขอบซ้ายขวา โปร่งกลางจอ (ก้อนใหญ่จริง ๆ ล้ำเข้ามาได้บ้าง) */
      float side = smoothstep(0.18, 0.46, abs(uv.x - 0.5));
      side = max(side, smoothstep(0.62, 0.95, mass) * 0.55);
      /* หน้าคลื่นเมฆไหลขึ้นจากขอบล่างเร็ว ๆ ตั้งแต่ข้อความ What I do เริ่มลอย (uIn) — ก่อนนั้นไม่มีเมฆ · ชั้นใกล้นำนิด */
      float front = uIn * mix(1.35, 1.5, near) - 0.05;
      float enter = smoothstep(front, front - 0.25, uv.y);
      /*
       * ก้อนฟุ้งแบบม่านเมฆของ hero (components/CloudWipe): ขอบนุ่ม ชั้นไกลฟุ้งกว่าและจางกว่า
       * ท้องก้อนอมฟ้าเทา (ปริมาตร) ยอดขาว — ไม่ใช่จุดครึ่งโทน: ฉากหลังต้องไม่แย่งสายตาจากเวที
       */
      float soft = mix(0.32, 0.2, near);
      float dens = smoothstep(0.44, 0.44 + soft, n) * side * enter;
      float lit = smoothstep(0.55, 0.85, fbm(p + vec2(0.0, 0.18) + near * 4.0, 3) * 0.6 + mass * 0.55);
      vec3 c = mix(vec3(0.80, 0.87, 0.97), vec3(0.98, 0.99, 1.0), lit);
      float a = dens * mix(0.5, 0.8, near);
      pm = c * a + pm * (1.0 - a);
      alpha = a + alpha * (1.0 - a);
    }

    if (alpha < 0.003) discard;
    gl_FragColor = vec4(pm / alpha, alpha);
  }
`

export function FallSky({ pose }: { pose: React.RefObject<FallPose> }) {
  const { size, invalidate, viewport } = useThree()
  const mesh = useRef<THREE.Mesh>(null)
  const drift = useRef(0)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: { uFall: { value: 0 }, uProg: { value: 0 }, uIn: { value: 0 }, uAspect: { value: 1 }, uDot: { value: 9 } },
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  useEffect(
    () => () => {
      mat.dispose()
      geo.dispose()
    },
    [mat, geo],
  )

  useFrame((_, dt) => {
    const p = pose.current
    const m = mesh.current
    if (!p || !m) return
    const on = p.on && p.iso > 0.001
    m.visible = on
    if (!on) {
      drift.current = 0
      return
    }
    /* ร่วงเองช้า ๆ ตามเวลา — หยุดเลื่อนก็ยังร่วง (ผูกกับ iso: ก่อนเริ่มไม่สะสม) */
    drift.current += Math.min(dt, 0.1) * 0.05 * p.iso
    const W = size.width
    const H = size.height
    m.scale.set(W, H, 1)
    m.position.set(0, -p.lift, Z)
    const u = mat.uniforms
    u.uFall.value = p.fall * 0.55 + drift.current
    u.uProg.value = p.prog
    u.uIn.value = p.iso
    u.uAspect.value = W / H
    /* จุดขนาดเดียวกับฟ้าของ hero (~9 px CSS) — gl_FragCoord เป็นพิกเซลจริง คูณ dpr */
    u.uDot.value = 9 * viewport.dpr
    invalidate()
  })

  return <mesh ref={mesh} geometry={geo} material={mat} renderOrder={-10} visible={false} />
}
