import React, { useState } from 'react';
import './App.css';
import Desktop from '@/desktop/Desktop';
import LoadingScreen from '@/desktop/loading/LoadingScreen';

const App: React.FC = () => {
	const [isLoading, setIsLoading] = useState(true);

	// 로딩이 완료되면 LoadingScreen을 제거하기 위한 콜백 함수
	const handleLoadingComplete = () => {
		setIsLoading(false);
	};

	return (
		<div className="App">
			{/* Desktop은 항상 렌더링 */}
			<Desktop />
			{/* 로딩 중일 때만 LoadingScreen 오버레이 표시 */}
			{isLoading && <LoadingScreen onLoadingComplete={handleLoadingComplete} />}
		</div>
	);
};

export default App;
