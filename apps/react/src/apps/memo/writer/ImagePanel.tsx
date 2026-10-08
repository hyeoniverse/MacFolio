import { useEffect, useId, useState } from 'react';
import { env } from '@/shared/config/env';
import { captionParts } from '../caption';
import { baseName, uploadAndInsert } from './attachments';
import type { FormatAction, ImageState } from './editorControls';
import {
	creditCaption,
	fetchProviders,
	PROVIDER_LABEL,
	searchStock,
	trackUnsplash,
	type StockPhoto,
	type StockProvider,
} from './stockApi';
import Button from '@/shared/ui/button/Button';

/** 이미지로 고를 수 있는 형식 (API가 바로 보여 주는 형식과 같다) */
const IMAGE_TYPES = 'image/png,image/jpeg,image/gif,image/webp';

type Tab = 'file' | 'url' | StockProvider;
const TABS: { id: Tab; label: string }[] = [
	{ id: 'file', label: '내 파일' },
	{ id: 'url', label: '주소' },
	{ id: 'unsplash', label: 'Unsplash' },
	{ id: 'pexels', label: 'Pexels' },
];

/** 넣기 전 확인: 미리 보기, 설명(대체 텍스트), 캡션 */
const Details = ({
	preview,
	alt,
	caption,
	onAlt,
	onCaption,
	submit,
	onSubmit,
	onBack,
}: {
	preview: string;
	alt: string;
	caption: string;
	onAlt: (value: string) => void;
	onCaption: (value: string) => void;
	submit: string;
	onSubmit: () => void;
	onBack?: () => void;
}) => {
	const id = useId();
	return (
		<form
			className="memo-image-details"
			onSubmit={(event) => {
				event.preventDefault();
				onSubmit();
			}}
		>
			<img className="memo-image-preview" src={preview} alt="" />
			<label>
				<span>설명</span>
				<input
					aria-label="이미지 설명"
					aria-describedby={`${id}-alt`}
					placeholder="이미지에 보이는 내용"
					value={alt}
					autoFocus
					onChange={(e) => onAlt(e.target.value)}
				/>
				<small id={`${id}-alt`} className="memo-field-hint">
					화면 읽기 프로그램이 이미지 대신 읽어 주는 글입니다.
				</small>
			</label>
			<label>
				<span>캡션</span>
				<input
					aria-label="캡션"
					aria-describedby={`${id}-caption`}
					placeholder="이미지 아래에 보일 글"
					value={caption}
					onChange={(e) => onCaption(e.target.value)}
				/>
				<small id={`${id}-caption`} className="memo-field-hint">
					비워 두어도 됩니다.
				</small>
			</label>
			{caption && captionParts(caption).some((part) => part.href) && (
				<p className="memo-image-credit">
					{captionParts(caption).map((part, index) =>
						part.href ? (
							<a key={index} href={part.href} target="_blank" rel="noopener noreferrer">
								{part.text}
							</a>
						) : (
							<span key={index}>{part.text}</span>
						)
					)}
				</p>
			)}
			<div className="memo-image-actions">
				{onBack && (
					<button type="button" className="memo-image-back" onClick={onBack}>
						다시 고르기
					</button>
				)}
				<Button tone="primary" type="submit" className="memo-image-submit">
					{submit}
				</Button>
			</div>
		</form>
	);
};

/** 내 파일: 고르면 미리 보고 설명을 쓴 뒤 올린다 */
const FileTab = ({ onDone }: { onDone: () => void }) => {
	const [picked, setPicked] = useState<{ file: File; preview: string } | null>(null);
	const [alt, setAlt] = useState('');
	const [caption, setCaption] = useState('');
	useEffect(() => () => (picked ? URL.revokeObjectURL(picked.preview) : undefined), [picked]);

	if (picked)
		return (
			<Details
				preview={picked.preview}
				alt={alt}
				caption={caption}
				onAlt={setAlt}
				onCaption={setCaption}
				submit="올려서 넣기"
				onBack={() => setPicked(null)}
				onSubmit={() => {
					void uploadAndInsert([picked.file], { alt: alt.trim(), title: caption.trim(), asImage: true });
					onDone();
				}}
			/>
		);
	return (
		<label className="memo-image-drop">
			<i className="fa-regular fa-image" aria-hidden="true" />
			<strong>파일에서 고르기…</strong>
			<span>PNG·JPEG·GIF·WebP 파일을 10MB까지 올릴 수 있습니다. 본문에 붙여넣거나 끌어다 놓아도 됩니다.</span>
			<input
				type="file"
				accept={IMAGE_TYPES}
				aria-label="이미지 파일"
				onChange={(event) => {
					const file = event.target.files?.[0];
					event.target.value = '';
					if (!file) return;
					setPicked({ file, preview: URL.createObjectURL(file) });
					setAlt(baseName(file.name));
				}}
			/>
		</label>
	);
};

const UrlTab = ({ run, onDone }: { run: (action: FormatAction) => void; onDone: () => void }) => {
	const [src, setSrc] = useState('');
	const [alt, setAlt] = useState('');
	const [caption, setCaption] = useState('');
	const valid = /^https?:\/\/\S+$/.test(src.trim());
	return (
		<div className="memo-image-url">
			<input
				aria-label="이미지 주소"
				placeholder="https://… 이미지 주소"
				value={src}
				autoFocus
				onChange={(e) => setSrc(e.target.value)}
			/>
			{valid && (
				<Details
					preview={src.trim()}
					alt={alt}
					caption={caption}
					onAlt={setAlt}
					onCaption={setCaption}
					submit="넣기"
					onSubmit={() => {
						run({ type: 'image', src: src.trim(), alt: alt.trim(), title: caption.trim() });
						onDone();
					}}
				/>
			)}
		</div>
	);
};

/** Unsplash·Pexels에서 찾기 */
const StockTab = ({
	provider,
	enabled,
	run,
	onDone,
}: {
	provider: StockProvider;
	enabled: boolean | undefined;
	run: (action: FormatAction) => void;
	onDone: () => void;
}) => {
	const [query, setQuery] = useState('');
	const [results, setResults] = useState<{ q: string; photos: StockPhoto[]; page: number; hasMore: boolean } | null>(
		null
	);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [picked, setPicked] = useState<StockPhoto | null>(null);
	const hintId = useId();
	const [alt, setAlt] = useState('');
	const [caption, setCaption] = useState('');

	if (enabled === false)
		return (
			<p className="memo-image-note">
				{PROVIDER_LABEL[provider]} API 키가 서버에 없습니다. <code>apps/api/.env</code>의{' '}
				<code>{provider === 'unsplash' ? 'UNSPLASH_ACCESS_KEY' : 'PEXELS_API_KEY'}</code>를 채워 주세요.
			</p>
		);

	const search = async (q: string, page: number) => {
		setLoading(true);
		setError('');
		try {
			const found = await searchStock(env.apiUrl, provider, q, page);
			setResults((prev) => ({
				q,
				page,
				hasMore: found.hasMore,
				photos: page > 1 && prev ? [...prev.photos, ...found.results] : found.results,
			}));
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : String(reason));
		} finally {
			setLoading(false);
		}
	};

	if (picked)
		return (
			<Details
				preview={picked.thumb}
				alt={alt}
				caption={caption}
				onAlt={setAlt}
				onCaption={setCaption}
				submit="넣기"
				onBack={() => setPicked(null)}
				onSubmit={() => {
					run({ type: 'image', src: picked.url, alt: alt.trim(), title: caption.trim() });
					if (picked.provider === 'unsplash') void trackUnsplash(env.apiUrl, picked.id);
					onDone();
				}}
			/>
		);

	return (
		<div className="memo-stock">
			<form
				className="memo-stock-search"
				role="search"
				onSubmit={(event) => {
					event.preventDefault();
					if (query.trim()) void search(query.trim(), 1);
				}}
			>
				<input
					aria-label={`${PROVIDER_LABEL[provider]}에서 찾기`}
					aria-describedby={`${hintId}-search`}
					placeholder="찾을 사진"
					value={query}
					autoFocus
					onChange={(e) => setQuery(e.target.value)}
				/>
				<button type="submit" disabled={!query.trim() || loading}>
					찾기
				</button>
			</form>
			<small id={`${hintId}-search`} className="memo-field-hint">
				영어로 검색하면 더 많은 사진을 찾을 수 있습니다.
			</small>
			{error && (
				<p className="memo-image-note problem" role="alert">
					{error}
				</p>
			)}
			{results && results.photos.length === 0 && !loading && <p className="memo-image-note">찾은 사진이 없습니다.</p>}
			{results && results.photos.length > 0 && (
				<div className="memo-stock-grid" role="list" aria-label="찾은 사진">
					{results.photos.map((photo) => (
						<button
							key={`${photo.provider}-${photo.id}`}
							type="button"
							role="listitem"
							aria-label={`${photo.alt || '사진'}, ${photo.author}`}
							title={photo.author}
							style={{ backgroundColor: photo.color ?? undefined }}
							onClick={() => {
								setPicked(photo);
								setAlt(photo.alt);
								setCaption(creditCaption(photo));
							}}
						>
							<img src={photo.thumb} alt="" loading="lazy" />
						</button>
					))}
				</div>
			)}
			{results?.hasMore && (
				<button
					type="button"
					className="memo-stock-more"
					disabled={loading}
					onClick={() => void search(results.q, results.page + 1)}
				>
					더 보기
				</button>
			)}
			{loading && (
				<p className="memo-image-note" role="status">
					찾는 중…
				</p>
			)}
		</div>
	);
};

/**
 * 이미지 넣기·고치기. 고른 이미지가 있으면 그 설명과 캡션을 고치고, 없으면 내 파일·주소·Unsplash·Pexels에서 넣는다.
 * 어느 쪽이든 넣기 전에 미리 보고 설명(대체 텍스트)과 캡션을 쓴다.
 */
const ImagePanel = ({
	editing,
	run,
	onDone,
}: {
	editing: ImageState | null;
	run: (action: FormatAction) => void;
	onDone: () => void;
}) => {
	const [tab, setTab] = useState<Tab>('file');
	const [providers, setProviders] = useState<Record<StockProvider, boolean> | null>(null);
	const [alt, setAlt] = useState(editing?.alt ?? '');
	const [caption, setCaption] = useState(editing?.title ?? '');

	useEffect(() => {
		if (editing) return;
		let alive = true;
		fetchProviders(env.apiUrl)
			.then((value) => alive && setProviders(value))
			.catch(() => alive && setProviders({ unsplash: false, pexels: false }));
		return () => {
			alive = false;
		};
	}, [editing]);

	if (editing)
		return (
			<Details
				preview={editing.src}
				alt={alt}
				caption={caption}
				onAlt={setAlt}
				onCaption={setCaption}
				submit="적용"
				onSubmit={() => {
					run({ type: 'imageAttrs', alt: alt.trim(), title: caption.trim() });
					onDone();
				}}
			/>
		);

	return (
		<div className="memo-image-panel">
			<div className="memo-image-tabs" role="tablist" aria-label="이미지 가져올 곳">
				{TABS.map(({ id, label }) => (
					<button
						key={id}
						type="button"
						role="tab"
						aria-selected={tab === id}
						className={tab === id ? 'on' : ''}
						onClick={() => setTab(id)}
					>
						{label}
					</button>
				))}
			</div>
			<div key={tab} className="motion-swap" role="tabpanel" aria-label={TABS.find((item) => item.id === tab)?.label}>
				{tab === 'file' && <FileTab onDone={onDone} />}
				{tab === 'url' && <UrlTab run={run} onDone={onDone} />}
				{(tab === 'unsplash' || tab === 'pexels') && (
					<StockTab key={tab} provider={tab} enabled={providers?.[tab]} run={run} onDone={onDone} />
				)}
			</div>
		</div>
	);
};

export default ImagePanel;
