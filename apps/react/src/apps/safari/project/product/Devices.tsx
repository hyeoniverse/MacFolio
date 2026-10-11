// MacFolio 전용 데모 "어디서 열어도": 브라우저 크기를 바꿔 보는 시뮬레이터.
// 이 구역에 들어오면 화면에 고정된 채로, 스크롤하는 만큼 모니터 → 노트북 → 태블릿 → 휴대폰으로 넘어가고,
// 휴대폰까지 보면 다음 앱(메시지, Safari)으로 이어진다. 기기 틀이 모양을 바꾸며 그 크기에서 찍은 화면이 나타난다.
// 좁은 창이나 움직임 줄이기에서는 고정하지 않고 눌러서 고른다
import React, { useEffect, useRef, useState } from 'react';
import { cssVars } from '@/shared/lib/cssVars';
import { Region } from '@/apps/safari/project/parts';
import { onScrollFrame, scrollParent, viewOf } from '@/apps/safari/project/scroll';
import { prefersReducedMotion } from '@/apps/safari/project/reveal';
import '@/apps/safari/project/product/Devices.css';

const VIEWS_DIR = '/imgs/projects/macfolio/views';

/** 시뮬레이터에서 고를 앱 */
const APPS = [
	{ id: 'memo', name: '메모', note: '블로그' },
	{ id: 'messages', name: '메시지', note: '방명록' },
	{ id: 'safari', name: 'Safari', note: '프로젝트' },
] as const;

type AppId = (typeof APPS)[number]['id'];

/**
 * 시뮬레이터가 차례로 보여 주는 화면 크기. 그림은 그 크기의 실제 브라우저로 찍었다 (views/{앱}-{크기}.jpg).
 * share는 무대 폭에서 기기가 차지하는 비율, ratio는 화면의 세로/가로
 */
const SIZES = [
	{
		id: 'monitor',
		name: '모니터',
		px: 1920,
		share: 0.92,
		ratio: 1080 / 1920,
		note: '넓은 화면에서는 창을 여러 개 띄워 두고 Dock에서 앱을 엽니다. 창은 끌어서 옮기고 모서리를 잡아 크기를 바꿉니다.',
	},
	{
		id: 'laptop',
		name: '노트북',
		px: 1440,
		share: 0.8,
		ratio: 900 / 1440,
		note: '같은 데스크톱입니다. 메뉴 막대와 Dock은 그대로이고, 창은 화면 안에 들어오는 크기로 열립니다.',
	},
	{
		id: 'tablet',
		name: '태블릿',
		px: 820,
		share: 0.42,
		ratio: 1180 / 820,
		note: '768px부터는 아직 데스크톱입니다. 화면이 좁으면 창이 화면 폭에 맞춰 열려 잘리지 않습니다.',
	},
	{
		id: 'phone',
		name: '휴대폰',
		px: 390,
		share: 0.27,
		ratio: 844 / 390,
		note: '767px 이하에서는 iOS 홈 화면이 되고, 앱은 화면을 가득 채웁니다. 가로로 눕혀 높이가 499px 이하인 휴대폰도 같습니다.',
	},
] as const;

/** 고정된 시뮬레이터가 스크롤로 넘기는 장면 수: 앱마다 모든 크기 */
const STEPS = APPS.length * SIZES.length;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** 숫자가 목표값까지 굴러간다 (창 크기를 끌어 바꾸는 것처럼) */
function useRollingNumber(target: number, duration = 700) {
	const [value, setValue] = useState(target);
	const from = useRef(target);
	useEffect(() => {
		if (prefersReducedMotion()) {
			from.current = target;
			setValue(target);
			return;
		}
		const start = performance.now();
		const begin = from.current;
		let frame = requestAnimationFrame(function tick(now) {
			const t = Math.min(1, (now - start) / duration);
			const eased = 1 - (1 - t) ** 3;
			const next = Math.round(begin + (target - begin) * eased);
			from.current = next;
			setValue(next);
			if (t < 1) frame = requestAnimationFrame(tick);
		});
		return () => cancelAnimationFrame(frame);
	}, [target, duration]);
	return value;
}

const Devices: React.FC = () => {
	const [app, setApp] = useState<AppId>('memo');
	const [index, setIndex] = useState(0);
	const track = useRef<HTMLDivElement>(null);
	const sticky = useRef<HTMLDivElement>(null);
	const size = SIZES[index];
	const appInfo = APPS.find((item) => item.id === app) ?? APPS[0];
	const px = useRollingNumber(size.px);
	const pinned = () => !!sticky.current && getComputedStyle(sticky.current).position === 'sticky';

	// 고정되어 있을 때는 지나온 만큼이 지금 앱과 크기다: 메모의 모니터 → … → 휴대폰, 이어서 메시지, Safari 차례로
	useEffect(() => {
		const node = track.current;
		if (!node) return;
		node.style.setProperty('--steps', String(STEPS));
		return onScrollFrame(node, (scroller) => {
			const view = viewOf(scroller);
			node.style.setProperty('--view', `${view.height}px`);
			if (!pinned()) return;
			const box = node.getBoundingClientRect();
			const p = clamp((view.top - box.top) / Math.max(1, box.height - view.height));
			const step = Math.min(STEPS - 1, Math.floor(p * STEPS));
			const appIndex = Math.floor(step / SIZES.length);
			// 단계 막대는 지금 앱 안에서 지나온 만큼 찬다
			node.style.setProperty('--sp', clamp(p * APPS.length - appIndex).toFixed(4));
			setApp(APPS[appIndex].id);
			setIndex(step % SIZES.length);
		});
	}, []);

	/** 앱과 단계를 고르면: 고정된 동안에는 그 자리로 스크롤하고, 아니면 바로 바꾼다 */
	const choose = (appId: AppId, i: number) => {
		const node = track.current;
		const scroller = node && scrollParent(node);
		if (!node || !pinned() || !scroller) {
			setApp(appId);
			setIndex(i);
			return;
		}
		const step = APPS.findIndex((item) => item.id === appId) * SIZES.length + i;
		const view = viewOf(scroller);
		const box = node.getBoundingClientRect();
		const span = box.height - view.height;
		scroller.scrollTo({
			top: scroller.scrollTop + box.top - view.top + ((step + 0.5) / STEPS) * span,
			behavior: 'smooth',
		});
	};

	return (
		<Region label="어디서 열어도" className="pdv">
			<div className="pdv-track" ref={track}>
				<div className="pdv-sticky" ref={sticky}>
					<div className="pdv-layout">
						<div className="pdv-copy">
							<p className="pd-kicker">어디서 열어도</p>
							<h2>크기에 맞춰, 모양이 바뀐다.</h2>
							<p className="pdv-lead">화면 크기에 따라 데스크톱이 되고, 휴대폰이 됩니다.</p>
							<div className="pdv-switch" role="group" aria-label="보여 줄 앱">
								{APPS.map((item) => (
									<button key={item.id} type="button" aria-pressed={item.id === app} onClick={() => choose(item.id, 0)}>
										{item.name}
										<span>{item.note}</span>
									</button>
								))}
							</div>
							<ol className="pdv-steps">
								{SIZES.map((item, i) => (
									<li key={item.id}>
										<button
											type="button"
											aria-current={i === index ? 'step' : undefined}
											onClick={() => choose(app, i)}
											style={cssVars({ i })}
										>
											<strong>{item.name}</strong>
											<span>{item.px}px</span>
										</button>
									</li>
								))}
							</ol>
							<p className="pdv-note" aria-live="polite" key={size.id}>
								<strong>
									{size.name} · {size.px}px
								</strong>{' '}
								{size.note}
							</p>
						</div>

						<div className="pdv-stage" data-kind={size.id} style={cssVars({ share: size.share, ratio: size.ratio })}>
							<div className="pdv-device">
								<div className="pdv-screen">
									{SIZES.map((item) => (
										<img
											key={item.id}
											src={`${VIEWS_DIR}/${app}-${item.id}.jpg`}
											alt={item.id === size.id ? `${item.name}에서 연 ${appInfo.name}` : ''}
											aria-hidden={item.id === size.id ? undefined : true}
											className={item.id === size.id ? 'active' : undefined}
											loading="lazy"
										/>
									))}
								</div>
								<span className="pdv-stand" aria-hidden="true" />
								<span className="pdv-base" aria-hidden="true" />
							</div>
							<div className="pdv-ruler" aria-hidden="true">
								<span>{px.toLocaleString('en-US')}px</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</Region>
	);
};

export default Devices;
