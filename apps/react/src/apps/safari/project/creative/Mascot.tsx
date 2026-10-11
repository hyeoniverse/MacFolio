// HYEONIVERSE의 마스코트 몽이: 첫머리 자리에 서 있다가, 내려가면 화면 가장자리로 뛰어가 늘 보이고,
// 데모 곁에 가면 힌트를 건네고 데모가 알리는 일(만드는 중·끝·실패·재생)에 말풍선으로 반응한다. 누르면 하트
import React, { useEffect, useRef, useState } from 'react';
import { cssVars } from '@/shared/lib/cssVars';
import { DEMO_EVENT, type DemoKind, type DemoState } from '@/apps/safari/project/creative/demoEvent';
import { onScrollFrame, scrollParent, viewOf } from '@/apps/safari/project/scroll';

const BUNNY = '/imgs/projects/hyeoniverse/bunny';
const MOODS = ['normal', 'wave', 'star', 'happy', 'surprised', 'sleep'] as const;
type Mood = (typeof MOODS)[number];
/** 장마다 몽이의 표정: 들어가기 전엔 그냥, 장마다 손 흔들기·별·웃음·놀람을 돌아가며, 끝에선 잔다 */
const READING: Mood[] = ['wave', 'star', 'happy', 'surprised'];
const moodOf = (chapter: number, total: number): Mood =>
	chapter < 0 ? 'normal' : chapter >= total ? 'sleep' : READING[chapter % READING.length];

/** 몽이가 데모 곁에 갔을 때 건네는 말 */
const HINTS: Record<DemoKind, string> = {
	slides: '음성과 함께 넘겨 보세요',
	voice: '글을 고치고 진짜로 읽혀 보세요',
	wave: '파형을 끌어 골라 잘라 보세요',
	convert: 'PPTX와 PDF를 바꿔 보세요',
	translate: 'EN을 누르면 진짜로 번역해요',
	summary: '발행하면 진짜로 요약해요',
	cover: '제목을 넣고 그려 보세요',
	autosave: '글을 고치고 3초 기다려 보세요',
	lifecycle: '단추로 글의 일생을 넘겨 보세요',
	comments: '반응을 누르고 지워 보세요',
	mailbox: '메일을 눌러 열어 보세요',
	invite: '누가 들어올 수 있는지 골라 보세요',
	roles: '역할을 바꿔 동작을 눌러 보세요',
	kitchen: '이모지 두 개를 골라 섞어 보세요',
	providers: '공급자를 실패시켜 보고 요청을 보내 보세요',
};
/** 데모가 돌 때 몽이의 반응: 만드는 중엔 기다리고, 끝나면 반짝, 실패하면 놀란다 */
const REACTIONS: Record<DemoState, { mood: Mood; text: (kind: DemoKind) => string }> = {
	busy: { mood: 'normal', text: (kind) => (kind === 'cover' ? '그리는 중… 조금 걸려요' : '만드는 중… 잠깐만요') },
	done: { mood: 'star', text: (kind) => (kind === 'voice' ? '됐어요! 들어 보세요' : '됐어요!') },
	error: { mood: 'surprised', text: () => '앗, 안 됐어요. 아래 이유를 보세요' },
	play: { mood: 'happy', text: () => '편집한 순서대로 들려요' },
};
/** 말을 건네는 시간 (ms) */
const HINT_MS = 4000;
/** 몽이 그림 크기 (px): 몸 폭 140, 높이 124. 내용 옆 여백이 좁으면 줄인다 */
const BUDDY_W = 140;
const BUDDY_H = 124;
/** 데모 곁에 설 때 몸의 이만큼은 내용 칸 위에 걸친다 (나머지는 옆 여백에) */
const OVERLAP = 0.3;
/** 데모가 있는 칸 (데모 조각이 만든다: CreativeChapters.tsx) */
const DEMO_SPOTS = '.cr-point-demo[data-demo], .cr-showcase-live[data-demo]';

interface MascotProps {
	/** 페이지 뿌리 (몽이의 가로 자리 기준이자, 말풍선이 바뀌면 다시 재는 스크롤 칸을 찾는 곳) */
	page: React.RefObject<HTMLElement | null>;
	/** 데모를 찾는 본문 */
	body: React.RefObject<HTMLElement | null>;
	/** 첫머리에서 몽이가 서는 자리 */
	seat: React.RefObject<HTMLElement | null>;
	/** 지금 읽는 장 (-1은 들어가기 전, total은 맺음말) */
	chapter: number;
	total: number;
}

/**
 * 자리는 스크롤 프레임마다 정한다: 첫머리 자리가 보이면 거기 붙어 함께 스크롤되고, 지나가면 화면에 가장 크게 보이는
 * 데모 곁(내용 칸 오른쪽 가장자리, 데모 머리 높이)에 선다. 보이는 데모가 없으면 오른쪽 아래에서 쉰다.
 * 자리를 바꿀 때만(data-moving) 통통 튀며 건너가고, 같은 자리에 있는 동안은 데모와 함께 움직인다
 */
export const Mascot: React.FC<MascotProps> = ({ page, body, seat, chapter, total }) => {
	const figure = useRef<HTMLElement>(null);
	const [petted, setPetted] = useState(false);
	const [hearts, setHearts] = useState<{ id: number; dx: number }[]>([]);
	const heartId = useRef(0);
	// 곁에 있는 데모, 막 건넨 말, 데모가 돌 때의 반응
	const [guide, setGuide] = useState<DemoKind | null>(null);
	const [hint, setHint] = useState<DemoKind | null>(null);
	const [reaction, setReaction] = useState<{ mood: Mood; text: string } | null>(null);
	const standing = useRef<string | null>(null);

	useEffect(() => {
		if (!hint) return;
		const timer = window.setTimeout(() => setHint(null), HINT_MS);
		return () => window.clearTimeout(timer);
	}, [hint]);

	// 데모가 알리는 일에 반응한다. 만드는 중은 끝날 때까지 이어진다
	useEffect(() => {
		let timer = 0;
		const onDemo = (event: Event) => {
			const { kind, state } = (event as CustomEvent<{ kind: DemoKind; state: DemoState }>).detail;
			window.clearTimeout(timer);
			setHint(null);
			setReaction({ mood: REACTIONS[state].mood, text: REACTIONS[state].text(kind) });
			if (state !== 'busy') timer = window.setTimeout(() => setReaction(null), HINT_MS);
		};
		window.addEventListener(DEMO_EVENT, onDemo);
		return () => {
			window.removeEventListener(DEMO_EVENT, onDemo);
			window.clearTimeout(timer);
		};
	}, []);

	// 자리 잡기
	useEffect(() => {
		const root = page.current;
		const main = body.current;
		if (!root || !main) return;
		let settle = 0;
		const stop = onScrollFrame(main, (scroller) => {
			const node = figure.current;
			const spot = seat.current?.getBoundingClientRect();
			if (!node || !spot) return;
			const view = viewOf(scroller);
			const frame = root.getBoundingClientRect();
			const width = frame.width;
			const narrow = width <= 760;
			// 화면에 보이는 높이가 가장 큰 데모 (화면의 3분의 1 이상 보이거나 데모가 통째로 보일 때)
			let target: HTMLElement | null = null;
			let best = 0;
			main.querySelectorAll<HTMLElement>(DEMO_SPOTS).forEach((demo) => {
				const box = demo.getBoundingClientRect();
				const shown = Math.min(box.bottom, view.top + view.height) - Math.max(box.top, view.top);
				if (shown > best && (shown > view.height / 3 || shown >= box.height - 1)) {
					best = shown;
					target = demo;
				}
			});
			let key: string;
			let x: number;
			let y: number;
			let scale = 1;
			if (spot.bottom > view.top + 40) {
				key = 'hero';
				x = spot.left - frame.left + (spot.width - BUDDY_W) / 2;
				y = spot.top - view.top;
			} else if (target) {
				const box = (target as HTMLElement).getBoundingClientRect();
				key = `demo:${(target as HTMLElement).dataset.demo}`;
				// 데모 칸 오른쪽 옆 여백에 맞춰 크기를 정하고, 칸 가장자리에 걸쳐 선다. 데모 글을 가리지 않게
				const side = frame.right - box.right;
				scale = narrow ? 0.5 : Math.min(1, Math.max(0.6, (side + BUDDY_W * OVERLAP - 12) / BUDDY_W));
				const w = BUDDY_W * scale;
				const h = BUDDY_H * scale;
				x = Math.min(box.right - frame.left - w * OVERLAP, width - w - 6);
				// 머리 위 말풍선이 화면 위로 잘리지 않게, 말풍선 높이만큼은 아래에 선다
				const talk = (node.querySelector('.cr-bubble') as HTMLElement | null)?.offsetHeight ?? 0;
				y = Math.min(Math.max(box.top - view.top - h * 0.2, 8 + talk * scale), view.height - h - 8);
			} else {
				key = 'rest';
				scale = narrow ? 0.5 : 0.8;
				x = width - BUDDY_W * scale - (narrow ? 6 : 20);
				y = view.height - BUDDY_H * scale - 16;
			}
			if (key !== standing.current) {
				standing.current = key;
				node.dataset.moving = '';
				window.clearTimeout(settle);
				settle = window.setTimeout(() => delete node.dataset.moving, 900);
				const kind = key.startsWith('demo:') ? (key.slice(5) as DemoKind) : null;
				setGuide(kind);
				setHint(kind);
			}
			node.dataset.spot = key === 'hero' ? 'hero' : key === 'rest' ? 'rest' : 'demo';
			node.style.setProperty('--x', `${Math.round(x)}px`);
			node.style.setProperty('--y', `${Math.round(y)}px`);
			node.style.setProperty('--s', scale.toFixed(3));
			// 말풍선 오른쪽 끝은 몸의 70% 자리. 그 왼쪽으로 화면 끝까지 남은 폭 (몸 크기로 나눠 그대로 쓴다)
			node.style.setProperty('--room', `${Math.round(Math.min(320, x + BUDDY_W * 0.7 * scale - 12) / scale)}px`);
		});
		return () => {
			stop();
			window.clearTimeout(settle);
		};
	}, [page, body, seat]);

	const mood: Mood = petted ? 'happy' : (reaction?.mood ?? (guide ? 'wave' : moodOf(chapter, total)));
	const bubble = reaction?.text ?? (hint ? HINTS[hint] : null);
	// 말풍선 글이 바뀌면 키가 달라질 수 있어, 자리를 한 번 다시 잰다
	useEffect(() => {
		const node = page.current;
		if (node) (scrollParent(node) ?? window).dispatchEvent(new Event('scroll'));
	}, [bubble, page]);

	const pet = () => {
		const burst = Array.from({ length: 6 }, (_, i) => ({ id: (heartId.current += 1), dx: (i - 2.5) * 22 }));
		setHearts((now) => [...now, ...burst]);
		window.setTimeout(() => setHearts((now) => now.filter((heart) => !burst.includes(heart))), 1100);
	};

	return (
		// 스크롤하는 칸 맨 위에 붙은 높이 0인 층 위에 떠서, 스크립트가 정한 자리(--x, --y)로 옮겨 다닌다
		<div className="cr-buddy">
			<figure
				ref={figure}
				className="cr-mascot"
				data-mood={mood}
				data-spot="hero"
				data-petted={petted || undefined}
				data-hop={hearts.length > 0 || undefined}
				onPointerEnter={() => setPetted(true)}
				onPointerLeave={() => setPetted(false)}
				onClick={pet}
			>
				{MOODS.map((name) => (
					<img key={name} src={`${BUNNY}/${name}-front.webp`} alt="" data-on={name === mood} />
				))}
				{bubble && (
					<span className="cr-bubble" key={bubble} role="status">
						{bubble}
					</span>
				)}
				{hearts.map((heart) => (
					<i key={heart.id} className="cr-heart fa-solid fa-heart" style={cssVars({ dx: heart.dx })} />
				))}
			</figure>
		</div>
	);
};
