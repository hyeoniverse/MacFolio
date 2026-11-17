import { prefersReducedMotion } from '@/shared/lib/media';

/** 배경화면이 바뀔 때 옛 배경이 흐려지며 새 배경이 드러나는 시간 */
const FADE_MS = 600;
/** 새 그림을 이만큼 기다려도 못 받으면 그냥 흐려지게 한다 (느린 회선에서 옛 배경에 멈춰 있지 않게) */
const LOAD_TIMEOUT_MS = 4000;

/** CSS 배경 값 url('...')에서 주소만 꺼낸다 */
export function cssUrl(value: string): string | null {
	return value.match(/url\(["']?([^"')]+)["']?\)/)?.[1] ?? null;
}

/** 그림을 받아 디코딩까지 끝나면(실패하거나 오래 걸려도) 풀리는 약속 */
function whenDecoded(url: string | null): Promise<void> {
	if (!url) return Promise.resolve();
	const image = new Image();
	image.src = url;
	const decoded = image.decode().catch(() => {});
	const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, LOAD_TIMEOUT_MS));
	return Promise.race([decoded, timeout]);
}

type Wallpapers = { desktop: string; mobile: string };

/**
 * 배경화면을 바꾸기 직전에 부른다: 옛 배경을 덮개로 한 장 얹고, 새 그림을 다 받아 디코딩한 뒤에 흐려지게 한다.
 * 새 그림이 아직 없을 때 덮개가 먼저 사라지면 빈 바탕이 잠깐 보이기 때문이다 (서버에 올린 배경화면, 화면 모드 전환).
 * 데스크톱은 문서(body) 위·창 아래에, 휴대폰은 홈 화면 배경 위·아이콘 아래에 얹는다 (z-index -1)
 */
export function fadeOutWallpaper(old: Wallpapers, next: Wallpapers) {
	if (prefersReducedMotion()) return;
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
		});
		return element;
	};
	const layers: HTMLElement[] = [];
	if (old.desktop && old.desktop !== next.desktop) {
		const element = layer(old.desktop, 'fixed');
		document.body.append(element);
		layers.push(element);
	}
	const home = document.querySelector('.mobile-home');
	if (home && old.mobile && old.mobile !== next.mobile) {
		const element = layer(old.mobile, 'absolute');
		home.prepend(element);
		layers.push(element);
	}
	if (!layers.length) return;
	const urls = [old.desktop !== next.desktop ? next.desktop : '', old.mobile !== next.mobile ? next.mobile : ''];
	void Promise.all(urls.map((value) => whenDecoded(cssUrl(value)))).then(() => {
		for (const element of layers) {
			const remove = () => element.remove();
			element.addEventListener('animationend', remove, { once: true });
			window.setTimeout(remove, FADE_MS + 200);
			element.style.animation = `fade-out ${FADE_MS}ms var(--ease-out) forwards`;
		}
	});
}
