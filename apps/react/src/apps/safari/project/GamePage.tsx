// SproutFarm (게임): 게임 화면 흐름. 타이틀 화면 → HUD(숫자) → 퀘스트(기능, 게임 대화창)와 조작법 → 하루(화면 모음)
// → 흙길을 따라가는 개발 일지 지도(만든 방식) → 인벤토리(기술 사양) → 크레딧(맡은 일).
// 그림은 게임에 쓴 Sprout Lands 에셋에서 필요한 조각만 잘라 쓴다 (public/imgs/projects/sproutfarm/sprites)
import React, { useEffect, useRef, useState } from 'react';
import { PROFILE, type Project } from '@/shared/profile';
import { Favicon, Links } from '@/apps/safari/project/parts';
import '@/apps/safari/project/GamePage.css';
import { scrollParent } from '@/apps/safari/project/scroll';

const SPRITES = '/imgs/projects/sproutfarm/sprites';

/** 장식 스프라이트 (글을 읽는 데는 필요 없다) */
const Sprite: React.FC<{ name: string; className: string }> = ({ name, className }) => (
	<img className={`gm-sprite ${className}`} src={`${SPRITES}/${name}.png`} alt="" aria-hidden="true" />
);

/** 게임 대화창의 표정(Teemo 이모트): 이름과 칸 수. 퀘스트마다 다른 표정을 차례대로 돌려 쓴다 */
type Emote = [name: string, frames: number];
const QUEST_EMOTES: Emote[] = [
	['hooray', 2],
	['blink', 4],
	['ears', 5],
	['sleeping', 2],
];

/** 한 칸씩 넘기며 움직이는 표정 */
const EmoteFace: React.FC<{ emote: Emote; className?: string }> = ({ emote: [name, frames], className = '' }) => (
	<span
		className={`gm-emote ${className}`}
		aria-hidden="true"
		style={
			{
				backgroundImage: `url(${SPRITES}/emotes/${name}.png)`,
				'--frames': frames,
			} as React.CSSProperties
		}
	/>
);

/** 인벤토리 칸의 아이템 그림: 기술 사양 이름에 맞춰 고르고, 없으면 차례대로 */
const ITEM_ICONS: Record<string, string> = {
	엔진: 'items/pickaxe',
	렌더링: 'items/painting',
	맵: 'items/seeds',
	AI: 'items/egg',
	'입력 · UI': 'items/gamepad',
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

/**
 * 페이지를 내려가는 만큼 하루가 흐른다: 아침(타이틀) → 낮(하루) → 노을(개발 일지 가운데) → 붉은 저녁(개발 일지 끝) → 해 질 녘(인벤토리) → 밤(크레딧).
 * anchor는 그 시간이 되는 자리(구역과 그 구역 안의 비율), sky는 바탕색, light는 풀밭 그림 위에 얹는 빛(마지막 값은 진하기)
 */
type DayStop = { anchor: [string, number]; sky: number[]; dark: number[]; light: number[] };
const DAY: DayStop[] = [
	{ anchor: ['.gm-title', 0.3], sky: [253, 240, 214], dark: [40, 38, 28], light: [255, 214, 150, 0.12] },
	{ anchor: ['.gm-day', 0.5], sky: [232, 243, 211], dark: [24, 33, 15], light: [255, 255, 255, 0] },
	{ anchor: ['.gm-map', 0.5], sky: [248, 196, 150], dark: [62, 36, 26], light: [255, 130, 50, 0.26] },
	{ anchor: ['.gm-map', 0.92], sky: [214, 136, 140], dark: [58, 30, 40], light: [210, 90, 120, 0.3] },
	{ anchor: ['.gm-inventory', 0.5], sky: [92, 78, 128], dark: [36, 28, 58], light: [70, 50, 140, 0.42] },
	{ anchor: ['.gm-credits', 0.2], sky: [22, 30, 60], dark: [14, 21, 48], light: [10, 20, 70, 0.55] },
];

/** 하루 색: 앞뒤 두 때 사이에서 t만큼 섞는다 */
function dayAt(index: number, t: number, dark: boolean) {
	const a = DAY[index];
	const b = DAY[Math.min(index + 1, DAY.length - 1)];
	const mix = (x: number[], y: number[]) => x.map((v, i) => v + (y[i] - v) * Math.min(Math.max(t, 0), 1));
	const sky = mix(dark ? a.dark : a.sky, dark ? b.dark : b.sky).map(Math.round);
	const light = mix(a.light, b.light);
	// 바탕이 어두우면 제목 글자를 밝게
	const luminance = (0.299 * sky[0] + 0.587 * sky[1] + 0.114 * sky[2]) / 255;
	return {
		sky: `rgb(${sky.join(' ')})`,
		ink: luminance < 0.5 ? '#f3e1bb' : '#4a3222',
		light: `rgb(${light.slice(0, 3).map(Math.round).join(' ')} / ${light[3].toFixed(3)})`,
	};
}

/** 개발 일지 주인공의 걸음 속도 (화면 px/초) */
const HERO_SPEED = 150;

/** 소 걸음: 한 칸을 보여 주는 시간과 그동안 나가는 거리 (게임보다 조금 느긋하게) */
const COW_FRAME_MS = 130;
const COW_STEP = 6;

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

	// 타이틀 화면의 앞뒤: 발끝이 더 위에 있는 것이 뒤로 간다. 발끝은 상자 아래 끝에서 그림 아래의 투명한 여백(data-foot)을 뺀 곳이다.
	// 동물은 옆으로만 걸으니 발끝 높이가 그대로다
	useEffect(() => {
		const scene = title.current;
		if (!scene) return;
		const sort = () => {
			const top = scene.getBoundingClientRect().top;
			for (const item of scene.children) {
				if (item instanceof HTMLElement)
					item.style.zIndex = String(
						Math.round(item.getBoundingClientRect().bottom - top - Number(item.dataset.foot ?? 0))
					);
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

	// 하루의 흐름: 화면 가운데가 페이지의 어디쯤인지로 바탕색과 풀밭의 빛을 정한다
	useEffect(() => {
		const page = root.current;
		if (!page) return;
		const scroller = scrollParent(page);
		const source = scroller ?? window;
		let frame = 0;
		const paint = () => {
			frame = 0;
			const view = scroller?.getBoundingClientRect();
			const center = view ? view.top + view.height / 2 : window.innerHeight / 2;
			// 때마다 그 자리가 지금 화면의 어디쯤인지
			const marks = DAY.map(({ anchor: [selector, ratio] }) => {
				const box = page.querySelector(selector)?.getBoundingClientRect();
				return box ? box.top + box.height * ratio : Number.NaN;
			});
			if (marks.some(Number.isNaN)) return;
			let index = marks.findIndex((mark) => mark > center) - 1;
			if (index < 0) index = marks[0] > center ? 0 : DAY.length - 1;
			const from = marks[index];
			const to = marks[Math.min(index + 1, marks.length - 1)];
			const t = to === from ? 0 : (center - from) / (to - from);
			const day = dayAt(index, Math.min(Math.max(t, 0), 1), document.documentElement.dataset.theme === 'dark');
			page.style.setProperty('--gm-sky', day.sky);
			page.style.setProperty('--gm-sky-ink', day.ink);
			page.style.setProperty('--gm-light', day.light);
		};
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(paint);
		};
		paint();
		source.addEventListener('scroll', onScroll, { passive: true });
		// 테마를 바꾸면 다시 칠한다
		const themed = new MutationObserver(paint);
		themed.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
		return () => {
			source.removeEventListener('scroll', onScroll);
			themed.disconnect();
			cancelAnimationFrame(frame);
		};
	}, []);

	// 소는 그림이 바뀔 때만 몸도 한 걸음(원본 2px, 화면 6px) 나간다. 매끄럽게 밀면 제자리걸음하며 미끄러지는 것처럼 보인다
	useEffect(() => {
		const cow = title.current?.querySelector<HTMLElement>('.gm-cow');
		if (!cow || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
		let x = 160;
		let frame = 0;
		const timer = window.setInterval(() => {
			const width = cow.parentElement?.clientWidth ?? 0;
			frame = 1 - frame;
			x = x > width + 100 ? 0 : x + COW_STEP;
			cow.style.backgroundPositionX = `${-frame * 96}px`;
			cow.style.transform = `translateX(${x}px)`;
		}, COW_FRAME_MS);
		return () => window.clearInterval(timer);
	}, []);

	// 스크롤하면 주인공이 흙길을 따라 걷는다: 목표는 화면 가운데 높이와 같은 길 위의 점이고,
	// 주인공은 그 점까지 일정한 걸음 속도로 길을 따라 걸어간다(스크롤에 바로 붙으면 순간이동처럼 빠르다)
	useEffect(() => {
		const box = road.current;
		const line = path.current;
		const walker = hero.current;
		if (!box || !line || !walker || typeof line.getPointAtLength !== 'function') return;
		const scroller = scrollParent(box);
		const source = scroller ?? window;
		const total = line.getTotalLength();
		const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
		let frame = 0;
		let last = 0;
		let at: number | null = null;
		// 바라보는 쪽: 시트의 줄 (0 아래·1 위·2 왼쪽·3 오른쪽). 멈추면 앞모습
		let facing = 0;

		/** 화면 가운데 높이와 같은 길 위의 거리 (길은 아래로만 내려가니 높이로 찾는다) */
		const goal = () => {
			const area = line.ownerSVGElement?.getBoundingClientRect();
			if (!area || area.height === 0) return null;
			const view = scroller?.getBoundingClientRect();
			const center = view ? view.top + view.height / 2 : window.innerHeight / 2;
			const y = Math.min(Math.max((center - area.top) / area.height, 0), 1) * stages * 100;
			let low = 0;
			let high = total;
			for (let i = 0; i < 18; i++) {
				const mid = (low + high) / 2;
				if (line.getPointAtLength(mid).y < y) low = mid;
				else high = mid;
			}
			return { length: low, unit: area.height / (stages * 100) };
		};

		const draw = (length: number) => {
			const area = line.ownerSVGElement?.getBoundingClientRect();
			if (!area) return;
			const base = box.getBoundingClientRect();
			const point = line.getPointAtLength(length);
			const x = area.left - base.left + (point.x / 100) * area.width;
			const y = area.top - base.top + (point.y / (stages * 100)) * area.height;
			walker.style.transform = `translate(${x - 72}px, ${y - 96}px)`;
			walker.style.backgroundPositionY = `${-facing * 144}px`;
		};

		const step = (time: number) => {
			frame = 0;
			const target = goal();
			if (!target) return;
			const elapsed = last ? Math.min(time - last, 50) : 16;
			last = time;
			if (at === null || still) at = target.length;
			const left = target.length - at;
			// 길 1단위가 화면에서 몇 px인지로 걸음 속도를 길 위의 거리로 바꾼다
			const reach = (HERO_SPEED * elapsed) / 1000 / target.unit;
			if (Math.abs(left) <= reach) {
				at = target.length;
				facing = 0;
				walker.dataset.walking = 'false';
				last = 0;
			} else {
				const before = line.getPointAtLength(at);
				at += Math.sign(left) * reach;
				const after = line.getPointAtLength(at);
				// 화면에서 더 많이 움직인 쪽을 바라본다 (길 단위는 가로·세로 배율이 다르다)
				const area = line.ownerSVGElement?.getBoundingClientRect();
				const dx = ((after.x - before.x) / 100) * (area?.width ?? 0);
				const dy = (after.y - before.y) * target.unit;
				if (Math.abs(dx) > Math.abs(dy)) facing = dx < 0 ? 2 : 3;
				else if (dy !== 0) facing = dy < 0 ? 1 : 0;
				walker.dataset.walking = 'true';
				frame = requestAnimationFrame(step);
			}
			draw(at);
		};
		const wake = () => {
			if (!frame) frame = requestAnimationFrame(step);
		};
		// 처음과 길 높이가 바뀔 때는 걷지 않고 바로 그 자리에 선다
		const jump = () => {
			const target = goal();
			if (!target) return;
			at = target.length;
			draw(at);
		};
		jump();
		source.addEventListener('scroll', wake, { passive: true });
		// 그림이 늦게 불러와져 길의 높이가 바뀌면 자리를 다시 잡는다
		const resized = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(jump);
		resized?.observe(box);
		return () => {
			source.removeEventListener('scroll', wake);
			resized?.disconnect();
			cancelAnimationFrame(frame);
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
				{/* 소 그림은 발 아래로 원본 8px(화면 24px)이 비어 있다 */}
				<span className="gm-walker gm-cow" aria-hidden="true" data-foot={24} />
				<span className="gm-walker gm-chick a" aria-hidden="true" />
				<span className="gm-walker gm-chick b" aria-hidden="true" />

				<div className="gm-title-body">
					<Favicon project={project} className="gm-icon" />
					<p className="gm-sign">{project.name}</p>
					<h1>
						{/* 문장마다 한 덩어리로 줄을 바꾼다 */}
						{project.tagline.split(/(?<=[.!?])\s+/).map((sentence) => (
							<React.Fragment key={sentence}>
								<span>{sentence}</span>{' '}
							</React.Fragment>
						))}
					</h1>
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
									<EmoteFace emote={QUEST_EMOTES[i % QUEST_EMOTES.length]} />
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
						<EmoteFace emote={['sunglasses', 2]} className="small" /> CLEAR
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

			{/* 엔딩 크레딧: 별이 뜬 밤 들판, 맡은 일은 점선으로 이름까지, 빌려 쓴 에셋은 나무 표지판, 맨 아래로 동물들이 지나간다 */}
			<section className="gm-credits" aria-label="맡은 일">
				<span className="gm-sky" aria-hidden="true" />
				<span className="gm-moon" aria-hidden="true" />
				<h2>
					<img src={`${SPRITES}/star.png`} alt="" aria-hidden="true" />
					CREDITS
					<img src={`${SPRITES}/star.png`} alt="" aria-hidden="true" />
				</h2>
				<p className="gm-credit-role">{project.context}</p>
				{project.period && <p className="gm-credit-role">{project.period}</p>}
				<dl className="gm-staff">
					{project.contributions.map((item) => (
						<div key={item}>
							<dt>{item}</dt>
							<dd>{PROFILE.name}</dd>
						</div>
					))}
				</dl>
				{project.credits && (
					<>
						<p className="gm-thanks">SPECIAL THANKS</p>
						<dl className="gm-asset-credits">
							{project.credits.map((credit) => (
								<div key={credit.name} className="gm-credit-card">
									<span className="gm-credit-icon" aria-hidden="true">
										{credit.role === 'FONT' ? (
											<span className="gm-glyph">가</span>
										) : (
											<img src={`${SPRITES}/fruit-tree.png`} alt="" />
										)}
									</span>
									<div>
										<dt>{credit.role}</dt>
										<dd>
											<p className="gm-asset-name">
												{credit.href ? (
													<a href={credit.href} target="_blank" rel="noreferrer">
														{credit.name}
													</a>
												) : (
													credit.name
												)}{' '}
												<span>by {credit.by}</span>
											</p>
											{credit.note && <p className="gm-asset-note">{credit.note}</p>}
										</dd>
									</div>
								</div>
							))}
						</dl>
					</>
				)}
				<p className="gm-the-end">THE END</p>
				<EmoteFace emote={['loving', 2]} className="gm-bow" />
				{/* 타이틀의 "농장에 작은 소동이 생겼어요"에 답하는 마무리 인사 */}
				<p className="gm-end">오늘도 농장은 평화로워요. 도와줘서 고마워요!</p>
				<Links project={project} className="gm-links" />
				<div className="gm-parade" aria-hidden="true">
					<span className="gm-walker gm-parade-hero" />
					<span className="gm-walker gm-chick gm-parade-chick a" />
					<span className="gm-walker gm-chick gm-parade-chick b" />
				</div>
			</section>
		</div>
	);
};

export default GamePage;
