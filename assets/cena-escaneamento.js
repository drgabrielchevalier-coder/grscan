/* Cena 3D: scanner varrendo a arcada inferior (escaneamento real) */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// Trajetória sobre as cúspides (x, y, z em metros), de molar a molar
const MOUTH = { x: 0, z: 0.11 }; // ponto à frente dos incisivos
const PATH = [[-0.02426, 0.00587, -0.02208], [-0.02497, 0.00541, -0.0192], [-0.02573, 0.00486, -0.01577], [-0.02525, 0.00398, -0.01153], [-0.02529, 0.00353, -0.00838], [-0.02431, 0.00271, -0.00502], [-0.02372, 0.00197, -0.00197], [-0.02312, 0.00152, 0.00076], [-0.02226, 0.0011, 0.00316], [-0.02126, 0.0009, 0.00556], [-0.02042, 0.00092, 0.00766], [-0.01953, 0.00095, 0.00956], [-0.01874, 0.00063, 0.01156], [-0.01785, 0.00037, 0.0136], [-0.01705, 3e-05, 0.01563], [-0.01599, -0.0001, 0.0177], [-0.01469, -0.00021, 0.01965], [-0.01315, -0.00016, 0.02151], [-0.01137, -0.00034, 0.02318], [-0.00937, -0.00068, 0.02464], [-0.00724, -0.00093, 0.02574], [-0.0049, -0.00099, 0.02619], [-0.00248, -0.00114, 0.02656], [5e-05, -0.00126, 0.02678], [0.00251, -0.0013, 0.02671], [0.00482, -0.00119, 0.02618], [0.00685, -0.00091, 0.0248], [0.0087, -0.00066, 0.02325], [0.01039, -0.00057, 0.02149], [0.01206, -0.00081, 0.01995], [0.01352, -0.0007, 0.0183], [0.01476, -0.0005, 0.01653], [0.01559, -0.00043, 0.01479], [0.01632, -0.00041, 0.01283], [0.0171, -0.0003, 0.01095], [0.01792, -3e-05, 0.00907], [0.01883, -0.00021, 0.00725], [0.01921, -0.00035, 0.00523], [0.02037, -8e-05, 0.00308], [0.02123, 0.00029, 0.00086], [0.02212, 0.00083, -0.00161], [0.02298, 0.00145, -0.00455], [0.02492, 0.00254, -0.00855], [0.02634, 0.00361, -0.01262], [0.02654, 0.00427, -0.01615], [0.02491, 0.00403, -0.01882], [0.02322, 0.00306, -0.02147]];

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
