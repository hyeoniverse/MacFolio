import {
	createContext,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useExitMotion } from '@/shared/ui/motion/useExitMotion';
import { SheetHostContext, SheetPageContext } from './sheetContext';

/** 시트 안에서 초점이 갈 수 있는 것 (숨은 페이지의 것은 뺀다) */
const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), textarea, select, [tabindex]:not([tabindex="-1"])';
const focusablesIn = (root: HTMLElement) =>
	[...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => element.getClientRects().length > 0);

/** 페이지가 열리면 첫 입력 칸에 초점을 둔다 (없으면 페이지 안의 첫 컨트롤) */
const focusFirstField = (page: HTMLElement | null) => {
	if (!page) return;
	const field =
		page.querySelector<HTMLElement>('.projects-sheet-body input:not([type="file"]), .projects-sheet-body textarea') ??
		focusablesIn(page)[0];
	field?.focus();
};

/** 뒤로 버튼의 왼쪽 갈매기 */
const BackChevron = () => (
	<svg className="projects-sheet-back-glyph" viewBox="0 0 8 14" aria-hidden="true">
		<path d="M6.5 1.5 1.5 7l5 5.5" />
	</svg>
);

/** 시트를 닫는 동작 (완료·Esc): 어느 페이지의 완료든 시트 전체를 닫는다 */
const SheetCloseContext = createContext<() => void>(() => {});

/**
 * 시트의 한 페이지: 머리(뒤로 버튼과 제목), 칸, 아래 막대(왼쪽 항목 삭제 · 오른쪽 완료).
 * 다음 페이지가 열리면 이 페이지는 막대째 숨고, 닫히면 왼쪽에서 다시 들어온다. 그래서 항목 삭제는 늘 보이는 페이지의 항목을 지운다.
 * back이 있으면 밀려 들어온 페이지다 (오른쪽에서 들어오고, 연 페이지를 숨긴다)
 */
export const SheetPage = ({
	title,
	back,
	onDelete,
	children,
}: {
	title: string;
	back?: { label: string; onBack: () => void };
	/** 이 페이지의 항목을 목록에서 지운다 (지우면 시트나 이 페이지가 닫힌다) */
	onDelete?: () => void;
	children: ReactNode;
}) => {
	const parent = useContext(SheetPageContext);
	const close = useContext(SheetCloseContext);
	const [page, setPage] = useState<HTMLDivElement | null>(null);
	const [slot, setSlot] = useState<HTMLDivElement | null>(null);
	const frame = useMemo(() => ({ title, page, slot }), [title, page, slot]);
	// 밀려 들어온 페이지: 연 페이지를 숨기고, 닫히면 다시 보인다 (뒤로 가는 움직임으로).
	// 숨김은 DOM에 바로 건다: 닫히는 그 순간 앞 페이지가 보여야 목록의 줄로 초점을 돌려줄 수 있다
	const opener = back ? (parent?.page ?? null) : null;
	useLayoutEffect(() => {
		if (!opener) return;
		opener.toggleAttribute('hidden', true);
		return () => {
			opener.toggleAttribute('hidden', false);
			opener.setAttribute('data-motion', 'back');
		};
	}, [opener]);
	useEffect(() => focusFirstField(page), [page]);
	return (
		<>
			<div ref={setPage} className={`projects-sheet-page${back ? ' pushed' : ''}`}>
				<header className="projects-sheet-head">
					{back && (
						<button
							type="button"
							className="projects-sheet-back"
							aria-label={`뒤로 (${back.label})`}
							onClick={back.onBack}
						>
							<BackChevron />
							<span>{back.label}</span>
						</button>
					)}
					<h3 className="projects-sheet-title">{title}</h3>
				</header>
				<div className="projects-sheet-body">
					<SheetPageContext.Provider value={frame}>
						<div className="projects-box">{children}</div>
					</SheetPageContext.Provider>
				</div>
				<footer className="projects-sheet-foot">
					{onDelete && (
						<button type="button" className="projects-button destructive" onClick={onDelete}>
							항목 삭제
						</button>
					)}
					<button type="button" className="projects-button primary" onClick={close}>
						완료
					</button>
				</footer>
			</div>
			<div ref={setSlot} className="projects-sheet-slot" />
		</>
	);
};

/**
 * 항목 시트: 편집 화면을 살짝 어둡게 덮고, 위에서 둥근 판이 내려온다. 칸을 고치는 대로 바로 반영되니 오른쪽 버튼은 완료 하나,
 * 왼쪽에는 항목 삭제. Esc·완료로 닫고, 열린 동안 초점은 시트 안을 돈다 (바탕은 inert). 시트는 설정 창 안에 그려 창과 함께 움직인다
 */
export const ItemSheet = ({
	title,
	onClose,
	onDelete,
	children,
}: {
	title: string;
	onClose: () => void;
	onDelete?: () => void;
	children: ReactNode;
}) => {
	const { host, background } = useContext(SheetHostContext);
	const sheetRef = useRef<HTMLDivElement>(null);
	const layer = useExitMotion<HTMLDivElement>('fade-out');
	// 바탕을 막는다. 닫힐 때(정리) 바로 풀어야 목록의 줄로 초점을 돌려줄 수 있다
	useLayoutEffect(() => {
		if (!background) return;
		background.toggleAttribute('inert', true);
		return () => {
			background.toggleAttribute('inert', false);
		};
	}, [background]);
	if (!host) return null;
	return createPortal(
		<div ref={layer} className="projects-sheet-layer">
			<div
				ref={sheetRef}
				className="projects-sheet"
				role="dialog"
				aria-modal="true"
				aria-label={title}
				onKeyDown={(event) => {
					if (event.key === 'Escape' && !event.defaultPrevented) {
						event.preventDefault();
						event.stopPropagation();
						onClose();
					} else if (event.key === 'Tab' && sheetRef.current?.contains(event.target as Node)) {
						// 초점 가두기: 끝에서 Tab이면 처음으로, 처음에서 ⇧Tab이면 끝으로
						const all = focusablesIn(sheetRef.current);
						const edge = event.shiftKey ? all[0] : all.at(-1);
						if (!edge || document.activeElement !== edge) return;
						event.preventDefault();
						(event.shiftKey ? all.at(-1) : all[0])?.focus();
					}
				}}
			>
				<SheetCloseContext.Provider value={onClose}>
					<SheetPage title={title} onDelete={onDelete}>
						{children}
					</SheetPage>
				</SheetCloseContext.Provider>
			</div>
		</div>,
		host
	);
};
