import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { makeRandom, useDisposable } from '@/joespresso/scene/utils'

/**
 * ก้อนเมฆหน้าสุด — กรอบนุ่ม ๆ ที่ขอบจอ ไม่ใช่เมฆในฉาก
 *
 * หน้าที่ของมันคือ "บังมุม" ให้ภาพดูมีชั้นหน้า/ชั้นหลัง (foreground framing) ตำแหน่งจึงยึด
 * กับกรอบภาพ ไม่ใช่กับโลก: ทุกเฟรมคำนวณขนาดกรวยภาพที่ระยะ clDist แล้ววางก้อนตามพิกัด
 * ปกติ (u, v ในช่วง -1..1 ของกรอบ) ก้อนจึงเกาะขอบจอเท่ากันทุกอัตราส่วน และไม่หลุดเฟรม
 * เวลากล้องแพน/ซูมตอนอินโทร
 *
 * รูปทรง = ลูกกลมหลายลูกเกาะกัน ไม่ใช่ก้อนเดียวที่ปั้นให้ฟู: ก้อนเดียวจะได้เงาเรียบผืนเดียว
 * ซึ่งอ่านเป็นหินมากกว่าเมฆ ส่วนหลายลูกซ้อนกันให้ขอบเป็นวง ๆ และมีร่องเงาระหว่างลูก
 * ซึ่งเป็นสิ่งที่ทำให้ตาอ่านว่า "ฟู"
 */

/** ลูกกลมหน่วยใบเดียว ใช้ร่วมทุกก้อนทุกลูก — ต่างกันแค่ scale ห้าม dispose (แชร์ระดับโมดูล) */
const PUFF = new THREE.SphereGeometry(1, 22, 14)

/**
 * ผังก้อน: [u, v, สเกล, seed]
 * u/v = พิกัดในกรอบภาพ (-1..1) ค่าที่เกิน 1 เล็กน้อย = โผล่มาครึ่งก้อนจากนอกจอ ซึ่งเป็น
 * สิ่งที่ทำให้มันอ่านเป็น "เมฆที่บังเลนส์" ไม่ใช่ก้อนที่ถูกวางไว้กลางจอ
 */
const CLOUDS = [
  [-1.12, -0.86, 1.35, 3],
  [-0.72, -1.16, 1.0, 11],
  [1.16, -0.78, 1.5, 5],
  [0.74, -1.2, 1.05, 17],
  [-1.2, 0.82, 1.15, 23],
  [1.22, 0.9, 1.3, 29],
  [0.1, 1.24, 1.1, 41],
]

/**
 * ลูกกลมในหนึ่งก้อน — ก้นแบน หลังเป็นตะปุ่มตะป่ำ (สุ่มคงที่จาก seed)
 *
 * เมฆการ์ตูนอ่านออกจากเส้นรอบรูปสองอย่าง: ก้นที่ค่อนข้างเรียบ กับหลังที่เป็นก้อนกลมโป่ง
 * ไม่เท่ากัน ถ้าเรียงลูกกลมรอบวงเท่า ๆ กันจะได้ก้อนกลมคล้ายพวงองุ่น ไม่ใช่เมฆ
 *
 * ทุกลูกจึงถูกวางบนแนวนอนเดียวกัน (y ต่ำสุดเท่ากัน) แล้วให้รัศมีต่างกันมาก ๆ ลูกใหญ่อยู่กลาง
 * ค่อยเล็กลงไปทางปลาย ด้านบนมีลูกเสริมซ้อนอีกชั้นให้หลังฟูขึ้นเป็นชั้น ๆ
 */
function puffs(seed) {
  const rand = makeRandom(seed)
  const out = []
  /** แถวล่าง: ลูกใหญ่กลาง เล็กลงทางปลาย — ก้นทุกลูกอยู่ระดับเดียวกัน */
  const n = 5 + Math.floor(rand() * 2)
  for (let i = 0; i < n; i++) {
    // -1..1 จากกลางก้อน
    const u = (i / (n - 1)) * 2 - 1
    const r = (0.95 - 0.42 * u * u) * (0.86 + rand() * 0.28)
    const x = u * 0.92
    out.push({
      p: [x, r * 0.62, (rand() - 0.5) * 0.3],
      s: [r, r * (0.82 + rand() * 0.14), r * 0.92],
    })
  }
  /** แถวบน: ลูกเล็กกว่า ซ้อนเยื้องไปข้างหลัง ทำให้หลังก้อนเป็นชั้น ไม่ใช่โดมเดียว */
  const m = 2 + Math.floor(rand() * 2)
  for (let i = 0; i < m; i++) {
    const u = (rand() - 0.5) * 1.15
    const r = 0.42 + rand() * 0.3
    out.push({
      p: [u, 0.92 + r * 0.42 + rand() * 0.12, -0.12 - rand() * 0.24],
      s: [r, r * 0.9, r * 0.88],
    })
  }
  return out
}

/** ที่พักคำนวณเมทริกซ์ — ตัวเดียวใช้ซ้ำทุกลูกทุกเฟรม ไม่สร้างออบเจกต์ในลูป */
const CLOUD_OBJ = new THREE.Object3D()
const LUMP_OBJ = new THREE.Object3D()
const OUT_MAT = new THREE.Matrix4()

/**
 * dist = ระยะจากกล้อง (ยิ่งน้อยยิ่งใหญ่และยิ่งอยู่หน้า), scale = ตัวคูณขนาดรวม
 * drift = แอมพลิจูดการไหวเบา ๆ (หน่วยของกรอบภาพต่อรอบ) — 0 = นิ่งสนิท
 *
 * ทุกลูกของทุกก้อนเป็น InstancedMesh ใบเดียว: ลูกกลมใบเดียวกัน วัสดุใบเดียวกัน ต่างกันแค่
 * เมทริกซ์ — แยกเป็น mesh ละใบคือจ่าย draw call ห้าสิบครั้งต่อเฟรมเพื่อภาพเดิมเป๊ะ
 */
export function EdgeClouds({ dist = 15, scale = 1, drift = 0.02, tint = '#ffffff' }) {
  const inst = useRef()
  /** ลูกทั้งหมดเรียงแบน ๆ พร้อมบอกว่าเป็นของก้อนไหน — ผังคงที่ สุ่มครั้งเดียวจาก seed */
  const lumps = useMemo(
    () => CLOUDS.flatMap(([, , , seed], ci) => puffs(seed).map((l) => ({ ci, ...l }))),
    [],
  )
  /**
   * ผิวเมฆไม่รับไฟของฉาก — ไล่เฉดจากทิศของผิวเอง
   *
   * ไฟของฉากตั้งไว้แรง (key 4) สำหรับของสีจัด พอเจอผิวขาวล้วน ค่าที่ได้เกิน 1 ทุกด้าน
   * ทั้งก้อนเลยถูกตัดเป็นขาวแบนแผ่นเดียว ไม่เหลือไล่เฉดให้ตาอ่านว่าเป็นทรงกลม
   * (ยังโดน cel pass ตัดเป็นชั้นซ้ำอีกที) เมฆจึงมีสูตรแสงของตัวเอง คุมคอนทราสต์ได้ตรง ๆ
   *
   * สามชั้นที่ทำให้อ่านเป็นก้อนฟู:
   *  · ยอดสว่าง ท้องอมฟ้า — ไล่ตาม n.y คือสิ่งที่บอกว่าแสงมาจากฟ้าด้านบน
   *  · ไฟเฉียงหนึ่งดวง (คงที่ในสายตา) ให้แต่ละลูกมีด้านสว่าง/ด้านเงาของตัวเอง รอยต่อ
   *    ระหว่างลูกจึงอ่านเป็นร่อง ไม่ใช่เส้นขอบ
   *  · ขอบก้อนสว่างขึ้นเล็กน้อย (fresnel) — ขนฟุ้งรับแสงรอบตัวแบบเมฆจริง
   */
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTop: { value: new THREE.Color(tint) },
          uBot: { value: new THREE.Color('#8fb2de') },
          uShade: { value: 1 },
        },
        /**
         * เชดเดอร์ดิบไม่ได้จัดการ instancing ให้เอง — ต้องคูณ instanceMatrix เอง
         * (วัสดุมาตรฐานของ three แทรกให้อัตโนมัติ แต่ ShaderMaterial ไม่มีใครแทรกให้)
         *
         * normal ต้องหารด้วยสเกลก่อนหมุน เพราะแต่ละลูกถูกย่อไม่เท่ากันสามแกน ถ้าคูณ
         * instanceMatrix ตรง ๆ ทิศของผิวจะเบี้ยวตามการย่อ แล้วไล่เฉดจะผิดทั้งก้อน
         */
        vertexShader: `
          varying vec3 vN;
          varying vec3 vV;
          void main() {
            vec3 p = position;
            vec3 n = normal;
            #ifdef USE_INSTANCING
              vec3 sc = vec3(
                length(instanceMatrix[0].xyz),
                length(instanceMatrix[1].xyz),
                length(instanceMatrix[2].xyz)
              );
              mat3 rot = mat3(
                instanceMatrix[0].xyz / sc.x,
                instanceMatrix[1].xyz / sc.y,
                instanceMatrix[2].xyz / sc.z
              );
              p = (instanceMatrix * vec4(position, 1.0)).xyz;
              n = rot * (normal / sc);
            #endif
            vN = normalize(normalMatrix * n);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          uniform vec3 uTop;
          uniform vec3 uBot;
          uniform float uShade;
          varying vec3 vN;
          varying vec3 vV;
          void main() {
            vec3 n = normalize(vN);
            /* ไฟเฉียงบนซ้ายหน้า — พิกัดสายตา ก้อนจึงได้แสงเท่ากันทุกมุมกล้อง */
            vec3 L = normalize(vec3(-0.42, 0.82, 0.52));
            float ndl = dot(n, L) * 0.5 + 0.5;
            /* ช่วงกว้าง = ไล่เฉดยาว ๆ ทั้งก้อน ถ้าช่วงแคบ แต่ละลูกจะไล่ครบเฉดในตัวเอง
               แล้วรอยต่อระหว่างลูกกลายเป็นเส้นสว่างชนเส้นมืด */
            float sky = smoothstep(-1.0, 1.1, n.y);
            /* ไฟเฉียงใส่น้อย ๆ พอให้รู้ทิศ — ใส่มากแล้วลูกที่หันคนละทางต่างค่ากันจนเห็นรอยต่อ */
            float k = mix(sky, ndl, 0.26);
            /* ยกพื้นขึ้นก่อนผสม — ท้องเมฆต้องเป็นฟ้าอ่อน ไม่ใช่เทาสกปรก */
            k = mix(0.46, 1.0, k);
            vec3 col = mix(uBot, uTop, clamp(k * uShade, 0.0, 1.0));
            float fres = pow(1.0 - clamp(dot(n, normalize(vV)), 0.0, 1.0), 3.0);
            col = mix(col, uTop, fres * 0.12);
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    [tint],
  )
  useDisposable(mat)

  useFrame(({ camera, clock }) => {
    const im = inst.current
    if (!im) return
    const h = 2 * dist * Math.tan((camera.fov * Math.PI) / 360)
    const w = h * camera.aspect
    const tt = clock.elapsedTime
    for (let i = 0; i < lumps.length; i++) {
      const l = lumps[i]
      const [u, v, s, seed] = CLOUDS[l.ci]
      // ไหวคนละจังหวะ — เฟสมาจาก seed ก้อนจึงไม่ขยับพร้อมกันเป็นแผง
      const du = Math.sin(tt * 0.13 + seed) * drift
      const dv = Math.cos(tt * 0.17 + seed * 0.7) * drift * 0.6
      CLOUD_OBJ.position
        .set(((u + du) * w) / 2, ((v + dv) * h) / 2, -dist)
        .applyQuaternion(camera.quaternion)
        .add(camera.position)
      CLOUD_OBJ.quaternion.copy(camera.quaternion)
      // ขนาดผูกกับความสูงของกรอบ ก้อนจึงกินพื้นที่จอเท่าเดิมทุกความละเอียด
      CLOUD_OBJ.scale.setScalar(s * scale * h * 0.11)
      CLOUD_OBJ.updateMatrix()
      LUMP_OBJ.position.set(l.p[0], l.p[1], l.p[2])
      LUMP_OBJ.scale.set(l.s[0], l.s[1], l.s[2])
      LUMP_OBJ.updateMatrix()
      OUT_MAT.multiplyMatrices(CLOUD_OBJ.matrix, LUMP_OBJ.matrix)
      im.setMatrixAt(i, OUT_MAT)
    }
    im.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={inst}
      args={[PUFF, mat, lumps.length]}
      /* ก้อนเกาะกรอบภาพ ไม่ได้อยู่ในโลก — ให้คัลลิงตัดสินจากกล่องขอบเขตเดิมแล้วมันหายทั้งชุด */
      frustumCulled={false}
    />
  )
}
