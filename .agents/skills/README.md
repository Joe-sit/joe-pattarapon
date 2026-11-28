# สารบัญ skills

ทุก skill อยู่ในโฟลเดอร์นี้ ตัวไฟล์ `SKILL.md` ของแต่ละอันเป็น "หน้าสารบัญ"
เนื้อจริงอยู่ใน `references/` ส่วน `scripts/` เป็นตัวสร้างโค้ดอัตโนมัติ (Python)

อ่านยังไง: เปิด `SKILL.md` ก่อนเพื่อดูขอบเขต แล้วค่อยเปิดเฉพาะไฟล์ใน
`references/` ที่ตรงกับงาน — ไม่ต้องอ่านทั้งโฟลเดอร์

ที่มา: `npx skills add emalorenzo/three-agent-skills` (สองอันแรก) และ
`npx skills add freshtechbro/claudedesignskills` (ที่เหลือ)
`npx skills list` ดูว่ามีอะไรบ้าง และ agent ตัวไหนเห็น

> Skill รันด้วยสิทธิ์เต็มของ agent และมาจาก repo ภายนอก ยังไม่ได้ตรวจเนื้อในทีละไฟล์

---

## ใช้กับงานในรีโปนี้ (บังคับอ่านก่อนแตะโค้ด 3D)

CLAUDE.md บังคับไว้: ก่อนเขียนหรือแก้โค้ด three.js / r3f ต้องโหลดสองอันนี้ก่อน

| skill | เนื้อหา |
| --- | --- |
| [three-best-practices](three-best-practices/) | กฎ three.js ล้วน — geometry, material, การ dispose, การโหลด, frame loop `rules/` คือเนื้อจริง `SKILL.md` เป็นแค่ดัชนี |
| [r3f-best-practices](r3f-best-practices/) | กฎ r3f 70+ ข้อ 12 หมวด เรียงตามผลกระทบ เรื่องใหญ่สุดคือ re-render (`perf-`) และ `useFrame` (`frame-`) |

จำสองข้อนี้ไว้ก่อนเลย เพราะเป็นต้นเหตุปัญหาส่วนใหญ่:

- ห้าม `setState` ใน `useFrame` — เขียนลง ref ตรง ๆ
- อ่านค่าจาก store ด้วย selector ไม่ใช่ทั้งก้อน หรือดึงด้วย `getState()` ใน `useFrame` ไปเลย

---

## 3D / WebGL

| skill | ใช้เมื่อ | ไฟล์ที่มักได้ใช้ |
| --- | --- | --- |
| [react-three-fiber](react-three-fiber/) | ฉาก 3D แบบ declarative ใน React — configurator, portfolio, viz | `references/api_reference.md` |
| [threejs-webgl](threejs-webgl/) | three.js ดิบ — scene, camera, material, light, texture | `references/materials_guide.md`, `references/optimization_checklist.md` |
| [babylonjs-engine](babylonjs-engine/) | ทางเลือกแทน three — มี editor และฟีเจอร์เกมในตัว | `references/api_reference.md` |
| [playcanvas-engine](playcanvas-engine/) | เกมบนเบราว์เซอร์ entity-component + editor-first | `references/optimization_guide.md` |
| [aframe-webxr](aframe-webxr/) | VR / AR / 360° เขียนเป็น HTML | `references/webxr_guide.md` |
| [spline-interactive](spline-interactive/) | ปั้น 3D ในเครื่องมือ visual แล้ว export เข้า React | `references/api_reference.md` |
| [lightweight-3d-effects](lightweight-3d-effects/) | ของประดับที่ไม่อยากลาก WebGL เต็ม ๆ มา — Zdog, Vanta, tilt | `references/tilt_patterns.md` |
| [pixijs-2d](pixijs-2d/) | 2D เร่งด้วย WebGL — sprite เยอะ ๆ, particle, filter | `references/performance_guide.md` |
| [web3d-integration-patterns](web3d-integration-patterns/) | เอาหลายไลบรารีมาต่อกัน (three + gsap + motion) สถาปัตยกรรมและ state | ไฟล์เดียวจบ |

## แอนิเมชัน / สกรอลล์

| skill | ใช้เมื่อ | ไฟล์ที่มักได้ใช้ |
| --- | --- | --- |
| [gsap-scrolltrigger](gsap-scrolltrigger/) | timeline, scrub, pin, parallax, ผูกสกรอลล์กับ three | `references/common_patterns.md`, `references/easing_guide.md` |
| [motion-framer](motion-framer/) | Motion (Framer Motion) — variants, gesture, layout, `AnimatePresence` | `references/api_reference.md` |
| [react-spring-physics](react-spring-physics/) | สปริงจริงตามฟิสิกส์ ลาก/ดีด/inertia | `references/physics_guide.md` |
| [animejs](animejs/) | timeline และ SVG morph ไม่ผูกกับ React | `references/timeline_guide.md`, `references/stagger_guide.md` |
| [locomotive-scroll](locomotive-scroll/) | smooth scroll + parallax ต่อกับ ScrollTrigger ได้ | `references/gsap_integration.md` |
| [scroll-reveal-libraries](scroll-reveal-libraries/) | AOS — fade/slide ง่าย ๆ ไม่ต้องคุม timeline | `references/animation_catalog.md` |
| [barba-js](barba-js/) | เปลี่ยนหน้าแบบ SPA มี transition hook | `references/transition_patterns.md` |
| [lottie-animations](lottie-animations/) | ไฟล์ JSON จาก After Effects, ไอคอนขยับ | `references/performance_guide.md` |
| [rive-interactive](rive-interactive/) | เหมือน Lottie แต่มี state machine และรับ input ได้ | `references/api_reference.md` |

## ดีไซน์ / คอมโพเนนต์

| skill | ใช้เมื่อ | ไฟล์ที่มักได้ใช้ |
| --- | --- | --- |
| [modern-web-design](modern-web-design/) | เทรนด์ 2024–25, micro-interaction, glassmorphism, a11y, งบ performance | `references/interaction_patterns.md`, `references/accessibility_guide.md` |
| [animated-component-libraries](animated-component-libraries/) | หยิบคอมโพเนนต์สำเร็จจาก Magic UI / React Bits (Tailwind + Motion) | `references/magic_ui_components.md` |

## ไปป์ไลน์แอสเซต

| skill | ใช้เมื่อ | ไฟล์ที่มักได้ใช้ |
| --- | --- | --- |
| [blender-web-pipeline](blender-web-pipeline/) | export glTF, ลดขนาดโมเดล, ทำ LOD, สคริปต์ `bpy` | `references/gltf_export_guide.md`, `references/optimization_strategies.md` |
| [substance-3d-texturing](substance-3d-texturing/) | PBR texture, export preset สำหรับเว็บ, ย่อไฟล์ | `references/pbr_channel_guide.md`, `references/export_presets.md` |

## เครื่องมือ

| skill | ใช้เมื่อ |
| --- | --- |
| [skill-creator](skill-creator/) | เขียน skill ของตัวเอง |
| [caveman](caveman/) + `caveman-*`, [cavecrew](cavecrew/) | โหมดตอบสั้น และ subagent ชุดของมัน |

---

## เลือกอันไหนดี

- ฉากใน `src/newhero/` หรือ `src/joespresso/` → `three-best-practices` + `r3f-best-practices`
  ก่อนเสมอ แล้วค่อยเปิด `react-three-fiber` / `threejs-webgl` ถ้าต้องการ API
- อยากผูกสกรอลล์กับกล้อง → `gsap-scrolltrigger` คู่กับ `web3d-integration-patterns`
- อยากได้ UI ขยับ ไม่ใช่ 3D → `motion-framer` ถ้าคุมท่าเอง, `react-spring-physics` ถ้าอยากได้ความรู้สึกจริง
- โมเดลใน `public/models/` หนักไป → `blender-web-pipeline`
