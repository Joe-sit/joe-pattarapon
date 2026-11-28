// พอร์ตจาก reactbits.dev/text-animations/ascii-text (ต้นทางพอร์ตจาก codepen JuanFuentes)
// ปรับ: ไม่ patch Math.map ลง global, เพิ่มโหมดสีทึบ (gradient + mix-blend difference ของเดิม
// ออกแบบมาสำหรับพื้นเข้ม บนพื้นสว่างสีเพี้ยน), ตัวหนังสือปรับสีผ่าน prop

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const vertexShader = `
varying vec2 vUv;
uniform float uTime;
uniform float mouse;
uniform float uEnableWaves;

void main() {
    vUv = uv;
    float time = uTime * 5.;

    float waveFactor = uEnableWaves;

    vec3 transformed = position;

    transformed.x += sin(time + position.y) * 0.5 * waveFactor;
    transformed.y += cos(time + position.z) * 0.15 * waveFactor;
    transformed.z += sin(time + position.x) * waveFactor;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
}
`

const fragmentShader = `
varying vec2 vUv;
uniform float mouse;
uniform float uTime;
uniform sampler2D uTexture;

void main() {
    float time = uTime;
    vec2 pos = vUv;

    float r = texture2D(uTexture, pos + cos(time * 2. - time + pos.x) * .01).r;
    float g = texture2D(uTexture, pos + tan(time * .5 + pos.x - time) * .01).g;
    float b = texture2D(uTexture, pos - cos(time * 2. + time + pos.y) * .01).b;
    float a = texture2D(uTexture, pos).a;
    gl_FragColor = vec4(r, g, b, a);
}
`

const mapRange = (n, start, stop, start2, stop2) =>
  ((n - start) / (stop - start)) * (stop2 - start2) + start2

const PX_RATIO = typeof window !== 'undefined' ? window.devicePixelRatio : 1

class AsciiFilter {
  constructor(renderer, { fontSize, fontFamily, charset, invert } = {}) {
    this.renderer = renderer
    this.domElement = document.createElement('div')
    this.domElement.style.position = 'absolute'
    this.domElement.style.top = '0'
    this.domElement.style.left = '0'
    this.domElement.style.width = '100%'
    this.domElement.style.height = '100%'

    this.pre = document.createElement('pre')
    this.domElement.appendChild(this.pre)

    this.canvas = document.createElement('canvas')
    this.context = this.canvas.getContext('2d')
    this.domElement.appendChild(this.canvas)

    this.deg = 0
    this.invert = invert ?? true
    this.fontSize = fontSize ?? 12
    this.fontFamily = fontFamily ?? "'Courier New', monospace"
    this.charset =
      charset ?? ' .\'`^",:;Il!i~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$'

    this.context.imageSmoothingEnabled = false

    this.onMouseMove = this.onMouseMove.bind(this)
    document.addEventListener('mousemove', this.onMouseMove)
  }

  setSize(width, height) {
    this.width = width
    this.height = height
    this.renderer.setSize(width, height)
    this.reset()

    this.center = { x: width / 2, y: height / 2 }
    this.mouse = { x: this.center.x, y: this.center.y }
  }

  reset() {
    this.context.font = `${this.fontSize}px ${this.fontFamily}`
    const charWidth = this.context.measureText('A').width

    this.cols = Math.floor(this.width / (this.fontSize * (charWidth / this.fontSize)))
    this.rows = Math.floor(this.height / this.fontSize)

    this.canvas.width = this.cols
    this.canvas.height = this.rows
    this.pre.style.fontFamily = this.fontFamily
    this.pre.style.fontSize = `${this.fontSize}px`
  }

  render(scene, camera) {
    this.renderer.render(scene, camera)

    const w = this.canvas.width
    const h = this.canvas.height
    this.context.clearRect(0, 0, w, h)
    if (this.context && w && h) {
      this.context.drawImage(this.renderer.domElement, 0, 0, w, h)
    }

    this.asciify(this.context, w, h)
  }

  onMouseMove(e) {
    this.mouse = { x: e.clientX * PX_RATIO, y: e.clientY * PX_RATIO }
  }

  asciify(ctx, w, h) {
    if (!w || !h) return
    const imgData = ctx.getImageData(0, 0, w, h).data
    let str = ''
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = x * 4 + y * 4 * w
        const [r, g, b, a] = [imgData[i], imgData[i + 1], imgData[i + 2], imgData[i + 3]]

        if (a === 0) {
          str += ' '
          continue
        }

        const gray = (0.3 * r + 0.6 * g + 0.1 * b) / 255
        let idx = Math.floor((1 - gray) * (this.charset.length - 1))
        if (this.invert) idx = this.charset.length - idx - 1
        str += this.charset[idx]
      }
      str += '\n'
    }
    this.pre.textContent = str
  }

  dispose() {
    document.removeEventListener('mousemove', this.onMouseMove)
  }
}

class CanvasTxt {
  constructor(txt, { fontSize = 200, fontFamily = 'Arial', color = '#fdf9f3' } = {}) {
    this.canvas = document.createElement('canvas')
    this.context = this.canvas.getContext('2d')
    this.txt = txt
    this.fontSize = fontSize
    this.fontFamily = fontFamily
    this.color = color

    this.font = `600 ${this.fontSize}px ${this.fontFamily}`
  }

  resize() {
    this.context.font = this.font
    const metrics = this.context.measureText(this.txt)

    // ขอบกันเหลื่อมนิดเดียวพอ (fragment shader เขย่า uv ~1%) — ขอบหนาทำให้ตัวหนังสือ
    // ไม่แนบขอบ plane แล้วก้นไม่บรรจบกับ EXPERIENCES
    const textWidth = Math.ceil(metrics.width) + 8
    const textHeight =
      Math.ceil(metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) + 8

    this.canvas.width = textWidth
    this.canvas.height = textHeight
  }

  render() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.context.fillStyle = this.color
    this.context.font = this.font

    const metrics = this.context.measureText(this.txt)
    const yPos = 4 + metrics.actualBoundingBoxAscent

    this.context.fillText(this.txt, 4, yPos)
  }

  get width() {
    return this.canvas.width
  }

  get height() {
    return this.canvas.height
  }

  get texture() {
    return this.canvas
  }
}

class CanvAscii {
  constructor(
    { text, asciiFontSize, textFontSize, textColor, planeBaseHeight, enableWaves, followCursor },
    containerElem,
    width,
    height,
  ) {
    this.textString = text
    this.asciiFontSize = asciiFontSize
    this.textFontSize = textFontSize
    this.textColor = textColor
    this.planeBaseHeight = planeBaseHeight
    this.container = containerElem
    this.width = width
    this.height = height
    this.enableWaves = enableWaves
    this.followCursor = followCursor

    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 1, 1000)
    this.camera.position.z = 30

    this.scene = new THREE.Scene()
    this.mouse = { x: this.width / 2, y: this.height / 2 }

    this.onMouseMove = this.onMouseMove.bind(this)
  }

  async init() {
    try {
      await document.fonts.load('600 200px "IBM Plex Mono"')
      await document.fonts.load('500 12px "IBM Plex Mono"')
    } catch {
      // โหลดฟอนต์ไม่ได้ก็ใช้ fallback
    }
    await document.fonts.ready

    this.setMesh()
    this.setRenderer()
  }

  setMesh() {
    this.textCanvas = new CanvasTxt(this.textString, {
      fontSize: this.textFontSize,
      fontFamily: 'IBM Plex Mono',
      color: this.textColor,
    })
    this.textCanvas.resize()
    this.textCanvas.render()

    this.texture = new THREE.CanvasTexture(this.textCanvas.texture)
    this.texture.minFilter = THREE.NearestFilter

    const [planeW, planeH] = this.planeSize()
    this.geometry = new THREE.PlaneGeometry(planeW, planeH, 36, 36)
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        mouse: { value: 1.0 },
        uTexture: { value: this.texture },
        uEnableWaves: { value: this.enableWaves ? 1.0 : 0.0 },
      },
    })

    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.scene.add(this.mesh)
  }

  setRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true })
    this.renderer.setPixelRatio(1)
    this.renderer.setClearColor(0x000000, 0)

    this.filter = new AsciiFilter(this.renderer, {
      fontFamily: 'IBM Plex Mono',
      fontSize: this.asciiFontSize,
      invert: true,
    })

    this.container.appendChild(this.filter.domElement)
    this.setSize(this.width, this.height)

    if (this.followCursor) {
      this.container.addEventListener('mousemove', this.onMouseMove)
      this.container.addEventListener('touchmove', this.onMouseMove)
    }
  }

  // ขนาด plane ที่พอดีเต็ม frustum ของกล้อง — ตัวหนังสือยืดเต็มกรอบทั้งกว้าง/สูง
  // (ไม่รักษา aspect ของ texture เพื่อให้ก้นตัวอักษรบรรจบขอบล่างของ cell เสมอ)
  planeSize() {
    const h = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
    return [h * this.camera.aspect, h]
  }

  setSize(w, h) {
    this.width = w
    this.height = h

    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()

    if (this.mesh) {
      const [planeW, planeH] = this.planeSize()
      this.mesh.geometry.dispose()
      this.mesh.geometry = new THREE.PlaneGeometry(planeW, planeH, 36, 36)
    }

    this.filter.setSize(w, h)

    this.center = { x: w / 2, y: h / 2 }
  }

  load() {
    this.animate()
  }

  onMouseMove(evt) {
    const e = evt.touches ? evt.touches[0] : evt
    const bounds = this.container.getBoundingClientRect()
    this.mouse = { x: e.clientX - bounds.left, y: e.clientY - bounds.top }
  }

  animate() {
    const animateFrame = () => {
      this.animationFrameId = requestAnimationFrame(animateFrame)
      this.render()
    }
    animateFrame()
  }

  render() {
    const time = new Date().getTime() * 0.001

    this.textCanvas.render()
    this.texture.needsUpdate = true

    this.mesh.material.uniforms.uTime.value = Math.sin(time)

    this.updateRotation()
    this.filter.render(this.scene, this.camera)
  }

  updateRotation() {
    if (!this.followCursor) return
    const x = mapRange(this.mouse.y, 0, this.height, 0.5, -0.5)
    const y = mapRange(this.mouse.x, 0, this.width, -0.5, 0.5)

    this.mesh.rotation.x += (x - this.mesh.rotation.x) * 0.05
    this.mesh.rotation.y += (y - this.mesh.rotation.y) * 0.05
  }

  clear() {
    this.scene.traverse((obj) => {
      if (obj.isMesh && typeof obj.material === 'object' && obj.material !== null) {
        Object.keys(obj.material).forEach((key) => {
          const matProp = obj.material[key]
          if (matProp !== null && typeof matProp === 'object' && typeof matProp.dispose === 'function') {
            matProp.dispose()
          }
        })
        obj.material.dispose()
        obj.geometry.dispose()
      }
    })
    this.scene.clear()
  }

  dispose() {
    cancelAnimationFrame(this.animationFrameId)
    if (this.filter) {
      this.filter.dispose()
      if (this.filter.domElement.parentNode) {
        this.container.removeChild(this.filter.domElement)
      }
    }
    this.container.removeEventListener('mousemove', this.onMouseMove)
    this.container.removeEventListener('touchmove', this.onMouseMove)
    this.clear()
    if (this.renderer) {
      this.renderer.dispose()
      this.renderer.forceContextLoss()
    }
  }
}

export function AsciiText({
  text = 'VISION',
  asciiFontSize = 20,
  textFontSize = 200,
  textColor = '#fdf9f3',
  planeBaseHeight = 8,
  enableWaves = true,
  /** เอียง plane ตามเมาส์แบบต้นฉบับ — ปิดไว้ ให้เหลือแค่คลื่น */
  followCursor = false,
  /** สีตัวอักษร ascii บนจอ — ทึบ อ่านชัดบนพื้นสว่าง (ของเดิมใช้ gradient + difference สำหรับพื้นเข้ม) */
  color = '#1868db',
}) {
  const containerRef = useRef(null)
  const asciiRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    let cancelled = false
    let observer = null
    let ro = null

    const createAndInit = async (container, w, h) => {
      const instance = new CanvAscii(
        { text, asciiFontSize, textFontSize, textColor, planeBaseHeight, enableWaves, followCursor },
        container,
        w,
        h,
      )
      await instance.init()
      return instance
    }

    const setup = async () => {
      const { width, height } = containerRef.current.getBoundingClientRect()

      if (width === 0 || height === 0) {
        // ยังไม่มีขนาด (ถูกซ่อน/ยังไม่ layout) — รอโผล่ค่อยสร้าง
        observer = new IntersectionObserver(
          async ([entry]) => {
            if (cancelled) return
            if (entry.isIntersecting && entry.boundingClientRect.width > 0) {
              const { width: w, height: h } = entry.boundingClientRect
              observer.disconnect()
              observer = null
              if (!cancelled) {
                asciiRef.current = await createAndInit(containerRef.current, w, h)
                if (!cancelled && asciiRef.current) asciiRef.current.load()
              }
            }
          },
          { threshold: 0.1 },
        )
        observer.observe(containerRef.current)
        return
      }

      asciiRef.current = await createAndInit(containerRef.current, width, height)
      if (!cancelled && asciiRef.current) {
        asciiRef.current.load()

        ro = new ResizeObserver((entries) => {
          if (!entries[0] || !asciiRef.current) return
          const { width: w, height: h } = entries[0].contentRect
          if (w > 0 && h > 0) asciiRef.current.setSize(w, h)
        })
        ro.observe(containerRef.current)
      }
    }

    setup()

    return () => {
      cancelled = true
      if (observer) observer.disconnect()
      if (ro) ro.disconnect()
      if (asciiRef.current) {
        asciiRef.current.dispose()
        asciiRef.current = null
      }
    }
  }, [text, asciiFontSize, textFontSize, textColor, planeBaseHeight, enableWaves, followCursor])

  return (
    <div
      ref={containerRef}
      className="ascii-text-container"
      style={{ position: 'absolute', inset: 0, '--ascii-color': color }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&display=swap');

        .ascii-text-container canvas {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          image-rendering: pixelated;
          visibility: hidden;
        }

        .ascii-text-container pre {
          margin: 0;
          user-select: none;
          padding: 0;
          line-height: 1em;
          text-align: left;
          position: absolute;
          left: 0;
          top: 0;
          color: var(--ascii-color);
          z-index: 9;
        }
      `}</style>
    </div>
  )
}
