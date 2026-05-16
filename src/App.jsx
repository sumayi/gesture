import { useState, useCallback } from 'react';
import { useHandLandmarker } from './hooks/useHandLandmarker';
import ImageViewer from './components/ImageViewer';
import CameraOverlay from './components/CameraOverlay';

const IMAGES = [
  '20260428-182932.jpg',
  '20260428-182936.jpg',
  '20260428-182940.jpg',
];

function App() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);

  const handleGesture = useCallback((gesture) => {
    switch (gesture.name) {
      case '比耶':
        if (gesture.direction === 'right') {
          setCurrentIndex(i => Math.min(i + 1, IMAGES.length - 1));
        } else {
          setCurrentIndex(i => Math.max(i - 1, 0));
        }
        break;
      case '张开手':
        setZoom(z => Math.min(z + 0.5, 5));
        break;
      case '握拳':
        setZoom(z => Math.max(z - 0.5, 1));
        break;
    }
  }, []);

  const { videoRef, landmarks, gestureName } = useHandLandmarker({ onGesture: handleGesture });

  return (
    <div className="app">
      <video ref={videoRef} autoPlay muted playsInline className="hidden-video" />
      <ImageViewer currentIndex={currentIndex} zoom={zoom} images={IMAGES} />
      <CameraOverlay videoRef={videoRef} landmarks={landmarks} gestureName={gestureName} />
    </div>
  );
}

export default App;
