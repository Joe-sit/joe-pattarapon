import { useCallback, useState } from 'react'
import { IntroSequence } from '@/components/IntroSequence'

/**
 * หน้าส่องอินโทรเดี่ยว ๆ — เครื่องมือ dev ล้วน (route ถูกกั้นด้วย import.meta.env.DEV)
 *
 * ที่ต้องมีหน้าแยกเพราะบน /2026 อินโทรวางทับหน้าจริงที่กำลังโหลดฉาก 3D อยู่ด้วย
 * เวลาเปิดหน้านั้นซ้ำ ๆ เพื่อดูจังหวะเดียวจึงต้องรอทั้งฉากโหลดทุกครั้ง และพอมันปิดตัวเอง
 * ก็จะถูกถอดออกจนส่องต่อไม่ได้ ที่นี่ไม่มีอะไรอยู่ข้างหลังเลย
 *
 * `ready` เป็น false ตลอด: อินโทรจะรอฉากข้างหลังจนหมดเวลา (READY_TIMEOUT) แทนที่จะ
 * ปิดตัวเองทันทีที่ประกอบเสร็จ — ได้เวลาส่องเฟรมท้าย ๆ โดยไม่ต้องรีบกด hold
 *
 * ปุ่ม replay รีเมานต์ด้วยการเปลี่ยน key ไทม์ไลน์กับสนามอักขระจึงเริ่มใหม่จริง ๆ
 * ไม่ใช่แค่ seek กลับไปที่ศูนย์ (ซึ่งไม่รีเซ็ตสถานะที่สะสมในแคนวาส)
 */
export function IntroSandbox() {
  const [run, setRun] = useState(0)
  const replay = useCallback(() => setRun((n) => n + 1), [])

  return (
    <main className="fixed inset-0 z-9998">
      <IntroSequence key={run} onDone={replay} ready={false} />

      {/* วางไว้มุมขวาล่าง — แผงดีบักของอินโทรเองอยู่มุมซ้ายล่าง จะได้ไม่ทับกัน */}
      <button
        type="button"
        onClick={replay}
        className="fixed right-3 bottom-3 z-10001 cursor-pointer rounded border border-[#2a3340] bg-[#060910]/90 px-3 py-1.5 font-mono text-[11px] text-[#cfd6e0]"
      >
        replay
      </button>
    </main>
  )
}
