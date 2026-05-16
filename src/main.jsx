/**
 * 应用入口
 * 渲染根组件到 DOM，引入全局样式
 */
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
