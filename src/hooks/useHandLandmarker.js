import { useRef, useState, useEffect } from 'react';

export function useHandLandmarker({ onGesture }) {
  const videoRef = useRef(null);
  const [landmarks, setLandmarks] = useState(null);
  const [gestureName, setGestureName] = useState('');
  const landmarkerRef = useRef(null);
  const lastGestureKeyRef = useRef('');
  const lastSpokenRef = useRef('');
  const streamRef = useRef(null);
  const absentFramesRef = useRef(0);
  const ABSENT_THRESHOLD = 10;

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
            speak(g.name);
            onGesture?.(g);
          }
        } else {
          absentFramesRef.current++;
          if (absentFramesRef.current >= ABSENT_THRESHOLD) {
            lastGestureKeyRef.current = '';
          }
        }
      } else {
        setLandmarks(null);
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

  return { videoRef, landmarks, gestureName };
}
