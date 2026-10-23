import { useEffect, useState } from 'react';

/** 다시 확인하는 간격: 화면이 바뀌어 스크롤하던 칸이 사라진 경우 (스크롤 이벤트가 없다) */
const RECHECK_MS = 800;

/**
 * 맨 앞 앱의 내용이 스크롤되어 상태 표시줄 밑으로 들어갔는가. 그때 상태 표시줄 뒤를 흐린다 (iOS의 스크롤 가장자리 효과).
 * 앱 안에서 마지막으로 세로 스크롤한 칸이 아직 화면에 있고 맨 위가 아니면 true.
 * 가로로만 스크롤되는 칸(사진 모음의 카드 줄 등)은 보지 않는다
 */
export function useAppScrolled(app: string | null): boolean {
	const [scrolledApp, setScrolledApp] = useState<string | null>(null);
	useEffect(() => {
		if (!app) return;
		const frameOf = () => document.querySelector(`.container.mobile[data-app="${app}"]`);
		let last: HTMLElement | null = null;
		const check = () => {
			const on =
				!!last &&
				last.isConnected &&
				!!frameOf()?.contains(last) &&
				last.scrollTop > 0 &&
				last.getClientRects().length > 0;
			setScrolledApp(on ? app : null);
		};
		const onScroll = (event: Event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement) || !frameOf()?.contains(target)) return;
			if (target.scrollHeight <= target.clientHeight) return;
			last = target;
			check();
		};
		document.addEventListener('scroll', onScroll, { capture: true, passive: true });
		const timer = setInterval(check, RECHECK_MS);
		return () => {
			document.removeEventListener('scroll', onScroll, { capture: true });
			clearInterval(timer);
		};
	}, [app]);
	return app !== null && scrolledApp === app;
}
