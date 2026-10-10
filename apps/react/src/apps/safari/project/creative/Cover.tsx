import React, { useState } from 'react';
import { useLiveDemo } from './liveDemo';
import { QuotaChip } from './QuotaChip';

/** 커버 데모의 스타일: HYEONIVERSE 커버 선택창의 열 가지 가운데 넷 */
const COVER_STYLES = [
	{ key: 'abstract', label: 'Abstract' },
	{ key: 'minimal', label: 'Minimal' },
	{ key: 'watercolor', label: 'Watercolor' },
	{ key: '3d-render', label: '3D' },
] as const;
type CoverProvider = 'cloudflare' | 'huggingface';
const COVER_NAME: Record<CoverProvider, string> = { cloudflare: 'Cloudflare', huggingface: 'Hugging Face' };
/** 제목 글자 수 (서버도 같은 값으로 막는다) */
const MAX_COVER_CHARS = 60;

/** 커버가 없을 때의 바탕 (HYEONIVERSE처럼 제목으로 고른 그라데이션: 같은 제목은 늘 같은 색) */
const seededGradient = (seed: string) => {
	let hash = 0;
	for (const char of seed) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
	const hue = Math.abs(hash) % 360;
	return `linear-gradient(135deg, oklch(62% 0.14 ${hue}), oklch(38% 0.1 ${(hue + 70) % 360}))`;
};

/**
 * AI 커버: 제목을 쓰고 그리면, MacFolio API가 Cloudflare Workers AI(실패하면 Hugging Face)의 FLUX로 커버를 실제로 그린다.
 * 무료 할당 안에서 쓰도록 IP마다 하루 1번, 사이트 전체 5번
 */
export const Cover: React.FC = () => {
	const [title, setTitle] = useState('혼자 설계하고 운영하는 포트폴리오');
	const [style, setStyle] = useState<(typeof COVER_STYLES)[number]['key']>('abstract');
	const [busy, setBusy] = useState(false);
	const [made, setMade] = useState<{ src: string; title: string; note: string } | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const { quota, send } = useLiveDemo<{
		provider: CoverProvider;
		attempts?: { provider: CoverProvider; state: string; reason?: string }[];
		image: string;
		mime: string;
	}>('cover', '그리');
	const left = quota?.remaining;

	const draw = async () => {
		setBusy(true);
		setMessage(null);
		const { data, error } = await send({ title, style });
		setBusy(false);
		if (!data?.image) {
			setMessage(error ?? '커버를 그리지 못했습니다.');
			return;
		}
		// 앞 공급자가 실패해 넘어왔으면 그 이유를 함께 보여 준다
		const failed = data.attempts?.find((attempt) => attempt.state === 'fail');
		const note = failed
			? `${COVER_NAME[failed.provider]} 실패(${failed.reason ?? ''}) → ${COVER_NAME[data.provider]}로 그렸습니다`
			: `${COVER_NAME[data.provider] ?? 'FLUX'}로 그렸습니다`;
		setMade({ src: `data:${data.mime || 'image/jpeg'};base64,${data.image}`, title, note });
	};

	const status = message
		? message
		: busy
			? '그리는 중 (수십 초 걸릴 수 있습니다)'
			: made
				? made.note
				: '제목을 고치고 그려 보세요';

	return (
		<div className="cd-cover">
			<p className="cd-live-info">
				<i className="fa-solid fa-circle-info" />
				실제로 그립니다. 그림은 무료 한도가 작아 하루 {quota?.perIp ?? 1}번(사이트 전체 {quota?.total ?? 5}번)만 그릴 수
				있습니다.
			</p>
			<label className="cd-voice-input">
				<span>제목</span>
				<input
					value={title}
					maxLength={MAX_COVER_CHARS}
					disabled={busy}
					onChange={(event) => setTitle(event.target.value)}
				/>
				<small>
					{[...title].length}/{MAX_COVER_CHARS}
				</small>
			</label>
			<div className="cd-translate-head">
				<div className="cd-seg" role="group" aria-label="스타일">
					{COVER_STYLES.map((option) => (
						<button
							key={option.key}
							type="button"
							aria-pressed={style === option.key}
							disabled={busy}
							onClick={() => setStyle(option.key)}
						>
							{option.label}
						</button>
					))}
				</div>
				<span className="cd-chip">
					<i className="fa-solid fa-image" /> Cloudflare → Hugging Face
				</span>
			</div>
			{/* 16:9 자리를 늘 잡아 두고 그림만 바꾼다. 그리기 전에는 제목으로 고른 그라데이션 (HYEONIVERSE의 빈 커버) */}
			<figure
				className="cd-cover-frame"
				data-busy={busy || undefined}
				style={{ backgroundImage: seededGradient(made?.title ?? title) }}
			>
				{made ? (
					<img src={made.src} alt={`"${made.title}" 제목으로 그린 커버`} />
				) : (
					<figcaption>{title.trim() || '제목'}</figcaption>
				)}
				{busy && <span className="cd-shimmer" aria-hidden />}
			</figure>
			<div className="cd-voice-foot">
				<button
					type="button"
					className="cd-primary"
					onClick={() => void draw()}
					disabled={busy || !title.trim() || left === 0}
				>
					<i className="fa-solid fa-wand-magic-sparkles" /> 커버 그리기
				</button>
				<p role="status" title={status}>
					{status}
				</p>
				<QuotaChip quota={quota} fallback={1} />
			</div>
		</div>
	);
};
