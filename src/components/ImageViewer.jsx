import { useState, useRef, useEffect } from 'react';

export default function ImageViewer({ currentIndex, zoom, images, onSelectIndex }) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setPan({ x: 0, y: 0 });
  }, [currentIndex]);

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

      <div className="image-info">
        {currentIndex + 1}/{images.length} · {Math.round(zoom * 100)}%
      </div>

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
