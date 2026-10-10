import { useExitMotion } from '@/shared/ui/motion/useExitMotion';
import React, { useEffect, useRef, useState } from 'react';
import { useAdmin } from '@/shared/auth/adminStore';
import { WALLPAPER_NAME_MAX } from '@macfolio/contracts';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { wallpaperUrl, type ResolvedTheme, type Wallpaper } from '@/shared/settings/settings';
import {
	addCustomWallpaper,
	chooseWallpaper,
	loadCustomWallpapers,
	removeCustomWallpaper,
	renameCustomWallpaper,
	useCustomWallpapers,
	type CustomWallpaper,
	type WallpaperKind,
} from '@/shared/settings/customWallpapers';
import AlertDialog from '@/shared/ui/dialog/AlertDialog';
import Button from '@/shared/ui/button/Button';
import Menu from '@/shared/ui/menu/Menu';

interface Props {
	kind: WallpaperKind;
	label: string;
	hint: string;
	wallpapers: readonly Wallpaper[];
	selected: string;
}

/** 휴대폰에서 이만큼 누르고 있으면 메뉴 (오른쪽 클릭 대신) */
const LONG_PRESS_MS = 500;

/** 이름 바꾸기 창. 경고창(AlertDialog)과 같은 모양에 입력 칸 하나 */
const RenameDialog = ({
	name,
	onSave,
	onCancel,
}: {
	name: string;
	onSave: (name: string) => void;
	onCancel: () => void;
}) => {
	const [value, setValue] = useState(name);
	const input = useRef<HTMLInputElement>(null);
	useEffect(() => {
		input.current?.select();
	}, []);
	const canSave = value.trim().length > 0;
	// 닫히면 바탕은 흐려지고 상자는 작아지며 사라진다 (motion.css)
	const overlay = useExitMotion<HTMLDivElement>('fade-out');
	return (
		<div
			ref={overlay}
			className="ui-alert-overlay"
			onPointerDown={(event) => {
				if (event.target === event.currentTarget) onCancel();
			}}
		>
			<form
				className="ui-alert wallpaper-rename"
				role="dialog"
				aria-modal="true"
				aria-label="배경화면 이름 바꾸기"
				onSubmit={(event) => {
					event.preventDefault();
					if (canSave) onSave(value.trim());
				}}
				onKeyDown={(event) => {
					if (event.key === 'Escape') {
						event.preventDefault();
						onCancel();
					}
				}}
			>
				<h3>배경화면 이름 바꾸기</h3>
				<input
					ref={input}
					aria-label="배경화면 이름"
					value={value}
					maxLength={WALLPAPER_NAME_MAX}
					onChange={(event) => setValue(event.target.value)}
				/>
				<div className="ui-alert-actions">
					<Button onClick={onCancel}>취소</Button>
					<Button type="submit" tone="primary" disabled={!canSave}>
						저장
					</Button>
				</div>
			</form>
		</div>
	);
};

/**
 * 배경화면 한 묶음 (제목, 설명, 썸네일 줄). 데스크톱에서는 처음에 가로로 넘기는 한 줄(간략히 보기)이고,
 * 제목 오른쪽의 '모두 보기(n)'를 누르면 그 자리에서 여러 줄로 펼친다. 휴대폰은 처음부터 격자다.
 * 한 줄일 때는 고른 배경화면이 보이게 가로로 넘겨 둔다 (처음 열 때, 목록이 늘었을 때).
 */
const WallpaperRow = ({
	label,
	hint,
	count,
	children,
}: {
	label: string;
	hint: string;
	/** 모두 보기(n)의 n */
	count: number;
	children: React.ReactNode;
}) => {
	const phone = useIsMobile();
	const [expanded, setExpanded] = useState(false);
	const collapsed = !phone && !expanded;
	const grid = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const row = grid.current;
		const chosen = row?.querySelector<HTMLElement>('[aria-checked="true"]');
		if (!row || !chosen || !collapsed) return;
		const left = chosen.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft;
		row.scrollLeft = Math.max(0, left - (row.clientWidth - chosen.offsetWidth) / 2);
	}, [collapsed, count]);

	return (
		<section className="wallpaper-group">
			<div className="wallpaper-group-head">
				<h3>{label}</h3>
				{!phone && count > 0 && (
					<button
						type="button"
						className="wallpaper-toggle"
						aria-expanded={expanded}
						onClick={() => setExpanded((open) => !open)}
					>
						{expanded ? '간략히 보기' : `모두 보기(${count})`}
					</button>
				)}
			</div>
			<p className="settings-hint">{hint}</p>
			<div
				ref={grid}
				className={`settings-options wallpaper-grid ${collapsed ? 'collapsed' : ''}`}
				role="radiogroup"
				aria-label={label.endsWith('배경화면') ? label : `${label} 배경화면`}
			>
				{children}
			</div>
		</section>
	);
};

/**
 * 지금 화면(데스크톱이면 macOS, 휴대폰이면 iOS)의 배경화면. 위에 관리자가 더한 배경화면, 아래에 기본 배경화면을 따로 둔다.
 * 더한 배경화면은 데스크톱·휴대폰 어디서나 고르고, 썸네일은 그 화면 비율로 가운데를 잘라 보여 준다.
 * 기본 배경화면의 썸네일은 지금 화면 모드의 버전이다.
 * 관리자에게만 '사진 추가…' 칸과, 더한 배경화면의 지우기(×)·메뉴(이름 바꾸기, 삭제)가 보인다 (macOS 설정의 '사용자의 사진'처럼).
 * 메뉴는 오른쪽 클릭, 휴대폰에서는 길게 눌러 연다. 기본 배경화면은 지울 수 없다.
 */
const WallpaperGroup: React.FC<Props> = ({ kind, label, hint, wallpapers, selected }) => {
	const theme = (document.documentElement.dataset.theme ?? 'light') as ResolvedTheme;
	const portrait = kind === 'ios';
	const isAdmin = useAdmin().status === 'signed-in';
	const custom = useCustomWallpapers().list;
	const fileInput = useRef<HTMLInputElement>(null);
	const [adding, setAdding] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [menu, setMenu] = useState<{ x: number; y: number; wallpaper: CustomWallpaper } | null>(null);
	const [renaming, setRenaming] = useState<CustomWallpaper | null>(null);
	const [removing, setRemoving] = useState<CustomWallpaper | null>(null);
	const longPress = useRef<{ timer: number; fired: boolean } | null>(null);

	useEffect(() => {
		void loadCustomWallpapers();
	}, []);

	const run = async (action: () => Promise<unknown>, fallback: string) => {
		try {
			await action();
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : fallback);
		}
	};

	const add = async (file: File) => {
		setAdding(true);
		await run(async () => {
			const added = await addCustomWallpaper(file);
			chooseWallpaper(kind, added.id, added.image);
		}, '배경화면을 올리지 못했습니다.');
		setAdding(false);
	};

	const thumbnailClass = `wallpaper-thumbnail ${portrait ? 'portrait' : ''}`;

	/** 관리자: 오른쪽 클릭과 길게 누르기로 메뉴를 연다 */
	const menuHandlers = (wallpaper: CustomWallpaper): React.HTMLAttributes<HTMLButtonElement> =>
		isAdmin
			? {
					onContextMenu: (event) => {
						event.preventDefault();
						setMenu({ x: event.clientX, y: event.clientY, wallpaper });
					},
					onPointerDown: (event) => {
						if (event.pointerType !== 'touch') return;
						const { clientX: x, clientY: y } = event;
						longPress.current = {
							fired: false,
							timer: window.setTimeout(() => {
								if (longPress.current) longPress.current.fired = true;
								setMenu({ x, y, wallpaper });
							}, LONG_PRESS_MS),
						};
					},
					onPointerUp: () => window.clearTimeout(longPress.current?.timer),
					onPointerLeave: () => window.clearTimeout(longPress.current?.timer),
					onPointerCancel: () => window.clearTimeout(longPress.current?.timer),
				}
			: {};

	return (
		<>
			{/* 관리자가 더한 배경화면 (macOS 설정의 '사용자의 사진'처럼 기본 배경화면과 따로). 방문자에게는 있을 때만 */}
			{(isAdmin || custom.length > 0) && (
				<WallpaperRow
					label="추가한 배경화면"
					hint="관리자가 올린 사진입니다. 데스크톱과 휴대폰 어디서나 고를 수 있습니다."
					count={custom.length}
				>
					{isAdmin && (
						<button
							type="button"
							className="wallpaper-option wallpaper-add"
							aria-label={`${label} 배경화면 추가`}
							disabled={adding}
							onClick={() => fileInput.current?.click()}
						>
							<span className={thumbnailClass}>
								<span className="wallpaper-add-icon" aria-hidden="true">
									<i className={adding ? 'fa-solid fa-spinner fa-spin' : 'fa-regular fa-image'} />
									{!adding && <i className="fa-solid fa-circle-plus wallpaper-add-plus" />}
								</span>
								<span className="wallpaper-add-label">{adding ? '올리는 중…' : '사진 추가…'}</span>
							</span>
						</button>
					)}
					{custom.map((wallpaper) => (
						<div key={wallpaper.id} className="wallpaper-custom">
							<button
								type="button"
								role="radio"
								aria-checked={selected === wallpaper.id}
								className={`wallpaper-option ${selected === wallpaper.id ? 'selected' : ''}`}
								onClick={() => {
									// 길게 눌러 메뉴를 연 손가락을 떼는 것은 고르기가 아니다
									if (longPress.current?.fired) {
										longPress.current = null;
										return;
									}
									chooseWallpaper(kind, wallpaper.id, wallpaper.image);
								}}
								{...menuHandlers(wallpaper)}
							>
								<img className={thumbnailClass} src={wallpaper.thumbnail} alt="" loading="lazy" />
								<span className="wallpaper-name" title={wallpaper.name}>
									{wallpaper.name}
								</span>
							</button>
							{isAdmin && (
								<button
									type="button"
									className="wallpaper-remove"
									aria-label={`${wallpaper.name} 배경화면 삭제`}
									onClick={() => setRemoving(wallpaper)}
								>
									<i className="fa-solid fa-xmark" aria-hidden="true" />
								</button>
							)}
						</div>
					))}
				</WallpaperRow>
			)}
			<WallpaperRow label={label} hint={hint} count={wallpapers.length}>
				{wallpapers.map((wallpaper) => (
					<button
						key={wallpaper.id}
						type="button"
						role="radio"
						aria-checked={selected === wallpaper.id}
						className={`wallpaper-option ${selected === wallpaper.id ? 'selected' : ''}`}
						onClick={() => chooseWallpaper(kind, wallpaper.id)}
					>
						<img className={thumbnailClass} src={wallpaperUrl(wallpaper, theme, true)} alt="" loading="lazy" />
						<span className="wallpaper-name">{wallpaper.name}</span>
					</button>
				))}
			</WallpaperRow>
			<input
				ref={fileInput}
				type="file"
				accept="image/*"
				hidden
				aria-label={`${label} 배경화면 파일`}
				onChange={(event) => {
					const file = event.target.files?.[0];
					event.target.value = '';
					if (file) void add(file);
				}}
			/>

			{menu && (
				<Menu
					label="배경화면 메뉴"
					anchor={menu}
					autoFocus
					onClose={() => setMenu(null)}
					items={[
						{ label: '이름 바꾸기…', icon: 'fa-solid fa-pen', onSelect: () => setRenaming(menu.wallpaper) },
						{
							label: '삭제…',
							icon: 'fa-solid fa-trash',
							destructive: true,
							onSelect: () => setRemoving(menu.wallpaper),
						},
					]}
				/>
			)}
			{renaming && (
				<RenameDialog
					name={renaming.name}
					onCancel={() => setRenaming(null)}
					onSave={(name) => {
						const target = renaming;
						setRenaming(null);
						if (name !== target.name) void run(() => renameCustomWallpaper(target, name), '이름을 바꾸지 못했습니다.');
					}}
				/>
			)}
			{removing && (
				<AlertDialog
					title={`'${removing.name}' 배경화면을 삭제할까요?`}
					message="모든 방문자의 목록에서 사라지고, 이 배경화면을 쓰던 사람은 기본 배경화면으로 돌아갑니다."
					confirmLabel="삭제"
					onConfirm={() => {
						const target = removing;
						setRemoving(null);
						void run(() => removeCustomWallpaper(target), '배경화면을 지우지 못했습니다.');
					}}
					onCancel={() => setRemoving(null)}
				/>
			)}
			{error && (
				<AlertDialog
					title="배경화면을 바꾸지 못했습니다"
					message={error}
					confirmLabel="확인"
					cancelLabel={null}
					onConfirm={() => setError(null)}
					onCancel={() => setError(null)}
				/>
			)}
		</>
	);
};

export default WallpaperGroup;
