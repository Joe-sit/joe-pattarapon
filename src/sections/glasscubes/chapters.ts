import { SKILLS } from '@/sections/whatido/WhatIDo'

/** คำอธิบายสกิลจริง (Research ยังเป็น Lorem รอเขียน — ไม่แสดง) */
const desc = (t: string) => {
  const s = SKILLS.find((k) => k.title === t)
  return s && t !== 'Research' ? s.desc : ''
}

/**
 * บทของเรื่อง (สัดส่วนระยะเลื่อน) · skill = กล่องของสกิลไหนยกตัวออกมาในบทนั้น (ลำดับใน SKILL_CUBES ของฉาก)
 */
export const CHAPTERS = [
  { at: 0.0, len: 0.16, kicker: '01 — Pieces', title: 'Every product starts in pieces.', body: '', skill: -1 },
  { at: 0.2, len: 0.14, kicker: '02 — Assemble', title: 'Pieces only matter once they fit.', body: '', skill: -1 },
  { at: 0.38, len: 0.14, kicker: '03 — Design', title: 'UX/UI', body: desc('Design'), skill: 0 },
  { at: 0.54, len: 0.14, kicker: '04 — Coding', title: 'Coding', body: desc('Coding'), skill: 1 },
  { at: 0.7, len: 0.12, kicker: '05 — Research', title: 'Research', body: desc('Research'), skill: 2 },
  { at: 0.86, len: 0.14, kicker: '06 — Built', title: 'Built piece by piece.', body: '', skill: -1 },
] as const

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
export function chapterOf(p: number, c: (typeof CHAPTERS)[number]) {
  const last = c === CHAPTERS[CHAPTERS.length - 1]
  return Math.min(clamp01((p - c.at) / 0.03), last ? 1 : clamp01((c.at + c.len - p) / 0.03))
}
/** น้ำหนักการยกตัวของกล่องสกิล i ณ ระยะ p (0..1) */
export function liftOf(p: number, i: number) {
  const c = CHAPTERS.find((x) => x.skill === i)
  if (!c) return 0
  return Math.min(clamp01((p - c.at + 0.02) / 0.05), clamp01((c.at + c.len + 0.01 - p) / 0.05))
}
