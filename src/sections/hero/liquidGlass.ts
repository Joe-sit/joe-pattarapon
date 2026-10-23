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
      /* ฟองกลายเป็นกระเบื้องลูกโลก (เรื่องโลก): ทาทึบไล่ฟ้าเขียว → น้ำเงิน ตามแนวทแยงของตัวฟอง */
      uTile: { value: 0 },
      uTileA: { value: new THREE.Color('#38e3c4') },
      uTileB: { value: new THREE.Color('#3d6bff') },
      uTileSpan: { value: 100 },
      /* โหมดมืด (บท Code): เนื้อแก้วเป็นกระจกดำเงา ขอบสะท้อนขาวอมม่วงคมขึ้น */
      uDark: { value: 0 },
      /* จางทั้งแผ่น (ปลายบท Code: เครื่องหลบให้วิดเจ็ตฟ้าเต็มจอ — ขอบแก้วไม่พาดทับ) */
      uFade: { value: 1 },
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
      uniform float uTile;
      uniform vec3 uTileA;
      uniform vec3 uTileB;
      uniform float uTileSpan;
      uniform float uDark;
      uniform float uFade;
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
        /* โหมดมืด: เนื้อแก้วใสเกือบหมด เหลือแต่ขอบสะท้อนขาวอมม่วงคม — แก้วนี้วาดทับของบนจอ เนื้อทึบ/ย้อมดำทำให้ของในจอหม่นและสีเพี้ยนระหว่างเปลี่ยน */
        float hl = clamp(spec * 1.3 + line * 1.4, 0.0, 1.0);
        col = mix(col, vec3(0.94, 0.92, 1.0), uDark);
        a = mix(a, clamp(0.03 + hl, 0.0, 1.0), uDark);

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
        /* กระเบื้อง: ไล่สีตามแนวทแยง + ขอบที่หันออกข้างเข้มลง (ผนังกระเบื้อง) + ไฮไลต์ขอบฝั่งไฟ */
        float tg = clamp(0.5 + (vLocal.x * 0.8 - vLocal.y * 0.6) / max(uTileSpan, 1.0), 0.0, 1.0);
        vec3 tc = mix(uTileA, uTileB, smoothstep(0.1, 0.95, tg));
        tc = mix(tc, uTileB * 0.8, smoothstep(0.3, 0.9, rim));
        tc += vec3(spec * 0.6 + line * 0.5);
        col = mix(col, tc, uTile);
        a = mix(a, 1.0, uTile);
        /* ย้อมม่วง: กลางแผ่นม่วงเข้ม ขอบที่หันออกข้างจางขาวฟุ้ง (แก้วฝ้าม่วงแบบภาพอ้างอิง) */
        gl_FragColor = vec4(col, a * uFade);
        // สีเทาของแบบเป็น sRGB — three แปลงเป็นเชิงเส้นตอนตั้งค่า ต้องแปลงกลับตอนออก ไม่งั้นเทาเข้มกว่าแบบ
        #include <colorspace_fragment>
      }`,
  })
}

/**
 * แก้วเดียวกับฟอง แต่ย้อมสี — วิดเจ็ตบนจอเครื่อง (./BenchScreen) ให้คุณภาพผิวเท่าฟองหัวเรื่อง
 *
 * แสงที่ขอบชุดเดียวกับ makeLiquidGlass ทุกตัวเลข (ขอบสะท้อนฝั่งไฟซ้ายบน แสงทะลุฝั่งตรงข้าม เส้นขอบบาง แถบเลนส์)
 * ต่างแค่เนื้อ: ย้อมสีของวิดเจ็ต และหนากว่าฟอง (body) จึงอ่านเป็นแผ่นสีพาสเทลใส ไม่ใช่พลาสติกทึบ
 * เนื้อหนาขึ้นนิดที่ขอบ (แก้วหนาตามความโค้ง) · โปร่งจริงผ่านอัลฟาของแคนวาส ฟ้าข้างหลังจึงทะลุมา
 */
export function makeTintGlass(color: THREE.ColorRepresentation, body: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    /* uFill: ระดับสี — เหนือระดับเติมแล้ว (หน่วยท้องถิ่นของแผ่น y · ไหลลงตามลำแสงสแกน) · uSpan ครึ่งความสูงแผ่น — บท Code วิดเจ็ตเติมสีเต็มใบ */
    uniforms: { uTint: { value: new THREE.Color(color) }, uBody: { value: body }, uDark: { value: 0 }, uFill: { value: 1e5 }, uSpan: { value: 1 }, uFillTop: { value: new THREE.Color(color) }, uFillBot: { value: new THREE.Color(color) }, uAlpha: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying float vY;
      void main() {
        vN = normalize(normalMatrix * normal);
        vY = position.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTint;
      uniform float uBody;
      uniform float uDark;
      uniform float uFill;
      uniform float uSpan;
      uniform vec3 uFillTop;
      uniform vec3 uFillBot;
      uniform float uAlpha;
      varying vec3 vN;
      varying float vY;
      void main() {
        vec3 n = normalize(vN);
        float rim = clamp(1.0 - n.z, 0.0, 1.0);
        vec2 side = length(n.xy) > 1e-4 ? normalize(n.xy) : vec2(0.0);
        vec2 L = normalize(vec2(-0.55, 0.83));
        float toward = max(dot(side, L), 0.0);
        float away = max(dot(side, -L), 0.0);
        float spec = pow(rim, 2.2) * (pow(toward, 2.5) * 0.95 + pow(away, 2.5) * 0.5);
        float line = smoothstep(0.82, 0.98, rim) * 0.35;
        float lens = smoothstep(0.08, 0.45, rim) * (1.0 - smoothstep(0.45, 0.9, rim)) * 0.1;

        float a = uBody * (0.85 + 0.3 * smoothstep(0.0, 0.6, rim));
        vec3 col = uTint;
        float hl = clamp(spec + line, 0.0, 1.0);
        col = mix(col, vec3(1.0), hl / max(a + hl, 1e-4));
        a += hl;
        col = mix(col, uTint * 0.5, lens / max(a + lens, 1e-4));
        a = clamp(a + lens, 0.0, 1.0);
        /* โหมดมืด: การ์ดกระจกดำย้อมสีจาง ๆ ขอบเรืองสีของมันเอง */
        vec3 dk = mix(vec3(0.07, 0.065, 0.11) + uTint * 0.07, mix(uTint, vec3(1.0), 0.45), clamp(hl * 1.2, 0.0, 1.0));
        col = mix(col, dk, uDark);
        a = mix(a, clamp(0.45 + hl, 0.0, 1.0), uDark);
        /* เติมสี: ใต้ระดับเป็นสีไล่ของวิดเจ็ต (บน → ล่าง) ขอบยังสะท้อนแสง · ผิวน้ำสีเป็นเส้นสว่างนุ่ม */
        vec3 vivid = mix(uFillBot, uFillTop, smoothstep(-uSpan, uSpan, vY));
        /* เติมจากบนลงล่าง: เหนือระดับ = เติมแล้ว (ระดับเลื่อนลงตามลำแสงสแกน) */
        float under = smoothstep(uFill - 1.5, uFill + 1.5, vY);
        vec3 fc = mix(vivid, vec3(1.0), clamp(hl * 0.9, 0.0, 1.0));
        col = mix(col, fc, under);
        a = mix(a, 1.0, under);
        float lip = exp(-(vY - uFill) * (vY - uFill) / 18.0) * step(-uSpan, uFill) * step(uFill, uSpan);
        col = mix(col, vec3(1.0), lip * 0.7);
        a = max(a, lip * 0.8) * uAlpha;
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`,
  })
}

/**
 * วิดเจ็ตแบบภาพประกอบ macOS Sonoma (Shortcuts) — แผ่นหนาทึบ หน้าไล่สีพ่นนุ่มหลายโทน เกรนฟิล์ม ขอบข้างเรืองเขียวมะนาว
 *
 * uniform ชุดเดียวกับ makeTintGlass (uDark · uFill · uSpan · uFillTop · uFillBot · uAlpha) — บท Code ใช้ต่อได้ไม่ต้องแก้
 * หน้าโหมดสว่างไล่จาก uFillBot → uFillTop (แนวทแยง) แทนแก้วใส
 */
export function makeChunkyTile(color: THREE.ColorRepresentation) {
  return new THREE.ShaderMaterial({
    transparent: true,
    toneMapped: false,
    uniforms: { uTint: { value: new THREE.Color(color) }, uDark: { value: 0 }, uFill: { value: 1e5 }, uSpan: { value: 1 }, uFillTop: { value: new THREE.Color(color) }, uFillBot: { value: new THREE.Color(color) }, uAlpha: { value: 1 }, uFaceTop: { value: new THREE.Color(color) }, uFaceBot: { value: new THREE.Color(color) }, uMap: { value: null as THREE.Texture | null }, uHasMap: { value: 0 }, uVivid: { value: 0 }, uHalf: { value: new THREE.Vector2(1, 1) } },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vO;
      varying vec3 vP;
      void main() {
        vN = normalize(normalMatrix * normal);
        vO = normal;
        vP = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTint;
      uniform float uDark;
      uniform float uFill;
      uniform float uSpan;
      uniform vec3 uFillTop;
      uniform vec3 uFillBot;
      uniform float uAlpha;
      uniform vec3 uFaceTop;
      uniform vec3 uFaceBot;
      uniform sampler2D uMap;
      uniform float uHasMap;
      uniform float uVivid;
      uniform vec2 uHalf;
      varying vec3 vN;
      varying vec3 vO;
      varying vec3 vP;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        /* ขอบข้าง = ผิวที่ไม่หันหน้า (normal ท้องถิ่นแกน z ต่ำ) — นับส่วนโค้งของ bevel ด้วย */
        float side = 1.0 - smoothstep(0.35, 0.85, abs(normalize(vO).z));
        float t = clamp(vP.y / max(uSpan, 1.0) * 0.5 + 0.5, 0.0, 1.0);
        float d = clamp((vP.y - vP.x * 0.55) / max(uSpan, 1.0) * 0.5 + 0.5, 0.0, 1.0);
        /* หน้า: ไล่ทแยง + ก้อนสีพ่นนุ่ม (แสงจากซ้ายบน) */
        /* สีเติมของบท Code (คงเดิม) กับหน้าโหมดสว่าง (สีภาพประกอบ / ภาพวาดบนแคนวาส) แยกกัน */
        vec3 vivid = mix(uFillBot, uFillTop, smoothstep(0.0, 1.0, d));
        vec3 face = mix(uFaceBot, uFaceTop, smoothstep(0.0, 1.0, d));
        if (uHasMap > 0.5) face = texture2D(uMap, clamp(vP.xy / (uHalf * 2.0) + 0.5, 0.0, 1.0)).rgb;
        float glow = exp(-dot(vP.xy - vec2(-0.5, 0.6) * uSpan, vP.xy - vec2(-0.5, 0.6) * uSpan) / (uSpan * uSpan * 1.4));
        face = mix(face, vec3(1.0), glow * 0.12);
        face *= 0.9 + 0.1 * t;
        /* ขอบข้าง: เขียวมะนาวเรือง ไล่ชมพูนิด ๆ ตามแนว */
        vec3 lime = mix(vec3(0.86, 0.97, 0.45), vec3(1.0, 0.86, 0.72), smoothstep(-1.0, 1.0, vP.x / max(uSpan, 1.0)));
        vec3 col = mix(face, lime, side);
        /* แสงขอบบนบาง ๆ */
        vec3 n = normalize(vN);
        col += vec3(0.12) * smoothstep(0.6, 1.0, n.y) * side;
        /* เกรนฟิล์ม (พิกเซลจอ) */
        col += (hash(floor(gl_FragCoord.xy)) - 0.5) * 0.12;
        float a = 1.0;
        /* โหมดมืด: แผ่นมืดย้อมสีจาง ขอบเรือง (บท Code ก่อนสแกนเติมสี) */
        vec3 dk = mix(vec3(0.02, 0.018, 0.035) + uTint * 0.03, mix(uTint, vec3(1.0), 0.45), side * 0.8);
        col = mix(col, dk, uDark);
        a = mix(a, 0.5 + side * 0.4, uDark);
        /* เติมสี (บท Code): เหนือระดับ = หน้าไล่สีเต็ม */
        float under = smoothstep(uFill - 1.5, uFill + 1.5, vP.y);
        /* เติมแล้ว = หน้าแบบโหมดสว่าง (widget ชุดเดียวกัน) · uVivid → สีเติมล้วน (การ์ดฟ้าตอนขยายเต็มจอ ต่อเป็นท้องฟ้า) */
        col = mix(col, mix(mix(face, vivid, uVivid), lime, side * (1.0 - uVivid)), under * uDark);
        a = mix(a, 1.0, under);
        float lip = exp(-(vP.y - uFill) * (vP.y - uFill) / 18.0) * step(-uSpan, uFill) * step(uFill, uSpan);
        col = mix(col, vec3(1.0), lip * 0.7 * uDark);
        a = max(a, lip * 0.8) * uAlpha;
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`,
  })
}
