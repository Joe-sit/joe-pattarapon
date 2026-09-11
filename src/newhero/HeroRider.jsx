import { useTuner } from './tuner'
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

export function HeroRider({ legPose = null, torsoPose = null, ...rest }) {
  const t = useTuner()
  return (
    <Rider
      {...rest}
      lumberArms={{ on: t.la > 0.5, scale: t.laScale }}
      print={{ on: t.shp > 0.5, size: t.shpSize, seed: t.shpSeed }}
      wind={{
        on: t.wnd > 0.5,
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
      bob={t.idle > 0.5}
      breathe={t.breathe > 0.5}
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
      wheelSpin={t.bdSpin}
      wheelSkin={{ cell: t.bdBlob, level: t.bdBlobMix, seed: Math.round(t.bdBlobSeed) }}
      wheelDbg={t.bdWhDbg}
      followOverride={{
        headYaw: t.hf > 0.5 ? t.hfYaw : 0,
        headPitch: t.hf > 0.5 ? t.hfPitch : 0,
        headRoll: t.hf > 0.5 ? t.hfRoll : 0,
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
        lookEvery: t.fcLookEvery,
        blinkEvery: t.fcBlinkEvery,
      }}
      torsoPose={torsoPose}
      legPose={legPose}
      armPose={{
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
      }}
    />
  )
}
