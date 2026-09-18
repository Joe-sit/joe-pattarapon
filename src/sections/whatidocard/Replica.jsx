import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useDisposable } from '@/joespresso/scene/utils'
import { VIEW_H, useStageTuner } from './stageTuner'

/**
 * ฉากหลังในจอหน้าต่าง — ทุ่งหญ้าที่ปั้นตามรูปจริงที่รอยสาดเปิดเผย
 *
 * แทนเขียวเรียบที่เคยเป็นพื้นจอ: ในรูปจริงข้างหลังตัวละครเป็นทุ่งหญ้า แนวต้นไม้เบลอ ทางดินที่
 * โค้งไปทางขวา เสาขาวต้นหนึ่ง ควายตัวหนึ่งไกล ๆ และหย่อมน้ำขัง — เมื่อรอยสาดเปิดรูปจริงขึ้นมา
 * สิ่งที่โผล่มาต้องเป็น *ฉากเดียวกัน* ที่คมขึ้น ไม่ใช่รูปคนละใบที่มาทับพื้นสีเขียว
 *
 * ### ทำไมเป็นเชดเดอร์แผ่นเดียว ไม่ใช่ของสามมิติหลายชิ้น
 *
 * รูปจริงถูกวางด้วย uZoom/uOffset ในพิกัดจอ (ดู ./SplashReveal) ของที่ต้องทับกันสนิทกับมัน
 * จึงควรถูกวาดใน *พิกัดเดียวกันนั้น* — เขียนฉากเป็นฟังก์ชันของ uv ของรูป แล้วทั้งสองชั้นเลื่อน
 * ไปด้วยกันเองเมื่อลากค่าวางรูปจากแผงจูน ถ้าเป็นเมช ต้องแปลงพิกัดรูปเป็นพิกัดโลกทุกชิ้นแล้ว
 * ไปวัดใหม่ทุกครั้งที่ค่าเปลี่ยน
 *
 * อีกข้อ: รูปจริงหลังตัวละครเบลอทั้งใบ (ระยะชัดตื้น) ของที่เบลอไม่มีขอบให้ปั้น มันคือหย่อมสี
 * ที่ไล่เข้าหากัน — smoothstep กว้าง ๆ กับ fbm ให้ผลตรงกว่าเรขาคณิตที่ต้องทำให้เบลอทีหลัง
 *
 * ### ที่วางในลำดับวาด
 *
 * แผ่นนี้ถูกคัดด้วย stencil เหมือนตัวละคร (SCREEN_BIT) จึงโผล่เฉพาะในพื้นที่หน้าจอของ *บาน
 * ที่อยู่หน้าสุด* ณ พิกเซลนั้น — ฉากเดียวต่อเนื่องข้ามทุกบานเหมือนตัวละคร ไม่ใช่ใบละฉาก
 * ลำดับวาดต้องอยู่หลังตัวหน้าต่างทุกใบ (บานหน้าคือ 10) แต่ก่อนตัวละคร ไม่งั้นพื้นจอของบานหน้า
 * จะทาทับฉากนี้ทิ้ง (วัดมาแล้ว: บาน 4 เป็นเขียวเรียบอยู่ใบเดียว)
 */
export const REPLICA_ORDER = 11

/* ── ที่ของแต่ละอย่างในรูป (พิกัด uv ของรูป y ชี้ขึ้น) ───────────────────────────
   วัดจาก public/photos/joe-portrait.jpg โดยตรง: แนวต้นไม้กินจากขอบบนลงมาถึง 24% ของ
   ความสูง เสาอยู่ราว x 88% สูงจาก 60% ถึง 90% ควายอยู่ราว (0.64, 0.745) ทางดินเข้าขอบขวา
   ที่ระดับเดียวกับแนวต้นไม้แล้วโค้งลงมาทางซ้าย */
const frag = /* glsl */ `
#define HORIZON 0.757
varying vec2 vUv;
uniform vec2 uCover;
uniform vec2 uOffset;
uniform float uZoom;

/* ── noise: hash + value noise + fbm สามชั้น ────────────────────────────────
   ของในรูปเบลอหมด ไม่ต้องละเอียดกว่านี้ — สามชั้นพอให้หย่อมใหญ่มีเนื้อในตัวมัน */
float h21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x),
    mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x),
    u.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    s += a * vnoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return s;
}

/** หย่อมนุ่ม: 1 ที่กลาง ไล่หายที่ขอบ — รูปวงรีเพราะของในรูปถูกเบลอเป็นวงรีตามระยะ */
float blob(vec2 uv, vec2 c, vec2 r, float soft) {
  float d = length((uv - c) / r);
  return 1.0 - smoothstep(1.0 - soft, 1.0 + soft, d);
}

/** กลางทางดิน ณ ความสูงนั้น — ทางเข้าขอบขวาแล้วโค้งลงมาทางซ้าย */
float pathX(float y) {
  float t = clamp((0.73 - y) / 0.42, 0.0, 1.0);
  return 0.99 - 0.30 * t - 0.10 * t * t + 0.13 * t * t * t;
}

void main() {
  /* พิกัดของรูป — สูตรเดียวกับชั้นรอยสาด (ดู ./SplashReveal) ฉากจึงเลื่อนไปกับรูปเสมอ */
  vec2 uv = (vUv - 0.5) * uCover / uZoom + 0.5 + uOffset;

  float n = fbm(uv * 6.5);
  float fine = fbm(uv * 21.0 + 5.3);

  /* ── ทุ่งหญ้า ───────────────────────────────────────────────────────────
     สว่างที่กลางทุ่ง เข้มลงที่ขอบล่างซ้าย (ในรูปมีเงาของพุ่มไม้นอกเฟรมทอดลงมา) */
  vec3 grassFar = vec3(0.494, 0.655, 0.243);
  vec3 grassNear = vec3(0.447, 0.596, 0.216);
  float depth = smoothstep(HORIZON, 0.16, uv.y);
  vec3 col = mix(grassFar, grassNear, depth);
  col = mix(col, vec3(0.545, 0.702, 0.251), smoothstep(0.35, 0.72, n) * 0.55);
  col *= 0.92 + 0.15 * fine;
  /* หญ้าแถวหน้าออกเหลืองกว่า — แดดบ่ายในรูปตกที่ทุ่งแถวหน้าเต็มที่ */
  col = mix(col, vec3(0.635, 0.745, 0.306), smoothstep(0.52, 0.18, uv.y) * 0.35);
  /* หย่อมสว่างกลางทุ่ง — แดดที่ตกลงมาเป็นปื้น ไม่ใช่แสงเท่ากันทั้งผืน */
  col = mix(col, vec3(0.663, 0.792, 0.337), blob(uv, vec2(0.30, 0.55), vec2(0.32, 0.17), 0.9) * 0.45);
  col *= 1.0 - 0.22 * smoothstep(0.55, 0.0, uv.y) * smoothstep(0.45, 0.0, uv.x);

  /* ── น้ำขัง ────────────────────────────────────────────────────────────
     สองหย่อม: ขอบซ้ายกลางภาพ กับทางขวาใต้ทางดิน สีเข้มอมฟ้าแล้วมีเงาสะท้อนฟ้าบาง ๆ */
  float wet = blob(uv, vec2(0.02, 0.44), vec2(0.10, 0.09), 1.0) * 0.8
    + blob(uv, vec2(0.74, 0.44), vec2(0.15, 0.07), 1.0) * 0.7;
  wet = clamp(wet, 0.0, 1.0);
  col = mix(col, vec3(0.267, 0.353, 0.302), wet * 0.85);
  col = mix(col, vec3(0.573, 0.686, 0.663), wet * smoothstep(0.45, 0.75, fine) * 0.5);

  /* ── ทางดิน ────────────────────────────────────────────────────────────
     กว้างขึ้นเมื่อเข้ามาใกล้ ขอบฟุ้งเพราะหญ้าขึ้นคลุมขอบทางและภาพเบลอ */
  float py = clamp(uv.y, 0.30, 0.74);
  float w = mix(0.030, 0.105, smoothstep(0.74, 0.30, py));
  float road = 1.0 - smoothstep(w * 0.5, w * 1.6, abs(uv.x - pathX(py)));
  road *= smoothstep(0.25, 0.35, uv.y) * smoothstep(0.78, 0.68, uv.y);
  vec3 dirt = mix(vec3(0.729, 0.686, 0.588), vec3(0.569, 0.525, 0.435), fine);
  col = mix(col, dirt, road * 0.9);

  /* ── แนวต้นไม้ ─────────────────────────────────────────────────────────
     ขอบล่างของแนวไม่ใช่เส้นตรง: หย่อมพุ่มยื่นลงมาไม่เท่ากัน (fbm คลื่นยาว) */
  float edge = HORIZON + (fbm(vec2(uv.x * 4.0, 1.7)) - 0.5) * 0.055;
  float tree = smoothstep(edge - 0.025, edge + 0.030, uv.y);
  /**
   * เรือนยอดเป็นหย่อมพุ่ม ไม่ใช่เขียวไล่เรียบ
   *
   * ในรูปแนวไม้เบลอแต่ยัง *เห็นเป็นพุ่ม ๆ* อยู่ — ก้อนเข้ม/อ่อนขนาดราว 8% ของภาพซ้อนกัน
   * สองชั้น ถ้าใช้ไล่สีเรียบทั้งผืน มันอ่านเป็นผนังสีเขียว ไม่ใช่ต้นไม้ (เทียบภาพมาแล้ว)
   */
  float bush = fbm(uv * 9.5 + 11.0);
  float leaf = fbm(uv * 17.0 + 2.1);
  vec3 canopy = mix(vec3(0.075, 0.153, 0.055), vec3(0.290, 0.435, 0.161), smoothstep(0.34, 0.70, bush));
  canopy = mix(canopy, vec3(0.392, 0.545, 0.243), smoothstep(0.46, 0.74, leaf) * 0.8);
  /* ช่องแสงลอดใบไม้ — จุดสว่างเล็ก ๆ ในเรือนยอด ไม่ใช่เขียวทึบทั้งผืน */
  canopy = mix(canopy, vec3(0.745, 0.808, 0.647), smoothstep(0.76, 0.93, leaf) * 0.6);
  /* พุ่มเตี้ยสว่างตรงโคนแนวไม้ — แถบที่แยกแนวไม้ออกจากทุ่งในรูป */
  canopy = mix(canopy, vec3(0.416, 0.549, 0.216), (1.0 - smoothstep(edge, edge + 0.09, uv.y)) * 0.55);
  /* โคนแนวไม้เข้มกว่ายอด — เงาใต้พุ่มในรูป */
  canopy *= 0.78 + 0.42 * smoothstep(edge, edge + 0.22, uv.y);
  /* เรือนยอดบนสุดสว่างขึ้นอีก — ยอดไม้รับแดดตรง ๆ กับช่องฟ้าที่โผล่ระหว่างยอด */
  canopy = mix(canopy, vec3(0.451, 0.549, 0.353), smoothstep(0.92, 1.12, uv.y) * 0.55);
  /* เข้มลงทั้งเรือนยอด — เทียบกับรูปแล้วเขียวของแนวไม้สว่างเกินไปหนึ่งขั้น */
  col = mix(col, canopy * 0.84, tree);
  /* แถบหญ้าสว่างใต้แนวไม้ — แดดที่ส่องผ่านช่องระหว่างพุ่มลงมาโดนหญ้าแถวหน้า */
  col = mix(col, vec3(0.596, 0.745, 0.290), (1.0 - tree) * smoothstep(edge - 0.10, edge, uv.y) * 0.30);

  /* ── เสา ──────────────────────────────────────────────────────────────
     ท่อนขาวหมองเอียงเล็กน้อย โผล่ขึ้นจากแนวหญ้าเข้าไปในแนวไม้ */
  float px = 0.878 + (uv.y - 0.75) * 0.035;
  float pole = (1.0 - smoothstep(0.006, 0.017, abs(uv.x - px)))
    * smoothstep(0.585, 0.625, uv.y) * smoothstep(0.935, 0.885, uv.y);
  col = mix(col, mix(vec3(0.808, 0.796, 0.741), vec3(0.588, 0.576, 0.529), fine), pole * 0.62);

  /* ── ควายไกล ๆ ─────────────────────────────────────────────────────────
     ก้อนน้ำตาลเข้มที่เบลอจนไม่เหลือรูปร่าง — ในรูปก็อ่านได้แค่ว่า "มีอะไรอยู่ตรงนั้น" */
  float ox = blob(uv, vec2(0.638, 0.744), vec2(0.045, 0.024), 1.0);
  col = mix(col, vec3(0.286, 0.227, 0.176), ox * 0.7);

  /* ไล่สว่างจากซ้ายไปขวาเล็กน้อย — ทิศแดดในรูป */
  col *= 0.96 + 0.09 * smoothstep(0.0, 1.0, uv.x);

  gl_FragColor = vec4(col, 1.0);
}
`

const vert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

/**
 * @param props - stencil: ธง stencil ชุดเดียวกับตัวละคร (ดู InsideScreen ใน ./CardStage)
 *   ส่งเข้ามาไม่ได้ประกาศเองที่นี่ เพราะค่าบิตเป็นข้อตกลงของฉากนั้น
 */
export function Replica({ stencilRef, stencilFuncMask }) {
  const { size } = useThree()
  const t = useStageTuner()
  const mat = useRef()

  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  useDisposable(geo)

  /**
   * วัสดุปั้นด้วยมือ ไม่ใช่ <shaderMaterial> ที่ส่ง uniforms เป็น prop
   *
   * ค่า uniform ที่ส่งทาง prop เคยไปอยู่กับวัตถุอีกใบที่ไม่ใช่ใบที่ลูปเขียน (วัดมาแล้วในชั้น
   * รอยสาด — ดู ./SplashReveal) ปั้นเองแล้วถือ ref ไว้ ไม่มีทางหลุดไปคนละใบ
   */
  const material = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        uCover: { value: new THREE.Vector2(1, 1) },
        uOffset: { value: new THREE.Vector2(0, 0) },
        uZoom: { value: 1 },
      },
    })
    m.stencilWrite = true
    m.stencilRef = stencilRef
    m.stencilFunc = THREE.EqualStencilFunc
    m.stencilFuncMask = stencilFuncMask
    /* ไม่ทดสอบความลึก: แผ่นนี้ต้องทับพื้นจอของทุกบานไม่ว่าบานนั้นอยู่ลึกแค่ไหน (บาน 4 ลงไป
       ได้ถึง z -10) ที่คัดมันไว้ในจอคือ stencil ไม่ใช่ความลึก */
    m.depthTest = false
    m.depthWrite = false
    return m
  }, [stencilRef, stencilFuncMask])
  useDisposable(material)

  useFrame(() => {
    const u = material.uniforms
    /* cover: รูปไม่ยืดตามอัตราส่วนจอ — สูตรเดียวกับชั้นรอยสาด */
    const ca = size.width / Math.max(1, size.height)
    const pa = PHOTO_AR
    if (pa > ca) u.uCover.value.set(ca / pa, 1)
    else u.uCover.value.set(1, pa / ca)
    u.uZoom.value = t.phZoom
    u.uOffset.value.set(t.phX, t.phY)
  })

  /* แผ่นกินทั้งเฟรมพอดี: กล้องออร์โธเห็นสูง VIEW_H หน่วย กว้างตามอัตราส่วนจอ
     frustumCulled ปิด — ทรงกลมขอบเขตของแผ่นเท่าเฟรม คร่อมขอบพอดีจนถูกคัดทิ้งได้ */
  const aspect = size.width / Math.max(1, size.height)
  return (
    <mesh
      ref={mat}
      geometry={geo}
      material={material}
      /* เผื่อ 1.02 กันขอบแผ่นโผล่ตอนจอถูกลากย่อ/ขยายระหว่างเฟรม */
      scale={[VIEW_H * aspect * 1.02, VIEW_H * 1.02, 1]}
      position={[0, 0, -8]}
      renderOrder={REPLICA_ORDER}
      frustumCulled={false}
    />
  )
}

/** อัตราส่วนของรูปจริง (832 × 993) — ต้องเท่ากับไฟล์ใน public/photos */
const PHOTO_AR = 832 / 993
