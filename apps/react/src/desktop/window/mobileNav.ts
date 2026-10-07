import { createContext } from 'react';

/**
 * 앱이 바꾸는 휴대폰 뒤로 가기. 제목 막대는 없다: 뒤로 가기는 늘 동그란 단추로 내용 위에 떠 있고, 내용이 화면을 다 쓴다 (iOS).
 * 비운 항목은 기본값(홈으로)을 쓴다
 */
export interface MobileNav {
	/** 뒤로 가기 버튼 글자 (예: "받은 편지함", 화면 읽기 프로그램용). 누르면 onBack */
	backLabel?: string;
	onBack?: () => void;
	/**
	 * 단추 자리. 기본은 왼쪽 위(앱의 첫 줄 옆), bottom은 왼쪽 아래(홈 바 위).
	 * 웹 페이지를 통째로 띄우는 앱(프로젝트 데모, API 문서)은 페이지의 왼쪽 위 메뉴를 가리지 않게 아래에 둔다 (iOS Safari처럼)
	 */
	placement?: 'top' | 'bottom';
	/**
	 * 홈으로 가는 단추는 감춘다 (홈 바가 같은 일을 한다). 아래 막대가 있는 앱(Safari, 웹 페이지 앱)처럼 단추가 내용을 가리기만 할 때.
	 * 앱이 정한 뒤로 가기(onBack)는 그대로 보인다
	 */
	hideHome?: boolean;
	/**
	 * 화면만 보기 (사진만 보기처럼): 뒤로 가기와 상태 표시줄이 흐려지며 사라진다. 끄면 돌아온다.
	 * 앱의 다른 UI는 앱이 함께 숨긴다
	 */
	immersive?: boolean;
}

/** AppWindow(모바일)가 제공한다. 데스크톱에서는 null */
export const MobileNavContext = createContext<((nav: MobileNav | null) => void) | null>(null);
