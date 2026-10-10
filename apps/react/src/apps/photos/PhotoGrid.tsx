// 휴대폰 사진 앱의 목록 조각: 꽉 찬 격자, 가로로 넘기는 선반, 앨범 카드
import { Thumb, type Shown } from './PhotoParts';
import { captionOf, useCaptions } from './captions';
import { keyOf } from './photosMobile.model';

/** 꽉 찬 격자: iOS 사진처럼 칸 사이 1px, 사진은 칸을 채운다 */
export const Grid = ({ photos, onOpen }: { photos: Shown[]; onOpen: (index: number) => void }) => {
	const captions = useCaptions();
	return (
		<ul className="photos-phone-grid">
			{photos.map((photo, index) => (
				<li key={keyOf(photo)}>
					<button
						type="button"
						className="photos-thumb"
						aria-label={`${photo.album.name}: ${captionOf(photo, captions)}${photo.video ? ' (영상)' : ''}`}
						onClick={() => onOpen(index)}
					>
						<Thumb photo={photo} />
					</button>
				</li>
			))}
		</ul>
	);
};

/** 모음의 묶음: 제목(›)과 가로로 넘기는 카드들 */
export const Shelf = ({ title, children }: { title: string; children: React.ReactNode }) => (
	<section className="photos-shelf" aria-label={title}>
		<h3>
			{title} <i className="fa-solid fa-chevron-right" aria-hidden="true" />
		</h3>
		<div className="photos-shelf-row">{children}</div>
	</section>
);

/** 모음·검색의 카드: 사진 위에 제목 (큰 카드는 추억) */
export const Card = ({
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

/** 손가락으로 옆으로 밀었다고 보는 거리 */
