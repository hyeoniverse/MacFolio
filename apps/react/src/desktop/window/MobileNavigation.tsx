import { useContext, useEffect, useRef } from 'react';
import { MobileNavContext, type MobileNav } from '@/desktop/window/mobileNav';

/**
 * 모바일에서 이 화면의 뒤로 가기 버튼과 제목을 제목 막대에 건다. AppWindow 안에 그려야 한다.
 * iOS처럼 뒤로 가기 버튼은 화면마다 하나만 있다: 앱의 첫 화면은 "홈", 한 단계 들어가면 앱이 정한 버튼.
 * 데스크톱에서는 아무 일도 하지 않는다.
 */
function MobileNavigation({ backLabel, onBack, title }: MobileNav) {
	const setNav = useContext(MobileNavContext);
	// onBack은 렌더링마다 새로 만들어지므로 ref로 최신 값을 부른다 (의존성에 넣으면 무한히 다시 건다)
	const handler = useRef(onBack);

	useEffect(() => {
		handler.current = onBack;
	});

	useEffect(() => {
		if (!setNav) return;
		setNav({ backLabel, title, onBack: backLabel === undefined ? undefined : () => handler.current?.() });
		return () => setNav(null);
	}, [setNav, backLabel, title]);

	return null;
}

export default MobileNavigation;
