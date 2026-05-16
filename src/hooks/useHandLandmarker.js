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

    function dist(a, b) {
      return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
    }

    function calcPinchRatio(landmarks) {
      const d = dist(landmarks[4], landmarks[8]);
      const handSize = dist(landmarks[0], landmarks[9]);
      return handSize > 0.001 ? d / handSize : 0;
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

      return null;
    }

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
          absentFramesRef.current = 0;
          newGestureName = g.name + (g.direction ? `(${g.direction})` : '');
          const gestureKey = `${g.name}_${g.direction || ''}`;
          if (gestureKey !== lastGestureKeyRef.current) {
            lastGestureKeyRef.current = gestureKey;
            onGesture?.(g);
          }
        } else {
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
