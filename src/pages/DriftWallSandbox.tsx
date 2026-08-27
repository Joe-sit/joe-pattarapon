import DriftWall from '@/components/DriftWall'

/**
 * หน้าดู DriftWall เฉย ๆ — เครื่องมือ dev ล้วน ไม่ได้ต่อกับหน้าจริง
 *
 * รูปเป็น picsum: อยู่ได้เพราะหน้านี้ไม่ขึ้น production (route ถูกกั้นด้วย import.meta.env.DEV)
 * ตอนต่อของจริงที่ Health Dashboards ต้องใช้สกรีนช็อตงานจริงเท่านั้น — ดูฟิลด์ `wall` ใน WORKS
 *
 * ค่าที่ตั้งไว้คือชุดเดียวกับที่จะใช้จริง จะได้ตัดสินใจจากของที่เห็นตรงกัน
 */
const PREVIEW = [1015, 1025, 1039, 1043, 1044, 1050, 1062, 1069, 1074, 1080, 1084, 106, 110, 133, 164].map(
  (id) => ({ image: `https://picsum.photos/id/${id}/600/400`, title: `Tile ${id}` }),
)

export function DriftWallSandbox() {
  return (
    <main className="min-h-screen bg-[#060010] p-8 text-white">
      <p className="mb-4 font-mono text-sm text-white/60">
        DriftWall — dev preview เท่านั้น (รูป picsum ไม่ใช่ผลงานจริง)
      </p>
      <div style={{ height: 600 }}>
        <DriftWall
          items={PREVIEW}
          columns={5}
          tileWidth={200}
          tileHeight={132}
          gap={18}
          tilt={16}
          turn={-14}
          perspective={1200}
          depth={120}
          speed={42}
          direction="up"
          variance={0.45}
          parallax={0.6}
          lift={64}
          fade={0.6}
          dim={0.55}
          overlayColor="#060010"
        />
      </div>
    </main>
  )
}
