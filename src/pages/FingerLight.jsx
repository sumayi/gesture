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
  const showModalRef = useRef(false);
  const btnRef = useRef(null);
  const modalRef = useRef(null);
  const coreRef = useRef(null);
  const midRef = useRef(null);
  const haloRef = useRef(null);
  const lastHoverRef = useRef(false);
  const lastHandRef = useRef(false);

  // 同步 showModal 到 ref，供 RAF/回调读取
  const setShowModalWrap = (v) => { showModalRef.current = v; setShowModal(v); };

  /** 空中点击回调：
   *  弹窗关闭时 → 点击按钮开启弹窗
   *  弹窗开启时 → 点击遮罩区域关闭弹窗 */
  const handleAirClick = useCallback(() => {
    const pos = fingerPosRef.current;
    if (!pos) return;
    const sx = pos.x * window.innerWidth;
    const sy = pos.y * window.innerHeight;

    if (showModalRef.current) {
      // 弹窗已开启：点击遮罩 → 关闭
      if (!modalRef.current) return;
      const r = modalRef.current.getBoundingClientRect();
      if (sx >= r.left && sx <= r.right && sy >= r.top && sy <= r.bottom) {
        setShowModalWrap(false);
      }
    } else {
      // 弹窗关闭：点击按钮 → 开启
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      if (sx >= r.left && sx <= r.right && sy >= r.top && sy <= r.bottom) {
        setShowModalWrap(true);
      }
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

        // 检测指尖悬浮状态：弹窗开启时检测遮罩，关闭时检测按钮
        const target = showModalRef.current ? modalRef.current : btnRef.current;
        if (target) {
          const r = target.getBoundingClientRect();
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

      {/* 成功弹窗（无关闭按钮，通过指尖点击遮罩关闭） */}
      {showModal && (
        <div ref={modalRef} className="modal-overlay" onClick={() => setShowModalWrap(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">✓</div>
            <div className="modal-text">操作成功！</div>
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
