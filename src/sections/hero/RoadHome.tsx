import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { storySv2 } from '@/sections/skystory/beats'
import { DEVICE, deviceMat, workBeats } from './workMotion'
import { HOME_ICON, roadPhase } from './roadWorld'

/**
 * เรื่องถนน: จอเครื่องกลายเป็นหน้าโฮมของมือถือ (ตาม GIF ref) — wallpaper ไล่ฟ้า ช่องแอปใสเรียงสามคอลัมน์
 * ไอคอนแอปจริงอันเดียวกลางแถวบน = favicon ของเว็บ (/favicon-512.png — แผ่นเดียวกับที่ RoadStage หงายเป็นหลังคา)
 *
 * วาดทับของบนจอเดิม (ไม่เทสต์ความลึก) ในแคนวาสของบนจอเครื่อง · ท่าตาม deviceMat (หน่วยท้องถิ่นของเครื่อง)
 */
const PX = 3
const COLS = 3
const ROWS = 6

export function paintHome() {
  const w = DEVICE.hw * 2
  const h = DEVICE.hh * 2
  const cv = document.createElement('canvas')
  cv.width = w * PX
  cv.height = h * PX
  const g = cv.getContext('2d')!
  g.scale(PX, PX)
  g.beginPath()
  g.roundRect(0, 0, w, h, DEVICE.r)
  g.clip()
  /* wallpaper: ฟ้าสว่างซ้ายล่าง → น้ำเงินเข้มขวาบน */
  const bg = g.createLinearGradient(0, h, w, 0)
  bg.addColorStop(0, '#6fb6ec')
  bg.addColorStop(0.45, '#3a86d4')
  bg.addColorStop(1, '#1a4ea6')
  g.fillStyle = bg
  g.fillRect(0, 0, w, h)
  /* ช่องแอปใส — เว้นช่องกลางแถวบน (ไอคอนจริงวางทับเป็นอีกแผ่น) */
  const s = HOME_ICON.s
  const gap = (w - COLS * s) / (COLS + 1)
  const top = DEVICE.hh - HOME_ICON.y - s / 2
  for (let j = 0; j < ROWS; j++)
    for (let i = 0; i < COLS; i++) {
      if (j === 0 && i === 1) continue
      const x = gap + i * (s + gap)
      const y = top + j * (s + gap * 1.25)
      g.fillStyle = `rgba(255,255,255,${(0.16 + 0.06 * ((i + j) % 2)).toFixed(2)})`
      g.beginPath()
      g.roundRect(x, y, s, s, s * 0.24)
      g.fill()
    }
  /* ติ่งกล้องบนสุด */
  g.fillStyle = '#163a80'
  g.beginPath()
  g.roundRect(w / 2 - 22, 6, 44, 9, 4.5)
  g.fill()
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

const M = new THREE.Matrix4()

export function RoadHome() {
  const g = useRef<THREE.Group>(null)
  const icon = useTexture('/favicon-512.png')
  const res = useMemo(() => {
    icon.colorSpace = THREE.SRGBColorSpace
    icon.anisotropy = 4
    const wall = paintHome()
    const opts = { transparent: true, depthTest: false, depthWrite: false, toneMapped: false }
    return {
      wall,
      plane: new THREE.PlaneGeometry(1, 1),
      wallMat: new THREE.MeshBasicMaterial({ map: wall, ...opts }),
      iconMat: new THREE.MeshBasicMaterial({ map: icon, ...opts }),
    }
  }, [icon])
  useEffect(
    () => () => {
      res.wall.dispose()
      res.plane.dispose()
      res.wallMat.dispose()
      res.iconMat.dispose()
    },
    [res],
  )
  useFrame(() => {
    const gg = g.current
    if (!gg) return
    const story = document.getElementById('what-i-do')
    if (!story || !deviceMat.ok) {
      gg.visible = false
      return
    }
    const b = workBeats(storySv2(Math.max(0, -story.getBoundingClientRect().top / (window.innerHeight || 1))))
    const k = roadPhase(b).home
    gg.visible = k > 0.002
    if (!gg.visible) return
    res.wallMat.opacity = k
    res.iconMat.opacity = k
    gg.matrix.copy(M.fromArray(deviceMat.e))
    gg.matrixWorldNeedsUpdate = true
  })
  return (
    <group ref={g} matrixAutoUpdate={false} visible={false}>
      <mesh geometry={res.plane} material={res.wallMat} scale={[DEVICE.hw * 2, DEVICE.hh * 2, 1]} position={[0, 0, 11]} renderOrder={50} />
      <mesh geometry={res.plane} material={res.iconMat} scale={[HOME_ICON.s, HOME_ICON.s, 1]} position={[HOME_ICON.x, HOME_ICON.y, 11]} renderOrder={51} />
    </group>
  )
}
