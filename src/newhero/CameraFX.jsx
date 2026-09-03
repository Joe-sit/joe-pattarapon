import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'

/**
 * เอฟเฟกต์กล้อง — วาดฉากลงบัฟเฟอร์ก่อน แล้วค่อยเอามาบิดตอนพ่นลงจอ
 *
 * ทำไมต้องผ่านบัฟเฟอร์: การบิดภาพแบบ fisheye เป็นการ "ย้ายพิกเซล" ซึ่งทำที่เมทริกซ์
 * ของกล้องไม่ได้ (เมทริกซ์ทำได้แค่การแปลงเชิงเส้น เส้นตรงยังเป็นเส้นตรงเสมอ)
 * ต้องมีภาพที่เรนเดอร์เสร็จแล้วก่อน จึงจะสุ่มพิกเซลจากตำแหน่งใหม่ได้
 *
 * บัฟเฟอร์ต้องมี stencil ด้วย — พอร์ทัลหน้าต่างของฉากนี้ใช้ stencil เป็นตัวจำกัดพื้นที่วาด
 * ถ้าบัฟเฟอร์ไม่มี ช่องหน้าต่างจะกลายเป็นทึบทั้งบาน
 */

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTex;
  uniform float uFish;
  uniform float uSkewX;
  uniform float uSkewY;
  uniform float uZoom;
  uniform float uChroma;
  uniform float uAspect;
  uniform float uBulge;
  uniform float uBulgeR;
  uniform vec2 uBulgeC;
  uniform sampler2D uDepth;
  uniform float uNear;
  uniform float uFar;
  uniform vec2 uTexel;
  uniform float uRim;
  uniform float uRimW;
  uniform float uRimSoft;
  uniform float uRimThresh;
  uniform float uRimMix;
  uniform vec2 uRimDir;
  uniform vec3 uRimColor;
  uniform float uExposure;
  uniform float uTone;
  uniform float uRimFall;
  uniform float uRimShade;
  uniform vec3 uRimL;
  uniform vec2 uProj;

  /**
   * แปลง linear -> sRGB เอง
   *
   * บัฟเฟอร์เก็บค่าใน working space (linear) ส่วนจอรับค่าแบบ sRGB — วัสดุมาตรฐานของ three
   * แปลงให้ตอนวาดลงจอ แต่ ShaderMaterial ดิบ ๆ ไม่มีขั้นนั้น ปล่อยผ่านแล้วสีจะจัดเกินจริง
   * (เขียวเป็นนีออน ส้มเป็นแดง) — เป็นสูตรเดียวกับที่ three ใช้ ไม่ใช่ gamma 2.2 แบบประมาณ
   */
  vec3 toSRGB(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }

  /**
   * แปลงพิกัดจอ -> พิกัดที่จะไปสุ่มภาพ
   * k คุมความแรงของการบิดต่อสี (ใช้ทำ chromatic aberration: แต่ละสีบิดไม่เท่ากัน)
   */
  vec2 warp(vec2 uv, float k) {
    // ย้ายจุดกำเนิดมากลางจอ และแก้อัตราส่วนภาพ ไม่งั้นวงบิดจะเป็นวงรี
    vec2 c = uv - 0.5;
    c.x *= uAspect;

    // เอียงภาพ (skew) — เลื่อนแกนหนึ่งตามอีกแกน เส้นตั้งจึงลาดไปข้าง
    vec2 s = vec2(c.x + uSkewX * c.y, c.y + uSkewY * c.x);

    // fisheye: ยิ่งห่างจากกลางยิ่งถูกดันออก (บวก = นูน / ลบ = เว้า)
    float r2 = dot(s, s);
    s *= 1.0 + k * r2;

    /**
     * เลนส์นูนเฉพาะจุด — ขยายของที่อยู่ในวงรัศมีหนึ่ง ส่วนนอกวงไม่แตะเลย
     *
     * คนละเรื่องกับ fisheye ซึ่งบิดทั้งเฟรมจากจุดกึ่งกลางเสมอ อันนี้เลือกจุดได้
     * และมีขอบเขต จึงใช้ "เน้นเฉพาะจุด" ได้จริง เช่นดันหัวหรือมือให้ใหญ่เกินสัดส่วน
     *
     * ความแรงไล่ลงด้วย (1 - r^2)^2 ไม่ใช่ตัดตรง ๆ ที่ขอบวง — ตัดตรงจะเห็นเป็นเส้นวงกลม
     * คมรอบบริเวณที่ขยาย สูตรนี้ค่อย ๆ จางจนเป็นศูนย์พอดีที่ขอบ รอยต่อเลยไม่มี
     */
    if (uBulge != 0.0 && uBulgeR > 0.0001) {
      vec2 ctr = (uBulgeC - 0.5) * vec2(uAspect, 1.0);
      vec2 d = s - ctr;
      float r = length(d) / uBulgeR;
      if (r < 1.0) {
        float fall = 1.0 - r * r;
        // ดึงจุดที่สุ่มเข้าหาศูนย์กลาง = ภาพตรงนั้นถูกขยาย
        s = ctr + d * (1.0 - uBulge * fall * fall);
      }
    }

    s /= max(0.0001, uZoom);
    s.x /= uAspect;
    return s + 0.5;
  }

  /**
   * tone mapping แบบเดียวกับที่ three ใช้ตอนวาดลงจอ (ACES Filmic + exposure)
   *
   * three ใส่ tone mapping ให้เฉพาะตอนวาดลงจอเท่านั้น — วาดลงบัฟเฟอร์จะได้ค่าดิบ
   * ถ้าไม่ทำเองตรงนี้ พอเปิด post pass สีทั้งฉากจะเปลี่ยน (จัดกว่า สว่างกว่า)
   * ทั้งที่ไม่ได้แตะอะไรเลย สูตรและตัวเลขก๊อปจาก tonemapping_pars_fragment ของ three
   */
  vec3 fxRRTAndODTFit(vec3 v) {
    vec3 a = v * (v + 0.0245786) - 0.000090537;
    vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
    return a / b;
  }
  vec3 acesFilmic(vec3 color) {
    const mat3 inMat = mat3(
      vec3(0.59719, 0.07600, 0.02840),
      vec3(0.35458, 0.90834, 0.13383),
      vec3(0.04823, 0.01566, 0.83777)
    );
    const mat3 outMat = mat3(
      vec3(1.60475, -0.10208, -0.00327),
      vec3(-0.53108, 1.10813, -0.07276),
      vec3(-0.07367, -0.00605, 1.07602)
    );
    color *= uExposure / 0.6;
    color = inMat * color;
    color = fxRRTAndODTFit(color);
    color = outMat * color;
    return clamp(color, 0.0, 1.0);
  }

  /** depth buffer (0..1, ไม่เชิงเส้น) -> ระยะจริงจากกล้อง (หน่วยโลก) */
  float linDepth(vec2 uv) {
    float z = texture2D(uDepth, uv).x * 2.0 - 1.0;
    return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
  }

  /** ตำแหน่งใน view space ของพิกเซล — ย้อนจากความลึกเชิงเส้นกับมุมกล้อง */
  vec3 viewPos(vec2 uv) {
    float d = linDepth(uv);
    return vec3((uv - 0.5) * 2.0 * uProj * d, -d);
  }

  /**
   * rim จากภาพ — "แสงที่เกาะผิวใกล้ขอบฝั่งไฟ" ไม่ใช่เส้นขอบ
   *
   * fresnel (มุมผิวกับสายตา) ใช้กับตัวละครทรงกล่องไม่ได้: หน้าแบน ค่าเท่ากันทั้งหน้า
   * ไม่ "ทั้งหน้าสว่าง" ก็ "ไม่ขึ้นเลย" ส่วนไฟ directional จากหลังก็สาดทั้งหน้าบน/หลัง
   *
   * สองส่วนที่แยก rim ออกจาก outline:
   *   1. ความแรงไล่จากเส้นรอบรูปเข้ามาในตัว (กว้าง uRimW px ลดตาม uRimFall)
   *      วัดจาก "ระยะถึงขอบในทิศไฟ": เดินจากพิกเซลไปทางไฟทีละก้าว ก้าวไหนตกขอบ
   *      (ความลึกกระโดดไกล) = พิกเซลนี้ห่างขอบเท่านั้นก้าว — ยิ่งใกล้ยิ่งสว่าง
   *   2. คูณด้วยผิวที่ "หันหาไฟ" จริง ๆ (normal จากอนุพันธ์ของตำแหน่ง view space)
   *      หน้าที่เอียงเข้าหาไฟจึงติดแสง หน้าที่หันหากล้องตรง ๆ ไม่ติด — เป็นแสง ไม่ใช่สโตรก
   *
   * uRimMix 1 = เฉพาะฝั่งไฟ, 0 = รอบตัวทุกด้าน
   */
  float rimGlow(vec2 uv) {
    float d0 = linDepth(uv);
    // พื้นหลัง (สุดระยะ) ไม่ใช่วัตถุ
    if (d0 > uFar * 0.98) return 0.0;
    float t = uRimThresh * d0;
    float t2 = t * (1.0 + uRimSoft * 4.0);
    float glow = 0.0;
    const int N = 10;
    for (int i = 1; i <= N; i++) {
      float k = float(i) / float(N);
      vec2 px = uTexel * uRimW * k;
      float lit = linDepth(uv + uRimDir * px) - d0;
      float all = max(
        max(linDepth(uv + vec2(px.x, 0.0)) - d0, linDepth(uv - vec2(px.x, 0.0)) - d0),
        max(linDepth(uv + vec2(0.0, px.y)) - d0, linDepth(uv - vec2(0.0, px.y)) - d0)
      );
      float edge = smoothstep(t, t2, mix(all, lit, uRimMix));
      // น้ำหนักตามระยะถึงขอบ — ใกล้ขอบ = 1 ไกลออกไป = ค่อย ๆ หมด
      float w = pow(1.0 - (float(i) - 1.0) / float(N), uRimFall);
      glow = max(glow, edge * w);
    }
    // ผิวหันหาไฟแค่ไหน
    vec3 p = viewPos(uv);
    vec3 n = normalize(cross(dFdx(p), dFdy(p)));
    // ทิศของ cross ขึ้นกับลำดับอนุพันธ์ซึ่งกลับด้านได้ตามบัฟเฟอร์ — ผิวที่เห็นต้องหันหากล้อง (z บวก) เสมอ
    if (n.z < 0.0) n = -n;
    float facing = clamp(dot(n, uRimL), 0.0, 1.0);
    return glow * mix(1.0, facing, uRimShade);
  }

  void main() {
    vec2 uvG = warp(vUv, uFish);
    // นอกกรอบภาพ = ไม่มีข้อมูลให้สุ่ม คืนความโปร่งไป ไม่ใช่ยืดขอบให้เป็นริ้ว
    if (uvG.x < 0.0 || uvG.x > 1.0 || uvG.y < 0.0 || uvG.y > 1.0) {
      gl_FragColor = vec4(0.0);
      return;
    }
    vec3 col;
    if (uChroma > 0.0001) {
      vec2 uvR = warp(vUv, uFish * (1.0 + uChroma));
      vec2 uvB = warp(vUv, uFish * (1.0 - uChroma));
      col = vec3(texture2D(uTex, uvR).r, texture2D(uTex, uvG).g, texture2D(uTex, uvB).b);
    } else {
      col = texture2D(uTex, uvG).rgb;
    }
    if (uRim > 0.0001) {
      // ผสมแบบ screen ไม่ใช่บวกตรง ๆ — ที่สว่างอยู่แล้วไม่กลายเป็นขาวตัน เนื้อสียังอยู่
      vec3 r = uRimColor * (rimGlow(uvG) * uRim);
      col = 1.0 - (1.0 - col) * (1.0 - clamp(r, 0.0, 1.0));
    }
    // uTone 0 = ไม่ tone map (โหมดแบน) แค่คูณ exposure แล้วตัดที่ 1
    col = uTone > 0.5 ? acesFilmic(col) : clamp(col * uExposure, 0.0, 1.0);
    gl_FragColor = vec4(toSRGB(col), 1.0);
  }
`

export function CameraFX({
  fish = 0,
  skewX = 0,
  skewY = 0,
  zoom = 1,
  chroma = 0,
  bulge = 0,
  bulgeR = 0.35,
  bulgeX = 0.5,
  bulgeY = 0.5,
  /** rim จากขอบภาพ — ความแรง, กว้าง (px), นุ่ม, เกณฑ์ความลึก, ฝั่งไฟ, มุมไฟบนจอ (องศา) */
  rim = 0,
  rimW = 2,
  rimSoft = 0.5,
  rimThresh = 0.04,
  rimMix = 1,
  rimAngle = 120,
  rimColor = '#fff3dc',
  /** ความชันของการไล่จากขอบ, น้ำหนักของ "ผิวหันหาไฟ", ไฟอยู่หลังตัวแค่ไหน */
  rimFall = 1.5,
  rimShade = 0.7,
  rimBack = 0.6,
  /** 1 = ACES ตามปกติ, 0 = ไม่ tone map (โหมดแบน) */
  tone = 1,
}) {
  const { gl, scene, camera, size, viewport } = useThree()
  const self = useRef()

  const dpr = viewport.dpr
  const target = useMemo(() => {
    const t = new THREE.WebGLRenderTarget(
      Math.max(1, Math.floor(size.width * dpr)),
      Math.max(1, Math.floor(size.height * dpr)),
      {
        stencilBuffer: true,
        depthBuffer: true,
        type: THREE.HalfFloatType,
        // MSAA ในบัฟเฟอร์ — ผ้าใบจริงเปิด antialias ไว้ ถ้าบัฟเฟอร์ไม่มี ขอบจะหยักขึ้นมาทันที
        samples: 4,
        /**
         * เก็บความลึกเป็น texture ด้วย — rim แบบตรวจขอบอ่านจากตรงนี้
         * ต้องเป็น Depth24Stencil8 เพราะบัฟเฟอร์นี้ใช้ stencil (พอร์ทัล) อยู่แล้ว
         */
        depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedInt248Type),
      },
    )
    t.depthTexture.format = THREE.DepthStencilFormat
    // บัฟเฟอร์นี้คือ "ภาพหลัก" ของเฟรม — ของที่ซ่อนตัวจากบัฟเฟอร์กระจก (เส้นขอบสวิตช์) ต้องยังวาดลงนี่
    t.userData = { ...t.userData, mainPass: true }
    t.texture.minFilter = THREE.LinearFilter
    t.texture.magFilter = THREE.LinearFilter
    return t
  }, [size.width, size.height, dpr])

  /** ฉากของ quad แยกจากฉากหลัก — ถ้าอยู่ในฉากเดียวกันมันจะถูกวาดลงบัฟเฟอร์ตัวเองด้วย */
  const post = useMemo(() => {
    const s = new THREE.Scene()
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTex: { value: null },
        uFish: { value: 0 },
        uSkewX: { value: 0 },
        uSkewY: { value: 0 },
        uZoom: { value: 1 },
        uChroma: { value: 0 },
        uAspect: { value: 1 },
        uBulge: { value: 0 },
        uBulgeR: { value: 0.35 },
        uBulgeC: { value: new THREE.Vector2(0.5, 0.5) },
        uDepth: { value: null },
        uNear: { value: 0.1 },
        uFar: { value: 100 },
        uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 1024) },
        uRim: { value: 0 },
        uRimW: { value: 2 },
        uRimSoft: { value: 0.5 },
        uRimThresh: { value: 0.04 },
        uRimMix: { value: 1 },
        uRimDir: { value: new THREE.Vector2(0, 1) },
        uRimColor: { value: new THREE.Color('#fff3dc') },
        uExposure: { value: 1 },
        uTone: { value: 1 },
        uRimFall: { value: 1.5 },
        uRimShade: { value: 0.7 },
        uRimL: { value: new THREE.Vector3(0, 1, 0) },
        uProj: { value: new THREE.Vector2(1, 1) },
      },
    })
    s.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat))
    return { scene: s, cam, mat }
  }, [])

  useMemo(() => () => target.dispose(), [target])

  /**
   * priority 1 = เข้ามาแทนลูปวาดปกติของ r3f ทั้งหมด
   * ต้องสั่งวาดเองทั้งสองรอบ: รอบแรกลงบัฟเฟอร์ รอบสองพ่น quad ลงจอ
   */
  useFrame(() => {
    const m = post.mat.uniforms
    m.uFish.value = fish
    m.uSkewX.value = skewX
    m.uSkewY.value = skewY
    m.uZoom.value = zoom
    m.uChroma.value = chroma
    m.uBulge.value = bulge
    m.uBulgeR.value = bulgeR
    // y ของจอนับจากบนลงล่าง ส่วน uv ของ texture นับจากล่างขึ้นบน — กลับให้ตรงกับที่ตาเห็น
    m.uBulgeC.value.set(bulgeX, 1.0 - bulgeY)
    m.uAspect.value = size.width / Math.max(1, size.height)
    m.uTex.value = target.texture
    m.uDepth.value = target.depthTexture
    m.uNear.value = camera.near
    m.uFar.value = camera.far
    m.uTexel.value.set(1 / target.width, 1 / target.height)
    m.uRim.value = rim
    m.uRimW.value = rimW * dpr
    m.uRimSoft.value = rimSoft
    m.uRimThresh.value = rimThresh
    m.uRimMix.value = rimMix
    // มุมบนจอ: 0 = ไฟมาจากขวา, 90 = จากบน (uv ของ texture นับล่างขึ้นบน จึงไม่ต้องกลับ y)
    m.uRimDir.value.set(Math.cos(rimAngle * Math.PI / 180), Math.sin(rimAngle * Math.PI / 180))
    m.uRimColor.value.set(rimColor)
    m.uExposure.value = gl.toneMappingExposure
    m.uTone.value = tone
    m.uRimFall.value = rimFall
    m.uRimShade.value = rimShade
    // ทิศไฟ 3 มิติใน view space: ทิศบนจอ + ถอยไปหลังตัว (z ลบ = ไกลจากกล้อง)
    m.uRimL.value.set(m.uRimDir.value.x, m.uRimDir.value.y, -rimBack).normalize()
    const tanHalf = Math.tan((camera.fov * Math.PI) / 360)
    m.uProj.value.set(tanHalf * camera.aspect, tanHalf)

    // ซ่อนตัวเองไว้ก่อน ไม่ให้กลุ่มว่าง ๆ นี้ไปโผล่ในบัฟเฟอร์
    if (self.current) self.current.visible = false
    gl.setRenderTarget(target)
    gl.clear()
    gl.render(scene, camera)
    gl.setRenderTarget(null)
    gl.clear()
    gl.render(post.scene, post.cam)
    if (self.current) self.current.visible = true
  }, 1)

  return <group ref={self} />
}
