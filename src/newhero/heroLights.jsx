import { Environment, Lightformer } from '@react-three/drei'
import { useTuner } from './tuner'

/**
 * ชุดไฟของฉาก hero — โมดูลเดียวที่ทั้ง /2026-final และจอ "สิ่งที่ทำ" ใช้ร่วมกัน
 *
 * จอ what-i-do ต้องได้ตัวละคร "ชุดเดียวกับ hero เป๊ะ ๆ" ซึ่งไม่ใช่แค่ริกกับท่า — หน้าตา
 * ของมันมาจากไฟด้วย (แผงไฟนุ่มของ Environment คือสิ่งที่ทำให้ผิวอ่านเป็นดินน้ำมัน)
 * ถ้าแต่ละจอตั้งไฟของตัวเอง วันหนึ่งจูนที่ hero แล้วอีกจอเป็นตัวละครคนละคน
 *
 * BG_MID ส่งเข้ามาเป็น prop ไม่ได้ import — ค่าสีพื้นฟ้าอยู่ในไฟล์ของฉาก hero และ
 * การ import กลับไปจะลากฉากทั้งก้อนมาด้วย ค่าเริ่มต้นที่นี่จึงต้องเป็นค่าเดียวกับ BG_MID
 * ของฉากนั้นเป๊ะ ๆ (#5cb8ee) ไม่ใช่สีฟ้าที่ใกล้เคียง — ไม่งั้นเงาของสองจอมีสีไม่เท่ากัน
 */
export function HeroLights({ skyTint = '#5cb8ee', shadows = true }) {
  const t = useTuner()
  return (
    <>
        {/**
         * ชุดไฟสามดวง + ฟ้า/พื้น แทนการดัน ambient ให้สว่าง
         *
         * ambient สูง ๆ สว่างจริงแต่ทุกหน้าได้แสงเท่ากันหมด ทรงเลยแบนเป็นกระดาษตัด
         * ความ "กระจ่างและมีชีวิต" มาจากการที่แต่ละหน้าได้แสงคนละค่า ไม่ใช่ค่าเฉลี่ยที่สูงขึ้น
         * จึงลด ambient ลงแล้วไปเพิ่มที่ key/fill/rim แทน
         *
         * hemisphereLight คือตัวที่ให้ "ชีวิต" ถูกที่สุด — ด้านบนรับสีฟ้าของหน้า
         * ด้านล่างรับสีอุ่นสะท้อนขึ้นมา เงาจึงมีสีแทนที่จะเป็นเทาตาย
         */}
        <ambientLight intensity={t.ambIntensity} color="#ffffff" />
        <hemisphereLight
          intensity={t.hemiIntensity}
          color={skyTint}
          groundColor="#ffd9a8"
        />
        {/* key: เฉียงบนซ้ายหน้า อุ่น — ตัวกำหนดทิศของเงาทั้งฉาก */}
        {/**
         * key ยิงเงาจริง — ระยะไกลกว่าเดิมแต่ทิศเดิมเป๊ะ (คูณเวกเตอร์เดิมด้วย 3)
         * แสงทิศทางไม่สนระยะ ย้ายออกไปได้ฟรี และกล้องเงาต้องครอบฉากทั้งแถบ
         */}
        <directionalLight
          position={[-15, 24, 21]}
          intensity={t.keyIntensity}
          color="#fff4e2"
          castShadow={shadows && t.sh > 0.5}
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0012}
          shadow-normalBias={0.03}
          shadow-camera-near={1}
          shadow-camera-far={90}
          shadow-camera-left={-34}
          shadow-camera-right={34}
          shadow-camera-top={26}
          shadow-camera-bottom={-26}
        />
        {/* fill: ฝั่งตรงข้าม เย็น รับสีพื้นน้ำเงินของหน้า ไม่ให้ด้านมืดเป็นดำตัน */}
        <directionalLight position={[7, 1, 5]} intensity={t.fillIntensity} color="#cfe0ff" />
        {/* rim: จากหลัง ตัดขอบตัวละครออกจากแผงขาวข้างหลัง */}
        <directionalLight position={[2, 6, -9]} intensity={t.rimIntensity} color="#ffffff" />
        {/**
         * แผงไฟนุ่ม (Environment + Lightformer) — หัวใจของหน้าตาแบบ claymorphism
         *
         * ไฟจุด/ไฟทิศทางให้ "ขอบเงาคม" เสมอ ต่อให้ลด intensity ลงก็ยังเป็นเงาที่มีขอบ
         * ดินน้ำมันไม่ใช่แบบนั้น: มันรับแสงจากแผงกว้าง ๆ รอบตัว ไล่จากสว่างไปมืดยาว ๆ
         * ไม่มีจุดไฮไลต์แข็ง ๆ Lightformer คือแผงแบบนั้น — วางเป็นวัตถุเรืองแสงในฉาก
         * แล้วอบเป็น environment map ให้ทุกผิวเอาไปใช้
         *
         * frames={1} อบครั้งเดียวตอนขึ้นฉาก ไม่ได้เรนเดอร์ซ้ำทุกเฟรม
         * (ไม่มีอะไรในแผงไฟขยับ อบใหม่ทุกเฟรมคือจ่ายค่า cube render ฟรี ๆ)
         */}
        <Environment resolution={128} frames={1}>
          {/* แผงหลักเฉียงบนซ้าย อุ่น — ตรงทิศเดียวกับ key ให้เงาไปทางเดียวกัน */}
          <Lightformer
            form="rect"
            intensity={t.envIntensity * 2.2}
            position={[-6, 8, 8]}
            scale={[14, 14, 1]}
            color="#fff1dc"
          />
          {/* แผงรองฝั่งตรงข้าม เย็น รับสีพื้นน้ำเงินของหน้า */}
          <Lightformer
            form="rect"
            intensity={t.envIntensity}
            position={[8, 2, 5]}
            scale={[10, 10, 1]}
            color="#d5e6ff"
          />
          {/* แผงล่าง อุ่น — แสงสะท้อนขึ้นมาจากพื้น ทำให้ใต้คางกับใต้แขนไม่ทึบ */}
          <Lightformer
            form="ring"
            intensity={t.envIntensity * 0.7}
            position={[0, -8, 4]}
            scale={16}
            color="#ffdcae"
          />
        </Environment>
    </>
  )
}
