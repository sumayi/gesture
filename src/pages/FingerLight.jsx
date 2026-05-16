/**
 * FingerLight — 指尖光晕页面（路由: /light）
 *
 * 功能：
 *   1. 追踪食指 PIP 关节位置，映射为屏幕上的光晕效果（弯曲时不抖动）
 *   2. 三层光晕叠加（核心亮心 → 中间光晕 → 外圈辉光）
 *   3. 空中点击：食指弯曲触发点击，命中页面中央按钮弹出成功提示
 *
 * 性能优化：
 *   - 指尖位置通过 ref 从 useFingerTracking 获取
 *   - 独立 RAF 循环直接操作 DOM transform，绕开 React 渲染
 *   - 悬停/挥手检测仅在状态变化时才 setState
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useFingerTracking } from '../hooks/useFingerTracking';
import CameraOverlay from '../components/CameraOverlay';

export default function FingerLight() {
  const [showModal, setShowModal] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const btnRef = useRef(null);
  const coreRef = useRef(null);
  const midRef = useRef(null);
  const haloRef = useRef(null);
  const lastHoverRef = useRef(false);
  const lastHandRef = useRef(false);

  /** 空中点击回调：校验指尖是否落在按钮范围内 */
  const handleAirClick = useCallback(() => {
    if (!btnRef.current) return;
    const pos = fingerPosRef.current;
    if (!pos) return;
    const rect = btnRef.current.getBoundingClientRect();
    const sx = pos.x * window.innerWidth;
    const sy = pos.y * window.innerHeight;
    if (sx >= rect.left && sx <= rect.right && sy >= rect.top && sy <= rect.bottom) {
      setShowModal(true);
    }
  }, []);

  const { videoRef, fingerPosRef, landmarks } = useFingerTracking({ onAirClick: handleAirClick });
  const [hasHand, setHasHand] = useState(false);

  /**
   * 光晕渲染 RAF 循环
   * 直接从 fingerPosRef 读取位置，通过 DOM API 设置 transform，避免 React 重渲染
   */
  useEffect(() => {
    let animId;

    function tick() {
      const pos = fingerPosRef.current;
      const show = pos !== null;

      if (show) {
        // 将归一化坐标 (0~1) 映射到屏幕像素
        const sx = pos.x * window.innerWidth;
        const sy = pos.y * window.innerHeight;
        // 同时应用位移和居中对齐 (-50%)
        const t = `${sx}px, ${sy}px) translate(-50%, -50%)`;
        if (coreRef.current) coreRef.current.style.transform = `translate(${t}`;
        if (midRef.current) midRef.current.style.transform = `translate(${t}`;
        if (haloRef.current) haloRef.current.style.transform = `translate(${t}`;

        // 检测指尖是否悬浮在按钮区域 → 更新悬停状态
        if (btnRef.current) {
          const r = btnRef.current.getBoundingClientRect();
          const over = sx >= r.left && sx <= r.right && sy >= r.top && sy <= r.bottom;
          if (over !== lastHoverRef.current) {
            lastHoverRef.current = over;
            setIsHovering(over);
          }
        }
      }

      // 仅在状态变化时更新 hasHand，避免频繁 setState
      if (show !== lastHandRef.current) { lastHandRef.current = show; setHasHand(show); }
      animId = requestAnimationFrame(tick);
    }

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="light-page">
      {/* 隐藏的视频源 */}
      <video ref={videoRef} autoPlay muted playsInline className="hidden-video" />

      {/* 三层光晕：外圈辉光 → 中间光晕 → 核心亮心 */}
      <div ref={haloRef} className="glow-halo" />
      <div ref={midRef} className="glow-mid" />
      <div ref={coreRef} className="glow-core" />

      {/* 页面中央按钮 */}
      <div className="air-btn-container">
        {hasHand &&<button ref={btnRef} className={`air-btn ${isHovering ? 'hover' : ''}`} onClick={() => setShowModal(true)}>
          点击我
        </button>}
      </div>

      {/* 成功弹窗 */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">✓</div>
            <div className="modal-text">操作成功！</div>
            <button className="modal-close" onClick={() => setShowModal(false)}>
              关闭
            </button>
          </div>
        </div>
      )}

      {/* 无手检测提示 */}
      {!hasHand && (
        <div className="light-hint">请将手放到摄像头前</div>
      )}

      <CameraOverlay videoRef={videoRef} landmarks={landmarks} />
    </div>
  );
}
