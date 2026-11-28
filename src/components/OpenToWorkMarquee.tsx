import { BODY_TEXT } from '@/pages/portfolio2026.tokens'

/**
 * แถบ Open to work คั่นหน้า — marquee เลื่อนไม่รู้จบ เต็มความกว้างจอ (comp 12546:158910)
 *
 * เนื้อในซ้ำสองชุด แล้วเลื่อน -50% วนลูป: รอยต่อจึงเนียนทุกขนาดจอ (คีย์เฟรมอยู่ที่
 * .v2-marquee ใน portfolio2026.css)
 *
 * ห่อ .v2-theme มาในตัวเอง เพราะจุดกลมท้ายข้อความใช้ --v2-green ซึ่งประกาศที่คลาสนั้น
 * ไม่ใช่ :root — หน้า /2026-final ที่ไม่ได้อยู่ในธีมนี้จึงเรียกใช้ได้เหมือนกัน
 */
const STRIPES = [
  ['#c25200', 'text-white'],
  ['#5a3bf7', 'text-white'],
  ['#62ed83', 'text-black'],
  ['#bba00f', 'text-black'],
] as const

export function OpenToWorkMarquee({ className = '' }: { className?: string }) {
  return (
    <div className={`v2-theme overflow-hidden ${className}`} aria-hidden>
      <div className="v2-marquee">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex">
            {STRIPES.map(([bg, tone]) => (
              <p
                key={bg}
                className={`flex h-[clamp(2.75rem,3.75vw,3.4rem)] w-[clamp(15rem,26vw,23.5rem)] items-center justify-center gap-2 ${BODY_TEXT} font-medium ${tone}`}
                style={{ background: bg }}
              >
                Open to work
                <span className="inline-block size-[0.85em] rounded-full bg-[var(--v2-green)]" />
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
