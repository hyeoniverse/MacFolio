// 슬라이드쇼 (macOS 미리보기의 보기 › 슬라이드쇼, ⇧⌘F): 검은 화면에 한 쪽씩 화면 가득 맞춰 그린다.
// 키: → ↓ 스페이스 PageDown 다음, ← ↑ PageUp 이전, Home·End 처음·끝, Esc 끝내기. 누르면 다음 쪽.
// 마우스를 움직이면 아래에 작은 조절 막대(이전 / 쪽 / 다음 / 닫기)가 뜨고, 2초 가만히 있으면 사라진다 (커서도 숨긴다).
// 브라우저가 되면 전체 화면으로 띄우고, 닫을 때 빠져나온다. 끝낸 쪽을 onClose로 알려 미리보기 창이 그 쪽을 보인다
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { rotated } from './pdf';

/** 조절 막대가 사라지기까지 (ms) */
const IDLE = 2000;

type Props = {
	/** 시작할 쪽 (1부터) */
	startPage: number;
	/** 끝낸 쪽을 알린다 */
	onClose: (page: number) => void;
	/** 미리보기에서 돌린 각도 (그대로 보인다) */
	rotation?: number;
	label: string;
} & ({ doc: PDFDocumentProxy; image?: undefined } | { doc?: undefined; image: string });

/** 창 크기 (돌리거나 전체 화면으로 바뀌면 다시 맞춘다) */
function useScreenSize() {
	const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
	useEffect(() => {
		const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
		window.addEventListener('resize', update);
		return () => window.removeEventListener('resize', update);
	}, []);
	return size;
}

/** 한 쪽을 화면에 맞춰 그린 캔버스 (기기 픽셀 비율만큼 촘촘하게) */
const SlidePage: React.FC<{ doc: PDFDocumentProxy; number: number; rotation: number; label: string }> = ({
	doc,
	number,
	rotation,
	label,
}) => {
	const canvas = useRef<HTMLCanvasElement>(null);
	const { width, height } = useScreenSize();
	useEffect(() => {
		let task: RenderTask | null = null;
		let alive = true;
		doc.getPage(number).then((page) => {
			const target = canvas.current;
			if (!alive || !target) return;
			const angle = rotated(page, rotation);
			const base = page.getViewport({ scale: 1, rotation: angle });
			const scale = Math.min(width / base.width, height / base.height);
			const viewport = page.getViewport({ scale, rotation: angle });
			const ratio = window.devicePixelRatio || 1;
			target.width = Math.floor(viewport.width * ratio);
			target.height = Math.floor(viewport.height * ratio);
			target.style.width = `${Math.floor(viewport.width)}px`;
			target.style.height = `${Math.floor(viewport.height)}px`;
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
	}, [doc, number, rotation, width, height]);
	return <canvas ref={canvas} className="slideshow-page" role="img" aria-label={`${label} ${number}쪽`} />;
};

const Slideshow: React.FC<Props> = ({ doc, image, startPage, onClose, rotation = 0, label }) => {
	const pages = doc ? doc.numPages : 1;
	const [page, setPage] = useState(() => Math.min(Math.max(1, startPage), pages));
	const go = useCallback((n: number) => setPage(Math.min(Math.max(1, n), pages)), [pages]);
	const root = useRef<HTMLDivElement>(null);

	// 끝내기: 닫는 함수는 한 번만 부른다 (Esc와 전체 화면 빠져나옴이 겹쳐도)
	const pageRef = useRef(page);
	useEffect(() => {
		pageRef.current = page;
	}, [page]);
	const closed = useRef(false);
	const close = useCallback(() => {
		if (closed.current) return;
		closed.current = true;
		if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
		onClose(pageRef.current);
	}, [onClose]);

	// 조절 막대: 마우스를 움직이면 보이고, 가만히 있으면 사라진다
	const [controls, setControls] = useState(true);
	const idle = useRef<number | undefined>(undefined);
	const wake = useCallback(() => {
		setControls(true);
		window.clearTimeout(idle.current);
		idle.current = window.setTimeout(() => setControls(false), IDLE);
	}, []);
	// 처음에는 보이다가 가만히 있으면 사라진다
	useEffect(() => {
		idle.current = window.setTimeout(() => setControls(false), IDLE);
		return () => window.clearTimeout(idle.current);
	}, []);

	// 전체 화면: 되면 들어가고, 사용자가 브라우저에서 빠져나오면(Esc) 슬라이드쇼도 끝낸다
	useEffect(() => {
		const element = root.current;
		element?.focus();
		let entered = false;
		const onChange = () => {
			if (document.fullscreenElement === element) entered = true;
			else if (entered) close();
		};
		document.addEventListener('fullscreenchange', onChange);
		element?.requestFullscreen?.().catch(() => undefined);
		return () => document.removeEventListener('fullscreenchange', onChange);
	}, [close]);

	// 키는 창 전체에서 먼저 받는다: 메뉴 막대 단축키나 뒤의 미리보기 창이 같이 움직이지 않게
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			const target = event.target as HTMLElement | null;
			// 조절 막대의 버튼에 초점이 있으면 스페이스·Enter는 그 버튼이 받는다
			if (target?.closest('.slideshow-controls') && (event.key === ' ' || event.key === 'Enter')) return;
			const moves: Record<string, number> = {
				ArrowRight: page + 1,
				ArrowDown: page + 1,
				' ': page + 1,
				PageDown: page + 1,
				ArrowLeft: page - 1,
				ArrowUp: page - 1,
				PageUp: page - 1,
				Home: 1,
				End: pages,
			};
			if (event.key === 'Escape') close();
			else if (event.key in moves) go(moves[event.key]);
			else return;
			event.preventDefault();
			event.stopPropagation();
		};
		window.addEventListener('keydown', onKey, true);
		return () => window.removeEventListener('keydown', onKey, true);
	}, [page, pages, go, close]);

	return createPortal(
		<div
			ref={root}
			className={`slideshow${controls ? '' : ' idle'}`}
			role="dialog"
			aria-modal="true"
			aria-label="슬라이드쇼"
			tabIndex={-1}
			onMouseMove={wake}
		>
			<div className="slideshow-stage" onClick={() => go(page + 1)}>
				{doc ? (
					<SlidePage doc={doc} number={page} rotation={rotation} label={label} />
				) : (
					<img
						className="slideshow-page"
						src={image}
						alt={label}
						draggable={false}
						style={rotation ? { rotate: `${rotation}deg` } : undefined}
					/>
				)}
			</div>
			<div className="slideshow-controls" role="toolbar" aria-label="슬라이드쇼 조절" onMouseMove={wake}>
				<button type="button" aria-label="이전 페이지" disabled={page <= 1} onClick={() => go(page - 1)}>
					<ChevronLeft size={18} strokeWidth={1.8} aria-hidden="true" />
				</button>
				<span className="slideshow-count" aria-live="polite">
					{page} / {pages}
				</span>
				<button type="button" aria-label="다음 페이지" disabled={page >= pages} onClick={() => go(page + 1)}>
					<ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" />
				</button>
				<span className="slideshow-divider" aria-hidden="true" />
				<button type="button" aria-label="닫기" onClick={close}>
					<X size={17} strokeWidth={1.8} aria-hidden="true" />
				</button>
			</div>
		</div>,
		document.body
	);
};

export default Slideshow;
