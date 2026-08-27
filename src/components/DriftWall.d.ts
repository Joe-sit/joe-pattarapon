import type { CSSProperties } from 'react'

/**
 * ประกาศชนิดให้ DriftWall.jsx (พอร์ตจาก reactbits — ไฟล์ต้นทางเป็น JS ล้วน)
 *
 * ถ้าไม่มีไฟล์นี้ TS จะเดาชนิดจากค่า default ในตัวคอมโพเนนต์ แล้วล็อก href เป็น undefined
 * (เพราะ DEFAULT_ITEMS ตั้ง href: undefined ไว้) ส่งลิงก์จริงเข้าไปไม่ได้เลย
 */
export type DriftWallItem = {
  image: string
  title?: string
  href?: string
}

export type DriftWallProps = {
  items?: DriftWallItem[]
  columns?: number
  tileWidth?: number
  tileHeight?: number
  gap?: number
  radius?: number
  tilt?: number
  turn?: number
  roll?: number
  perspective?: number
  depth?: number
  speed?: number
  direction?: 'up' | 'down'
  variance?: number
  parallax?: number
  pauseOnHover?: boolean
  lift?: number
  fade?: number
  dim?: number
  grayscale?: boolean
  overlayColor?: string
  className?: string
  style?: CSSProperties
}

declare const DriftWall: (props: DriftWallProps) => JSX.Element

export default DriftWall
