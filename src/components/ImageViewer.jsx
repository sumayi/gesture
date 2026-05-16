import { useState, useRef } from 'react';

export default function ImageViewer({ currentIndex, zoom, images }) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

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
      <img
        src={`/img/${images[currentIndex]}`}
        alt={`图片 ${currentIndex + 1}`}
        style={{
          transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
        }}
      />
      <div className="image-info">
        {currentIndex + 1}/{images.length} · {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}
