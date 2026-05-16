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
