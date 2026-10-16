// RPG 대화창(DialoguePage)의 마을 화면: 마을 판(dialogueVillage.ts)을 캔버스에 한 번 칠하고, 그 위에서 주인공이 칸 단위로 걷는다.
// 방향 키·WASD로 한 칸씩(16칸을 네 프레임 걸음으로 부드럽게, 움직임 줄이기면 바로), 화면을 누르면 너비 우선 탐색으로 찾은 길로 걸어가고,
// 장소를 누르면 그 옆까지 걸어가 바로 살펴본다. Z·Enter·Space는 바로 앞 장소를 살펴본다(DialoguePage가 그 주제를 연다).
// 지도와 사람 판은 바뀔 때만 다시 칠하고, 걷는 동안에만 requestAnimationFrame으로 주인공과 카메라를 옮긴다(멈추면 쉰다).
// 그림이라 읽기 프로그램에는 숨기고, 지금 앞에 무엇이 있는지는 DialoguePage의 알림 줄과 바로 가기 메뉴가 대신한다
import React, { useEffect, useMemo, useRef } from 'react';
import { pixelRuns, personColors } from '@/apps/safari/project/dialogueStage';
import { TILE } from '@/apps/safari/project/dialogueScenes';
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
import {
	BARD_COLORS,
	GATE_COLORS,
	gateDoorRows,
	HERO_COLORS,
	markPoint,
	MINI_MONSTER,
	miniMonsterColors,
	personRows,
	TUTOR_COLORS,
	villageRgba,
	type WalkFrame,
} from '@/apps/safari/project/dialogueVillage';
import { Pixels } from '@/apps/safari/project/DialoguePixels';
import { prefersReducedMotion } from '@/apps/safari/project/reveal';
import '@/apps/safari/project/DialogueTown.css';

/** 한 칸을 걷는 시간(ms): 앞 반은 발을 내딛고 뒤 반은 선다 (두 걸음에 서기·왼발·서기·오른발 네 프레임) */
const STEP_MS = 180;

export interface PlayerSpot {
	x: number;
	y: number;
	facing: Facing;
}

/** 칸 그림을 캔버스에 찍는다 (같은 색끼리 이은 사각형) */
function drawRows(
	ctx: CanvasRenderingContext2D,
	rows: readonly string[],
	colors: Record<string, string>,
	x: number,
	y: number
) {
	for (const run of pixelRuns(rows, colors)) {
		ctx.fillStyle = run.color;
		ctx.fillRect(x + run.x, y + run.y, run.w, 1);
	}
}

/** 칸 그림을 타일 바닥 가운데에 세운다 (lift만큼 띄운다) */
function standRows(
	ctx: CanvasRenderingContext2D,
	rows: readonly string[],
	colors: Record<string, string>,
	tx: number,
	ty: number,
	lift = 2
) {
	const w = rows[0]?.length ?? 0;
	drawRows(ctx, rows, colors, tx * TILE + Math.floor((TILE - w) / 2), ty * TILE + TILE - rows.length - lift);
}

/** 발밑 그림자 (반투명 타원) */
function shadow(ctx: CanvasRenderingContext2D, cx: number, by: number, rx: number) {
	ctx.fillStyle = 'rgb(20 40 30 / 28%)';
	ctx.fillRect(cx - rx + 1, by - 2, rx * 2 - 2, 1);
	ctx.fillRect(cx - rx, by - 1, rx * 2, 2);
	ctx.fillRect(cx - rx + 1, by + 1, rx * 2 - 2, 1);
}

/** 마을 판 (낮·밤 두 장 중 테마에 맞는 한 장) */
const VillageCanvas: React.FC<{ active: ReadonlySet<string>; night: boolean }> = ({ active, night }) => {
	const ref = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		const ctx = ref.current?.getContext('2d');
		if (!ctx || typeof ImageData === 'undefined') return;
		const data = villageRgba(SLOTS, active, night);
		ctx.putImageData(new ImageData(new Uint8ClampedArray(data), WORLD_PX_W, WORLD_PX_H), 0, 0);
	}, [active, night]);
	return (
		<canvas ref={ref} className="dl-village" data-night={night || undefined} width={WORLD_PX_W} height={WORLD_PX_H} />
	);
};

/** 장소 위의 표: 아직 안 읽은 곳은 '!' 말풍선, 읽은 곳은 작은 ✓ (12×12 칸 그림) */
const MARK_NEW = [
	'.kkkkkkkk.',
	'kWWWWWWWWk',
	'kWWWffWWWk',
	'kWWWffWWWk',
	'kWWWffWWWk',
	'kWWWffWWWk',
	'kWWWWWWWWk',
	'kWWWffWWWk',
	'kWWWWWWWWk',
	'.kkkWWkkk.',
	'....kk....',
];
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
const MARK_COLORS = { k: '#202028', W: '#ffffff', f: '#e83c3c', G: '#3ca85c' };

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
	map: HTMLDivElement | null = null;
	layout: WorldLayout | null = null;
	viewW = 0;
	viewH = 0;
	fixed: { x: number; y: number } | undefined;
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
			: cameraOf(this.px, this.py, this.viewW, this.viewH);
	}

	/** 주인공 그림(방향·프레임이 바뀔 때만 다시 칠한다)과 카메라를 지금 자리로 (정수 칸만) */
	paint() {
		const hero = this.hero;
		if (hero) {
			const key = `${this.facing}:${this.frame}`;
			if (key !== this.drawn) {
				const ctx = hero.getContext('2d');
				if (ctx) {
					ctx.clearRect(0, 0, hero.width, hero.height);
					shadow(ctx, 8, 18, 5);
					drawRows(ctx, personRows('cap', this.facing, this.frame), HERO_COLORS, 1, 0);
				}
				this.drawn = key;
			}
			hero.style.transform = `translate(${this.px}px, ${this.py - 4}px)`;
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
}) => {
	const viewRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<HTMLDivElement>(null);
	const heroRef = useRef<HTMLCanvasElement>(null);
	const actorsRef = useRef<HTMLCanvasElement>(null);
	const walkerRef = useRef<Walker | null>(null);
	const active = useMemo(() => new Set(layout.places.map((p) => p.key)), [layout]);

	// 걷기를 맡는 것을 만들고(처음 한 번), 지금 지도·화면 크기·알림 함수를 넘긴 뒤 DialoguePage가 가진 자리에 세운다
	useEffect(() => {
		const walker = (walkerRef.current ??= new Walker(player));
		walker.hero = heroRef.current;
		walker.map = mapRef.current;
		walker.layout = layout;
		walker.viewW = viewW;
		walker.viewH = viewH;
		walker.fixed = fixedCamera;
		walker.onMove = onMove;
		walker.onInteract = onInteract;
		walker.place(player);
		walker.paint();
		const hero = heroRef.current;
		if (hero && !walker.moving) {
			hero.dataset.x = String(walker.x);
			hero.dataset.y = String(walker.y);
			hero.dataset.facing = walker.facing;
		}
	}, [player, layout, viewW, viewH, fixedCamera, onMove, onInteract]);

	// 화면을 떠나면 걷기를 멈춘다
	useEffect(() => () => walkerRef.current?.stop(), []);

	// 사람 판: 팀원·안내인·음유시인·몬스터와 북쪽 문짝 (장소나 문이 바뀔 때만 다시 칠한다)
	useEffect(() => {
		const ctx = actorsRef.current?.getContext('2d');
		if (!ctx) return;
		ctx.clearRect(0, 0, WORLD_PX_W, WORLD_PX_H);
		for (const place of layout.places) {
			const cx = place.x * TILE + 8;
			const by = place.y * TILE + TILE - 1;
			if (place.kind === 'member') {
				shadow(ctx, cx, by - 1, 5);
				standRows(ctx, personRows('hair', 'down'), { ...personColors(place.label), k: '#202028' }, place.x, place.y);
			} else if (place.kind === 'tutor') {
				shadow(ctx, cx, by - 1, 5);
				standRows(ctx, personRows('hair', 'right'), TUTOR_COLORS, place.x, place.y);
			} else if (place.kind === 'bard') {
				shadow(ctx, cx, by - 1, 5);
				standRows(ctx, personRows('cap', 'down'), BARD_COLORS, place.x, place.y);
			} else if (place.kind === 'monster') {
				shadow(ctx, cx, by - 1, 7);
				standRows(ctx, MINI_MONSTER, miniMonsterColors(), place.x, place.y, 1);
			} else if (place.kind === 'gate') {
				drawRows(ctx, gateDoorRows(gateOpen), GATE_COLORS, (place.x + 1) * TILE, (place.y + place.h) * TILE - 26);
			}
		}
	}, [layout, gateOpen]);

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

	return (
		<div className="dl-world" ref={viewRef} onClick={onClick} aria-hidden="true" data-walking={walking || undefined}>
			<div className="dl-world-map" ref={mapRef} style={{ width: WORLD_PX_W, height: WORLD_PX_H }}>
				<VillageCanvas active={active} night={false} />
				<VillageCanvas active={active} night />
				<canvas ref={actorsRef} className="dl-actors" width={WORLD_PX_W} height={WORLD_PX_H} />
				{marks.map((place) => {
					const done = place.kind !== 'gate' && read.has(place.topic);
					const point = markPoint(place);
					return (
						<span
							key={place.key}
							className="dl-mark"
							data-place={place.key}
							data-state={done ? 'read' : 'new'}
							style={{ left: point.x - 5, top: point.y - (done ? 9 : 11) }}
						>
							<Pixels rows={done ? MARK_READ : MARK_NEW} colors={MARK_COLORS} scale={1} className="dl-mark-icon" />
						</span>
					);
				})}
				<canvas
					ref={heroRef}
					className="dl-hero"
					width={TILE}
					height={20}
					data-x={player.x}
					data-y={player.y}
					data-facing={player.facing}
					hidden={!walking}
				/>
			</div>
		</div>
	);
};

export default DialogueTown;
