/** 배경화면이 바뀔 때 옛 배경이 흐려지며 새 배경이 드러나는 시간 */
const FADE_MS = 600;

/**
 * 배경화면을 바꾸기 직전에 부른다: 옛 배경을 덮개로 한 장 얹고 흐려지게 한다.
 * 데스크톱은 문서 배경(body) 위·창 아래에, 휴대폰은 홈 화면 배경 위·아이콘 아래에 얹는다 (z-index -1)
 */
export function fadeOutWallpaper(old: { desktop: string; mobile: string }) {
	if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
	const layer = (background: string, position: 'fixed' | 'absolute') => {
		const element = document.createElement('div');
		element.className = 'wallpaper-fade';
		element.setAttribute('aria-hidden', 'true');
		Object.assign(element.style, {
			position,
			inset: '0',
			zIndex: '-1',
			pointerEvents: 'none',
			background: `${background} center / cover no-repeat`,
			animation: `fade-out ${FADE_MS}ms var(--ease-out) forwards`,
		});
		const remove = () => element.remove();
		element.addEventListener('animationend', remove, { once: true });
		window.setTimeout(remove, FADE_MS + 200);
		return element;
	};
	if (old.desktop) document.body.append(layer(old.desktop, 'fixed'));
	const home = document.querySelector('.mobile-home');
	if (home && old.mobile) home.prepend(layer(old.mobile, 'absolute'));
}
