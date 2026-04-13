import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import MapContainer from './kakaomap/MapContainer';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div style={{ width: '100vw', height: '100vh' }}>
        <MapContainer title="재개발 구역 지도" />
      </div>
    </BrowserRouter>
  );
}

export default App;
