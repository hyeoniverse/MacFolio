import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { occurrences, pdfjs } from './pdf';

/** 쪽 사이 여백과 바깥 여백 (px, 기본값). 휴대폰은 좁게 쓴다 */
const GAP = 16;
const PADDING = 24;

/** 쪽이 원래 돌아가 있는 각도에 보는 사람이 돌린 각도를 더한다 */
const rotated = (page: { rotate: number }, rotation: number) => (page.rotate + rotation) % 360;

export interface PdfViewHandle {
	/** n쪽(1부터)으로 간다 */
	goToPage: (page: number) => void;
}

interface Props {
	doc: PDFDocumentProxy;
	/** null이면 창 폭에 맞춘다 */
	zoom: number | null;
	/** 실제로 그리는 배율 (폭 맞춤일 때 계산한 값) */
	onScale: (scale: number) => void;
	/** 지금 보고 있는 쪽 */
	onPage: (page: number) => void;
	query: string;
	/** 쪽마다 찾은 개수 (countMatches) */
	matchCounts: number[];
	/** 고른 찾기 결과 (전체에서 몇 번째, 0부터). 없으면 -1 */
	activeMatch: number;
	label: string;
	/** 보는 사람이 돌린 각도 (0·90·180·270) */
	rotation?: number;
	/** 바깥 여백 (px). 쪽 사이는 그 2/3 */
	padding?: number;
	ref?: React.Ref<PdfViewHandle>;
}

/**
 * PDF 본문: 회색 바탕에 쪽이 그림자와 함께 세로로 이어진다. 화면 가까이 온 쪽만 그린다.
 * 쪽마다 캔버스(그림)와 글자 층(고르기·복사·찾기 칠하기)을 겹친다
 */
const PdfView: React.FC<Props> = ({
	doc,
	zoom,
	onScale,
	onPage,
	query,
	matchCounts,
	activeMatch,
	label,
	rotation = 0,
	padding = PADDING,
	ref,
}) => {
	const gap = Math.round((padding * 2) / 3) || GAP;
	const scroller = useRef<HTMLDivElement>(null);
	const [sizes, setSizes] = useState<{ width: number; height: number }[]>([]);
	const [width, setWidth] = useState(0);

	// 쪽 크기(배율 1)를 먼저 모두 알아야 자리를 잡고 스크롤할 수 있다
	useEffect(() => {
		let alive = true;
		Promise.all(
			Array.from({ length: doc.numPages }, (_, i) =>
				doc.getPage(i + 1).then((page) => {
					const { width, height } = page.getViewport({ scale: 1, rotation: rotated(page, rotation) });
					return { width, height };
				})
			)
		).then((all) => alive && setSizes(all));
		return () => {
			alive = false;
		};
	}, [doc, rotation]);

	useEffect(() => {
		const box = scroller.current;
		if (!box) return;
		const observer = new ResizeObserver(() => setWidth(box.clientWidth));
		observer.observe(box);
		return () => observer.disconnect();
	}, []);

	const widest = Math.max(1, ...sizes.map((size) => size.width));
	const fitScale = width > 0 ? Math.max(0.1, (width - padding * 2) / widest) : 1;
	const scale = zoom ?? fitScale;
	useEffect(() => onScale(scale), [scale, onScale]);

	const pageAt = (n: number) => scroller.current?.querySelector<HTMLElement>(`[data-page="${n}"]`);
	useImperativeHandle(ref, () => ({
		goToPage: (n) => {
			const box = scroller.current;
			const page = pageAt(n);
			if (box && page) box.scrollTo({ top: page.offsetTop - padding });
		},
	}));

	// 지금 쪽: 창 위쪽 1/3 선에 걸린 쪽
	const onScroll = () => {
		const box = scroller.current;
		if (!box) return;
		const line = box.scrollTop + box.clientHeight / 3;
		let current = 1;
		for (const page of box.querySelectorAll<HTMLElement>('[data-page]')) {
			if (page.offsetTop <= line) current = Number(page.dataset.page);
		}
		onPage(current);
	};

	// 고른 찾기 결과가 몇 쪽의 몇 번째인지
	let active = { page: -1, local: -1 };
	for (let i = 0, seen = 0; i < matchCounts.length; i++) {
		if (activeMatch >= seen && activeMatch < seen + matchCounts[i]) {
			active = { page: i + 1, local: activeMatch - seen };
			break;
		}
		seen += matchCounts[i];
	}

	// 고른 결과가 다른 쪽이면 그 쪽으로 먼저 간다 (쪽이 그려지면 글자 층이 결과를 가운데로 데려온다)
	useEffect(() => {
		if (active.page < 1) return;
		const box = scroller.current;
		const page = pageAt(active.page);
		if (!box || !page) return;
		const top = page.offsetTop;
		if (top > box.scrollTop + box.clientHeight || top + page.offsetHeight < box.scrollTop) {
			box.scrollTo({ top: top - padding });
		}
	}, [active.page, activeMatch, padding]);

	return (
		<div
			ref={scroller}
			className="preview-pdf"
			role="document"
			aria-label={label}
			tabIndex={0}
			onScroll={onScroll}
			style={{ '--preview-gap': `${gap}px`, '--preview-padding': `${padding}px` } as React.CSSProperties}
		>
			{sizes.map((size, i) => (
				<PdfPage
					key={i}
					doc={doc}
					number={i + 1}
					width={size.width * scale}
					height={size.height * scale}
					scale={scale}
					rotation={rotation}
					query={query}
					activeLocal={active.page === i + 1 ? active.local : -1}
				/>
			))}
		</div>
	);
};

/** 글자 조각 안의 찾은 말을 <mark>로 감싼다. 쪽 안에서 activeLocal번째는 진하게 칠하고 그 mark를 돌려준다 */
function highlight(pieces: { div: HTMLElement; text: string }[], query: string, activeLocal: number) {
	let index = 0;
	let current: HTMLElement | null = null;
	for (const { div, text } of pieces) {
		const found = occurrences(text, query);
		if (found.length === 0) {
			if (div.childElementCount > 0) div.textContent = text;
			continue;
		}
		const parts: Node[] = [];
		let at = 0;
		for (const start of found) {
			parts.push(document.createTextNode(text.slice(at, start)));
			const mark = document.createElement('mark');
			mark.className = 'preview-hit';
			if (index === activeLocal) {
				mark.classList.add('current');
				current = mark;
			}
			mark.textContent = text.slice(start, start + query.length);
			parts.push(mark);
			at = start + query.length;
			index++;
		}
		parts.push(document.createTextNode(text.slice(at)));
		div.replaceChildren(...parts);
	}
	return current;
}

/** 화면에서 이만큼 떨어진 쪽까지 미리 그린다 */
const NEAR = '800px 0px';

const PdfPage: React.FC<{
	doc: PDFDocumentProxy;
	number: number;
	width: number;
	height: number;
	scale: number;
	rotation: number;
	query: string;
	activeLocal: number;
}> = ({ doc, number, width, height, scale, rotation, query, activeLocal }) => {
	const box = useRef<HTMLDivElement>(null);
	const canvas = useRef<HTMLCanvasElement>(null);
	const textBox = useRef<HTMLDivElement>(null);
	const [near, setNear] = useState(false);
	// 그린 글자 조각 (찾기 칠하기에 쓴다). 새로 그릴 때마다 판을 올려 칠하기를 다시 한다
	const pieces = useRef<{ div: HTMLElement; text: string }[]>([]);
	const [drawn, setDrawn] = useState(0);

	useEffect(() => {
		const el = box.current;
		if (!el) return;
		const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setNear(true), {
			rootMargin: NEAR,
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	// 그림: 배율이 바뀌면 다시 그린다. 화면 밀도(devicePixelRatio)만큼 촘촘히
	useEffect(() => {
		if (!near) return;
		let task: RenderTask | null = null;
		let alive = true;
		doc.getPage(number).then((page) => {
			const target = canvas.current;
			if (!alive || !target) return;
			const viewport = page.getViewport({ scale, rotation: rotated(page, rotation) });
			const ratio = window.devicePixelRatio || 1;
			target.width = Math.floor(viewport.width * ratio);
			target.height = Math.floor(viewport.height * ratio);
			task = page.render({
				canvas: target,
				viewport,
				transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
			});
			task.promise.catch(() => undefined);
		});
		return () => {
			alive = false;
			task?.cancel();
		};
	}, [doc, number, scale, rotation, near]);

	// 글자 층: 보이지 않는 글자를 그림 위에 겹쳐 고르고 복사할 수 있게 한다
	useEffect(() => {
		if (!near) return;
		let alive = true;
		let layer: { cancel: () => void } | null = null;
		Promise.all([pdfjs(), doc.getPage(number)]).then(async ([lib, page]) => {
			const container = textBox.current;
			if (!alive || !container) return;
			container.replaceChildren();
			const viewport = page.getViewport({ scale, rotation: rotated(page, rotation) });
			const text = new lib.TextLayer({ textContentSource: await page.getTextContent(), container, viewport });
			layer = text;
			await text.render().catch(() => undefined);
			if (!alive) return;
			pieces.current = text.textDivs.map((div, i) => ({ div, text: text.textContentItemsStr[i] ?? '' }));
			setDrawn((n) => n + 1);
		});
		return () => {
			alive = false;
			layer?.cancel();
		};
	}, [doc, number, scale, rotation, near]);

	// 찾기 칠하기. 고른 결과는 가운데로
	useEffect(() => {
		highlight(pieces.current, query, activeLocal)?.scrollIntoView({ block: 'center', inline: 'nearest' });
	}, [drawn, query, activeLocal]);

	return (
		<div
			ref={box}
			className="preview-page"
			data-page={number}
			aria-label={`${number}쪽`}
			role="group"
			style={{ width, height, '--total-scale-factor': scale } as React.CSSProperties}
		>
			<canvas ref={canvas} />
			<div ref={textBox} className="textLayer" />
		</div>
	);
};

export default PdfView;

/** 사이드바의 작은 쪽 그림 (한 번만 그린다) */
export const PdfThumb: React.FC<{ doc: PDFDocumentProxy; number: number; width: number; rotation?: number }> = ({
	doc,
	number,
	width,
	rotation = 0,
}) => {
	const canvas = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		let task: RenderTask | null = null;
		let alive = true;
		doc.getPage(number).then((page) => {
			const target = canvas.current;
			if (!alive || !target) return;
			const base = page.getViewport({ scale: 1, rotation: rotated(page, rotation) });
			const ratio = window.devicePixelRatio || 1;
			const viewport = page.getViewport({ scale: width / base.width, rotation: rotated(page, rotation) });
			target.width = Math.floor(viewport.width * ratio);
			target.height = Math.floor(viewport.height * ratio);
			target.style.aspectRatio = `${base.width} / ${base.height}`;
			task = page.render({
				canvas: target,
				viewport,
				transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
			});
			task.promise.catch(() => undefined);
		});
		return () => {
			alive = false;
			task?.cancel();
		};
	}, [doc, number, width, rotation]);
	return <canvas ref={canvas} className="preview-thumb-canvas" />;
};
