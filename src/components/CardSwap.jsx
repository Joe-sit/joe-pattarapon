import { Children, cloneElement, createRef, forwardRef, isValidElement, useEffect, useMemo, useRef } from 'react'
import gsap from 'gsap'
import './cardswap.css'

/**
 * CardSwap ของ reactbits (https://reactbits.dev/components/card-swap) — พอร์ตมาให้เข้ากับที่นี่
 *
 * ต่างจากต้นทาง:
 * - คลาสมี prefix `v2-` ทั้งหมด ต้นทางใช้ชื่อ `.card` ลอย ๆ ซึ่งชนกับอะไรก็ได้ในโปรเจกต์
 * - ขนาดรับเป็นค่า CSS อะไรก็ได้ (ดีฟอลต์ 100%) ต้นทางบังคับเป็น px — ที่นี่กรอบโชว์งาน
 *   ยืดตาม viewport อยู่แล้ว ถ้าล็อก px ไว้การ์ดจะไม่ตามกรอบ
 * - เก็บกวาดตอน unmount: kill timeline + tween ของทุกใบ ไม่ใช่แค่ clearInterval
 *   (ต้นทางปล่อย tween ค้าง ถ้า component ถูกถอดกลางทางจะมี tween วิ่งบน DOM ที่ตายแล้ว)
 * - เคารพ prefers-reduced-motion: วางการ์ดเป็นชั้น ๆ ไว้เฉย ๆ ไม่สลับ
 */
/** @type {import('react').ForwardRefExoticComponent<import('react').HTMLAttributes<HTMLDivElement> & import('react').RefAttributes<HTMLDivElement>>} */
export const Card = forwardRef(({ className, ...rest }, ref) => (
  <div ref={ref} {...rest} className={`v2-swap-card ${className ?? ''}`.trim()} />
))
Card.displayName = 'Card'

const makeSlot = (i, distX, distY, total) => ({
  x: i * distX,
  y: -i * distY,
  z: -i * distX * 1.5,
  zIndex: total - i,
})

const placeNow = (el, slot, skew) =>
  gsap.set(el, {
    x: slot.x,
    y: slot.y,
    z: slot.z,
    xPercent: -50,
    yPercent: -50,
    skewY: skew,
    transformOrigin: 'center center',
    zIndex: slot.zIndex,
    force3D: true,
  })

export function CardSwap({
  width = '100%',
  height = '100%',
  cardDistance = 60,
  verticalDistance = 70,
  delay = 5000,
  pauseOnHover = false,
  onCardClick = undefined,
  skewAmount = 6,
  easing = 'elastic',
  children,
}) {
  const config =
    easing === 'elastic'
      ? {
          ease: 'elastic.out(0.6,0.9)',
          durDrop: 2,
          durMove: 2,
          durReturn: 2,
          promoteOverlap: 0.9,
          returnDelay: 0.05,
        }
      : {
          ease: 'power1.inOut',
          durDrop: 0.8,
          durMove: 0.8,
          durReturn: 0.8,
          promoteOverlap: 0.45,
          returnDelay: 0.2,
        }

  const childArr = useMemo(() => Children.toArray(children), [children])
  const refs = useMemo(() => childArr.map(() => createRef()), [childArr.length])

  const order = useRef(Array.from({ length: childArr.length }, (_, i) => i))
  const tlRef = useRef(null)
  const intervalRef = useRef(undefined)
  const container = useRef(null)

  useEffect(() => {
    const total = refs.length
    const els = refs.map((r) => r.current).filter(Boolean)
    els.forEach((el, i) => placeNow(el, makeSlot(i, cardDistance, verticalDistance, total), skewAmount))

    // ไม่สลับให้ถ้าผู้ใช้ขอลดการเคลื่อนไหว — การ์ดยังซ้อนกันสวยเหมือนเดิม แค่นิ่ง
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const swap = () => {
      if (order.current.length < 2) return
      const [front, ...rest] = order.current
      const elFront = refs[front].current
      if (!elFront) return

      const tl = gsap.timeline()
      tlRef.current = tl

      tl.to(elFront, { y: '+=500', duration: config.durDrop, ease: config.ease })
      tl.addLabel('promote', `-=${config.durDrop * config.promoteOverlap}`)

      rest.forEach((idx, i) => {
        const el = refs[idx].current
        if (!el) return
        const slot = makeSlot(i, cardDistance, verticalDistance, refs.length)
        tl.set(el, { zIndex: slot.zIndex }, 'promote')
        tl.to(
          el,
          { x: slot.x, y: slot.y, z: slot.z, duration: config.durMove, ease: config.ease },
          `promote+=${i * 0.15}`,
        )
      })

      const backSlot = makeSlot(refs.length - 1, cardDistance, verticalDistance, refs.length)
      tl.addLabel('return', `promote+=${config.durMove * config.returnDelay}`)
      tl.call(() => gsap.set(elFront, { zIndex: backSlot.zIndex }), undefined, 'return')
      tl.to(
        elFront,
        { x: backSlot.x, y: backSlot.y, z: backSlot.z, duration: config.durReturn, ease: config.ease },
        'return',
      )
      tl.call(() => {
        order.current = [...rest, front]
      })
    }

    swap()
    intervalRef.current = window.setInterval(swap, delay)

    const node = container.current
    const pause = () => {
      tlRef.current?.pause()
      clearInterval(intervalRef.current)
    }
    const resume = () => {
      tlRef.current?.play()
      intervalRef.current = window.setInterval(swap, delay)
    }
    if (pauseOnHover && node) {
      node.addEventListener('mouseenter', pause)
      node.addEventListener('mouseleave', resume)
    }

    return () => {
      clearInterval(intervalRef.current)
      if (pauseOnHover && node) {
        node.removeEventListener('mouseenter', pause)
        node.removeEventListener('mouseleave', resume)
      }
      tlRef.current?.kill()
      tlRef.current = null
      gsap.killTweensOf(els)
    }
  }, [cardDistance, verticalDistance, delay, pauseOnHover, skewAmount, easing, refs, config.durDrop, config.durMove, config.durReturn, config.ease, config.promoteOverlap, config.returnDelay])

  const rendered = childArr.map((child, i) =>
    isValidElement(child)
      ? cloneElement(child, {
          key: i,
          ref: refs[i],
          style: { width, height, ...child.props.style },
          onClick: (e) => {
            child.props.onClick?.(e)
            onCardClick?.(i)
          },
        })
      : child,
  )

  return (
    <div ref={container} className="v2-cardswap" style={{ width, height }}>
      {rendered}
    </div>
  )
}
