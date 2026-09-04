import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  IconAdjustments,
  IconAperture,
  IconAppWindow,
  IconArrowLeft,
  IconArrowRight,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconBalloon,
  IconBrush,
  IconBulb,
  IconChevronDown,
  IconChevronRight,
  IconCompass,
  IconCopy,
  IconDoorEnter,
  IconEye,
  IconFilter,
  IconGridDots,
  IconHandFinger,
  IconHandStop,
  IconMoodSmile,
  IconMountain,
  IconPlayerPause,
  IconPlayerPlay,
  IconPointer,
  IconPuzzle,
  IconRestore,
  IconRipple,
  IconRuler,
  IconShirt,
  IconShoe,
  IconSkateboard,
  IconStack2,
  IconToggleRight,
  IconUser,
  IconVideo,
  IconWaveSine,
  IconWorld,
} from '@tabler/icons-react'
import { DEFAULTS, READOUT, REF, getTuner, projectGuides, resetTuner, setTuner, useTuner } from './tuner'

/**
 * แผงปรับมุมกล้อง/องค์ประกอบของ /new-hero — dev เท่านั้น
 *
 * มีสามส่วนที่ทำให้ปรับแล้ว "รู้ว่าตรงหรือยัง" ไม่ใช่ปรับแล้วเดา:
 *   1. ตัวเลข horizon กับ VP สองข้างที่คำนวณสดจาก fov/pitch/yaw ปัจจุบัน
 *      วางคู่กับเลขที่วัดจากชีท ref (horizon 185, VP 25 / 1165 ที่เฟรม 1199x735)
 *   2. ปุ่ม "ทาบ ref" ซ้อนภาพชีท/ภาพสีทับจอจริง ปรับความทึบได้
 *   3. ปุ่ม "กรอบ ref" ครอบจอให้เป็นอัตราส่วน 1199x735 เท่าชีท — ไม่งั้นเทียบตำแหน่ง
 *      แนวตั้งไม่ได้เลยเพราะ fov คุมแกนตั้ง อัตราส่วนต่างกันนิดเดียวก็เลื่อนแล้ว
 *
 * ค่าทั้งหมดเก็บลง localStorage เอง กด "คัดลอกค่า" แล้ววางทับ DEFAULTS ใน tuner.js
 * เพื่อยึดค่าเป็นของถาวร
 */

const GROUPS = [
  {
    name: 'กล้อง',
    rows: [
      ['fov', 20, 120, 0.01, '°'],
      ['pitch', -40, 60, 0.01, '° ก้ม'],
      ['camX', -20, 20, 0.1],
      ['camY', -10, 30, 0.1],
      ['camZ', -10, 60, 0.1],
      ['fitMax', 1, 2, 0.01, 'ถอยเมื่อจอแคบ'],
    ],
  },
  {
    name: 'เอฟเฟกต์กล้อง',
    rows: [
      ['fxFish', -1, 1, 0.005, 'fisheye (+นูน / -เว้า)'],
      ['fxSkewX', -1, 1, 0.005, 'เอียงตามแกน x'],
      ['fxSkewY', -1, 1, 0.005, 'เอียงตามแกน y'],
      ['fxZoom', 0.4, 2, 0.005, 'ซูม'],
      ['fxChroma', 0, 1, 0.005, 'เหลื่อมสีขอบ'],
      ['fxBulge', -1, 1, 0.005, 'เลนส์นูนเฉพาะจุด (+ขยาย / -ยุบ)'],
      ['fxBulgeR', 0.02, 1.5, 0.005, 'รัศมีวง'],
      ['fxBulgeX', 0, 1, 0.005, 'จุดกึ่งกลาง x บนจอ'],
      ['fxBulgeY', 0, 1, 0.005, 'จุดกึ่งกลาง y บนจอ'],
    ],
  },
  {
    name: 'แกนหมุน',
    rows: [
      ['groundYaw', 0, 90, 0.01, '° ตารางพื้น'],
      ['bandYaw', -45, 45, 0.01, '° แถบหน้าต่าง'],
    ],
  },
  {
    name: 'หน้าต่าง',
    rows: [
      ['panelCount', 1, 9, 1, 'ใบ'],
      ['panelW', 1, 40, 0.1],
      ['panelH', 1, 40, 0.1],
      ['panelD', 0.1, 10, 0.1, 'หนา'],
      ['panelGap', 1, 40, 0.01, 'ระยะห่าง'],
      ['panelX', -30, 30, 0.01, 'เลื่อนแถบ'],
      ['panelZ', -40, 10, 0.1],
      ['panelBase', -40, 10, 0.01, 'ระดับฐาน'],
    ],
  },
  {
    name: 'พื้น',
    rows: [
      ['gridY', -40, 10, 0.01],
      ['gridCell', 0.2, 20, 0.1, 'ช่อง'],
    ],
  },
  {
    name: 'ของลอย (ยกทั้งชุด)',
    rows: [
      ['propScale', 0.2, 5, 0.01, 'สเกล'],
      ['propX', -30, 30, 0.1],
      ['propY', -30, 30, 0.1],
      ['propZ', -30, 30, 0.1],
    ],
  },
  {
    name: 'ริบบิ้นในพอร์ทัล',
    rows: [
      ['portalZ', -140, 0, 0.5, 'ระยะฉากใน'],
      ['portalHemi', 0, 3, 0.01, 'ไฟฟ้า/พื้นในพอร์ทัล'],
      ['portalKey', 0, 4, 0.01, 'ไฟ key ในพอร์ทัล'],
      ['prW', 0.5, 40, 0.1, 'กว้าง'],
      ['prThick', 0, 4, 0.01, 'หนา'],
      ['prWave', 0, 6, 0.01, 'คลื่น'],
      ['prWaves', 0.2, 8, 0.1, 'จำนวนลูก'],
      ['prScale', 0.1, 4, 0.01, 'สเกล'],
      ['prX', -60, 60, 0.5],
      ['prY', -60, 60, 0.5],
      ['prZ', -60, 60, 0.5],
      ['prRotX', -180, 180, 0.5, '°'],
      ['prRotY', -180, 180, 0.5, '°'],
      ['prRotZ', -180, 180, 0.5, '°'],
    ],
  },
  {
    name: 'ลูกโลก (ในพอร์ทัล)',
    rows: [
      ['gbScale', 0.5, 40, 0.1, 'สเกล (รัศมี)'],
      ['gbSpeed', -1, 1, 0.005, 'ความเร็วหมุน (rad/s)'],
      ['gbX', -60, 60, 0.5],
      ['gbY', -60, 60, 0.5],
      ['gbZ', -60, 60, 0.5],
      ['gbRotX', -180, 180, 0.5, '° เอียงแกนถนน'],
      ['gbRotY', -180, 180, 0.5, '°'],
      ['gbRotZ', -180, 180, 0.5, '°'],
      ['gbRoad', 0.05, 0.6, 0.01, 'ถนนกว้าง (ครึ่ง, เรเดียน)'],
      ['gbSeed', 1, 99, 1, 'สุ่มผังใหม่ (seed)'],
      ['gbProp', 0.3, 2.5, 0.05, 'สเกลของประดับ'],
      ['gbBushes', 0, 60, 1, 'พุ่มหญ้า'],
      ['gbCones', 0, 12, 1, 'ต้นสน'],
      ['gbRounds', 0, 12, 1, 'ต้นไม้ทรงพุ่ม'],
      ['gbMushrooms', 0, 8, 1, 'เห็ด'],
      ['gbFlowers', 0, 30, 1, 'ดอกไม้'],
      ['gbBerries', 0, 15, 1, 'เบอร์รี่'],
      ['gbPebbles', 0, 60, 1, 'กรวดบนถนน'],
    ],
  },
  {
    name: 'หน้าต่างซ้อน (ในพอร์ทัล)',
    rows: [
      ['swCount', 1, 8, 1, 'จำนวนชั้น'],
      ['swW', 0.5, 30, 0.1, 'กว้าง'],
      ['swH', 0.5, 30, 0.1, 'สูง'],
      ['swBar', 0.02, 0.6, 0.005, 'ส่วนสูงแถบหัว'],
      ['swDepth', 0.005, 1, 0.005, 'ความหนา'],
      ['swRadius', 0, 0.5, 0.005, 'รัศมีมุม'],
      ['swBtn', 0.02, 0.5, 0.005, 'ขนาดปุ่ม'],
      ['swInset', 0, 0.4, 0.005, 'ขอบใน'],
      ['swDX', -4, 4, 0.01, 'เลื่อนต่อชั้น x'],
      ['swDY', -4, 4, 0.01, 'เลื่อนต่อชั้น y'],
      ['swDZ', -4, 4, 0.01, 'เลื่อนต่อชั้น z'],
      ['swScale', 0.05, 5, 0.01, 'สเกล'],
      ['swX', -60, 60, 0.5],
      ['swY', -60, 60, 0.5],
      ['swZ', -60, 60, 0.5],
      ['swRotX', -180, 180, 0.5, '°'],
      ['swRotY', -180, 180, 0.5, '°'],
      ['swRotZ', -180, 180, 0.5, '°'],
    ],
  },
  {
    name: 'บล็อกเตตริส (ในพอร์ทัล)',
    rows: [
      ['teShape', 0, 5, 1, 'รูปทรง 0=S 1=Z 2=T 3=L 4=O 5=I'],
      ['teDepth', 0.05, 3, 0.01, 'ความหนา'],
      ['teRadius', 0, 0.5, 0.005, 'รัศมีมุม'],
      ['teGap', 0, 0.4, 0.005, 'ร่องระหว่างช่อง'],
      ['teScale', 0.1, 10, 0.05, 'สเกล'],
      ['teX', -60, 60, 0.5],
      ['teY', -60, 60, 0.5],
      ['teZ', -60, 60, 0.5],
      ['teRotX', -180, 180, 0.5, '°'],
      ['teRotY', -180, 180, 0.5, '°'],
      ['teRotZ', -180, 180, 0.5, '°'],
    ],
  },
  {
    name: 'สวิตช์ (หน้าหน้าต่าง)',
    rows: [
      ['bcLen', 1, 5, 0.05, 'ความยาวราง (เท่าความสูง)'],
      ['bcPos', 0, 1, 0.01, 'ตำแหน่งปุ่ม 0=ปิด 1=เปิด'],
      ['bcKnob', 0.2, 1.3, 0.01, 'ขนาดปุ่ม'],
      ['bcKnobThick', 0.05, 1.5, 0.01, 'ความหนาปุ่ม'],
      ['bcKnobProud', -0.5, 0.5, 0.005, 'ปุ่มล้ำพ้นหน้าราง'],
      ['bcRadius', 0.05, 2, 0.01, 'ครึ่งความสูงราง'],
      ['bcThick', 0.1, 4, 0.01, 'ความหนา (extrusion)'],
      ['bcOpacity', 0.05, 1, 0.01, 'ความทึบ'],
      ['bcIcon', 0, 1, 0.01, 'ขนาดไอคอน (0 = ไม่มี)'],
      ['bcOutline', 0, 0.15, 0.002, 'ความหนาเส้นขอบ'],
      ['bcOutlineAlpha', 0, 1, 0.01, 'ความเข้มเส้นขอบ'],
      ['bcEdges', 0, 1, 1, 'แสดงสันของ extrusion'],
      ['bcEdgeAngle', 1, 90, 1, '° เกณฑ์มุมของสัน'],
      ['bcGlass', 0, 1, 0.01, 'ความเป็นกระจก'],
      ['bcBlur', 0, 1, 0.01, 'ความฝ้า (เบลอของหลัง)'],
      ['bcEnv', 0, 3, 0.01, 'แก้ว: สะท้อนแผงไฟ'],
      ['bcIor', 1, 2.4, 0.01, 'แก้ว: หักเห'],
      ['bcChroma', 0, 0.3, 0.005, 'แก้ว: แยกสีขอบ'],
      ['bcScale', 0.1, 12, 0.05, 'สเกล'],
      ['bcX', -60, 60, 0.5],
      ['bcY', -60, 60, 0.5],
      ['bcZ', -60, 60, 0.5],
      ['bcRotX', -180, 180, 0.5, '°'],
      ['bcRotY', -180, 180, 0.5, '°'],
      ['bcRotZ', -180, 180, 0.5, '°'],
    ],
  },
  {
    name: 'เคอร์เซอร์ (หน้าหน้าต่าง)',
    rows: [
      ['cuDepth', 0.02, 1.5, 0.01, 'ความหนา'],
      ['cuOutline', 0, 0.15, 0.002, 'ความหนาเส้นขอบ'],
      ['cuScale', 0.1, 12, 0.05, 'สเกล'],
      ['cuX', -60, 60, 0.5],
      ['cuY', -60, 60, 0.5],
      ['cuZ', -60, 60, 0.5],
      ['cuRotX', -180, 180, 0.5, '°'],
      ['cuRotY', -180, 180, 0.5, '°'],
      ['cuRotZ', -180, 180, 0.5, '°'],
      ['cuAim', 0, 1, 0.01, 'เล็งเมาส์: แรง (0 = ปิด)'],
      ['cuAimMax', 0, 180, 1, '° เล็งเมาส์: มุมหมุนสูงสุด'],
      ['cuAimEase', 0.01, 0.5, 0.005, 'เล็งเมาส์: หน่วง (สูง = ไว)'],
    ],
  },
  {
    name: 'อินโทร (ปรากฏ)',
    rows: [
      ['inWinAt', 0, 5, 0.05, 'วิ หน้าต่างบานแรกโผล่'],
      ['inWinStep', 0, 1.5, 0.01, 'วิ ห่างกันทีละบาน'],
      ['inWinDur', 0.1, 2, 0.05, 'วิ ความยาวการโผล่'],
      ['inRibAt', 0, 6, 0.05, 'วิ ริบบิ้นเริ่มวาด'],
      ['inRibDur', 0.1, 4, 0.05, 'วิ ริบบิ้นวาดจนสุด'],
      ['inRibSplit', 0.05, 0.95, 0.01, 'ริบบิ้น: สัดส่วนช่วงในพอร์ทัล'],
      ['inPropAt', -2, 4, 0.05, 'วิ เคอร์เซอร์โผล่ (นับจากตัวละครถึง)'],
      ['inPropGap', 0, 2, 0.05, 'วิ สวิตช์ตามหลังเคอร์เซอร์'],
      ['inPropDur', 0.1, 2, 0.05, 'วิ ความยาวการพุ่งของของลอย'],
      ['inPropDist', 0, 3, 0.05, 'ระยะที่ของลอยพุ่งมา'],
      ['inOver', 0, 4, 0.05, 'เลยเป้าแล้วดีดกลับ (แรง)'],
      ['inWinRise', 0, 10, 0.1, 'หน้าต่างลอยขึ้นจากล่าง (หน่วย)'],
      ['inWinTilt', -90, 90, 1, '° หน้าต่างเริ่มคว่ำ'],
      ['inCamDolly', -15, 15, 0.1, 'กล้องเริ่ม: เข้าใกล้ (ลบ) / ถอย'],
      ['inCamX', -10, 10, 0.1, 'กล้องเริ่ม: เยื้องซ้าย/ขวา'],
      ['inCamY', -10, 10, 0.1, 'กล้องเริ่ม: ต่ำ/สูง'],
      ['inCamYaw', -40, 40, 0.5, '° กล้องเริ่ม: เฉียง'],
      ['inCamDur', 0.2, 8, 0.1, 'วิ กล้องถอยกลับที่มุมจริง'],
      ['inClickAt', 0, 2, 0.05, 'วิ เคอร์เซอร์คลิก → สวิตช์เปิด (หลังโผล่)'],
      ['inGlobeSpin', 0, 12, 0.1, 'ดาวหมุนติ้วตอนเปิดบาน'],
    ],
  },
  {
    name: 'ทางเข้า (ไหลออกจากหน้าต่าง)',
    rows: [
      ['enBurstAt', 0.05, 0.95, 0.01, 'พุ่ง: เริ่มที่สัดส่วนเวลา'],
      ['enBurstAmt', 0, 0.95, 0.01, 'พุ่ง: ใช้ระยะทางกี่ส่วน (0 = ไม่พุ่ง)'],
      ['enTurn', 0, 1, 0.01, 'หมุนตัวตามเส้น (0 = หันทิศเดียวกับท่าจบ)'],
      ['enGrav', 0, 1, 0.01, 'ฟิสิกส์: ลงเนินเร็ว ขึ้นเนินช้า'],
      ['enLean', 0, 2, 0.05, 'เอียงเข้าโค้งตามความโค้งจริง'],
      ['enSquash', 0, 0.5, 0.01, 'ลงพื้น: ยุบแล้วเด้ง'],
      ['enDelay', 0, 5, 0.05, 'วิ หน่วงก่อนเริ่ม'],
      ['enDur', 0.2, 6, 0.05, 'วิ ระยะเวลา'],
      ['enX', -30, 30, 0.05, 'จุดเริ่ม x'],
      ['enY', -20, 20, 0.05, 'จุดเริ่ม y'],
      ['enZ', -30, 20, 0.05, 'จุดเริ่ม z (ลบ = หลังบาน)'],
      ['enMidX', -30, 30, 0.05, 'จุดกลาง x (ปากบานที่ 2)'],
      ['enMidY', -20, 20, 0.05, 'จุดกลาง y'],
      ['enMidZ', -30, 20, 0.05, 'จุดกลาง z'],
      ['enArc', -5, 5, 0.05, 'โค้งยกกลางทาง'],
      ['enSpin', -360, 360, 1, '° หมุนตัวตอนออก'],
      ['enBank', -90, 90, 0.5, '° เอียงข้างระหว่างวิ่ง'],
      ['enScale', 0.05, 2, 0.01, 'สเกลตอนเริ่ม'],
      ['enOver', 0, 4, 0.05, 'เลยเป้าแล้วดีดกลับ'],
      ['enPT0', 0, 0.98, 0.005, 'ริบบิ้นในหน้าต่าง: เริ่มที่ t'],
      ['enT0', -0.6, 1, 0.005, 'ริบบิ้น: เริ่มที่ t (ลบ = ลึกเข้าไปในบาน 1)'],
      ['enBackZ', 0, 30, 0.1, 'ในพอร์ทัล: ลึกหลังบานได้ไม่เกิน'],
      ['enMouthPad', -0.1, 0.2, 0.005, 'ริบบิ้น: โผล่พ้นกรอบหลังปากช่องเท่าไร'],
      ['enT1', 0, 1, 0.005, 'ริบบิ้น: ออกจากเส้นที่ t'],
      ['enUp', -3, 3, 0.01, 'ยกพ้นผิวเพิ่ม (0 = เท่าท่าหยุด)'],
      ['enFace', -180, 180, 1, '° ริบบิ้น: หันหน้าเทียบทิศเส้น'],
      ['enBlend', 0.05, 1, 0.01, 'ริบบิ้น: ช่วงท้ายละลายเข้าท่าจริง'],
    ],
  },
  {
    name: 'ตัวละคร',
    rows: [
      ['skaterScale', 0.1, 6, 0.01, 'สเกล'],
      ['skaterX', -30, 30, 0.05],
      ['skaterY', -20, 20, 0.05],
      ['skaterZ', -20, 20, 0.05],
      ['skaterRotX', -180, 180, 0.5, '° ก้ม/เงย'],
      ['skaterRotY', -180, 180, 0.5, '° หันหน้า'],
      ['skaterRotZ', -180, 180, 0.5, '° เอียงข้าง'],
      ['mascotScale', 0.05, 3, 0.01, 'ขนาดตัว'],
      ['mascotLift', -3, 3, 0.01, 'ยกพ้นบอร์ด'],
      ['boardScale', 0.2, 3, 0.01, 'ขนาดบอร์ด'],
      ['armScale', 0.3, 2.5, 0.01, 'ขนาดแขนทั้งเส้น'],
      ['foreScale', 0.3, 2.5, 0.01, 'ขนาดท่อนล่าง+มือ'],
    ],
  },
  {
    name: 'แสง',
    rows: [
      ['flatEdge', 0, 3, 0.01, 'แบน: เกณฑ์เงา→สว่าง'],
      ['flatHiEdge', 0, 3, 0.01, 'แบน: เกณฑ์สว่าง→ไฮไลต์'],
      ['flatSoft', 0, 0.5, 0.005, 'แบน: ความนุ่มรอยต่อชั้น (0 = คม)'],
      ['flatShadow', 0, 1, 0.01, 'แบน: ความสว่างชั้นเงา'],
      ['flatLit', 0.5, 1.5, 0.01, 'แบน: ความสว่างชั้นสีเนื้อ'],
      ['flatHi', 0, 1, 0.01, 'แบน: ความขาวของไฮไลต์'],
      ['flatTint', 0, 1, 0.01, 'แบน: เงาอมม่วง'],
      ['flatEnv', 0, 2, 0.01, 'แบน: แผงไฟสะท้อนที่ยังเหลือ'],
      ['glossRough', 0, 1, 0.01, 'พลาสติก: ความด้าน (ต่ำ = เงา)'],
      ['glossEnv', 0, 4, 0.01, 'พลาสติก: แรงสะท้อนแผงไฟ'],
      ['ambIntensity', 0, 2, 0.01, 'ambient'],
      ['hemiIntensity', 0, 2, 0.01, 'ฟ้า/พื้น'],
      ['keyIntensity', 0, 4, 0.01, 'key'],
      ['fillIntensity', 0, 3, 0.01, 'fill'],
      ['rimIntensity', 0, 3, 0.01, 'rim (ไฟหลัง)'],
      ['rimPower', 0.5, 16, 0.1, 'ความคมของ rim ที่ผิว'],
      ['rimBoost', 0, 3, 0.01, 'ความสว่างของ rim ที่ผิว'],
      ['rimFxInt', 0, 4, 0.01, 'rim ขอบภาพ: ความแรง'],
      ['rimFxW', 1, 60, 0.5, 'rim ขอบภาพ: กว้าง (px)'],
      ['rimFxFall', 0.3, 5, 0.05, 'rim ขอบภาพ: ไล่จางจากขอบ (สูง = จางเร็ว)'],
      ['rimFxShade', 0, 1, 0.01, 'rim ขอบภาพ: ติดเฉพาะผิวที่หันหาไฟ'],
      ['rimFxBack', 0, 3, 0.05, 'rim ขอบภาพ: ไฟอยู่หลังตัวแค่ไหน'],
      ['rimFxSoft', 0, 2, 0.01, 'rim ขอบภาพ: นุ่ม'],
      ['rimFxThresh', 0.002, 0.3, 0.001, 'rim ขอบภาพ: เกณฑ์ความลึก'],
      ['rimFxMix', 0, 1, 0.01, 'rim ขอบภาพ: เฉพาะฝั่งไฟ (0 = รอบตัว)'],
      ['rimFxAngle', -180, 180, 1, '° rim ขอบภาพ: ทิศไฟบนจอ (90 = บน)'],
      ['rimEdge', 0, 1, 0.01, 'fresnel: เกณฑ์ขอบ (0 = ไม่ตัด)'],
      ['rimSoft', 0.005, 0.5, 0.005, 'ความนุ่มของเกณฑ์'],
      ['rimDirMix', 0, 1, 0.01, 'ขึ้นเฉพาะฝั่งไฟขอบ (0 = รอบตัว)'],
      ['rimYaw', -180, 180, 1, '° ทิศไฟขอบ (180 = จากหลัง)'],
      ['rimPitch', -90, 90, 1, '° ไฟขอบสูง/ต่ำ'],
      ['flatBands', 0, 6, 1, 'ตัดแสงเป็นชั้น (0 = ปิด)'],
      ['envIntensity', 0, 4, 0.01, 'แผงไฟนุ่ม (env)'],
      ['exposure', 0.3, 2.5, 0.01, 'exposure'],
    ],
  },
  {
    name: 'ไหวเบา ๆ',
    rows: [
      ['idleAmp', 0, 4, 0.01, 'แรง'],
      ['idleSpeed', 0.1, 4, 0.01, 'เร็ว'],
    ],
  },
  {
    name: 'หน้า / ตา',
    rows: [
      ['fcX', -0.5, 0.5, 0.005, 'ทั้งหน้า: ซ้าย/ขวา (×W)'],
      ['fcY', -0.5, 0.5, 0.005, 'ทั้งหน้า: ขึ้น/ลง (×H)'],
      ['fcZ', -0.3, 0.3, 0.002, 'ทั้งหน้า: ยื่นออก/จมเข้า'],
      ['fcRotX', -45, 45, 0.5, '° ทั้งหน้า: ก้ม/เงย'],
      ['fcRotY', -90, 90, 0.5, '° ทั้งหน้า: หันซ้าย/ขวา'],
      ['fcRotZ', -45, 45, 0.5, '° ทั้งหน้า: เอียง'],
      ['fcScale', 0.3, 3, 0.01, 'ทั้งหน้า: สเกล'],
      ['fcEye', 0.05, 0.35, 0.005, 'ตาขาว: รัศมี (×W)'],
      ['fcGap', 0, 0.45, 0.005, 'ตาขาว: ห่างกลาง (×W)'],
      ['fcEyeY', -0.4, 0.4, 0.005, 'ฐานตา สูง/ต่ำ (×H)'],
      ['fcPupil', 0.1, 0.95, 0.01, 'ลูกตาดำ: ขนาดเทียบตาขาว (0.5 = ครึ่ง)'],
      ['fcPupilX', -0.15, 0.15, 0.005, 'ลูกตาดำ: มองซ้าย/ขวา'],
      ['fcPupilY', -0.06, 0.15, 0.005, 'ลูกตาดำ: สูงจากฐาน (ลบ = จมใต้ฐาน)'],
      ['fcLook', 0, 0.15, 0.005, 'ระยะกวาดตา (0 = นิ่ง)'],
      ['fcBrow', 0.03, 0.3, 0.005, 'คิ้ว: รัศมีโค้ง (×W)'],
      ['fcBrowY', 0, 0.5, 0.005, 'คิ้ว: สูงจากฐานตา (×H)'],
      ['fcBrowArc', 0.2, 1.5, 0.05, 'คิ้ว: ความโค้ง (แบน→กลม)'],
      ['fcBrowTilt', -45, 45, 0.5, '° คิ้ว: เอียง'],
      ['fcMouth', 0.02, 0.3, 0.005, 'ปาก: กว้าง (×W)'],
      ['fcMouthH', 0.05, 0.6, 0.005, 'ปาก: สูง (×H)'],
      ['fcMouthX', -0.3, 0.3, 0.005, 'ปาก: ซ้าย/ขวา'],
      ['fcMouthY', -0.5, 0.3, 0.005, 'ปาก: สูง/ต่ำ (×H)'],
      ['fcLookEvery', 0.5, 10, 0.1, 'วิ เปลี่ยนจุดมองทุก ๆ'],
      ['fcBlinkEvery', 0.5, 12, 0.1, 'วิ กระพริบทุก ๆ'],
    ],
  },
  {
    name: 'หัวตามเมาส์',
    rows: [
      ['hfYaw', 0, 1.5, 0.01, 'หัน ซ้าย/ขวา (rad)'],
      ['hfPitch', 0, 1.2, 0.01, 'ก้ม/เงย (rad)'],
      ['hfRoll', 0, 0.6, 0.01, 'เอียง (rad)'],
      ['hfEase', 0.005, 0.4, 0.005, 'หน่วง (สูง = ตามไว)'],
      ['hfBaseYaw', -1, 1, 0.01, 'ท่าตั้งต้น: หัน'],
      ['hfBasePitch', -0.6, 0.6, 0.01, 'ท่าตั้งต้น: ก้ม/เงย'],
      ['hfBaseRoll', -0.8, 0.8, 0.01, 'ท่าตั้งต้น: เอียง'],
      ['hfFollow', 0, 1.5, 0.01, 'ตามมาก/น้อย (คูณระยะ)'],
      ['hfCurve', 0.3, 3, 0.05, 'โค้งตอบสนอง (1 ตรง, >1 กลางเบาขอบแรง)'],
      ['hfDead', 0, 0.6, 0.01, 'จุดบอดกลางจอ (รัศมี)'],
      ['hfBounce', 0, 1, 0.01, 'สปริงเด้งเกินเป้า (0 = ปิด)'],
      ['hfIdleBack', 0, 10, 0.1, 'วิ เมาส์นิ่งแล้วกลับท่าเดิม (0 = ไม่กลับ)'],
    ],
  },
  {
    name: 'ลำตัว',
    rows: [
      ['leanX', -90, 90, 0.5, '° เอียงทั้งตัวไปหน้า'],
      ['leanZ', -90, 90, 0.5, '° เอียงทั้งตัวข้าง'],
      ['foldX', -120, 120, 0.5, '° พับตัวไปหน้า'],
      ['foldY', -120, 120, 0.5, '° บิดตัว'],
      ['foldZ', -120, 120, 0.5, '° พับตัวข้าง'],
      ['headX', -90, 90, 0.5, '° เงยหัวสวน'],
    ],
  },
  {
    name: 'ขา',
    rows: [
      ['legSpread', -1.5, 1.5, 0.005, 'ถ่างขาออกข้าง'],
      ['legStagger', -1.5, 1.5, 0.005, 'เหลื่อมหน้า-หลัง'],
      ['hipLX', -180, 180, 0.5, '° สะโพกซ้าย'],
      ['hipLY', -180, 180, 0.5, '° สะโพกซ้าย'],
      ['hipLZ', -180, 180, 0.5, '° สะโพกซ้าย'],
      ['kneeL', -20, 180, 0.5, '° เข่าซ้าย'],
      ['ankleL', -90, 90, 0.5, '° ข้อเท้าซ้าย'],
      ['hipRX', -180, 180, 0.5, '° สะโพกขวา'],
      ['hipRY', -180, 180, 0.5, '° สะโพกขวา'],
      ['hipRZ', -180, 180, 0.5, '° สะโพกขวา'],
      ['kneeR', -20, 180, 0.5, '° เข่าขวา'],
      ['ankleR', -90, 90, 0.5, '° ข้อเท้าขวา'],
    ],
  },
  {
    name: 'สเก็ตบอร์ด',
    rows: [
      ['bdLen', 0.1, 1.2, 0.005, 'ยาวแผ่นกลาง'],
      ['bdWide', 0.08, 0.6, 0.005, 'กว้างแผ่น'],
      ['bdThick', 0.004, 0.08, 0.002, 'หนาแผ่น'],
      ['bdKickAt', 0.1, 0.95, 0.01, 'เริ่มเชิดที่'],
      ['bdKick', 0, 0.2, 0.002, 'ความสูงปลายเชิด'],
      ['bdConcave', 0, 0.25, 0.002, 'ท้องแอ่น'],
      ['bdTruckX', 0.05, 0.5, 0.005, 'ระยะทรัค'],
      ['bdWheelR', 0.01, 0.12, 0.002, 'รัศมีล้อ'],
      ['bdWheelW', 0.01, 0.12, 0.002, 'หนาล้อ'],
      ['bdRideY', 0.03, 0.3, 0.005, 'สูงจากพื้น'],
      ['boardX', -2, 2, 0.005, 'เลื่อนตามยาว'],
      ['boardY', -2, 2, 0.005, 'ยกจากฝ่าเท้า'],
      ['boardZ', -2, 2, 0.005, 'เลื่อนตามขวาง'],
      ['boardRotX', -180, 180, 0.5, '° ก้ม/เงย'],
      ['boardRotY', -180, 180, 0.5, '° หันหน้า'],
      ['boardRotZ', -180, 180, 0.5, '° เอียงข้าง'],
    ],
  },
  {
    name: 'แขน A (ข้างที่เล็งด้วยแกนแขน)',
    rows: [
      ['aimOut', -0.6, 1.2, 0.005, 'เลื่อนออกจากตัว'],
      ['aimUp', -0.8, 0.8, 0.005, 'เลื่อนขึ้น/ลง'],
      ['aimFwd', -0.8, 0.8, 0.005, 'เลื่อนหน้า/หลัง'],
      ['aimRotX', -180, 180, 0.5, '° หมุนทั้งแขน'],
      ['aimRotY', -180, 180, 0.5, '° หมุนทั้งแขน'],
      ['aimRotZ', -180, 180, 0.5, '° หมุนทั้งแขน'],
      ['aimX', -1, 1, 0.01, 'ทิศออกข้าง'],
      ['aimY', -1, 1, 0.01, 'ทิศขึ้น'],
      ['aimZ', -1, 1, 0.01, 'ทิศหน้า'],
      ['elbowX', -180, 180, 0.5, '° ศอก'],
      ['elbowY', -180, 180, 0.5, '° ศอก'],
      ['elbowZ', -180, 180, 0.5, '° ศอก (เหยียด ≈ 20)'],
      ['handScale', 0.3, 2, 0.01, 'ขนาดมือ'],
      ['handX', -2, 2, 0.005, 'เลื่อนมือออกจากตัว'],
      ['handY', -2, 2, 0.005, 'เลื่อนมือขึ้น/ลง'],
      ['handZ', -2, 2, 0.005, 'เลื่อนมือหน้า/หลัง'],
      ['wristX', -180, 180, 0.5, '° ข้อมือ'],
      ['wristY', -180, 180, 0.5, '° ข้อมือ'],
      ['wristZ', -180, 180, 0.5, '° ข้อมือ'],
    ],
  },
  {
    name: 'แขน B (ข้างที่คิดจากท่าพัก)',
    rows: [
      ['mugOut', -0.6, 1.2, 0.005, 'เลื่อนออกจากตัว'],
      ['mugUp', -0.8, 0.8, 0.005, 'เลื่อนขึ้น/ลง'],
      ['mugFwd', -0.8, 0.8, 0.005, 'เลื่อนหน้า/หลัง'],
      ['mugRotX', -180, 180, 0.5, '° หมุนทั้งแขน'],
      ['mugRotY', -180, 180, 0.5, '° หมุนทั้งแขน'],
      ['mugRotZ', -180, 180, 0.5, '° หมุนทั้งแขน'],
      ['mugShX', -180, 180, 0.5, '° ไหล่'],
      ['mugShY', -180, 180, 0.5, '° ไหล่'],
      ['mugShZ', -180, 180, 0.5, '° ไหล่ (กางออก ≈ -60)'],
      ['mugHandScale', 0.3, 2, 0.01, 'ขนาดมือ'],
      ['mugHandX', -2, 2, 0.005, 'เลื่อนมือออกจากตัว'],
      ['mugHandY', -2, 2, 0.005, 'เลื่อนมือขึ้น/ลง'],
      ['mugHandZ', -2, 2, 0.005, 'เลื่อนมือหน้า/หลัง'],
      ['mugWristX', -180, 180, 0.5, '° ข้อมือ'],
      ['mugWristY', -180, 180, 0.5, '° ข้อมือ'],
      ['mugWristZ', -180, 180, 0.5, '° ข้อมือ'],
      ['mugElX', -180, 180, 0.5, '° ศอก'],
      ['mugElY', -180, 180, 0.5, '° ศอก'],
      ['mugElZ', -180, 180, 0.5, '° ศอก'],
    ],
  },
  {
    name: 'ริบบิ้นกระจก',
    rows: [
      ['grW', 0.5, 8, 0.05, 'กว้าง'],
      ['grThick', 0.02, 1, 0.01, 'หนา'],
      ['grScale', 0.2, 3, 0.01, 'สเกลทั้งชิ้น'],
      ['grX', -20, 20, 0.05],
      ['grY', -20, 20, 0.05],
      ['grZ', -20, 20, 0.05],
      ['grRotX', -180, 180, 0.5, '° หมุนรอบปากช่อง'],
      ['grRotY', -180, 180, 0.5, '°'],
      ['grRotZ', -180, 180, 0.5, '°'],
      ['grRough', 0, 1, 0.01, 'ความฝ้า (0 = ใส)'],
      ['grTrans', 0, 1, 0.01, 'ความโปร่ง'],
      ['grChroma', 0, 0.3, 0.005, 'เหลื่อมสีขอบ'],
      ['grIor', 1, 2, 0.01, 'ดัชนีหักเห'],
    ],
  },
  {
    name: 'ริบบิ้น',
    rows: [
      ['ribbonScale', 0.05, 3, 0.01, 'สเกล'],
      ['ribbonW', 0.5, 30, 0.1, 'กว้าง'],
      ['ribbonThick', 0, 2, 0.01, 'หนา'],
      ['ribbonWave', 0, 3, 0.01, 'คลื่น'],
      ['ribbonWaves', 0.2, 8, 0.1, 'จำนวนลูก'],
      ['ribbonX', -20, 20, 0.1],
      ['ribbonY', -20, 20, 0.1],
      ['ribbonZ', -20, 20, 0.1],
      ['ribbonRotX', -180, 180, 0.5, '° ก้ม/เงย'],
      ['ribbonRotY', -180, 180, 0.5, '° กวาดซ้ายขวา'],
      ['ribbonRotZ', -180, 180, 0.5, '° บิดรอบตัว'],
    ],
  },
]

/**
 * สวิตช์เปิด/ปิดของแต่ละกลุ่ม — วางไว้ที่หัวกลุ่มที่มันคุม ไม่ใช่กองรวมกันข้างบน
 * (หาเจอจากบริบท: อยากปิดเตตริสก็ไปที่กลุ่มเตตริส)
 */
const GROUP_TOGGLES = {
  'เอฟเฟกต์กล้อง': [['fx', 'เปิด']],
  'หน้าต่าง': [['portal', 'พอร์ทัล'], ['portalWall', 'ผนังพอร์ทัล']],
  'พื้น': [['grid', 'ตารางพื้น']],
  'ของลอย (ยกทั้งชุด)': [['props', 'ของลอย']],
  'ลูกโลก (ในพอร์ทัล)': [['gb', 'เปิด']],
  'หน้าต่างซ้อน (ในพอร์ทัล)': [['sw', 'เปิด']],
  'บล็อกเตตริส (ในพอร์ทัล)': [['te', 'เปิด']],
  'สวิตช์ (หน้าหน้าต่าง)': [['bc', 'เปิด']],
  'เคอร์เซอร์ (หน้าหน้าต่าง)': [['cu', 'เปิด']],
  'อินโทร (ปรากฏ)': [['intro', 'เปิด']],
  'ทางเข้า (ไหลออกจากหน้าต่าง)': [['en', 'เปิด'], ['enPath', 'เส้นจากริบบิ้น'], ['enTwo', 'สองท่อน (มีรอยต่อ)'], ['enShowPath', 'โชว์เส้น'], ['enRide', 'ตามริบบิ้น']],
  'ตัวละคร': [['skater', 'ตัวละคร']],
  'หัวตามเมาส์': [['hf', 'ตามเมาส์']],
  'แสง': [['flat', 'แบน (cel)'], ['flatTone', 'ACES'], ['rimFx', 'rim ขอบภาพ'], ['gloss', 'พลาสติกเงา'], ['clay', 'clay']],
  'ไหวเบา ๆ': [['idle', 'ไหวเบา ๆ'], ['breathe', 'ไหวข้อต่อ']],
  'ริบบิ้นกระจก': [['gr', 'เปิด']],
}

/** ไอคอนหัวกลุ่ม (Tabler) — กวาดตาหากลุ่มได้เร็วกว่าอ่านชื่อ */
const GROUP_ICONS = {
  'กล้อง': IconVideo,
  'เอฟเฟกต์กล้อง': IconAperture,
  'แกนหมุน': IconCompass,
  'หน้าต่าง': IconAppWindow,
  'พื้น': IconGridDots,
  'ของลอย (ยกทั้งชุด)': IconBalloon,
  'ริบบิ้นในพอร์ทัล': IconMountain,
  'ลูกโลก (ในพอร์ทัล)': IconWorld,
  'หน้าต่างซ้อน (ในพอร์ทัล)': IconStack2,
  'บล็อกเตตริส (ในพอร์ทัล)': IconPuzzle,
  'สวิตช์ (หน้าหน้าต่าง)': IconToggleRight,
  'เคอร์เซอร์ (หน้าหน้าต่าง)': IconPointer,
  'อินโทร (ปรากฏ)': IconPlayerPlay,
  'ทางเข้า (ไหลออกจากหน้าต่าง)': IconDoorEnter,
  'ตัวละคร': IconUser,
  'แสง': IconBulb,
  'ไหวเบา ๆ': IconWaveSine,
  'หน้า / ตา': IconMoodSmile,
  'หัวตามเมาส์': IconEye,
  'ลำตัว': IconShirt,
  'ขา': IconShoe,
  'สเก็ตบอร์ด': IconSkateboard,
  'แขน A (ข้างที่เล็งด้วยแกนแขน)': IconHandStop,
  'แขน B (ข้างที่คิดจากท่าพัก)': IconHandFinger,
  'ริบบิ้นกระจก': IconRipple,
  'ริบบิ้น': IconRipple,
}
const TOGGLE_ICONS = { skater: IconUser, portal: IconAppWindow, props: IconBalloon, clay: IconBrush, grid: IconGridDots }

/** ไอคอนขนาดข้อความ วางแนวเดียวกับตัวหนังสือ */
function Ic({ icon: I, size = 13 }) {
  if (!I) return null
  return <I size={size} stroke={1.9} style={{ verticalAlign: '-2px', marginRight: 4, flex: 'none' }} />
}

/** สวิตช์ที่ใช้บ่อยสุด — อยู่บนสุดเสมอ ไม่ต้องเลื่อนหา */
const QUICK_TOGGLES = [
  ['skater', 'ตัวละคร'],
  ['portal', 'พอร์ทัล'],
  ['props', 'ของลอย'],
  ['clay', 'clay'],
  ['grid', 'ตารางพื้น'],
]

const GREEN = '#6ee7b7'
const PANEL_KEY = 'newhero.panel'

/** สถานะของตัวแผงเอง (กลุ่มไหนเปิด, ชิดซ้าย/ขวา, ...) — คนละที่กับค่าที่จูน */
function loadPanel() {
  try {
    return { open: { กล้อง: true }, side: 'right', collapsed: false, ...JSON.parse(localStorage.getItem(PANEL_KEY) || '{}') }
  } catch {
    return { open: { กล้อง: true }, side: 'right', collapsed: false }
  }
}
function savePanel(p) {
  try {
    localStorage.setItem(PANEL_KEY, JSON.stringify(p))
  } catch {
    /* โหมดส่วนตัว — ไม่จำข้ามรีเฟรชก็ยังใช้ได้ */
  }
}

const box = {
  position: 'fixed',
  top: 12,
  zIndex: 60,
  width: 340,
  maxHeight: 'calc(100svh - 24px)',
  display: 'flex',
  flexDirection: 'column',
  overscrollBehavior: 'contain',
  background: 'rgba(18,18,20,0.92)',
  color: '#e8e8e8',
  font: '11px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.14)',
  boxShadow: '0 8px 30px rgba(0,0,0,0.45)',
  backdropFilter: 'blur(6px)',
}
const btn = {
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  background: 'rgba(255,255,255,0.08)',
  color: '#e8e8e8',
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: 6,
  padding: '4px 8px',
  font: 'inherit',
}
const btnOn = { ...btn, background: 'rgba(110,231,183,0.22)' }
const field = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 4,
  color: '#e8e8e8',
  font: 'inherit',
  padding: '2px 4px',
}

/** ค่าเท่ากับค่าเริ่มต้นไหม — เผื่อเศษทศนิยมจากสไลเดอร์ */
const isDefault = (k, v) => Math.abs(v - DEFAULTS[k]) < 1e-9

function Row({ k, min, max, step, unit }) {
  const t = useTuner()
  const v = t[k]
  const changed = !isDefault(k, v)
  /** shift + ลูกศร = ก้าวละ 10 เท่า — ลากไกล ๆ ไม่ต้องกดค้าง */
  const onKey = (e) => {
    if (!e.shiftKey) return
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    setTuner({ [k]: Math.min(max, Math.max(min, +(v + dir * step * 10).toFixed(6))) })
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr 62px', gap: 6, alignItems: 'center' }}>
      <span
        onDoubleClick={() => setTuner({ [k]: DEFAULTS[k] })}
        title={`${unit || ''}\nค่าเริ่มต้น ${DEFAULTS[k]} — ดับเบิลคลิกเพื่อคืนค่า`}
        style={{ cursor: 'pointer', lineHeight: 1.2, overflow: 'hidden' }}
      >
        <span style={{ color: changed ? GREEN : 'inherit', opacity: changed ? 1 : 0.78 }}>
          {changed ? '● ' : ''}{k}
        </span>
        {unit && (
          <span style={{ display: 'block', opacity: 0.42, fontSize: 9.5, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {unit}
          </span>
        )}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => setTuner({ [k]: Number(e.target.value) })}
        onKeyDown={onKey}
        style={{ cursor: 'pointer', accentColor: GREEN, minWidth: 0 }}
      />
      <input
        type="number"
        step={step}
        value={v}
        onChange={(e) => setTuner({ [k]: Number(e.target.value) })}
        style={{ ...field, width: 62 }}
      />
    </div>
  )
}

/** ตำแหน่งจริงในโลกของ mascot — อ่านทุก 200ms พอ ไม่ต้องตามทุกเฟรม */
function Readout() {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [])
  return (
    <div style={{ display: 'grid', gap: 2, padding: '5px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: 6 }}>
      <div style={{ opacity: 0.6 }}>ตำแหน่ง mascot ในโลก</div>
      <div style={{ color: GREEN }}>
        x {READOUT.x.toFixed(2)}  y {READOUT.y.toFixed(2)}  z {READOUT.z.toFixed(2)}
      </div>
      <div style={{ opacity: 0.6, marginTop: 2 }}>ฝ่าเท้า / หน้าแผ่นบอร์ด</div>
      <div style={{ color: Math.abs(READOUT.gap) < 0.01 ? GREEN : '#f4a4a4' }}>
        {READOUT.sole.toFixed(3)} / {READOUT.deck.toFixed(3)} (ห่าง {READOUT.gap.toFixed(3)})
      </div>
      <div style={{ opacity: 0.6 }}>ชิ้นต่ำสุด: {READOUT.low || '-'}</div>
    </div>
  )
}

function Toggle({ k, label }) {
  const t = useTuner()
  const on = t[k] > 0.5
  return (
    <button type="button" onClick={() => setTuner({ [k]: on ? 0 : 1 })} style={on ? btnOn : btn}>
      {on ? '●' : '○'} <Ic icon={TOGGLE_ICONS[k]} />{label}
    </button>
  )
}

/** ตัวเลขที่ปรับอยู่ vs ตัวเลขที่วัดจากชีท — เขียวคือห่างไม่เกิน 3 px */
function Guides() {
  const t = useTuner()
  const g = projectGuides(t)
  const cell = (now, want, tol = 3) => {
    const ok = Math.abs(now - want) <= tol
    return (
      <span style={{ color: ok ? GREEN : '#f4a4a4' }}>
        {now.toFixed(1)} <span style={{ opacity: 0.5 }}>/ {want}</span>
      </span>
    )
  }
  return (
    <div style={{ display: 'grid', gap: 3, padding: '6px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: 6 }}>
      <div style={{ opacity: 0.6 }}>เทียบที่เฟรม {REF.w}x{REF.h} (ภาพเส้นที่วาด)</div>
      <div>horizon y {cell(g.horizonY, REF.horizonY)}</div>
      <div>VP แถบหน้าต่าง x {cell(g.bandVP, REF.bandVP, 60)}</div>
    </div>
  )
}

/** กลุ่มพับได้ พร้อมสวิตช์ของกลุ่มที่หัว และป้ายบอกว่ามีกี่ค่าที่แก้ไปแล้ว */
function Group({ g, open, onToggle, rows }) {
  const t = useTuner()
  const changed = g.rows.filter(([k]) => !isDefault(k, t[k])).length
  const toggles = GROUP_TOGGLES[g.name]
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onToggle}
          style={{ ...btn, border: 0, background: 'transparent', padding: '3px 0', flex: '1 1 auto', textAlign: 'left', opacity: 0.85 }}
        >
          <Ic icon={open ? IconChevronDown : IconChevronRight} size={12} />
          <Ic icon={GROUP_ICONS[g.name]} />
          {g.name}
          {changed > 0 && <span style={{ color: GREEN, marginLeft: 6 }}>●{changed}</span>}
        </button>
        {toggles?.map(([k, label]) => <Toggle key={k} k={k} label={label} />)}
      </div>
      {open && g.name.startsWith('ทางเข้า') && <EntranceBar />}
      {open && rows.map(([k, min, max, step, unit]) => <Row key={k} k={k} min={min} max={max} step={step} unit={unit} />)}
    </div>
  )
}

/**
 * แถบควบคุมทางเข้า — เล่น / หยุด / ลากดูตำแหน่ง อยู่ที่หัวกลุ่มให้กดได้ทันที
 *
 * ปุ่มเล่นต้องปลดหยุดให้ด้วย ไม่งั้นกดแล้วภาพไม่ขยับ (ค้างอยู่ที่ enScrub) แล้วดูเหมือนปุ่มเสีย
 * แถบลากใช้ได้เฉพาะตอนหยุด — ตอนเล่นอยู่ค่ามันถูกเวลาเขียนทับทุกเฟรม
 */
function EntranceBar() {
  const t = useTuner()
  const paused = t.enPause > 0.5
  const from = t.enFrom
  const to = t.enTo
  const partial = from > 0.001 || to < 0.999
  const slider = (value, onChange, extra) => (
    <input
      type="range"
      min={0}
      max={1}
      step={0.005}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ width: 88, cursor: 'pointer', accentColor: GREEN, ...extra }}
    />
  )
  return (
    <div style={{ display: 'grid', gap: 3, width: '100%', padding: '2px 0 4px' }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          style={btn}
          title={partial ? 'เล่นวนซ้ำเฉพาะช่วงที่เลือก' : 'เล่นใหม่ตั้งแต่ต้น'}
          onClick={() => setTuner({ enPause: 0, enReplay: getTuner().enReplay + 1 })}
        >
          <Ic icon={IconPlayerPlay} />
          {partial ? 'เล่นช่วงนี้' : 'เล่น'}
        </button>
        <button
          type="button"
          style={paused ? btnOn : btn}
          title="หยุดค้าง แล้วลากแถบ ตำแหน่ง ดูทีละจุด"
          onClick={() => setTuner({ enPause: paused ? 0 : 1 })}
        >
          <Ic icon={paused ? IconPlayerPlay : IconPlayerPause} />
          {paused ? 'เล่นต่อ' : 'หยุด'}
        </button>
        <button
          type="button"
          style={btn}
          title="คืนช่วงเป็นทั้งเส้น"
          onClick={() => setTuner({ enFrom: 0, enTo: 1 })}
        >
          <Ic icon={IconRestore} />เต็มเส้น
        </button>
      </div>
      {/* เริ่ม/จบ = ขอบของช่วงที่จะเล่น — ตั้งแล้วปุ่มเล่นจะวนซ้ำเฉพาะช่วงนี้ */}
      <label style={{ display: 'grid', gridTemplateColumns: '34px 1fr 34px', gap: 4, alignItems: 'center', cursor: 'pointer' }}>
        <span style={{ opacity: 0.7 }}>เริ่ม</span>
        {slider(from, (v) => setTuner({ enFrom: Math.min(v, to - 0.005) }))}
        <span style={{ opacity: 0.7 }}>{from.toFixed(2)}</span>
      </label>
      <label style={{ display: 'grid', gridTemplateColumns: '34px 1fr 34px', gap: 4, alignItems: 'center', cursor: 'pointer' }}>
        <span style={{ opacity: 0.7 }}>จบ</span>
        {slider(to, (v) => setTuner({ enTo: Math.max(v, from + 0.005) }))}
        <span style={{ opacity: 0.7 }}>{to.toFixed(2)}</span>
      </label>
      <label style={{ display: 'grid', gridTemplateColumns: '34px 1fr 34px', gap: 4, alignItems: 'center', cursor: paused ? 'pointer' : 'not-allowed' }}>
        <span style={{ opacity: paused ? 0.7 : 0.3 }}>ตำแหน่ง</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.005}
          value={t.enScrub}
          disabled={!paused}
          title={paused ? 'ลากดูทีละตำแหน่งในช่วงที่เลือก' : 'กดหยุดก่อนถึงจะลากได้'}
          onChange={(e) => setTuner({ enScrub: Number(e.target.value) })}
          style={{ cursor: paused ? 'pointer' : 'not-allowed', opacity: paused ? 1 : 0.3, accentColor: GREEN }}
        />
        <span style={{ opacity: paused ? 0.7 : 0.3 }}>{t.enScrub.toFixed(2)}</span>
      </label>
    </div>
  )
}

/** ช่อง A/B — จำค่าทั้งชุดไว้เทียบสองแบบสลับกันดูได้ทันที */
function Snapshot({ slot }) {
  const key = `${PANEL_KEY}.snap.${slot}`
  const [has, setHas] = useState(() => !!localStorage.getItem(key))
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      <button
        type="button"
        style={btn}
        title={`จำค่าปัจจุบันไว้ในช่อง ${slot}`}
        onClick={() => {
          localStorage.setItem(key, JSON.stringify(getTuner()))
          setHas(true)
        }}
      >
        จำ {slot}
      </button>
      <button
        type="button"
        style={{ ...btn, opacity: has ? 1 : 0.4 }}
        disabled={!has}
        title={`เรียกค่าจากช่อง ${slot}`}
        onClick={() => {
          try {
            setTuner(JSON.parse(localStorage.getItem(key)))
          } catch {
            /* ช่องว่าง */
          }
        }}
      >
        เรียก {slot}
      </button>
    </span>
  )
}

export function CameraTuner() {
  const [panel, setPanelState] = useState(loadPanel)
  const setPanel = (patch) => setPanelState((p) => {
    const next = { ...p, ...patch }
    savePanel(next)
    return next
  })
  const [q, setQ] = useState('')
  const [changedOnly, setChangedOnly] = useState(false)
  const [ref, setRef] = useState('off')
  const [opacity, setOpacity] = useState(0.5)
  const [crop, setCrop] = useState(false)
  const [stage, setStage] = useState(null)
  const [showCheck, setShowCheck] = useState(false)
  const t = useTuner()

  // ครอบจอเป็นอัตราส่วนของชีท — เขียนลง :root ให้หน้าเพจอ่านไปใช้
  useEffect(() => {
    document.documentElement.dataset.newheroCrop = crop ? 'on' : 'off'
    return () => {
      delete document.documentElement.dataset.newheroCrop
    }
  }, [crop])

  // ภาพ ref ต้องทาบ "เวที" ไม่ใช่ทาบวิวพอร์ต — พอเปิดกรอบ ref เวทีเล็กกว่าจอ
  useEffect(() => {
    setStage(document.getElementById('newhero-stage'))
  }, [])

  /**
   * กรอง: พิมพ์ค้นหาแล้วเหลือเฉพาะแถวที่ชื่อคีย์/คำอธิบาย/ชื่อกลุ่มตรง
   * เปิด "เฉพาะที่แก้" แล้วเหลือแถวที่ค่าไม่เท่าค่าเริ่มต้น — ใช้ตอนจะคัดลอกไปวาง
   * กำลังค้น = ทุกกลุ่มที่เจอถูกกางออกให้เลย ไม่ต้องไปกดเปิดทีละกลุ่ม
   */
  const query = q.trim().toLowerCase()
  const visible = useMemo(
    () =>
      GROUPS.map((g) => {
        const groupHit = query && g.name.toLowerCase().includes(query)
        const rows = g.rows.filter(([k, , , , unit]) => {
          if (changedOnly && isDefault(k, t[k])) return false
          if (!query || groupHit) return true
          return k.toLowerCase().includes(query) || (unit || '').toLowerCase().includes(query)
        })
        return { g, rows }
      }).filter(({ rows }) => rows.length > 0 || (!query && !changedOnly)),
    [query, changedOnly, t],
  )
  const filtering = !!query || changedOnly
  const changedCount = Object.keys(DEFAULTS).filter((k) => !isDefault(k, t[k])).length

  const copy = (onlyChanged) => {
    const keys = Object.keys(DEFAULTS).filter((k) => !onlyChanged || !isDefault(k, t[k]))
    const body = keys.map((k) => `  ${k}: ${t[k]},`).join('\n')
    navigator.clipboard?.writeText(onlyChanged ? body + '\n' : `export const DEFAULTS = {\n${body}\n}\n`)
  }

  const side = panel.side === 'left' ? { left: 12 } : { right: 12 }

  return (
    <>
      {ref !== 'off' &&
        stage &&
        createPortal(
          <img
            src={ref === 'sheet' ? '/dev/new-hero-ref-sheet.png' : '/dev/new-hero-ref-color.png'}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'fill',
              opacity,
              zIndex: 50,
              pointerEvents: 'none',
              mixBlendMode: ref === 'sheet' ? 'screen' : 'normal',
              filter: ref === 'sheet' ? 'invert(1) contrast(2)' : 'none',
            }}
          />,
          stage,
        )}
      {/**
       * data-lenis-prevent: หน้านี้อยู่ใต้ smooth scroll ของ Lenis ซึ่งดักล้อทั้งหน้า
       * แล้วขยับหน้าเอง แผงที่เลื่อนในตัวเองจึงไม่ได้รับล้อเลย — แอตทริบิวต์นี้คือทางออก
       * มาตรฐานของ Lenis สำหรับกล่องที่ต้องเลื่อนเองได้
       */}
      <div style={{ ...box, ...side, width: panel.collapsed ? 'auto' : box.width }} data-lenis-prevent>
        {/* หัวแผง: ยุบ/ขยาย, ย้ายข้าง — ไม่เลื่อนไปกับเนื้อหา */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px', borderBottom: panel.collapsed ? 0 : '1px solid rgba(255,255,255,0.1)' }}>
          <button
            type="button"
            onClick={() => setPanel({ collapsed: !panel.collapsed })}
            style={{ ...btn, border: 0, background: 'transparent', padding: '2px 4px', flex: 1, textAlign: 'left' }}
          >
            <Ic icon={panel.collapsed ? IconChevronRight : IconChevronDown} size={12} />
            <Ic icon={IconAdjustments} />
            ปรับฉาก /new-hero
            {changedCount > 0 && <span style={{ color: GREEN, marginLeft: 6 }}>●{changedCount}</span>}
          </button>
          {!panel.collapsed && (
            <button type="button" style={btn} title="ย้ายแผงไปอีกข้าง" onClick={() => setPanel({ side: panel.side === 'left' ? 'right' : 'left' })}>
              <Ic icon={panel.side === 'left' ? IconArrowRight : IconArrowLeft} />
            </button>
          )}
        </div>

        {!panel.collapsed && (
          <>
            {/* แถบเครื่องมือ: ค้นหา + ตัวกรอง + สวิตช์ที่ใช้บ่อย — ติดบนสุดตลอด */}
            <div style={{ display: 'grid', gap: 6, padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  type="search"
                  value={q}
                  placeholder="ค้นหาคีย์ / คำอธิบาย / กลุ่ม…"
                  onChange={(e) => setQ(e.target.value)}
                  style={{ ...field, flex: 1, padding: '4px 6px' }}
                />
                <button
                  type="button"
                  style={changedOnly ? btnOn : btn}
                  title="แสดงเฉพาะค่าที่ต่างจากค่าเริ่มต้น"
                  onClick={() => setChangedOnly((c) => !c)}
                >
                  <Ic icon={IconFilter} />ที่แก้
                </button>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {QUICK_TOGGLES.map(([k, label]) => <Toggle key={k} k={k} label={label} />)}
                <button type="button" style={showCheck ? btnOn : btn} onClick={() => setShowCheck((c) => !c)}>
                  <Ic icon={IconRuler} />ตรวจ/ref
                </button>
              </div>
              {!filtering && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" style={btn} onClick={() => setPanel({ open: Object.fromEntries(GROUPS.map((g) => [g.name, true])) })}>
                    <Ic icon={IconArrowsMaximize} />ขยายทั้งหมด
                  </button>
                  <button type="button" style={btn} onClick={() => setPanel({ open: {} })}>
                    <Ic icon={IconArrowsMinimize} />ย่อทั้งหมด
                  </button>
                </div>
              )}
            </div>

            <div style={{ overflowY: 'auto', display: 'grid', gap: 10, padding: 10, alignContent: 'start' }}>
              {showCheck && (
                <div style={{ display: 'grid', gap: 6 }}>
                  <Guides />
                  <Readout />
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {[
                      ['off', 'ปิด ref'],
                      ['sheet', 'ชีทเส้น'],
                      ['color', 'ภาพสี'],
                    ].map(([v, label]) => (
                      <button key={v} type="button" onClick={() => setRef(v)} style={ref === v ? btnOn : btn}>
                        {label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCrop((c) => !c)}
                      style={crop ? btnOn : btn}
                      title="ครอบจอเป็นอัตราส่วน 1199x735 เท่าชีท"
                    >
                      กรอบ ref
                    </button>
                  </div>
                  {ref !== 'off' && (
                    <label style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                      <span style={{ opacity: 0.72 }}>ความทึบ</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={opacity}
                        onChange={(e) => setOpacity(Number(e.target.value))}
                        style={{ cursor: 'pointer', accentColor: GREEN }}
                      />
                    </label>
                  )}
                </div>
              )}

              {visible.length === 0 && <div style={{ opacity: 0.5 }}>ไม่มีแถวที่ตรง</div>}
              {visible.map(({ g, rows }) => (
                <Group
                  key={g.name}
                  g={g}
                  rows={rows}
                  open={filtering || !!panel.open[g.name]}
                  onToggle={() => setPanel({ open: { ...panel.open, [g.name]: !panel.open[g.name] } })}
                />
              ))}
            </div>

            {/* ท้ายแผง: คัดลอก / คืนค่า / ช่อง A-B — ติดล่างตลอด */}
            <div style={{ display: 'grid', gap: 6, padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <button type="button" style={btn} onClick={() => copy(false)} title="คัดลอก DEFAULTS ทั้งก้อน วางทับใน tuner.js">
                  <Ic icon={IconCopy} />คัดลอกทั้งหมด
                </button>
                <button type="button" style={btn} onClick={() => copy(true)} title="คัดลอกเฉพาะบรรทัดที่ต่างจากค่าเริ่มต้น">
                  คัดลอกที่แก้ ({changedCount})
                </button>
                <button type="button" style={btn} onClick={resetTuner}>
                  <Ic icon={IconRestore} />คืนค่าเริ่มต้น
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ opacity: 0.5 }}>เทียบ</span>
                <Snapshot slot="A" />
                <Snapshot slot="B" />
              </div>
              <div style={{ opacity: 0.4, fontSize: 9.5 }}>
                ดับเบิลคลิกชื่อคีย์ = คืนค่าเดิม · shift+ลูกศรบนสไลเดอร์ = ก้าว ×10
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
