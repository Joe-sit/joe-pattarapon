import { useSyncExternalStore } from 'react'

/**
 * ค่าปรับฉาก /new-hero — สโตร์เล็ก ๆ นอก React
 *
 * ค่ากล้องถูกอ่านทุกเฟรมใน useFrame (ห้ามผ่าน state ไม่งั้น re-render 60 ครั้ง/วินาที)
 * ส่วนค่าที่เปลี่ยนรูปทรง (ขนาดแผง ระยะห่าง) อ่านผ่าน useTuner() เพราะต้องสร้าง geometry ใหม่
 *
 * ค่าเริ่มต้นคือค่าที่แก้ได้จากชีท perspective 12739:158714 — ดู docs/new-hero-handoff.md
 */
export const DEFAULTS = {
  /* สวิตช์ (0/1) — เก็บเป็นตัวเลขเพราะสโตร์นี้รับเฉพาะตัวเลข */
  clay: 0,
  props: 0,
  grid: 0,
  skater: 1,
  /* หน้าต่างเป็นพอร์ทัลมองทะลุไปอีกฉาก (ใช้ stencil buffer) */
  portal: 1,
  /**
   * ริบบิ้นในพอร์ทัล — คนละชิ้นกับเส้นหลัก จงใจไม่ผูกกัน
   * ระยะไกลกว่ามาก ค่ากว้าง/หนา/คลื่นจึงต้องแรงกว่าเส้นหน้า ไม่งั้นเหลือเป็นเส้นบาง
   */
  portalZ: -22.5,
  /**
   * ลูกโลกจิ๋ววนลูปในพอร์ทัล (แทนฉาก joespresso เดิม) — รัศมี 1 ก่อนสเกล
   * gbSpeed = เรเดียน/วินาที ที่ดาวหมุนรอบแกนถนน
   */
  gb: 1,
  gbScale: 8,
  gbX: 20,
  gbY: -1.5,
  gbZ: -6,
  gbRotX: -82,
  gbRotY: 0,
  gbRotZ: -125.5,
  gbSpeed: 0.25,
  /** สุ่มผัง / ถนนกว้าง (เรเดียน) / จำนวนของประดับ / สเกลของประดับ */
  gbSeed: 7,
  gbRoad: 0.24,
  gbBushes: 56,
  gbCones: 6,
  gbRounds: 9,
  gbMushrooms: 3,
  gbFlowers: 30,
  gbBerries: 15,
  gbPebbles: 19,
  gbProp: 0.95,
  /* ผนัง/ไฟของฉากในพอร์ทัล */
  /**
   * หน้าต่างโปรแกรมซ้อนกันเป็นรอยลาก (แบบ XP ค้าง) — ของประกอบฉากในพอร์ทัล
   * ระยะเลื่อนต้องเท่ากันทุกชั้น ไล่ไม่เท่ากันแล้วอ่านเป็นของสามชิ้นวางเรียง
   */
  sw: 1,
  swCount: 3,
  swW: 9,
  swH: 6.5,
  swBar: 0.16,
  swDepth: 0.035,
  swRadius: 0.07,
  swBtn: 0.17,
  swInset: 0.04,
  swDX: 1.34,
  swDY: -1.01,
  swDZ: -0.45,
  swScale: 0.7,
  swX: -1.5,
  swY: 8.5,
  swZ: 7,
  swRotX: 7,
  swRotY: 31.5,
  swRotZ: -3,
  /**
   * บล็อกเตตริส — ของประกอบฉากในพอร์ทัลอีกชิ้น
   * teShape เป็นดัชนีของรูปทรง (0=S 1=Z 2=T 3=L 4=O 5=I) ค่าเริ่มต้นคือตัว S ตาม ref
   */
  te: 1,
  teShape: 0,
  teDepth: 0.9,
  teRadius: 0.16,
  teGap: 0.05,
  teScale: 2.2,
  teX: 0,
  teY: 1,
  teZ: 7,
  teRotX: -8,
  teRotY: 24,
  teRotZ: -12,
  /** สวิตช์เปิด/ปิด — ลอยหน้าแถบหน้าต่าง (พิกัดชุดเดียวกับริบบิ้น/ตัวละคร) */
  bc: 1,
  bcLen: 2.2,
  bcRadius: 0.6,
  /** ความหนาของก้อน (extrusion) เทียบรัศมี */
  bcThick: 0.78,
  /** ตำแหน่งปุ่ม 0 = ปิด (ซ้าย) 1 = เปิด (ขวา) */
  bcPos: 1,
  /* ปุ่มกลม — ขนาดเทียบครึ่งความสูงราง / ความหนาเทียบความหนาราง / ระยะล้ำพ้นผิวหน้าราง */
  bcKnob: 0.83,
  bcKnobThick: 0.72,
  bcKnobProud: 0.3,
  bcOpacity: 0.9,
  bcIcon: 0.68,
  /** ความหนาเส้นขอบสวิตช์ — 0 = ไม่มีขอบ */
  bcOutline: 0,
  /** ความเข้มของเส้นขอบ */
  bcOutlineAlpha: 1,
  /** วาดสันของ extrusion (วงหน้า/วงหลัง) */
  bcEdges: 0,
  /** เกณฑ์มุมที่นับว่าเป็นสัน (องศา) */
  bcEdgeAngle: 25,
  /** ความเป็นกระจกของราง 0 = ทึบแบน 1 = ใสหักเหเต็มที่ */
  bcGlass: 1,
  /** ความฝ้าของกระจก — ยิ่งมากของหลังยิ่งเบลอ */
  bcBlur: 0.32,
  /** แก้ว: สะท้อนแผงไฟ / ดัชนีหักเห / แยกสีที่ขอบ */
  bcEnv: 3,
  bcIor: 1,
  bcChroma: 0,
  bcScale: 1.7,
  bcX: 13.5,
  bcY: 4.5,
  bcZ: 16,
  bcRotX: -16.5,
  bcRotY: -71,
  bcRotZ: -13.5,
  /** เคอร์เซอร์พิกเซล (นอกพอร์ทัล) — สูง 1 หน่วยก่อนสเกล */
  cu: 1,
  cuDepth: 0.11,
  cuOutline: 0.03,
  cuScale: 3.65,
  cuX: 1.5,
  cuY: -3,
  cuZ: 14.5,
  cuRotX: 30.5,
  cuRotY: 16.5,
  cuRotZ: -50.5,
  /** เคอร์เซอร์เล็งเมาส์: หมุนในระนาบตัวเองให้ปลายชี้ไปทางเมาส์ — แรง (0 = ปิด), มุมสูงสุด (องศา), หน่วง */
  cuAim: 1,
  cuAimMax: 70,
  cuAimEase: 0.08,
  portalWall: 1,
  portalHemi: 0.7,
  portalKey: 1.1,
  prW: 13.1,
  prThick: 0.53,
  prWave: 2.35,
  prWaves: 1.9,
  prScale: 0.36,
  prX: -18,
  prY: 6,
  prZ: 0,
  prRotX: -0.5,
  prRotY: -15,
  prRotZ: -4,
  /**
   * ไหวเบา ๆ
   *
   * `idle` ขยับทั้งตัวละครและบอร์ดเป็นก้อนเดียว เท้ายังแนบแผ่นตลอด
   * `breathe` คือไหวระดับข้อต่อของ rig ซึ่งบอร์ดตามไม่ได้ — เท้าจะไถหลุดจากแผ่น
   */
  idle: 0,
  breathe: 0,
  idleAmp: 1,
  idleSpeed: 1,
  /**
   * แสง — ambient ต่ำ แล้วไปเพิ่มที่ key/fill/rim
   * ดัน ambient สูงจะสว่างแบบแบน เพราะทุกหน้าได้แสงเท่ากันหมด
   */
  ambIntensity: 0,
  hemiIntensity: 0,
  keyIntensity: 4,
  fillIntensity: 1.2,
  rimIntensity: 3,
  /* rim บนตัวละคร (fresnel ที่ผิว) — power = ความคมของขอบ / boost = ความสว่าง */
  rimPower: 9.9,
  rimBoost: 1.04,
  /**
   * ขอบจริง ๆ ไม่ใช่ทั้งตัวสว่าง: ตัด fresnel ที่ rimEdge (±rimSoft) และให้ขึ้นเฉพาะ
   * ฝั่งที่หันไปหาไฟขอบ (rimDirMix) ทิศไฟเป็นองศาในโลก — yaw 180 = จากหลังตรง ๆ
   */
  /**
   * rim จากขอบภาพ (post pass ใน CameraFX) — เส้นบางที่เส้นรอบรูปฝั่งไฟ ไม่แตะเนื้อใน
   * นี่คือตัวที่ทำงานจริงกับตัวละครทรงกล่อง (fresnel ด้านบนขึ้นแทบไม่เห็น)
   */
  /* ผิวพลาสติกเงาทั้งฉาก — roughness ต่ำ + สะท้อน environment แรงขึ้น (ไม่แตะสี) */
  gloss: 1,
  glossRough: 0.28,
  glossEnv: 1.4,
  rimFx: 1,
  rimFxInt: 1.93,
  rimFxW: 9.5,
  rimFxSoft: 0.4,
  rimFxThresh: 0.04,
  rimFxMix: 1,
  rimFxAngle: 180,
  rimFxFall: 2.95,
  rimFxShade: 0.78,
  rimFxBack: 0.6,
  rimEdge: 0.18,
  rimSoft: 0.5,
  rimDirMix: 1,
  rimYaw: 108,
  rimPitch: 30,
  /** ตัดแสงเป็นชั้น — 0 = ไล่เฉดปกติ, 3 = แบนแบบเวกเตอร์ */
  flatBands: 1,
  /**
   * โหมดแบน (cel) ทั้งฉาก — ผิวด้าน ไม่มี specular แสงถูกตัดเป็น 3 ชั้น: เงา / สีเนื้อ / ไฮไลต์
   * เกณฑ์เป็น "แสงต่อสีเนื้อ" (key 4 ให้ราว 1.3 ที่หน้าตรงไฟ, fill 1.2 ให้ราว 0.4)
   * flatTone 0 = ปิด ACES ด้วย สีสดคงเดิม ไม่ถูกบีบให้หม่น
   */
  flat: 1,
  flatEdge: 0.5,
  flatHiEdge: 1.15,
  flatSoft: 0.05,
  flatShadow: 0.62,
  flatLit: 1,
  flatHi: 0.22,
  flatTint: 0.35,
  flatEnv: 0,
  flatTone: 0,
  /** แผงไฟนุ่มรอบฉาก (environment) — ตัวที่ให้หน้าตาแบบดินน้ำมัน */
  envIntensity: 1.57,
  exposure: 1,
  /**
   * เอฟเฟกต์กล้อง (post) — ปิดไว้เป็นค่าเริ่มต้น
   * fxFish บวก = นูนออก (fisheye) / ลบ = เว้าเข้า, fxSkew = เอียงภาพ, fxChroma = เหลื่อมสีขอบ
   */
  fx: 0,
  fxFish: 0,
  fxSkewX: 0,
  fxSkewY: 0,
  fxZoom: 1,
  fxChroma: 0,
  /** เลนส์นูนเฉพาะจุด — bulge = ความแรง (ลบ = ยุบ), R = รัศมีวง, X/Y = จุดกึ่งกลางบนจอ 0..1 */
  fxBulge: 0,
  fxBulgeR: 0.35,
  fxBulgeX: 0.5,
  fxBulgeY: 0.5,
  /* ของลอย: ปรับสเกล/ตำแหน่งรวมทีเดียว */
  propScale: 0.55,
  propX: 0,
  propY: 2.4,
  propZ: 0,
  /* กล้อง — แก้จากเส้น perspective ที่ผู้ใช้วาดเอง (12739:158699) แล้วจูนต่อด้วยมือ */
  fov: 56.26,
  pitch: 1.57,
  camX: 16.6,
  camY: 3.2,
  camZ: 15,
  /* ถอยกล้องเมื่อจอแคบ — 1 = ไม่ถอยเลย ค่ามุมกล้องที่แก้จากเส้นจึงตรงเป๊ะ */
  fitMax: 1,
  /* แกนพื้น/แถบแผง (องศา) */
  groundYaw: 45.23,
  bandYaw: 26.02,
  /* แถบหน้าต่าง */
  panelCount: 4,
  panelW: 11.4,
  panelH: 11.5,
  panelD: 0.1,
  panelGap: 12.54,
  panelX: 6.36,
  panelZ: -11,
  panelBase: -1.6,
  /* พื้น */
  gridY: 0,
  gridCell: 0.2,
  /* ริบบิ้นกระจก — พุ่งออกจากปากบานที่ 2 (พิกัดสัมพัทธ์กับปากช่อง ระบบเดียวกับริบบิ้นหลัก) */
  gr: 0,
  grW: 3.8,
  grThick: 0.28,
  grScale: 1.5,
  grX: 0,
  grY: 0.6,
  grZ: 0,
  grRotX: 0,
  grRotY: 0,
  grRotZ: 0,
  grRough: 0.18,
  grTrans: 0.96,
  grChroma: 0.03,
  grIor: 1.25,
  /* ริบบิ้น — อยู่ในพิกัดของกลุ่มแถบหน้าต่าง ออฟเซ็ต/การหมุนจึงเป็นพิกัดท้องถิ่น */
  ribbonScale: 1.57,
  ribbonW: 6.5,
  ribbonThick: 0.12,
  ribbonWave: 0.84,
  ribbonWaves: 1.9,
  ribbonX: 6.7,
  ribbonY: -2.4,
  ribbonZ: -4,
  /* หมุนรอบปากช่องบานที่ 2 (องศา) */
  ribbonRotX: -8,
  ribbonRotY: 37.5,
  ribbonRotZ: 1.5,
  /* ตัวละคร — พิกัดในกลุ่มแถบหน้าต่าง (เดียวกับริบบิ้น) */
  skaterScale: 1.87,
  skaterX: 8,
  skaterY: 4.55,
  skaterZ: 13.85,
  skaterRotX: -17,
  skaterRotY: -40,
  skaterRotZ: 0,
  /**
   * ทางเข้า — ตัวละครไหลออกจากในหน้าต่างมาหยุดที่ skaterX/Y/Z
   * จุดเริ่ม (enX/Y/Z) เป็นพิกัดกลุ่มแถบหน้าต่าง เหมือน skaterX/Y/Z — z ติดลบ = อยู่หลังบาน
   * enOver = เลยเป้าแล้วดีดกลับ (0 = หยุดนิ่ม ๆ) enReplay เป็นตัวนับ กดปุ่มแล้วเล่นใหม่
   */
  en: 1,
  enDelay: 1.5,
  enDur: 1.45,
  enX: -12,
  enY: 3.2,
  enZ: -5,
  enArc: 0.8,
  enSpin: -40,
  enBank: 16,
  enScale: 0.45,
  enOver: 0.55,
  /* ไถลบนริบบิ้นจริง: ช่วง t ของเส้น (0 = ในบานที่ 1, ~0.45 = ปากบานที่ 2, 1 = ปลาย) */
  enRide: 1,
  /* เส้นหลัก: เริ่มที่ t (0 = ในโพรงบานที่ 1) ออกจากเส้นที่ t (ปากบาน 2 ≈ 0.45) */
  /** ริบบิ้นในหน้าต่าง: เริ่มไถลที่ t ไหนของเส้นนั้น (ท่อนแรกของทางเข้า) */
  enPT0: 0.45,
  enT0: 0.28,
  enT1: 0.56,
  /* ยังนับว่า "อยู่ในพอร์ทัล" ต่ออีกเท่านี้หลังพ้นปากช่อง (ให้พ้นกรอบก่อนค่อยโผล่เต็มตัว) */
  enMouthPad: 0.02,
  /* ช่วงในพอร์ทัล ไม่ให้ลึกกว่านี้หลังระนาบบาน (หน่วยกลุ่มแถบหน้าต่าง) */
  enBackZ: 6,
  /** ปรับความสูงเหนือผิวเพิ่ม/ลด (0 = สูงเท่าท่าหยุด ซึ่งวัดจากฉากเอง) */
  enUp: 0,
  enFace: 0,
  enBlend: 0.35,
  /* จุดกลางทาง = ปากบานที่ 2 (พิกัดกลุ่มแถบหน้าต่าง) */
  enMidX: -3.5,
  enMidY: 3.2,
  enMidZ: -1,
  /**
   * เส้นทางเข้า — วัดจากกึ่งกลางความกว้างของริบบิ้นจริง ไม่ใช่จุดที่ตั้งเลขเอง
   * (ดู ribbonWaypoints ใน Entrance.jsx) รูปเส้นจึงมาจาก enT0/enT1/enUp ชุดเดียวกับโหมด ride
   * ตำแหน่งอ่านจากผิวจริงทุกเฟรม เส้นทางจึงเป็นคลื่นเดียวกับริบบิ้น
   * จุดที่โผล่พ้นกรอบวัดจากปากช่องเอง (ride.mouthT) เผื่อความหนากรอบด้วย enMouthPad
   */
  /* หยุดชั่วคราวตอนจัดเส้น: แช่ที่ความคืบหน้า enScrub (0 = ต้นเส้น, 1 = ปลาย) */
  enPause: 0,
  enScrub: 0.5,
  /**
   * ช่วงที่เล่น: 0 = ต้นเส้น, 1 = ตำแหน่งจบ
   * เต็มช่วง (0→1) เล่นครั้งเดียวแล้วค้าง — แคบกว่านั้นวนซ้ำเฉพาะช่วง (ใช้ตอนจูน)
   */
  enFrom: 0,
  enTo: 1,
  enPath: 1,
  /** 1 = ไถลบนริบบิ้นในหน้าต่างก่อนแล้วส่งไม้ต่อ (มีรอยต่อ) · 0 = เส้นหลักเส้นเดียวตลอด */
  enTwo: 0,
  enShowPath: 1,
  enReplay: 2,
  /** ช่วงท้ายของทางเข้าพุ่งออกมาเร็ว ๆ: เริ่มพุ่งที่สัดส่วนเวลา / ใช้ระยะทางกี่ส่วน (0 = ไม่พุ่ง) */
  enBurstAt: 0.9,
  enBurstAmt: 0.12,
  /**
   * จังหวะตามฟิสิกส์ (enGrav) — เร็วตอนลงเนิน ช้าตอนขึ้นเนิน วัดจากความสูงจริงของเส้น
   * 0 = ความเร็วตามอีสซิ่งล้วน ๆ, 1 = แทบหยุดที่ยอดคลื่นแล้วพุ่งลงมา
   * enLean = ตัวคูณมุมเอียงเข้าโค้งที่คำนวณจากความโค้งจริง (0 = ไม่เอียงตามโค้ง)
   */
  enGrav: 0.5,
  enLean: 1,
  /** หมุนตัวตามทิศของเส้นแค่ไหน (0 = หันทิศเดียวกับท่าจบตลอดทาง, 1 = เกาะผิวเต็มตัว) */
  enTurn: 0,
  /** ยุบแล้วเด้งตอนลงพื้น (สัดส่วนของสเกล 0 = ไม่มี) */
  enSquash: 0,
  /**
   * อินโทร (ปรากฏ) — นาฬิกาเริ่มตอนตัวละครพร้อม (ดู intro.js) หน่วยวินาที
   * หน้าต่างโผล่ทีละบาน → ริบบิ้นวาดออกมา → ตัวละครไหลออก (enDelay) → เคอร์เซอร์/สวิตช์พุ่งตาม
   */
  intro: 1,
  inWinAt: 0,
  inWinStep: 0.24,
  inWinDur: 0.85,
  inRibAt: 0.45,
  inRibDur: 2.0,
  /** สัดส่วนของเส้นในพอร์ทัลในการวาด (ที่เหลือคือเส้นข้างนอก) */
  inRibSplit: 0.4,
  inPropAt: 0.1,
  inPropGap: 0.25,
  inPropDur: 0.8,
  inPropDist: 1,
  inOver: 1.1,
  /** หน้าต่างลอยขึ้นจากข้างล่างกี่หน่วย และเริ่มคว่ำกี่องศาแล้วเงยจนตรง */
  inWinRise: 3,
  inWinTilt: -28,
  /** กล้อง: เริ่มจากออฟเซ็ต (เข้าใกล้/ต่ำ/เฉียง) แล้วถอยกลับที่มุมจริงใน inCamDur วิ */
  inCamDolly: -4,
  inCamX: -2.5,
  inCamY: -1.2,
  inCamYaw: -7,
  inCamDur: 4.4,
  /** วิ หลังเคอร์เซอร์โผล่ ที่มัน "คลิก" แล้วสวิตช์สับเปิด */
  inClickAt: 0.5,
  /** ดาวในหน้าต่างหมุนติ้วตอนเปิด (เรเดียน/วิ เพิ่มจากปกติ แล้วผ่อนลง) */
  inGlobeSpin: 3,
  /**
   * หน้าการ์ตูน (ตาขาว+ลูกตาดำ+คิ้ว+ปากอ้า) — สัดส่วนเทียบกล่องหัว: กว้าง W / สูง H
   * วัดจากภาพอ้างอิง (หน้ากว้าง ~620px) แล้วเลื่อนลงให้พ้นผม — ผมของ GLB คลุมหัวลงมาถึง
   * ราว 45% ของกล่อง หน้าที่เห็นจริงคือครึ่งล่าง ทุกอย่างจึงวางเทียบแถบผิวที่เห็น
   */
  fcEye: 0.09,
  fcGap: 0.145,
  fcEyeY: -0.24,
  fcPupil: 0.6,
  fcPupilX: 0.055,
  fcPupilY: 0.0,
  fcLook: 0,
  fcBrow: 0.07,
  fcBrowY: 0.1,
  fcBrowArc: 0.6,
  fcBrowTilt: 7,
  fcMouth: 0.065,
  fcMouthH: 0.1,
  fcMouthX: 0,
  fcMouthY: -0.37,
  /* ทั้งแผ่นหน้า: เลื่อน (×W, ×H, หน่วยหัว) หมุน (องศา) สเกล */
  fcX: 0.06,
  fcY: 0.07,
  fcZ: 0,
  fcRotX: 0,
  fcRotY: 0,
  fcRotZ: 0,
  fcScale: 1.24,
  fcLookEvery: 3,
  fcBlinkEvery: 4,
  /**
   * หัวหันตามเมาส์ (ค่าตั้งต้น = ค่าจาก leva ของ Mascot) — yaw/pitch/roll = ระยะหันสูงสุด (เรเดียน)
   * ease = หน่วง (สูง = ตามไว) base* = ท่าตั้งต้นของหัวที่เมาส์ขยับต่อจากนั้น
   */
  hf: 1,
  hfYaw: 0.55,
  hfPitch: 0.28,
  hfRoll: 0.09,
  hfEase: 0.08,
  hfBaseYaw: -0.22,
  hfBaseRoll: -0.14,
  hfBasePitch: 0,
  /** พฤติกรรม: ตามมาก/น้อย, โค้งตอบสนอง, จุดบอดกลางจอ, สปริงเด้ง, วินาทีนิ่งแล้วกลับท่าเดิม */
  hfFollow: 0.64,
  hfCurve: 3,
  hfDead: 0,
  hfBounce: 0,
  hfIdleBack: 0,
  /* ขนาด mascot เทียบกับบอร์ด และระยะยกพ้นแผ่น */
  mascotScale: 1.01,
  mascotLift: 1.84,
  boardScale: 1.47,
  /* รูปทรงสเก็ตบอร์ด — ทุกค่าอยู่ในสเกลของกล่องหน่วย (ยาวรวมราว 1) */
  bdLen: 1.015,
  bdWide: 0.28,
  bdThick: 0.05,
  /* ปลายเชิด: เริ่มยกที่กี่ส่วนของครึ่งความยาว / สูงเท่าไรเทียบความยาว / ท้องแอ่น */
  bdKickAt: 0.52,
  bdKick: 0.035,
  bdConcave: 0.03,
  bdTruckX: 0.235,
  bdWheelR: 0.038,
  bdWheelW: 0.058,
  bdRideY: 0.13,
  /* ขยับบอร์ดจากตำแหน่งที่จัดให้อัตโนมัติ (y = ระยะจากฝ่าเท้า) */
  boardX: -1.37,
  boardY: 0.14,
  boardZ: -0.555,
  boardRotX: 19,
  boardRotY: -22,
  boardRotZ: -13.5,
  /* ลำตัว (องศา) — lean = เอียงทั้งตัวรวมขา / fold = พับเฉพาะช่วงบน เท้าอยู่กับที่ */
  leanX: 14.9,
  leanZ: -9.2,
  foldX: 0,
  foldY: 0,
  foldZ: 0,
  headX: -11.5,
  /* ระยะห่างขาสองข้าง — เลื่อนจุดสะโพก ไม่ใช่หมุนให้กางออก ระดับเท้าจึงไม่เปลี่ยน */
  legSpread: 0.02,
  legStagger: 0,
  /* ขา (องศา) — ผลรวม hipX + knee + ankle ต้องเท่ากันสองข้างและใกล้ 0 ฝ่าเท้าจึงแนบแผ่น */
  hipLX: -117.5,
  hipLY: 17.2,
  hipLZ: 9.2,
  kneeL: 98,
  ankleL: 22,
  hipRX: -114,
  hipRY: -12.6,
  hipRZ: -6.9,
  kneeR: 98,
  ankleR: 16,
  /* สัดส่วนแขน: ทั้งแขน / เฉพาะท่อนล่าง+มือ */
  armScale: 1,
  foreScale: 1.22,
  /* ข้อต่อแขน — แขน A เล็งด้วยทิศทาง (เวกเตอร์) / แขน B คิดจากท่าพัก (องศา) */
  /* เลื่อนโคนแขนออกจากลำตัว (หน่วยของ mascot) — out = ออกนอกตัว / up = ขึ้น / fwd = ไปหน้า */
  aimOut: 0.365,
  aimUp: -0.19,
  aimFwd: -0.005,
  mugOut: 0.52,
  mugUp: -0.285,
  mugFwd: 0,
  /* หมุนทั้งแขนรอบข้อไหล่ (องศา) — ทั้งเส้นไปด้วยกัน คนละเรื่องกับมุมศอก/ข้อมือ */
  aimRotX: 0,
  aimRotY: 0,
  aimRotZ: 0,
  mugRotX: 0,
  mugRotY: 0,
  mugRotZ: 0,
  aimX: 1,
  aimY: 0.16,
  aimZ: -0.08,
  elbowX: -20,
  elbowY: 20,
  elbowZ: 14.5,
  /* ขนาดมือ (เฉพาะกำปั้น+นิ้ว) — ริกปั้นมือใหญ่กว่าปลายแขนมาก ย่อลงแล้วข้อมืออ่านเป็นข้อมือ */
  handScale: 1,
  /* เลื่อนมือจากปลายแขน — x = ออกนอกตัว / y = ขึ้น / z = ไปหน้า */
  handX: 0.05,
  handY: 0.03,
  handZ: 0.005,
  wristX: 4,
  wristY: 0,
  wristZ: 2.5,
  mugShX: -5,
  mugShY: 26,
  mugShZ: -39,
  /* มือฝั่งแขน B — ริกไม่เคยมีปุ่มให้ข้างนี้มาก่อน */
  mugWristX: 1.5,
  mugWristY: 7.5,
  mugWristZ: -10,
  mugHandScale: 1,
  mugHandX: 0.08,
  mugHandY: 0.075,
  mugHandZ: 0.01,
  mugElX: -31.5,
  mugElY: 84.5,
  mugElZ: -29.5,
}

// ขึ้นเวอร์ชันเมื่อชุดคีย์/ค่าเริ่มต้นเปลี่ยนแนว — ค่าที่ค้างในเบราว์เซอร์จะได้ไม่ทับของใหม่
const KEY = 'newhero.tuner.v166'

function load() {
  /**
   * นอกโหมด dev อ่านจาก DEFAULTS อย่างเดียว
   *
   * หน้า /2026-final ใช้ฉากเดียวกันนี้ ถ้าปล่อยให้อ่าน localStorage ค่าที่ใครสักคน
   * เผลอลากทิ้งไว้ตอนจูนจะติดไปกับหน้าจริงของเขาเอง โดยที่ไม่มีแผงให้แก้กลับ
   */
  if (!import.meta.env.DEV) return { ...DEFAULTS }
  if (typeof localStorage === 'undefined') return { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    // เก็บเฉพาะคีย์ที่รู้จัก — ค่าเก่าจากเวอร์ชันก่อนจะได้ไม่ค้างมาเป็นคีย์ผี
    const saved = JSON.parse(raw)
    const out = { ...DEFAULTS }
    for (const k of Object.keys(DEFAULTS)) if (typeof saved[k] === 'number') out[k] = saved[k]
    return out
  } catch {
    return { ...DEFAULTS }
  }
}

let state = load()
const subs = new Set()

export function getTuner() {
  return state
}

export function setTuner(patch) {
  state = { ...state, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* โหมดส่วนตัว/บล็อกสตอเรจ — ปรับได้อยู่ แค่ไม่จำข้ามรีเฟรช */
  }
  subs.forEach((f) => f())
}

/**
 * ประตูให้สคริปต์นอกหน้าอ่าน/ตั้งค่าได้ — dev เท่านั้น
 *
 * ใช้ตอนตรวจงานด้วยภาพ: เปิดหน้าใน headless แล้วสั่ง scrub ทางเข้าทีละจังหวะเพื่อถ่ายภาพ
 * เทียบ (ในเครื่อง headless ตัวละครโหลดช้าจนอินโทรไม่ออกตัวเอง จูนด้วยตาเปล่าไม่ได้)
 */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__tuner = { get: getTuner, set: setTuner }
}

export function resetTuner() {
  setTuner({ ...DEFAULTS })
}

function subscribe(f) {
  subs.add(f)
  return () => subs.delete(f)
}

export function useTuner() {
  return useSyncExternalStore(subscribe, getTuner, getTuner)
}

/**
 * ตำแหน่งจริงในโลกของ mascot — ฉากเขียนทุกเฟรม แผงอ่านไปแสดง
 *
 * เป็นออบเจกต์นิ่งที่ mutate ทับ ไม่ใช่ state: ค่าเปลี่ยนทุกเฟรม ถ้าเป็น state
 * จะ re-render 60 ครั้งต่อวินาที แผงอ่านด้วยการ tick เองทุก 200ms ก็พอ
 */
export const READOUT = { x: 0, y: 0, z: 0, sole: 0, deck: 0, gap: 0, low: '' }

const RAD = Math.PI / 180

/**
 * ค่าที่ ref บอกไว้ — ใช้เทียบว่ามุมที่ปรับอยู่ตรงกับชีทหรือยัง
 * (วัดจากชีท 1199x735: horizon แถว 185, VP ที่ x=25 กับ x=1165)
 */
export const REF = { w: 1440, h: 1024, horizonY: 478.2, bandVP: 3253.2 }

/**
 * ฉายค่ากล้องปัจจุบันกลับเป็นตัวเลขที่วัดได้บนเฟรม — horizon กับ VP สองข้าง
 * คิดที่สัดส่วนเฟรมของ ref เสมอ จะได้เทียบกับเลขที่วัดจากชีทได้ตรง ๆ
 */
export function projectGuides(t, w = REF.w, h = REF.h) {
  const f = h / 2 / Math.tan((t.fov * RAD) / 2)
  const th = t.pitch * RAD
  const horizonY = h / 2 - f * Math.tan(th)
  const k = f / Math.cos(th)
  // จุดลู่ของแกนแถบหน้าต่าง — เส้นบน/ล่างที่ผู้ใช้วาดไว้ตัดกันตรงนี้
  const bandVP = w / 2 + k / Math.tan(t.bandYaw * RAD)
  return { f, horizonY, bandVP, w, h }
}
