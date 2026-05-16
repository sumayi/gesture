/**
 * CameraOverlay — 摄像头画中画小窗
 *
 * 功能：
 *   1. 右下角浮动窗口，实时显示摄像头画面
 *   2. 叠加绘制 MediaPipe 手部关键点（红色圆点）
 *   3. 可选显示当前识别到的手势名称
 *
 * Props:
 *   videoRef    - <video> 元素的 ref
 *   landmarks   - 21 个手部关键点数组
 *   gestureName - 当前手势名称（可选，不传则不显示）
 *
 * 渲染方式：
 *   独立 requestAnimationFrame 循环绘制 Canvas，
 *   不依赖 React 重渲染驱动（避免不必要的渲染开销）
 */

import { useRef, useEffect } from 'react';

export default function CameraOverlay({ videoRef, landmarks, gestureName }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    let animId;

    /** 每帧绘制摄像头画面 + 关键点叠加 */
    function draw() {
      // 清空并绘制当前视频帧
      ctx.clearRect(0, 0, 240, 180);
      ctx.drawImage(video, 0, 0, 240, 180);

      // 在关键点位置绘制红色圆点（直径 3px）
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
