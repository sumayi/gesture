/**
 * ImageGallery — 图片浏览页面（路由: /）
 *
 * 功能：
 *   1. 手势控制图片翻页（比耶朝左/朝右）
 *   2. 拇指-食指捏合连续缩放
 *   3. 右下角摄像头画中画预览
 *
 * 手势映射：
 *   比耶朝右 → 下一张
 *   比耶朝左 → 上一张
 *   捏合比例 → 连续缩放 1x ~ 5x
 */

import { useState, useEffect, useCallback } from 'react';
import { useHandLandmarker } from '../hooks/useHandLandmarker';
import ImageViewer from '../components/ImageViewer';
import CameraOverlay from '../components/CameraOverlay';

// public/img/ 下的图片文件列表
const IMAGES = [
  '20260428-182932.jpg',
  '20260428-182936.jpg',
  '20260428-182940.jpg',
];

// 捏合比例映射区间：0.15（捏紧）→ 0.8（张开）
const MIN_R = 0.15;
const MAX_R = 0.8;

export default function ImageGallery() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);

  /** 手势回调：比耶翻页 */
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

  /** 捏合比例 → 缩放值映射（线性插值） */
  useEffect(() => {
    if (pinchRatio === null) return;
    const t = Math.max(0, Math.min(1, (pinchRatio - MIN_R) / (MAX_R - MIN_R)));
    setZoom(1 + t * 4);
  }, [pinchRatio]);

  return (
    <div className="app">
      {/* 隐藏的 video 标签，仅作为 MediaPipe 的输入源 */}
      <video ref={videoRef} autoPlay muted playsInline className="hidden-video" />
      <ImageViewer currentIndex={currentIndex} zoom={zoom} images={IMAGES} onSelectIndex={setCurrentIndex} />
      <CameraOverlay videoRef={videoRef} landmarks={landmarks} gestureName={gestureName} />
    </div>
  );
}
