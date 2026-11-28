import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FaviconScene, loadFaviconSettings } from '@/pages/FaviconLab'

/**
 * ภาพหน้า favicon แบบเต็มจอเครื่อง (แนวตั้ง) — ปั้นครั้งเดียวจากฉากเดียวกับ favicon (FaviconScene + ค่าที่จูนใน /favicon-lab)
 * แล้วส่งเป็นแคนวาสให้จอเครื่อง (./BenchScreen) ทำเป็นเรื่องเล่า: Research = โครงเส้น · Design = ลงสี · Code = แสง echo ไหล
 *
 *   color  ภาพสีจริง (ชั้น echo ครบ)
 *   idx    แผนที่ชิ้น (ช่องแดง): 0 = พื้น · 20·k = ชั้น echo ที่ k (1 = ในสุด) · 230 = หน้า (ผิว) · 240 = ตา · 250 = ผม (ส่วนมืดของหัว)
 *   pivot  กลางหัว (uv ของภาพ — y ชี้ขึ้น) — จุดอ้างอิงตอนประกอบร่าง
 *   eyes   กรอบตาแต่ละข้าง [cx, cy, ครึ่งกว้าง, ครึ่งสูง] (uv) — กระพริบตา · skin = สีผิวเฉลี่ย (เปลือกตาตอนหลับ)
 *          ได้จากการวาดซ้ำทีละชั้น (echoN 0 → N) แล้วดูว่าพิกเซลไหนเปลี่ยนตอนเพิ่มชั้นที่ k — ไม่ต้องเดาจากสี
 *
 * วาดที่ 512 × 1024 (สัดส่วนจอเครื่อง) · มุมกล้องแนวนอนเท่า favicon (fov แนวตั้งขยายตามสัดส่วน) — หัวกว้างเท่าเดิม มีที่ว่างบน/ล่างให้ชั้น echo
 */
export const faceShot: {
  color: HTMLCanvasElement | null
  idx: HTMLCanvasElement | null
  n: number
  palette: string[]
  pivot: [number, number]
  eyes: [number, number, number, number][]
  skin: string
  ver: number
} = {
  color: null,
  idx: null,
  pivot: [0.5, 0.5],
  eyes: [],
  skin: '#e8b49c',
  n: 0,
  palette: [],
  ver: 0,
}

const W = 512
const H = 1024
/** ตำแหน่งหัวบนจอ (สัดส่วนจากซ้าย / จากล่าง) — มุมซ้ายล่างแบบ favicon ชั้น echo กวาดขึ้นไปขวาบน */
const HEAD_X = 0.3
const HEAD_Y = 0.2
/** ชั้น echo โตต่อชั้นมากกว่า favicon — จอสูงสองเท่า ชั้นนอกสุดต้องถึงขอบบน */
const ECHO_GROW = 2.4
/** รอโมเดลตัวละครโหลด + ภาพนิ่งกี่เฟรมก่อนเริ่มเก็บ */
const SETTLE = 30
/** ต่างกันเกินเท่านี้ (ผลรวม RGB) = พิกเซลเปลี่ยน */
const DIFF = 36

type S = ReturnType<typeof loadFaviconSettings>

function Grabber({ s, onDone }: { s: S; onDone: () => void }) {
  const st = useRef({ f: 0, k: -1, prev: null as Uint8ClampedArray | null })
  const work = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    return { c, ctx: c.getContext('2d', { willReadFrequently: true }), idx: new Uint8ClampedArray(W * H) }
  }, [])
  const head = useRef<THREE.Object3D | null>(null)
  const n = Math.min(8, s.echoN, s.colors.length)
  useFrame(({ gl, scene }) => {
    /* เอาแค่หัว (แบบ FastworkHead3D) — กล้องแนวตั้งเห็นลงไปถึงตัว */
    if (!head.current) scene.traverse((o) => {
      if (o.name === 'HeadGroup') head.current = o
    })
    const hg = head.current
    if (hg) {
      const keep = new Set<THREE.Object3D>()
      hg.traverse((o) => keep.add(o))
      let root: THREE.Object3D = hg
      while (root.parent && root.parent.type !== 'Scene') root = root.parent
      root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && !keep.has(o)) o.visible = false
      })
    }
    const t = st.current
    const ctx = work.ctx
    if (!ctx) return
    if (t.k < 0) {
      if (hg && ++t.f > SETTLE) {
        t.k = 0
        s.echoN = 0
      }
      return
    }
    /* เฟรมนี้วาดด้วย echoN = k แล้ว (Echo อ่าน s ทุกเฟรมก่อน CameraFX วาด) — เก็บ แล้วตั้งชั้นถัดไปให้เฟรมหน้า */
    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(gl.domElement, 0, 0, W, H)
    const px = ctx.getImageData(0, 0, W, H).data
    if (t.k === 0) {
      const bg = new THREE.Color(s.bg)
      const br = Math.round(bg.r * 255)
      const bgG = Math.round(bg.g * 255)
      const bb = Math.round(bg.b * 255)
      /* ตัวละคร = ต่างจากพื้น · แยกส่วนมืด (ผม/ตา) กับผิว — ประกอบร่างทีละชิ้น */
      let sx = 0
      let sy = 0
      let cnt = 0
      for (let i = 0; i < W * H; i++) {
        const r = px[i * 4]
        const g = px[i * 4 + 1]
        const bl = px[i * 4 + 2]
        const d = Math.abs(r - br) + Math.abs(g - bgG) + Math.abs(bl - bb)
        if (d <= DIFF) {
          work.idx[i] = 0
          continue
        }
        /* มืดและเทา (ผม/ตา) — ผิวด้านเงาก็มืดแต่อมน้ำตาล (อิ่มสีกว่า) ไม่นับ */
        work.idx[i] = 0.299 * r + 0.587 * g + 0.114 * bl < 85 && Math.max(r, g, bl) - Math.min(r, g, bl) < 40 ? 250 : 230
        sx += i % W
        sy += Math.floor(i / W)
        cnt++
      }
      if (cnt) faceShot.pivot = [sx / cnt / W, 1 - sy / cnt / H]
      /* ตา = ก้อนมืดเล็ก ๆ ที่ผิวล้อมรอบ (ผมก็มืดแต่ติดขอบ/พื้น) — แยกเป็นชิ้น 240 ให้กระพริบได้ */
      const seen = new Uint8Array(W * H)
      const comps: { px: number[]; box: [number, number, number, number] }[] = []
      const q: number[] = []
      for (let i0 = 0; i0 < W * H; i0++) {
        if (work.idx[i0] !== 250 || seen[i0]) continue
        const list: number[] = []
        let skinN = 0
        let edgeN = 0
        let x0 = W
        let y0 = H
        let x1 = 0
        let y1 = 0
        q.length = 0
        q.push(i0)
        seen[i0] = 1
        while (q.length && list.length < 6000) {
          const i = q.pop() as number
          list.push(i)
          const x = i % W
          const y = (i - x) / W
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
          for (const j of [i - 1, i + 1, i - W, i + W]) {
            if (j < 0 || j >= W * H) continue
            const v = work.idx[j]
            if (v === 250) {
              if (!seen[j]) {
                seen[j] = 1
                q.push(j)
              }
            } else {
              edgeN++
              if (v === 230) skinN++
            }
          }
        }
        /* ทรงตา: ไม่ใช่เส้นยาวบาง (ขอบเงา/รอยต่อ) — กว้างพอ สูงไม่เกิน 4 เท่าของกว้าง */
        const bw = x1 - x0 + 1
        const bh = y1 - y0 + 1
        if (list.length > 20 && list.length < W * H * 0.01 && edgeN > 0 && skinN / edgeN > 0.75 && bw >= 8 && bh <= bw * 4) comps.push({ px: list, box: [x0, y0, x1, y1] })
      }
      comps.sort((a, b) => b.px.length - a.px.length)
      faceShot.eyes = comps.slice(0, 2).map(({ px: list, box: [x0, y0, x1, y1] }) => {
        for (const i of list) work.idx[i] = 240
        return [(x0 + x1 + 1) / 2 / W, 1 - (y0 + y1 + 1) / 2 / H, (x1 - x0 + 1) / 2 / W, (y1 - y0 + 1) / 2 / H] as [number, number, number, number]
      })
    } else if (t.prev) {
      for (let i = 0; i < W * H; i++) {
        if (work.idx[i]) continue
        const d = Math.abs(px[i * 4] - t.prev[i * 4]) + Math.abs(px[i * 4 + 1] - t.prev[i * 4 + 1]) + Math.abs(px[i * 4 + 2] - t.prev[i * 4 + 2])
        if (d > DIFF) work.idx[i] = 20 * t.k
      }
    }
    t.prev = px
    if (t.k < n) {
      t.k++
      s.echoN = t.k
      return
    }
    /* ชั้นครบ = ภาพสีจริง */
    const color = document.createElement('canvas')
    color.width = W
    color.height = H
    color.getContext('2d')?.drawImage(gl.domElement, 0, 0, W, H)
    /* สีผิวเฉลี่ย (เปลือกตาตอนหลับ) */
    let sr = 0
    let sg = 0
    let sb = 0
    let sn = 0
    for (let i = 0; i < W * H; i++) {
      if (work.idx[i] !== 230) continue
      sr += px[i * 4]
      sg += px[i * 4 + 1]
      sb += px[i * 4 + 2]
      sn++
    }
    if (sn) faceShot.skin = `rgb(${Math.round(sr / sn)}, ${Math.round(sg / sn)}, ${Math.round(sb / sn)})`
    const ic = document.createElement('canvas')
    ic.width = W
    ic.height = H
    const ictx = ic.getContext('2d')
    if (ictx) {
      const img = ictx.createImageData(W, H)
      for (let i = 0; i < W * H; i++) {
        img.data[i * 4] = work.idx[i]
        img.data[i * 4 + 3] = 255
      }
      ictx.putImageData(img, 0, 0)
    }
    faceShot.color = color
    faceShot.idx = ic
    faceShot.n = n
    faceShot.palette = s.colors.slice(0, n)
    faceShot.ver++
    onDone()
  }, 2)
  return null
}

/** แคนวาสนอกจอชั่วคราว: ปั้นภาพแล้วถอดตัวเอง (คืน context) — เริ่มหลังหน้าแรกโหลดนิ่งแล้ว */
export function FaceShotMaker() {
  const [go, setGo] = useState(false)
  const [done, setDone] = useState(() => !!faceShot.color)
  useEffect(() => {
    if (done) return
    const id = window.setTimeout(() => setGo(true), 2500)
    return () => window.clearTimeout(id)
  }, [done])
  const s = useMemo(() => {
    const v = loadFaviconSettings()
    /* fov แนวตั้งของแคนวาส 1:2 ที่ได้มุมแนวนอนเท่า favicon (1:1) */
    const fov = (2 * Math.atan(Math.tan((v.fov * Math.PI) / 360) * (H / W)) * 180) / Math.PI
    /*
     * หัวไปมุมซ้ายล่าง (HEAD_X, HEAD_Y) แบบ favicon: แพนกล้อง (เลื่อนจุดเล็งตามแกนขวา/ขึ้นของกล้อง)
     * หัวใน favicon อยู่ที่จุดหมุน echo (cx, cy ของภาพจัตุรัส) — ในภาพแนวตั้งก่อนแพน แกนตั้งย่อลงครึ่ง (มุมแนวตั้งกว้างขึ้นสองเท่า)
     * หลังแพน จุดหมุน echo = ตำแหน่งหัวใหม่ · ชั้น echo โตต่อชั้น × ECHO_GROW ให้กวาดถึงขอบบน
     */
    const halfW = v.dist * Math.tan((v.fov * Math.PI) / 360)
    const halfH = v.dist * Math.tan((fov * Math.PI) / 360)
    const dx = HEAD_X - v.cx
    const dy = HEAD_Y - (0.5 + (v.cy - 0.5) * (W / H))
    const r = new THREE.Vector3(Math.cos(v.yaw), 0, -Math.sin(v.yaw))
    const f = new THREE.Vector3(Math.sin(v.yaw) * Math.cos(v.pitch), Math.sin(v.pitch), Math.cos(v.yaw) * Math.cos(v.pitch)).negate()
    const u = new THREE.Vector3().crossVectors(r, f).normalize()
    const pan = r.multiplyScalar(-dx * 2 * halfW).add(u.multiplyScalar(-dy * 2 * halfH))
    return { ...v, fov, tx: v.tx + pan.x, ty: v.ty + pan.y, tz: v.tz + pan.z, cx: HEAD_X, cy: HEAD_Y, echoGrow: v.echoGrow * ECHO_GROW, colors: [...v.colors] }
  }, [])
  if (done || !go) return null
  return (
    <div aria-hidden style={{ position: 'fixed', left: -10000, top: 0, width: W, height: H, pointerEvents: 'none' }}>
      <Canvas dpr={1} gl={{ antialias: true, preserveDrawingBuffer: true }} camera={{ fov: s.fov, near: 0.05, far: 60 }} style={{ width: W, height: H }}>
        <FaviconScene s={s} />
        <Grabber s={s} onDone={() => setDone(true)} />
      </Canvas>
    </div>
  )
}
