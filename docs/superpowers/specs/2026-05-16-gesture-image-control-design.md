# 手势控制图片浏览 — 设计文档

## 概述
在现有手势识别 + 语音播报项目基础上，增加手势控制的图片浏览功能。用户通过摄像头手势实现图片翻页（上/下一张）和缩放（放大/缩小）。

## 布局
- **画中画模式**：图片全屏显示，摄像头画面以浮动小窗叠加在右下角
- 摄像头小窗尺寸约 240×180px，固定右下角

## 手势映射

| 手势 | 检测逻辑 | 操作 |
|------|---------|------|
| 比耶朝右 | 食+中指张开，无名+小指闭合，指尖 x > 手腕 x | 下一张 |
| 比耶朝左 | 食+中指张开，无名+小指闭合，指尖 x < 手腕 x | 上一张 |
| 张开手 | 四指全部张开 | 放大 +0.5x |
| 握拳 | 四指全部闭合（延伸数=0） | 缩小 -0.5x |

### 手势方向判定
- 以手腕 (landmark 0) 为锚点，食指指尖 (landmark 8) 的 x 坐标相对位置决定左/右
- `indexTip.x > wrist.x` → 朝右 → 下一张
- `indexTip.x < wrist.x` → 朝左 → 上一张

### 防重复触发
- 每个手势只触发一次动作，直到回到"无手势/其他手势"状态才能再次触发
- 比耶方向改变（左→右或右→左）也视为新触发

## 架构

```
手势/
├── src/
│   ├── main.jsx
│   ├── App.jsx              # 主组件：状态管理 + 手势路由
│   ├── hooks/
│   │   └── useHandLandmarker.js  # HandLandmarker 初始化 + 检测循环 + 手势分类
│   ├── components/
│   │   ├── ImageViewer.jsx      # 全屏图片显示 + 缩放/平移
│   │   └── CameraOverlay.jsx    # 摄像头画中画小窗
│   └── index.css
├── public/
│   ├── wasm/                # MediaPipe 运行时
│   └── img/                 # 图片资源（3张）
└── index.html
```

## 组件设计

### App.jsx
- 管理状态：`currentIndex`(当前图片索引), `zoom`(缩放级别), `gestureName`(当前手势名)
- useHandLandmarker 返回值：`{ landmarks, gestureName }`
- 调用 useHandLandmarker hook 传入 `onGesture` 回调
- 回调中根据手势结果更新状态

### hooks/useHandLandmarker.js
- 封装 FilesetResolver + HandLandmarker 初始化
- 封装 classifyGesture()，返回 `{ name, direction }` 或 null
- 初始化摄像头流
- 运行 requestAnimationFrame 检测循环
- 检测到有效手势时调用 `onGesture` 回调，自带防重复逻辑

### components/ImageViewer.jsx
- Props: `currentIndex`, `zoom`, `onPrev`, `onNext`, `onZoomIn`, `onZoomOut`
- 显示 `/img/{images[currentIndex]}` 
- `transform: scale(zoom)` + `transform-origin: center center`
- 缩放范围 1x ~ 5x，步进 0.5x
- 鼠标拖拽平移（zoom > 1 时）
- 显示页码 "2/3" 和缩放比 "200%"

### components/CameraOverlay.jsx
- Props: `videoRef`, `landmarks`, `gestureName`
- 固定在右下角的 canvas 小窗
- 独立 rAF 循环绘制摄像头画面 + 红色关键点
- 显示当前识别到的手势名称

## 数据流

```
useHandLandmarker 内部:
  摄像头 → detectForVideo → landmarks
  → classifyGesture(landmarks) → { name, direction } | null
  → 防重复检查通过 → onGesture({ name, direction })
  → landmarks / gestureName 通过返回值暴露给父组件

App.jsx:
  onGesture 回调 → setState({ currentIndex, zoom, gestureName })
  → ImageViewer / CameraOverlay 重新渲染
```

## 边界情况
- 首张时"上一张"不操作，尾张时"下一张"不操作
- zoom=1x 时缩小不操作，zoom=5x 时放不操作
- 仅当 gesture 发生变化时才触发动作（防抖）
