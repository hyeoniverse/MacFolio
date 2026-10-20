import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PUBLIC_IMAGES } from '@/shared/site/publicImages';
import { FormRow, Popup } from './fields';
import { FOLDER_GROUPS, optional } from './model';
import { useImageUpload } from './useImageUpload';

/** 사이트 안 그림 전부 (폴더별) → 고르기 목록에 쓴다 */
const ALL_PICTURES = Object.entries(PUBLIC_IMAGES)
	.filter(([folder]) => folder.startsWith('/imgs/projects/'))
	.flatMap(([, files]) => files.filter((src) => !src.endsWith('.mp4')));

const fileName = (src: string) => decodeURIComponent(src.split('/').pop() ?? src);

/** 그림 크게 보기: 창 위에 어둡게 깔고 가운데 크게. 여러 장이면 ←·→로 넘긴다. Esc·바깥 누르기로 닫는다 */
export const Lightbox = ({ items, start, onClose }: { items: string[]; start: number; onClose: () => void }) => {
	const [index, setIndex] = useState(start);
	const closeRef = useRef<HTMLButtonElement>(null);
	const step = (delta: number) => setIndex((current) => (current + delta + items.length) % items.length);
	useEffect(() => {
		const opener = document.activeElement as HTMLElement | null;
		closeRef.current?.focus();
		return () => opener?.focus();
	}, []);
	const src = items[index];
	return createPortal(
		<div
			className="projects-lightbox"
			role="dialog"
			aria-modal="true"
			aria-label="그림 크게 보기"
			onClick={onClose}
			onKeyDown={(event) => {
				if (event.key === 'Escape') {
					event.stopPropagation();
					onClose();
				} else if (items.length > 1 && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
					event.preventDefault();
					step(event.key === 'ArrowLeft' ? -1 : 1);
				}
			}}
		>
			<figure onClick={(event) => event.stopPropagation()}>
				{src.endsWith('.mp4') ? (
					<video src={src} controls autoPlay muted loop />
				) : (
					<img src={src} alt={fileName(src)} />
				)}
				<figcaption>
					{fileName(src)}
					{items.length > 1 && <span>{`${index + 1} / ${items.length}`}</span>}
				</figcaption>
			</figure>
			{items.length > 1 && (
				<>
					<button
						type="button"
						className="projects-lightbox-step prev"
						aria-label="이전 그림"
						onClick={(event) => {
							event.stopPropagation();
							step(-1);
						}}
					>
						<i className="fa-solid fa-chevron-left" aria-hidden="true" />
					</button>
					<button
						type="button"
						className="projects-lightbox-step next"
						aria-label="다음 그림"
						onClick={(event) => {
							event.stopPropagation();
							step(1);
						}}
					>
						<i className="fa-solid fa-chevron-right" aria-hidden="true" />
					</button>
				</>
			)}
			<button ref={closeRef} type="button" className="projects-lightbox-close" aria-label="닫기" onClick={onClose}>
				<i className="fa-solid fa-xmark" aria-hidden="true" />
			</button>
		</div>,
		document.body
	);
};

/** 사이트 안 그림 고르기 팝업: 프로젝트 폴더별로 묶는다. 고른 값이 목록에 있으면 그 이름이 보인다 */
export const PicturePopup = ({
	id,
	label,
	value,
	prompt,
	onPick,
	fromPicked = (src) => src,
}: {
	id?: string;
	label: string;
	/** 지금 값 (목록에 없는 값이면 prompt가 보인다) */
	value: string | undefined;
	/** 아무것도 고르지 않았을 때 보이는 글 */
	prompt: string;
	onPick: (value: string | undefined) => void;
	fromPicked?: (src: string) => string;
}) => (
	<Popup
		id={id}
		label={label}
		value={value && ALL_PICTURES.some((src) => fromPicked(src) === value) ? value : ''}
		onChange={(picked) => onPick(picked ? fromPicked(picked) : undefined)}
	>
		<option value="">{prompt}</option>
		{FOLDER_GROUPS.map((group) => (
			<optgroup key={group.label} label={group.label}>
				{group.folders.flatMap((folder) =>
					PUBLIC_IMAGES[folder.value]
						.filter((src) => !src.endsWith('.mp4'))
						.map((src) => (
							<option key={src} value={fromPicked(src)}>
								{src.slice(folder.value.length + 1)}
								{folder.label !== '프로젝트 폴더' ? ` (${folder.label})` : ''}
							</option>
						))
				)}
			</optgroup>
		))}
	</Popup>
);

/** 올리기 버튼: 버튼 전체를 덮는 보이지 않는 파일 입력 */
export const UploadButton = ({
	name,
	uploading,
	onFile,
}: {
	/** 접근성 이름 ('프로젝트 아이콘 올리기') */
	name: string;
	uploading: boolean;
	onFile: (file: File | undefined) => void;
}) => (
	<label className={`projects-button ${uploading ? 'busy' : ''}`}>
		{uploading ? '올리는 중…' : '올리기…'}
		<input
			type="file"
			accept="image/*"
			aria-label={name}
			disabled={uploading}
			onChange={(event) => {
				onFile(event.target.files?.[0]);
				event.target.value = '';
			}}
		/>
	</label>
);

/**
 * 그림 한 장 고르기: 왼쪽 미리 보기 타일(누르면 크게 보기), 오른쪽에 사이트 안 그림 고르기(폴더별 팝업)·올리기(POST /files)·지우기,
 * 그 아래 주소 칸. 앱 아이콘은 이미지 폴더 기준 경로(projects/…)라 값을 그대로 두고, 보여 줄 때만 주소로 바꾼다
 */
export const ImageField = ({
	label,
	name = label,
	value,
	onChange,
	required = false,
	hint,
	shape = 'square',
	toUrl = (v) => v,
	fromPicked = (src) => src,
}: {
	label: string;
	/** 컨트롤의 접근성 이름 앞부분 (기본은 보이는 이름) */
	name?: string;
	value: string | undefined;
	onChange: (value: string | undefined) => void;
	required?: boolean;
	hint?: string;
	/** 아이콘은 정사각형, 화면·배경은 16:10 */
	shape?: 'square' | 'wide';
	/** 저장된 값 → 보여 줄 주소 */
	toUrl?: (value: string) => string;
	/** 고른 그림 주소(/imgs/…) → 저장할 값 */
	fromPicked?: (src: string) => string;
}) => {
	const { uploading, error, upload } = useImageUpload(onChange);
	const [zoomed, setZoomed] = useState(false);
	const id = useId();
	return (
		<FormRow label={label} required={required} htmlFor={id} hint={hint} top>
			<div className={`projects-image ${shape}`}>
				{value ? (
					<button
						type="button"
						className="projects-thumb filled"
						aria-label={`${name} 크게 보기`}
						onClick={() => setZoomed(true)}
					>
						<img src={toUrl(value)} alt="" />
					</button>
				) : (
					<span className="projects-thumb empty" aria-hidden="true">
						<i className="fa-regular fa-image" />
					</span>
				)}
				<div className="projects-image-tools">
					<div className="projects-image-buttons">
						<PicturePopup
							id={id}
							label={`${name} 고르기`}
							value={value}
							prompt={value ? '다른 그림 고르기…' : '그림 고르기…'}
							onPick={onChange}
							fromPicked={fromPicked}
						/>
						<UploadButton name={`${name} 올리기`} uploading={uploading} onFile={(file) => void upload(file)} />
						{value && (
							<button type="button" className="projects-button" onClick={() => onChange(undefined)}>
								지우기
							</button>
						)}
					</div>
					<input
						type="text"
						className="projects-input mono"
						aria-label={`${name} 주소`}
						value={value ?? ''}
						placeholder="/imgs/… 또는 https://"
						spellCheck={false}
						onChange={(event) => onChange(optional(event.target.value))}
					/>
					{error && <p className="projects-error">{error}</p>}
				</div>
			</div>
			{zoomed && value && <Lightbox items={[toUrl(value)]} start={0} onClose={() => setZoomed(false)} />}
		</FormRow>
	);
};
