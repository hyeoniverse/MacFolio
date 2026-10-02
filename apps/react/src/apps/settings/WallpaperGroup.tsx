import React, { useEffect, useRef, useState } from 'react';
import { useAdmin } from '@/shared/auth/adminStore';
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

/** 이름 칸과 같은 한도 (API의 NAME_MAX) */
const NAME_MAX = 40;
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
	return (
		<div
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
					maxLength={NAME_MAX}
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
 * 배경화면 한 묶음 (macOS, iOS). 기본 배경화면 뒤에 관리자가 더한 배경화면이 이어진다.
 * 기본 배경화면의 썸네일은 지금 화면 모드의 버전이고, 더한 배경화면은 한 장이다.
 * 관리자에게만 '사진 추가…' 칸과, 더한 배경화면의 지우기(×)·메뉴(이름 바꾸기, 삭제)가 보인다 (macOS 설정의 '사용자의 사진'처럼).
 * 메뉴는 오른쪽 클릭, 휴대폰에서는 길게 눌러 연다. 기본 배경화면은 지울 수 없다.
 */
const WallpaperGroup: React.FC<Props> = ({ kind, label, hint, wallpapers, selected }) => {
	const theme = (document.documentElement.dataset.theme ?? 'light') as ResolvedTheme;
	const portrait = kind === 'ios';
	const isAdmin = useAdmin().status === 'signed-in';
	const custom = useCustomWallpapers().list.filter((wallpaper) => wallpaper.kind === kind);
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
			const added = await addCustomWallpaper(kind, file);
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
		<section className="wallpaper-group">
			<h3>{label}</h3>
			<p className="settings-hint">{hint}</p>
			<div className="settings-options wallpaper-grid" role="radiogroup" aria-label={`${label} 배경화면`}>
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
			</div>
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
		</section>
	);
};

export default WallpaperGroup;
