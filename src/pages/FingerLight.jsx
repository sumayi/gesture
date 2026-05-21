/**
 * FingerLight — 指尖光晕页面（路由: /light）
 *
 * 功能：
 *   1. 追踪食指 PIP 关节位置，映射为屏幕上的光晕效果
 *   2. 三层光晕叠加（核心亮心 → 中间光晕 → 外圈辉光）
 *   3. 悬停驻留（dwell）：指尖停留在按钮/遮罩上 3 秒触发点击
 *
 * 性能优化：
 *   - 指尖位置通过 ref 从 useFingerTracking 获取
 *   - 独立 RAF 循环直接操作 DOM transform/样式，绕开 React 渲染
 *   - 悬停/挥手检测仅在状态变化时才 setState
 *
 * 驻留时长：
 *   DWELL_MS = 3000，可通过第 23 行调整。
 */

import { useState, useRef, useEffect } from 'react';
import { useFingerTracking } from '../hooks/useFingerTracking';
import CameraOverlay from '../components/CameraOverlay';

const DWELL_MS = 3000;

export default function FingerLight() {
  const [showModal, setShowModal] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const showModalRef = useRef(false);
  const btnRef = useRef(null);
  const modalRef = useRef(null);
  const coreRef = useRef(null);
  const midRef = useRef(null);
  const haloRef = useRef(null);
  const progressBarRef = useRef(null);
  const lastHoverRef = useRef(false);
  const lastHandRef = useRef(false);
  const dwellStartRef = useRef(null);

  const setShowModalWrap = (v) => { showModalRef.current = v; setShowModal(v); };

  const { videoRef, fingerPosRef, landmarks } = useFingerTracking();
  const [hasHand, setHasHand] = useState(false);

  useEffect(() => {
    let animId;

    function tick() {
      const pos = fingerPosRef.current;
      const show = pos !== null;

      if (show) {
        const sx = pos.x * window.innerWidth;
        const sy = pos.y * window.innerHeight;
        const t = `${sx}px, ${sy}px) translate(-50%, -50%)`;
        if (coreRef.current) coreRef.current.style.transform = `translate(${t}`;
        if (midRef.current) midRef.current.style.transform = `translate(${t}`;
        if (haloRef.current) haloRef.current.style.transform = `translate(${t}`;

        // 检测悬浮 + 驻留计时
        const target = showModalRef.current ? modalRef.current : btnRef.current;
        if (target) {
          const r = target.getBoundingClientRect();
          const over = sx >= r.left && sx <= r.right && sy >= r.top && sy <= r.bottom;

          if (over !== lastHoverRef.current) {
            lastHoverRef.current = over;
            setIsHovering(over);
            if (!over) dwellStartRef.current = null;
          }

          if (over) {
            if (!dwellStartRef.current) dwellStartRef.current = performance.now();
            const progress = Math.min((performance.now() - dwellStartRef.current) / DWELL_MS, 1);
            if (progressBarRef.current) {
              progressBarRef.current.style.width = `${progress * 100}%`;
            }
            if (progress >= 1) {
              dwellStartRef.current = performance.now();
              if (showModalRef.current) {
                setShowModalWrap(false);
              } else {
                setShowModalWrap(true);
              }
            }
          } else {
            dwellStartRef.current = null;
            if (progressBarRef.current) progressBarRef.current.style.width = '0%';
          }
        }
      }

      if (show !== lastHandRef.current) { lastHandRef.current = show; setHasHand(show); }
      animId = requestAnimationFrame(tick);
    }

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="light-page">
      <video ref={videoRef} autoPlay muted playsInline className="hidden-video" />

      <div ref={haloRef} className="glow-halo" />
      <div ref={midRef} className="glow-mid" />
      <div ref={coreRef} className="glow-core" />

      <div className="air-btn-container">
        {hasHand && (
          <div className="btn-wrap">
            <button ref={btnRef} className={`air-btn ${isHovering ? 'hover' : ''}`} onClick={() => setShowModal(true)}>
              点击我
            </button>
            <div className="dwell-bar-track">
              <div ref={progressBarRef} className="dwell-bar-fill" />
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div ref={modalRef} className={`modal-overlay ${isHovering ? 'hover' : ''}`} onClick={() => setShowModalWrap(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">✓</div>
            <div className="modal-text">操作成功！</div>
          </div>
        </div>
      )}

      {!hasHand && (
        <div className="light-hint">请将手放到摄像头前</div>
      )}

      <CameraOverlay videoRef={videoRef} landmarks={landmarks} />
    </div>
  );
}
