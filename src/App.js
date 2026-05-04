import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import ScrollToTop from './components/ScrollToTop';
import MapContainer from './kakaomap/MapContainer';
import CommunityList from './pages/CommunityList';
import PostDetail from './pages/PostDetail';
import PostWrite from './pages/PostWrite';
import MyPage from './pages/MyPage';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AccountSetup from './pages/AccountSetup';
import AccountSettings from './pages/AccountSettings';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Header />
      <Routes>
        <Route path="/" element={<MapContainer title="재개발 구역 지도" height="calc(100vh - 57px)" />} />
        <Route path="/community" element={<CommunityList />} />
        <Route path="/community/:zoneId" element={<CommunityList />} />
        <Route path="/community/:zoneId/write" element={<PostWrite />} />
        <Route path="/post/:postId" element={<PostDetail />} />
        <Route path="/mypage" element={<MyPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/account-setup" element={<AccountSetup />} />
        <Route path="/account-settings" element={<AccountSettings />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
