// 창 여닫기 애니메이션. 창이 앱 아이콘(Dock, 모바일 홈 화면)에서 나오고 아이콘으로 돌아간다.
import type { AppName } from '@/apps/manifest';
import { prefersReducedMotion } from '@/shared/lib/media';

export interface Box {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * from 상자를 to 상자 자리로 옮기는 transform. 가운데끼리 맞추고, 폭 비율로 줄인다.
 * (transform-origin은 가운데여야 한다)
 */
export function flyTransform(from: Box, to: Box): string {
	const dx = to.x + to.width / 2 - (from.x + from.width / 2);
	const dy = to.y + to.height / 2 - (from.y + from.height / 2);
	const scale = Math.max(0.05, to.width / from.width);
	return `translate(${Math.round(dx)}px, ${Math.round(dy)}px) scale(${scale.toFixed(3)})`;
}

/** 앱을 여는 아이콘의 위치. 모바일은 홈 화면, 데스크톱은 Dock. 화면에 없으면(Launchpad 안 등) null */
function launcherBox(appName: AppName, mobile: boolean): Box | null {
	const selector = mobile ? `.mobile-home [data-launch="${appName}"] img` : `.dock [aria-label="${appName}"] img`;
	const icon = document.querySelector(selector);
	if (!icon) return null;
	const rect = icon.getBoundingClientRect();
	return rect.width > 0 ? rect : null;
}

interface Options {
	appName: AppName;
	mobile: boolean;
}

/** 아이콘에서 커지며 나타난다. 아이콘을 찾지 못하면 제자리에서 살짝 커진다. */
export function animateOpen(element: HTMLElement, { appName, mobile }: Options) {
	if (prefersReducedMotion()) return;
	const target = launcherBox(appName, mobile);
	const from = target ? flyTransform(element.getBoundingClientRect(), target) : 'scale(0.94)';
	element.animate(
		[
			{ transform: from, opacity: 0, borderRadius: mobile ? '48px' : undefined },
			{ opacity: 1, offset: 0.35 },
			{ transform: 'none', opacity: 1, borderRadius: mobile ? '0px' : undefined },
		],
		{ duration: mobile ? 420 : 340, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
	);
}

/**
 * 아이콘으로 줄어들며 사라진 뒤 onDone을 부른다.
 * toLauncher가 false면(데스크톱 닫기) 제자리에서 살짝 작아지며 사라진다.
 */
export function animateClose(
	element: HTMLElement,
	{ appName, mobile, toLauncher }: Options & { toLauncher: boolean },
	onDone: () => void
) {
	if (prefersReducedMotion()) return onDone();
	element.classList.add('closing');
	const target = toLauncher ? launcherBox(appName, mobile) : null;
	const to = target ? flyTransform(element.getBoundingClientRect(), target) : 'scale(0.94)';
	const animation = element.animate(
		[
			{ transform: 'none', opacity: 1, borderRadius: mobile ? '0px' : undefined },
			{ opacity: 1, offset: target ? 0.6 : 0 },
			{ transform: to, opacity: 0, borderRadius: mobile ? '48px' : undefined },
		],
		{ duration: target ? (mobile ? 360 : 420) : 180, easing: 'cubic-bezier(0.4, 0, 0.6, 1)', fill: 'forwards' }
	);
	animation.onfinish = onDone;
	animation.oncancel = onDone;
}
