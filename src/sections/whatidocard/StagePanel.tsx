import {
  IconAppWindow,
  IconPhoto,
  IconStack2,
  IconToggleRight,
  IconUser,
  IconWindow,
} from '@tabler/icons-react'
import { TunerPanel, type TunerGroup, type TunerRow } from '@/components/TunerPanel'
import { DEFAULTS, resetStageTuner, setStageTuner, useStageTuner } from './stageTuner'

/**
 * แผงจูนจอ "สิ่งที่ทำ" (dev) — ผังของคีย์ ตัว UI อยู่ที่ components/TunerPanel
 *
 * เดิมไฟล์นี้ถือสำเนาของ UI ทั้งชุดไว้เอง (กล่อง กลุ่มพับได้ สไลเดอร์ ปุ่มคัดลอก) ซึ่งเป็น
 * สำเนาที่สามของ UI เดียวกัน — แก้ท่าใช้ทีเดียวไม่ได้ ต้องไล่แก้ทุกไฟล์แล้วหวังว่าจะไม่ลืม
 * ตอนนี้เหลือแค่ผังว่าคีย์ไหนอยู่กลุ่มไหน ช่วงเท่าไร หน่วยคืออะไร
 *
 * จอนี้ถูก *ซ่อน* อยู่ (ดู pages/Portfolio2026FinalPage) แผงจึงยังไม่ถูก mount — เก็บไว้
 * ให้พร้อมใช้ทันทีที่สลับ import กลับ
 */

/** แถวของหน้าต่างหนึ่งใบ — ที่วาง ขนาด และการหันรอบแกนตั้ง */
function win(p: 'w1' | 'w2' | 'w3' | 'w4'): TunerRow[] {
  return [
    [`${p}x`, -8, 8, 0.05, 'เลื่อน ←→'],
    [`${p}y`, -6, 6, 0.05, 'เลื่อน ↑↓'],
    [`${p}z`, -10, 6, 0.05, 'ลึก / ตื้น'],
    [`${p}s`, 0.2, 1.4, 0.01, '× ขนาด'],
    [`${p}ry`, -45, 45, 0.5, '° หันซ้าย/ขวา'],
  ]
}

/**
 * กลุ่มตาม "ของที่กำลังขยับ" — หน้าต่างใบละกลุ่ม บวกกลุ่มสวิตช์
 *
 * บานที่ 1 คือใบพอร์ทัล (ใบกลางที่มีช่องทะลุ) ขยับได้เหมือนใบอื่น แต่กรอบของมันคือปลายทาง
 * ของท่า genie จากจอก่อนหน้า (CARD ใน sections/hero/ScrollTell) — ขยับแล้วรอยต่อสองจอ
 * จะไม่ตรง ต้องไปวัดกรอบใหม่แล้วแก้ค่าคู่นั้นตาม
 */
const GROUPS: TunerGroup[] = [
  { name: 'บาน 1 · พอร์ทัล', icon: IconAppWindow, rows: win('w1') },
  { name: 'บาน 2 · หลังซ้าย', icon: IconWindow, rows: win('w2') },
  { name: 'บาน 3 · หลังขวา', icon: IconWindow, rows: win('w3') },
  { name: 'บาน 4 · หน้า', icon: IconStack2, rows: win('w4') },
  {
    name: 'ตัวละคร',
    icon: IconUser,
    rows: [
      ['chRotY', -180, 180, 1, '° หันซ้าย/ขวา'],
      ['chRotZ', -90, 90, 1, '° เอียงข้าง (แก้ท่าเอียงของริก)'],
      ['chRotX', -60, 60, 1, '° ก้ม/เงย'],
      ['chHeadYaw', -60, 60, 1, '° หัวหันต่อจากลำตัว'],
      ['chHeadPitch', -30, 30, 1, '° หัวก้ม/เงย'],
      ['chHeadRoll', -30, 30, 1, '° หัวเอียง'],
      ['chScale', 0.5, 4, 0.02, '× ขนาด'],
      ['chX', -8, 8, 0.05, 'เลื่อน ←→'],
      ['chY', -16, 4, 0.05, 'เลื่อน ↑↓ (ลบ = จมลง เหลือครึ่งบน)'],
      ['chZ', -10, 6, 0.05, 'ลึก / ตื้น'],
    ],
  },
  {
    name: 'รูปจริง (รอยสาด)',
    icon: IconPhoto,
    rows: [
      ['phZoom', 0.2, 2, 0.005, '× ความกว้างเทียบเฟรม'],
      ['phX', -1, 1, 0.002, 'เยื้อง ←→'],
      ['phY', -1, 1, 0.002, 'เยื้อง ↑↓'],
    ],
  },
  {
    name: 'สวิตช์',
    icon: IconToggleRight,
    rows: [
      ['char', 0, 1, 1, 'ตัวละคร'],
      ['replica', 0, 1, 1, 'ฉากหลังในจอ (ทุ่งหญ้า)'],
      ['hoop', 0, 1, 1, 'ห่วงส้ม'],
      ['skills', 0, 1, 1, 'ของสกิล (แว่น/ถาดสี/สวิตช์)'],
    ],
  },
]

export function StagePanel() {
  const t = useStageTuner() as Record<string, number>
  return (
    <TunerPanel
      title="จอ “สิ่งที่ทำ”"
      icon={IconStack2}
      panelKey="whatidocard.panel.v1"
      groups={GROUPS}
      defaults={DEFAULTS}
      values={t}
      set={setStageTuner}
      reset={resetStageTuner}
    />
  )
}

export default StagePanel
