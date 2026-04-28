const canvas = document.querySelector('#sceneCanvas');
const modelName = document.querySelector('#modelName');
const modelHint = document.querySelector('#modelHint');
const modelList = document.querySelector('#modelList');
const modelSelect = document.querySelector('#modelSelect');
const viewerCard = document.querySelector('.viewer-card');
const hotspotLayer = document.querySelector('#hotspotLayer');
const colorPicker = document.querySelector('#colorPicker');
const bgPicker = document.querySelector('#bgPicker');
const materialSelect = document.querySelector('#materialSelect');
const scaleRange = document.querySelector('#scaleRange');
const speedRange = document.querySelector('#speedRange');
const roughnessRange = document.querySelector('#roughnessRange');
const lightRange = document.querySelector('#lightRange');
const clipAxis = document.querySelector('#clipAxis');
const clipRange = document.querySelector('#clipRange');
const scaleValue = document.querySelector('#scaleValue');
const speedValue = document.querySelector('#speedValue');
const roughnessValue = document.querySelector('#roughnessValue');
const lightValue = document.querySelector('#lightValue');
const clipValue = document.querySelector('#clipValue');
const dimensionText = document.querySelector('#dimensionText');
const resetBtn = document.querySelector('#resetBtn');
const fullscreenBtn = document.querySelector('#fullscreenBtn');
const spinBtn = document.querySelector('#spinBtn');
const wireBtn = document.querySelector('#wireBtn');
const clipToggle = document.querySelector('#clipToggle');
const hotspotBtn = document.querySelector('#hotspotBtn');
const tourBtn = document.querySelector('#tourBtn');
const viewButtons = document.querySelectorAll('[data-view]');

const MATERIAL_PRESETS = {
  specimen: { roughness: 0.58, metalness: 0.08, opacity: 1, emissive: 0.08 },
  matte: { roughness: 0.92, metalness: 0.02, opacity: 1, emissive: 0.04 },
  metal: { roughness: 0.28, metalness: 0.68, opacity: 1, emissive: 0.03 },
  translucent: { roughness: 0.42, metalness: 0.02, opacity: 0.42, emissive: 0.1 }
};

const scene = new THREE.Scene();
let stageColor = new THREE.Color(bgPicker.value);
scene.fog = new THREE.Fog(stageColor, 8, 22);

const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 1000);
camera.position.set(3.6, 2.4, 5.2);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
const isCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCoarsePointer ? 1.35 : 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.localClippingEnabled = true;
renderer.setClearColor(stageColor, 1);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = Number(speedRange.value);
controls.minDistance = 1.2;
controls.maxDistance = 18;
controls.target.set(0, -0.1, 0);

const keyLight = new THREE.DirectionalLight(0xffe3b1, Number(lightRange.value));
keyLight.position.set(4, 6, 3);
scene.add(keyLight);
scene.add(new THREE.HemisphereLight(0xdcecff, 0x2b1a10, 2.4));
scene.add(new THREE.AmbientLight(0xffffff, 0.65));

const clipPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
const clock = new THREE.Clock();

let specimen = new THREE.Group();
let baseScale = 1;
let specimenBaseY = 0;
let wireframe = false;
let clippingEnabled = false;
let hotspotsEnabled = false;
let activeModelFile = '';
let activeHotspots = [];
let currentFrame = null;
let currentView = 'iso';
let currentDimensions = null;
let tourTimer = null;
let isLoading = false;
scene.add(specimen);

renderModelList();
autoLoadFirstModel();
renderHotspots();

function normalizeSpecimen(object, label) {
  const wrapper = new THREE.Group();
  wrapper.name = label || object.name || '昆虫模型';
  object.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3();
  box.getCenter(center);

  object.position.x -= center.x;
  object.position.y -= center.y;
  object.position.z -= center.z;
  wrapper.add(object);
  return wrapper;
}

function autoLoadFirstModel() {
  const models = window.INSECT_MODELS || [];
  if (models.length) {
    loadCatalogModel(models[0]);
    return;
  }
  setHint('没有找到 data 模型，请先运行 node scripts/scan-models.js 生成清单');
}

function loadCatalogModel(model) {
  if (!model || isLoading) return;
  isLoading = true;
  setHint(`正在加载 ${model.name}...`);
  setActiveModel(model.file);
  activeHotspots = window.INSECT_HOTSPOTS?.[model.file] || [];

  new THREE.OBJLoader().load(
    model.file,
    (object) => {
      replaceSpecimen(normalizeSpecimen(object, model.name), model.name, '模型已加载，已自动居中显示');
      isLoading = false;
    },
    (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      setHint(`正在加载 ${model.name}... ${percent}%`);
    },
    (error) => {
      console.error(error);
      setHint('当前浏览器阻止读取 data 模型。请部署到静态站点后访问，或使用本地静态服务预览。');
      isLoading = false;
    }
  );
}

function replaceSpecimen(object, label, hint) {
  scene.remove(specimen);
  disposeObject(specimen);
  specimen = object;
  scene.add(specimen);
  modelName.textContent = label;
  fitObjectToView(specimen);
  applyMaterialState();
  updateClipPlane();
  renderHotspots();
  setHint(hint || '模型已加载');
}

function fitObjectToView(object) {
  object.position.set(0, specimenBaseY, 0);
  object.rotation.set(0, 0, 0);
  object.scale.setScalar(1);
  object.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const sphere = new THREE.Sphere();
  box.getSize(size);
  box.getBoundingSphere(sphere);

  currentDimensions = size.clone();
  updateDimensionReadout();

  const radius = Math.max(sphere.radius, 0.1);
  baseScale = 1.95 / radius;
  updateScale();

  currentFrame = { radius: radius * baseScale, targetY: specimenBaseY };
  frameCamera();
}

function frameCamera(view = currentView) {
  if (!currentFrame) return;
  currentView = view;
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const usefulFov = Math.max(Math.min(verticalFov, horizontalFov), 0.42);
  const distance = Math.max((currentFrame.radius * 1.28) / Math.sin(usefulFov / 2), 3.2);
  const directions = {
    front: new THREE.Vector3(0, 0.08, 1),
    side: new THREE.Vector3(1, 0.08, 0),
    top: new THREE.Vector3(0.01, 1, 0.01),
    iso: new THREE.Vector3(0.54, 0.22, 0.82)
  };
  const direction = (directions[view] || directions.iso).normalize();

  controls.target.set(0, currentFrame.targetY, 0);
  camera.position.copy(controls.target).add(direction.multiplyScalar(distance));
  camera.near = Math.max(distance / 120, 0.01);
  camera.far = Math.max(distance * 120, 1000);
  camera.updateProjectionMatrix();
  controls.minDistance = Math.max(distance * 0.22, 0.4);
  controls.maxDistance = distance * 3.2;
  controls.update();
}

function applyMaterialState() {
  const color = new THREE.Color(colorPicker.value);
  const preset = MATERIAL_PRESETS[materialSelect.value] || MATERIAL_PRESETS.specimen;
  specimen.traverse((child) => {
    if (!child.isMesh) return;
    if (child.geometry) {
      child.geometry.computeBoundingBox();
      child.geometry.computeBoundingSphere();
      if (!child.geometry.attributes.normal) child.geometry.computeVertexNormals();
    }
    child.frustumCulled = false;
    disposeMaterial(child.material);
    child.material = new THREE.MeshStandardMaterial({
      color,
      roughness: Number(roughnessRange.value),
      metalness: preset.metalness,
      opacity: preset.opacity,
      transparent: preset.opacity < 1,
      depthWrite: preset.opacity >= 1,
      emissive: color.clone().multiplyScalar(preset.emissive),
      side: THREE.DoubleSide,
      wireframe,
      clippingPlanes: clippingEnabled ? [clipPlane] : []
    });
  });
}

function updateScale() {
  const scale = Number(scaleRange.value);
  specimen.scale.setScalar(baseScale * scale);
  scaleValue.textContent = `${scale.toFixed(2)}x`;
}

function updateDimensionReadout() {
  if (!currentDimensions) {
    dimensionText.textContent = '等待模型加载';
    return;
  }
  dimensionText.textContent = `X ${formatUnit(currentDimensions.x)} · Y ${formatUnit(currentDimensions.y)} · Z ${formatUnit(currentDimensions.z)}`;
}

function updateClipPlane() {
  const axis = clipAxis.value;
  const offset = (Number(clipRange.value) / 100) * (currentFrame?.radius || 1);
  const normals = {
    x: new THREE.Vector3(1, 0, 0),
    y: new THREE.Vector3(0, 1, 0),
    z: new THREE.Vector3(0, 0, 1)
  };
  clipPlane.normal.copy(normals[axis] || normals.x);
  clipPlane.constant = -offset;
  clipValue.textContent = `${clipRange.value}%`;
}

function renderModelList() {
  const models = window.INSECT_MODELS || [];
  if (!models.length) {
    modelList.innerHTML = '<p class="empty-models">没有扫描到 data/*.obj</p>';
    modelSelect.innerHTML = '<option>没有可用模型</option>';
    modelSelect.disabled = true;
    return;
  }

  modelSelect.disabled = false;
  modelSelect.innerHTML = models.map((model, index) => '<option value="' + index + '">' + model.name + ' · ' + formatBytes(model.size) + '</option>').join('');
  modelSelect.addEventListener('change', () => {
    stopTour();
    loadCatalogModel(models[Number(modelSelect.value)]);
  });

  modelList.innerHTML = models.map((model, index) => `
    <button class="model-item" type="button" data-file="${model.file}" data-index="${index}">
      <span>${model.name}</span>
      <small>${formatBytes(model.size)}</small>
    </button>
  `).join('');

  modelList.querySelectorAll('.model-item').forEach((button) => {
    button.addEventListener('click', () => {
      stopTour();
      loadCatalogModel(models[Number(button.dataset.index)]);
    });
  });
}

function setActiveModel(file) {
  activeModelFile = file;
  const models = window.INSECT_MODELS || [];
  const index = models.findIndex((model) => model.file === activeModelFile);
  if (modelSelect && index >= 0) modelSelect.value = String(index);
  document.querySelectorAll('.model-item').forEach((item) => {
    item.classList.toggle('is-active', item.dataset.file === activeModelFile);
  });
}

function renderHotspots() {
  const hotspots = activeHotspots.length ? activeHotspots : [];
  hotspotLayer.innerHTML = hotspots.map((hotspot, index) => `
    <button class="hotspot" type="button" data-index="${index}" title="${hotspot.note || hotspot.label}">${hotspot.label}</button>
  `).join('');
}

function updateHotspots() {
  if (!hotspotsEnabled || !currentFrame) {
    hotspotLayer.classList.remove('is-visible');
    return;
  }
  if (!activeHotspots.length) {
    hotspotLayer.classList.remove('is-visible');
    return;
  }
  hotspotLayer.classList.add('is-visible');
  const rect = viewerCard.getBoundingClientRect();
  hotspotLayer.querySelectorAll('.hotspot').forEach((node) => {
    const hotspot = activeHotspots[Number(node.dataset.index)];
    if (!hotspot?.position) return;
    const point = new THREE.Vector3(...hotspot.position);
    const projected = point.clone().applyMatrix4(specimen.matrixWorld).project(camera);
    const visible = projected.z > -1 && projected.z < 1;
    node.style.display = visible ? 'block' : 'none';
    node.style.transform = `translate(${(projected.x * 0.5 + 0.5) * rect.width}px, ${(-projected.y * 0.5 + 0.5) * rect.height}px) translate(-50%, -50%)`;
  });
}

function toggleTour() {
  if (tourTimer) {
    stopTour();
    return;
  }
  const models = window.INSECT_MODELS || [];
  if (!models.length) return;
  const views = ['iso', 'front', 'side', 'top'];
  let step = Math.max(models.findIndex((model) => model.file === activeModelFile), 0);
  tourTimer = window.setInterval(() => {
    if (isLoading) return;
    step = (step + 1) % models.length;
    frameCamera(views[step % views.length]);
    loadCatalogModel(models[step]);
  }, 8000);
  setToggle(tourBtn, true, '巡展');
}

function stopTour() {
  if (!tourTimer) return;
  window.clearInterval(tourTimer);
  tourTimer = null;
  setToggle(tourBtn, false, '巡展');
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

function formatUnit(value) {
  if (!Number.isFinite(value)) return '-';
  return value >= 10 ? value.toFixed(1) : value.toFixed(3);
}

function setHint(text) {
  modelHint.textContent = text;
}

function disposeMaterial(material) {
  if (!material) return;
  const materials = Array.isArray(material) ? material : [material];
  materials.forEach((item) => item?.dispose());
}

function disposeObject(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry?.dispose();
    disposeMaterial(child.material);
  });
}

function resizeRenderer() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const width = Math.max(Math.floor(rect.width), 1);
  const height = Math.max(Math.floor(rect.height), 1);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  frameCamera();
}

function updateStageColor() {
  stageColor = new THREE.Color(bgPicker.value);
  renderer.setClearColor(stageColor, 1);
  scene.fog.color.copy(stageColor);
  document.documentElement.style.setProperty('--stage', bgPicker.value);
}

function setToggle(button, enabled, label) {
  button.setAttribute('aria-pressed', String(enabled));
  button.textContent = `${label}：${enabled ? '开' : '关'}`;
}

colorPicker.addEventListener('input', applyMaterialState);
bgPicker.addEventListener('input', updateStageColor);
materialSelect.addEventListener('change', () => {
  const preset = MATERIAL_PRESETS[materialSelect.value] || MATERIAL_PRESETS.specimen;
  roughnessRange.value = preset.roughness;
  roughnessValue.textContent = Number(roughnessRange.value).toFixed(2);
  applyMaterialState();
});
roughnessRange.addEventListener('input', () => {
  roughnessValue.textContent = Number(roughnessRange.value).toFixed(2);
  applyMaterialState();
});
scaleRange.addEventListener('input', updateScale);
speedRange.addEventListener('input', () => {
  controls.autoRotateSpeed = Number(speedRange.value);
  speedValue.textContent = Number(speedRange.value).toFixed(2);
});
lightRange.addEventListener('input', () => {
  keyLight.intensity = Number(lightRange.value);
  lightValue.textContent = Number(lightRange.value).toFixed(1);
});
clipToggle.addEventListener('click', () => {
  clippingEnabled = !clippingEnabled;
  updateClipPlane();
  setToggle(clipToggle, clippingEnabled, '剖切');
  applyMaterialState();
});
clipAxis.addEventListener('change', () => {
  updateClipPlane();
  applyMaterialState();
});
clipRange.addEventListener('input', () => {
  updateClipPlane();
  applyMaterialState();
});
resetBtn.addEventListener('click', () => fitObjectToView(specimen));
viewButtons.forEach((button) => {
  button.addEventListener('click', () => frameCamera(button.dataset.view));
});
fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    viewerCard.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
});
spinBtn.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  setToggle(spinBtn, controls.autoRotate, '自动旋转');
});
wireBtn.addEventListener('click', () => {
  wireframe = !wireframe;
  setToggle(wireBtn, wireframe, '线框');
  applyMaterialState();
});
hotspotBtn.addEventListener('click', () => {
  hotspotsEnabled = !hotspotsEnabled;
  setToggle(hotspotBtn, hotspotsEnabled, '标注');
  updateHotspots();
});
tourBtn.addEventListener('click', toggleTour);

const resizeObserver = new ResizeObserver(resizeRenderer);
resizeObserver.observe(canvas.parentElement);

document.addEventListener('fullscreenchange', resizeRenderer);

function animate() {
  const elapsed = clock.getElapsedTime();
  controls.update();
  specimen.position.y = specimenBaseY + Math.sin(elapsed * 1.5) * 0.035;
  updateHotspots();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

resizeRenderer();
animate();
