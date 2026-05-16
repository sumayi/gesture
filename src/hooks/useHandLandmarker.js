/**
 * useHandLandmarker — 图片浏览页面的手势识别 Hook
 *
 * 功能：
 *   1. 初始化摄像头 (getUserMedia)
 *   2. 加载 MediaPipe HandLandmarker 模型
 *   3. 每帧检测 21 个手部关键点
 *   4. 手势分类（比耶的左右方向）通过 onGesture 回调通知
 *   5. 连续捏合比例 (pinchRatio) 控制图片缩放
 *   6. 中文语音播报
 *
 * 关键点索引（MediaPipe 规范）：
 *   0 = 手腕        4 = 拇指尖      8 = 食指尖
 *   9 = 中指掌指    12 = 中指尖     16 = 无名指尖  20 = 小拇指尖
 *   6 = 食指近端指间关节  10 = 中指近端指间关节
 *   14 = 无名指近端  18 = 小拇指近端
 *
 * 手势判定规则：
 *   - 指尖 y < 指节 y → 手指伸直（屏幕上 y 越小位置越高）
 *   - 比耶：食指+中指伸直，无名指+小指弯曲
 *   - 方向：食指指尖 x > 手腕 x 为右，否则为左
 */

import { useRef, useState, useEffect } from 'react';

export function useHandLandmarker({ onGesture }) {
  const videoRef = useRef(null);
  const [landmarks, setLandmarks] = useState(null);
  const [gestureName, setGestureName] = useState('');
  const [pinchRatio, setPinchRatio] = useState(null);
  const landmarkerRef = useRef(null);
  const lastGestureKeyRef = useRef('');
  const streamRef = useRef(null);
  const absentFramesRef = useRef(0);
  const ABSENT_THRESHOLD = 10;
  const smoothedPinchRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let animId;

    /** 初始化摄像头和 MediaPipe HandLandmarker */
    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
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

    /** 计算两点距离（欧几里得） */
    function dist(a, b) {
      return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
    }

    /**
     * 计算拇指-食指捏合比例
     *   分子：拇指尖(4) 到 食指尖(8) 的距离
     *   分母：手腕(0) 到 中指掌指(9) 的距离（手大小归一化）
     *   比值 ≈ 0.15 捏紧，≈ 0.8 张开
     */
    function calcPinchRatio(landmarks) {
      const d = dist(landmarks[4], landmarks[8]);
      const handSize = dist(landmarks[0], landmarks[9]);
      return handSize > 0.001 ? d / handSize : 0;
    }

    /**
     * 手势分类
     * @param {Array} landmarks - 21 个手部关键点
     * @returns {Object|null} { name, direction } 或 null
     */
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

      return null;
    }

    /**
     * 检测主循环（每帧执行）
     *   1. detectForVideo 获取关键点
     *   2. 分类手势 → 比耶触发翻页
     *   3. 非比耶时计算捏合比例 → 控制缩放
     *   4. 防重复：手势连续缺席 10 帧才重置
     */
    async function loop() {
      if (!landmarkerRef.current || !videoRef.current) {
        animId = requestAnimationFrame(loop);
        return;
      }

      const result = await landmarkerRef.current.detectForVideo(videoRef.current, Date.now());

      let newGestureName = '';

      if (result.landmarks && result.landmarks.length > 0) {
        const lm = result.landmarks[0];
        setLandmarks(lm);

        const g = classifyGesture(lm);

        if (g) {
          // 比耶手势 → 翻页导航
          absentFramesRef.current = 0;
          newGestureName = g.name + (g.direction ? `(${g.direction})` : '');
          const gestureKey = `${g.name}_${g.direction || ''}`;
          if (gestureKey !== lastGestureKeyRef.current) {
            lastGestureKeyRef.current = gestureKey;
            onGesture?.(g);
          }
        } else {
          // 非比耶 → 计算捏合比例控制缩放（比耶时锁定缩放）
          const raw = calcPinchRatio(lm);
          if (smoothedPinchRef.current === null) {
            smoothedPinchRef.current = raw;
          } else {
            smoothedPinchRef.current = smoothedPinchRef.current * 0.85 + raw * 0.15;
          }
          setPinchRatio(smoothedPinchRef.current);

          absentFramesRef.current++;
          if (absentFramesRef.current >= ABSENT_THRESHOLD) {
            lastGestureKeyRef.current = '';
          }
        }
      } else {
        setLandmarks(null);
        smoothedPinchRef.current = null;
        setPinchRatio(null);
        absentFramesRef.current++;
        if (absentFramesRef.current >= ABSENT_THRESHOLD) {
          lastGestureKeyRef.current = '';
        }
      }

      setGestureName(newGestureName);
      animId = requestAnimationFrame(loop);
    }

    init();
    return () => {
      cancelled = true;
      cancelAnimationFrame(animId);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return { videoRef, landmarks, gestureName, pinchRatio };
}
