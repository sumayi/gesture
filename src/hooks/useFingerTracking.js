/**
 * useFingerTracking — 指尖追踪 Hook（指尖光晕页面使用）
 *
 * 功能：
 *   1. 初始化摄像头 + HandLandmarker
 *   2. 每帧追踪食指 PIP 关节 (lm[6]) 的归一化坐标作为光晕位置
 *   3. 检测食指 8→7→6→5 竖立姿态下的点击（6 ≈ 7 同水平）
 *
 * 追踪门禁：
 *   食指竖立姿态：lm[8].y < lm[7].y < lm[6].y < lm[5].y
 *   即指尖在最上方，关节依次向下排列。
 *   不满足时隐藏光晕、重置状态机。
 *
 * 空中点击判定：
 *   竖立姿态下，lm[6].y 与 lm[7].y 接近到阈值内 → 视为弯曲 → 触发点击。
 *   点击后必须回到竖立姿态才能再次触发。
 *
 * 阈值配置：
 *   CLICK_THRESHOLD = 0.025（归一化坐标），可根据手感调整。
 */

import { useRef, useState, useEffect } from 'react';

const CLICK_THRESHOLD = 0.05;

export function useFingerTracking({ onAirClick } = {}) {
  const videoRef = useRef(null);
  // 使用 ref 存储指尖位置，避免每帧触发 React 渲染
  const fingerPosRef = useRef(null);
  const [landmarks, setLandmarks] = useState(null);
  const landmarkerRef = useRef(null);
  const streamRef = useRef(null);
  // 用 ref 持有最新的回调，避免闭包过期问题
  const onAirClickRef = useRef(onAirClick);
  const fingerStateRef = useRef('');

  onAirClickRef.current = onAirClick;

  useEffect(() => {
    let cancelled = false;
    let animId;

    /** 初始化摄像头和 MediaPipe */
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

    /** 检测主循环：追踪食指位置 + 检测弯曲点击 */
    async function loop() {
      if (!landmarkerRef.current || !videoRef.current) {
        animId = requestAnimationFrame(loop);
        return;
      }

      const result = await landmarkerRef.current.detectForVideo(videoRef.current, Date.now());

      if (result.landmarks && result.landmarks.length > 0) {
        const lm = result.landmarks[0];
        setLandmarks(lm);

        // 检查食指竖立姿态：8(指尖) → 7 → 6(PIP) → 5(MCP)，y 依次递增
        const erected = lm[8].y < lm[7].y && lm[7].y < lm[6].y && lm[6].y < lm[5].y;

        if (erected) {
          fingerPosRef.current = { x: lm[6].x, y: lm[6].y };

          // lm[6] 与 lm[7] 同水平 → 弯曲 → 触发点击
          const level = Math.abs(lm[6].y - lm[7].y) < CLICK_THRESHOLD;
          const state = level ? 'bent' : 'straight';
          if (fingerStateRef.current === 'straight' && state === 'bent') {
            onAirClickRef.current?.();
          }
          fingerStateRef.current = state;
        } else {
          fingerPosRef.current = null;
          fingerStateRef.current = '';
        }
      } else {
        setLandmarks(null);
        fingerPosRef.current = null;
        fingerStateRef.current = '';
      }

      animId = requestAnimationFrame(loop);
    }

    init();
    return () => {
      cancelled = true;
      cancelAnimationFrame(animId);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return { videoRef, fingerPosRef, landmarks };
}
