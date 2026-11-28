import logoSit from '@/assets/v2/logo-sit.png'
import logoKmutt from '@/assets/v2/logo-kmutt.png'
import bmsOffice from '@/assets/v2/bms-office.png'

/**
 * ไทม์ไลน์เส้นทางงาน (comp 12563:216-244)
 *
 * `at` = ป้ายแท็บข้างล่าง ส่วน `role`/`org` คือหมุดบนเส้น — หมุดสุดท้ายเป็นปัจจุบัน
 * จึงยังไม่มีข้อความกำกับในคอมพ์ เส้นหลังหมุดนั้นเป็นสีเทา (ยังไม่ถึง)
 */
export type Stop = {
  at: string
  role: string
  org: string
  /** เนื้อการ์ดของช่วงนั้น — มีเฉพาะช่วงที่มีของจริง ไม่มีก็ปล่อยว่าง ไม่แต่งขึ้นมา */
  credential?: string
  logos?: { src: string; alt: string }[]
  quote?: string
  photo?: { src: string; alt: string }
}

export const JOURNEY: Stop[] = [
  {
    at: '@SIT',
    role: 'B.Sc. Information Technology',
    org: 'Second Class Honors',
    credential: 'B.Sc. Information Technology',
    logos: [
      { src: logoSit, alt: 'School of Information Technology' },
      { src: logoKmutt, alt: 'KMUTT' },
    ],
    quote: 'This valuable 4 years gave me a solid foundation of software development.',
    photo: { src: bmsOffice, alt: 'บรรยากาศห้องประชุมของทีม' },
  },
  { at: '@APPMAN', role: 'Internship UX/UI Designer', org: 'AppMan Co,. Ltd.' },
  { at: '@BMS', role: 'Full-time UX/UI Designer', org: 'Bangkok Medical Software Co,. Ltd.' },
]

