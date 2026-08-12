import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useControls } from 'leva'
import * as THREE from 'three'
import { addRim, clamp, lerp } from './utils'

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
 * ขา — GLB มีแค่ครึ่งบน สร้างต่อเองเป็นกล่องสไตล์เดียวกัน
 * พิกัด local ของโมเดล: เอวอยู่ y ≈ -2.24
 */
const JEANS = '#3E5C8F'
const CUFF = '#5A7BAD'
const BOOT = '#7A4E2E'
const SOLE = '#5E3B22'

function Legs({ rig }) {
  // ขาแต่ละข้างห้อยจากจุดหมุนสะโพก (rig.hipL / rig.hipR) — หมุนได้ทั้งท่อน
  const leg = (side, name) => (
    <group
      key={side}
      position={[0.33 * side, -2.36, 0]}
      rotation={[0, 0.3 * side, 0.09 * side]}
      ref={(g) => {
        if (rig) rig.current[name] = g
      }}
    >
      {/* ท่อนขายีนส์ — สั้นลง หนาขึ้น ให้สมส่วนกับลำตัว */}
      <mesh position={[0, -0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 1.24, 0.56]} />
        <meshStandardMaterial color={JEANS} roughness={1} metalness={0} />
      </mesh>
      {/* ขอบพับ — แถบฟ้าคาดปลายขา กว้างกว่าขาเล็กน้อย */}
      <mesh position={[0, -1.24, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.28, 0.66]} />
        <meshStandardMaterial color={CUFF} roughness={1} metalness={0} />
      </mesh>
      {/* บูท — หัวยื่นหน้า ส้นใต้ขอบพับ พื้นราบ */}
      <group position={[0, -1.57, 0]} rotation={[0, 0, -0.09 * side]}>
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
    pointShoulderZ: { value: 2.35, min: 0, max: 3.1, step: 0.05 },
    pointShoulderX: { value: -0.35, min: -2.5, max: 1.5, step: 0.05 },
    pointElbowX: { value: 0, min: -2.2, max: 2.2, step: 0.05 },
    // คลายมุมพับที่ bake มาใน GLB ให้ท่อนล่างต่อตรงกับท่อนบน แขนเลยเหยียดชี้ฟ้าเป็นเส้นเดียว
    pointElbowZ: { value: 0.35, min: -2.2, max: 2.2, step: 0.05 },
    pointWristX: { value: 0.7, min: -2.2, max: 2.2, step: 0.05 },
    mugShoulderX: { value: -0.5, min: -2, max: 1, step: 0.05 },
    mugElbowX: { value: 0, min: -2.2, max: 0.6, step: 0.05 },
    hipLX: { value: 0, min: -1.2, max: 1.2, step: 0.05 },
    hipRX: { value: 0, min: -1.2, max: 1.2, step: 0.05 },
  })

  // clone เพื่อไม่ไปแก้ cache ของ useGLTF
  const model = useMemo(() => scene.clone(true), [scene])

  useEffect(() => {
    const parts = { hair: [], eye: [], head: null, sideburn: [] }

    model.traverse((o) => {
      if (!o.isMesh) return
      o.castShadow = true
      o.receiveShadow = true
      // material ถูก clone มาด้วย — ปรับให้นุ่มขึ้นทีเดียวตรงนี้
      o.material = o.material.clone()
      o.material.roughness = 1
      o.material.metalness = 0
      // GLB โหลด async หลัง RimLight traverse ฉากไปแล้ว — ฉีด rim ตรงนี้ (ค่าเดียวกับ RimLight ใน App)
      // เฉพาะ standard material: rim shader ใช้ normal/vViewPosition ซึ่ง MeshBasicMaterial ไม่มี
      // ถ้าฉีดใส่ shader จะ compile ไม่ผ่าน แล้ว mesh นั้นจะไม่ถูกวาดเลย (แต่ยังทอดเงาได้)
      // — ลูกตาเป็น MeshBasicMaterial ชิ้นเดียวในโมเดล จึงหายไปทั้งคู่
      if (o.material.isMeshStandardMaterial) {
        addRim(o.material, { color: '#FFF3DC', intensity: 0.5, power: 4.2 })
      }

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
      elbow.userData.len = elbowY - bottom
      return { shoulder, elbow, wrist }
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

    if (armMug) {
      const cupMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.7, metalness: 0 })
      const mug = new THREE.Group()
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.27, 18), cupMat)
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.03, 8, 18), cupMat)
      handle.position.x = -0.16
      cup.castShadow = handle.castShadow = true
      mug.add(cup)
      mug.add(handle)
      mug.position.set(-0.18, -armMug.elbow.userData.len + 0.1, 0.22)
      armMug.elbow.add(mug)
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
    cur.current.x = lerp(cur.current.x, pointer.current.x, fol.headEase)
    cur.current.y = lerp(cur.current.y, pointer.current.y, fol.headEase)
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
    }
    if (r.pointElbow) {
      r.pointElbow.rotation.x = pose.pointElbowX
      // แกน Z ของศอก — คลายมุมพับที่ bake มาใน GLB ให้ท่อนล่างต่อตรงกับท่อนบน
      r.pointElbow.rotation.z = pose.pointElbowZ
    }
    if (r.pointWrist) r.pointWrist.rotation.x = pose.pointWristX
    if (r.mugShoulder) r.mugShoulder.rotation.x = pose.mugShoulderX
    if (r.mugElbow) r.mugElbow.rotation.x = pose.mugElbowX
    if (r.mug) r.mug.rotation.x = -(pose.mugShoulderX + pose.mugElbowX) // แก้วตั้งตรงเสมอ
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
      e.scale.y = lerp(e.scale.y, base.y * k, 0.45)
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
