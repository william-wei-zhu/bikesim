// A detailed procedural commuter bike + rider (male or female), rendered with three.js.
// Built from primitives (no model files): spoked wheels with disc brakes, a working drivetrain, rack and pannier,
// head and blinking tail lights, and a rider whose arms reach the grips and legs follow the pedals.
// Shared by the MapLibre custom layer (3D view) and a transparent overlay above Street View.
import * as THREE from "three";
import { MercatorCoordinate, type CustomLayerInterface, type Map as MLMap } from "maplibre-gl";

export type RiderStyle = "male" | "female";

const C = {
  navy: 0x082b54, green: 0x1cae6d, sky: 0x3eb3fe, tire: 0x1b1f24, rim: 0xc9d2de, steel: 0x8e9aab, chain: 0x3a4048,
  saddle: 0x15191e, grip: 0x22262c, white: 0xf5f7fa, shoe: 0x1d2530, shoeSole: 0xeef3fb,
};
const STRESS = [0x1cae6d, 0x1cae6d, 0x9bd65a, 0xf5a524, 0xe5484d];
/** Rider height on screen in the 3D view, independent of map zoom: 19% of the map height on landscape screens,
 * 27% on portrait phones (where the old fixed 150 px looked tiny). */
const riderPx = (w: number, h: number) => Math.max(150, Math.min(280, h * (w < h ? 0.27 : 0.19)));

interface RiderSpec {
  jersey: number; stripe: number; legs: number; legsToAnkle: boolean; skin: number; hair: number;
  shoulderW: number; hipW: number; shoulderY: number; ponytail: boolean;
}
const RIDERS: Record<RiderStyle, RiderSpec> = {
  male: { jersey: C.green, stripe: C.navy, legs: C.navy, legsToAnkle: false, skin: 0xb98563, hair: 0x2e2119, shoulderW: 0.205, hipW: 0.1, shoulderY: 1.45, ponytail: false },
  female: { jersey: C.sky, stripe: C.navy, legs: C.navy, legsToAnkle: true, skin: 0xe2b48f, hair: 0x5a3a22, shoulderW: 0.175, hipW: 0.108, shoulderY: 1.41, ponytail: true },
};

const Y = new THREE.Vector3(0, 1, 0);
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const std = (color: number, rough = 0.5, metal = 0, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });

/** A limb segment: unit cylinder stretched between two points (reused every frame, no new geometry). */
class Segment {
  mesh: THREE.Mesh;
  constructor(radius: number, mat: THREE.Material, radiusB = radius) {
    this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusB, radius, 1, 14), mat);
  }
  place(a: THREE.Vector3, b: THREE.Vector3) {
    const d = b.clone().sub(a);
    this.mesh.position.copy(a).addScaledVector(d, 0.5);
    this.mesh.scale.set(1, d.length(), 1);
    this.mesh.quaternion.setFromUnitVectors(Y, d.normalize());
  }
}
function joint(r: number, mat: THREE.Material) { return new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat); }
function tube(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material, rB = r) {
  const s = new Segment(r, mat, rB); s.place(a, b); return s.mesh;
}

/** Two-bone IK in 3D: returns the middle joint, bending toward `bendDir`. */
function solveJoint(root: THREE.Vector3, end: THREE.Vector3, l1: number, l2: number, bendDir: THREE.Vector3) {
  const dir = end.clone().sub(root);
  const d = Math.min(dir.length(), l1 + l2 - 1e-3);
  dir.normalize();
  const a = Math.acos(THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const perp = bendDir.clone().sub(dir.clone().multiplyScalar(bendDir.dot(dir))).normalize();
  return root.clone().addScaledVector(dir, Math.cos(a) * l1).addScaledVector(perp, Math.sin(a) * l1);
}

function wheel(rimMat: THREE.Material, tireMat: THREE.Material, spokeMat: THREE.Material, rotorMat: THREE.Material) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.034, 12, 48), tireMat); tire.rotation.y = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.014, 8, 48), rimMat); rim.rotation.y = Math.PI / 2;
  g.add(tire, rim);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, side = i % 2 ? 0.018 : -0.018;
    g.add(tube(V(side, 0, 0), V(0, Math.cos(a) * 0.295, Math.sin(a) * 0.295), 0.0028, spokeMat));
  }
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.09, 12).rotateZ(Math.PI / 2), spokeMat));
  const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.004, 24).rotateZ(Math.PI / 2), rotorMat);
  rotor.position.x = -0.045; g.add(rotor);
  return g;
}

/** Bike + rider scene, animated by update(); root is turned by the overlay's look-around. */
function createBikeModel(style: RiderStyle) {
  const R = RIDERS[style];
  const scene = new THREE.Scene();
  const root = new THREE.Group();   // turned for look-around
  const lean = new THREE.Group();   // roll into turns
  root.add(lean); scene.add(root);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8ea7c4, 1.35));
  const sun = new THREE.DirectionalLight(0xffffff, 2.3); sun.position.set(-0.7, 1.2, 0.9); scene.add(sun);
  const rimLight = new THREE.DirectionalLight(0xbfe3fb, 0.9); rimLight.position.set(0.8, 0.6, -1); scene.add(rimLight);

  const M = {
    frame: std(C.navy, 0.28, 0.45), accent: std(C.green, 0.35, 0.2), decal: std(C.white, 0.4),
    tire: std(C.tire, 0.85), rim: std(C.rim, 0.25, 0.85), steel: std(C.steel, 0.3, 0.8), chain: std(C.chain, 0.5, 0.6),
    saddle: std(C.saddle, 0.6), grip: std(C.grip, 0.8), pannier: std(C.navy, 0.75), reflect: std(0xe6f0ff, 0.2, 0.3, { emissive: 0x334455 }),
    headlight: std(0xffffff, 0.2, 0, { emissive: 0xfff6d8, emissiveIntensity: 1.4 }),
    taillight: std(0xe5484d, 0.3, 0, { emissive: 0xff2a2a, emissiveIntensity: 1.2 }),
    bottle: std(C.green, 0.3, 0, { transparent: true, opacity: 0.92 }),
    jersey: std(R.jersey, 0.6), stripe: std(R.stripe, 0.6), legs: std(R.legs, 0.7), skin: std(R.skin, 0.65),
    hair: std(R.hair, 0.8), helmet: std(C.navy, 0.3, 0.1), helmetAccent: std(R.jersey, 0.35), lens: std(0x111418, 0.1, 0.6),
    glove: std(0x1d2530, 0.7), sock: std(C.white, 0.7), shoe: std(C.shoe, 0.5), sole: std(C.shoeSole, 0.6),
  };

  // ---------- bike (metres; forward is -z, up is +y) ----------
  const rearHub = V(0, 0.335, 0.5), frontHub = V(0, 0.335, -0.53), bb = V(0, 0.29, 0.06);
  const seatTop = V(0, 0.84, 0.2), headTop = V(0, 0.88, -0.38), headBot = V(0, 0.7, -0.44);
  const bike = new THREE.Group(); lean.add(bike);
  bike.add(
    tube(bb, seatTop, 0.022, M.frame, 0.026), tube(seatTop, headTop, 0.02, M.frame, 0.024), tube(bb, headBot, 0.032, M.frame, 0.026),
    tube(V(0.03, 0.29, 0.06), V(0.03, 0.335, 0.5), 0.012, M.frame), tube(V(-0.03, 0.29, 0.06), V(-0.03, 0.335, 0.5), 0.012, M.frame),
    tube(V(0.025, 0.84, 0.2), V(0.03, 0.335, 0.5), 0.011, M.frame), tube(V(-0.025, 0.84, 0.2), V(-0.03, 0.335, 0.5), 0.011, M.frame),
    tube(headBot, headTop, 0.032, M.frame),
    tube(V(0.03, 0.7, -0.44), V(0.035, 0.335, -0.53), 0.014, M.accent), tube(V(-0.03, 0.7, -0.44), V(-0.035, 0.335, -0.53), 0.014, M.accent),
  );
  // decals: green band on the down tube, white band on the top tube
  bike.add(tube(V(0, 0.42, -0.08), V(0, 0.5, -0.17), 0.034, M.accent), tube(V(0, 0.865, -0.02), V(0, 0.87, -0.12), 0.026, M.decal));
  // seatpost + shaped saddle
  bike.add(tube(seatTop, V(0, 0.93, 0.225), 0.014, M.steel));
  const saddle = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), M.saddle);
  saddle.scale.set(0.075, 0.025, 0.14); saddle.position.set(0, 0.95, 0.2); bike.add(saddle);
  // stem, riser bar, grips, brake levers
  const barL = V(0.23, 0.99, -0.47), barR = V(-0.23, 0.99, -0.47);
  bike.add(tube(headTop, V(0, 0.98, -0.45), 0.018, M.frame), tube(barL, barR, 0.012, M.steel));
  for (const s of [1, -1]) {
    bike.add(tube(V(s * 0.17, 0.99, -0.47), V(s * 0.25, 0.99, -0.47), 0.018, M.grip));
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.08), M.steel);
    lever.position.set(s * 0.17, 0.97, -0.51); bike.add(lever);
  }
  // headlight + taillight
  const headlight = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.05, 16).rotateX(Math.PI / 2), M.headlight);
  headlight.position.set(0, 0.93, -0.5); bike.add(headlight);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.02), M.taillight);
  tail.position.set(0, 0.62, 0.66); bike.add(tail);
  // bottle on the down tube
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.2, 14), M.bottle);
  bottle.position.set(0, 0.5, -0.1); bottle.rotation.x = -0.75; bike.add(bottle);
  // rear rack + pannier with reflective strip
  bike.add(tube(V(0.045, 0.6, 0.62), V(0.03, 0.34, 0.5), 0.007, M.steel), tube(V(-0.045, 0.6, 0.62), V(-0.03, 0.34, 0.5), 0.007, M.steel),
    tube(V(0.04, 0.6, 0.3), V(0.04, 0.6, 0.64), 0.007, M.steel), tube(V(-0.04, 0.6, 0.3), V(-0.04, 0.6, 0.64), 0.007, M.steel));
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.26, 0.3), M.pannier); bag.position.set(0.11, 0.5, 0.49);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.03, 0.28), M.reflect); strip.position.set(0.177, 0.55, 0.49);
  bike.add(bag, strip);
  // wheels
  const rear = wheel(M.rim, M.tire, M.steel, M.steel); rear.position.copy(rearHub);
  const front = wheel(M.rim, M.tire, M.steel, M.steel); front.position.copy(frontHub);
  bike.add(rear, front);
  // drivetrain: chainring, rear cog, chain runs
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.009, 8, 32), M.chain); ring.rotation.y = Math.PI / 2; ring.position.set(-0.055, bb.y, bb.z);
  const cog = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.007, 8, 24), M.chain); cog.rotation.y = Math.PI / 2; cog.position.set(-0.05, rearHub.y, rearHub.z);
  bike.add(ring, cog,
    tube(V(-0.052, bb.y + 0.09, bb.z), V(-0.05, rearHub.y + 0.04, rearHub.z), 0.004, M.chain),
    tube(V(-0.052, bb.y - 0.09, bb.z), V(-0.05, rearHub.y - 0.04, rearHub.z), 0.004, M.chain));
  // cranks + pedals (animated)
  const crankL = new Segment(0.012, M.steel), crankR = new Segment(0.012, M.steel);
  const pedalL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.015, 0.06), M.chain), pedalR = pedalL.clone();
  bike.add(crankL.mesh, crankR.mesh, pedalL, pedalR);

  // ---------- rider ----------
  const rider = new THREE.Group(); lean.add(rider);
  const hip = V(0, 1.0, 0.17), chest = V(0, R.shoulderY - 0.05, -0.08), neck = V(0, R.shoulderY + 0.05, -0.16);
  rider.add(tube(hip, chest, 0.12, M.jersey, 0.14)); // torso, wider at the chest
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), M.jersey);
  shoulders.scale.set(R.shoulderW + 0.03, 0.08, 0.1); shoulders.position.set(0, R.shoulderY - 0.02, -0.1); rider.add(shoulders);
  const stripe = tube(V(0, 1.06, 0.12), V(0, R.shoulderY - 0.06, -0.06), 0.124, M.stripe, 0.142); // jersey side stripe
  stripe.scale.x = 0.25; rider.add(stripe);
  const hips = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), M.legs); hips.scale.set(R.hipW + 0.06, 0.08, 0.1); hips.position.copy(hip); rider.add(hips);
  rider.add(tube(chest, neck, 0.04, M.skin));
  // head, hair, helmet, sunglasses
  const headC = V(0, R.shoulderY + 0.16, -0.22);
  const headM = joint(0.095, M.skin); headM.scale.set(0.95, 1.05, 1.05); headM.position.copy(headC); rider.add(headM);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.125, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.helmet);
  helmet.scale.set(1, 0.85, 1.28); helmet.position.copy(headC).add(V(0, 0.02, 0.02)); helmet.rotation.x = 0.15; rider.add(helmet);
  for (const x of [-0.045, 0, 0.045]) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.18), x === 0 ? M.helmetAccent : M.lens);
    vent.position.copy(headC).add(V(x, 0.115, 0.02)); vent.rotation.x = 0.15; rider.add(vent);
  }
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.008, 0.05), M.helmet); visor.position.copy(headC).add(V(0, 0.045, -0.13)); rider.add(visor);
  const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.035, 0.02), M.lens); glasses.position.copy(headC).add(V(0, 0.01, -0.095)); rider.add(glasses);
  const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10, 0, Math.PI * 2, Math.PI / 2.3, Math.PI / 2.2), M.hair);
  hairBack.position.copy(headC); rider.add(hairBack);
  if (R.ponytail) {
    rider.add(tube(headC.clone().add(V(0, 0.0, 0.1)), headC.clone().add(V(0, -0.17, 0.2)), 0.03, M.hair, 0.018));
    const tie = joint(0.03, M.helmetAccent); tie.position.copy(headC).add(V(0, -0.01, 0.11)); rider.add(tie);
  }
  // limbs (placed every frame)
  const upperArm = [new Segment(0.045, M.jersey, 0.05), new Segment(0.045, M.jersey, 0.05)];
  const foreArm = [new Segment(0.034, M.skin, 0.04), new Segment(0.034, M.skin, 0.04)];
  const elbow = [joint(0.04, M.skin), joint(0.04, M.skin)], hand = [joint(0.042, M.glove), joint(0.042, M.glove)];
  const thigh = [new Segment(0.062, M.legs, 0.075), new Segment(0.062, M.legs, 0.075)];
  const shinMat = R.legsToAnkle ? M.legs : M.skin;
  const shin = [new Segment(0.042, shinMat, 0.052), new Segment(0.042, shinMat, 0.052)];
  const knee = [joint(0.055, M.legs), joint(0.055, M.legs)];
  const sock = [new Segment(0.04, M.sock), new Segment(0.04, M.sock)];
  const shoe = [new THREE.Group(), new THREE.Group()];
  for (const sh of shoe) {
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.06, 0.24), M.shoe); upper.position.y = 0.03;
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.016, 0.25), M.sole);
    sh.add(upper, sole);
  }
  for (let i = 0; i < 2; i++) rider.add(upperArm[i].mesh, foreArm[i].mesh, elbow[i], hand[i], thigh[i].mesh, shin[i].mesh, knee[i], sock[i].mesh, shoe[i]);

  let crankAngle = 0, wheelAngle = 0, roll = 0, pulse = 0, blink = 0;
  const groundRing = new THREE.MeshBasicMaterial({ color: STRESS[1], transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const ringMesh = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.12, 48).rotateX(-Math.PI / 2), groundRing);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.85, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: C.navy, transparent: true, opacity: 0.25, depthWrite: false }));
  ringMesh.position.y = 0.02; shadow.position.y = 0.01;
  root.add(shadow, ringMesh);

  function pose() {
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const a = crankAngle + (i === 0 ? 0 : Math.PI);
      // crank + pedal
      const crankEnd = V(side * 0.085, bb.y + Math.cos(a) * 0.17, bb.z - Math.sin(a) * 0.17);
      (i === 0 ? crankL : crankR).place(V(side * 0.07, bb.y, bb.z), crankEnd);
      (i === 0 ? pedalL : pedalR).position.copy(crankEnd).add(V(side * 0.04, 0, 0));
      // leg: hip -> knee -> ankle above the pedal; knee bends forward
      const hipP = V(side * R.hipW, hip.y, hip.z);
      const ankle = crankEnd.clone().add(V(side * 0.02, 0.07, 0.03));
      const kneeP = solveJoint(hipP, ankle, 0.44, 0.44, V(side * 0.05, 0.3, -1));
      thigh[i].place(hipP, kneeP); shin[i].place(kneeP, ankle.clone().add(V(0, 0.05, 0))); knee[i].position.copy(kneeP);
      sock[i].place(ankle.clone().add(V(0, 0.07, 0)), ankle);
      shoe[i].position.copy(ankle).add(V(0, -0.055, -0.04));
      shoe[i].rotation.x = Math.sin(a) * 0.25;
      // arm: shoulder -> elbow -> grip; elbow bends outward and down
      const sh = V(side * R.shoulderW, R.shoulderY - 0.02, -0.12);
      const grip = V(side * 0.21, 0.995, -0.47);
      const el = solveJoint(sh, grip, 0.3, 0.29, V(side * 0.6, -0.4, 0.3));
      upperArm[i].place(sh, el); foreArm[i].place(el, grip); elbow[i].position.copy(el); hand[i].position.copy(grip);
    }
  }
  pose();

  // Pivot on the rider's visual middle so turning in place never slides it sideways on screen.
  const centre = new THREE.Box3().setFromObject(lean).getCenter(new THREE.Vector3());
  lean.position.set(-centre.x, 0, -centre.z);

  /** Advance the animation: dt in seconds, turnDeg = heading change since last frame. */
  function update(dt: number, moving: boolean, lts: number, turnDeg: number) {
    if (moving) { crankAngle += dt * 5.5; wheelAngle -= dt * 14; }
    rear.rotation.x = wheelAngle; front.rotation.x = wheelAngle;
    pose();
    roll += (THREE.MathUtils.clamp(-turnDeg * 0.06, -0.35, 0.35) - roll) * 0.08; // lean into turns, eased
    lean.rotation.z = roll;
    pulse += dt; blink += dt;
    M.taillight.emissiveIntensity = Math.sin(blink * 7) > 0 ? 1.6 : 0.25; // blinking taillight
    groundRing.color.setHex(STRESS[lts] ?? C.green);
    groundRing.opacity = 0.35 + 0.18 * Math.sin(pulse * 3);
  }

  return { scene, update, root };
}

// ---------------------------------------------------------------------------------------------------
export interface BikeLayer extends CustomLayerInterface {
  setPose(pos: [number, number], headingDeg: number, lts: number, moving: boolean): void;
}

/** The rider as a MapLibre custom 3D layer (3D model view). */
export function createBikeLayer(map: MLMap, style: RiderStyle = "male"): BikeLayer {
  let renderer: THREE.WebGLRenderer;
  const { scene, update } = createBikeModel(style);
  const camera = new THREE.Camera();
  const pose = { pos: [0, 0] as [number, number], heading: 0, prevHeading: 0, lts: 1, moving: false, visible: false, at: 0 };
  let last = performance.now();

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
      update(dt, moving, pose.lts, ((pose.heading - pose.prevHeading + 540) % 360) - 180);

      // Place in Mercator space; scale so the rider stays ~ON_SCREEN_PX tall at any zoom.
      const mc = MercatorCoordinate.fromLngLat({ lng: pose.pos[0], lat: pose.pos[1] }, 0);
      const metresPerPx = (40075016.686 * Math.cos((pose.pos[1] * Math.PI) / 180)) / (512 * Math.pow(2, map.getZoom()));
      const s = mc.meterInMercatorCoordinateUnits() * ((metresPerPx * riderPx(map.getCanvas().clientWidth, map.getCanvas().clientHeight)) / 1.75);
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

export interface BikeOverlay {
  setState(lts: number, moving: boolean, headingDeg: number): void;
  /** Look around exactly like the Street View camera (yaw > 0 = right, pitch > 0 = up); the rider stays put on the road. */
  setLook(yawDeg: number, pitchDeg: number): void;
  destroy(): void;
}

const EYE_HEIGHT_M = 2.5;   // Street View cameras sit roughly at car-roof height

/** The same rider drawn over Street View on a transparent canvas whose camera matches the panorama's:
 * same position, same field of view, same yaw and pitch. The rider is a fixed point on the road, so when you
 * look around, rider and street move together and the rider never slides across the road. */
/** riderAheadM: how far ahead of the camera the rider rides, on the road (closer on phones so it reads larger). */
export function createBikeOverlay(host: HTMLElement, style: RiderStyle = "male", hfovDeg = 103, basePitchDeg = -3, riderAheadM = 6): BikeOverlay {
  const { scene, update, root } = createBikeModel(style);
  root.position.set(0, 0, -riderAheadM); // facing -z, the direction of travel
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;";
  host.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
  camera.position.set(0, EYE_HEIGHT_M, 0);
  camera.rotation.order = "YXZ";
  const look = { yaw: 0, pitch: 0 };
  const aim = () => {
    camera.rotation.y = (-look.yaw * Math.PI) / 180;                     // three.js turns counter-clockwise
    camera.rotation.x = ((basePitchDeg + look.pitch) * Math.PI) / 180;
  };
  aim();
  const state = { lts: 1, moving: false, heading: 0, prevHeading: 0, at: 0 };
  let last = performance.now(), raf = 0, dirty = true, settle = 0;

  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Street View fixes the horizontal field of view; three.js wants the vertical one.
    camera.fov = (2 * Math.atan(Math.tan((hfovDeg * Math.PI) / 360) / camera.aspect) * 180) / Math.PI;
    camera.updateProjectionMatrix();
    dirty = true;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // Draw only while riding, briefly after (so the lean eases out), or after a look change; idle costs nothing.
  const loop = () => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const moving = state.moving && now - state.at < 250;
    if (moving) settle = 30;
    if (moving || settle > 0 || dirty) {
      update(dt, moving, state.lts, ((state.heading - state.prevHeading + 540) % 360) - 180);
      state.prevHeading = state.heading;
      renderer.render(scene, camera);
      dirty = false;
      if (!moving) settle--;
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  if (process.env.NODE_ENV !== "production") Object.assign(window, { __rsRider: root, __rsRiderCam: camera, __rsRiderRedraw: () => { dirty = true; } });

  return {
    setState(lts, moving, headingDeg) { state.lts = lts; state.moving = moving; state.heading = headingDeg; state.at = performance.now(); },
    setLook(yawDeg, pitchDeg) { look.yaw = yawDeg; look.pitch = pitchDeg; aim(); dirty = true; },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); canvas.remove(); },
  };
}
