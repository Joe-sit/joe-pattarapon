/**
 * สายพาด "Open to work" — ที่คั่นระหว่างจอ hero กับจอถัดไปของ /2026-final
 *
 * ไม่ใช่แถบแนวนอนเต็มความกว้างแบบหน้า /2026 (ดู OpenToWorkMarquee) แต่เป็นริบบิ้นที่พาด
 * เฉียงข้ามเฟรมแล้วโดนขอบตัดทั้งสองข้าง — อ่านเป็นของที่วางทับหน้าอยู่ ไม่ใช่บล็อกที่ต่อกัน
 *
 * ตัวสายกว้างเกินกรอบ (140%) เพราะพอหมุนแล้วปลายทั้งสองข้างจะหดเข้ามาจากมุม ถ้ากว้างเท่ากรอบ
 * จะเห็นหัวสายลอยอยู่กลางอากาศแทนที่จะพุ่งออกนอกเฟรม
 *
 * ข้อความเลื่อนไม่รู้จบด้วย .v2-marquee ตัวเดียวกับแถบของหน้า /2026 (เนื้อในสองชุด เลื่อน -50%)
 */

/** ซ้ำหลายชุดในหนึ่ง copy — สายยาวกว่าเฟรมมาก ชุดเดียวไม่พอปูให้เต็มตอนเลื่อน */
const REPEAT = 6

export function OpenToWorkSash({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative w-full overflow-hidden py-[clamp(2rem,5vw,4.5rem)] ${className}`}
      aria-hidden
    >
      <div className="w-[140%] -translate-x-[14%] -rotate-[7deg] overflow-hidden bg-[var(--v3-orange)] shadow-[0_18px_40px_-24px_rgba(0,0,0,0.55)]">
        <div className="v2-marquee">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex">
              {Array.from({ length: REPEAT }, (_, i) => (
                <p
                  key={i}
                  className="flex shrink-0 items-center gap-[0.5em] px-[clamp(1.25rem,2.4vw,2.5rem)] py-[clamp(0.6rem,1.15vw,1.1rem)] text-[clamp(0.9rem,1.5vw,1.35rem)] font-semibold tracking-[0.06em] whitespace-nowrap text-white uppercase"
                >
                  {/* เครื่องหมายคำพูดของแบบ: กล่องเอียงคู่หนึ่ง ไม่ใช่ตัวอักษร " ที่ฟอนต์ไหนก็วาดคนละทรง */}
                  <span className="flex gap-[0.18em]">
                    <span className="block h-[0.62em] w-[0.2em] skew-x-[-16deg] bg-white" />
                    <span className="block h-[0.62em] w-[0.2em] skew-x-[-16deg] bg-white" />
                  </span>
                  Open to work
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
