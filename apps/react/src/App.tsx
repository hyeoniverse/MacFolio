import React, { useEffect, useState } from 'react';
import './App.css';
import Desktop from '@/desktop/Desktop';
import LoadingScreen from '@/desktop/loading/LoadingScreen';
import LoginFlow from '@/shared/auth/LoginFlow';
import { returnedFromLogin } from '@/shared/auth/adminStore';
import Tour from '@/desktop/tour/Tour';
import { startFirstVisitTour } from '@/desktop/tour/firstVisit';
import { linkedApp } from '@/shared/lib/appLink';

/**
 * 처음에 로딩 화면을 띄우는지. 건너뛰는 경우:
 * - GitHub 로그인에서 돌아왔다
 * - 글·프로젝트 주소(/memo/<글>, /safari/<프로젝트>)로 바로 들어왔다. 검색 결과나 공유 링크로 온 사람이 누르지 않아도 그 글을 바로
 *   읽고, 검색엔진도 스크립트를 실행한 화면에서 본문을 읽는다 (로딩 화면에서 멈추면 남는 글자가 시작 안내뿐이라 색인되지 않았다).
 *   시작음·배경 음악은 누른 동작이 있어야 재생할 수 있어 이때는 틀지 않고, 처음 온 사람의 둘러보기도 글을 가리지 않게 띄우지 않는다
 */
const isLoadingAtStart = () => !returnedFromLogin() && linkedApp() === null;

const App: React.FC = () => {
	// GitHub 로그인에서 돌아왔거나 글 주소로 들어왔으면 "클릭하여 시작" 로딩 화면을 건너뛰고 바로 보여 준다
	const [isLoading, setIsLoading] = useState(isLoadingAtStart);
	// 바탕화면(휴대폰은 홈 화면)은 로딩 화면을 눌러 시작한 뒤에 그린다. 그 전에는 로딩 화면이 덮고 있어 보이지 않는데,
	// 미리 그리면 앱 코드를 다 받아 실행하고 아이콘·위젯 그림까지 받느라 첫 방문의 휴대폰이 바빴다.
	// 누른 뒤 진행 막대가 차는 동안(2.5초) 그리므로 걷히면 바로 보인다
	const [shellStarted, setShellStarted] = useState(() => !isLoadingAtStart());

	// 스크립트를 받는 동안의 첫 그림(index.html의 #boot-splash)은 로딩 화면을 눌러 시작한 시각(로딩 화면이 없으면 처음)에 삭제한다.
	// 그 전에는 같은 자리에 렌더링한 로딩 화면(DOM 순서상 위)이 덮고 있다. React가 처음 렌더링하는 시각에 바로 삭제하면, 첫 렌더링이
	// 화면에 표시되어 LCP로 기록되기 전에 노드가 사라지는 회차가 있었다. 그러면 LCP가 React의 시작 안내로 다시 집계되어
	// Lighthouse 휴대폰 LCP가 3.3초에서 4.6초로 늘었다 (docs/performance.md). 누른 뒤에는 LCP를 더 기록하지 않는다
	useEffect(() => {
		if (shellStarted) document.getElementById('boot-splash')?.remove();
	}, [shellStarted]);

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
			{shellStarted && <Desktop />}
			{/* 로딩 중일 때만 LoadingScreen 오버레이 표시 */}
			{isLoading && <LoadingScreen onStart={() => setShellStarted(true)} onLoadingComplete={handleLoadingComplete} />}
			{/* 로그인하러 다녀올 때의 안내와 결과 */}
			{!isLoading && <LoginFlow />}
			<Tour />
		</div>
	);
};

export default App;
