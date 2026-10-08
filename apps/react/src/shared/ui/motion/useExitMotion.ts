import { useCallback, useRef } from 'react';

/** 사라지는 움직임 이름 (motion.css의 키프레임) */
export type ExitMotion = 'pop-out' | 'fade-out' | 'sink-out' | 'slide-out-right';

const DURATION: Record<ExitMotion, number> = {
	'pop-out': 140,
	'fade-out': 160,
	'sink-out': 200,
	'slide-out-right': 240,
};

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** 지워지기 직전의 요소를 같은 자리에 복사해 두고, 사라지는 움직임이 끝나면 지운다 */
export function playExit(element: HTMLElement, motion: ExitMotion) {
	if (!element.isConnected || !element.parentNode || reducedMotion()) return;
	const ghost = element.cloneNode(true) as HTMLElement;
	ghost.setAttribute('aria-hidden', 'true');
	ghost.setAttribute('data-exiting', motion);
	ghost.inert = true;
	// 복사본은 역할·이름이 없다 (화면 읽기 프로그램과 시험이 닫힌 뒤를 본다)
	for (const node of [ghost, ...ghost.querySelectorAll('*')]) {
		node.removeAttribute('role');
		node.removeAttribute('id');
		node.removeAttribute('aria-label');
	}
	ghost.style.pointerEvents = 'none';
	ghost.style.animation = `${motion} ${DURATION[motion]}ms var(--ease-in) forwards`;
	element.parentNode.insertBefore(ghost, element.nextSibling);
	const remove = () => ghost.remove();
	ghost.addEventListener('animationend', remove, { once: true });
	// 애니메이션이 돌지 않아도(숨은 탭 등) 남지 않게
	window.setTimeout(remove, DURATION[motion] + 100);
}

/**
 * 요소가 화면에서 빠질 때(부모가 그리지 않거나 컴포넌트가 null을 돌려줄 때) 사라지는 움직임을 보여 준다.
 * 돌려주는 ref를 요소에 걸면, React가 요소를 떼어 내기 직전(ref 정리)에 겉모습만 복사해 같은 자리에 두고 움직임이 끝나면 지운다.
 * 그래서 여는 쪽은 `{open && <Menu />}`처럼 그대로 두고, 닫기도 바로 끝난다 (상태·포커스·시험은 닫힌 뒤를 본다).
 */
export function useExitMotion<T extends HTMLElement>(motion: ExitMotion = 'pop-out') {
	return useCallback(
		(element: T | null) => {
			if (!element) return;
			return () => playExit(element, motion);
		},
		[motion]
	);
}

/** useExitMotion에 요소를 읽을 ref도 함께: [읽을 ref, 요소에 걸 ref] (바깥 누르기·자리 재기에 요소가 필요할 때) */
export function useExitMotionRef<T extends HTMLElement>(motion: ExitMotion = 'pop-out') {
	const ref = useRef<T | null>(null);
	const attach = useCallback(
		(element: T | null) => {
			ref.current = element;
			if (!element) return;
			return () => {
				ref.current = null;
				playExit(element, motion);
			};
		},
		[motion]
	);
	return [ref, attach] as const;
}
