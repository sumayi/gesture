# 手势控制图片浏览 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有手势识别项目上增加手势控制的图片浏览功能，支持翻页（上/下一张）和缩放（放大/缩小）

**Architecture:** 提取 useHandLandmarker 自定义 Hook 封装 MediaPipe 检测逻辑，创建 ImageViewer 和 CameraOverlay 两个组件，App.jsx 管理状态并编排三者

**Tech Stack:** React 18 + Vite 5 + MediaPipe HandLandmarker

---

### Task 1: 创建 hooks/useHandLandmarker.js

**Files:**
- Create: `src/hooks/useHandLandmarker.js`

- [ ] **Step 1: 创建 useHandLandmarker hook 文件**

```js
import { useRef, useState, useEffect } from 'react';

export function useHandLandmarker({ onGesture }) {
  const videoRef = useRef(null);
  const [landmarks, setLandmarks] = useState(null);
  const [gestureName, setGestureName] = useState('');
  const landmarkerRef = useRef(null);
  const lastGestureKeyRef = useRef('');
  const lastSpokenRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    let animId;

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (cancelled) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const { FilesetResolver, HandLandmarker } = await import(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/+esm'
        );
        const vision = await FilesetResolver.forVisionTasks('/wasm');
        landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/wasm/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        });

        if (!cancelled) loop();
      } catch (err) {
        console.error('初始化失败:', err);
      }
    }

    function classifyGesture(landmarks) {
      if (landmarks.length !== 21) return null;
      const isOpen = (tip, pip) => landmarks[tip].y < landmarks[pip].y;
      const fingers = [isOpen(8, 6), isOpen(12, 10), isOpen(16, 14), isOpen(20, 18)];
      const extended = fingers.filter(Boolean).length;

      if (extended === 2 && fingers[0] && fingers[1] && !fingers[2] && !fingers[3]) {
        const wrist = landmarks[0];
        const indexTip = landmarks[8];
        const direction = indexTip.x > wrist.x ? 'right' : 'left';
        return { name: '比耶', direction };
      }

      if (extended === 4 && fingers.every(Boolean)) {
        return { name: '张开手' };
      }

      if (extended === 0) {
        return { name: '握拳' };
      }

      return null;
    }

    function speak(text) {
      if (text && text !== lastSpokenRef.current) {
        const msg = new SpeechSynthesisUtterance(text);
        msg.lang = 'zh-CN';
        speechSynthesis.speak(msg);
        lastSpokenRef.current = text;
      }
    }

    async function loop() {
      if (!landmarkerRef.current || !videoRef.current) {
        animId = requestAnimationFrame(loop);
        return;
      }

      const result = await landmarkerRef.current.detectForVideo(videoRef.current, Date.now());

      let detected = null;
      let newGestureName = '';

      if (result.landmarks && result.landmarks.length > 0) {
        const lm = result.landmarks[0];
        setLandmarks(lm);

        const g = classifyGesture(lm);
        if (g) {
          newGestureName = g.name + (g.direction ? `(${g.direction})` : '');
          const gestureKey = `${g.name}_${g.direction || ''}`;
          if (gestureKey !== lastGestureKeyRef.current) {
            lastGestureKeyRef.current = gestureKey;
            speak(g.name);
            onGesture?.(g);
          }
        } else {
          lastGestureKeyRef.current = '';
        }
      } else {
        setLandmarks(null);
        lastGestureKeyRef.current = '';
      }

      setGestureName(newGestureName);
      animId = requestAnimationFrame(loop);
    }

    init();
    return () => {
      cancelled = true;
      cancelAnimationFrame(animId);
    };
  }, []);

  return { videoRef, landmarks, gestureName };
}
```

- [ ] **Step 2: 验证文件语法**

Run: `npx vite build 2>&1 | head -30`
Expected: Build succeeds, no errors

---

### Task 2: 创建 components/ImageViewer.jsx

**Files:**
- Create: `src/components/ImageViewer.jsx`

- [ ] **Step 1: 创建 ImageViewer 组件**

```js
import { useState, useRef } from 'react';

export default function ImageViewer({ currentIndex, zoom, images }) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    if (zoom <= 1) return;
    isPanning.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    setPan(p => ({ x: p.x + dx, y: p.y + dy }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const stopPan = () => { isPanning.current = false; };

  return (
    <div
      className="image-viewer"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={stopPan}
      onMouseLeave={stopPan}
    >
      <img
        src={`/img/${images[currentIndex]}`}
        alt={`图片 ${currentIndex + 1}`}
        style={{
          transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
        }}
      />
      <div className="image-info">
        {currentIndex + 1}/{images.length} · {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证文件语法**

Run: `npx vite build 2>&1 | head -30`
Expected: Build succeeds

---

### Task 3: 创建 components/CameraOverlay.jsx

**Files:**
- Create: `src/components/CameraOverlay.jsx`

- [ ] **Step 1: 创建 CameraOverlay 组件**

```js
import { useRef, useEffect } from 'react';

export default function CameraOverlay({ videoRef, landmarks, gestureName }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    let animId;

    function draw() {
      ctx.clearRect(0, 0, 240, 180);
      ctx.drawImage(video, 0, 0, 240, 180);

      if (landmarks) {
        for (const point of landmarks) {
          ctx.beginPath();
          ctx.arc(point.x * 240, point.y * 180, 3, 0, 2 * Math.PI);
          ctx.fillStyle = 'red';
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animId);
  }, [videoRef, landmarks]);

  return (
    <div className="camera-overlay">
      <canvas ref={canvasRef} width={240} height={180} />
      {gestureName && <div className="gesture-label">{gestureName}</div>}
    </div>
  );
}
```

- [ ] **Step 2: 验证文件语法**

Run: `npx vite build 2>&1 | head -30`
Expected: Build succeeds

---

### Task 4: 更新 App.jsx + index.css

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: 重写 App.jsx 集成所有组件**

```js
import { useState, useCallback } from 'react';
import { useHandLandmarker } from './hooks/useHandLandmarker';
import ImageViewer from './components/ImageViewer';
import CameraOverlay from './components/CameraOverlay';

const IMAGES = [
  '20260428-182932.jpg',
  '20260428-182936.jpg',
  '20260428-182940.jpg',
];

function App() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);

  const handleGesture = useCallback((gesture) => {
    switch (gesture.name) {
      case '比耶':
        if (gesture.direction === 'right') {
          setCurrentIndex(i => Math.min(i + 1, IMAGES.length - 1));
        } else {
          setCurrentIndex(i => Math.max(i - 1, 0));
        }
        break;
      case '张开手':
        setZoom(z => Math.min(z + 0.5, 5));
        break;
      case '握拳':
        setZoom(z => Math.max(z - 0.5, 1));
        break;
    }
  }, []);

  const { videoRef, landmarks, gestureName } = useHandLandmarker({ onGesture: handleGesture });

  return (
    <div className="app">
      <video ref={videoRef} autoPlay muted playsInline className="hidden-video" />
      <ImageViewer currentIndex={currentIndex} zoom={zoom} images={IMAGES} />
      <CameraOverlay videoRef={videoRef} landmarks={landmarks} gestureName={gestureName} />
    </div>
  );
}

export default App;
```

- [ ] **Step 2: 重写 index.css**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body { overflow: hidden; background: #000; width: 100vw; height: 100vh; }

.app { width: 100vw; height: 100vh; position: relative; }

.hidden-video { display: none; }

.image-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.image-viewer img {
  max-width: 90%;
  max-height: 90%;
  object-fit: contain;
  transition: transform 0.2s ease;
  user-select: none;
  -webkit-user-drag: none;
}

.image-info {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  color: #fff;
  font-size: 15px;
  background: rgba(0,0,0,0.6);
  padding: 6px 18px;
  border-radius: 20px;
  font-family: system-ui, sans-serif;
  white-space: nowrap;
  z-index: 10;
}

.camera-overlay {
  position: fixed;
  bottom: 20px;
  right: 20px;
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid rgba(255,255,255,0.3);
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  z-index: 20;
}

.camera-overlay canvas { display: block; }

.gesture-label {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  color: #0f0;
  font-size: 14px;
  font-weight: bold;
  background: rgba(0,0,0,0.7);
  padding: 2px 12px;
  border-radius: 10px;
  font-family: system-ui, sans-serif;
  white-space: nowrap;
}
```

- [ ] **Step 3: 完整构建验证**

Run: `npx vite build 2>&1`
Expected: Build succeeds, no errors

- [ ] **Step 4: 清理旧的项目说明文件**（可选）

Run: `test -f 项目说明.md && echo "存在" || echo "不存在"`
