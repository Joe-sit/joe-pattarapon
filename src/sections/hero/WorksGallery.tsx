import { forwardRef } from 'react'
import { STORY_FONT } from './workMotion'
import mrImg from '@/assets/portfolios/MODRIDE.png'
import ekycImg from '@/assets/portfolios/eKyc.png'
import caseKeeperImg from '@/assets/portfolios/case-keeper.png'
import dipChipImg from '@/assets/portfolios/dip-chip.png'
import hotelKioskImg from '@/assets/portfolios/hotel-kiosk.png'
import eBookImg from '@/assets/portfolios/Ebook2.jpg'
import oasipImg from '@/assets/portfolios/oasip.png'
import abcImg from '@/assets/portfolios/abcWishYourGrade.png'
import customerImg from '@/assets/portfolios/customer-personality-analysis.png'
import waterMapImg from '@/assets/portfolios/water-map.png'
import portWebImg from '@/assets/portfolios/first-portfolio-web.png'
import ricardoImg from '@/assets/portfolios/ricardo-game.png'

/**
 * ผลงานจริง — ชื่อ หมวด บรรทัดรอง ยกมาจากหน้า Portfolio ของเว็บเวอร์ชัน Vue (git 777c118^ components/views/PortfolioPage.vue)
 * ลำดับตามของเดิม · ratio = สัดส่วนช่องภาพ (กว้าง/สูง) ไว้ทำ masonry ให้แถวไม่เท่ากัน (ภาพจริงทุกรูปราว 16:9 — ครอปกลาง)
 */
export const WORKS = [
  { name: 'MOD RIDE - Ride Sharing in KMUTT', category: 'UX/UI', sub: 'Capstone Project 2023 - 2024', img: mrImg, ratio: 0.8 },
  { name: 'eKYC Web Application', category: 'UX/UI', sub: 'UX/UI Design Internship 2023', img: ekycImg, ratio: 1.25 },
  { name: 'Case Keeper Dashboard', category: 'UX/UI', sub: 'UX/UI Design Internship 2023', img: caseKeeperImg, ratio: 1 },
  { name: 'Dip Chip Rider', category: 'UX/UI', sub: 'UX/UI Design Internship 2023', img: dipChipImg, ratio: 0.72 },
  { name: 'Hotel Check-in Kiosk', category: 'UX/UI', sub: 'UX/UI Design Internship 2023', img: hotelKioskImg, ratio: 1.1 },
  { name: 'e-Book & Scratch Game', category: 'Other', sub: 'The Philosophy of Sufficiency Economy Project 2023', img: eBookImg, ratio: 0.85 },
  { name: 'OASIP', category: 'Web Dev', sub: 'IT Integrated Project 2022', img: oasipImg, ratio: 1.3 },
  { name: 'ABCWishYourGrade', category: 'Web Dev', sub: 'Client-side Web Programming Project 2022', img: abcImg, ratio: 0.9 },
  { name: 'Customer Personality Analytics', category: 'Other', sub: 'Statistics for IT Project 2021', img: customerImg, ratio: 1.2 },
  { name: 'WaterMap', category: 'UX/UI', sub: 'User Experience Design Project 2020', img: waterMapImg, ratio: 0.78 },
  { name: 'Portfolio Website', category: 'Web Dev', sub: 'Web Technology Project 2020', img: portWebImg, ratio: 1.15 },
  { name: 'Ricardo Your Hero', category: 'Other', sub: 'Scratch Game Dev 2019', img: ricardoImg, ratio: 0.95 },
] as const

/**
 * Gallery ผลงาน (ปลายทางของ section My Works ใน What I do) — แผงสีเข้มเลื่อนขึ้นจากล่างตามสกรอลล์ 1:1 ทับฉากห้อย
 * (WorkStory ตั้ง transform ทุกเฟรม) · หัวข้อ + masonry การ์ด: ภาพเต็มใบ ชื่อกับป้ายลอยบนแถบมืดด้านล่าง
 * ยังไม่มีหน้ารายละเอียด — การ์ดจึงยังไม่ใช่ลิงก์ (ไม่มี cursor pointer)
 */
export const WorksGallery = forwardRef<HTMLDivElement>(function WorksGallery(_, ref) {
  return (
    <div ref={ref} className="pointer-events-none fixed inset-x-0 top-0 z-[54] will-change-transform" style={{ visibility: 'hidden' }} aria-label="Selected Work">
      <div className="min-h-[100svh] rounded-t-[clamp(20px,3vw,40px)] bg-[#0c0c10] px-[clamp(16px,3vw,48px)] pt-[clamp(72px,13vh,140px)] pb-[12vh] text-white">
        <h2 className="text-center text-[clamp(40px,6.4vw,104px)] leading-[0.95] font-bold tracking-[-0.045em]" style={{ fontFamily: STORY_FONT }}>
          My Works
        </h2>
        <div className="mx-auto mt-[clamp(32px,7vh,80px)] max-w-[1400px] columns-1 gap-[clamp(10px,1.2vw,16px)] sm:columns-2 lg:columns-4">
          {WORKS.map((w) => (
            <article key={w.name} className="relative mb-[clamp(10px,1.2vw,16px)] break-inside-avoid overflow-hidden rounded-[14px] bg-white/5">
              <img src={w.img} alt={w.name} loading="lazy" decoding="async" className="block w-full object-cover" style={{ aspectRatio: String(w.ratio) }} />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-3 pt-10 pb-3">
                <h3 className="text-[15px] leading-tight font-semibold">{w.name}</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[w.category, w.sub].map((t) => (
                    <span key={t} className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
})
