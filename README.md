# 手势控制图片浏览 + 指尖光晕

基于 MediaPipe HandLandmarker 的实时手势识别应用，包含两个功能页面：手势控制图片浏览（翻页 + 连续捏合缩放）和指尖追踪光晕效果（空中点击）。
参考 https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer?hl=zh-cn
---

## 项目结构

```
手势/
├── index.html                  # Vite 入口 HTML
├── vite.config.js              # Vite 配置
├── package.json                # 依赖管理（React 18 + react-router-dom）
├── .gitignore
├── 项目说明.md                  # 本文件
│
├── docs/superpowers/           # 设计文档和实现计划
│   ├── specs/
│   └── plans/
│
├── public/
│   ├── wasm/                   # MediaPipe 模型与 WASM 运行时
│   │   ├── hand_landmarker.task       # 手部关键点检测模型
│   │   ├── vision_wasm_internal.js    # WASM 桥接脚本
│   │   └── vision_wasm_internal.wasm  # 视觉推理引擎
│   └── img/                    # 浏览的图片（3 张示例）
│
└── src/
    ├── main.jsx                # React 应用入口
    ├── App.jsx                 # 路由配置 + 导航栏
    ├── index.css               # 全局样式
    │
    ├── hooks/
    │   ├── useHandLandmarker.js    # [图片浏览] 手势识别 Hook
    │   └── useFingerTracking.js    # [指尖光晕] 指尖追踪 Hook
    │
    ├── components/
    │   ├── ImageViewer.jsx         # 轮播图片查看器 + 缩略图
    │   └── CameraOverlay.jsx       # 摄像头画中画小窗
    │
    └── pages/
        ├── ImageGallery.jsx        # 路由 / — 图片浏览页
        └── FingerLight.jsx         # 路由 /light — 指尖光晕页
```

---

## 技术栈

| 技术 | 用途 |
|------|------|
| React 18 + Vite 5 | 前端框架与构建工具 |
| react-router-dom | 客户端路由 |
| MediaPipe Tasks Vision | 手部 21 关键点实时检测 |
| Web Speech API | 中文语音播报（已注释） |
| Canvas 2D | 关键点叠加绘制 |

---

## 路由

| 路径 | 页面 | 功能 |
|------|------|------|
| `/` | ImageGallery | 手势控制图片翻页 + 缩放 |
| `/light` | FingerLight | 食指追踪光晕 + 空中点击 |

---

## 手势控制（图片浏览 `/`）

### 手势映射

| 手势 | 判定逻辑 | 操作 |
|------|---------|------|
| 比耶朝右 | 食+中指伸直，无名+小指弯曲，食指 x > 手腕 x | 下一张 |
| 比耶朝左 | 食+中指伸直，无名+小指弯曲，食指 x < 手腕 x | 上一张 |
| 捏合 | 拇指尖(4)到食指尖(8)的距离 / 手大小归一化 | 连续缩放 1x~5x |

### 比耶手势期间缩放锁定
检测到比耶时跳过捏合比例计算，避免翻页时误触缩放。

### 防重复触发
手势连续缺席 10 帧后才允许再次触发，防止帧级抖动导致重复。

### 捏合比例平滑
指数移动平均滤波：`smoothed = 0.85 * prev + 0.15 * raw`

---

## 指尖光晕（`/light`）

### 光晕效果
三层叠加，通过 `transform` GPU 合成实现高性能追踪：

| 层级 | 尺寸 | 颜色 | 说明 |
|------|------|------|------|
| 外圈辉光 | 500px | 淡蓝 6% | 大范围环境光 |
| 中间光晕 | 200px | 淡蓝 20% | 过渡层次 |
| 核心亮心 | 30px | 白→蓝渐变 | 最亮，带发光阴影 |

### 性能优化
- 指尖位置存储在 `ref` 中，不触发 React 重渲染
- 独立 `requestAnimationFrame` 循环直接操作 `DOM.transform`
- 悬停/挥手检测仅在状态变化时 `setState`

### 空中点击
- 食指伸直→弯曲的过渡触发点击
- 校验指尖屏幕坐标是否在按钮范围内
- 成功后弹出绿色勾的模态框

---

## MediaPipe 关键点索引

```
      8   12   16  20
      |   |    |   |
      7  11   15  19
      |   |    |   |
      6  10   14  18
       \  |    |  /
        \ 9   17 /
         \     /
          0---5---9---13---17
          |   |
          1   4
          |   |
          2---3
```

关键索引：
- `0` = 手腕
- `4` = 拇指尖
- `8` = 食指尖（用于方向判定 + 捏合计算）
- `9` = 中指掌指关节（手大小归一化基准）
- `12` = 中指尖
- `6, 10, 14, 18` = 各指近端指间关节（判断手指伸直/弯曲）

---

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:5173）
npm run dev

# 生产构建
npm run build

# 预览构建结果
npm run preview
```

## 使用说明

1. 允许摄像头权限
2. 顶部导航栏切换功能页
3. **图片浏览页**：比耶翻页，捏合缩放
4. **指尖光晕页**：移动食指控制光晕，弯曲点击按钮
