/**
 * useFingerTracking — 指尖追踪 Hook（指尖光晕页面使用）
 *
 * 功能：
 *   1. 初始化摄像头 + HandLandmarker
 *   2. 每帧追踪食指 PIP 关节 (lm[6]) 的归一化坐标作为光晕位置
 *   3. 检测食指伸直→弯曲的过渡，触发空中点击 (onAirClick)
 *
 * 为什么用 lm[6]（PIP 关节）而非 lm[8]（指尖）：
 *   弯曲食指时，指尖 (lm[8]) 会大幅下移，导致光晕跳动。
 *   PIP 关节 (lm[6]) 在弯曲时位置基本不变，光晕更稳定。
 *   点击判定仍使用 lm[8] vs lm[6] 的 y 轴相对位置。
 *
 * 与 useHandLandmarker 的区别：
 *   - 更轻量：不分类手势、不计算捏合比例
 *   - fingerPos 使用 ref 而非 state，避免频繁渲染
 *   - 仅关注食指状态
 *
 * 指人姿态（pointing pose）校验：
 *   仅当食指伸直 + 中/无名/小指卷曲时才激活追踪和点击检测，
 *   避免张手（五指全伸）被误识别为食指。
 *
 * 空中点击判定：
 *   食指伸直 → 弯曲的过渡视为一次"点击"
 *   lm[8].y < lm[6].y → 伸直（指尖高于指节）
 *   lm[8].y >= lm[6].y → 弯曲
 */

import { useRef, useState, useEffect } from 'react';

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

        // 检查"食指指人"姿态：仅食指伸直，其余手指卷曲
        // 食指伸直: lm[8].y < lm[6].y（指尖高于 PIP 关节）
        // 中指卷曲: lm[12].y > lm[10].y（指尖低于 PIP 关节）
        // 无名指卷曲: lm[16].y > lm[14].y
        // 小指卷曲: lm[20].y > lm[18].y
        const indexStraight = lm[8].y < lm[6].y;
        const middleCurled = lm[12].y > lm[10].y;
        const ringCurled = lm[16].y > lm[14].y;
        const pinkyCurled = lm[20].y > lm[18].y;
        const pointing = indexStraight && middleCurled && ringCurled && pinkyCurled;

        if (pointing) {
          // 使用 PIP 关节 (lm[6]) 作为光晕位置，弯曲时比指尖更稳定
          fingerPosRef.current = { x: lm[6].x, y: lm[6].y };

          // 检测伸直→弯曲的过渡 → 触发空中点击
          const state = lm[8].y < lm[6].y ? 'straight' : 'bent';
          if (fingerStateRef.current === 'straight' && state === 'bent') {
            onAirClickRef.current?.();
          }
          fingerStateRef.current = state;
        } else {
          // 非指人姿态：隐藏光晕，重置状态机
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
