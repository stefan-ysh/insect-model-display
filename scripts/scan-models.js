const fs = require('fs');
const path = require('path');
const readline = require('readline');

const dataDir = path.join(__dirname, '..', 'data');

function listObjFiles() {
  return fs.readdirSync(dataDir)
    .filter((name) => name.toLowerCase().endsWith('.obj'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

async function measureObj(fileName) {
  const objPath = path.join(dataDir, fileName);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let vertices = 0;

  const rl = readline.createInterface({ input: fs.createReadStream(objPath) });
  for await (const line of rl) {
    if (!line.startsWith('v ')) continue;
    const point = line.trim().split(/\s+/).slice(1, 4).map(Number);
    if (point.length !== 3 || point.some((value) => !Number.isFinite(value))) continue;
    vertices += 1;
    for (let index = 0; index < 3; index += 1) {
      min[index] = Math.min(min[index], point[index]);
      max[index] = Math.max(max[index], point[index]);
    }
  }

  const size = max.map((value, index) => value - min[index]);
  const center = min.map((value, index) => (value + max[index]) / 2);
  return { vertices, min, max, size, center };
}

function pointFromBox(metrics, nx, ny, nz) {
  return [
    metrics.min[0] + metrics.size[0] * nx - metrics.center[0],
    metrics.min[1] + metrics.size[1] * ny - metrics.center[1],
    metrics.min[2] + metrics.size[2] * nz - metrics.center[2]
  ].map((value) => Number(value.toFixed(6)));
}

function createHotspots(metrics) {
  return [
    { label: '头部', position: pointFromBox(metrics, 0.5, 0.62, 0.9), note: '身体前端区域' },
    { label: '胸部', position: pointFromBox(metrics, 0.5, 0.58, 0.55), note: '腿与翅连接的主体区域' },
    { label: '腹部', position: pointFromBox(metrics, 0.5, 0.5, 0.18), note: '身体后段区域' },
    { label: '左翅', position: pointFromBox(metrics, 0.16, 0.7, 0.48), note: '左侧翅面或背侧突出区域' },
    { label: '右翅', position: pointFromBox(metrics, 0.84, 0.7, 0.48), note: '右侧翅面或背侧突出区域' },
    { label: '左足', position: pointFromBox(metrics, 0.08, 0.26, 0.48), note: '左侧足部外缘' },
    { label: '右足', position: pointFromBox(metrics, 0.92, 0.26, 0.48), note: '右侧足部外缘' }
  ];
}

async function main() {
  const models = [];
  const hotspots = {};

  for (const name of listObjFiles()) {
    const base = name.replace(/\.obj$/i, '');
    const objPath = path.join(dataDir, name);
    const mtlPath = path.join(dataDir, `${base}.mtl`);
    const metrics = await measureObj(name);

    const model = {
      name: `昆虫模型 ${base}`,
      file: `./data/${name}`,
      mtl: fs.existsSync(mtlPath) ? `./data/${base}.mtl` : null,
      size: fs.statSync(objPath).size,
      bounds: {
        min: metrics.min.map((value) => Number(value.toFixed(6))),
        max: metrics.max.map((value) => Number(value.toFixed(6))),
        size: metrics.size.map((value) => Number(value.toFixed(6))),
        vertices: metrics.vertices
      }
    };
    models.push(model);
    hotspots[model.file] = createHotspots(metrics);
  }

  fs.writeFileSync(path.join(dataDir, 'models.json'), `${JSON.stringify(models, null, 2)}\n`);
  fs.writeFileSync(path.join(dataDir, 'models.js'), `window.INSECT_MODELS = ${JSON.stringify(models, null, 2)};\n`);
  fs.writeFileSync(path.join(dataDir, 'hotspots.json'), `${JSON.stringify(hotspots, null, 2)}\n`);
  fs.writeFileSync(path.join(dataDir, 'hotspots.js'), `window.INSECT_HOTSPOTS = ${JSON.stringify(hotspots, null, 2)};\n`);
  console.log(`Scanned ${models.length} OBJ model(s) and generated precise hotspot seeds.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
