import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { getTuner, useTuner } from './tuner'
import { Rider } from './Rider'

/**
 * ตัวละครของฉาก hero พร้อมค่าที่จูนไว้ทั้งชุด — แหล่งเดียวสำหรับทุกหน้า
 *
 * แยกออกมาจาก NewHeroScene เพราะจอ Experiences ต้องใช้ "ตัวเดียวกับ hero ของ /2026-final"
 * จริง ๆ ไม่ใช่ Mascot เปล่า ๆ: ตัวใน hero มีแขน lumberjack, ลายเสื้อ, รองเท้า, rim light,
 * ท่าสเก็ต และค่าทั้งหมดมาจากแผงจูน — ถ้าคัดลอกรายการ prop ไปไว้อีกที่ วันหนึ่งจะจูน
 * ที่เดียวแล้วอีกหน้าไม่ตาม
 *
 * `legPose` / `torsoPose` เป็นวัตถุที่ LegDrive ของฉาก hero เขียนทุกเฟรม หน้าอื่นไม่มีตัวขับ
 * จึงปล่อยเป็น null ได้ (Rider ใช้ค่าเริ่มต้นของท่าเอง)
 */
const RAD = Math.PI / 180

/** ท่าแขนจากค่าในแผงจูน — แยกออกมาให้ JSX ข้างล่างสั้นลง ค่าทั้งชุดยังมาจากที่เดียว */
function armPoseFromTuner(t) {
  return {
  /* เลื่อนโคนแขน — ไม่ใช่องศา จึงไม่คูณ RAD */
  aimOut: t.aimOut,
  aimUp: t.aimUp,
  aimFwd: t.aimFwd,
  mugOut: t.mugOut,
  mugUp: t.mugUp,
  mugFwd: t.mugFwd,
  aimRotX: t.aimRotX * RAD,
  aimRotY: t.aimRotY * RAD,
  aimRotZ: t.aimRotZ * RAD,
  mugRotX: t.mugRotX * RAD,
  mugRotY: t.mugRotY * RAD,
  mugRotZ: t.mugRotZ * RAD,
  aimX: t.aimX,
  aimY: t.aimY,
  aimZ: t.aimZ,
  elbowX: t.elbowX * RAD,
  elbowY: t.elbowY * RAD,
  elbowZ: t.elbowZ * RAD,
  handScale: t.handScale,
  handX: t.handX,
  handY: t.handY,
  handZ: t.handZ,
  wristX: t.wristX * RAD,
  wristY: t.wristY * RAD,
  wristZ: t.wristZ * RAD,
  mugShX: t.mugShX * RAD,
  mugShY: t.mugShY * RAD,
  mugShZ: t.mugShZ * RAD,
  mugHandScale: t.mugHandScale,
  mugHandX: t.mugHandX,
  mugHandY: t.mugHandY,
  mugHandZ: t.mugHandZ,
  mugWristX: t.mugWristX * RAD,
  mugWristY: t.mugWristY * RAD,
  mugWristZ: t.mugWristZ * RAD,
  mugElX: t.mugElX * RAD,
  mugElY: t.mugElY * RAD,
  mugElZ: t.mugElZ * RAD,
  }
}

/**
 * @param props - noWind: ปิดลมที่พัดเสื้อ สำหรับจอที่ไม่ต้องการให้ผ้าปริว (ดู
 *   sections/whatidopixel) ส่งเป็น prop `wind` เองไม่ได้ เพราะ {...rest} ถูกกระจายก่อน
 *   แล้วค่าจากแผงจูนทับทีหลัง
 * @param props - noIdle: ปิดทุกอย่างที่ขยับเองตอนตัวอยู่นิ่ง — ไหวทั้งตัว (bob) ไหวข้อต่อ
 *   (breathe) ล้อหมุน กระพริบตา/กวาดตา และหัวตามเมาส์ เหตุผลเดียวกับ noWind
 */
export function HeroRider({
  legPose = null,
  torsoPose = null,
  /**
   * ทับท่าแขน/ทิศหัวทั้งชุด — ต้องเป็น prop ของตัวเอง ไม่ใช่ส่งผ่าน `rest`
   *
   * `rest` ถูกกระจายก่อนแล้วบรรทัดข้างล่างเขียนทับทุกครั้ง ค่าที่ส่งมาจึงไม่มีผลเลย
   * ที่ต้องมีคือโต๊ะส่งออกริก (หน้า /rig-export) ซึ่งต้องได้ "ตัวละครชุดเดียวกับ hero
   * ทุกชิ้น" แต่จัดเป็นท่า T — ถ้าไปคัดลอกรายการ prop ของที่นี่ไปไว้อีกที่ วันหนึ่งจะจูน
   * ที่เดียวแล้วไฟล์ที่ส่งออกไม่ใช่ตัวเดียวกันอีก
   */
  armPose = null,
  followOverride = null,
  noWind = false,
  noIdle = false,
  noLumber = false,
  ...rest
}) {
  const t = useTuner()
  /**
   * ท่าลำตัว/ขาจากแผงจูน สำหรับจอที่ไม่มีตัวขับท่าของตัวเอง
   *
   * ฉาก hero มี LegDrive ที่ผสมค่าจากแผงจูนกับการย่อรับแรงของการไถล (ridePose.crouch) แล้ว
   * เขียนลงวัตถุใบเดิมทุกเฟรม จอที่ไม่มีการไถล (what-i-do, Experiences) เคยปล่อย legPose /
   * torsoPose เป็น null ผลคือกลุ่ม "ลำตัว" กับ "ขา" ในแผงจูนลากแล้วตัวไม่ขยับ — ค่าที่จูนไว้
   * ไม่ถูกใช้เลย ตัวในจอนั้นจึงไม่ใช่ท่าเดียวกับ hero จริง ทั้งที่บอกว่าเป็นตัวเดียวกัน
   *
   * ที่นี่ = LegDrive ที่ถอดส่วนการย่อออก (crouch = 0) เขียนวัตถุใบเดิมเหมือนกัน ไม่สร้างใหม่
   * ต่อเฟรม และลำดับ -900 เท่ากัน เพื่อให้เขียนเสร็จก่อนที่ริกจะอ่านในเฟรมเดียวกัน
   */
  const ownLeg = useRef({
    spread: 0,
    stagger: 0,
    L: { hipX: 0, hipY: 0, hipZ: 0, knee: 0, ankle: 0 },
    R: { hipX: 0, hipY: 0, hipZ: 0, knee: 0, ankle: 0 },
  }).current
  const ownTorso = useRef({ leanX: 0, leanZ: 0, foldX: 0, foldY: 0, foldZ: 0, headX: 0 }).current
  const own = !legPose && !torsoPose
  useFrame(() => {
    if (!own) return
    const tt = getTuner()
    ownTorso.leanX = tt.leanX * RAD
    ownTorso.leanZ = tt.leanZ * RAD
    ownTorso.foldX = tt.foldX * RAD
    ownTorso.foldY = tt.foldY * RAD
    ownTorso.foldZ = tt.foldZ * RAD
    ownTorso.headX = tt.headX * RAD
    ownLeg.spread = tt.legSpread
    ownLeg.stagger = tt.legStagger
    ownLeg.L.hipX = tt.hipLX * RAD
    ownLeg.L.hipY = tt.hipLY * RAD
    ownLeg.L.hipZ = tt.hipLZ * RAD
    ownLeg.L.knee = tt.kneeL * RAD
    ownLeg.L.ankle = tt.ankleL * RAD
    ownLeg.R.hipX = tt.hipRX * RAD
    ownLeg.R.hipY = tt.hipRY * RAD
    ownLeg.R.hipZ = tt.hipRZ * RAD
    ownLeg.R.knee = tt.kneeR * RAD
    ownLeg.R.ankle = tt.ankleR * RAD
  }, -900)
  return (
    <Rider
      {...rest}
      /**
       * noLumber: ปิดแขนจากโมเดล lumberjack
       *
       * ท่อนแขนชุดนั้นถูก *แขวน* บนข้อต่อด้วยระยะที่วัดจากท่าสเก็ต พอหมุนไหล่ไปไกลจากท่านั้น
       * (เช่นท่ายืนแขนห้อยของจอ what-i-do) ชิ้นแขนจะเหลื่อมกันเห็นรอยต่อที่ศอก จอที่จัดท่า
       * แขนใหม่จึงใช้แขนของริกเองซึ่งขยับตามข้อต่อได้ทุกท่า
       */
      lumberArms={{ on: !noLumber && t.la > 0.5, scale: t.laScale }}
      print={{ on: t.shp > 0.5, size: t.shpSize, seed: t.shpSeed }}
      wind={{
        on: !noWind && t.wnd > 0.5,
        amp: t.wndAmp,
        freq: t.wndFreq,
        speed: t.wndSpd,
        dir: t.wndDir,
        cloth: t.wndCloth,
      }}
      shoe={{
        scale: t.snScale,
        pos: [t.snX, t.snY, t.snZ],
        rot: [t.snRotX * RAD, t.snRotY * RAD, t.snRotZ * RAD],
      }}
      bob={!noIdle && t.idle > 0.5}
      breathe={!noIdle && t.breathe > 0.5}
      idleAmp={t.idleAmp}
      idleSpeed={t.idleSpeed}
      rimPower={t.rimPower}
      rimBoost={t.rimBoost}
      rimEdge={t.rimEdge}
      rimSoft={t.rimSoft}
      rimDirMix={t.rimDirMix}
      rimYaw={t.rimYaw}
      rimPitch={t.rimPitch}
      flatBands={t.flatBands}
      mascotScale={t.mascotScale}
      mascotLift={t.mascotLift}
      boardScale={t.boardScale}
      armScale={t.armScale}
      foreScale={t.foreScale}
      boardRot={[t.boardRotX * RAD, t.boardRotY * RAD, t.boardRotZ * RAD]}
      boardOffset={[t.boardX, t.boardY, t.boardZ]}
      boardSpec={{
        deckLen: t.bdLen,
        deckWide: t.bdWide,
        deckThick: t.bdThick,
        kickStart: t.bdKickAt,
        kickH: t.bdKick,
        concave: t.bdConcave,
        truckX: t.bdTruckX,
        wheelR: t.bdWheelR,
        wheelW: t.bdWheelW,
        deckY: t.bdRideY,
      }}
      /* noIdle: ล้อหยุดหมุนด้วย — ในพอร์ทัลพิกเซลล้อที่หมุนทำให้บล็อกแถวล่างกระพริบ */
      wheelSpin={noIdle ? 0 : t.bdSpin}
      wheelSkin={{ cell: t.bdBlob, level: t.bdBlobMix, seed: Math.round(t.bdBlobSeed) }}
      wheelDbg={t.bdWhDbg}
      followOverride={followOverride ?? {
        /* noIdle: หัวไม่ตามเมาส์ — ค้างที่ท่าตั้งต้น (headBase*) */
        headYaw: !noIdle && t.hf > 0.5 ? t.hfYaw : 0,
        headPitch: !noIdle && t.hf > 0.5 ? t.hfPitch : 0,
        headRoll: !noIdle && t.hf > 0.5 ? t.hfRoll : 0,
        headEase: t.hfEase,
        headBaseYaw: t.hfBaseYaw,
        headBaseRoll: t.hfBaseRoll,
        headBasePitch: t.hfBasePitch,
        headFollow: t.hfFollow,
        headCurve: t.hfCurve,
        headDead: t.hfDead,
        headBounce: t.hfBounce,
        headIdleBack: t.hfIdleBack,
      }}
      facePose={{
        eye: t.fcEye,
        gap: t.fcGap,
        eyeY: t.fcEyeY,
        pupil: t.fcPupil,
        pupilX: t.fcPupilX,
        pupilY: t.fcPupilY,
        look: t.fcLook,
        brow: t.fcBrow,
        browY: t.fcBrowY,
        browArc: t.fcBrowArc,
        browTilt: t.fcBrowTilt * RAD,
        mouth: t.fcMouth,
        mouthH: t.fcMouthH,
        mouthX: t.fcMouthX,
        mouthY: t.fcMouthY,
        x: t.fcX,
        y: t.fcY,
        z: t.fcZ,
        rotX: t.fcRotX * RAD,
        rotY: t.fcRotY * RAD,
        rotZ: t.fcRotZ * RAD,
        scale: t.fcScale,
        /* noIdle: 0 = ปิดกวาดตา/กระพริบถาวร (ดูที่ดักไว้ใน Mascot) หน้าค้างท่าที่จูนไว้ */
        lookEvery: noIdle ? 0 : t.fcLookEvery,
        blinkEvery: noIdle ? 0 : t.fcBlinkEvery,
      }}
      torsoPose={torsoPose ?? ownTorso}
      legPose={legPose ?? ownLeg}
      armPose={armPose ?? armPoseFromTuner(t)}
    />
  )
}
