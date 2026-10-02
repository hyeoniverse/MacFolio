import React, { useEffect, useRef, useState } from 'react';
import { useAdmin } from '@/shared/auth/adminStore';
import { wallpaperUrl, type ResolvedTheme, type Wallpaper } from '@/shared/settings/settings';
import {
	addCustomWallpaper,
	chooseWallpaper,
	loadCustomWallpapers,
	removeCustomWallpaper,
	useCustomWallpapers,
	type CustomWallpaper,
	type WallpaperKind,
} from '@/shared/settings/customWallpapers';
import AlertDialog from '@/shared/ui/dialog/AlertDialog';
import Menu from '@/shared/ui/menu/Menu';

interface Props {
	kind: WallpaperKind;
	label: string;
	hint: string;
	wallpapers: readonly Wallpaper[];
	selected: string;
}

/**
 * 배경화면 한 묶음 (macOS, iOS). 기본 배경화면 뒤에 관리자가 더한 배경화면이 이어진다.
 * 기본 배경화면의 썸네일은 지금 화면 모드의 버전이고, 더한 배경화면은 한 장이다.
 * 관리자에게만 맨 끝에 + 칸(더하기)과 더한 배경화면의 지우기(× 단추, 오른쪽 클릭)가 보인다.
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
	const [removing, setRemoving] = useState<CustomWallpaper | null>(null);

	useEffect(() => {
		void loadCustomWallpapers();
	}, []);

	const add = async (file: File) => {
		setAdding(true);
		try {
			const added = await addCustomWallpaper(kind, file);
			chooseWallpaper(kind, added.id, added.image);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : '배경화면을 올리지 못했습니다.');
		} finally {
			setAdding(false);
		}
	};

	const remove = async (wallpaper: CustomWallpaper) => {
		setRemoving(null);
		try {
			await removeCustomWallpaper(wallpaper);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : '배경화면을 지우지 못했습니다.');
		}
	};

	const thumbnailClass = `wallpaper-thumbnail ${portrait ? 'portrait' : ''}`;

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
						{wallpaper.name}
					</button>
				))}
				{custom.map((wallpaper) => (
					<div key={wallpaper.id} className="wallpaper-custom">
						<button
							type="button"
							role="radio"
							aria-checked={selected === wallpaper.id}
							className={`wallpaper-option ${selected === wallpaper.id ? 'selected' : ''}`}
							onClick={() => chooseWallpaper(kind, wallpaper.id, wallpaper.image)}
							onContextMenu={(event) => {
								if (!isAdmin) return;
								event.preventDefault();
								setMenu({ x: event.clientX, y: event.clientY, wallpaper });
							}}
						>
							<img className={thumbnailClass} src={wallpaper.thumbnail} alt="" loading="lazy" />
							{wallpaper.name}
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
				{isAdmin && (
					<button
						type="button"
						className="wallpaper-option wallpaper-add"
						aria-label={`${label} 배경화면 추가`}
						disabled={adding}
						onClick={() => fileInput.current?.click()}
					>
						<span className={thumbnailClass} aria-hidden="true">
							<i className={adding ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-plus'} />
						</span>
						{adding ? '올리는 중…' : '추가'}
					</button>
				)}
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
					items={[{ label: '삭제…', destructive: true, onSelect: () => setRemoving(menu.wallpaper) }]}
				/>
			)}
			{removing && (
				<AlertDialog
					title={`'${removing.name}' 배경화면을 삭제할까요?`}
					message="모든 방문자의 목록에서 사라지고, 이 배경화면을 쓰던 사람은 기본 배경화면으로 돌아갑니다."
					confirmLabel="삭제"
					onConfirm={() => void remove(removing)}
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
