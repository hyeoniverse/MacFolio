import React, { useEffect, useState } from 'react';
import './App.css';
import Desktop from '@/desktop/Desktop';
import LoadingScreen from '@/desktop/loading/LoadingScreen';
import LoginFlow from '@/shared/auth/LoginFlow';
import { returnedFromLogin } from '@/shared/auth/adminStore';
import Tour from '@/desktop/tour/Tour';
import { startFirstVisitTour } from '@/desktop/tour/firstVisit';

const App: React.FC = () => {
	// GitHub 로그인에서 돌아왔으면 "클릭하여 시작" 로딩 화면을 건너뛰고 바로 결과를 보여 준다
	const [isLoading, setIsLoading] = useState(() => !returnedFromLogin());

	// 처음 그렸으면 스크립트를 받는 동안의 첫 그림(index.html의 #boot-splash)을 지운다. 로딩 화면이 같은 자리에 그대로 이어진다
	useEffect(() => {
		document.getElementById('boot-splash')?.remove();
	}, []);

	// 로딩 화면이 없으면 로딩 화면 대신 배경화면을 드러낸다 (index.html의 booting)
	useEffect(() => {
		if (!isLoading) document.documentElement.classList.remove('booting');
	}, [isLoading]);

	// 로딩이 완료되면 LoadingScreen을 제거하기 위한 콜백 함수
	const handleLoadingComplete = () => {
		setIsLoading(false);
		// 처음 온 사람에게는 둘러보기를 띄운다 (한 번 보거나 건너뛰면 다시 띄우지 않는다)
		startFirstVisitTour();
	};

	return (
		<div className="App">
			{/* Desktop은 항상 렌더링 */}
			<Desktop />
			{/* 로딩 중일 때만 LoadingScreen 오버레이 표시 */}
			{isLoading && <LoadingScreen onLoadingComplete={handleLoadingComplete} />}
			{/* 로그인하러 다녀올 때의 안내와 결과 */}
			{!isLoading && <LoginFlow />}
			<Tour />
		</div>
	);
};

export default App;
