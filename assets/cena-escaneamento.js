/* Cena 3D: scanner varrendo a arcada inferior (escaneamento real) */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// Trajetória sobre as cúspides (x, y, z em metros), de molar a molar
const MOUTH = { x: 0, z: 0.11 }; // ponto à frente dos incisivos
const PATH = [[-0.03049, 0.004, -0.01742], [-0.03243, 0.00344, -0.01453], [-0.03231, 0.00127, -0.01041], [-0.03132, -0.00099, -0.00586], [-0.02928, -0.00317, -0.00107], [-0.02737, -0.00365, 0.00284], [-0.02622, -0.00391, 0.00609], [-0.02465, -0.00384, 0.00907], [-0.02402, -0.00374, 0.0114], [-0.02275, -0.00374, 0.01373], [-0.02231, -0.00365, 0.01624], [-0.02176, -0.00355, 0.01874], [-0.02071, -0.00341, 0.02108], [-0.0195, -0.00322, 0.02328], [-0.01815, -0.00312, 0.02554], [-0.01679, -0.00252, 0.02791], [-0.01501, -0.00208, 0.0299], [-0.01295, -0.00149, 0.03168], [-0.01063, -0.0012, 0.03314], [-0.00809, -0.00094, 0.03434], [-0.00546, -0.00067, 0.03524], [-0.00271, -0.00054, 0.03587], [-2e-05, -0.00047, 0.03634], [0.00276, -0.00047, 0.03629], [0.00558, -0.00067, 0.03595], [0.00844, -0.00103, 0.03517], [0.0113, -0.00127, 0.03431], [0.01394, -0.00155, 0.03328], [0.01638, -0.00186, 0.0317], [0.01841, -0.00229, 0.02975], [0.02003, -0.00278, 0.02719], [0.02152, -0.00298, 0.02477], [0.02288, -0.00335, 0.02235], [0.02424, -0.00341, 0.0198], [0.02508, -0.00357, 0.01716], [0.02567, -0.00361, 0.01427], [0.02653, -0.00368, 0.0118], [0.02821, -0.00381, 0.00876], [0.03031, -0.00361, 0.00562], [0.03144, -0.00318, 0.002], [0.03315, -0.00203, -0.00228], [0.03385, 0.00016, -0.00665], [0.03392, 0.00207, -0.01114], [0.03181, 0.00337, -0.0142], [0.02938, 0.00336, -0.01672]];

const host = document.getElementById("scanscene");
if (host) init(host).catch((e) => { console.warn("Cena 3D indisponível:", e); host.classList.add("is-fallback"); });

async function init(host) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.005, 2);
  camera.position.set(0.12, 0.115, 0.075);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(-0.006, -0.002, 0.004);
  controls.enableZoom = false; controls.enablePan = false; controls.enableDamping = true;
  controls.minPolarAngle = 0.35; controls.maxPolarAngle = 1.35;
  controls.autoRotate = false;
  controls.update();

  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x1a1208, 0.6));
  const key = new THREE.DirectionalLight(0xffe2b0, 1.6); key.position.set(0.3, 0.6, 0.4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x40d7c8, 0.8); rim.position.set(-0.4, 0.2, -0.3); scene.add(rim);

  const draco = new DRACOLoader().setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const base = new URL(".", import.meta.url).href;
  const [arch, wand] = await Promise.all([
    loader.loadAsync(base + "arcada-inferior.glb"),
    loader.loadAsync(base + "scanner-branco.glb"),
  ]);

  // Arcada (cores reais do escaneamento)
  arch.scene.traverse((o) => {
    if (o.isMesh) {
      if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
      o.material = new THREE.MeshStandardMaterial({ vertexColors: !!o.geometry.attributes.color, roughness: 0.42, metalness: 0 });
    }
  });
  scene.add(arch.scene);

  // Scanner: ponteira translúcida, corpo branco brilhante
  wand.scene.traverse((o) => {
    if (!o.isMesh) return;
    const n = o.name;
    if (n.includes("ponteira")) {
      o.material = new THREE.MeshPhysicalMaterial({ color: 0xdfe7ea, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.2, transparent: true, opacity: 0.82, depthWrite: false });
    } else if (n.includes("corpo")) {
      o.material = new THREE.MeshPhysicalMaterial({ color: 0xf2f3f5, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.15 });
    }
  });
  wand.scene.traverse((o) => { if (o.isMesh && !o.geometry.attributes.normal) o.geometry.computeVertexNormals(); });
  wand.scene.scale.setScalar(0.85);
  const wandPivot = new THREE.Group();
  const tilt = new THREE.Group(); tilt.add(wand.scene);
  tilt.rotation.z = THREE.MathUtils.degToRad(-16);
  wandPivot.add(tilt);
  scene.add(wandPivot);

  // Feixe de luz (tronco de pirâmide) da janela até os dentes
  const H = 0.013;
  const beamGeo = frustum(0.012, 0.022, 0.019, 0.036, H);
  const beamMat = new THREE.MeshBasicMaterial({
    map: gradientTexture(), color: 0x3ff0de, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
    wandPivot.add(beam);

  // Brilho sobre os dentes (área escaneada)
  const spot = new THREE.Mesh(
    new THREE.PlaneGeometry(0.038, 0.021),
    new THREE.MeshBasicMaterial({ map: radialTexture(), color: 0x40e8d8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  spot.rotation.x = -Math.PI / 2;
  spot.position.y = -H + 0.0006;
  wandPivot.add(spot);
  const glow = new THREE.PointLight(0x40e8d8, 0.06, 0.05, 2); glow.position.y = -H; wandPivot.add(glow);

  // Curva da trajetória
  const curve = new THREE.CatmullRomCurve3(PATH.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, "centripetal");
  const tangent = new THREE.Vector3(), pos = new THREE.Vector3();
  const place = (u) => {
    curve.getPointAt(u, pos);
    // ponteira aponta para o fundo da boca; o cabo sai pela frente (como no uso real)
    tangent.set(pos.x - MOUTH.x, 0, pos.z - MOUTH.z).normalize();
    wandPivot.position.set(pos.x, pos.y + H, pos.z);
    wandPivot.rotation.y = Math.atan2(-tangent.z, tangent.x);
  };

  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w / h < 1 ? 42 : 32; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(host); resize();

  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(host);
  const clock = new THREE.Clock(); let t = 0.18;
  host.classList.add("is-ready");
  renderer.setAnimationLoop(() => {
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!reduce) t += dt;
    // vai e volta do molar ao canino (12 s por ciclo)
    const k = (Math.sin((t / 12) * Math.PI * 2 - Math.PI / 2) + 1) / 2;
    place(0.03 + k * 0.40);
    beamMat.opacity = 0.85 + Math.sin(t * 6) * 0.1;
    controls.update();
    renderer.render(scene, camera);
  });
}

function frustum(w1, l1, w2, l2, h) {
  // topo (janela) em y=0, base (dentes) em y=-h; x = comprimento, z = largura
  const v = [
    [-l1 / 2, 0, -w1 / 2], [l1 / 2, 0, -w1 / 2], [l1 / 2, 0, w1 / 2], [-l1 / 2, 0, w1 / 2],
    [-l2 / 2, -h, -w2 / 2], [l2 / 2, -h, -w2 / 2], [l2 / 2, -h, w2 / 2], [-l2 / 2, -h, w2 / 2],
  ];
  const pos = [], uv = [];
  const quad = (a, b, c, d) => {
    for (const [i, vv] of [[a, 0], [b, 0], [c, 1], [a, 0], [c, 1], [d, 1]]) { pos.push(...v[i]); uv.push(0.5, vv); }
  };
  quad(0, 1, 5, 4); quad(1, 2, 6, 5); quad(2, 3, 7, 6); quad(3, 0, 4, 7);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
function gradientTexture() {
  const c = document.createElement("canvas"); c.width = 4; c.height = 128;
  const x = c.getContext("2d"); const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "rgba(255,255,255,0.3)"); g.addColorStop(1, "rgba(255,255,255,0.95)");
  x.fillStyle = g; x.fillRect(0, 0, 4, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function radialTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const x = c.getContext("2d"); const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0.9)"); g.addColorStop(0.6, "rgba(255,255,255,0.35)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
