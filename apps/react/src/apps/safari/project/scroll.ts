// 프로젝트 페이지가 함께 쓰는 스크롤 도우미: Safari 창 안에서는 창이 아니라 탭 패널이 스크롤된다

/** 가장 가까운 스크롤 상자 (없으면 null, 그때는 창) */
export function scrollParent(node: HTMLElement): HTMLElement | null {
	for (let el = node.parentElement; el; el = el.parentElement) {
		const { overflowY } = getComputedStyle(el);
		if (overflowY === 'auto' || overflowY === 'scroll') return el;
	}
	return null;
}

/** 스크롤 상자가 화면에서 차지하는 위아래 (창이면 창 전체) */
export function viewOf(scroller: HTMLElement | null): { top: number; height: number } {
	if (!scroller) return { top: 0, height: window.innerHeight };
	const box = scroller.getBoundingClientRect();
	return { top: box.top, height: box.height };
}

/**
 * 스크롤하거나 크기(창, 스크롤 상자)가 바뀔 때마다(한 프레임에 한 번) update를 부른다. 처음에도 한 번 부른다.
 * 정리 함수를 돌려준다
 */
export function onScrollFrame(node: HTMLElement, update: (scroller: HTMLElement | null) => void): () => void {
	const scroller = scrollParent(node);
	const source = scroller ?? window;
	let frame = 0;
	const run = () => {
		frame = 0;
		update(scroller);
	};
	const schedule = () => {
		if (!frame) frame = requestAnimationFrame(run);
	};
	run();
	source.addEventListener('scroll', schedule, { passive: true });
	window.addEventListener('resize', schedule);
	// Safari 창을 끌어 크기를 바꾸면 창(window)은 그대로라 resize가 오지 않는다. 스크롤 상자의 크기를 직접 지켜본다
	const resized = typeof ResizeObserver === 'undefined' || !scroller ? null : new ResizeObserver(schedule);
	resized?.observe(scroller!);
	return () => {
		source.removeEventListener('scroll', schedule);
		window.removeEventListener('resize', schedule);
		resized?.disconnect();
		cancelAnimationFrame(frame);
	};
}
