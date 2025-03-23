import React, { useState } from 'react';
import './App.css';
import DesktopPage from './pages/DesktopPage';
import LoadingPage from './pages/LoadingPage';

const App: React.FC = () => {
	const [isLoading, setIsLoading] = useState(true);

	// 로딩이 완료되면 LoadingPage를 제거하기 위한 콜백 함수
	const handleLoadingComplete = () => {
		setIsLoading(false);
	};

	return (
		<div className="App">
			{/* DesktopPage는 항상 렌더링 */}
			<DesktopPage />
			{/* 로딩 중일 때만 LoadingPage 오버레이 표시 */}
			{isLoading && <LoadingPage onLoadingComplete={handleLoadingComplete} />}
		</div>
	);
};

export default App;
