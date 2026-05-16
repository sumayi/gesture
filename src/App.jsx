/**
 * 应用根组件 — 路由配置
 *
 * 路由表：
 *   /         → ImageGallery  图片浏览 + 手势控制
 *   /light    → FingerLight   指尖追踪 + 光晕效果
 */
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import ImageGallery from './pages/ImageGallery';
import FingerLight from './pages/FingerLight';

/** 顶部导航栏，用于切换功能页面 */
function Nav() {
  return (
    <nav className="page-nav">
      <Link to="/">图片浏览</Link>
      <Link to="/light">指尖光晕</Link>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<ImageGallery />} />
        <Route path="/light" element={<FingerLight />} />
      </Routes>
    </BrowserRouter>
  );
}
