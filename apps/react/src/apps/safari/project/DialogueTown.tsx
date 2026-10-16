// RPG 대화창(DialoguePage)의 마을 화면: 마을 그림(dialogueVillage.ts, Ninja Adventure 타일)을 캔버스에 칠하고, 그 위에서 주인공이 칸 단위로 걷는다.
// 방향 키·WASD로 한 칸씩(16칸을 네 프레임 걸음으로 부드럽게, 움직임 줄이기면 바로), 화면을 누르면 너비 우선 탐색으로 찾은 길로 걸어가고,
// 장소를 누르면 그 옆까지 걸어가 바로 살펴본다. Z·Enter·Space는 바로 앞 장소를 살펴본다(DialoguePage가 그 주제를 연다).
// 땅과 집은 바뀔 때만 다시 칠하고(낮·밤 두 장), 팀원·안내인·음유시인·몬스터는 그림 칸 하나씩(가끔 고개를 돌리고, 몬스터는 꿈틀댄다),
// 주인공은 걷는 동안에만 requestAnimationFrame으로 옮긴다(멈추면 쉰다). 나무 한 그루의 윗가지는 주인공 위 판에 칠해 그 뒤를 지나가게 한다.
// 그림이라 읽기 프로그램에는 숨기고, 지금 앞에 무엇이 있는지는 DialoguePage의 알림 줄과 바로 가기 메뉴가 대신한다
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
	characterFrame,
	characterOf,
	drawOf,
	GROUND,
	ITEMS,
	loadSheets,
	monsterFrame,
	nightOver,
	nightTint,
	NIGHT_RGB,
	paintDraws,
	sheetUrl,
	TILE,
	type CharacterName,
	type Draw,
	type SheetKey,
} from '@/apps/safari/project/dialogueNinja';
import {
	cameraOf,
	facingPlace,
	facingTo,
	findPath,
	pathToPlace,
	placeAt,
	SLOTS,
	STEPS,
	tileOfPoint,
	walkable,
	WORLD_PX_H,
	WORLD_PX_W,
	type Facing,
	type Place,
	type Tile,
	type WorldLayout,
} from '@/apps/safari/project/dialogueWorld';
import { composeVillage, markPoint, VILLAGE_MARGIN } from '@/apps/safari/project/dialogueVillage';
import { Pixels } from '@/apps/safari/project/DialoguePixels';
import { prefersReducedMotion } from '@/apps/safari/project/reveal';
import '@/apps/safari/project/DialogueTown.css';

/** 한 칸을 걷는 시간(ms): 앞 반은 발을 내딛고 뒤 반은 선다 (두 걸음에 서기·왼발·서기·오른발 네 프레임) */
const STEP_MS = 180;

/** 걸음 프레임: 서기, 왼발, 오른발 (사람 그림의 걸음 줄 0·1·3) */
export type WalkFrame = 'stand' | 'a' | 'b';
const FRAME_ROW: Record<WalkFrame, number> = { stand: 0, a: 1, b: 3 };

/** 주인공 그림과 그 캔버스 높이 (16칸 그림 아래에 그림자 두 줄) */
export const HERO: CharacterName = 'boy';
const HERO_H = 18;
/** 안내인(쓰는 법)과 음유시인(크레딧) */
const TUTOR: CharacterName = 'oldman';
const BARD: CharacterName = 'monk';

export interface PlayerSpot {
	x: number;
	y: number;
	facing: Facing;
}

/** 마을 캔버스의 크기: 지도와 둘레 숲 여백 */
const CANVAS_W = WORLD_PX_W + 2 * VILLAGE_MARGIN;
const CANVAS_H = WORLD_PX_H + 2 * VILLAGE_MARGIN;

/** 칠할 것들의 그림을 받아 캔버스에 칠한다 (밤이면 밤 색을 곱한다). 다 칠하면 done */
function usePainted(
	ref: React.RefObject<HTMLCanvasElement | null>,
	draws: readonly Draw[],
	night: boolean,
	after?: (ctx: CanvasRenderingContext2D) => void
) {
	useEffect(() => {
		const canvas = ref.current;
		const ctx = canvas?.getContext('2d');
		if (!canvas || !ctx) return;
		let alive = true;
		void loadSheets(draws.filter((d) => !d.fill).map((d) => d.sheet)).then((sheets) => {
			if (!alive) return;
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			// 칠할 것의 자리는 지도 기준: 둘레 숲 여백만큼 밀어 칠한다
			ctx.translate(VILLAGE_MARGIN, VILLAGE_MARGIN);
			paintDraws(ctx, draws, sheets);
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			if (after) after(ctx);
			else if (night) nightTint(ctx, canvas.width, canvas.height);
			canvas.dataset.painted = '';
		});
		return () => {
			alive = false;
		};
	}, [ref, draws, night, after]);
}

/** 마을 판 (낮·밤 두 장 중 테마에 맞는 한 장): 땅과 세운 것, 그리고 사람 위에 덮는 윗가지 판 */
const VillageCanvas: React.FC<{ active: ReadonlySet<string>; gateOpen: boolean; night: boolean }> = ({
	active,
	gateOpen,
	night,
}) => {
	const ref = useRef<HTMLCanvasElement>(null);
	const art = useMemo(() => composeVillage(SLOTS, active, gateOpen), [active, gateOpen]);
	const lightUp = useMemo(
		() =>
			night
				? (ctx: CanvasRenderingContext2D) =>
						nightOver(
							ctx,
							CANVAS_W,
							CANVAS_H,
							art.lights.map((l) => ({ ...l, x: l.x + VILLAGE_MARGIN, y: l.y + VILLAGE_MARGIN }))
						)
				: undefined,
		[night, art]
	);
	usePainted(ref, art.draws, night, lightUp);
	return (
		<canvas
			ref={ref}
			className="dl-village"
			data-night={night || undefined}
			width={CANVAS_W}
			height={CANVAS_H}
			style={{ left: -VILLAGE_MARGIN, top: -VILLAGE_MARGIN }}
		/>
	);
};

const OverheadCanvas: React.FC<{ active: ReadonlySet<string>; gateOpen: boolean; night: boolean }> = ({
	active,
	gateOpen,
	night,
}) => {
	const ref = useRef<HTMLCanvasElement>(null);
	const art = useMemo(() => composeVillage(SLOTS, active, gateOpen), [active, gateOpen]);
	usePainted(ref, art.overhead, night);
	return (
		<canvas
			ref={ref}
			className="dl-village dl-overhead"
			data-night={night || undefined}
			width={CANVAS_W}
			height={CANVAS_H}
			style={{ left: -VILLAGE_MARGIN, top: -VILLAGE_MARGIN }}
		/>
	);
};

/** 그림 칸 하나를 배경으로 (사람·몬스터): 칸 자리(왼쪽 위)와 그림 파일 */
const spriteStyle = (sheet: SheetKey, x: number, y: number): React.CSSProperties => ({
	left: x,
	top: y,
	backgroundImage: `url(${sheetUrl(sheet)})`,
});

/** 마을에 선 사람 하나: 발밑 그림자, 16×16 그림 칸 (보는 방향의 열, 가끔 고개를 돌린다) */
const Villager: React.FC<{ name: CharacterName; x: number; y: number; facing: Facing; seed: number }> = ({
	name,
	x,
	y,
	facing,
	seed,
}) => {
	const frame = characterFrame(name, facing);
	return (
		<span
			className="dl-actor"
			data-kind="person"
			style={{ left: x * TILE, top: y * TILE - 3, ['--dl-delay' as string]: `${-((seed * 1.7) % 6)}s` }}
		>
			<i className="dl-actor-shadow" style={{ backgroundImage: `url(${sheetUrl('shadow')})` }} />
			<i
				className="dl-actor-body"
				data-facing={facing}
				style={{ ...spriteStyle(frame.sheet, 0, 0), ['--dl-face' as string]: `${-frame.x}px` }}
			/>
		</span>
	);
};

/** 긴 풀숲의 몬스터: 꿈틀대는 네 칸, 발은 풀에 묻힌다 */
const Monster: React.FC<{ x: number; y: number }> = ({ x, y }) => {
	const frame = monsterFrame('spider');
	return (
		<span className="dl-actor" data-kind="monster" style={{ left: x * TILE, top: y * TILE - 3 }}>
			<i className="dl-actor-shadow" style={{ backgroundImage: `url(${sheetUrl('shadow')})` }} />
			<i className="dl-actor-body" style={spriteStyle(frame.sheet, 0, 0)} />
			<i
				className="dl-actor-grass"
				style={{
					backgroundImage: `url(${sheetUrl(GROUND.tallGrass.sheet)})`,
					backgroundPosition: `${-GROUND.tallGrass.x}px ${-GROUND.tallGrass.y - 7}px`,
				}}
			/>
		</span>
	);
};

/** 사람 그림을 밤 색으로 (마을 판과 같은 곱셈): SVG 색 행렬 */
const NightFilter: React.FC = () => {
	const [r, g, b] = NIGHT_RGB.map((v) => (v / 255).toFixed(3));
	return (
		<svg className="dl-filters" width="0" height="0" aria-hidden="true" focusable="false">
			<filter id="dl-night" colorInterpolationFilters="sRGB">
				<feColorMatrix type="matrix" values={`${r} 0 0 0 0  0 ${g} 0 0 0  0 0 ${b} 0 0  0 0 0 1 0`} />
			</filter>
		</svg>
	);
};

/** 장소 위의 표: 아직 안 읽은 곳은 '!' 말풍선(그림 묶음의 것), 읽은 곳은 작은 ✓ (그림 묶음에 없어 칸 그림으로) */
const MARK_READ = [
	'.kkkkkkkk.',
	'kGGGGGGGGk',
	'kGGGGGGWGk',
	'kGGGGGWWGk',
	'kGWGGWWGGk',
	'kGWWWWGGGk',
	'kGGWWGGGGk',
	'kGGGGGGGGk',
	'.kkkkkkkk.',
];
const MARK_COLORS = { k: '#202028', W: '#ffffff', G: '#3ca85c' };

interface Props {
	layout: WorldLayout;
	/** 읽은 주제 */
	read: ReadonlySet<string>;
	/** 북쪽 문이 열렸는지 (모든 주제를 읽었다) */
	gateOpen: boolean;
	player: PlayerSpot;
	/** 한 칸을 다 걷거나 방향을 바꿀 때마다 (DialoguePage가 앞의 장소를 알린다) */
	onMove: (spot: PlayerSpot) => void;
	/** 장소를 살펴본다 */
	onInteract: (place: Place) => void;
	/** 화면 크기 (게임 칸) */
	viewW: number;
	viewH: number;
	/** 걸을 수 있는지 (타이틀에서는 마을만 보인다) */
	walking: boolean;
	/** 카메라를 고정할 곳 (타이틀: 광장 가운데, 게임 칸). 없으면 주인공을 따라간다 */
	camera?: { x: number; y: number };
	/**
	 * 화면 위·아래 띠의 높이(게임 칸): 창(길잡이, 키 안내)이 덮는 띠. 카메라는 지도 끝에서 이만큼 더 넘어가
	 * 지도 끝의 장소(북쪽 문 등)가 창에 가리지 않는다
	 */
	band?: number;
}

/** 키 → 걷는 방향 */
const KEY_DIRS: Record<string, Facing> = {
	ArrowUp: 'up',
	ArrowDown: 'down',
	ArrowLeft: 'left',
	ArrowRight: 'right',
	w: 'up',
	s: 'down',
	a: 'left',
	d: 'right',
};

/** 걷기를 맡는 것 (React 밖의 상태): 칸 자리(도착할 칸), 그림 자리(px), 방향, 걸음 프레임, 남은 길, 누르고 있는 방향 키 */
class Walker {
	x: number;
	y: number;
	facing: Facing;
	px: number;
	py: number;
	frame: WalkFrame = 'stand';
	drawn = '';
	steps = 0;
	moving = false;
	from = { x: 0, y: 0 };
	start = 0;
	path: Tile[] = [];
	after: (() => void) | undefined;
	held: Facing[] = [];
	raf = 0;
	hero: HTMLCanvasElement | null = null;
	/** 주인공 그림 (받은 뒤에 칠한다) */
	sheets: ReadonlyMap<SheetKey, HTMLImageElement> | null = null;
	map: HTMLDivElement | null = null;
	layout: WorldLayout | null = null;
	viewW = 0;
	viewH = 0;
	fixed: { x: number; y: number } | undefined;
	band = 0;
	onMove: (spot: PlayerSpot) => void = () => undefined;
	onInteract: (place: Place) => void = () => undefined;

	constructor(spot: PlayerSpot) {
		this.x = spot.x;
		this.y = spot.y;
		this.facing = spot.facing;
		this.px = spot.x * TILE;
		this.py = spot.y * TILE;
	}

	/** DialoguePage가 가진 자리로 (걷는 중이 아닐 때만) */
	place(spot: PlayerSpot) {
		if (this.moving || (this.x === spot.x && this.y === spot.y && this.facing === spot.facing)) return;
		this.x = spot.x;
		this.y = spot.y;
		this.facing = spot.facing;
		this.px = spot.x * TILE;
		this.py = spot.y * TILE;
	}

	/** 카메라: 타이틀은 정한 곳, 걸을 때는 주인공을 따라간다 */
	camera() {
		return this.fixed
			? cameraOf(this.fixed.x - TILE / 2, this.fixed.y - TILE / 2, this.viewW, this.viewH)
			: cameraOf(this.px, this.py, this.viewW, this.viewH, this.band);
	}

	/** 주인공 그림(방향·프레임이 바뀔 때만 다시 칠한다)과 카메라를 지금 자리로 (정수 칸만) */
	paint() {
		const hero = this.hero;
		if (hero) {
			const key = `${this.facing}:${this.frame}`;
			const ctx = hero.getContext('2d');
			if (key !== this.drawn && ctx && this.sheets) {
				ctx.imageSmoothingEnabled = false;
				ctx.clearRect(0, 0, hero.width, hero.height);
				paintDraws(
					ctx,
					[
						drawOf(ITEMS.shadow, 2, HERO_H - ITEMS.shadow.h),
						drawOf(characterFrame(HERO, this.facing, FRAME_ROW[this.frame]), 0, 0),
					],
					this.sheets
				);
				this.drawn = key;
			}
			hero.style.transform = `translate(${this.px}px, ${this.py - 3}px)`;
		}
		const cam = this.camera();
		if (this.map) this.map.style.transform = `translate(${-cam.x}px, ${-cam.y}px)`;
	}

	/** 한 칸을 다 걸었거나 방향을 바꿨다: 칸 자리를 적고 알린다 */
	commit() {
		const hero = this.hero;
		if (hero) {
			hero.dataset.x = String(this.x);
			hero.dataset.y = String(this.y);
			hero.dataset.facing = this.facing;
			if (this.moving) hero.dataset.moving = '';
			else delete hero.dataset.moving;
		}
		this.onMove({ x: this.x, y: this.y, facing: this.facing });
	}

	/** 다음에 걸을 방향: 남은 길, 없으면 누르고 있는 마지막 방향 키 */
	nextMove(): Facing | undefined {
		const tile = this.path.shift();
		if (tile) return facingTo(this, tile);
		return this.held.at(-1);
	}

	/** 한 칸을 걷기 시작한다 (막혔으면 그쪽을 보기만). 움직임 줄이기면 바로 옮긴다 */
	step(dir: Facing): boolean {
		this.facing = dir;
		const [dx, dy] = STEPS[dir];
		const nx = this.x + dx;
		const ny = this.y + dy;
		if (!this.layout || !walkable(this.layout, nx, ny)) {
			this.frame = 'stand';
			this.path = [];
			this.after = undefined;
			this.paint();
			this.commit();
			return false;
		}
		if (prefersReducedMotion()) {
			this.x = nx;
			this.y = ny;
			this.px = nx * TILE;
			this.py = ny * TILE;
			this.frame = 'stand';
			this.paint();
			this.commit();
			return true;
		}
		this.from = { x: this.px, y: this.py };
		this.x = nx;
		this.y = ny;
		this.steps += 1;
		this.start = performance.now();
		this.moving = true;
		this.hero?.setAttribute('data-moving', '');
		this.raf = requestAnimationFrame(this.tick);
		return true;
	}

	/** 프레임마다: 앞 반은 발을 내딛고(왼발·오른발 번갈아) 뒤 반은 선다. 다 걸으면 다음 칸, 없으면 멈추고 쉰다 */
	tick = (now: number) => {
		const t = Math.min(1, (now - this.start) / STEP_MS);
		this.px = Math.round(this.from.x + (this.x * TILE - this.from.x) * t);
		this.py = Math.round(this.from.y + (this.y * TILE - this.from.y) * t);
		this.frame = t < 0.5 ? (this.steps % 2 === 1 ? 'a' : 'b') : 'stand';
		this.paint();
		if (t < 1) {
			this.raf = requestAnimationFrame(this.tick);
			return;
		}
		this.moving = false;
		this.raf = 0;
		this.commit();
		const dir = this.nextMove();
		if (dir && this.step(dir)) return;
		const after = this.after;
		this.after = undefined;
		after?.();
	};

	/** 길을 따라 걷고, 다 걸으면 facing을 보고 then (움직임 줄이기면 끝 칸으로 바로) */
	walkPath(path: Tile[], facing: Facing | undefined, then?: () => void) {
		this.held = [];
		const end = () => {
			if (facing) {
				this.facing = facing;
				this.paint();
				this.commit();
			}
			then?.();
		};
		if (path.length === 0) {
			end();
			return;
		}
		if (prefersReducedMotion()) {
			const last = path[path.length - 1];
			const before = path[path.length - 2] ?? this;
			this.x = last.x;
			this.y = last.y;
			this.px = last.x * TILE;
			this.py = last.y * TILE;
			this.facing = facingTo(before, last) ?? this.facing;
			this.paint();
			this.commit();
			end();
			return;
		}
		this.path = [...path];
		this.after = end;
		if (!this.moving) {
			const dir = this.nextMove();
			if (dir) this.step(dir);
		}
	}

	/** 방향 키를 눌렀다: 남은 길은 버리고 그쪽으로 (걷는 중이면 다 걸은 뒤 이어 걷는다) */
	press(dir: Facing) {
		this.path = [];
		this.after = undefined;
		this.held = [...this.held.filter((d) => d !== dir), dir];
		if (!this.moving) this.step(dir);
	}

	release(dir?: Facing) {
		this.held = dir ? this.held.filter((d) => d !== dir) : [];
	}

	/** 그만 걷는다 (화면을 떠날 때) */
	stop() {
		if (this.raf) cancelAnimationFrame(this.raf);
		this.raf = 0;
		this.moving = false;
		this.path = [];
		this.after = undefined;
		this.held = [];
	}
}

const DialogueTown: React.FC<Props> = ({
	layout,
	read,
	gateOpen,
	player,
	onMove,
	onInteract,
	viewW,
	viewH,
	walking,
	camera: fixedCamera,
	band = 0,
}) => {
	const viewRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<HTMLDivElement>(null);
	const heroRef = useRef<HTMLCanvasElement>(null);
	const walkerRef = useRef<Walker | null>(null);
	const active = useMemo(() => new Set(layout.places.map((p) => p.key)), [layout]);
	// 주인공 그림: 받으면 걷는 것에 넘기고 다시 칠한다
	const [heroSheets, setHeroSheets] = useState<ReadonlyMap<SheetKey, HTMLImageElement> | null>(null);
	useEffect(() => {
		let alive = true;
		void loadSheets([`char:${HERO}`, 'shadow']).then((sheets) => {
			if (alive) setHeroSheets(sheets);
		});
		return () => {
			alive = false;
		};
	}, []);

	// 걷기를 맡는 것을 만들고(처음 한 번), 지금 지도·화면 크기·알림 함수를 넘긴 뒤 DialoguePage가 가진 자리에 세운다
	useEffect(() => {
		const walker = (walkerRef.current ??= new Walker(player));
		walker.hero = heroRef.current;
		walker.map = mapRef.current;
		walker.layout = layout;
		walker.viewW = viewW;
		walker.viewH = viewH;
		walker.fixed = fixedCamera;
		walker.band = band;
		walker.onMove = onMove;
		walker.onInteract = onInteract;
		if (heroSheets && walker.sheets !== heroSheets) {
			walker.sheets = heroSheets;
			walker.drawn = '';
		}
		walker.place(player);
		walker.paint();
		const hero = heroRef.current;
		if (hero && !walker.moving) {
			hero.dataset.x = String(walker.x);
			hero.dataset.y = String(walker.y);
			hero.dataset.facing = walker.facing;
		}
	}, [player, layout, viewW, viewH, fixedCamera, band, onMove, onInteract, heroSheets]);

	// 화면을 떠나면 걷기를 멈춘다
	useEffect(() => () => walkerRef.current?.stop(), []);

	// 키보드: 방향 키·WASD로 걷고(누르고 있으면 이어 걷는다), Z·Enter·Space로 앞의 장소를 살펴본다. 글 상자·다른 창의 키는 받지 않는다
	useEffect(() => {
		if (!walking) return;
		const root = viewRef.current?.closest('.dl');
		const accepts = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return false;
			if (target && target !== document.body && !root?.contains(target)) return false;
			return !(event.metaKey || event.ctrlKey || event.altKey);
		};
		const keyOf = (event: KeyboardEvent) => (event.key.length === 1 ? event.key.toLowerCase() : event.key);
		const onDown = (event: KeyboardEvent) => {
			const walker = walkerRef.current;
			if (!walker || !accepts(event)) return;
			const key = keyOf(event);
			const dir = KEY_DIRS[key];
			if (dir) {
				event.preventDefault();
				// 누르고 있는 동안의 되풀이는 움직임 줄이기에서만 한 칸씩 (아니면 다 걸은 뒤 이어 걷는다)
				if (event.repeat && !prefersReducedMotion()) return;
				walker.press(dir);
				return;
			}
			if (key === 'z' || key === 'Enter' || key === ' ') {
				const target = event.target as HTMLElement | null;
				// 단추(바로 가기, 살펴보기 안내)에 포커스가 있으면 Enter·Space는 그 단추가 받는다
				if (key !== 'z' && target?.closest('button, a')) return;
				event.preventDefault();
				if (walker.moving || event.repeat || !walker.layout) return;
				const place = facingPlace(walker.layout, walker.x, walker.y, walker.facing);
				if (place) walker.onInteract(place);
			}
		};
		const onUp = (event: KeyboardEvent) => {
			const dir = KEY_DIRS[keyOf(event)];
			if (dir) walkerRef.current?.release(dir);
		};
		const onBlur = () => walkerRef.current?.release();
		window.addEventListener('keydown', onDown);
		window.addEventListener('keyup', onUp);
		window.addEventListener('blur', onBlur);
		return () => {
			window.removeEventListener('keydown', onDown);
			window.removeEventListener('keyup', onUp);
			window.removeEventListener('blur', onBlur);
			walkerRef.current?.release();
		};
	}, [walking]);

	/** 누른 칸으로 걸어간다. 장소를 누르면 그 옆까지 가서 살펴본다 */
	const onClick = (event: React.MouseEvent<HTMLDivElement>) => {
		const walker = walkerRef.current;
		const view = viewRef.current;
		if (!walking || !walker || !view) return;
		const rect = view.getBoundingClientRect();
		const scale = rect.width / viewW || 1;
		const tile = tileOfPoint((event.clientX - rect.left) / scale, (event.clientY - rect.top) / scale, walker.camera());
		const from = { x: walker.x, y: walker.y };
		const place = placeAt(layout, tile.x, tile.y);
		if (place) {
			const route = pathToPlace(layout, from, place);
			if (route) walker.walkPath(route.path, route.facing, () => walker.onInteract(place));
			return;
		}
		const path = findPath(layout, from, [tile]);
		if (path) walker.walkPath(path, undefined);
	};

	// 주제마다 표 하나 (첫 장소에): 북쪽 문은 열렸을 때만 '!'
	const marks = useMemo(() => {
		const seen = new Set<string>();
		return layout.places.filter((place) => {
			if (place.kind === 'gate') return gateOpen;
			if (seen.has(place.topic)) return false;
			seen.add(place.topic);
			return true;
		});
	}, [layout, gateOpen]);

	// 마을에 선 사람과 몬스터 (팀원은 이름마다 같은 사람)
	const actors = layout.places.flatMap((place, i) => {
		if (place.kind === 'member')
			return [
				<Villager key={place.key} name={characterOf(place.label)} x={place.x} y={place.y} facing="down" seed={i} />,
			];
		if (place.kind === 'tutor')
			return [<Villager key={place.key} name={TUTOR} x={place.x} y={place.y} facing="right" seed={i} />];
		if (place.kind === 'bard')
			return [<Villager key={place.key} name={BARD} x={place.x} y={place.y} facing="down" seed={i} />];
		if (place.kind === 'monster') return [<Monster key={place.key} x={place.x} y={place.y} />];
		return [];
	});

	return (
		<div className="dl-world" ref={viewRef} onClick={onClick} aria-hidden="true" data-walking={walking || undefined}>
			<NightFilter />
			<div className="dl-world-map" ref={mapRef} style={{ width: WORLD_PX_W, height: WORLD_PX_H }}>
				<VillageCanvas active={active} gateOpen={gateOpen} night={false} />
				<VillageCanvas active={active} gateOpen={gateOpen} night />
				{actors}
				<canvas
					ref={heroRef}
					className="dl-hero"
					width={TILE}
					height={HERO_H}
					data-x={player.x}
					data-y={player.y}
					data-facing={player.facing}
					hidden={!walking}
				/>
				<OverheadCanvas active={active} gateOpen={gateOpen} night={false} />
				<OverheadCanvas active={active} gateOpen={gateOpen} night />
				{marks.map((place) => {
					const done = place.kind !== 'gate' && read.has(place.topic);
					const point = markPoint(place);
					return (
						<span
							key={place.key}
							className="dl-mark"
							data-place={place.key}
							data-state={done ? 'read' : 'new'}
							style={done ? { left: point.x - 5, top: point.y - 9 } : { left: point.x - 7, top: point.y - 13 }}
						>
							{done ? (
								<Pixels rows={MARK_READ} colors={MARK_COLORS} scale={1} className="dl-mark-icon" />
							) : (
								<i className="dl-mark-alert" style={{ backgroundImage: `url(${sheetUrl('alert')})` }} />
							)}
						</span>
					);
				})}
			</div>
		</div>
	);
};

export default DialogueTown;
