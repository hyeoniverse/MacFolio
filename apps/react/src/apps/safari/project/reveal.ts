// 프로젝트 페이지가 함께 쓰는 스크롤 연출: 화면에 들어오면 나타나고 벗어나면 사라진다
import { useEffect, useRef, useState } from 'react';
import { scrollParent } from '@/apps/safari/project/scroll';
import { prefersReducedMotion } from '@/shared/lib/media';

/** 프로젝트 페이지의 연출 코드가 함께 쓴다 (shared/lib/media.ts) */
export { prefersReducedMotion };

/**
 * 돌려준 ref를 단 요소 안의 [data-reveal] 요소(나중에 생긴 것도)가 화면(스크롤 상자)에 들어오면 data-shown을 붙이고, 벗어나면 뗀다.
 * 나타나는 모양은 CSS(ProjectPage.css)가 data-reveal 값(up·ink·drop·left)에 따라 정한다
 */
export function useReveal<T extends HTMLElement>() {
	const ref = useRef<T>(null);
	useEffect(() => {
		const root = ref.current;
		if (!root || typeof IntersectionObserver === 'undefined') return;
		const observer = new IntersectionObserver(
			(entries) => {
				// 나타날 때는 12% 넘게 보일 때, 사라질 때는 다 벗어났을 때. 숨은 요소는 조금 내려가 있어서
				// 같은 기준을 쓰면 경계에서 나타났다 사라졌다를 되풀이하며 떤다
				for (const entry of entries) {
					if (entry.intersectionRatio >= 0.12) entry.target.setAttribute('data-shown', '');
					else if (!entry.isIntersecting) entry.target.removeAttribute('data-shown');
				}
			},
			{ root: scrollParent(root), threshold: [0, 0.12] }
		);
		const watch = (scope: ParentNode) =>
			scope.querySelectorAll('[data-reveal]').forEach((node) => observer.observe(node));
		watch(root);
		// 나중에 생긴 요소(옮긴 카드처럼 다시 그려진 것)도 지켜본다
		const added = new MutationObserver((records) => {
			for (const record of records)
				for (const node of record.addedNodes) {
					if (!(node instanceof Element)) continue;
					if (node.hasAttribute('data-reveal')) observer.observe(node);
					watch(node);
				}
		});
		added.observe(root, { childList: true, subtree: true });
		return () => {
			observer.disconnect();
			added.disconnect();
		};
	}, []);
	return ref;
}

/** "20마리", "오전 8시", "TOP 10"처럼 숫자가 하나 든 글을 앞말·숫자·뒷말로 나눈다 (숫자가 없거나 여럿이면 null) */
export function splitNumber(text: string): { before: string; value: number; after: string } | null {
	const match = /^(\D*?)(\d+)(\D*)$/.exec(text);
	return match ? { before: match[1], value: Number(match[2]), after: match[3] } : null;
}

/** 화면에 들어오면 0부터 목표 숫자까지 세어 올라가고, 벗어나면 0으로 돌아간다 */
export function useCountUp(target: number, duration = 900) {
	const ref = useRef<HTMLElement>(null);
	const [value, setValue] = useState(target);
	useEffect(() => {
		const node = ref.current;
		if (!node || typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) return;
		let frame = 0;
		setValue(0);
		const observer = new IntersectionObserver(
			([entry]) => {
				cancelAnimationFrame(frame);
				if (!entry.isIntersecting) {
					setValue(0);
					return;
				}
				const start = performance.now();
				frame = requestAnimationFrame(function tick(now) {
					const t = Math.min(1, (now - start) / duration);
					setValue(Math.round(target * (1 - (1 - t) ** 3)));
					if (t < 1) frame = requestAnimationFrame(tick);
				});
			},
			{ root: scrollParent(node), threshold: 0.6 }
		);
		observer.observe(node);
		return () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
		};
	}, [target, duration]);
	return { ref, value };
}
