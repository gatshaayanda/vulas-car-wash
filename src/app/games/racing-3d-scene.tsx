"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createRacingTrack, createRacingPitLane, getTrackTurn } from "./racing-track";
import type { Controls, Phase, Race } from "./racing-warmup";
import RacingTrackMap from "./racing-track-map";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

type Props = { raceRef: RefObject<Race>; controlsRef: RefObject<Controls>; phaseRef: RefObject<Phase>; preview?: boolean; previewGraphics?: "procedural" | "kenney" };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function ribbon(curve: THREE.Curve<THREE.Vector3>, width: number, segments: number, y: number) {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    positions.push(p.x + side.x * width / 2, y, p.z + side.z * width / 2);
    positions.push(p.x - side.x * width / 2, y, p.z - side.z * width / 2);
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function box(parent: THREE.Group, material: THREE.Material, size: [number, number, number], pos: [number, number, number], radius = 0) {
  const geometry = new THREE.BoxGeometry(...size);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...pos);
  if (radius) mesh.rotation.y = radius;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function roundedCarBox(parent: THREE.Group, material: THREE.Material, size: [number, number, number], pos: [number, number, number], radius = .12) {
  const geometry = new RoundedBoxGeometry(...size, 4, radius);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...pos);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeCar(bodyColor = "#f04478") {
  const car = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: .27, metalness: .24 });
  const dark = new THREE.MeshStandardMaterial({ color: "#101820", roughness: .72 });
  const rubber = new THREE.MeshStandardMaterial({ color: "#090c10", roughness: .92 });
  const alloy = new THREE.MeshStandardMaterial({ color: "#89949a", metalness: .7, roughness: .3 });
  const glass = new THREE.MeshStandardMaterial({ color: "#244554", metalness: .45, roughness: .22 });
  const light = new THREE.MeshStandardMaterial({ color: "#ff4039", emissive: "#a51412", emissiveIntensity: .6 });
  // Lower, longer rounded shell gives the practice car a smoother touring-racer profile.
  roundedCarBox(car, bodyMat, [2.16, .46, 3.72], [0, .61, 0], .28);
  roundedCarBox(car, bodyMat, [1.66, .23, 1.52], [0, .88, -.53], .17);
  roundedCarBox(car, glass, [1.22, .43, 1.12], [0, 1.15, -.69], .2);
  roundedCarBox(car, dark, [2.72, .12, .22], [0, .48, 1.67], .045);
  roundedCarBox(car, bodyMat, [2.58, .11, .18], [0, 1.02, 1.52], .04);
  roundedCarBox(car, dark, [1.8, .13, .52], [0, .46, 1.35], .06);
  for (const x of [-1.15, 1.15]) {
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(.47, .47, .32, 16), rubber);
    tyre.rotation.z = Math.PI / 2;
    tyre.position.set(x, .47, .8);
    tyre.castShadow = true;
    car.add(tyre);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(.23, .23, .335, 12), alloy);
    rim.rotation.z = Math.PI / 2;
    rim.position.copy(tyre.position);
    car.add(rim);
    const frontTyre = tyre.clone();
    frontTyre.position.z = -1.05;
    car.add(frontTyre);
    const frontRim = rim.clone();
    frontRim.position.z = -1.05;
    car.add(frontRim);
    box(car, light, [.12, .16, .08], [x * .68, .68, 1.77]);
  }
  box(car, dark, [2.6, .12, .16], [0, .92, 1.72]);
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, .22, 10), alloy);
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.set(0, .42, 1.82);
  car.add(exhaust);
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(.22, 1.05, 10),
    new THREE.MeshBasicMaterial({ color: "#54dfff", transparent: true, opacity: .88 })
  );
  flame.rotation.x = -Math.PI / 2;
  flame.position.set(0, .45, 2.35);
  flame.visible = false;
  car.add(flame);
  car.userData.flame = flame;
  return car;
}

export default function Racing3DScene({ raceRef, controlsRef, phaseRef, preview = false, previewGraphics = "procedural" }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch {
      host.dataset.webgl = "unavailable";
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setSize(host.clientWidth || 800, host.clientHeight || 480, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-label", "Three-dimensional racing circuit with rear chase camera");
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#9fc8dc");
    scene.fog = new THREE.Fog("#b2c7bd", 95, 270);
    const camera = new THREE.PerspectiveCamera(63, (host.clientWidth || 800) / (host.clientHeight || 480), .1, 420);
    const hemi = new THREE.HemisphereLight("#e7f5ff", "#405239", 2.05);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight("#fff0d3", 3.1);
    sun.position.set(-45, 80, -25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -65; sun.shadow.camera.right = 65; sun.shadow.camera.top = 85; sun.shadow.camera.bottom = -85;
    scene.add(sun);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ color: "#628653", roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -.12; ground.receiveShadow = true; scene.add(ground);

    const track = createRacingTrack();
    const road = new THREE.Mesh(ribbon(track, 12, 600, .015), new THREE.MeshStandardMaterial({ color: "#30383e", roughness: .94, metalness: .02, side: THREE.DoubleSide }));
    road.receiveShadow = true; scene.add(road);

    // Dedicated pit lane: branches off the main straight, runs parallel to the
    // circuit past a marked service box, then merges back onto the racing line.
    const pitLane = createRacingPitLane(track);
    const pitRoad = new THREE.Mesh(
      ribbon(pitLane, 7.2, 220, .035),
      new THREE.MeshStandardMaterial({ color: "#252d32", roughness: .96, side: THREE.DoubleSide }),
    );
    pitRoad.receiveShadow = true;
    scene.add(pitRoad);

    const pitMarkings = new THREE.Group();
    const pitLineMat = new THREE.MeshBasicMaterial({ color: "#f5f0d9" });
    const pitDashMat = new THREE.MeshBasicMaterial({ color: "#f4c64e" });
    for (let i = 2; i < 40; i += 2) {
      const t = i / 42;
      const p = pitLane.getPointAt(t);
      const tangent = pitLane.getTangentAt(t).normalize();
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(.16, .035, 1.15), pitLineMat);
      stripe.position.set(p.x, .075, p.z);
      stripe.rotation.y = Math.atan2(tangent.x, tangent.z);
      pitMarkings.add(stripe);
    }
    scene.add(pitMarkings);

    // A clearly visible service bay beside the pit lane.
    const pitBoxPoint = pitLane.getPointAt(.52);
    const pitBoxTangent = pitLane.getTangentAt(.52).normalize();
    const pitBoxSide = new THREE.Vector3(-pitBoxTangent.z, 0, pitBoxTangent.x).normalize();
    const bay = new THREE.Group();
    const bayBase = new THREE.Mesh(
      new THREE.BoxGeometry(11, .09, 8),
      new THREE.MeshStandardMaterial({ color: "#d8d7ca", roughness: .9 }),
    );
    bayBase.position.y = .09;
    bay.add(bayBase);
    for (const offset of [-4.7, 4.7]) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(.13, .04, 7.5), pitDashMat);
      line.position.set(offset, .17, 0);
      bay.add(line);
    }
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(10.5, .22, 1.1),
      new THREE.MeshStandardMaterial({ color: "#d83a32", roughness: .72 }),
    );
    canopy.position.set(0, 3.4, -3.1);
    bay.add(canopy);
    for (const x of [-4.8, 4.8]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(.18, 3.3, .18), new THREE.MeshStandardMaterial({ color: "#e7e5d9" }));
      post.position.set(x, 1.7, -3.1);
      bay.add(post);
    }
    bay.position.set(pitBoxPoint.x, .04, pitBoxPoint.z);
    bay.rotation.y = Math.atan2(pitBoxTangent.x, pitBoxTangent.z);
    scene.add(bay);
// Fixed visual references before significant bends: brake board, turn-in chevrons and apex beacon.
    let lastBoardAt = -1;
    for (let i = 0; i < 180; i++) {
      const t = i / 180;
      const turn = getTrackTurn(track, t, .006);
      const strength = Math.abs(turn);
      if (strength < .038 || (lastBoardAt >= 0 && (t - lastBoardAt + 1) % 1 < .075)) continue;
      lastBoardAt = t;
      const cornerPoint = track.getPointAt(t);
      const boardT = (t - .025 + 1) % 1;
      const p = track.getPointAt(boardT);
      const tangent = track.getTangentAt(boardT).normalize();
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const outside = Math.sign(turn || 1);
      const board = new THREE.Group();
      const postMat = new THREE.MeshStandardMaterial({ color: "#34443b", roughness: .85 });
      const boardCanvas = document.createElement("canvas");
      boardCanvas.width = 320; boardCanvas.height = 180;
      const ctx = boardCanvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#f8f7ef"; ctx.fillRect(0, 0, 320, 180);
        ctx.fillStyle = "#c52f2a"; ctx.fillRect(0, 0, 320, 54);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 30px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("BRAKE", 160, 28);
        ctx.fillStyle = "#172820"; ctx.font = "bold 38px Arial"; ctx.fillText("TURN IN", 160, 113);
        ctx.fillStyle = "#c52f2a"; ctx.fillRect(0, 160, 320, 20);
      }
      const boardTexture = new THREE.CanvasTexture(boardCanvas);
      boardTexture.colorSpace = THREE.SRGBColorSpace;
      const boardMat = new THREE.MeshBasicMaterial({ map: boardTexture, side: THREE.DoubleSide });
      const post = new THREE.Mesh(new THREE.BoxGeometry(.12, 2.2, .12), postMat);
      post.position.y = 1.1; board.add(post);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.45, .82), boardMat);
      face.position.set(0, 1.75, .09); board.add(face);
      board.position.set(p.x + side.x * outside * 9.2, 0, p.z + side.z * outside * 9.2);
      board.rotation.y = Math.atan2(-side.x * outside, -side.z * outside);
      board.traverse((node) => { const mesh = node as THREE.Mesh; mesh.castShadow = true; });
      scene.add(board);
    }
    const kerb = new THREE.MeshStandardMaterial({ color: "#f4eee0", roughness: .8, side: THREE.DoubleSide });
    const redKerb = new THREE.MeshStandardMaterial({ color: "#d7473d", roughness: .75, side: THREE.DoubleSide });
    const barrierMat = new THREE.MeshStandardMaterial({ color: "#dce2df", roughness: .65 });
    const darkBarrier = new THREE.MeshStandardMaterial({ color: "#283b43", roughness: .75 });
    scene.add(new THREE.Mesh(ribbon(track, 15, 600, -.005), kerb));
    // Alternating red/ivory kerb blocks add visual rhythm at both road edges.
    for (let i = 0; i < 150; i++) {
      const t = i / 150;
      const p = track.getPointAt(t), tangent = track.getTangentAt(t).normalize();
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      for (const s of [-1, 1]) {
        const block = new THREE.Mesh(new THREE.BoxGeometry(.48, .09, .82), i % 2 ? redKerb : kerb);
        block.position.set(p.x + side.x * s * 6.7, .08, p.z + side.z * s * 6.7);
        block.rotation.y = Math.atan2(tangent.x, tangent.z);
        block.receiveShadow = true; scene.add(block);
      }
    }
    // A layered low-poly horizon makes the track feel like a place, not a flat canvas.
    const hillMat = new THREE.MeshStandardMaterial({ color: "#7e9a82", roughness: 1, flatShading: true });
    for (let i = 0; i < 24; i++) {
      const hill = new THREE.Mesh(new THREE.ConeGeometry(13 + (i % 4) * 5, 20 + (i % 5) * 7, 5), hillMat);
      const angle = i / 24 * Math.PI * 2;
      hill.position.set(Math.cos(angle) * (125 + (i % 3) * 10), 7, Math.sin(angle) * (125 + (i % 3) * 10));
      hill.rotation.y = angle; scene.add(hill);
    }
    const treeTrunks = new THREE.MeshStandardMaterial({ color: "#5c4937", roughness: 1 });
    const foliage = [new THREE.MeshStandardMaterial({ color: "#315d43", flatShading: true }), new THREE.MeshStandardMaterial({ color: "#467a4e", flatShading: true })];
    for (let i = 0; i < 68; i++) {
      const t = i / 68;
      const p = track.getPointAt(t), tangent = track.getTangentAt(t).normalize();
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const sign = i % 2 ? 1 : -1;
      const distance = 17 + (i % 4) * 2.2;
      const x = p.x + side.x * sign * distance, z = p.z + side.z * sign * distance;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.22, .32, 2.1, 5), treeTrunks); trunk.position.y = 1.05; trunk.castShadow = true; tree.add(trunk);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(1.45 + (i % 3) * .25, 3.5 + (i % 2), 5), foliage[i % 2]); crown.position.y = 3.2; crown.castShadow = true; tree.add(crown);
      tree.position.set(x, 0, z); scene.add(tree);
    }
    // Safety rails follow the outer edge and repeat as clean, visible panels.
    for (let i = 0; i < 220; i++) {
      const t = i / 220, p = track.getPointAt(t), tangent = track.getTangentAt(t).normalize();
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      for (const s of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(.22, .62, 2.9), i % 5 === 0 ? redKerb : barrierMat);
        rail.position.set(p.x + side.x * s * 8.4, .58, p.z + side.z * s * 8.4);
        rail.rotation.y = Math.atan2(tangent.x, tangent.z);
        rail.castShadow = true; rail.receiveShadow = true; scene.add(rail);
        const post = new THREE.Mesh(new THREE.BoxGeometry(.25, .9, .18), darkBarrier);
        post.position.set(rail.position.x, .45, rail.position.z); post.rotation.y = rail.rotation.y; scene.add(post);
      }
    }
    const car = makeCar();
    const assetCar = new THREE.Group();
    assetCar.visible = false;
    scene.add(assetCar);
    if (preview && previewGraphics === "kenney") {
      const loader = new GLTFLoader();
      fetch("/game-assets/racing-kit/manifest.json").then(response => {
        if (!response.ok) throw new Error("Racing Kit manifest unavailable");
        return response.json();
      }).then((manifest: { assets?: Array<{ name?: string; path?: string; format?: string }> }) => {
        const candidates = (manifest.assets ?? []).filter(item => item.path && (item.format === "glb" || item.format === "gltf"));
        const selected = candidates.find(item => /car|vehicle|race/i.test(item.name ?? item.path ?? "")) ?? candidates[0];
        if (!selected?.path) throw new Error("No prepared Kenney vehicle model found");
        loader.load(selected.path, gltf => {
          const model = gltf.scene;
          const bounds = new THREE.Box3().setFromObject(model);
          const size = bounds.getSize(new THREE.Vector3());
          const center = bounds.getCenter(new THREE.Vector3());
          const longest = Math.max(size.x, size.z, 0.001);
          model.position.sub(center);
          model.position.y += size.y / 2;
          model.scale.multiplyScalar(3.55 / longest);
          assetCar.add(model);
          assetCar.visible = true;
        });
      }).catch(() => { /* Procedural preview remains the safe fallback. */ });
    }
    // Keep the car's proportions credible against the 12-unit road and leave
    // more visual room around it for steering on narrow mobile screens.
    car.scale.setScalar(0.82);
    scene.add(car);
    const botCar = makeCar("#f2bd45");
    botCar.scale.setScalar(0.82);
    scene.add(botCar);
    const nameCanvas = document.createElement("canvas");
    nameCanvas.width = 512; nameCanvas.height = 128;
    const nameContext = nameCanvas.getContext("2d");
    if (nameContext) {
      nameContext.fillStyle = "#14241f";
      nameContext.fillRect(8, 8, 496, 112);
      nameContext.fillStyle = "#ffffff";
      nameContext.font = "bold 54px system-ui";
      nameContext.textAlign = "center";
      nameContext.textBaseline = "middle";
      nameContext.fillText("KAGO · BOT", 256, 66);
    }
    const nameTexture = new THREE.CanvasTexture(nameCanvas);
    const nameTag = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTexture, transparent: true, depthTest: false }));
    nameTag.scale.set(4.8, 1.2, 1);
    scene.add(nameTag);

    // Drift feedback is tied to real chassis-vs-velocity slip, never camera motion.
    const skidMaterial = new THREE.LineBasicMaterial({ color: "#171b1b", transparent: true, opacity: 0.62, depthWrite: false });
    const skidCapacity = 420;
    const skidBuffers = [-1, 1].map(() => {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(skidCapacity * 6);
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setDrawRange(0, 0);
      const line = new THREE.LineSegments(geometry, skidMaterial);
      line.frustumCulled = false;
      scene.add(line);
      return { geometry, positions, count: 0, previous: null as THREE.Vector3 | null };
    });
    const botSkidMaterial = new THREE.LineBasicMaterial({ color: "#202020", transparent: true, opacity: .56, depthWrite: false });
    const botSkidBuffers = [-1, 1].map(() => {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(skidCapacity * 6);
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setDrawRange(0, 0);
      const line = new THREE.LineSegments(geometry, botSkidMaterial);
      line.frustumCulled = false; scene.add(line);
      return { geometry, positions, count: 0, previous: null as THREE.Vector3 | null };
    });
    const botSmokePool = Array.from({ length: 14 }, () => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(.16, 7, 6), new THREE.MeshBasicMaterial({ color: "#e2e5e2", transparent: true, opacity: .2, depthWrite: false }));
      puff.visible = false; scene.add(puff);
      return { mesh: puff, velocity: new THREE.Vector3(), life: 0, maxLife: 1 };
    });
    let botSmokeCursor = 0, botLastEffectAt = 0;
    const smokeMaterial = new THREE.MeshBasicMaterial({ color: "#d9dedb", transparent: true, opacity: 0.24, depthWrite: false });
    const smokePool = Array.from({ length: 26 }, () => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.18, 7, 6), smokeMaterial.clone());
      puff.visible = false;
      scene.add(puff);
      return { mesh: puff, velocity: new THREE.Vector3(), life: 0, maxLife: 1 };
    });
    let smokeCursor = 0;
    const sparkMaterial = new THREE.MeshBasicMaterial({ color: "#ffd36a" });
    const sparkPool = Array.from({ length: 18 }, (_, index) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(index % 3 === 0 ? .075 : .045, 5, 4), sparkMaterial);
      mesh.visible = false; scene.add(mesh);
      return { mesh, velocity: new THREE.Vector3(), life: 0, maxLife: .28 };
    });
    let sparkCursor = 0, seenImpactAt = 0;
    let lastEffectAt = 0;
    let effectClock = 0;
    const groundShadow = new THREE.Mesh(
      new THREE.CircleGeometry(1, 32),
      new THREE.MeshBasicMaterial({ color: 0x101914, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    groundShadow.rotation.x = -Math.PI / 2;
    groundShadow.scale.set(1.25, 2.05, 1);
    groundShadow.position.y = 0.028;
    scene.add(groundShadow);
    // Preserve the approved circuit, scenery, camera and controls; this is a visual-only car refresh.
    const skyGlow = new THREE.Mesh(new THREE.SphereGeometry(320, 16, 10), new THREE.MeshBasicMaterial({ color: "#b9d4df", side: THREE.BackSide }));
    scene.add(skyGlow);

    // Track-edge collision is resolved once in the authoritative driving
    // simulation. Avoid a second render-loop wall solver that can disagree with
    // the track projection at segment joins and tight corner endpoints.
    const clock = new THREE.Clock();
    let raf = 0;
    const resize = () => {
      const w = Math.max(280, host.clientWidth), h = Math.max(320, host.clientHeight);
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    const render = () => {
      const frameDelta = Math.min(clock.getDelta(), .05);
      const race = raceRef.current;
      if (preview) {
        const playerT = (clock.elapsedTime * 0.035) % 1;
        const playerPoint = track.getPointAt(playerT);
        const playerTangent = track.getTangentAt(playerT).normalize();
        race.progress = playerT;
        race.worldX = playerPoint.x;
        race.worldZ = playerPoint.z;
        race.worldYaw = Math.atan2(-playerTangent.x, -playerTangent.z);
        race.speed = 168;
        race.botProgress = (playerT + 0.025) % 1;
        race.botInitialized = false;
        race.botSpeed = 174;
        race.botDrift = 0.08;
      }
      const controls = controlsRef.current;
      const currentPhase = phaseRef.current;
      // Render the independent world-space vehicle state; track geometry is not a movement rail.
      const carWorld = new THREE.Vector3(race.worldX, .015, race.worldZ);
      // Keep the chase camera aligned to the car's nose. The sideways travel
      // remains visible around the chassis instead of rotating the whole view.
      const forward = new THREE.Vector3(-Math.sin(race.worldYaw), 0, -Math.cos(race.worldYaw)).normalize();
      car.position.copy(carWorld);
      car.rotation.y = race.worldYaw;
      assetCar.position.copy(carWorld);
      assetCar.rotation.y = race.worldYaw;
      assetCar.scale.setScalar(0.82);
      const showAsset = preview && previewGraphics === "kenney" && assetCar.children.length > 0;
      assetCar.visible = showAsset;
      car.visible = !showAsset;
      const botT = ((race.botProgress % 1) + 1) % 1;
      const botPoint = track.getPointAt(botT), botTangent = track.getTangentAt(botT).normalize();
      const botSide = new THREE.Vector3(-botTangent.z, 0, botTangent.x).normalize();
      const botWorld = race.botInitialized
        ? new THREE.Vector3(race.botWorldX, .015, race.botWorldZ)
        : botPoint.clone().addScaledVector(botSide, -2.45);
      const botYaw = race.botInitialized ? race.botWorldYaw : Math.atan2(-botTangent.x, -botTangent.z);
      botCar.position.copy(botWorld);
      botCar.rotation.y = botYaw;
      botCar.rotation.z = clamp(-race.botDrift * .18, -.14, .14);
      botCar.rotation.x = clamp(race.botBrake * .08, 0, .08);
      const botFlame = botCar.userData.flame as THREE.Object3D | undefined;
      if (botFlame) {
        botFlame.visible = race.botBoostActive && race.botThrottle > .8 && race.botBrake < .08 && currentPhase === "running" && race.botSpeed > 8 && race.botNos > 5;
        botFlame.scale.setScalar(.78 + Math.sin(clock.elapsedTime * 37) * .22);
      }
      nameTag.position.set(botWorld.x, 3.0, botWorld.z);
      nameTag.visible = currentPhase !== "ready" || race.botProgress > .025;
      // Subtle suspension response: braking transfers load forward and cornering
      // rolls the body. These are visual cues driven by the physics state.
      car.rotation.x = clamp(-race.longitudinalLoad * 0.22, -0.075, 0.025);
      // Exaggerated but speed/load-driven body roll makes weight transfer and rear slip
      // readable on a phone-sized screen instead of hiding it in tiny suspension motion.
      car.rotation.z = clamp(-race.lateralG * 0.055 - race.drift * 0.24, -0.16, 0.16);
      groundShadow.position.x = carWorld.x;
      groundShadow.position.z = carWorld.z;
      groundShadow.rotation.z = -car.rotation.y;
      const cameraTarget = new THREE.Vector3(carWorld.x + forward.x * 10, 1.25, carWorld.z + forward.z * 10);
      const cameraPosition = new THREE.Vector3(carWorld.x - forward.x * 8.4, 4.7, carWorld.z - forward.z * 8.4);
      camera.position.lerp(cameraPosition, 1 - Math.exp(-frameDelta * 4.2));
      camera.lookAt(cameraTarget);
      // Rear tyres leave short, fading-in-place rubber traces while the car is
      // genuinely sliding. Bounded buffers prevent unbounded geometry growth.
      const slip = Math.abs(race.drift);
      const driftIntensity = clamp((slip - 0.13) / 0.55, 0, 1) * clamp((race.speed - 28) / 55, 0, 1);
      effectClock += frameDelta;
      const rearTyres = [-1, 1].map(side => {
        const local = new THREE.Vector3(side * 0.94, 0.035, 0.8 * 0.82);
        return local.applyAxisAngle(new THREE.Vector3(0, 1, 0), race.worldYaw).add(carWorld);
      });
      if (currentPhase === "running" && driftIntensity > 0.04 && effectClock - lastEffectAt > 0.035) {
        lastEffectAt = effectClock;
        rearTyres.forEach((point, index) => {
          const buffer = skidBuffers[index];
          if (buffer.previous) {
            if (buffer.count >= skidCapacity) {
              buffer.positions.copyWithin(0, 6);
              buffer.count = skidCapacity - 1;
            }
            const offset = buffer.count * 6;
            buffer.positions[offset] = buffer.previous.x; buffer.positions[offset + 1] = 0.052; buffer.positions[offset + 2] = buffer.previous.z;
            buffer.positions[offset + 3] = point.x; buffer.positions[offset + 4] = 0.052; buffer.positions[offset + 5] = point.z;
            buffer.count += 1;
            buffer.geometry.attributes.position.needsUpdate = true;
            buffer.geometry.setDrawRange(0, buffer.count * 2);
          }
          buffer.previous = point.clone();
          const puff = smokePool[smokeCursor++ % smokePool.length];
          puff.mesh.position.set(point.x, 0.18, point.z);
          puff.mesh.scale.setScalar(0.55 + driftIntensity * 0.75);
          puff.mesh.visible = true;
          puff.life = 0.55 + driftIntensity * 0.45;
          puff.maxLife = puff.life;
          puff.velocity.set((Math.random() - 0.5) * 0.7 + race.velocityX * -0.025, 0.65 + driftIntensity * 0.55, (Math.random() - 0.5) * 0.7 + race.velocityZ * -0.025);
          (puff.mesh.material as THREE.MeshBasicMaterial).opacity = 0.12 + driftIntensity * 0.2;
        });
      } else if (driftIntensity < 0.04) {
        skidBuffers.forEach(buffer => { buffer.previous = null; });
      }
      const botSlipIntensity = clamp((Math.abs(race.botDrift) - .12) / .5, 0, 1) * clamp((race.botSpeed - 5) / 8, 0, 1);
      const botRearTyres = [-1, 1].map(side => new THREE.Vector3(side * .94, .035, .8 * .72)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), botYaw).add(botWorld));
      if (currentPhase === "running" && botSlipIntensity > .05 && effectClock - botLastEffectAt > .045) {
        botLastEffectAt = effectClock;
        botRearTyres.forEach((point, index) => {
          const buffer = botSkidBuffers[index];
          if (buffer.previous) {
            if (buffer.count >= skidCapacity) { buffer.positions.copyWithin(0, 6); buffer.count = skidCapacity - 1; }
            const offset = buffer.count * 6;
            buffer.positions[offset] = buffer.previous.x; buffer.positions[offset + 1] = .054; buffer.positions[offset + 2] = buffer.previous.z;
            buffer.positions[offset + 3] = point.x; buffer.positions[offset + 4] = .054; buffer.positions[offset + 5] = point.z;
            buffer.count += 1; buffer.geometry.attributes.position.needsUpdate = true; buffer.geometry.setDrawRange(0, buffer.count * 2);
          }
          buffer.previous = point.clone();
          const puff = botSmokePool[botSmokeCursor++ % botSmokePool.length];
          puff.mesh.position.set(point.x, .17, point.z); puff.mesh.scale.setScalar(.48 + botSlipIntensity * .65);
          puff.mesh.visible = true; puff.life = .48 + botSlipIntensity * .35; puff.maxLife = puff.life;
          puff.velocity.set((Math.random() - .5) * .5 - race.botVelocityX * .025, .48 + botSlipIntensity * .45, (Math.random() - .5) * .5 - race.botVelocityZ * .025);
        });
      } else if (botSlipIntensity < .05) botSkidBuffers.forEach(buffer => { buffer.previous = null; });
      botSmokePool.forEach(puff => {
        if (!puff.mesh.visible) return;
        puff.life -= frameDelta;
        if (puff.life <= 0) { puff.mesh.visible = false; return; }
        puff.mesh.position.addScaledVector(puff.velocity, frameDelta);
        puff.mesh.scale.multiplyScalar(1 + frameDelta * 1.25);
        (puff.mesh.material as THREE.MeshBasicMaterial).opacity = .18 * (puff.life / puff.maxLife);
      });
      if (race.botImpactAt > seenImpactAt) {
        seenImpactAt = race.botImpactAt;
        const count = 8 + Math.round(race.botImpactStrength * 8);
        for (let i = 0; i < count; i++) {
          const spark = sparkPool[sparkCursor++ % sparkPool.length];
          spark.mesh.position.set(race.botImpactX, .48, race.botImpactZ);
          spark.mesh.visible = true; spark.life = .18 + Math.random() * .16; spark.maxLife = spark.life;
          spark.velocity.set((Math.random() - .5) * 7, .8 + Math.random() * 4.5, (Math.random() - .5) * 7);
          spark.mesh.scale.setScalar(.7 + race.botImpactStrength * .8);
        }
      }
      sparkPool.forEach(spark => {
        if (!spark.mesh.visible) return;
        spark.life -= frameDelta;
        if (spark.life <= 0) { spark.mesh.visible = false; return; }
        spark.mesh.position.addScaledVector(spark.velocity, frameDelta);
        spark.velocity.y -= 8.5 * frameDelta;
        spark.mesh.scale.multiplyScalar(.97);
      });
      smokePool.forEach(puff => {
        if (!puff.mesh.visible) return;
        puff.life -= frameDelta;
        if (puff.life <= 0) { puff.mesh.visible = false; return; }
        puff.mesh.position.addScaledVector(puff.velocity, frameDelta);
        puff.mesh.scale.multiplyScalar(1 + frameDelta * 1.5);
        (puff.mesh.material as THREE.MeshBasicMaterial).opacity = (0.12 + driftIntensity * 0.2) * (puff.life / puff.maxLife);
      });
      const flame = car.userData.flame as THREE.Object3D | undefined;
      if (flame) {
        flame.visible = controls.boost && race.nos > 0 && !controls.brake && currentPhase === "running";
        const pulse = .82 + Math.sin(clock.elapsedTime * 42) * .18;
        flame.scale.setScalar(pulse);
      }
      if (currentPhase === "running") {
        camera.fov = 63 + Math.min(12, race.speed / 19) + (controls.boost && race.nos > 0 && !controls.brake ? 7 : 0);
      } else camera.fov = 63;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };
    resize(); window.addEventListener("resize", resize); raf = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(raf); window.removeEventListener("resize", resize);
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
  }, [raceRef, controlsRef, phaseRef, preview, previewGraphics]);

  return (
    <div ref={mountRef} className="racing-3d-root" data-phase={phaseRef.current} data-braking={controlsRef.current.brake ? "true" : "false"}>
      <RacingTrackMap raceRef={raceRef} />
    </div>
  );
}
