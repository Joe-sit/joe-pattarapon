import * as THREE from 'three'

/**
 * ผิวแก้วของฟอง — ท่า Liquid Glass ของ Apple (iOS 26 / macOS Tahoe)
 *
 * สิ่งที่ทำให้ Liquid Glass เป็นแบบนั้น: เนื้อใสเกือบไม่ย้อมสี, ขอบสะท้อนแสงคมฝั่งที่หันหาไฟ (ซ้ายบน)
 * กับแสงสะท้อนอ่อนกว่าฝั่งตรงข้าม (ขวาล่าง — แสงที่วิ่งทะลุเนื้อแก้วไปออกอีกฝั่ง), เส้นขอบบางสว่างรอบตัว
 * และแถบเลนส์จาง ๆ ด้านในขอบที่ความโค้งหักเหภาพข้างหลังจนมืดลงนิด
 *
 * ทำไมไม่ใช่ MeshTransmissionMaterial: แก้วนั้นหักเหได้แค่ของในแคนวาสตัวเอง แคนวาสนี้ว่าง (ฟ้าอยู่อีกแคนวาส)
 * จึงต้องใช้สีฉากหลังสำรองคงที่ — ได้แผ่นสีทึบย้อมโทน ไม่ใช่แก้วใส ที่นี่เนื้อแก้วโปร่งจริงผ่านอัลฟาของแคนวาส
 * ฟ้าของหน้าจึงอยู่ข้างหลังจริง ส่วน "ความเป็นแก้ว" มาจากแสงที่ขอบทั้งหมด (คิดจากทิศผิวของขอบมน)
 *
 * paint = ทาจุดบอกหน้าเป็นสีแบนตอนจบ: จุดของหน้าที่เปิดอยู่ขาว ที่เหลือฟ้าอ่อน — ผิวของเมชเดิม
 */
export function makeLiquidGlass() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uFill: { value: 0.1 },
      uPaint: { value: 0 },
      // จุดบอกหน้าสามจุด: กลาง x, y, ครึ่งกว้าง, ครึ่งสูง (หน่วยท้องถิ่นของเมช) · uAct = หน้าที่เปิดอยู่ต่อจุด
      uC0: { value: new THREE.Vector4(1e5, 0, 0, 0) },
      uC1: { value: new THREE.Vector4(1e5, 0, 0, 0) },
      uC2: { value: new THREE.Vector4(1e5, 0, 0, 0) },
      uAct: { value: new THREE.Vector3(1, 0, 0) },
      // พาเนลแบบ Spotlight: กลาง x, y, ครึ่งกว้าง, ครึ่งสูง · รัศมีมุม — เนื้อแก้วย้อมกรมท่า ไม่จาง ไม่ถูกทา
      uPanel: { value: new THREE.Vector4(1e5, 0, 0, 0) },
      uPanelR: { value: 0 },
      // ความเป็นพาเนล 0..1 — สีกรมท่าซึมเข้ามาตามการพอง ไม่โผล่ทันที (ตอนเริ่มพองยังเป็นแก้วใสเดียวกับฟอง)
      uPanelTint: { value: 0 },
      uPaintA: { value: new THREE.Color('#f2f3f8') },
      uPaintB: { value: new THREE.Color('#8db3f4') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec2 vLocal;
      void main() {
        vN = normalize(normalMatrix * normal);
        vLocal = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uFill;
      uniform float uPaint;
      uniform vec4 uC0;
      uniform vec4 uC1;
      uniform vec4 uC2;
      uniform vec3 uAct;
      uniform vec4 uPanel;
      uniform float uPanelR;
      uniform float uPanelTint;
      uniform vec3 uPaintA;
      uniform vec3 uPaintB;
      varying vec3 vN;
      varying vec2 vLocal;
      // อยู่ในจุด/แคปซูลไหม (กล่องมนรัศมีเท่าครึ่งด้านสั้น) — เผื่อขอบมนของเมชนิดหน่อย
      float inPill(vec4 c) {
        float r = min(c.z, c.w);
        vec2 q = abs(vLocal - c.xy) - vec2(c.z - r, c.w - r);
        return step(length(max(q, 0.0)) - r, r * 0.06);
      }
      void main() {
        vec3 n = normalize(vN);
        // 0 = หน้าที่หันหากล้อง, 1 = ขอบที่หันออกข้าง
        float rim = clamp(1.0 - n.z, 0.0, 1.0);
        vec2 side = length(n.xy) > 1e-4 ? normalize(n.xy) : vec2(0.0);
        vec2 L = normalize(vec2(-0.55, 0.83)); // ไฟจากซ้ายบน (แกน y ของมุมมองชี้ขึ้น)
        float toward = max(dot(side, L), 0.0);
        float away = max(dot(side, -L), 0.0);
        // ขอบสะท้อนคมฝั่งไฟ + แสงทะลุออกฝั่งตรงข้าม
        float spec = pow(rim, 2.2) * (pow(toward, 2.5) * 0.95 + pow(away, 2.5) * 0.5);
        // เส้นขอบบางสว่างรอบตัว (ตรงที่ผิวหันออกข้างเกือบสุด)
        float line = smoothstep(0.82, 0.98, rim) * 0.35;
        // แถบเลนส์ด้านในขอบ — มืดลงนิดตรงที่ความโค้งเริ่ม
        float lens = smoothstep(0.08, 0.45, rim) * (1.0 - smoothstep(0.45, 0.9, rim)) * 0.1;

        float a = uFill + spec + line;
        vec3 col = vec3(1.0);
        // แถบเลนส์ผสมเป็นเงาน้ำเงินเข้มบาง ๆ
        col = mix(col, vec3(0.08, 0.18, 0.42), lens / max(a + lens, 1e-4));
        a = clamp(a + lens, 0.0, 1.0);

        float i0 = inPill(uC0);
        float i1 = inPill(uC1);
        float i2 = inPill(uC2);
        // สีของจุดตามหน้าที่เปิดอยู่: เปิด = A (ขาว) ไม่เปิด = B (ฟ้าอ่อน) ไล่ตามการเลื่อน
        float act = i0 * uAct.x + i1 * uAct.y + i2 * uAct.z;
        // ในพาเนล: เนื้อแก้วกรมท่าโปร่งแบบหน้าต่าง Spotlight (ขอบสะท้อนยังอยู่) — ไม่จางตามฟอง ไม่ถูกทาเป็นจุด
        vec2 pq = abs(vLocal - uPanel.xy) - (uPanel.zw - uPanelR);
        float inPanel = step(length(max(pq, 0.0)) - uPanelR, uPanelR * 0.04 + 1.0) * step(0.001, uPanel.z);
        // จุดบอกหน้าอยู่บนผิวพาเนล (เนื้อเดียวกัน) — ทาจุดก่อน แล้วที่เหลือของพาเนลเป็นแก้วกรมท่า
        float inDots = max(i0, max(i1, i2));
        float pt = uPaint * inDots;
        vec3 navy = vec3(0.09, 0.17, 0.42);
        float pn = inPanel * (1.0 - pt) * uPanelTint;
        col = mix(col, mix(navy, vec3(1.0), clamp(spec + line, 0.0, 1.0)), pn);
        a = mix(a, clamp(0.62 + spec * 0.5 + line, 0.0, 1.0), pn);
        col = mix(col, mix(uPaintB, uPaintA, act), pt);
        a = mix(a, 1.0, pt);
        gl_FragColor = vec4(col, a);
        // สีเทาของแบบเป็น sRGB — three แปลงเป็นเชิงเส้นตอนตั้งค่า ต้องแปลงกลับตอนออก ไม่งั้นเทาเข้มกว่าแบบ
        #include <colorspace_fragment>
      }`,
  })
}
