/**
 * ทะเบียนริกที่อยู่บนจอ — ใช้เฉพาะตอน dev
 *
 * ตัวส่งออก (ดู newhero/rigExport) ต้องหยิบ "กลุ่มรากของ mascot ตัวที่เห็นอยู่" มาอ่านเรขาคณิต
 * ซึ่งเป็น ref ในตัวคอมโพเนนต์ ไม่มีทางเข้าถึงจากแผงจูนที่อยู่นอก Canvas ได้ตรง ๆ
 *
 * เป็น Set ไม่ใช่ตัวแปรตัวเดียว เพราะบางหน้ามี mascot มากกว่าหนึ่งตัว (hero + การ์ด
 * what-i-do + พอร์ทัล) ถ้าเก็บตัวเดียวอันที่ mount ทีหลังจะทับอันของฉากหลัก
 *
 * เก็บตามลำดับที่ mount และไม่ถือ ref ค้างหลัง unmount — ไม่งั้นส่งออกได้กลุ่มที่หลุดจาก
 * ฉากไปแล้ว (matrixWorld ค้างที่เฟรมสุดท้าย)
 */
const roots = new Set()

/** เรียกตอน mount/unmount ของ mascot — คืนฟังก์ชันถอนทะเบียน */
export function registerRig(obj) {
  if (!obj) return () => {}
  roots.add(obj)
  return () => roots.delete(obj)
}

/** ริกทุกตัวที่อยู่บนจอ เรียงตามลำดับที่ mount */
export function listRigs() {
  return [...roots]
}
