import { createContext } from 'react';

/** 앱이 바꾸는 모바일 제목 막대. 비운 항목은 기본값(홈 버튼, 앱 이름)을 쓴다 */
export interface MobileNav {
	/** 뒤로 가기 버튼 글자 (예: "받은 편지함"). 누르면 onBack */
	backLabel?: string;
	onBack?: () => void;
	/** 제목. 빈 문자열이면 제목을 숨긴다 (본문에 큰 제목이 있을 때) */
	title?: string;
}

/** AppWindow(모바일)가 제공한다. 데스크톱에서는 null */
export const MobileNavContext = createContext<((nav: MobileNav | null) => void) | null>(null);
