# Insect Model Display

一个用于展示 `data/` 目录昆虫 OBJ 模型的轻量网页项目。页面只支持内置模型列表，不支持拖拽导入、不支持用户手动加载外部模型，适合快速部署为静态展示页。

## 技术栈

- 原生 HTML / CSS / JavaScript
- Three.js 本地文件，位于 `vendor/three/`
- 无后端、无构建步骤
- 模型来源固定为根目录 `data/`

## 已支持的 3D 操作

- data 模型列表切换
- 移动端模型下拉选择
- 鼠标/触控旋转、缩放、平移
- 自动旋转开关与速度调节
- 模型缩放
- 模型颜色调节
- 背景颜色调节
- 灯光强度调节
- 材质粗糙度调节
- 材质预设：标本、哑光、金属、半透明
- 线框模式
- 正面、侧面、俯视、等轴视角预设
- 模型尺寸信息
- 剖切平面查看，支持 X/Y/Z 轴和位置调节
- 每个模型独立热点标注：头部、胸部、腹部、左翅、右翅、左足、右足
- 自动巡展，自动切换模型和视角
- 重置视角
- 全屏查看

## 模型目录

当前模型放在根目录的 `data/` 下。

- `data/models.json` 是模型清单
- `data/models.js` 用于页面直接渲染模型列表
- 新增或删除 OBJ 后，重新运行清单生成脚本

```bash
node scripts/scan-models.js
```

## 本地与上线

页面不再依赖 CDN，Three.js 已放在本地 `vendor/three/`。模型读取仍需要浏览器允许静态资源请求。部署到 GitHub Pages、Netlify、Vercel、Cloudflare Pages 后可以直接使用。

如果直接双击 `index.html`，部分浏览器会阻止读取本地 `data/*.obj`。这种限制来自浏览器安全策略，不是代码问题。最终上线为静态网页即可正常加载。

## 后续可继续增强

- 每个模型独立热点数据，已生成 `data/hotspots.json` 和 `data/hotspots.js`
- 如需手动微调热点，编辑 `data/hotspots.json` 中对应模型的 `position: [x, y, z]`，再同步更新 `data/hotspots.js`，或重新运行 `node scripts/scan-models.js` 生成基础位置
- 精确测距工具，点击模型两点显示距离
- 高清截图导出
- 多模型同屏对比
- 模型分类、搜索和收藏
