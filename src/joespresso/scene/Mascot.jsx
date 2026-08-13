import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useControls } from 'leva'
import * as THREE from 'three'
import { addRim, clamp, damp } from './utils'

const MODEL = '/mascot.glb'


// GLB ที่ได้มาไม่มีชื่อ node เลย — จำแนกชิ้นส่วนจาก "สี material" แทน
// (ตรวจแล้วว่าแต่ละบทบาทใช้สีไม่ซ้ำกัน)
const HEX = {
  hair: '232224',
  eye: '262424',
  skin: 'efb49b',
  neck: 'd2947a',
}


function hexOf(mat) {
  return mat?.color ? mat.color.getHexString() : ''
}

/**
 * แก้วกาแฟ to-go ทรงร้านกาแฟ — แก้วกระดาษเรียว ปลอกกันร้อน ฝาดำ โลโก้วงกลมเขียว
 *
 * ตั้งใจทำเป็นแก้วทั่วไป ไม่ใช่ของแบรนด์ใดแบรนด์หนึ่ง — โลโก้จริงเป็นเครื่องหมายการค้า
 * เอามาแปะไม่ได้ วงกลมเขียวเปล่า ๆ ก็อ่านออกว่าแก้วกาแฟแล้วที่ขนาดเท่านี้บนจอ
 */
const CUP = {
  paper: '#F7F4EF',
  sleeve: '#3F7C63',
  lid: '#2A2A2C',
  logo: '#0B6E4F',
}

function makeCoffeeCup() {
  const mat = (color, roughness = 0.75) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 })
  const cup = new THREE.Group()

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.108, 0.36, 20, 1, true), mat(CUP.paper))
  body.material.side = THREE.DoubleSide
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.108, 20), mat(CUP.paper))
  bottom.rotation.x = Math.PI / 2
  bottom.position.y = -0.18

  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.147, 0.126, 0.15, 20), mat(CUP.sleeve, 0.9))
  sleeve.position.y = -0.02

  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.158, 0.152, 0.045, 20), mat(CUP.lid, 0.55))
  lid.position.y = 0.2
  const sip = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.145, 0.03, 20), mat(CUP.lid, 0.55))
  sip.position.y = 0.235

  // โลโก้: จานกลมแบนแปะหน้าปลอก เผื่อพ้นผิวนิดหนึ่งกัน z-fight
  const logo = new THREE.Mesh(new THREE.CircleGeometry(0.052, 20), mat(CUP.logo, 0.85))
  logo.position.set(0, -0.02, 0.138)
  logo.rotation.y = 0

  for (const m of [body, bottom, sleeve, lid, sip, logo]) {
    m.castShadow = true
    m.receiveShadow = true
    cup.add(m)
  }
  return cup
}

/**
 * ขา — GLB มีแค่ครึ่งบน สร้างต่อเองเป็นกล่องสไตล์เดียวกัน
 * พิกัด local ของโมเดล: เอวอยู่ y ≈ -2.24
 */
const JEANS = '#3E5C8F'
const CUFF = '#5A7BAD'
const BOOT = '#7A4E2E'
const SOLE = '#5E3B22'

/**
 * ความยาวขา วัดจาก comp: ขา = 46% ของความสูงทั้งตัว (หัว 23% ลำตัว 31%)
 * ของเดิมได้ 38% — ตัวเลยดูเตี้ยล่ำกว่าแบบ
 */
const LEG_LEN = 1.92

/**
 * มุมกางขาจากแนวดิ่ง — วัดจาก comp: ขาซ้าย 10.9° ขาขวา 8.7° (เฉลี่ย ~9.8°)
 * ของเดิม 0.09 rad = 5.2° แคบไปครึ่งหนึ่ง
 */
const LEG_SPLAY = 0.17

/** ย่อหัวให้สัดส่วนตรง comp — 1 = ขนาดที่มากับ GLB */
const HEAD_SCALE = 0.92

// ตัวช่วยชั่วคราวใน useFrame — ปั้นใหม่ทุกเฟรมคือขยะให้ GC เก็บ 60 ครั้ง/วินาที
const TMP_Q = new THREE.Quaternion()
const TMP_E = new THREE.Euler()
const TMP_V = new THREE.Vector3()
const TMP_V2 = new THREE.Vector3()

function Legs({ rig }) {
  // ขาแต่ละข้างห้อยจากจุดหมุนสะโพก (rig.hipL / rig.hipR) — หมุนได้ทั้งท่อน
  const leg = (side, name) => (
    <group
      key={side}
      position={[0.29 * side, -2.36, 0]}
      rotation={[0, 0.3 * side, LEG_SPLAY * side]}
      ref={(g) => {
        if (rig) rig.current[name] = g
      }}
    >
      {/* ท่อนขายีนส์ — ขอบบนคาไว้ที่ +0.07 ใต้ชายเสื้อ ยืดลงล่างอย่างเดียว */}
      <mesh position={[0, 0.07 - LEG_LEN / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, LEG_LEN, 0.56]} />
        <meshStandardMaterial color={JEANS} roughness={1} metalness={0} />
      </mesh>
      {/* ขอบพับ — แถบฟ้าคาดปลายขา กว้างกว่าขาเล็กน้อย */}
      <mesh position={[0, 0.07 - LEG_LEN - 0.07, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.28, 0.66]} />
        <meshStandardMaterial color={CUFF} roughness={1} metalness={0} />
      </mesh>
      {/* บูท — หัวยื่นหน้า ส้นใต้ขอบพับ
          ไม่หมุนสวนขาแล้ว: เท้าเอียงไปตามท่อนขาจริง ๆ ขอบนอกจะจมพื้นบ้างก็ปล่อย
          (พื้นทรายมีรอยยุบรับอยู่ ดูเป็นน้ำหนักกดลงไปมากกว่าเท้าลอยราบ) */}
      <group position={[0, 0.07 - LEG_LEN - 0.4, 0]}>
        <mesh position={[0, 0, 0.14]} castShadow receiveShadow>
          <boxGeometry args={[0.6, 0.34, 0.9]} />
          <meshStandardMaterial color={BOOT} roughness={1} metalness={0} />
        </mesh>
        <mesh position={[0, -0.21, 0.14]} castShadow receiveShadow>
          <boxGeometry args={[0.64, 0.09, 0.94]} />
          <meshStandardMaterial color={SOLE} roughness={1} metalness={0} />
        </mesh>
      </group>
    </group>
  )
  return (
    <group>
      {/* สะโพก — เชื่อมรอยต่อเอวกับขา */}
      <mesh position={[0, -2.36, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.24, 0.34, 0.6]} />
        <meshStandardMaterial color={JEANS} roughness={1} metalness={0} />
      </mesh>
      {leg(-1, 'hipL')}
      {leg(1, 'hipR')}
    </group>
  )
}

export function Mascot({
  position = [0, 0, 0],
  scale = 1,
  rotation = [0, 0, 0],
  /** true = หันหลังให้กล้อง (หัวยังหันตามเมาส์) */
  facingAway = false,
}) {
  const { scene } = useGLTF(MODEL)
  const root = useRef()
  const headGroup = useRef()
  const eyes = useRef([])
  const rig = useRef({})
  const { size } = useThree()

  // debugger: จูนท่าทางทุกข้อต่อสด ๆ
  // debugger: หัวหันตามเมาส์ — อยู่กลุ่มเดียวกับของกล้องใน App.jsx (leva รวม folder ชื่อเดียวกันให้)
  const fol = useControls('Follow Cursor', {
    headYaw: { value: 0.55, min: 0, max: 1.5, step: 0.01, label: 'หัว ซ้ายขวา' },
    headPitch: { value: 0.28, min: 0, max: 1.2, step: 0.01, label: 'หัว ก้มเงย' },
    headRoll: { value: 0.09, min: 0, max: 0.6, step: 0.01, label: 'หัว เอียง' },
    headEase: { value: 0.08, min: 0.005, max: 0.4, step: 0.005, label: 'หัว หน่วง' },
  })

  const pose = useControls('Rig', {
    // 1.55 rad = แขนทำมุม ~38° กับแนวนอน ตรงตาม comp (ของเดิม 2.35 = 81° เกือบตั้งฉาก)
    pointShoulderZ: { value: 1.55, min: 0, max: 3.1, step: 0.05 },
    pointShoulderX: { value: -0.35, min: -2.5, max: 1.5, step: 0.05 },
    // ลดหัวไหล่ข้างที่ชี้ลงมา — ยกแขนแล้วไหล่มันดันขึ้นไปชิดคอ
    pointShoulderDrop: { value: 0.16, min: -0.3, max: 0.6, step: 0.01 },
    pointElbowX: { value: 0, min: -2.2, max: 2.2, step: 0.05 },
    // คลายมุมพับที่ bake มาใน GLB ให้ท่อนล่างต่อตรงกับท่อนบน แขนเลยเหยียดชี้ฟ้าเป็นเส้นเดียว
    pointElbowZ: { value: 0.35, min: -2.2, max: 2.2, step: 0.05 },
    pointWristX: { value: 0.7, min: -2.2, max: 2.2, step: 0.05 },
    // 0 = ใช้ท่าตั้งต้นที่ alignArmAxis จัดให้ (แขนดิ่งแนบตัว) — ค่าเก่า -0.5 เอียงไปหน้า 28.6°
    mugShoulderX: { value: 0, min: -2, max: 1, step: 0.05 },
    // ท่าพักใน GLB แขนกางออกข้าง — comp ปล่อยแขนแนบตัว ต้องกดลงด้วยแกน Z เหมือนแขนชี้
    mugShoulderZ: { value: 0, min: -3.1, max: 3.1, step: 0.05 },
    mugElbowX: { value: 0, min: -2.2, max: 0.6, step: 0.05 },
    hipLX: { value: 0, min: -1.2, max: 1.2, step: 0.05 },
    hipRX: { value: 0, min: -1.2, max: 1.2, step: 0.05 },
  })

  // clone เพื่อไม่ไปแก้ cache ของ useGLTF
  const model = useMemo(() => scene.clone(true), [scene])

  useEffect(() => {
    const parts = { hair: [], eye: [], head: null, sideburn: [] }
    // GLB export แยก material ให้ทุก mesh ถึงจะสีเดียวกัน (ผมดำ 6 ชิ้น = 6 material)
    // ยุบตามหน้าตาจริง — ลด state change ต่อเฟรม และ addRim ก็คอมไพล์ shader ครั้งเดียวต่อสี
    const matCache = new Map()
    const shared = (src) => {
      const key = `${src.type}|${src.color?.getHexString()}|${src.opacity}|${src.transparent}|${src.map?.uuid ?? ''}`
      let m = matCache.get(key)
      if (!m) {
        m = src.clone()
        m.roughness = 1
        m.metalness = 0
        // rim เฉพาะ standard material: shader ใช้ normal/vViewPosition ซึ่ง MeshBasicMaterial ไม่มี
        // ถ้าฉีดใส่ shader จะ compile ไม่ผ่าน แล้ว mesh นั้นจะไม่ถูกวาดเลย (แต่ยังทอดเงาได้)
        // — ลูกตาเป็น MeshBasicMaterial ชิ้นเดียวในโมเดล จึงหายไปทั้งคู่
        if (m.isMeshStandardMaterial) {
          addRim(m, { color: '#FFF3DC', intensity: 0.5, power: 4.2 })
        }
        matCache.set(key, m)
      }
      return m
    }

    model.traverse((o) => {
      if (!o.isMesh) return
      o.castShadow = true
      o.receiveShadow = true
      // GLB โหลด async หลัง RimLight traverse ฉากไปแล้ว — rim ถูกฉีดใน shared() ตอนปั้น material
      o.material = shared(o.material)

      // วัดใน local space ของโมเดล — world bbox โดน scale/position ของ root ปน ทำให้เกณฑ์ขนาดเพี้ยน
      o.geometry.computeBoundingBox()
      const s = o.geometry.boundingBox.getSize(new THREE.Vector3())

      const hex = hexOf(o.material)
      if (hex === HEX.eye) parts.eye.push(o)
      else if (hex === HEX.hair) {
        // ชิ้นเล็กที่อยู่ข้างหัว = จอน, ก้อนใหญ่ด้านบน = ผม
        if (s.x < 0.4) parts.sideburn.push(o)
        else parts.hair.push(o)
      } else if (hex === HEX.skin) {
        // หัว = ชิ้นผิวที่ปริมาตรใหญ่สุด (ชิ้นอื่นคือแขน/มือ เล็กกว่ามาก)
        const vol = s.x * s.y * s.z
        if (!parts.head || vol > parts.head.userData.vol) {
          o.userData.vol = vol
          parts.head = o
        }
      }
    })

    // ย้ายชิ้นส่วนหัวทั้งหมดเข้ากลุ่มเดียว โดยคงตำแหน่งโลกไว้ (attach ไม่ใช่ add)
    const g = new THREE.Group()
    g.name = 'HeadGroup'
    model.add(g)
    const headParts = [parts.head, ...parts.hair, ...parts.sideburn, ...parts.eye].filter(Boolean)
    for (const p of headParts) g.attach(p)

    // หัวใน GLB ใหญ่กว่า comp อยู่ ~9% (วัดจากยอดผมถึงคอ เทียบความสูงทั้งตัว: 25.6% vs 23.4%)
    // ย่อทั้งกลุ่มโดยตรึงจุดต่อคอไว้ที่เดิม ไม่งั้นหัวจะลอยหลุดจากบ่า
    const NECK_Y = -0.63
    g.scale.setScalar(HEAD_SCALE)
    g.position.y = NECK_Y * (1 - HEAD_SCALE)

    // GLB ฝังลูกตาไว้ "ใน" กล่องหัว (ลึกกว่าผิวหน้า ~0.03) เลยไม่โผล่จากมุมไหนเลย —
    // เดิมไม่เคยเห็นเพราะ mascot หันหลังให้ตลอด ดันออกมาตามแนวตั้งฉากของหน้า
    if (parts.head && parts.eye.length) {
      model.updateMatrixWorld(true) // attach ด้านบนเพิ่งย้าย parent — matrixWorld ยังเป็นค่าเก่า
      parts.head.geometry.computeBoundingBox()
      const headC = parts.head.localToWorld(
        parts.head.geometry.boundingBox.getCenter(new THREE.Vector3()),
      )
      for (const e of parts.eye) {
        const w = e.getWorldPosition(new THREE.Vector3())
        const n = w.clone().sub(headC).setY(0).normalize()
        e.position.copy(e.parent.worldToLocal(w.addScaledVector(n, 0.05)))
        e.castShadow = false // ตายื่นพ้นผิวหน้านิดเดียว ถ้าทอดเงาจะกลายเป็นรอยด่างข้างตา
      }
    }

    // GLB มีผมแค่บล็อกบน — เติมแผ่นผมคลุมท้ายทอยลงถึงต้นคอ
    // คำนวณใน local space ของหัว แล้วใส่เป็นลูกของหัวเอง จะได้ติดตำแหน่ง/หมุนตามหัวเสมอ
    if (parts.head) {
      const bb = parts.head.geometry.boundingBox
      const hs = bb.getSize(new THREE.Vector3())
      const hc = bb.getCenter(new THREE.Vector3())
      const hairMat = parts.hair[0]
        ? parts.hair[0].material
        : new THREE.MeshStandardMaterial({ color: '#282729', roughness: 1, metalness: 0 })
      const back = new THREE.Mesh(
        new THREE.BoxGeometry(hs.x * 1.04, hs.y * 1.02, hs.z * 0.3),
        hairMat,
      )
      back.position.set(hc.x, hc.y + hs.y * 0.02, hc.z - hs.z * 0.42)
      back.castShadow = back.receiveShadow = true
      parts.head.add(back)
    }

    // ---- จัดท่าตาม ref: แขนขวาชี้ขึ้น แขนซ้ายงอถือแก้ว ----
    model.updateMatrixWorld(true)
    const arms = { L: [], R: [] }
    const wv = new THREE.Vector3()
    model.traverse((o) => {
      if (!o.isMesh) return
      // ข้ามชิ้นที่อยู่ในหัว (ถูกย้ายเข้า HeadGroup แล้ว)
      let p = o.parent
      let inHead = false
      while (p) {
        if (p === g) inHead = true
        p = p.parent
      }
      if (inHead) return
      o.getWorldPosition(wv)
      const lp = model.worldToLocal(wv.clone())
      // แขน = ชิ้นที่อยู่พ้นข้างลำตัว (ลำตัวกว้าง ~1.42 ครึ่ง 0.71)
      if (Math.abs(lp.x) > 0.55) (lp.x > 0 ? arms.R : arms.L).push({ o, lp })
    })

    // rig แขน: ไหล่ (ทั้งแขน) -> ศอก (ท่อนล่าง: ปลายแขน+มือ) แบ่งที่ก้นแขนเสื้อ
    const toLocal = model.matrixWorld.clone().invert()
    const localBox = (meshes) => {
      const bb = new THREE.Box3()
      for (const o of meshes) {
        o.geometry.computeBoundingBox()
        bb.union(o.geometry.boundingBox.clone().applyMatrix4(toLocal.clone().multiply(o.matrixWorld)))
      }
      return bb
    }

    /**
     * สลับซ้าย-ขวาของ "มือ" อย่างเดียว
     *
     * ท่าพักของ GLB นิ้วโป้งอยู่ด้านในถูกแล้ว แต่ท่ายกแขนหมุนไหล่ 135° ในระนาบ XY
     * ซึ่งพาฝั่งในไปอยู่ฝั่งนอก นิ้วโป้งเลยหันออกนอกตัว สะท้อนมือกลับตั้งแต่ท่าพัก
     * พอยกแขนแล้วนิ้วโป้งจึงมาอยู่ด้านใน
     *
     * ใช้สะท้อน (mirror) ไม่ใช่หมุนรอบแกนแขน เพราะการหมุนจะพลิกฝ่ามือไปด้วย
     * ทำที่ geometry ตั้งแต่ตอนสร้าง rig จึงไม่กวนค่ามุมท่าทางใด ๆ ทีหลัง
     */
    const mirrorHandGeometry = (list) => {
      // มือเป็นก้อน mesh ที่อยู่ต่ำสุดและเกาะกลุ่มกัน — ตัดที่ "ช่องว่าง" แรกของความสูง
      // (แบ่งด้วยเกณฑ์ความสูงคงที่ไม่ได้ เดี๋ยวจะกินท่อนแขนช่วงข้อมือติดมาด้วย)
      const ys = list.map(({ lp }) => lp.y).sort((a, b) => a - b)
      let split = ys[0] + 0.06
      for (let i = 1; i < ys.length; i++) {
        if (ys[i] - ys[i - 1] > 0.05) {
          split = (ys[i] + ys[i - 1]) / 2
          break
        }
      }
      const hands = list.filter(({ lp }) => lp.y <= split).map(({ o }) => o)
      if (!hands.length) return

      const bb = localBox(hands)
      const cx = (bb.min.x + bb.max.x) / 2
      const mirror = new THREE.Matrix4()
        .makeTranslation(cx, 0, 0)
        .multiply(new THREE.Matrix4().makeScale(-1, 1, 1))
        .multiply(new THREE.Matrix4().makeTranslation(-cx, 0, 0))

      for (const o of hands) {
        model.attach(o) // ให้ local space ตรงกับ model ก่อน แล้ว bake ลง geometry
        o.updateMatrix()
        const geo = o.geometry.clone() // clone: scene.clone() แชร์ geometry กับ cache ของ useGLTF
        geo.applyMatrix4(o.matrix)
        geo.applyMatrix4(mirror)
        // สะท้อนแล้วหน้าสามเหลี่ยมกลับด้าน ต้องกลับลำดับ index ไม่งั้นโดน backface culling หายทั้งชิ้น
        const ix = geo.index
        if (ix) {
          const a = ix.array
          for (let i = 0; i < a.length; i += 3) {
            const t = a[i]
            a[i] = a[i + 2]
            a[i + 2] = t
          }
          ix.needsUpdate = true
        }
        geo.computeVertexNormals()
        o.geometry = geo
        o.position.set(0, 0, 0)
        o.quaternion.identity()
        o.scale.set(1, 1, 1)
        o.updateMatrix()
      }
      model.updateMatrixWorld(true)
    }

    const mkArm = (list) => {
      if (!list.length) return null
      const top = Math.max(...list.map(({ lp }) => lp.y))
      const bottom = Math.min(...list.map(({ lp }) => lp.y))
      const sleeve = list.find(({ o }) => hexOf(o.material) === 'ede2cf')
      const elbowY = sleeve ? sleeve.lp.y - 0.3 : top - 0.75

      // ขอบเขตจริงของแขน (bbox) — ใช้ origin ของ mesh ไม่ได้ มันไม่ได้อยู่กลางชิ้น
      const bb = new THREE.Box3()
      for (const { o } of list) {
        o.geometry.computeBoundingBox()
        bb.union(o.geometry.boundingBox.clone().applyMatrix4(toLocal.clone().multiply(o.matrixWorld)))
      }
      // จุดหมุนไหล่ต้องอยู่ที่ "หัวไหล่" คือขอบในบนสุดของแขน ซึ่งซ้อนอยู่ในลำตัว
      // ถ้าหมุนรอบกึ่งกลางแขน (ของเดิม) ทั้งแขนจะเหวี่ยงออกจากตัวจนหลุดเป็นช่องว่าง
      const outward = bb.max.x > 0 ? 1 : -1
      const innerX = outward > 0 ? bb.min.x : bb.max.x

      const shoulder = new THREE.Group()
      shoulder.position.set(innerX + outward * 0.06, bb.max.y - 0.14, 0)
      model.add(shoulder)
      const elbow = new THREE.Group()
      elbow.position.set(0, elbowY - shoulder.position.y, 0)
      shoulder.add(elbow)
      model.updateMatrixWorld(true)

      // ข้อมือ: แยกกลุ่มมือ (ช่วงล่างของปลายแขน) ไว้หมุนแก้มุมงอที่ bake มาใน GLB
      const wristY = bottom + 0.42 * (elbowY - bottom)

      const wrist = new THREE.Group()
      wrist.position.set(0, wristY - elbowY, 0)
      elbow.add(wrist)
      model.updateMatrixWorld(true)

      list.forEach(({ o, lp }) => {
        if (lp.y < wristY) wrist.attach(o)
        else if (lp.y < elbowY) elbow.attach(o)
        else shoulder.attach(o)
      })
      shoulder.userData.len = top + 0.12 - bottom
      // เก็บความสูงตั้งต้นไว้ ให้ slider เลื่อนไหล่ขึ้นลงทีหลังได้ (mesh เป็นลูก จะขยับตามทั้งแขน)
      shoulder.userData.baseY = shoulder.position.y
      elbow.userData.len = elbowY - bottom
      shoulder.userData.outward = outward
      return { shoulder, elbow, wrist, outward }
    }

    /**
     * หมุน group ให้ "เนื้อแขนที่อยู่ข้างใน" ชี้ไปทางที่ต้องการ
     *
     * ท่าพักของ GLB กางแขนออกข้าง จุดหมุนกับตัวเนื้อแขนเลยไม่ได้อยู่แกนเดียวกัน
     * หมุนด้วย Euler ทีละแกนจึงกดแขนให้แนบตัวไม่ได้ (ลองแล้วชันสุดได้แค่ -61°)
     * วัดทิศจริงของเนื้อแขนก่อน แล้วคิดเป็น quaternion ทีเดียว
     */
    /** จุดกึ่งกลาง mesh ของกิ่งหนึ่ง (ข้ามกิ่งลูกที่ระบุ) ในสเปซของ model */
    const meshCentroid = (group, skip) => {
      const bb = new THREE.Box3()
      group.traverse((o) => {
        if (!o.isMesh) return
        for (let p = o.parent; p; p = p.parent) if (p === skip) return
        o.geometry.computeBoundingBox()
        bb.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld))
      })
      return bb.isEmpty() ? null : model.worldToLocal(bb.getCenter(new THREE.Vector3()))
    }

    /**
     * แก้มุมไหล่จาก "แกนของเนื้อแขนที่ตาเห็นจริง" ไม่ใช่จากจุดหมุน
     *
     * alignRest จัดทิศของ centroid เทียบกับ "จุดหมุน" ซึ่งไม่ตรงกับแกนที่มองเห็น —
     * ท่าพักของ GLB วางเนื้อแขนเยื้องออกจากข้อต่อ พอหมุนให้ centroid ตั้งตรง
     * ตัวแกนข้อต่อกลับเอียงไปอีกทางเท่า ๆ กัน แขนเลยยังดูเฉียงอยู่
     *
     * ตรงนี้วัดเวกเตอร์ ต้นแขน -> ปลายแขน จาก mesh จริง แล้วหมุนไหล่ทั้งท่อนให้เวกเตอร์นั้น
     * ไปตรงกับ want (หมุนไหล่ = หมุนทั้งแขนแบบแข็ง ค่าที่ได้จึงแม่นในครั้งเดียว ไม่ต้องวนซ้ำ)
     */
    const alignArmAxis = (arm, want) => {
      arm.shoulder.quaternion.copy(arm.shoulder.userData.rest)
      arm.elbow.quaternion.copy(arm.elbow.userData.rest)
      model.updateMatrixWorld(true)
      const upper = meshCentroid(arm.shoulder, arm.elbow)
      const fore = meshCentroid(arm.elbow, null)
      if (!upper || !fore) return
      const axis = fore.clone().sub(upper).normalize()
      arm.shoulder.userData.rest.premultiply(
        new THREE.Quaternion().setFromUnitVectors(axis, want.clone().normalize()),
      )
      arm.shoulder.quaternion.copy(arm.shoulder.userData.rest)
      model.updateMatrixWorld(true)
    }

    const alignRest = (group, want) => {
      group.updateMatrixWorld(true)
      const inv = group.matrixWorld.clone().invert()
      const bb = new THREE.Box3()
      group.traverse((o) => {
        if (!o.isMesh) return
        o.geometry.computeBoundingBox()
        bb.union(o.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld)))
      })
      const dir = bb.isEmpty() ? new THREE.Vector3(0, -1, 0) : bb.getCenter(new THREE.Vector3())
      group.userData.rest = new THREE.Quaternion().setFromUnitVectors(
        dir.normalize(),
        want.clone().normalize(),
      )
    }

    // local +x = ฝั่งซ้ายจอหลังหันหลัง (แขนชี้), local -x = ฝั่งถือแก้ว
    // เฉพาะแขนที่ยกชี้ — แขนถือแก้วหมุนไหล่นิดเดียว นิ้วโป้งยังอยู่ด้านในถูกอยู่แล้ว
    mirrorHandGeometry(arms.R)
    const armPoint = mkArm(arms.R)
    const armMug = mkArm(arms.L)
    rig.current.pointShoulder = armPoint?.shoulder
    rig.current.pointElbow = armPoint?.elbow
    rig.current.pointWrist = armPoint?.wrist
    rig.current.mugShoulder = armMug?.shoulder
    rig.current.mugElbow = armMug?.elbow

    // แขนถือแก้ว: ห้อยลงแนบลำตัว กางออกนิดเดียวพอให้แก้วไม่จมสะโพก (ตาม comp)
    // ทิศ "กางออก" ต้องอิงข้างของแขนเอง — แขนนี้อยู่ฝั่ง -x ถ้าใส่ +x จะเหวี่ยงแขนพาดหน้าอก
    if (armMug) {
      // ต้นแขนกางออกนิดเดียว (~6°) พอให้พ้นขอบลำตัว — หัวไหล่อยู่ที่ x -0.60 ลำตัวกว้างถึง ±0.71
      const out = armMug.outward
      alignRest(armMug.shoulder, new THREE.Vector3(0.1 * out, -1, 0.02))
      // ท่อนล่างห้อยดิ่งจริง ๆ: want ของศอกอยู่ในสเปซที่ถูกไหล่หมุนไปแล้ว
      // ถ้าใส่ (0,-1,0) ตรง ๆ มันจะดิ่งเทียบกับไหล่ = เอียงตามไหล่ไปด้วย
      // ต้องหมุนย้อนมุมไหล่ออกก่อน ปลายแขนจึงตั้งดิ่งเทียบกับตัวจริง ๆ
      const downUnderShoulder = new THREE.Vector3(0, -1, 0).applyQuaternion(
        armMug.shoulder.userData.rest.clone().invert(),
      )
      alignRest(armMug.elbow, downUnderShoulder)
      // ปิดท้ายด้วยการจัดแกนเนื้อแขนให้ดิ่งจริง ๆ (ดิ่งสนิท ไม่เผื่อกางออก — โจทย์คือแนบตัว)
      alignArmAxis(armMug, new THREE.Vector3(0, -1, 0))
    }

    // นิ้วชี้ — comp ชี้ด้วยนิ้วเดียว แต่ GLB ปั้นมาเป็นกำปั้นล้วน
    // ต่อนิ้วเป็นกล่องออกจากปลายมือตามแนวแขน (ข้อนิ้วที่กำอยู่เดิมยังอยู่ ได้ท่ากำ+ชี้แบบ comp)
    if (armPoint) {
      const wrist = armPoint.wrist
      model.updateMatrixWorld(true)
      const toWrist = wrist.matrixWorld.clone().invert()

      // แจกแจงชิ้นในมือ (พิกัดของ wrist): ท่อนแขน > ฝ่ามือ > ข้อนิ้ว 4 ท่อน > นิ้วโป้ง
      const parts2 = []
      wrist.traverse((o) => {
        if (!o.isMesh) return
        o.geometry.computeBoundingBox()
        const bb = o.geometry.boundingBox
          .clone()
          .applyMatrix4(toWrist.clone().multiply(o.matrixWorld))
        const size = bb.getSize(new THREE.Vector3())
        parts2.push({ o, bb, size, c: bb.getCenter(new THREE.Vector3()), vol: size.x * size.y * size.z })
      })
      const maxVol = Math.max(...parts2.map((p) => p.vol))
      const small = parts2.filter((p) => p.vol < maxVol * 0.15)
      // ข้อนิ้ว 4 ท่อนขนาดเท่ากันเป๊ะ ส่วนนิ้วโป้งขนาดต่างออกไป — จับกลุ่มจากปริมาตรที่ซ้ำกันมากสุด
      const knuckles = small.filter(
        (p) => small.filter((q) => Math.abs(q.vol - p.vol) < p.vol * 0.15).length >= 3,
      )
      const thumb = small.find((p) => !knuckles.includes(p))

      if (knuckles.length && thumb) {
        const palm = parts2.filter((p) => !small.includes(p)).sort((a, b) => a.vol - b.vol)[0]
        // ทิศที่นิ้วยื่นออก = จากฝ่ามือไปหาแถวข้อนิ้ว (ไม่ใช่แนวแขน — ข้อมือบิดอยู่ 40°)
        const row = knuckles
          .reduce((v, p) => v.add(p.c), new THREE.Vector3())
          .divideScalar(knuckles.length)
        const dir = row.clone().sub(palm.c).normalize()
        // นิ้วชี้ = ข้อนิ้วที่อยู่ชิดนิ้วโป้งที่สุด
        const index = knuckles.reduce((best, p) =>
          p.c.distanceTo(thumb.c) < best.c.distanceTo(thumb.c) ? p : best,
        )
        const along = (s) => Math.abs(s.x * dir.x) + Math.abs(s.y * dir.y) + Math.abs(s.z * dir.z)
        const knuckleLen = along(index.size)

        /**
         * สเกลอ้างอิง = "ความกว้างกำปั้น" (ระยะแถวข้อนิ้ว) ไม่ใช่ความยาวมือทั้งท่อน
         * ของเดิมอ้างความยาวมือ (ซึ่งรวมท่อนแขนเข้ามาด้วย 0.89 เทียบกับกำปั้น 0.35)
         * นิ้วเลยยาวเป็นสองเท่าที่ควร
         *
         * สัดส่วนจาก comp (วัดเทียบข้อนิ้วที่กำอยู่ซึ่งเป็นจุดอ้างอิงที่ชัดที่สุด):
         * นิ้วที่ยื่นออกมาหนา ~1.4 เท่าของข้อนิ้วหนึ่งท่อน และยาว ~2.6 เท่าของความหนาตัวเอง
         */
        // ความกว้างกำปั้น = ระยะแถวข้อนิ้ว (ข้อนอกสุดถึงข้อนิ้วชี้) + ความหนาข้อนิ้วอีกหนึ่งท่อน
        const rowSpan = Math.max(...knuckles.map((k) => k.c.distanceTo(index.c)))
        const rowW = rowSpan + Math.min(index.size.x, index.size.y, index.size.z)
        const len = knuckleLen + rowW * 0.5
        // หน้าตัดเกือบจัตุรัส — ของเดิมยกหน้าตัดของ "ข้อนิ้วที่กำอยู่" มาใช้ (0.09 x 0.24)
        // ซึ่งเป็นทรงแบนสูง พอยืดออกไปเลยได้ไม้บรรทัดแทนที่จะเป็นนิ้ว
        const thick = rowW * 0.36

        const finger = new THREE.Mesh(new THREE.BoxGeometry(thick, len, thick), index.o.material)
        finger.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
        // โคนนิ้วทาบที่เดิมของข้อนิ้ว แล้วยืดออกไปข้างหน้าอย่างเดียว
        finger.position.copy(index.c).addScaledVector(dir, (len - knuckleLen) / 2)
        finger.castShadow = finger.receiveShadow = true
        // ซ่อนข้อนิ้วเดิม กล่องใหม่คลุมตำแหน่งเดียวกัน จะได้ไม่ z-fight
        index.o.visible = false
        wrist.add(finger)
        rig.current.pointFinger = finger
      }
    }

    if (armMug) {
      const mug = makeCoffeeCup()
      // แขวนกับข้อมือ แก้วจะได้ติดไปกับมือทุกท่า (ของเดิมผูกกับข้อศอก พอขยับแขนแล้วหลุดมือ)
      armMug.wrist.updateMatrixWorld(true)
      const inv = armMug.wrist.matrixWorld.clone().invert()
      const hand = new THREE.Box3()
      armMug.wrist.traverse((o) => {
        if (!o.isMesh) return
        o.geometry.computeBoundingBox()
        hand.union(o.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld)))
      })
      // จุดจับ = กลางกำปั้น; ตัวแก้วห้อยต่ำลงมาจากตรงนั้นอีกทีตอน useFrame
      // (ต้องคิดตอนนั้นเพราะ "ทิศลงในโลกจริง" ขึ้นกับมุมข้อต่อที่ยังไม่ถูก apply ตอนนี้)
      mug.userData.grip = hand.isEmpty() ? new THREE.Vector3() : hand.getCenter(new THREE.Vector3())
      mug.position.copy(mug.userData.grip)
      armMug.wrist.add(mug)
      rig.current.mug = mug
    }

    headGroup.current = g
    eyes.current = parts.eye
    eyes.current.forEach((e) => (e.userData.baseScale = e.scale.clone()))

  }, [model])


  const pointer = useRef({ x: 0, y: 0 })
  const cur = useRef({ x: 0, y: 0 })
  const blink = useRef({ next: 2, closing: 0 })

  useEffect(() => {
    const onMove = (e) => {
      pointer.current.x = clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1)
      pointer.current.y = clamp((e.clientY / window.innerHeight) * 2 - 1, -1, 1)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [size])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    cur.current.x = damp(cur.current.x, pointer.current.x, fol.headEase, dt)
    cur.current.y = damp(cur.current.y, pointer.current.y, fol.headEase, dt)
    const { x, y } = cur.current

    // หันหลัง: แกน local กลับด้าน ต้องสลับทิศให้หัวยังหันตามเมาส์บนจอถูกฝั่ง
    const dir = facingAway ? -1 : 1
    const baseYaw = rotation[1] + (facingAway ? Math.PI : 0)

    if (headGroup.current) {
      headGroup.current.rotation.y = x * fol.headYaw * dir
      headGroup.current.rotation.x = y * fol.headPitch * dir
      headGroup.current.rotation.z = -x * fol.headRoll * dir
    }
    if (root.current) {
      // ลำตัวนิ่ง — หันตามเมาส์เฉพาะหัว
      root.current.rotation.y = baseYaw
    }

    // apply ท่าจาก rig controls
    const r = rig.current
    if (r.pointShoulder) {
      r.pointShoulder.rotation.z = pose.pointShoulderZ
      r.pointShoulder.rotation.x = pose.pointShoulderX
      r.pointShoulder.position.y = r.pointShoulder.userData.baseY - pose.pointShoulderDrop
    }
    if (r.pointElbow) {
      r.pointElbow.rotation.x = pose.pointElbowX
      // แกน Z ของศอก — คลายมุมพับที่ bake มาใน GLB ให้ท่อนล่างต่อตรงกับท่อนบน
      r.pointElbow.rotation.z = pose.pointElbowZ
    }
    if (r.pointWrist) r.pointWrist.rotation.x = pose.pointWristX
    // แขนถือแก้ว: ตั้งต้นจาก quaternion ที่กดแขนให้ห้อยแนบตัวแล้ว slider เป็นส่วนเพิ่มจากตรงนั้น
    if (r.mugShoulder?.userData.rest) {
      r.mugShoulder.quaternion
        .copy(r.mugShoulder.userData.rest)
        .multiply(TMP_Q.setFromEuler(TMP_E.set(pose.mugShoulderX, 0, pose.mugShoulderZ)))
    }
    if (r.mugElbow?.userData.rest) {
      r.mugElbow.quaternion
        .copy(r.mugElbow.userData.rest)
        .multiply(TMP_Q.setFromEuler(TMP_E.set(pose.mugElbowX, 0, 0)))
    }
    if (r.mug) {
      // แก้วตั้งตรงเสมอ — หักล้าง rotation ที่สะสมมาตามข้อต่อทั้งเส้น
      r.mug.parent.updateWorldMatrix(true, false)
      r.mug.quaternion.copy(r.mug.parent.getWorldQuaternion(TMP_Q).invert())
      // หย่อนแก้วลงจากกำปั้น แล้วดันไป "ด้านหน้าตัว" ไม่ใช่ด้านข้าง
      // ดันออกข้างแล้วท่อนแขนจะบังแก้วมิดตอนมองจากหน้า ซึ่งเป็นมุมที่ scroll ไปหยุด
      // (comp ก็ถือแก้วเยื้องมาหน้าต้นขา ไม่ได้แนบสะโพก)
      // ทิศออกนอกตัวในแนวระนาบ = จากแกนกลางลำตัวไปหากำปั้น
      const outW = r.mug.parent
        .localToWorld(TMP_V2.copy(r.mug.userData.grip))
        .sub(root.current.getWorldPosition(TMP_V))
        .setY(0)
        .normalize()
      r.mug.position
        .copy(r.mug.userData.grip)
        .addScaledVector(TMP_V.set(0, -1, 0).applyQuaternion(r.mug.quaternion), 0.24)
        .addScaledVector(outW.applyQuaternion(r.mug.quaternion), 0.13)
    }
    if (r.hipL) r.hipL.rotation.x = pose.hipLX
    if (r.hipR) r.hipR.rotation.x = pose.hipRX

    // กระพริบตา: ย่อแกน Y ของ mesh ตา
    const b = blink.current
    b.next -= delta
    if (b.next <= 0) {
      b.closing = 0.13
      b.next = 2.4 + Math.random() * 3.6
    }
    let k = 1
    if (b.closing > 0) {
      b.closing -= delta
      k = 0.12
    }
    for (const e of eyes.current) {
      const base = e.userData.baseScale
      if (!base) continue
      e.scale.y = damp(e.scale.y, base.y * k, 0.45, dt)
    }
  })

  return (
    <group ref={root} position={position} scale={scale} rotation={rotation}>
      <primitive object={model} />
      <Legs rig={rig} />
    </group>
  )
}

useGLTF.preload(MODEL)
