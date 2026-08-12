import { useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Grid, OrbitControls } from '@react-three/drei'
import { Leva, useControls, button, folder } from 'leva'
import * as THREE from 'three'
import { FigmaToolbar, TOOLBAR_DEFAULTS } from './scene/Panels'
import './toolbar-workspace.css'

const D = TOOLBAR_DEFAULTS

/** ไฟชุดเดียวกับฉาก hero — ปั้นทรงแล้วเห็นแสงตกแบบเดียวกับที่จะไปอยู่จริง */
function Lights() {
  return (
    <>
      <ambientLight intensity={0.95} color="#FFE4D2" />
      <hemisphereLight args={['#FFDDC0', '#7BA184', 0.7]} />
      <directionalLight
        castShadow
        position={[1.5, 8.5, -13]}
        intensity={2.6}
        color="#FFD9A8"
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.05}
      />
      <directionalLight position={[-5, 4, 13]} intensity={1.0} color="#FFDFC8" />
      <directionalLight position={[-11, 2, -2]} intensity={0.3} color="#D9C8FF" />
    </>
  )
}

export default function ToolbarWorkspace() {
  const [copied, setCopied] = useState('')
  // อ่านค่าปัจจุบันตอนกดปุ่มเท่านั้น — ไม่ต้อง re-render ทุกครั้งที่ลากสไลเดอร์
  const live = useRef(D)

  const params = useControls({
    ทรงแท่ง: folder({
      bodyW: { value: D.bodyW, min: 1, max: 8, step: 0.05, label: 'กว้าง' },
      bodyH: { value: D.bodyH, min: 0.3, max: 3, step: 0.02, label: 'สูง' },
      bodyRadius: { value: D.bodyRadius, min: 0, max: 1.5, step: 0.01, label: 'มุมมน' },
      bodyDepth: { value: D.bodyDepth, min: 0.02, max: 1, step: 0.01, label: 'ความหนา' },
      bodyBevel: { value: D.bodyBevel, min: 0, max: 0.2, step: 0.005, label: 'ลบเหลี่ยม' },
      bendR: { value: D.bendR, min: 2, max: 80, step: 0.5, label: 'รัศมีดัดโค้ง' },
    }),
    ปุ่มเครื่องมือ: folder({
      tileSize: { value: D.tileSize, min: 0.1, max: 1.2, step: 0.01, label: 'ขนาด' },
      tileRadius: { value: D.tileRadius, min: 0, max: 0.5, step: 0.005, label: 'มุมมน' },
      tileDepth: { value: D.tileDepth, min: 0.01, max: 0.5, step: 0.005, label: 'ความนูน' },
      tileBevel: { value: D.tileBevel, min: 0, max: 0.1, step: 0.0025, label: 'ลบเหลี่ยม' },
      tileLift: { value: D.tileLift, min: 0, max: 0.6, step: 0.005, label: 'ลอยเหนือผิวแท่ง' },
      tileGap: { value: D.tileGap, min: 0.2, max: 1.5, step: 0.01, label: 'ระยะห่าง' },
      tileStart: { value: D.tileStart, min: -3, max: 0, step: 0.01, label: 'จุดเริ่มซ้าย' },
      hoverScale: { value: D.hoverScale, min: 1, max: 1.6, step: 0.01, label: 'ขยายตอน hover' },
      pressDepth: { value: D.pressDepth, min: 0, max: 1, step: 0.05, label: 'ระยะจมตอนกด' },
    }),
    สี: folder({
      bodyColor: { value: D.bodyColor, label: 'แท่ง' },
      tileColor: { value: D.tileColor, label: 'ปุ่ม' },
      activeColor: { value: D.activeColor, label: 'ปุ่ม active' },
    }),
    'คัดลอกค่า → TOOLBAR_DEFAULTS': button(() => {
      const json = JSON.stringify(live.current, null, 2)
      navigator.clipboard?.writeText(json)
      setCopied(json)
    }),
  })

  live.current = params

  const view = useControls('มุมมอง', {
    showGrid: { value: true, label: 'ตาราง' },
    flat: { value: false, label: 'มองตรงหน้า' },
  })

  return (
    <div className="tw-page">
      {/* data-lenis-prevent: กัน Lenis ดัก wheel ไปเลื่อนหน้าแทนที่จะเลื่อนในแผง */}
      <div className="jp-leva" data-lenis-prevent>
        <Leva collapsed={false} titleBar={{ title: 'ปั้น toolbar' }} />
      </div>

      <header className="tw-bar">
        <a href="/joespresso">← กลับหน้า joespresso</a>
        <span>ลากเมาส์ = หมุน · scroll = ซูม · คลิกปุ่มในโมเดลได้จริง</span>
      </header>

      <Canvas
        shadows="soft"
        dpr={[1, 2]}
        camera={{ position: [-0.6, 1.5, 7.6], fov: 30, near: 0.1, far: 100 }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.05
        }}
      >
        <color attach="background" args={['#F1E4D6']} />
        <Lights />

        {view.showGrid && (
          <Grid
            position={[0, -1.2, 0]}
            args={[24, 24]}
            cellSize={0.25}
            cellThickness={0.6}
            cellColor="#C9AE95"
            sectionSize={1}
            sectionThickness={1}
            sectionColor="#A9835F"
            fadeDistance={22}
            fadeStrength={1.5}
            infiniteGrid
          />
        )}

        <FigmaToolbar position={[0, 0, 0]} rotation={view.flat ? [0, 0, 0] : [0, 0.36, 0]} params={params} />

        <OrbitControls makeDefault target={[0, 0, 0]} enablePan minDistance={1.5} maxDistance={20} />
      </Canvas>

      {copied && (
        <pre className="tw-out">
          <b>คัดลอกลง clipboard แล้ว — แปะทับ TOOLBAR_DEFAULTS ใน scene/Panels.jsx</b>
          {'\n'}
          {copied}
        </pre>
      )}
    </div>
  )
}
