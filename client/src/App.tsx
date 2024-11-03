import React, { useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import './App.css';
import DesktopPage from './pages/DesktopPage';
import LoadingPage from './pages/LoadingPage';

// Load the sound files
const mp3Url = process.env.REACT_APP_SFX_URL;
const mouseDownSound = new Audio(`${mp3Url}/mouse-down.mp3`);
const mouseUpSound = new Audio(`${mp3Url}/mouse-up.mp3`);

const App: React.FC = () => {
  const handleMouseDown = useCallback(() => {
    mouseDownSound.play();
  }, []);

  const handleMouseUp = useCallback(() => {
    mouseUpSound.play();
  }, []);

  useEffect(() => {
    // Add global event listeners
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);

    // Cleanup event listeners on component unmount
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseDown, handleMouseUp]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoadingPage />} />
        <Route path="/desktop" element={<DesktopPage />} />
      </Routes>
    </Router>
  );
};

export default App;