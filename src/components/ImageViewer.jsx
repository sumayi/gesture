/**
 * ImageViewer — 轮播图片查看器
 *
 * 功能：
 *   1. 横向轮播容器，translateX 滑动切换动画
 *   2. 支持缩放 (transform: scale) 和鼠标拖拽平移
 *   3. 底部缩略图条带，可点击跳转
 *   4. 左上角显示页码和缩放比例
 *
 * Props:
 *   currentIndex  - 当前图片索引 (0-based)
 *   zoom          - 缩放倍数 (1x ~ 5x)
 *   images        - 图片文件名数组
 *   onSelectIndex - 缩略图点击回调
 */

import { useState, useRef, useEffect } from 'react';

export default function ImageViewer({ currentIndex, zoom, images, onSelectIndex }) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // 切换图片时重置平移偏移
  useEffect(() => {
    setPan({ x: 0, y: 0 });
  }, [currentIndex]);

  /** 鼠标拖拽平移（仅 zoom > 1 时启用） */
  const handleMouseDown = (e) => {
    if (zoom <= 1) return;
    isPanning.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    setPan(p => ({ x: p.x + dx, y: p.y + dy }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const stopPan = () => { isPanning.current = false; };

  return (
    <div
      className="image-viewer"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={stopPan}
      onMouseLeave={stopPan}
    >
      {/* 轮播视口：overflow hidden，只显示当前图片 */}
      <div className="slide-viewport">
        <div
          className="slide-track"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {images.map((src, i) => (
            <div key={i} className="slide-item">
              <img
                src={`/img/${src}`}
                alt={`图片 ${i + 1}`}
                draggable={false}
                style={{
                  transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 左上角信息：页码 / 总数 · 缩放百分比 */}
      <div className="image-info">
        {currentIndex + 1}/{images.length} · {Math.round(zoom * 100)}%
      </div>

      {/* 底部缩略图条带 */}
      <div className="thumbnail-strip">
        {images.map((src, i) => (
          <div
            key={i}
            className={`thumbnail-item ${i === currentIndex ? 'active' : ''}`}
            onClick={() => onSelectIndex?.(i)}
          >
            <img src={`/img/${src}`} alt={`缩略 ${i + 1}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
