/**
 * useFingerTracking — 指尖追踪 Hook（指尖光晕页面使用）
 *
 * 功能：
 *   1. 初始化摄像头 + HandLandmarker
 *   2. 每帧追踪食指 PIP 关节 (lm[6]) 的归一化坐标作为光晕位置
 *   3. 检测食指竖立姿态 8→7→6→5，不满足时隐藏光晕
 *
 * 追踪门禁：
 *   食指竖立姿态：lm[8].y < lm[7].y < lm[6].y < lm[5].y
 *   即指尖在最上方，关节依次向下排列。
 *
 * 点击判定交由组件层（FingerLight）的悬停驻留（dwell）逻辑处理。
 */

import { useRef, useState, useEffect } from 'react';

export function useFingerTracking() {
  const videoRef = useRef(null);
  const fingerPosRef = useRef(null);
  const [landmarks, setLandmarks] = useState(null);
  const landmarkerRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let animId;

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

    async function loop() {
      if (!landmarkerRef.current || !videoRef.current) {
        animId = requestAnimationFrame(loop);
        return;
      }

      const result = await landmarkerRef.current.detectForVideo(videoRef.current, Date.now());

      if (result.landmarks && result.landmarks.length > 0) {
        const lm = result.landmarks[0];
        setLandmarks(lm);

        const erected = lm[8].y < lm[7].y && lm[7].y < lm[6].y && lm[6].y < lm[5].y;

        fingerPosRef.current = erected ? { x: lm[6].x, y: lm[6].y } : null;
      } else {
        setLandmarks(null);
        fingerPosRef.current = null;
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
