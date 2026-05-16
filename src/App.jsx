import { useState, useEffect, useCallback } from 'react';
import { useHandLandmarker } from './hooks/useHandLandmarker';
import ImageViewer from './components/ImageViewer';
import CameraOverlay from './components/CameraOverlay';

const IMAGES = [
  '20260428-182932.jpg',
  '20260428-182936.jpg',
  '20260428-182940.jpg',
];

const MIN_R = 0.15;
const MAX_R = 0.8;

function App() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);

  const handleGesture = useCallback((gesture) => {
    if (gesture.name === '比耶') {
      if (gesture.direction === 'right') {
        setCurrentIndex(i => Math.min(i + 1, IMAGES.length - 1));
      } else {
        setCurrentIndex(i => Math.max(i - 1, 0));
      }
    }
  }, []);

  const { videoRef, landmarks, gestureName, pinchRatio } = useHandLandmarker({ onGesture: handleGesture });

  useEffect(() => {
    if (pinchRatio === null) return;
    const t = Math.max(0, Math.min(1, (pinchRatio - MIN_R) / (MAX_R - MIN_R)));
    setZoom(1 + t * 4);
  }, [pinchRatio]);

  return (
    <div className="app">
      <video ref={videoRef} autoPlay muted playsInline className="hidden-video" />
      <ImageViewer currentIndex={currentIndex} zoom={zoom} images={IMAGES} onSelectIndex={setCurrentIndex} />
      <CameraOverlay videoRef={videoRef} landmarks={landmarks} gestureName={gestureName} />
    </div>
  );
}

export default App;
