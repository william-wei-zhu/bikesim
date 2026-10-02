// A stylized low-poly bike + rider, rendered with three.js inside MapLibre as a custom 3D layer.
// Built from primitives (no model file): navy frame, green accents, spinning wheels, pedaling legs,
// leaning into turns, and a glow ring underneath tinted by the stress of the current street.
import * as THREE from "three";
import { MercatorCoordinate, type CustomLayerInterface, type Map as MLMap } from "maplibre-gl";

const NAVY = 0x082b54, GREEN = 0x1cae6d, TIRE = 0x17202b, RIDER = 0xf3f6fb, SKIN = 0xe9c9a8, CHROME = 0xb8c4d6;
const STRESS = [0x1cae6d, 0x1cae6d, 0x9bd65a, 0xf5a524, 0xe5484d];
const ON_SCREEN_PX = 150; // rider height on screen, independent of zoom

export interface BikeLayer extends CustomLayerInterface {
  setPose(pos: [number, number], headingDeg: number, lts: number, moving: boolean): void;
}

function tube(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

function wheel(mat: THREE.Material, spokeMat: THREE.Material) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.04, 10, 36), mat);
  tire.rotation.y = Math.PI / 2;
  g.add(tire);
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.64, 0.012), spokeMat);
    s.rotation.x = (i / 6) * Math.PI;
    g.add(s);
  }
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.1, 12).rotateZ(Math.PI / 2), spokeMat));
  return g;
}

/** Two-bone leg: hip to foot with a knee bending forward, in the bike's side (y-z) plane. */
function legPoints(hip: THREE.Vector3, foot: THREE.Vector3, thigh = 0.46, shin = 0.46) {
  const d = Math.min(hip.distanceTo(foot), thigh + shin - 1e-3);
  const a = Math.acos((thigh * thigh + d * d - shin * shin) / (2 * thigh * d));
  const dir = foot.clone().sub(hip).normalize();
  const perp = new THREE.Vector3(0, -dir.z, dir.y); // rotate in the y-z plane toward the front (-z)
  if (perp.z > 0) perp.negate();
  const knee = hip.clone().add(dir.multiplyScalar(Math.cos(a) * thigh)).add(perp.multiplyScalar(Math.sin(a) * thigh));
  return knee;
}

export function createBikeLayer(map: MLMap): BikeLayer {
  let renderer: THREE.WebGLRenderer;
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const root = new THREE.Group();       // positioned/rotated per frame
  const lean = new THREE.Group();       // roll into turns
  root.add(lean);
  scene.add(root);

  scene.add(new THREE.AmbientLight(0xffffff, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-0.6, 1, 0.8);
  scene.add(sun);

  const navy = new THREE.MeshStandardMaterial({ color: NAVY, metalness: 0.35, roughness: 0.35 });
  const green = new THREE.MeshStandardMaterial({ color: GREEN, metalness: 0.2, roughness: 0.4 });
  const tireMat = new THREE.MeshStandardMaterial({ color: TIRE, roughness: 0.8 });
  const chrome = new THREE.MeshStandardMaterial({ color: CHROME, metalness: 0.8, roughness: 0.25 });
  const riderMat = new THREE.MeshStandardMaterial({ color: RIDER, roughness: 0.6 });
  const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.7 });

  // Bike geometry in metres; forward is -z, up is +y.
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const rearHub = V(0, 0.34, 0.52), frontHub = V(0, 0.34, -0.53), bb = V(0, 0.3, 0.05);
  const seatTop = V(0, 0.92, 0.18), headTop = V(0, 0.92, -0.4), headBot = V(0, 0.72, -0.45);
  const frame = new THREE.Group();
  frame.add(tube(bb, seatTop, 0.025, navy), tube(seatTop, headTop, 0.024, navy), tube(bb, headBot, 0.03, navy),
    tube(bb, rearHub, 0.018, navy), tube(seatTop, rearHub, 0.016, navy), tube(headBot, headTop, 0.03, navy),
    tube(headBot, frontHub, 0.02, green));
  const bars = tube(V(-0.24, 1.0, -0.43), V(0.24, 1.0, -0.43), 0.016, chrome);
  const stem = tube(headTop, V(0, 1.0, -0.43), 0.02, navy);
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.04, 0.26), navy);
  saddle.position.set(0, 0.96, 0.2);
  frame.add(bars, stem, saddle);
  lean.add(frame);

  const rear = wheel(tireMat, chrome); rear.position.copy(rearHub);
  const front = wheel(tireMat, chrome); front.position.copy(frontHub);
  lean.add(rear, front);

  // Crank + rider (legs rebuilt each frame from the crank angle).
  const crank = new THREE.Group(); crank.position.copy(bb); lean.add(crank);
  const crankArm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.34, 0.03), chrome); crank.add(crankArm);
  const hip = V(0, 1.02, 0.14), shoulder = V(0, 1.42, -0.2);
  const torso = tube(hip, shoulder, 0.13, green); // jersey in the route green
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 14), skin); head.position.set(0, 1.6, -0.3);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), navy);
  helmet.position.set(0, 1.62, -0.29);
  const armL = tube(V(0.17, 1.4, -0.2), V(0.22, 1.02, -0.43), 0.045, riderMat);
  const armR = tube(V(-0.17, 1.4, -0.2), V(-0.22, 1.02, -0.43), 0.045, riderMat);
  lean.add(torso, head, helmet, armL, armR);
  const legGroup = new THREE.Group(); lean.add(legGroup);

  // Glow ring + soft shadow on the ground, tinted by stress.
  const ringMat = new THREE.MeshBasicMaterial({ color: STRESS[1], transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.15, 48).rotateX(-Math.PI / 2), ringMat);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.8, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x082b54, transparent: true, opacity: 0.25, depthWrite: false }));
  ring.position.y = 0.02; shadow.position.y = 0.01;
  root.add(shadow, ring);

  const pose = { pos: [0, 0] as [number, number], heading: 0, prevHeading: 0, lts: 1, moving: false, visible: false, at: 0 };
  let crankAngle = 0, wheelAngle = 0, roll = 0, last = performance.now(), pulse = 0;

  function rebuildLegs() {
    for (const c of legGroup.children) (c as THREE.Mesh).geometry.dispose();
    legGroup.clear();
    for (const side of [1, -1]) {
      const a = crankAngle + (side === 1 ? 0 : Math.PI);
      const foot = V(side * 0.1, bb.y + Math.cos(a) * 0.17, bb.z - Math.sin(a) * 0.17);
      const h = hip.clone().setX(side * 0.1);
      const knee = legPoints(h, foot);
      legGroup.add(tube(h, knee, 0.06, navy), tube(knee, foot, 0.045, riderMat));
    }
  }

  return {
    id: "rs-bike",
    type: "custom",
    renderingMode: "3d",
    onAdd(_map, gl) {
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },
    setPose(pos, headingDeg, lts, moving) {
      pose.prevHeading = pose.heading;
      pose.pos = pos; pose.heading = headingDeg; pose.lts = lts; pose.moving = moving; pose.visible = true; pose.at = performance.now();
      map.triggerRepaint();
    },
    render(_gl, args) {
      if (!pose.visible) return;
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const moving = pose.moving && now - pose.at < 250; // frames stop arriving when the ride is paused
      if (moving) { crankAngle += dt * 5.5; wheelAngle -= dt * 14; }
      rear.rotation.x = wheelAngle; front.rotation.x = wheelAngle; crank.rotation.x = -crankAngle;
      rebuildLegs();
      // Lean into turns (heading change rate), eased.
      const turn = ((pose.heading - pose.prevHeading + 540) % 360) - 180;
      roll += (THREE.MathUtils.clamp(-turn * 0.06, -0.35, 0.35) - roll) * 0.08;
      lean.rotation.z = roll;
      pulse += dt;
      ringMat.color.setHex(STRESS[pose.lts] ?? GREEN);
      ringMat.opacity = 0.4 + 0.2 * Math.sin(pulse * 3);

      // Place in Mercator space; scale so the rider stays ~ON_SCREEN_PX tall at any zoom.
      const mc = MercatorCoordinate.fromLngLat({ lng: pose.pos[0], lat: pose.pos[1] }, 0);
      const metresPerPx = (40075016.686 * Math.cos((pose.pos[1] * Math.PI) / 180)) / (512 * Math.pow(2, map.getZoom()));
      const s = mc.meterInMercatorCoordinateUnits() * ((metresPerPx * ON_SCREEN_PX) / 1.75);
      const transform = new THREE.Matrix4()
        .makeTranslation(mc.x, mc.y, mc.z)
        .scale(new THREE.Vector3(s, -s, s))
        .multiply(new THREE.Matrix4().makeRotationZ((-pose.heading * Math.PI) / 180))
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
      camera.projectionMatrix = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix as unknown as number[]).multiply(transform);
      renderer.resetState();
      renderer.render(scene, camera);
      if (moving) map.triggerRepaint();
    },
    onRemove() { renderer?.dispose(); },
  };
}
