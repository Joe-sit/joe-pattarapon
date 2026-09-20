import {
  IconBracketsContain,
  IconClockBolt,
  IconLayoutDistributeHorizontal,
  IconSparkles,
  IconUser,
} from '@tabler/icons-react'
import { TunerPanel, type TunerGroup } from '@/components/TunerPanel'
import {
  DEFAULTS,
  resetWhatIDoTuner,
  setWhatIDoTuner,
  useWhatIDoTuner,
} from './whatidoTuner'

/**
 * แผงจูนจอ "สิ่งที่ทำ" (dev) — หน้าตาและท่าใช้ชุดเดียวกับแผงอื่นของงานนี้
 *
 * ตัว UI อยู่ที่ components/TunerPanel ตัวเดียวที่ทุกจอใช้ร่วมกัน ที่นี่มีแค่ *ผัง* ว่าคีย์ไหน
 * อยู่กลุ่มไหน ช่วงเท่าไร และหน่วยคืออะไร — เพิ่มคีย์ใน ./whatidoTuner แล้วมาเพิ่มแถวที่นี่
 *
 * หน่วยมีสองแบบ อ่านให้ตรง: **จังหวะเป็นเท่าของความสูงจอ** (เลื่อนลงกี่จอ) ส่วน **ผังเป็น %
 * ของกรอบแบบ** 1440×779 ไม่ใช่ % ของจอผู้ชม (กรอบถูกย่อแบบ contain ให้พอดีจอ) ยกเว้น
 * `keep` ที่เป็น % ของจอจริง เพราะมันคือเส้นที่แบ่งจอเป็นซ้าย-ขวา
 *
 * แผงยืนฝั่งซ้าย (ค่าปริยาย) เพราะแผงกล้องของฉากจอแรกยืนฝั่งขวาอยู่แล้ว — สองแผงเปิดพร้อม
 * กันได้บ่อย ถ้าอยู่ฝั่งเดียวกันมันทับกันจนลากไม่ได้ (เจอมาแล้วบนจอ)
 */

const GROUPS: TunerGroup[] = [
  {
    name: 'จังหวะ (เท่าของจอ)',
    icon: IconClockBolt,
    rows: [
      ['inSpan', 0.1, 1.5, 0.01, 'ช่วงพาของเข้าที่'],
      ['hold', 0, 1.5, 0.01, 'ยืนนิ่งให้ดูผังก่อนเล่าสกิล'],
      ['step', 0.3, 2, 0.01, 'ต่อสกิลหนึ่งใบ (บล็อกกางออก)'],
      ['tail', 0, 1.5, 0.01, 'นิ่งก่อนท่าปิดจอ'],
    ],
  },
  {
    name: 'ท่าเข้าฉาก (github)',
    icon: IconSparkles,
    rows: [
      ['apFade', 60, 600, 10, 'ms · ความทึบ (มาก่อนการเคลื่อน)'],
      ['apDur', 200, 1400, 20, 'ms · ระยะเวลาวิ่งเข้าที่'],
      ['apStep', 0, 80, 1, 'ms · ไล่ต่อคอลัมน์'],
      ['apShift', 0, 60, 0.5, '% กรอบ · ระยะวิ่ง (ซ้าย→ขวา, วงเล็บสวนทาง)'],
    ],
  },
  {
    name: 'ตัวละครในกรอบรูป',
    icon: IconUser,
    rows: [
      ['figTurn', -180, 180, 1, '° หันตัว (ลบ = หันซ้าย)'],
      ['figFill', 0.4, 1.6, 0.01, '× สูงกี่ส่วนของกรอบ'],
      ['figAnchor', 0, 1, 0.01, 'ยืนค่อนขึ้น/ลงในกรอบ (0.5 = กลาง)'],
    ],
  },
  {
    name: 'วงเล็บส้ม · สัญลักษณ์',
    icon: IconBracketsContain,
    rows: [
      ['brSplit', 0, 1, 0.01, 'เส้นแบ่งหน้า/หลัง — ช่องที่หัวโผล่พ้น'],
      ['markSize', 20, 100, 1, '% ของบล็อก · ขนาดสัญลักษณ์'],
    ],
  },
]

export function WhatIDoPanel() {
  const t = useWhatIDoTuner() as unknown as Record<string, number>
  return (
    <TunerPanel
      title="จอ สิ่งที่ทำ"
      icon={IconLayoutDistributeHorizontal}
      panelKey="whatido.panel.v1"
      groups={GROUPS}
      defaults={DEFAULTS as unknown as Record<string, number>}
      values={t}
      set={setWhatIDoTuner as (patch: Record<string, number>) => void}
      reset={resetWhatIDoTuner}
    />
  )
}

export default WhatIDoPanel
