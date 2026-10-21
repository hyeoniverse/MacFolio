import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { endTour, stepTour, useTour } from './tourStore';
import { FINISH_ID, WELCOME_ID } from './tourSteps';
import './Tour.css';

interface Box {
	top: number;
	left: number;
	width: number;
	height: number;
}

/** 비출 곳 둘레의 여유 */
const PAD = 6;
/** 카드 크기와 화면 가장자리 여백 */
const CARD_WIDTH = 300;
const EDGE = 16;
const GAP = 14;

/** 비출 자리 (여유를 두되 화면 안으로: 메뉴 막대처럼 맨 위에 붙은 것도 테두리가 잘리지 않게) */
const boxOf = (el: Element): Box => {
	const rect = el.getBoundingClientRect();
	const top = Math.max(2, rect.top - PAD);
	const left = Math.max(2, rect.left - PAD);
	const bottom = Math.min(window.innerHeight - 2, rect.bottom + PAD);
	const right = Math.min(window.innerWidth - 2, rect.right + PAD);
	return { top, left, width: right - left, height: bottom - top };
};
const sameBox = (a: Box | null, b: Box | null) =>
	a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);

/** 비춘 곳 아래(공간이 없으면 위)에, 화면 밖으로 나가지 않게 카드를 둔다 */
function cardPosition(box: Box, cardHeight: number) {
	const below = box.top + box.height + GAP;
	const top = below + cardHeight + EDGE <= window.innerHeight ? below : Math.max(EDGE, box.top - GAP - cardHeight);
	const width = Math.min(CARD_WIDTH, window.innerWidth - EDGE * 2);
	const left = Math.min(Math.max(EDGE, box.left + box.width / 2 - width / 2), window.innerWidth - width - EDGE);
	return { top, left, width };
}

/**
 * 둘러보기 (macOS 팁 앱처럼): 화면의 한 곳을 비추고 무엇인지, 무엇을 눌러 볼지 알려 준다.
 * - 어둡게 덮지만 화면은 그대로 눌린다. 비춘 곳을 누르면 다음 단계로 넘어간다
 * - 비출 곳이 화면에 없으면(좁은 화면이라 Dock에 없는 앱 등) 그 단계를 건너뛴다
 * - Esc나 건너뛰기로 닫으면 이 브라우저에서는 다시 띄우지 않는다 (팁 앱·도움말 메뉴에서 다시 연다)
 */
const Tour = () => {
	const { step, index, steps, single } = useTour();
	const [box, setBox] = useState<Box | null>(null);
	const card = useRef<HTMLDivElement>(null);
	const [cardHeight, setCardHeight] = useState(160);
	const target = step?.target;

	// 비출 곳의 자리를 계속 따라간다 (창이 열리고 움직이거나 화면 크기가 바뀌어도)
	useEffect(() => {
		if (!target) return;
		const found = document.querySelector(target);
		// 문서에 있어도 화면 밖(휴대폰 홈 화면의 다른 쪽, 숨은 칸)이면 없는 것으로 친다
		const rect = found?.getBoundingClientRect();
		const visible =
			rect &&
			rect.width > 0 &&
			rect.height > 0 &&
			rect.right > 0 &&
			rect.bottom > 0 &&
			rect.left < window.innerWidth &&
			rect.top < window.innerHeight;
		if (!visible) {
			// 화면에 없는 곳은 건너뛴다 (하나만 보여 줄 때는 닫는다)
			if (single) endTour();
			else stepTour(1);
			return;
		}
		let frame = 0;
		const follow = () => {
			const el = document.querySelector(target);
			const next = el ? boxOf(el) : null;
			setBox((current) => (sameBox(current, next) ? current : next));
			frame = requestAnimationFrame(follow);
		};
		frame = requestAnimationFrame(follow);
		return () => cancelAnimationFrame(frame);
	}, [target, single]);

	// 비춘 곳을 누르면 (그 클릭은 그대로 하고) 다음 단계로
	useEffect(() => {
		if (!target || single) return;
		const onClick = (event: MouseEvent) => {
			const el = document.querySelector(target);
			if (el && event.target instanceof Node && el.contains(event.target)) setTimeout(() => stepTour(1), 0);
		};
		document.addEventListener('click', onClick, true);
		return () => document.removeEventListener('click', onClick, true);
	}, [target, single]);

	useEffect(() => {
		if (!step) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') endTour();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [step]);

	useLayoutEffect(() => {
		if (card.current) setCardHeight(card.current.offsetHeight);
	}, [step]);

	if (!step) return null;
	// 비출 곳을 아직 못 쟀으면 그리지 않는다 (건너뛸 수도 있다). 가운데 카드 단계에서는 이전 자리를 쓰지 않는다
	if (target && !box) return null;
	const spot = target ? box : null;

	const welcome = step.id === WELCOME_ID;
	const finish = step.id === FINISH_ID;
	// 진행 표시는 비추는 단계만 센다 (환영·마무리 카드는 빼고)
	const pointed = steps.filter((each) => each.target);
	const at = pointed.indexOf(step);
	const position = spot ? cardPosition(spot, cardHeight) : null;

	return (
		<div className={`tour${spot ? '' : ' tour-center'}`}>
			{spot ? (
				<div
					className="tour-spotlight"
					style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
					aria-hidden="true"
				/>
			) : (
				<div className="tour-dim" aria-hidden="true" />
			)}
			<div
				ref={card}
				className="tour-card"
				role="dialog"
				aria-label={step.title}
				aria-live="polite"
				style={position ? { top: position.top, left: position.left, width: position.width } : undefined}
			>
				{welcome && <img className="tour-card-icon" src="/imgs/tips.svg" alt="" />}
				<h2>{step.title}</h2>
				<p>{step.body}</p>
				{target && !single && (
					<p className="tour-card-hint">
						<i className="fa-solid fa-hand-pointer" aria-hidden="true" /> 빛나는 곳을 눌러 보세요
					</p>
				)}
				<div className="tour-card-bar">
					{at >= 0 && !single && (
						<span className="tour-card-count" aria-label={`${pointed.length}단계 중 ${at + 1}단계`}>
							{at + 1} / {pointed.length}
						</span>
					)}
					<span className="tour-card-buttons">
						{single ? (
							<button type="button" className="tour-button primary" onClick={endTour}>
								확인
							</button>
						) : welcome ? (
							<>
								<button type="button" className="tour-button" onClick={endTour}>
									다음에 할게요
								</button>
								<button type="button" className="tour-button primary" onClick={() => stepTour(1)}>
									둘러보기 시작
								</button>
							</>
						) : finish ? (
							<button type="button" className="tour-button primary" onClick={() => stepTour(1)}>
								시작하기
							</button>
						) : (
							<>
								<button type="button" className="tour-button quiet" onClick={endTour}>
									건너뛰기
								</button>
								{index > 1 && (
									<button type="button" className="tour-button" onClick={() => stepTour(-1)}>
										이전
									</button>
								)}
								<button type="button" className="tour-button primary" onClick={() => stepTour(1)}>
									다음
								</button>
							</>
						)}
					</span>
				</div>
			</div>
		</div>
	);
};

export default Tour;
