"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type Phase = "ready" | "countdown" | "running" | "paused" | "finished";
type Props = { speed: number; steer: number; brake: boolean; boost: boolean; phase: Phase; progress: number; countdown: number };

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

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

function makeCar() {
  const car = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: "#b9ef48", roughness: .32, metalness: .18 });
  const dark = new THREE.MeshStandardMaterial({ color: "#101820", roughness: .72 });
  const rubber = new THREE.MeshStandardMaterial({ color: "#090c10", roughness: .92 });
  const alloy = new THREE.MeshStandardMaterial({ color: "#89949a", metalness: .7, roughness: .3 });
  const glass = new THREE.MeshStandardMaterial({ color: "#244554", metalness: .45, roughness: .22 });
  const light = new THREE.MeshStandardMaterial({ color: "#ff4039", emissive: "#a51412", emissiveIntensity: .6 });
  box(car, bodyMat, [2.25, .48, 3.5], [0, .62, 0]);
  box(car, bodyMat, [1.7, .24, 1.4], [0, .9, -.5]);
  box(car, glass, [1.2, .48, 1.05], [0, 1.18, -.65]);
  box(car, dark, [2.95, .14, .32], [0, 1.03, 1.45]);
  box(car, bodyMat, [2.7, .12, .2], [0, 1.11, 1.45]);
  box(car, dark, [1.85, .15, .6], [0, .47, 1.38]);
  for (const x of [-1.15, 1.15]) {
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(.47, .47, .32, 16), rubber);
    tyre.rotation.z = Math.PI / 2;
    tyre.position.set(x, .48, .8);
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

export default function Racing3DScene({ speed, steer, brake, boost, phase, progress, countdown }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<Props>({ speed, steer, brake, boost, phase, progress, countdown });
  useEffect(() => { liveRef.current = { speed, steer, brake, boost, phase, progress, countdown }; });

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

    const points = [
      new THREE.Vector3(0, 0, 72), new THREE.Vector3(30, 0, 65), new THREE.Vector3(45, 0, 42),
      new THREE.Vector3(40, 0, 16), new THREE.Vector3(21, 0, 2), new THREE.Vector3(38, 0, -24),
      new THREE.Vector3(29, 0, -52), new THREE.Vector3(0, 0, -66), new THREE.Vector3(-32, 0, -54),
      new THREE.Vector3(-43, 0, -28), new THREE.Vector3(-26, 0, -8), new THREE.Vector3(-42, 0, 17),
      new THREE.Vector3(-32, 0, 48)
    ];
    const track = new THREE.CatmullRomCurve3(points, true, "centripetal", .42);
    const road = new THREE.Mesh(ribbon(track, 12, 600, .015), new THREE.MeshStandardMaterial({ color: "#30383e", roughness: .94, metalness: .02, side: THREE.DoubleSide }));
    road.receiveShadow = true; scene.add(road);
    const kerb = new THREE.MeshStandardMaterial({ color: "#f4eee0", roughness: .8, side: THREE.DoubleSide });
    const redKerb = new THREE.MeshStandardMaterial({ color: "#d7473d", roughness: .75, side: THREE.DoubleSide });
    const barrierMat = new THREE.MeshStandardMaterial({ color: "#dce2df", roughness: .65 });
    const darkBarrier = new THREE.MeshStandardMaterial({ color: "#283b43", roughness: .75 });
    const dashMat = new THREE.MeshStandardMaterial({ color: "#f5f1dd", roughness: .6, emissive: "#3e433c", emissiveIntensity: .18 });
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
    // Broken centre guide dashes and distant corner markers.
    for (let i = 0; i < 100; i++) {
      const p = track.getPointAt(i / 100);
      const dash = new THREE.Mesh(new THREE.BoxGeometry(.12, .025, 1.15), dashMat);
      dash.position.set(p.x, .045, p.z); dash.rotation.y = Math.atan2(track.getTangentAt(i / 100).x, track.getTangentAt(i / 100).z);
      scene.add(dash);
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
    // Stationary cones sit on the circuit as visible practice targets.
    const coneMat = new THREE.MeshStandardMaterial({ color: "#ff8c37", roughness: .5 });
    const coneBand = new THREE.MeshStandardMaterial({ color: "#fff3d7", roughness: .55 });
    const obstacles: THREE.Group[] = [];
    for (let i = 0; i < 14; i++) {
      const t = (i * .071 + .09) % 1;
      const p = track.getPointAt(t), tangent = track.getTangentAt(t).normalize();
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const offset = i % 2 ? 2.5 : -2.6;
      const cone = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(.48, .55, .16, 10), darkBarrier); base.position.y = .08; cone.add(base);
      const body = new THREE.Mesh(new THREE.ConeGeometry(.34, 1.05, 10), coneMat); body.position.y = .65; body.castShadow = true; cone.add(body);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(.2, .29, .14, 10), coneBand); band.position.y = .7; cone.add(band);
      cone.position.set(p.x + side.x * offset, .03, p.z + side.z * offset);
      cone.rotation.y = Math.atan2(tangent.x, tangent.z); scene.add(cone); obstacles.push(cone);
    }

    const car = makeCar();
    scene.add(car);
    const skyGlow = new THREE.Mesh(new THREE.SphereGeometry(320, 16, 10), new THREE.MeshBasicMaterial({ color: "#b9d4df", side: THREE.BackSide }));
    scene.add(skyGlow);
    const clock = new THREE.Clock();
    let raf = 0;
    const resize = () => {
      const w = Math.max(280, host.clientWidth), h = Math.max(320, host.clientHeight);
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    const render = () => {
      const state = liveRef.current;
      const t = ((state.progress % 1) + 1) % 1;
      const position = track.getPointAt(t);
      const tangent = track.getTangentAt(t).normalize();
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const carOffset = state.steer * 1.9;
      car.position.set(position.x + side.x * carOffset, .02 + Math.sin(clock.elapsedTime * 17) * Math.min(.035, state.speed / 5000), position.z + side.z * carOffset);
      car.rotation.y = Math.atan2(tangent.x, tangent.z) + state.steer * -.09;
      const cameraTarget = new THREE.Vector3(position.x + tangent.x * 12, 1.35, position.z + tangent.z * 12);
      const cameraPosition = new THREE.Vector3(position.x - tangent.x * 7.6, 4.2, position.z - tangent.z * 7.6);
      cameraPosition.x += side.x * state.steer * .6; cameraPosition.z += side.z * state.steer * .6;
      camera.position.lerp(cameraPosition, .16);
      camera.lookAt(cameraTarget);
      const flame = car.userData.flame as THREE.Mesh;
      flame.visible = state.boost && state.phase === "running";
      flame.scale.setScalar(.8 + Math.sin(clock.elapsedTime * 36) * .18);
      if (state.phase === "running") {
        camera.fov = 63 + Math.min(8, state.speed / 28) + (state.boost ? 5 : 0);
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
  }, []);

  return <div ref={mountRef} className="racing-3d-root" data-phase={phase} data-braking={brake ? "true" : "false"} />;
}
