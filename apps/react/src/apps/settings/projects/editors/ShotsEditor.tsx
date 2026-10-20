import { useState } from 'react';
import { type ProjectPoint } from '@macfolio/desktop-core/site';
import { ListTable } from '../ListTable';
import { Lightbox, PicturePopup, UploadButton } from '../images';
import { useImageUpload } from '../useImageUpload';

type Shot = NonNullable<ProjectPoint['shots']>[number];

/** 화면 목록의 한 줄: 썸네일(누르면 크게 보기), 설명 칸, 그 아래 주소 칸과 고르기·올리기 */
const ShotRow = ({
	name,
	shot,
	update,
	onZoom,
}: {
	/** 줄 이름 ('화면 모음 1'): 칸마다 접근성 이름 앞에 붙인다 */
	name: string;
	shot: Shot;
	update: (next: Shot) => void;
	onZoom: () => void;
}) => {
	const { uploading, error, upload } = useImageUpload((src) => update({ ...shot, src }));
	const video = shot.src.endsWith('.mp4');
	return (
		<div className="projects-shot">
			{shot.src ? (
				<button type="button" className="projects-shot-thumb" aria-label={`${name} 그림 크게 보기`} onClick={onZoom}>
					{video ? <video src={shot.src} muted /> : <img src={shot.src} alt="" loading="lazy" />}
				</button>
			) : (
				<span className="projects-shot-thumb empty" aria-hidden="true">
					<i className="fa-regular fa-image" />
				</span>
			)}
			<div className="projects-shot-fields">
				<input
					className="projects-input"
					aria-label={`${name} 설명`}
					value={shot.alt}
					placeholder="설명을 적습니다."
					onChange={(event) => update({ ...shot, alt: event.target.value })}
				/>
				<div className="projects-shot-source">
					<input
						className="projects-input mono"
						aria-label={`${name} 주소`}
						value={shot.src}
						placeholder="/imgs/… 또는 https://"
						spellCheck={false}
						onChange={(event) => update({ ...shot, src: event.target.value.trim() })}
					/>
					<PicturePopup
						label={`${name} 그림 고르기`}
						value={undefined}
						prompt="고르기…"
						onPick={(src) => src && update({ ...shot, src })}
					/>
					<UploadButton name={`${name} 그림 올리기`} uploading={uploading} onFile={(file) => void upload(file)} />
				</div>
				{error && <p className="projects-error">{error}</p>}
			</div>
		</div>
	);
};

/**
 * 화면 여러 장 (항목 안)과 화면 모음 (그림 탭): 줄마다 그림과 설명을 바로 고친다 (시트를 열지 않는다).
 * 줄을 끌거나 ⌥↑·⌥↓로 순서를 바꾸고, 썸네일을 누르면 목록의 그림을 차례로 크게 본다
 */
export const ShotsEditor = ({
	label,
	title = '화면 여러 장',
	nested = true,
	hint = '글 옆이나 아래에 차례로 보입니다. .mp4 주소는 화면에 보일 때만 도는 영상이 됩니다.',
	shots,
	onChange,
}: {
	label: string;
	title?: string;
	nested?: boolean;
	hint?: string;
	shots: Shot[];
	onChange: (shots: Shot[]) => void;
}) => {
	const [zoomed, setZoomed] = useState<string | null>(null);
	const sources = shots.map((shot) => shot.src).filter(Boolean);
	return (
		<>
			<ListTable<Shot>
				label={label}
				title={title}
				nested={nested}
				hint={hint}
				items={shots}
				onChange={onChange}
				blank={() => ({ src: '', alt: '' })}
				cells={(shot, index, update) => [
					<ShotRow
						key="shot"
						name={`${label} ${index + 1}`}
						shot={shot}
						update={update}
						onZoom={() => setZoomed(shot.src)}
					/>,
				]}
			/>
			{zoomed !== null && sources.includes(zoomed) && (
				<Lightbox items={sources} start={sources.indexOf(zoomed)} onClose={() => setZoomed(null)} />
			)}
		</>
	);
};
