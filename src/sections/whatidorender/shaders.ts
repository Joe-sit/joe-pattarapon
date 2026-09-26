/**
 * เชดเดอร์ของจอเรนเดอร์ — พื้นฟ้า, หน้ากากไทล์, วงเล็บมุม, วงแหวนสกิล
 *
 * ตัวละครไม่ได้ใช้เชดเดอร์ที่นี่: แต่ละขั้นของการเรนเดอร์ (เส้นโครง, UV, normal, ดินปั้น,
 * สีล้วน, ภาพจริง) คือ *วัสดุมาตรฐานของ three* ที่ใส่ให้ตัวละครชุดหนึ่ง (ดู ./passes) —
 * เชดเดอร์ที่นี่ทำแค่ของที่เป็นแผ่นเต็มจอ
 */

export const FULL_VERT = /* glsl */ `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

/** ส่วนที่ใช้ร่วม: เม็ด halftone กับลำดับของไทล์ */
const COMMON = /* glsl */ `
uniform vec2 uRes;

/**
 * เมฆเม็ด halftone แบบฟ้าของ hero ใน /2026-final
 *
 * ขนาดเม็ดกำหนดด้วยคลื่นช้า ๆ สองลูกซ้อน: ค่าสูงเม็ดโต (ก้อนเมฆ) ค่าต่ำเม็ดหาย — วิธีเดียวกับ
 * ที่ภาพพิมพ์ halftone บอกความเข้มด้วยขนาดเม็ด ไม่ใช่ด้วยความจาง
 */
float halftone(float time) {
  float cell = 14.0 * uRes.y / 900.0;
  vec2 p = gl_FragCoord.xy / cell;
  vec2 f = fract(p) - 0.5;
  vec2 q = floor(p) * cell / uRes.y;
  float cloud = sin(q.x * 3.1 + time * 0.05) * 0.5 + sin(q.y * 4.3 - q.x * 1.7 + 1.3) * 0.5;
  cloud = smoothstep(0.15, 0.95, cloud * 0.5 + 0.5 * sin(q.x * 1.3 + q.y * 2.2));
  float r = 0.42 * cloud;
  return smoothstep(r, r - 0.08, length(f));
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

/**
 * ลำดับของไทล์: เริ่มจากกลางจอแล้วกระจายออก (อย่างที่เครื่องเรนเดอร์ไล่เป็นเกลียว) ปนสุ่ม
 * พอไม่ให้เป็นวงกลมเรียบ — หน้ากากกับวงเล็บต้องใช้ฟังก์ชันเดียวกัน ไม่งั้นวงเล็บขึ้นผิดช่อง
 */
float tileOrder(vec2 cell, vec2 grid) {
  vec2 mid = (cell + 0.5) / grid - 0.5;
  mid.x *= uRes.x / uRes.y;
  return mix(hash21(cell), clamp(length(mid) / 0.95, 0.0, 1.0), 0.62);
}
`

/**
 * พื้นฟ้า — สองสีไล่บนลงล่าง + เมฆ halftone
 *
 * ใช้สองที่: ฟ้าของช่วงเปิดจอ (ฟ้าอ่อนของหน้า) และฟ้าของ "โลกจริง" หลังไทล์เรนเดอร์ครบ
 * ซึ่งเปลี่ยนสีตามสกิล (`uTop`/`uBottom` มาจากสีประจำสกิล)
 */
export const SKY_FRAG = /* glsl */ `
${COMMON}
uniform float uTime;
uniform vec3 uTop;
uniform vec3 uBottom;
uniform float uDots;
void main() {
  vec2 suv = gl_FragCoord.xy / uRes;
  vec3 c = mix(uBottom, uTop, smoothstep(0.0, 1.0, suv.y));
  c = mix(c, vec3(1.0), halftone(uTime) * uDots);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}
`

/**
 * หน้ากากไทล์ — ช่องที่เรนเดอร์เสร็จแล้วเขียนค่า stencil ของ "โลกจริง" ช่องอื่นทิ้ง
 *
 * ไม่ได้วาดสีอะไรเลย (colorWrite ปิดที่ตัววัสดุ) หน้าที่มันคือบอกว่า *พิกเซลไหนเป็นของโลกจริง
 * แล้ว* ส่วนสิ่งที่เห็นในช่องนั้นคือฟ้าของโลกจริงกับตัวละครชุดภาพจริงที่ทดสอบ stencil ค่านั้น
 */
export const BUCKET_FRAG = /* glsl */ `
${COMMON}
uniform float uBucket;
uniform float uTile;
void main() {
  if (uBucket <= 0.0001) discard;
  if (uBucket < 0.999) {
    vec2 grid = uRes / uTile;
    vec2 cell = floor(gl_FragCoord.xy / uTile);
    float band = 0.1;
    if (tileOrder(cell, grid) > uBucket * (1.0 + band) - band) discard;
  }
  gl_FragColor = vec4(0.0);
}
`

/**
 * วงเล็บมุมของไทล์ที่ "กำลังเรนเดอร์" — ถอดจากเว็บอ้างอิงซึ่งยืมมาจากเครื่องเรนเดอร์ 3D
 * (เรนเดอร์ทีละ bucket) สีส้มของหน้า ภาษาเดียวกับวงเล็บส้มใหญ่ของจอ what-i-do
 */
export const BRACKET_FRAG = /* glsl */ `
${COMMON}
uniform float uBucket;
uniform float uTile;
void main() {
  if (uBucket <= 0.0001 || uBucket >= 0.999) discard;
  vec2 grid = uRes / uTile;
  vec2 cell = floor(gl_FragCoord.xy / uTile);
  float band = 0.1;
  float o = tileOrder(cell, grid);
  float done = step(o, uBucket * (1.0 + band) - band);
  float busy = (1.0 - done) * step(o, uBucket * (1.0 + band));
  if (busy < 0.5) discard;
  vec2 px = fract(gl_FragCoord.xy / uTile) * uTile;
  float lw = 2.0 * uRes.y / 900.0;
  float arm = uTile * 0.22;
  float nearX = min(px.x, uTile - px.x);
  float nearY = min(px.y, uTile - px.y);
  float br = max(step(nearY, lw) * step(nearX, arm), step(nearX, lw) * step(nearY, arm));
  if (br < 0.5) discard;
  gl_FragColor = vec4(0.992, 0.314, 0.0, 1.0);
  #include <colorspace_fragment>
}
`

/**
 * วงแหวนสกิล — แบบเว็บอ้างอิง: ชื่อที่หันตรงกล้องเป็นตัวทึบ ยิ่งอ้อมไปข้างยิ่งกลายเป็นเส้นขอบ
 * ด้านหลังวงเป็นเส้นขอบล้วน (อ่านกลับด้านเพราะมองจากด้านในของวง เหมือนของจริง)
 *
 * เท็กซ์เจอร์สองใบ: ตัวทึบ (`uFill`) กับเส้นขอบ (`uLine`) แล้วผสมตามมุมที่ผิวหันเข้ากล้อง —
 * ไม่ได้จางตัวทึบลงเฉย ๆ เพราะในแบบอ้างอิงชื่อข้าง ๆ ไม่ได้ซีด มันเปลี่ยนเป็น *เส้น*
 */
export const RING_VERT = /* glsl */ `
varying vec2 vUv;
varying float vFace;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec3 n = normalize(mat3(modelMatrix) * normal);
  vec3 toCam = normalize(cameraPosition - wp.xyz);
  vFace = dot(n, toCam);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

export const RING_FRAG = /* glsl */ `
uniform sampler2D uFill;
uniform sampler2D uLine;
uniform float uShow;
uniform float uBack;
varying vec2 vUv;
varying float vFace;
void main() {
  float fill = texture2D(uFill, vUv).a;
  float line = texture2D(uLine, vUv).a;
  vec4 f4 = texture2D(uFill, vUv);
  float a;
  vec3 c;
  if (uBack > 0.5) {
    a = line * 0.5;
    c = vec3(0.9);
  } else {
    /**
     * หันเข้ากล้องเกิน ~cos 30° = ทึบเต็ม ต่ำกว่านั้นกลายเป็นเส้นขอบ *ที่มีพื้นจาง ๆ ข้างใน*
     * (ชื่อข้าง ๆ ในแบบอ้างอิงเป็นเส้นขาวอมเทากับเนื้อโปร่งราวหนึ่งในห้า ไม่ใช่เส้นกลวง)
     */
    float k = smoothstep(0.62, 0.9, vFace);
    float side = max(line * 0.85, fill * 0.2);
    a = mix(side, fill, k);
    c = mix(vec3(0.82, 0.85, 0.88), f4.rgb, k);
  }
  a *= uShow;
  if (a < 0.01) discard;
  gl_FragColor = vec4(c, a);
  #include <colorspace_fragment>
}
`
