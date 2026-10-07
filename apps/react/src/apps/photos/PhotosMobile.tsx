import { useState } from 'react';
import MobileNavigation from '@/desktop/window/MobileNavigation';
import { ALBUMS, ALL_PHOTOS, countText, type Album } from './albums';
import { Thumb, Viewer, type Shown } from './PhotoParts';
import '@/apps/photos/Photos.css';
import '@/apps/photos/PhotosMobile.css';

type Tab = 'library' | 'collections';
/** 모음에서 들어간 곳: 앨범 하나, 또는 비디오만 */
type Opened = { kind: 'album'; id: string } | { kind: 'videos' } | null;

const VIDEOS = ALL_PHOTOS.filter((photo) => photo.video);
/** 앨범의 대표 사진 (영상이 아닌 첫 사진) */
const coverOf = (album: Album) => album.photos.find((photo) => !photo.video)?.src;

/** 꽉 찬 격자: iOS 사진처럼 칸 사이 1px, 사진은 칸을 채운다 */
const Grid = ({ photos, onOpen }: { photos: Shown[]; onOpen: (index: number) => void }) => (
	<ul className="photos-phone-grid">
		{photos.map((photo, index) => (
			<li key={`${photo.album.id}:${photo.src}`}>
				<button
					type="button"
					className="photos-thumb"
					aria-label={`${photo.album.name}: ${photo.caption}${photo.video ? ' (영상)' : ''}`}
					onClick={() => onOpen(index)}
				>
					<Thumb photo={photo} />
				</button>
			</li>
		))}
	</ul>
);

/** 모음의 묶음: 제목(›)과 가로로 넘기는 카드들 */
const Shelf = ({ title, children }: { title: string; children: React.ReactNode }) => (
	<section className="photos-shelf" aria-label={title}>
		<h3>
			{title} <i className="fa-solid fa-chevron-right" aria-hidden="true" />
		</h3>
		<div className="photos-shelf-row">{children}</div>
	</section>
);

/** 모음의 카드: 사진 위에 제목 (큰 카드는 추억) */
const Card = ({
	label,
	note,
	cover,
	big,
	onOpen,
}: {
	label: string;
	note?: string;
	cover: React.ReactNode;
	big?: boolean;
	onOpen: () => void;
}) => (
	<button type="button" className={`photos-card ${big ? 'big' : ''}`} onClick={onOpen}>
		<span className="photos-card-cover" aria-hidden="true">
			{cover}
		</span>
		<span className="photos-card-text">
			<strong>{label}</strong>
			{note && <span>{note}</span>}
		</span>
	</button>
);

/**
 * 사진 (휴대폰): iOS 사진처럼 아래의 떠 있는 탭으로 보관함·모음을 오간다.
 * 보관함은 꽉 찬 격자 위에 큰 제목, 모음은 추억·고정됨·앨범을 가로로 넘기는 카드. 카드를 누르면 그 앨범의 격자로 들어간다
 */
const PhotosMobile = ({ onOpenProject }: { onOpenProject: (id: string) => void }) => {
	const [tab, setTab] = useState<Tab>('library');
	const [grouped, setGrouped] = useState(false);
	const [opened, setOpened] = useState<Opened>(null);
	const [viewing, setViewing] = useState<number | null>(null);

	const album = opened?.kind === 'album' ? ALBUMS.find((entry) => entry.id === opened.id) : undefined;
	const photos: Shown[] = album
		? album.photos.map((photo) => ({ ...photo, album }))
		: opened?.kind === 'videos'
			? VIDEOS
			: ALL_PHOTOS;
	const title = album?.name ?? (opened?.kind === 'videos' ? '비디오' : '보관함');
	const showGrid = tab === 'library' || opened !== null;

	const open = (next: Opened) => {
		setOpened(next);
		setViewing(null);
	};
	const switchTab = (next: Tab) => {
		setTab(next);
		open(null);
	};

	if (viewing !== null && photos[viewing])
		return (
			<div className="photos-phone">
				<MobileNavigation floating />
				<Viewer
					photos={photos}
					index={viewing}
					onMove={setViewing}
					onClose={() => setViewing(null)}
					onOpenProject={onOpenProject}
				/>
			</div>
		);

	return (
		<div className="photos-phone">
			{/* 모음에서 들어간 앨범은 뒤로 가기가 '모음', 첫 화면은 홈 */}
			<MobileNavigation floating {...(opened ? { backLabel: '모음', onBack: () => open(null) } : {})} />
			<div className="photos-phone-scroll">
				{showGrid ? (
					<>
						<header className="photos-phone-title overlay">
							<h2>{title}</h2>
							<p>{countText(photos)}</p>
						</header>
						{tab === 'library' && !opened && grouped ? (
							ALBUMS.map((entry) => (
								<section key={entry.id} className="photos-phone-group" aria-label={entry.name}>
									<h3>
										<button type="button" onClick={() => setOpened({ kind: 'album', id: entry.id })}>
											{entry.name} <i className="fa-solid fa-chevron-right" aria-hidden="true" />
										</button>
									</h3>
									<Grid
										photos={entry.photos.map((photo) => ({ ...photo, album: entry }))}
										onOpen={(index) => setViewing(photos.findIndex((photo) => photo.src === entry.photos[index].src))}
									/>
								</section>
							))
						) : (
							<Grid photos={photos} onOpen={setViewing} />
						)}
					</>
				) : (
					<>
						<header className="photos-phone-title">
							<h2>모음</h2>
							<p>
								앨범 {ALBUMS.length}개 · {countText(ALL_PHOTOS)}
							</p>
						</header>
						<Shelf title="추억">
							{ALBUMS.map((entry) => (
								<Card
									key={entry.id}
									big
									label={entry.name}
									note={entry.period}
									cover={<img src={coverOf(entry)} alt="" loading="lazy" />}
									onOpen={() => open({ kind: 'album', id: entry.id })}
								/>
							))}
						</Shelf>
						<Shelf title="고정됨">
							<Card
								label="비디오"
								note={`${VIDEOS.length}개`}
								cover={<video src={`${VIDEOS[0]?.src}#t=0.1`} muted playsInline preload="metadata" />}
								onOpen={() => open({ kind: 'videos' })}
							/>
							<Card
								label="모든 사진"
								note={`${ALL_PHOTOS.length}개`}
								cover={
									<span className="photos-mosaic">
										{ALL_PHOTOS.filter((photo) => !photo.video)
											.slice(0, 9)
											.map((photo) => (
												<img key={photo.src} src={photo.src} alt="" loading="lazy" />
											))}
									</span>
								}
								onOpen={() => switchTab('library')}
							/>
						</Shelf>
						<Shelf title="앨범">
							{ALBUMS.map((entry) => (
								<Card
									key={entry.id}
									label={entry.name}
									note={`${entry.photos.length}개`}
									cover={<img src={coverOf(entry)} alt="" loading="lazy" />}
									onOpen={() => open({ kind: 'album', id: entry.id })}
								/>
							))}
						</Shelf>
					</>
				)}
			</div>

			{/* 아래에 떠 있는 탭: 보관함에서는 앨범별·전체를, 모음에서는 탭을 크게 (iOS 사진) */}
			<nav className="photos-phone-bar" aria-label="사진 탭">
				{tab === 'library' && !opened ? (
					<>
						<button
							type="button"
							className="photos-phone-circle"
							aria-label="모음"
							onClick={() => switchTab('collections')}
						>
							<i className="fa-solid fa-layer-group" aria-hidden="true" />
						</button>
						<div className="photos-phone-segments" role="group" aria-label="보기 방식">
							<button type="button" aria-pressed={grouped} onClick={() => setGrouped(true)}>
								앨범별
							</button>
							<button type="button" aria-pressed={!grouped} onClick={() => setGrouped(false)}>
								전체
							</button>
						</div>
					</>
				) : (
					<div className="photos-phone-tabs" role="tablist" aria-label="사진 탭">
						<button type="button" role="tab" aria-selected={tab === 'library'} onClick={() => switchTab('library')}>
							<i className="fa-regular fa-images" aria-hidden="true" />
							보관함
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={tab === 'collections'}
							onClick={() => switchTab('collections')}
						>
							<i className="fa-solid fa-layer-group" aria-hidden="true" />
							모음
						</button>
					</div>
				)}
			</nav>
		</div>
	);
};

export default PhotosMobile;
