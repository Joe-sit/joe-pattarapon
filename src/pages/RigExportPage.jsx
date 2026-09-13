import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Leva } from 'leva'
import { Bounds, Grid, OrbitControls } from '@react-three/drei'
import { HeroRider } from '@/newhero/HeroRider'
import { exportRigOBJ } from '@/newhero/rigExport'

/**
 * /rig-export — โต๊ะส่งตัวละครไปให้ Mixamo (dev เท่านั้น)
 *
 * ### ทำไมต้องมีหน้าแยก ไม่ใช่ปุ่มในฉาก hero
 *
 * `mascot.glb` ไม่มีกระดูกและไม่มีท่าอยู่ในตัวเลย (39 เมช 91 โนด skin 0) ท่าทุกท่าเกิดจาก
 * โค้ดหมุนกลุ่มชิ้นส่วน สิ่งที่ส่งออกได้จึงมีแค่ "ท่าที่อยู่บนจอ" — และท่าบนจอของฉาก hero คือ
 * ท่าสเก็ตย่อเข่าลึกที่ `LegDrive` เขียนทับทุกเฟรมตามแรงในฉาก จูนค้างไว้ไม่ได้
 * ตัวจัดริกอัตโนมัติของ Mixamo ต้องการท่า T หรือ A แขนกางพ้นลำตัว ขาแยกจากกัน
 *
 * หน้านี้จึงเรียกริกตัวเดียวกันแต่ป้อนท่าตรง ๆ ไม่มีตัวขับอื่นมาแตะ และปิดทุกอย่างที่ขยับเอง
 * (`poseIdle`/`noIdle` = ลมหายใจ เหลียวมอง กระพริบ) เพราะรูปทรงที่อบลงไฟล์คือรูปทรงของ
 * เฟรมที่กดปุ่ม — ถ้าตัวยังไหวอยู่ ไฟล์ที่ได้ก็เป็นท่าที่เพี้ยนไปจากที่เห็นเล็กน้อยทุกครั้ง
 */

/**
 * ท่า T (เรเดียน) — ข้อต่อทุกข้อเหยียดตรง เหลือแค่สองค่าที่ไม่ใช่ศูนย์
 *
 * `spread` ถ่างสะโพกออกให้ขาสองข้างมีช่องว่างระหว่างกัน ตัวจัดริกใช้ช่องนี้แยกขาซ้าย-ขวา
 * ถ้าขาชิดติดกันมันจะอ่านเป็นท่อนเดียวแล้วใส่กระดูกขาผิด
 */
/**
 * หัวตรง — ค่าตั้งต้นของริกเอียงและหันหัวไว้เล็กน้อย (ท่าของฉาก hero) ซึ่งทำให้จุดคาง
 * ที่ต้องปักหมุดตอนจัดริกเยื้องไปข้าง
 */
const HEAD_STRAIGHT = {
  headYaw: 0,
  headPitch: 0,
  headRoll: 0,
  headBaseYaw: 0,
  headBaseRoll: 0,
  headBasePitch: 0,
  headFollow: 0,
}

const T_TORSO = { leanX: 0, leanZ: 0, foldX: 0, foldY: 0, foldZ: 0, headX: 0 }
const T_LEG = {
  L: { hipX: 0, hipY: 0, hipZ: 0, knee: 0, ankle: 0 },
  R: { hipX: 0, hipY: 0, hipZ: 0, knee: 0, ankle: 0 },
  spread: 0.2,
  stagger: 0,
}
const T_ARM = {
  aimOut: 0,
  aimUp: 0,
  aimFwd: 0,
  mugOut: 0,
  mugUp: 0,
  mugFwd: 0,
  aimRotX: 0,
  aimRotY: 0,
  aimRotZ: 0,
  mugRotX: 0,
  mugRotY: 0,
  mugRotZ: 0,
  /* แขน A เล็งด้วยทิศทาง ไม่ใช่องศา — (1, 0, 0) = กางตรงออกข้าง ขนานพื้น */
  aimX: 1,
  aimY: 0,
  aimZ: 0,
  elbowX: 0,
  elbowY: 0,
  elbowZ: 0,
  wristX: 0,
  wristY: 0,
  wristZ: 0,
  handScale: 1,
  handX: 0,
  handY: 0,
  handZ: 0,
  /* แขน B ไม่มีแกนแขนให้เล็ง คิดต่อจาก quaternion ท่าพักที่กดแขนห้อยแนบตัวไว้ —
     ต้องหมุนเอง 90° และเครื่องหมาย z ต้องเป็นลบถึงจะกางออก (ใส่บวกแล้วแขนพับเข้าหลังลำตัว) */
  mugShX: 0,
  mugShY: 0,
  /* -1.13 ไม่ใช่ -90° พอดี: ค่าศูนย์ของข้อนี้คือแขนห้อยแนบตัวในท่าพักของริก หมุน 90°
     เต็มแล้วแขนข้างนี้เลยระดับไหล่ไปอยู่สูงกว่าแขน A ถึง 0.78 หน่วย (วัดจากไฟล์ที่ส่งออก)
     ค่านี้คือค่าที่วัดแล้วปลายแขนสองข้างอยู่ระดับเดียวกัน */
  mugShZ: -1.13,
  mugElX: 0,
  mugElY: 0,
  mugElZ: 0,
  mugWristX: 0,
  mugWristY: 0,
  mugWristZ: 0,
  mugHandScale: 1,
  mugHandX: 0,
  mugHandY: 0,
  mugHandZ: 0,
}

export default function RigExportPage() {
  const [msg, setMsg] = useState('')
  /**
   * แขน lumberjack (แบบที่ /2026-final ใช้) หรือแขนของริกเอง
   *
   * แขนชุดนั้นถูกแขวนบนข้อต่อด้วยระยะที่วัดจากท่าสเก็ต กางเป็น T แล้วอาจเห็นรอยต่อที่ศอก
   * — เปิดไว้เป็นค่าเริ่มต้นเพราะเป็นแขนของตัวละครจริง แต่ต้องปิดได้เมื่อเห็นว่าเหลื่อม
   */
  const [lumber, setLumber] = useState(true)

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#20242c' }}>
      <Canvas camera={{ position: [0, 1.4, 6.2], fov: 32 }} dpr={[1, 2]}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 6, 5]} intensity={1.5} />
        <directionalLight position={[-4, 2, -3]} intensity={0.5} />
        {/* จัดกล้องให้พอดีตัวเอง — ริกมีหน่วยของตัวเองและสูงหลายหน่วย ตั้งระยะกล้องด้วยมือแล้ว
            เปลี่ยนท่าทีเดียวก็หลุดเฟรม */}
        <Bounds fit clip observe margin={1.35}>
        <Suspense fallback={null}>
          {/* ตัวละครชุดเดียวกับ /2026-final ทุกชิ้น — เรียก HeroRider ไม่ใช่ Mascot เปล่า ๆ
              แขน lumberjack, รองเท้า, ลายเสื้อ, สัดส่วนแขน ทั้งหมดมาจากแผงจูนที่นั่น
              ทับแค่ท่า (T) กับสิ่งที่ขยับเอง ไม่งั้นไฟล์ที่ส่งออกจะเป็นตัวละครคนละชุด */}
          <HeroRider
            noBoard
            noLean
            noWind
            noIdle
            noLumber={lumber === false}
            followOverride={HEAD_STRAIGHT}
            torsoPose={T_TORSO}
            legPose={T_LEG}
            armPose={T_ARM}
          />
        </Suspense>
        </Bounds>
        <Grid args={[14, 14]} cellColor="#39404d" sectionColor="#4a5060" fadeDistance={22} infiniteGrid />
        <OrbitControls makeDefault />
      </Canvas>
      {/* สไลเดอร์ของริกมีไว้ให้ขยับท่าก่อนส่งออก แต่เริ่มแบบพับไว้ ไม่งั้นบังตัวละครครึ่งจอ */}
      <Leva collapsed />

      <div
        style={{
          position: 'absolute',
          left: 16,
          top: 16,
          display: 'grid',
          gap: 8,
          maxWidth: 420,
          padding: 12,
          borderRadius: 10,
          background: 'rgba(18,20,26,0.86)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: '#e8ecf3',
          font: '12px/1.5 ui-sans-serif, system-ui',
        }}
      >
        <b>ส่งตัวละครไป Mixamo</b>
        <button
          type="button"
          onClick={() => setMsg(exportRigOBJ().msg)}
          style={{
            cursor: 'pointer',
            padding: '7px 10px',
            borderRadius: 7,
            border: '1px solid rgba(255,255,255,0.18)',
            background: '#2f6df0',
            color: '#fff',
            font: '600 12px ui-sans-serif, system-ui',
          }}
        >
          ดาวน์โหลด .obj (ท่าที่เห็นบนจอ)
        </button>
        <label style={{ display: 'flex', gap: 7, alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={lumber}
            onChange={(e) => setLumber(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          แขน lumberjack (แบบที่ /2026-final ใช้) — ปิดแล้วได้แขนของริกเอง
        </label>
        {msg && <div style={{ opacity: 0.85 }}>{msg}</div>}
        <div style={{ opacity: 0.6 }}>
          Mixamo รับ FBX / OBJ / ZIP ไม่รับ glTF · ไฟล์นี้เป็นเมชเดียวตามที่ตัวจัดริกอัตโนมัติ
          ต้องการ · ไม่มีสีมาด้วย (ตัวจัดริกไม่ใช้สี ตัวจริงยังลงสีจากโค้ดเหมือนเดิม)
        </div>
      </div>
    </div>
  )
}
