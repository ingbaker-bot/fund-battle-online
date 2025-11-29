import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// 引用頁面 (原本的單機功能) - 位於 src/pages/
import AppFull from './pages/AppFull.jsx';
import AppRanked from './pages/AppRanked.jsx';
import AppCompetition from './pages/AppCompetition.jsx';
import AppTrial from './pages/AppTrial.jsx';

// 引用新功能 (多人連線) 
// SpectatorView 位於 src/ (同層)
import SpectatorView from './SpectatorView';
// AppBattle 位於 src/pages/
import AppBattle from './pages/AppBattle';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 首頁：預設進入單機排名版 */}
        <Route path="/" element={<AppRanked />} />
        
        {/* 舊有單機頁面路由 */}
        <Route path="/full" element={<AppFull />} />
        <Route path="/ranked" element={<AppRanked />} />
        <Route path="/competition" element={<AppCompetition />} />
        <Route path="/trial" element={<AppTrial />} />

        {/* 新增：多人連線路由 */}
        <Route path="/spectator" element={<SpectatorView />} />
        <Route path="/battle" element={<AppBattle />} />

        {/* 防呆：找不到網址時回首頁 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}