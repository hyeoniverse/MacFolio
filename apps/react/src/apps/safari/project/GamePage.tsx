// SproutFarm (게임): 게임 화면 흐름. 타이틀 화면 → HUD(숫자) → 퀘스트(기능, 게임 대화창)와 조작법 → 하루(화면 모음)
// → 흙길을 따라가는 개발 일지 지도(만든 방식) → 인벤토리(기술 사양) → 크레딧(맡은 일).
// 그림은 게임에 쓴 Sprout Lands 에셋에서 필요한 조각만 잘라 쓴다 (public/imgs/projects/sproutfarm/sprites)
import React, { useEffect, useRef, useState } from 'react';
import type { Project } from '@/shared/profile';
import { Favicon, Links } from '@/apps/safari/project/parts';
import '@/apps/safari/project/GamePage.css';

const SPRITES = '/imgs/projects/sproutfarm/sprites';

/** 장식 스프라이트 (글을 읽는 데는 필요 없다) */
const Sprite: React.FC<{ name: string; className: string }> = ({ name, className }) => (
	<img className={`gm-sprite ${className}`} src={`${SPRITES}/${name}.png`} alt="" aria-hidden="true" />
);

/** 퀘스트마다 말을 거는 얼굴 (차례대로 돌려 쓴다) */
const QUEST_FACES = ['items/cow', 'items/fruit', 'items/grass', 'items/clock'];

/** 인벤토리 칸의 아이템 그림: 기술 사양 이름에 맞춰 고르고, 없으면 차례대로 */
const ITEM_ICONS: Record<string, string> = {
	엔진: 'items/pickaxe',
	렌더링: 'items/painting',
	맵: 'items/seeds',
	AI: 'items/egg',
	'입력 · UI': 'catpaw',
	배포: 'items/chest',
	서버: 'items/milk',
};
const FALLBACK_ICONS = Object.values(ITEM_ICONS);
const SLOTS = 12;

/** 지도 풀밭에 흩어 둘 것들: 이름과 원래 픽셀 폭 (세 배로 키운다) */
const DECOR: [string, number][] = [
	['tree', 24],
	['tree-apple', 24],
	['tree-tall', 14],
	['bush', 16],
	['berry-bush', 16],
	['rock', 16],
	['rock-big', 16],
	['pebble', 10],
	['stump', 10],
	['log', 16],
	['mushrooms', 13],
	['mushrooms-purple', 28],
	['flower-yellow', 9],
	['flower-rose', 11],
	['flower-small', 9],
	['flower-blue', 11],
	['sprout', 8],
];

/** 늘 같은 자리에 놓이도록 씨앗이 정해진 난수 */
function seeded(seed: number) {
	let a = seed;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

type Decor = { name: string; width: number; x: number; y: number };

/** 칸마다 표지판 반대편 빈 풀밭에 서너 개씩, 자리와 크기를 불규칙하게 */
function scatter(count: number) {
	const random = seeded(count * 7919 + 17);
	const items: Decor[] = [];
	for (let i = 0; i < count; i++) {
		// 짝수 칸은 표지판이 왼쪽이라 오른쪽이 비고, 홀수 칸은 그 반대
		const [from, to] = i % 2 === 0 ? [76, 94] : [6, 24];
		const many = 3 + Math.floor(random() * 2);
		for (let k = 0; k < many; k++) {
			const [name, width] = DECOR[Math.floor(random() * DECOR.length)];
			items.push({
				name,
				width,
				x: from + random() * (to - from),
				y: ((i + 0.08 + ((k + random()) / many) * 0.84) / count) * 100,
			});
		}
	}
	// 아래에 있는 것이 앞에 오도록
	return items.sort((a, b) => a.y - b.y);
}

/** 가장 가까운 스크롤 상자 (없으면 창) */
function scrollParent(node: HTMLElement): HTMLElement | null {
	for (let el = node.parentElement; el; el = el.parentElement) {
		const { overflowY } = getComputedStyle(el);
		if (overflowY === 'auto' || overflowY === 'scroll') return el;
	}
	return null;
}

const itemIcon = (label: string, i: number) => ITEM_ICONS[label] ?? FALLBACK_ICONS[i % FALLBACK_ICONS.length];

/** 개발 일지 지도의 흙길: 칸마다 왼쪽·오른쪽 표지판 옆을 지나 구불구불 내려간다 (칸 높이 100) */
function roadPath(count: number) {
	let d = 'M50 0';
	let y = 0;
	for (let i = 0; i < count; i++) {
		const x = i % 2 === 0 ? 64 : 36;
		const next = 100 * i + 50;
		d += ` C${i === 0 ? 50 : i % 2 === 0 ? 36 : 64} ${y + 35} ${x} ${next - 35} ${x} ${next}`;
		y = next;
	}
	const last = count % 2 === 0 ? 36 : 64;
	return `${d} C${last} ${y + 35} 50 ${100 * count - 20} 50 ${100 * count}`;
}

const GamePage: React.FC<{ project: Project }> = ({ project }) => {
	const root = useRef<HTMLDivElement>(null);
	const title = useRef<HTMLElement>(null);
	const hud = useRef<HTMLElement>(null);
	const road = useRef<HTMLDivElement>(null);
	const path = useRef<SVGPathElement>(null);
	const hero = useRef<HTMLSpanElement>(null);
	const paw = useRef<HTMLSpanElement>(null);
	const [started, setStarted] = useState(false);
	const [picked, setPicked] = useState(0);
	const stages = project.build.length;
	const decor = React.useMemo(() => scatter(stages), [stages]);

	// 타이틀 화면의 앞뒤: 발끝(아래 끝)이 더 위에 있는 것이 뒤로 간다. 동물은 옆으로만 걸으니 발끝 높이가 그대로다
	useEffect(() => {
		const scene = title.current;
		if (!scene) return;
		const sort = () => {
			const top = scene.getBoundingClientRect().top;
			for (const item of scene.children) {
				if (item instanceof HTMLElement)
					item.style.zIndex = String(Math.round(item.getBoundingClientRect().bottom - top));
			}
		};
		sort();
		// 그림이 늦게 불러와지면 높이가 바뀐다
		scene.addEventListener('load', sort, true);
		const resized = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sort);
		resized?.observe(scene);
		return () => {
			scene.removeEventListener('load', sort, true);
			resized?.disconnect();
		};
	}, []);

	// 스크롤하면 주인공이 흙길을 따라 걷는다: 화면 가운데 높이와 같은 길 위의 점에 선다
	useEffect(() => {
		const box = road.current;
		const line = path.current;
		const walker = hero.current;
		if (!box || !line || !walker || typeof line.getPointAtLength !== 'function') return;
		const scroller = scrollParent(box);
		const target = scroller ?? window;
		const total = line.getTotalLength();
		let frame = 0;
		let idle = 0;
		let lastX: number | null = null;

		const place = () => {
			frame = 0;
			const svg = line.ownerSVGElement;
			if (!svg) return;
			const area = svg.getBoundingClientRect();
			if (area.height === 0) return;
			const view = scroller?.getBoundingClientRect();
			const center = view ? view.top + view.height / 2 : window.innerHeight / 2;
			const goal = Math.min(Math.max((center - area.top) / area.height, 0), 1) * stages * 100;
			// 길은 아래로만 내려가니 높이로 길 위의 거리를 찾는다
			let low = 0;
			let high = total;
			for (let i = 0; i < 18; i++) {
				const mid = (low + high) / 2;
				if (line.getPointAtLength(mid).y < goal) low = mid;
				else high = mid;
			}
			const point = line.getPointAtLength(low);
			const base = box.getBoundingClientRect();
			const x = area.left - base.left + (point.x / 100) * area.width;
			const y = area.top - base.top + (point.y / (stages * 100)) * area.height;
			const facing =
				lastX !== null && x < lastX - 0.5
					? -1
					: lastX !== null && x > lastX + 0.5
						? 1
						: Number(walker.dataset.facing ?? 1);
			lastX = x;
			walker.dataset.facing = String(facing);
			walker.style.transform = `translate(${x - 72}px, ${y - 96}px) scaleX(${facing})`;
		};
		const onScroll = () => {
			walker.dataset.walking = 'true';
			window.clearTimeout(idle);
			idle = window.setTimeout(() => (walker.dataset.walking = 'false'), 180);
			if (!frame) frame = requestAnimationFrame(place);
		};
		place();
		target.addEventListener('scroll', onScroll, { passive: true });
		// 그림이 늦게 불러와져 길의 높이가 바뀌면 자리를 다시 잡는다
		const resized = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => place());
		resized?.observe(box);
		return () => {
			target.removeEventListener('scroll', onScroll);
			resized?.disconnect();
			cancelAnimationFrame(frame);
			window.clearTimeout(idle);
		};
	}, [stages]);

	// 커서는 게임의 고양이 발: 마우스를 따라다니며 톡톡 두드리고, 누르면 꾹 잡는다
	useEffect(() => {
		const page = root.current;
		const hand = paw.current;
		if (!page || !hand) return;
		const scroller = scrollParent(page);
		let last: { x: number; y: number } | null = null;
		const move = () => {
			if (!last) return;
			const base = page.getBoundingClientRect();
			hand.style.transform = `translate(${last.x - base.left - 6}px, ${last.y - base.top - 2}px)`;
		};
		const onMove = (event: PointerEvent) => {
			if (event.pointerType !== 'mouse') return;
			last = { x: event.clientX, y: event.clientY };
			page.dataset.paw = 'on';
			move();
		};
		const onLeave = () => {
			last = null;
			page.dataset.paw = 'off';
		};
		const onDown = () => (hand.dataset.hold = 'true');
		const onUp = () => (hand.dataset.hold = 'false');
		page.addEventListener('pointermove', onMove);
		page.addEventListener('pointerleave', onLeave);
		page.addEventListener('pointerdown', onDown);
		window.addEventListener('pointerup', onUp);
		(scroller ?? window).addEventListener('scroll', move, { passive: true });
		return () => {
			page.removeEventListener('pointermove', onMove);
			page.removeEventListener('pointerleave', onLeave);
			page.removeEventListener('pointerdown', onDown);
			window.removeEventListener('pointerup', onUp);
			(scroller ?? window).removeEventListener('scroll', move);
		};
	}, []);

	// 게임처럼 START를 누르면 화면이 한 번 번쩍이고 첫 화면(HUD와 퀘스트)으로 내려간다
	const start = () => {
		setStarted(true);
		window.setTimeout(() => {
			hud.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			setStarted(false);
		}, 260);
	};

	return (
		<div className="gm" ref={root} data-started={started}>
			<span className="gm-paw" ref={paw} aria-hidden="true" />
			<header className="gm-title" ref={title}>
				<Sprite name="chicken-house" className="gm-house" />
				<Sprite name="tree" className="gm-tree a" />
				<Sprite name="fruit-tree" className="gm-tree b" />
				<Sprite name="tree" className="gm-tree c" />
				<Sprite name="sunflower" className="gm-sunflower" />
				<Sprite name="flower-pink" className="gm-flower a" />
				<Sprite name="flower-blue" className="gm-flower b" />
				<Sprite name="mushroom" className="gm-flower c" />
				<Sprite name="bush" className="gm-flower d" />
				<span className="gm-walker gm-cow" aria-hidden="true" />
				<span className="gm-walker gm-chick a" aria-hidden="true" />
				<span className="gm-walker gm-chick b" aria-hidden="true" />

				<div className="gm-title-body">
					<Favicon project={project} className="gm-icon" />
					<p className="gm-sign">{project.name}</p>
					<h1>{project.tagline}</h1>
					<p className="gm-lead">{project.description}</p>
					<Links project={project} className="gm-links" />
					<button type="button" className="gm-press" onClick={start} aria-label="시작: 퀘스트로 내려가기">
						PRESS START
					</button>
				</div>
			</header>

			<section className="gm-hud" aria-label="한눈에 보기" ref={hud}>
				{project.facts.map((fact) => (
					<div key={fact.label}>
						<span>{fact.label}</span>
						<strong>{fact.value}</strong>
					</div>
				))}
			</section>

			<div className="gm-row">
				<section className="gm-quests" aria-label="주요 기능">
					<h2>
						<img src={`${SPRITES}/star.png`} alt="" aria-hidden="true" /> 퀘스트
					</h2>
					{project.art && <img className="gm-art" src={project.art} alt={`${project.name} 장면`} />}
					<ol>
						{project.highlights.map((point, i) => (
							<li key={point.title} className="gm-dialog">
								<span className="gm-portrait" aria-hidden="true">
									<img className="gm-face" src={`${SPRITES}/${QUEST_FACES[i % QUEST_FACES.length]}.png`} alt="" />
								</span>
								<div className="gm-bubble">
									<h3>{point.title}</h3>
									<p>{point.body}</p>
									{point.image && <img className="gm-shot" src={point.image} alt={`${point.title} 장면`} />}
								</div>
							</li>
						))}
					</ol>
				</section>
				{project.controls && (
					<section className="gm-panel gm-controls" aria-label="조작법">
						<h2>조작법</h2>
						<ul>
							{project.controls.map((control) => (
								<li key={control.label}>
									<span className="gm-keys">
										{control.keys.map((key) => (
											<kbd key={key}>{key}</kbd>
										))}
									</span>
									<span>{control.label}</span>
								</li>
							))}
						</ul>
						<span className="gm-walker gm-runner" aria-hidden="true" />
					</section>
				)}
			</div>

			{project.gallery && (
				<section className="gm-day" aria-label="화면 모음">
					<h2>
						<img src={`${SPRITES}/heart.png`} alt="" aria-hidden="true" /> 하루
					</h2>
					<ol>
						{project.gallery.map((shot) => (
							<li key={shot.src}>
								<img src={shot.src} alt={shot.caption} loading="lazy" />
								<p>{shot.caption}</p>
							</li>
						))}
					</ol>
				</section>
			)}

			<section className="gm-map" aria-label="만든 방식">
				<h2 className="gm-map-title">개발 일지</h2>
				<div className="gm-road" ref={road} style={{ '--stages': stages } as React.CSSProperties}>
					<div className="gm-decor" aria-hidden="true">
						{decor.map((item, i) => (
							<img
								key={i}
								src={`${SPRITES}/map/${item.name}.png`}
								alt=""
								style={{ left: `${item.x}%`, top: `${item.y}%`, width: item.width * 3 }}
							/>
						))}
						<span className="gm-pond" />
					</div>
					<svg
						className="gm-road-line"
						viewBox={`0 0 100 ${stages * 100}`}
						preserveAspectRatio="none"
						aria-hidden="true"
					>
						<path d={roadPath(stages)} className="dirt" ref={path} />
						<path d={roadPath(stages)} className="edge" />
					</svg>
					<span className="gm-walker gm-hero" ref={hero} aria-hidden="true" data-walking="false" />
					<ol>
						{project.build.map((point, i) => (
							<li key={point.title}>
								<span className="gm-marker" aria-hidden="true">
									{i + 1}
								</span>
								<div className="gm-stage">
									<span className="gm-stage-no">STAGE {i + 1}</span>
									<h3>{point.title}</h3>
									<p>{point.body}</p>
									{point.image && <img src={point.image} alt={`${point.title} 그림`} loading="lazy" />}
								</div>
							</li>
						))}
					</ol>
					<p className="gm-goal">
						<img src={`${SPRITES}/star.png`} alt="" aria-hidden="true" /> CLEAR
					</p>
				</div>
			</section>

			<section className="gm-inventory" aria-label="기술 사양">
				<h2>
					<img src={`${SPRITES}/items/chest.png`} alt="" aria-hidden="true" /> 인벤토리
				</h2>
				<div className="gm-bag">
					<ul className="gm-slots">
						{Array.from({ length: Math.max(SLOTS, project.specs.length) }, (_, i) => {
							const spec = project.specs[i];
							if (!spec) return <li key={i} className="gm-slot empty" aria-hidden="true" />;
							return (
								<li key={spec.label}>
									<button
										type="button"
										className="gm-slot"
										aria-pressed={picked === i}
										aria-label={spec.label}
										title={spec.label}
										onClick={() => setPicked(i)}
										onMouseEnter={() => setPicked(i)}
										onFocus={() => setPicked(i)}
									>
										<img src={`${SPRITES}/${itemIcon(spec.label, i)}.png`} alt="" />
										<span className="gm-slot-no">{i + 1}</span>
									</button>
								</li>
							);
						})}
					</ul>
					{project.specs[picked] && (
						<div className="gm-item" aria-live="polite">
							<img src={`${SPRITES}/${itemIcon(project.specs[picked].label, picked)}.png`} alt="" />
							<div>
								<strong>{project.specs[picked].label}</strong>
								<p>{project.specs[picked].value}</p>
							</div>
						</div>
					)}
				</div>
				<ul className="visually-hidden">
					{project.specs.map((spec) => (
						<li key={spec.label}>
							{spec.label}: {spec.value}
						</li>
					))}
				</ul>
			</section>

			<section className="gm-credits" aria-label="맡은 일">
				<h2>CREDITS</h2>
				<p className="gm-credit-role">{project.context}</p>
				{project.period && <p className="gm-credit-role">{project.period}</p>}
				<ul>
					{project.contributions.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
				{project.credits && (
					<ul className="gm-asset-credits">
						{project.credits.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				)}
				<p className="gm-end">{project.tagline}</p>
				<Links project={project} className="gm-links" />
			</section>
		</div>
	);
};

export default GamePage;
