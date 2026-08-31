import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { JOURNEY } from "@/data/journey";
import { loadTileTexture, makeLabelTexture } from "./tunnelTexture";

/**
 * จอ Experiences — อุโมงค์กระเบื้องสามมิติที่เล่าเส้นทางการทำงาน
 *
 * จบจอ What I Do แล้วการ์ด mascot จะขยายเต็มจอ ก่อนจะจางออกไปเผยอุโมงค์ที่อยู่ข้างหลัง
 * ระยะ scroll ในกรอบ (สูงหลายเท่าจอ) = ระยะทางที่กล้องพุ่งเข้าไปในอุโมงค์ ผนังอุโมงค์เป็น
 * กระเบื้องหนาจริง (กล่อง ไม่ใช่ระนาบแปะรูป) แต่ละใบมีโลโก้เครื่องมือที่ใช้จริง และเป็นระยะ ๆ
 * จะเจอ "ป้ายหมุด" ของที่ทำงานแต่ละที่ เรียงตามไทม์ไลน์จริงจาก src/data/journey
 *
 * ค่าที่เปลี่ยนทุกเฟรม (ระยะ scroll) อยู่ในอ็อบเจกต์นอก React — setState ใน useFrame คือ
 * re-render หกสิบครั้งต่อวินาที ส่วน state ของ React มีตัวเดียว: "ตอนนี้เล่าถึงหมุดไหน"
 */

// ตัวละครตัวเดียวกับที่ใช้ทั้งเว็บ — chunk หนัก แยกโหลดทั้งคู่
const Mascot = lazy(() =>
  import("@/joespresso/scene/Mascot").then((m) => ({ default: m.Mascot })),
);

/** ระยะจากจุดกำเนิดของ GLB ลงไปถึงฝ่าเท้า (หน่วยของโมเดล) — ใช้จัดให้เห็นเต็มตัว */
const FEET_BELOW_ORIGIN = 4.97;

/**
 * ผังอุโมงค์เป็น "กริด" ไม่ใช่กระเบื้องโปรยมั่ว — ผนังทั้งสี่ด้านปูเต็มด้วยช่องขนาดเท่ากัน
 * เว้นร่องเท่ากันทุกช่อง ร่องคือช่องว่างที่เห็นเปลือกด้านในสีเข้ม จึงอ่านเป็นเส้นกริด
 */
/** ครึ่งความกว้างของอุโมงค์ (หน่วยฉาก) */
const R = 3.2;
/** จำนวนช่องต่อผนังหนึ่งด้าน */
const COLS = 5;
/** ระยะจากกลางช่องถึงกลางช่องถัดไป */
const STEP = (R * 2) / COLS;
/** ขนาดช่องจริง — เล็กกว่า STEP อยู่หนึ่งร่อง */
const CELL = STEP - 0.16;
/**
 * อุโมงค์วนไม่รู้จบ: ลายซ้ำทุก LOOP หน่วย จึงปูจริงสองเท่าของคาบแล้วเลื่อนทั้งก้อนไปข้างหน้า
 * พอเลื่อนครบหนึ่งคาบก็วนกลับ ภาพต่อเนียนโดยไม่ต้องคำนวณตำแหน่งกระเบื้องใหม่ทุกเฟรม
 * (คิดตำแหน่งใหม่ทีละใบต่อเฟรม = งานหลายร้อยชิ้นต่อเฟรมโดยไม่จำเป็น)
 */
const RINGS_PER_LOOP = 16;
const RINGS = RINGS_PER_LOOP * 2;
const LOOP = RINGS_PER_LOOP * STEP;
/** ระยะที่ "บินได้" ทั้งจอ — ใช้แปลงระยะ scroll เป็นระยะทางในอุโมงค์ */
const TRAVEL = LOOP * 5;

/**
 * ค่ากลางที่ฉากอ่านทุกเฟรม (ไม่ใช่ state)
 * t = ระยะบินในอุโมงค์ 0..1 · open = ความคืบหน้าของการซูมเข้าไปในกล่อง 0..1
 * brk = บีตสุดท้าย: ตัวละครพุ่งชนกระจกจนแตกออกไปหาจอถัดไป 0..1
 */
const flight = { t: 0, open: 0, brk: 0 };

/** ช่วงท้ายของระยะบินที่เป็นบีตทุบกระจก */
const BREAK_FROM = 0.86;

/** มุมกล้องตอนซูมสุด / ตอนกางเต็มจอแล้ว — ต่างกันคือความรู้สึกว่ากล้อง "พุ่งเข้าไป" ในกล่อง */
const FOV_IN = 42;
const FOV_OUT = 62;

/** สกรีนช็อตงานจริง — แกลเลอรีบนผนังอุโมงค์เป็นผลงานที่ทำจริง ไม่ใช่ภาพ stock */
const WORK_SHOTS = Object.values(
  import.meta.glob("../../assets/works/health/*.{png,jpg,jpeg,webp}", {
    eager: true,
    import: "default",
    query: "?url",
  }) as Record<string, string>,
);

/** โลโก้เครื่องมือที่ใช้จริง — ไฟล์ที่มีอยู่ในโปรเจกต์ ไม่ได้ไปหยิบของใครมาแปะ */
const TOOL_LOGOS = Object.values(
  import.meta.glob(
    [
      "../../assets/figma-color.svg",
      "../../assets/vs-code-color.svg",
      "../../assets/github-color.svg",
      "../../assets/jira-icon.svg",
      "../../assets/monday-color.svg",
      "../../assets/clickup-icon.svg",
      "../../assets/powerbi.svg",
      "../../assets/vue.svg",
      "../../assets/rstudio.svg",
      "../../assets/photoshop-icon.svg",
      "../../assets/excel.svg",
      "../../assets/scratch-icon.svg",
    ],
    { eager: true, import: "default", query: "?url" },
  ) as Record<string, string>,
);

/** หมุดไทม์ไลน์: ที่ไหน ตอนไหน — เนื้อหามาจาก JOURNEY ทั้งหมด ไม่มีอะไรแต่งเพิ่ม */
const STOPS = JOURNEY.map((s, i) => ({
  ...s,
  /** สัดส่วนของระยะบินที่หมุดนี้จะวิ่งมาถึงหน้ากล้องพอดี */
  at01: (i + 1) / (JOURNEY.length + 1),
}));

const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

/** ผนังสี่ด้าน: จุดกลางผนัง + การหมุนให้หน้ากระเบื้องหันเข้าใน */
const WALLS: {
  pos: [number, number, number];
  rot: [number, number, number];
}[] = [
  { pos: [-R, 0, 0], rot: [0, Math.PI / 2, 0] },
  { pos: [R, 0, 0], rot: [0, -Math.PI / 2, 0] },
  { pos: [0, R, 0], rot: [Math.PI / 2, 0, 0] },
  { pos: [0, -R, 0], rot: [-Math.PI / 2, 0, 0] },
];

type Slot = { wall: number; col: number; ring: number };

const slotKey = (s: Slot) => `${s.ring}-${s.wall}-${s.col}`;

/** ตำแหน่ง/การหมุนของช่องหนึ่งในกริด */
function slotTransform(s: Slot) {
  const wall = WALLS[s.wall];
  const slide = (s.col - (COLS - 1) / 2) * STEP;
  const along = new THREE.Vector3(slide, 0, 0).applyEuler(
    new THREE.Euler(...wall.rot),
  );
  return {
    position: [
      wall.pos[0] + along.x,
      wall.pos[1] + along.y,
      -s.ring * STEP + along.z,
    ] as [number, number, number],
    rotation: wall.rot,
  };
}

/**
 * ช่องเปล่าทั้งหมดเป็น InstancedMesh ก้อนเดียว
 *
 * กริดเต็มอุโมงค์คือช่องระดับหกร้อยช่อง ถ้าทำเป็น mesh ละใบก็หกร้อย draw call เพื่อกล่อง
 * ที่หน้าตาเหมือนกันหมด ต่างกันแค่เฉดสี — instancedMesh + instanceColor จบใน draw call เดียว
 */
function GridCells({ skip }: { skip: Set<string> }) {
  const ref = useRef<THREE.InstancedMesh>(null);

  const slots = useMemo(() => {
    const out: Slot[] = [];
    for (let ring = 0; ring < RINGS; ring++)
      for (let wall = 0; wall < WALLS.length; wall++)
        for (let col = 0; col < COLS; col++) {
          const s = { ring, wall, col };
          if (!skip.has(slotKey(s))) out.push(s);
        }
    return out;
  }, [skip]);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const scale = new THREE.Vector3(CELL, CELL, 0.14);
    const color = new THREE.Color();
    slots.forEach((s, i) => {
      const t = slotTransform(s);
      q.setFromEuler(new THREE.Euler(...t.rotation));
      m.compose(new THREE.Vector3(...t.position), q, scale);
      mesh.setMatrixAt(i, m);
      // เฉดน้ำเงินไล่กันเล็กน้อยต่อช่อง — กริดจึงไม่แบนเป็นสีเดียวทั้งผนัง
      const k = hash(s.ring * 17 + s.wall * 5 + s.col);
      color.setHSL(0.62, 0.72, 0.24 + k * 0.16);
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [slots]);

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, slots.length]}
      frustumCulled={false}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.42} metalness={0.12} />
    </instancedMesh>
  );
}

/** ช่องที่มีรูป — ใบเดี่ยว เพราะแต่ละใบมี texture ของตัวเอง */
function FaceCell({
  geo,
  edge,
  face,
  slot,
  span = 1,
}: {
  geo: THREE.BoxGeometry;
  edge: THREE.Material;
  face: THREE.Material;
  slot: Slot;
  /** กินกี่ช่องของกริด — หมุดไทม์ไลน์กินสองช่อง */
  span?: number;
}) {
  const t = slotTransform(slot);
  // ลำดับหน้าของ BoxGeometry: +x, -x, +y, -y, +z, -z — หน้ารูปคือ +z (หันเข้าอุโมงค์)
  const mats = useMemo(
    () => [edge, edge, edge, edge, face, edge],
    [edge, face],
  );
  const size = CELL * span + STEP * (span - 1);
  // ใบที่กินหลายช่องต้องเลื่อนไปครึ่งช่องต่อช่องที่เกิน ไม่งั้นมันจะเยื้องไปทับร่องข้าง ๆ
  const off = ((span - 1) * STEP) / 2;
  const wall = WALLS[slot.wall];
  const shift = new THREE.Vector3(off, 0, 0).applyEuler(
    new THREE.Euler(...wall.rot),
  );
  return (
    <mesh
      geometry={geo}
      material={mats}
      position={[
        t.position[0] + shift.x,
        t.position[1] + shift.y,
        t.position[2] + shift.z - off,
      ]}
      rotation={t.rotation}
      scale={[size, size, 0.16]}
    />
  );
}

function Tunnel() {
  const group = useRef<THREE.Group>(null);
  const marks = useRef<THREE.Group>(null);

  const { geo, edge, faces, labelFaces } = useMemo(() => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const edge = new THREE.MeshStandardMaterial({
      color: "#1c46b4",
      roughness: 0.42,
      metalness: 0.15,
    });
    /**
     * หน้ากระเบื้องที่มีรูป "เรืองแสงเอง" เล็กน้อย (emissiveMap ตัวเดียวกับ map)
     * ไฟดวงเดียวที่เดินไปกับกล้องทำให้ช่องที่อยู่ไกลมืดสนิท โลโก้กับป้ายชื่อจึงต้องมีแสง
     * ของตัวเองพอให้อ่านออกก่อนกล้องจะถึง — ไม่ใช่โผล่มาสว่างวาบตอนผ่านหน้า
     */
    const mk = (map: THREE.Texture, glow = 0.55) =>
      new THREE.MeshStandardMaterial({
        map,
        emissive: "#ffffff",
        emissiveMap: map,
        emissiveIntensity: glow,
        roughness: 0.3,
        metalness: 0.1,
      });
    const faces = [
      ...WORK_SHOTS.map((src) =>
        mk(loadTileTexture(src, 512, "#12307f", "cover"), 0.35),
      ),
      ...TOOL_LOGOS.map((src) => mk(loadTileTexture(src))),
    ];
    // ป้ายหมุด: ที่ไหนมีไฟล์โลโก้จริงก็ใช้โลโก้ ที่ไหนไม่มีก็เขียนชื่อจริงลงไปแทน
    const labelFaces = STOPS.map((s) =>
      mk(
        s.logos?.[0]
          ? loadTileTexture(s.logos[0].src, 512, "#fd5000")
          : makeLabelTexture(s.at.replace("@", ""), 512),
        0.9,
      ),
    );
    return { geo, edge, faces, labelFaces };
  }, []);

  useEffect(
    () => () => {
      geo.dispose();
      edge.dispose();
      for (const m of [...faces, ...labelFaces]) {
        m.map?.dispose();
        m.dispose();
      }
    },
    [geo, edge, faces, labelFaces],
  );

  /** ช่องที่ถูกจองไว้ให้โลโก้ — กระจายทั่วอุโมงค์แบบคงที่ ไม่สุ่มใหม่ทุกครั้งที่วาด */
  const logoSlots = useMemo(
    () =>
      faces.map((_, i) => {
        const seed = i * 13 + 3;
        return {
          ring: 2 + Math.floor(hash(seed) * (RINGS - 4)),
          wall: Math.floor(hash(seed + 41) * WALLS.length) % WALLS.length,
          col: Math.floor(hash(seed + 77) * COLS) % COLS,
        };
      }),
    [faces],
  );

  /** ช่องของหมุดไทม์ไลน์ — กินสองช่อง อยู่ที่ความลึกตามลำดับจริง */
  const stopSlots = useMemo(
    () =>
      STOPS.map((s, i) => ({
        ring: Math.round((s.at01 * TRAVEL) / STEP),
        wall: i % 2 ? 0 : 1,
        col: i % 2 ? 1 : COLS - 2,
      })),
    [],
  );

  const skip = useMemo(() => {
    const set = new Set<string>();
    for (const s of logoSlots) set.add(slotKey(s));
    for (const s of stopSlots) {
      // หมุดกินสองช่องทั้งแนวขวางและแนวลึก จึงต้องเว้นช่องข้างเคียงด้วย
      for (const dc of [0, 1])
        for (const dr of [0, 1])
          set.add(slotKey({ ...s, col: s.col + dc, ring: s.ring + dr }));
    }
    return set;
  }, [logoSlots, stopSlots]);

  useFrame(({ clock }) => {
    /**
     * กล้องอยู่กับที่ อุโมงค์เป็นฝ่ายวิ่งเข้าหา — แบบนี้ถึงจะวนไม่รู้จบได้จริง
     * ระยะทาง = ระยะ scroll + เวลาที่เดินเอง (แกลเลอรีจึงไม่หยุดนิ่งตอนคนหยุดเลื่อน)
     */
    const dist = flight.t * TRAVEL + clock.elapsedTime * 1.35;
    const g = group.current;
    if (g) {
      g.position.z = ((dist % LOOP) + LOOP) % LOOP;
      g.rotation.z = Math.sin(dist * 0.02) * 0.09;
    }
    // ป้ายหมุดไม่วน — มันต้องมาถึงตรงจังหวะที่เรื่องเล่าไปถึงที่นั่นพอดี
    if (marks.current) marks.current.position.z = flight.t * TRAVEL;
  });

  return (
    <>
      <group ref={group}>
        <GridCells skip={skip} />
        {logoSlots.map((slot, i) => (
          <FaceCell
            key={`logo-${i}`}
            geo={geo}
            edge={edge}
            face={faces[i % faces.length]}
            slot={slot}
          />
        ))}
      </group>

      {/* ป้ายหมุดของแต่ละที่ — ใบใหญ่กินสี่ช่อง เพื่อให้อ่านออกตอนมันวิ่งผ่านหน้า */}
      <group ref={marks}>
        {stopSlots.map((slot, i) => (
          <FaceCell
            key={STOPS[i].at}
            geo={geo}
            edge={edge}
            face={labelFaces[i]}
            slot={slot}
            span={2}
          />
        ))}
      </group>
    </>
  );
}

/**
 * ซูมเข้าไปในกล่องด้วยมุมกล้อง ไม่ใช่ CSS transform
 *
 * ถ้าขยายแคนวาสด้วย scale() ภาพที่ถูกยืดคือพิกเซลที่เรนเดอร์มาแล้ว = เบลอตามอัตราขยาย
 * ขยับ fov แทน ทุกเฟรมเรนเดอร์ที่ความละเอียดเต็ม ภาพคมตลอดการซูม
 */
function ZoomIn() {
  useFrame(({ camera }) => {
    const cam = camera as THREE.PerspectiveCamera;
    const want = FOV_IN + (FOV_OUT - FOV_IN) * flight.open;
    if (Math.abs(cam.fov - want) < 0.01) return;
    cam.fov = want;
    cam.updateProjectionMatrix();
  });
  return null;
}

function Lights() {
  // ไฟดวงหลักอยู่ตรงหน้ากล้อง (ซึ่งอยู่กับที่) — กระเบื้องที่วิ่งเข้ามาใกล้จึงสว่างขึ้นแล้วจมกลับเข้าหมอก
  return (
    <>
      <ambientLight intensity={0.9} color="#9db8ff" />
      <pointLight
        position={[0, 0, 1.5]}
        intensity={70}
        distance={30}
        decay={1.8}
        color="#eaf1ff"
      />
    </>
  );
}

/**
 * ตัวละครที่ลอยอยู่ในอุโมงค์ — เป็นของในฉากสามมิติ ไม่ใช่การ์ด HTML ที่ลอยทับ
 *
 * ช่วงแรกของ section มันอยู่ตรงหน้ากล้องเต็มตัวเต็มจอ (ต่อจากกระเบื้องตัวละครของ What I Do
 * ที่กำลังกางออก) พอเริ่มบิน มันก็ลอยเลี้ยงตัวไปมาแบบไร้แรงโน้มถ่วง — ลอยไกลขึ้น เยื้องออก
 * ข้าง และหมุนช้า ๆ เหมือนว่ายอยู่ในอวกาศ ไม่ใช่ค้างอยู่กลางเฟรมตลอดทาง
 *
 * ทุกอย่างวัดจากกล้อง ไม่ใช่พิกัดโลก เพราะกล้องเลื่อนไปตามระยะ scroll ตลอดเวลา
 */
function FloatingMascot() {
  const rig = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const g = rig.current;
    if (!g) return;
    const t = flight.t;
    const time = clock.elapsedTime;

    /**
     * บีตสุดท้าย: เลิกลอยเลี้ยง แล้วพุ่งเข้าหากล้อง
     *
     * ก่อนหน้านี้ตัวละครลอยอยู่ข้าง ๆ เพราะกลางเฟรมเป็นที่ของข้อความ พอถึงบีตนี้ข้อความ
     * ถูกเก็บไปแล้ว ตัวละครจึงกลับมากลางเฟรมและวิ่งเข้าใส่ "กระจก" (ระนาบของจอ) จนทะลุ
     * ออกไปอยู่ฝั่งเดียวกับคนดู ที่เหลือเป็นงานของเลเยอร์กระจกแตกข้างนอกแคนวาส
     */
    const brk = flight.brk;
    // ระยะห่างจากกล้อง: ใกล้มากตอนเต็มจอ แล้วถอยออกเมื่อเริ่มบิน
    // เริ่มไกลพอให้เห็นเต็มตัวตั้งแต่เฟรมแรกของอุโมงค์ (มุมกล้องช่วงซูมแคบกว่าปกติ ตัวจึงดูใหญ่ขึ้น)
    // พุ่งเข้าใกล้สุดตอนกระจกร้าว (brk 0.34) แล้วเลยกล้องออกไปฝั่งคนดูหลังจากนั้น
    const rush = Math.min(1, brk / 0.34);
    const dist = (6.2 + t * 4.0) * (1 - rush) + 1.05 * rush - Math.max(0, brk - 0.34) * 2.6;
    // เยื้องออกข้างและลอยขึ้นลง เริ่มจากศูนย์กลางเป๊ะ แล้วค่อยกว้างขึ้นตามระยะบิน
    // เข้าบีตชนแล้ว การเลี้ยงตัวต้องหายไป ไม่ใช่ยังส่ายอยู่ระหว่างพุ่ง
    const sway = Math.min(1, t / 0.25) * (1 - rush);
    // ลอยออกไปทางข้างเป็นหลัก ไม่ใช่ค้างกลางเฟรม — กลางเฟรมเป็นที่ของข้อความที่กำลังเล่า
    g.position.set(
      (2.3 + Math.sin(time * 0.31) * 0.7) * Math.sin(time * 0.19 + 1.2) * sway,
      Math.sin(time * 0.33) * 1.15 * sway,
      -dist,
    );
    /**
     * เอียงตัวไปตามลม ไม่ใช่หมุนรอบตัวเอง
     *
     * ของเดิมหมุนสะสมรอบแกน y ตลอดเวลา ซึ่งอ่านเป็นของที่ลอยเคว้งไร้การควบคุม พอตัวละคร
     * มีท่าว่ายอากาศของตัวเองแล้ว มันต้อง "คุมทิศ" ได้ — เอียงส่ายอยู่ในช่วงแคบ ๆ รอบท่าที่
     * หันหน้าเข้ากล้าง แล้วให้ท่าของรีก (แขนขาไหว) เป็นตัวเล่าว่ากำลังตกอยู่ในกระแสลม
     */
    g.rotation.set(
      Math.sin(time * 0.27) * 0.22 * sway,
      Math.sin(time * 0.19) * 0.5 * sway,
      Math.sin(time * 0.21) * 0.18 * sway,
    );
  });

  return (
    <group ref={rig}>
      {/* ยกขึ้นครึ่งตัว — จุดกำเนิดของ GLB อยู่แถวหัว ถ้าไม่ยก ตัวจะจมใต้กึ่งกลางเฟรม */}
      <group position={[0, FEET_BELOW_ORIGIN * 0.5 * 0.42, 0]}>
        <Suspense fallback={null}>
          <Mascot scale={0.5} isolated noIdle skydive />
        </Suspense>
      </group>
    </group>
  );
}

/**
 * เศษกระจก — ลิ่มที่กางออกจากจุดชน
 *
 * แบ่งเป็นลิ่มจากจุดกลางจอไปยังขอบ ไม่ใช่สี่เหลี่ยมกริด เพราะรอยแตกของกระจกจริงวิ่งออก
 * จากจุดที่ถูกกระแทกเป็นรัศมี ลิ่มที่ได้จึงยาวไม่เท่ากันตามรูปจอ ซึ่งตรงกับของจริง
 * มุมไม่เท่ากันเป๊ะ (บวกค่าคงที่ต่อชิ้น) — แบ่งเท่ากันหมดจะอ่านเป็นพัดกระดาษ ไม่ใช่กระจก
 */
const SHARD_N = 14;
const SHARDS = Array.from({ length: SHARD_N }, (_, i) => {
  const jitter = (k: number) => (hash(k * 3.7 + 1.3) - 0.5) * (360 / SHARD_N) * 0.55;
  const a0 = (i * 360) / SHARD_N + jitter(i);
  const a1 = ((i + 1) * 360) / SHARD_N + jitter(i + 1);
  // รัศมีเกินขอบจอไปเยอะ ๆ ลิ่มจึงคลุมถึงมุมจอในทุกอัตราส่วน
  const pt = (deg: number) => {
    const r = 120;
    const rad = (deg * Math.PI) / 180;
    return `${(50 + Math.cos(rad) * r).toFixed(1)}% ${(50 + Math.sin(rad) * r).toFixed(1)}%`;
  };
  return {
    /** ทิศที่ลิ่มนี้จะปลิวออกไป = กลางลิ่มของตัวเอง */
    a: (a0 + a1) / 2,
    clip: `polygon(50% 50%, ${pt(a0)}, ${pt((a0 + a1) / 2)}, ${pt(a1)})`,
    /** ปลิวไม่พร้อมกัน — ชิ้นที่อยู่ใกล้จุดชนไปก่อน */
    delay: hash(i * 9.1) * 0.22,
  };
});

/**
 * ถ่ายภาพเฟรมสุดท้ายก่อนกระจกแตก
 *
 * เศษกระจกต้องเป็น "ภาพของฉากที่กำลังดูอยู่" ไม่ใช่แผ่นสีทึบ ถึงจะอ่านว่าจอนี้แตก
 * อ่านพิกเซลกลับจากแคนวาสครั้งเดียวตอนเริ่มบีต (ต้องมี preserveDrawingBuffer ไม่งั้น
 * บัฟเฟอร์ถูกเคลียร์ไปแล้วตอนเรียก จะได้ภาพดำล้วน) แล้วเลิกยุ่งกับมันไปตลอด
 */
function CaptureOnBreak({ onShot }: { onShot: (url: string) => void }) {
  const done = useRef(false);
  useFrame(({ gl }) => {
    if (done.current || flight.brk < 0.3) return;
    done.current = true;
    onShot(gl.domElement.toDataURL("image/jpeg", 0.82));
  });
  return null;
}

/** ท่อนเล่าเรื่องกลางจอ — เปลี่ยนตามหมุดที่กล้องกำลังผ่าน */
function Story({ stop }: { stop: number }) {
  const s = STOPS[stop];
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
      <p className="v3-eyebrow text-[var(--v3-orange)]">{s.at}</p>
      <h3 className="v3-h1 mt-4 max-w-[16ch] uppercase">{s.role}</h3>
      <p className="mt-5 max-w-[46ch] text-[clamp(14px,1.9svh,18px)] leading-normal text-white/80">
        {s.org}
      </p>
      {s.quote && (
        <p className="mt-3 max-w-[46ch] text-[clamp(13px,1.7svh,16px)] leading-normal text-white/60">
          {s.quote}
        </p>
      )}
    </div>
  );
}

/**
 * @param id  ไอดีของ section — ใช้ผูกกับราวจุดนำสายตาของหน้า
 */
/** ช่วงท้ายของจอ What I Do ที่ใช้ซูมเข้าไปในกล่อง — ต้องตรงกับ --tile-open ใน useSkillStory */
const ZOOM_FROM = 0.92;

export function ExperienceTunnel({ id = "experiences" }: { id?: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const [stop, setStop] = useState(0);
  /** ภาพนิ่งของอุโมงค์ที่ถ่ายไว้ตอนกระจกเริ่มแตก — เนื้อของเศษกระจกทุกชิ้น */
  const [shot, setShot] = useState<string | null>(null);
  /** เลเยอร์ fixed ทั้งชั้น — เลื่อนขึ้นตอนจบเพื่อเลียนแบบ sticky ที่ปล่อยหมุด */
  const layer = useRef<HTMLDivElement>(null);
  /** ชั้นอุโมงค์ที่ถูกครอบด้วยกรอบ — กรอบขยายจากกระเบื้องตัวละครจนเต็มจอ */
  const clip = useRef<HTMLDivElement>(null);
  const story = useRef<HTMLDivElement>(null);
  /** ตัวอ่านค่าล่าสุด — เรียกซ้ำได้จากนอก effect (ดูตอนเลเยอร์เพิ่ง mount) */
  const read = useRef<() => void>(() => {});

  /**
   * อุโมงค์ไม่ได้อยู่ใน section ของตัวเอง แต่เป็นเลเยอร์ fixed ที่ portal ลง body
   *
   * เดิมมันเป็นแคนวาส sticky อยู่ใน section experiences การซูมจึงเริ่มได้เร็วสุดตอน section
   * นั้นขึ้นมา ซึ่งช้าไปหนึ่งจอ: คนดูเลื่อนพ้น What I Do แล้วเจอ "กล่องตัวละคร" อีกใบ
   * (ที่นี่วาดซ้ำเป็นการ์ดเบจ) แล้วค่อยซูม — เห็นเป็นกล่องเดียวกันสองครั้ง
   *
   * เป็นเลเยอร์ลอยแล้วมันเริ่มซูมตั้งแต่ยังอยู่ในจอ What I Do ได้: กรอบ clip เริ่มที่กระเบื้อง
   * ตัวละคร "ตอนกางสุด" ซึ่งยังอยู่บนจอตรงนั้นจริง ๆ แล้วบานเต็มจอในช่วง 8% ท้ายของจอนั้น
   * ไม่ต้องมีการ์ดเบจใบที่สองมาต่อภาพอีก เพราะกล่องต้นทางคือใบจริงที่ยังไม่ทันหายไปไหน
   * ส่วน section experiences เหลือหน้าที่เดียวคือกันที่ scroll (และเป็นหมุดให้ราวจุด)
   */
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    let raf = 0;
    /** กรอบล่าสุดของกระเบื้องตัวละคร — เก็บไว้เผื่อช่วงที่มันหลุดจอไปแล้ว */
    let tile: DOMRect | null = null;

    const measure = () => {
      raf = 0;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const box = el.getBoundingClientRect();

      /** ความคืบหน้าของจอ What I Do — ตัวที่บอกว่าถึงคิวซูมหรือยัง */
      const sc = document.querySelector<HTMLElement>("[data-whatido-scrolly]");
      const scSpan = sc ? sc.getBoundingClientRect().height - vh : 0;
      /**
       * จอเล็กไม่ปักหมุด What I Do (sticky อยู่หลัง lg:) จึงไม่มีช่วงท้ายให้ซูมออกมา
       * ตรงนั้นถอยไปใช้แบบเดิม: ซูมด้วย 20% แรกของ section ตัวเอง ไม่ใช่ไม่ซูมเลย
       *
       * ต้องเช็ค position ของบล็อกลูกจริง ๆ ไม่ใช่แค่ "กรอบสูงกว่าจอ" — บนมือถือกระเบื้อง
       * เรียงลงมาจนกรอบสูงเกินจออยู่ดี แต่ไม่มีการหมุด ค่า pw ที่ได้จึงไม่ใช่ไทม์ไลน์ของการเล่า
       */
      const child = sc?.firstElementChild;
      const pinned =
        scSpan > 0 && !!child && getComputedStyle(child).position === "sticky";
      /** ความคืบหน้าใน section ของตัวเอง — ใช้ตอนไม่มีหมุด */
      const own = Math.min(
        1,
        Math.max(0, -box.top / Math.max(1, box.height - vh)),
      );
      let e = 0;
      if (pinned && sc) {
        const pw = Math.min(
          1,
          Math.max(0, -sc.getBoundingClientRect().top / scSpan),
        );
        const g = Math.min(1, Math.max(0, (pw - ZOOM_FROM) / (1 - ZOOM_FROM)));
        e = g * g * (3 - 2 * g);
      } else {
        const g = Math.min(1, own / 0.2);
        e = g * g * (3 - 2 * g);
      }

      /**
       * ระยะบิน: เริ่มนับตอนกรอบกางเต็มจอ ซึ่งคือตอน section นี้ยังอยู่ใต้จอพอดีหนึ่งวิวพอร์ต
       * (จบ 8% ท้ายของ What I Do = ขอบบนของ section นี้แตะขอบล่างของจอ) ระยะทางทั้งหมด
       * จึงเป็น "หนึ่งวิวพอร์ต + ช่วง sticky ของ section" = ความสูงของ section พอดี
       */
      const flightP = pinned
        ? Math.min(1, Math.max(0, (vh - box.top) / (box.height || 1)))
        : Math.min(1, Math.max(0, (own - 0.2) / 0.8));

      /**
       * ยังไม่ถึงคิว หรือเลยไปแล้ว — ซ่อนอย่างเดียว ห้ามถอดแคนวาสทิ้ง
       *
       * เคยลอง mount/unmount ตามช่วงเพื่อไม่ให้แบก WebGL ทั้งหน้า แต่พัง: แคนวาสที่ถูก
       * สร้างตอนอยู่ในเลเยอร์ portal ไม่เคยถูกวัดขนาด (ค้างที่ 300x150 = ไม่มีเฟรมไหน
       * ถูกวาดเลย) คนดูรูดผ่านแล้วเจอจอน้ำเงินเปล่าแทนอุโมงค์ — เห็นเฉพาะตอนรูดจริง
       * ไม่เจอตอนกระโดดตำแหน่งทีละจุด
       */
      const on = e > 0.0005 && box.bottom > 0;
      if (!on) {
        if (layer.current) layer.current.style.opacity = "0";
        return;
      }

      // กระเบื้องยังอยู่บนจอตอนซูม (จอ What I Do ยังถูกหมุด) วัดสดได้ตรง ๆ
      const node = document.querySelector("[data-mascot-tile]");
      if (node) {
        const n = node.getBoundingClientRect();
        if (n.width > 0 && n.bottom > 0) tile = n;
      }
      const r = tile ?? new DOMRect(vw * 0.34, vh * 0.3, vw * 0.32, vh * 0.4);
      const left = r.left * (1 - e);
      const top = r.top * (1 - e);
      const right = (vw - r.right) * (1 - e);
      const bottom = (vh - r.bottom) * (1 - e);

      if (clip.current) {
        clip.current.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px)`;
      }
      flight.open = e;
      if (layer.current) {
        /**
         * จบ section แล้วเลเยอร์ต้องเลื่อนขึ้นไปพร้อมหน้า ไม่ใช่ค้างเป็น fixed ทับจอถัดไป
         * ระยะที่เลื่อนคือส่วนที่ขอบล่างของ section ขึ้นมาเหนือขอบล่างของจอ — พอ section
         * หลุดจอพอดี เลเยอร์ก็พ้นจอพอดีเหมือนกัน เหมือน sticky ที่ปล่อยหมุด
         */
        layer.current.style.transform = `translateY(${Math.min(0, box.bottom - vh)}px)`;
        // ค่อย ๆ เข้ามาแทนกล่องเบจในช่วงต้นของการซูม ไม่ใช่ตัดภาพทันทีที่เริ่ม
        layer.current.style.opacity = String(Math.min(1, e / 0.18));
      }
      if (story.current) {
        /** เข้าบีตชนแล้วเก็บข้อความ — กลางเฟรมเป็นที่ของตัวละครที่กำลังพุ่งเข้าใส่กระจก */
        const inView = Math.min(1, Math.max(0, (flightP - 0.04) / 0.06));
        const out = Math.min(1, Math.max(0, (flightP - BREAK_FROM) / 0.05));
        story.current.style.opacity = String(inView * (1 - out));
      }

      flight.t = flightP;

      /**
       * บีตสุดท้าย: ตัวละครทะลุกระจกออกมาหาจอถัดไป
       *
       * ทั้งบีตขับด้วยตัวแปร CSS ตัวเดียว (--brk) ที่เขียนลงเลเยอร์ เศษกระจกสิบสี่ชิ้นกับ
       * รอยร้าวอ่านค่าเดียวกันนี้ผ่าน calc() — ไม่ต้องแตะ DOM ทีละชิ้นทุกเฟรม และไม่มี
       * state ของ React ตัวไหนขยับตามการเลื่อนเลย
       */
      const brk = Math.min(1, Math.max(0, (flightP - BREAK_FROM) / (1 - BREAK_FROM)));
      flight.brk = brk;
      if (layer.current) {
        layer.current.style.setProperty("--brk", brk.toFixed(3));
        // แตกแล้วเลเยอร์ต้องจางออกให้เห็นจอ works ที่อยู่ข้างหลัง ไม่ใช่ค้างเป็นแผ่นทึบ
        if (brk > 0.0005) {
          layer.current.style.opacity = String(Math.max(0, 1 - Math.max(0, (brk - 0.62) / 0.38)));
        }
      }
      // ภาพจริงของอุโมงค์ถูกแทนที่ด้วยเศษกระจกตอนแตก — ปล่อยไว้ทั้งคู่จะเห็นเป็นภาพซ้อน
      if (clip.current) clip.current.style.opacity = String(brk > 0.34 ? 0 : 1);

      // หมุดที่ i อยู่ลึก (i+1)/(n+1) ของอุโมงค์ — เล่าถึงมันตั้งแต่ก่อนกล้องจะถึงเล็กน้อย
      let next = 0;
      for (let i = 0; i < STOPS.length; i++) {
        if (flight.t >= (i + 1) / (STOPS.length + 1) - 0.12) next = i;
      }
      setStop((cur) => (cur === next ? cur : next));
    };

    read.current = measure;
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    const onResize = () => {
      tile = null;
      onScroll();
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <>
      {/* section เหลือหน้าที่กันที่ scroll กับเป็นหมุดของราวจุด ภาพทั้งหมดอยู่ในเลเยอร์ลอย */}
      <section
        id={id}
        data-screen={id}
        ref={frame}
        className="relative h-[460svh] w-full"
      />

      {createPortal(
        <div
          ref={layer}
          /* .v3 มาด้วย เพราะเลเยอร์นี้อยู่ใต้ body ไม่ได้อยู่ในหน้า — ตัวแปรสี/ฟอนต์ของ
                 หน้าประกาศไว้ที่คลาสนั้น ถ้าไม่ติดมาด้วย ข้อความจะกลายเป็นดำบนพื้นอุโมงค์ */
          className="v3 pointer-events-none fixed inset-0 z-20 overflow-hidden bg-transparent"
          style={{ opacity: 0 }}
        >
          <div
            ref={clip}
            className="absolute inset-0"
            style={{ clipPath: "inset(0px)" }}
          >
            <Canvas
              aria-hidden
              className="absolute inset-0"
              dpr={[1, 1.5]}
              camera={{ position: [0, 0, 0], fov: FOV_IN, near: 0.1, far: 90 }}
              /* preserveDrawingBuffer: ต้องอ่านพิกเซลกลับหนึ่งเฟรมตอนกระจกแตก (ดู CaptureOnBreak)
                 ถ้าไม่เปิด บัฟเฟอร์ถูกเคลียร์ไปก่อนแล้ว จะได้ภาพดำล้วน */
              gl={{ antialias: true, preserveDrawingBuffer: true }}
            >
              {/* หมอกสีเดียวกับพื้นอุโมงค์ — ปลายอุโมงค์จมหายแทนที่จะถูกตัดเป็นขอบ */}
              <color attach="background" args={["#0b1f5e"]} />
              <fog attach="fog" args={["#0b1f5e", 12, 58]} />
              <ZoomIn />
              <Lights />
              <Tunnel />
              <FloatingMascot />
              <CaptureOnBreak onShot={setShot} />
            </Canvas>
          </div>

          {/*
            กระจกแตก — รอยร้าววิ่งออกจากจุดชนก่อน แล้วเศษถึงปลิวออกไป
            เศษเป็นภาพของอุโมงค์เฟรมสุดท้ายจริง ๆ (ถ่ายไว้ตอนเริ่มบีต) ไม่ใช่แผ่นสี
          */}
          <div className="v3-glass absolute inset-0 z-10" aria-hidden>
            <svg className="v3-crack" viewBox="0 0 100 100" preserveAspectRatio="none">
              {SHARDS.map((s, i) => {
                const rad = (s.a * Math.PI) / 180;
                return (
                  <line
                    key={i}
                    x1="50"
                    y1="50"
                    x2={50 + Math.cos(rad) * 120}
                    y2={50 + Math.sin(rad) * 120}
                  />
                );
              })}
            </svg>
            {shot
              ? SHARDS.map((s, i) => (
                  <div
                    key={i}
                    className="v3-shard"
                    style={
                      {
                        "--a": `${s.a}deg`,
                        "--d": s.delay,
                        clipPath: s.clip,
                        backgroundImage: `url(${shot})`,
                      } as CSSProperties
                    }
                  />
                ))
              : null}
          </div>

          <div
            ref={story}
            style={{ opacity: 0 }}
            className="absolute inset-0 z-20"
          >
            <Story stop={stop} />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
