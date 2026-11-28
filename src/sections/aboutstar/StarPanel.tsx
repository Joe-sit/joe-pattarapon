import {
  IconClockBolt,
  IconPalette,
  IconSparkles,
  IconToggleRight,
  IconUser,
} from '@tabler/icons-react'
import { TunerPanel, type TunerGroup } from '@/components/TunerPanel'
import { DEFAULTS, resetStarTuner, setStarTuner, useStarTuner } from './starTuner'

/**
 * แผงจูนจอ About (dev) — หน้าตาและท่าใช้ชุดเดียวกับแผงอื่นของงานนี้
 *
 * ตัว UI อยู่ที่ components/TunerPanel ตัวเดียวที่ทุกจอใช้ร่วมกัน ที่นี่มีแค่ *ผัง* ว่าคีย์ไหน
 * อยู่กลุ่มไหน ช่วงเท่าไร และหน่วยคืออะไร — เพิ่มคีย์ใหม่ใน ./starTuner แล้วมาเพิ่มแถวที่นี่
 *
 * ค่าไหลถึงฉากทุกครั้งที่ลาก เพราะแผงเขียนลงสโตร์ตรง ๆ และฉากอ่านผ่าน useSyncExternalStore
 */

const GROUPS: TunerGroup[] = [
  {
    name: 'ดาว · รูปร่าง',
    icon: IconSparkles,
    rows: [
      ['sRx', 1, 8, 0.05, 'ครึ่งกว้าง'],
      ['sRy', 1, 8, 0.05, 'ครึ่งสูง'],
      ['sX', -8, 8, 0.05, 'เลื่อน ←→'],
      ['sY', -5, 5, 0.05, 'เลื่อน ↑↓'],
      ['sDepth', 0, 3, 0.02, 'ความหนา (0 = แผ่นแบน)'],
      ['sYaw', -60, 60, 1, '° หันซ้าย/ขวา'],
      ['sPitch', -60, 60, 1, '° ก้ม/เงย'],
      ['sRoll', -45, 45, 1, '° หมุนบนจอ — หน้ากากรอยสาดตามไม่ได้ (ดู starTuner)'],
    ],
  },
  {
    name: 'ดาว · สี',
    icon: IconPalette,
    rows: [
      ['sHue', 0, 360, 1, '° วรรณะหลัก'],
      ['sHueSpan', -90, 90, 1, '° หมุนวรรณะจากแฉกล่างไปแฉกบน'],
      ['sHueSide', -60, 60, 1, '° เอียงวรรณะตามแกนซ้าย-ขวา'],
      ['sSat', 0, 1, 0.01, 'ความอิ่มสี'],
      ['sLightLow', 0, 1, 0.01, 'ความสว่างที่แฉกล่าง'],
      ['sLightTop', 0, 1, 0.01, 'ความสว่างที่แฉกบน'],
      ['sGloss', 0.02, 1, 0.01, 'ผิวด้าน (ต่ำ = ลื่น มีไฮไลต์)'],
      ['sGlow', 0, 0.6, 0.01, 'เรืองในตัวเอง'],
    ],
  },
  {
    name: 'ตัวละคร',
    icon: IconUser,
    rows: [
      ['cX', -8, 8, 0.05, 'เลื่อน ←→'],
      ['cY', -8, 8, 0.05, 'เลื่อน ↑↓'],
      ['cZ', -10, 12, 0.05, 'ลึก / ตื้น'],
      ['cScale', 0.3, 3, 0.01, '× ขนาด'],
      ['cCut', -1, 1, 0.01, 'เส้นแบ่งใน/นอก — สัดส่วนของครึ่งความสูงดาว'],
      ['cHeadYaw', -60, 60, 1, '° หัวหันซ้าย/ขวา'],
      ['cHeadPitch', -30, 30, 1, '° หัวก้ม/เงย'],
      ['cHeadRoll', -30, 30, 1, '° หัวเอียง'],
    ],
  },
  {
    name: 'จังหวะเข้าฉาก',
    icon: IconClockBolt,
    rows: [
      ['bFrom', 0, 1, 0.01, '× ขนาดดาวตอนเริ่ม'],
      ['bSpan', 0.1, 1.5, 0.01, 'ช่วงที่ดาวใช้ขยาย'],
      ['cDelay', 0, 1, 0.01, 'ตัวละครช้ากว่าดาวเท่าไร'],
      ['cSpan', 0.1, 1.5, 0.01, 'ช่วงที่ตัวละครใช้ขึ้น'],
      ['cLift', 0, 16, 0.1, 'ยกลงไปใต้ดาวกี่หน่วยตอนยังไม่เริ่ม'],
    ],
  },
  {
    name: 'สวิตช์',
    icon: IconToggleRight,
    rows: [
      ['swStar', 0, 1, 1, 'ตัวดาว (ปิดแล้วหน้ากากยังทำงาน)'],
      ['swChar', 0, 1, 1, 'ตัวละคร'],
      ['swHeadOnly', 0, 1, 1, 'เหลือแต่หัว (ปิด = ตัวเต็ม)'],
      ['swCut', 0, 1, 1, 'เส้นแบ่งใน/นอกแบบมองเห็น'],
    ],
  },
]

export function StarPanel() {
  const t = useStarTuner() as Record<string, number>
  return (
    <TunerPanel
      title="จอ About · ดาว"
      icon={IconSparkles}
      panelKey="aboutstar.panel.v1"
      groups={GROUPS}
      defaults={DEFAULTS}
      values={t}
      set={setStarTuner}
      reset={resetStarTuner}
    />
  )
}

export default StarPanel
