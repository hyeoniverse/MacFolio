import React, { useState } from 'react';
import { useLiveDemo } from './liveDemo';
import { QuotaChip } from './QuotaChip';

/** 요약할 글: HYEONIVERSE 작업물의 실제 설명 (고치거나 붙여 넣을 수 있다) */
const SUMMARY_SOURCE =
	'작업물과 글을 보여 주는 공개 화면부터, 그 글을 직접 쓰고 고치는 관리자 화면까지 한 저장소에 담은 개인 포트폴리오입니다. 흩어져 있던 프로젝트와 글을 한 곳에서 보여 주고 계속 갱신하기 위해 만들었습니다. 공개 페이지와 디자인 시스템, 글 편집기와 관리자 CMS까지 한 사람이 설계하고 운영합니다. 글과 작업물은 한국어와 영어 칸을 따로 두고, 한쪽만 써도 나머지는 번역이 채웁니다.';
/** 요약을 만든 공급자 이름 (서버의 summary/rules.ts와 같다. Groq가 기본, 실패하면 Gemini) */
const SUMMARY_PROVIDER_NAME = { groq: 'Groq', gemini: 'Gemini' } as const;

/** 한 번에 요약하는 글자 수 (서버도 같은 값으로 막는다) */
const MAX_SUMMARY_CHARS = 800;

/**
 * AI 요약: 글을 고치거나 붙여 넣고 발행하면, MacFolio API가 Groq(실패하면 Gemini)로 한국어·영어 요약을 실제로 만든다.
 * 머리를 누르면 접고 펼친다. 비용 때문에 800자까지, IP마다 하루 3번(사이트 전체 50번)
 */
export const Summary: React.FC = () => {
	const [text, setText] = useState(SUMMARY_SOURCE);
	const [lang, setLang] = useState<'ko' | 'en'>('ko');
	const [open, setOpen] = useState(true);
	const [busy, setBusy] = useState(false);
	const [made, setMade] = useState<{ ko: string; en: string; provider?: string } | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const { quota, send } = useLiveDemo<{ ko: string; en: string; provider?: 'groq' | 'gemini' }>('summary', '요약하');
	const left = quota?.remaining;

	const publish = async () => {
		setBusy(true);
		setOpen(true);
		setMessage(null);
		const { data, error } = await send({ text });
		setBusy(false);
		if (!data?.ko || !data.en) {
			setMessage(error ?? '요약을 만들지 못했습니다.');
			return;
		}
		setMade({ ko: data.ko, en: data.en, provider: data.provider && SUMMARY_PROVIDER_NAME[data.provider] });
	};

	return (
		<div className="cd-summary">
			<div className="cd-translate-head">
				<button
					type="button"
					className="cd-primary"
					disabled={busy || !text.trim() || left === 0}
					onClick={() => void publish()}
				>
					<i className="fa-solid fa-paper-plane" /> 발행
				</button>
				<span className="cd-chip">Gemini</span>
				<div className="cd-seg" role="group" aria-label="보는 언어">
					{(['ko', 'en'] as const).map((value) => (
						<button key={value} type="button" aria-pressed={lang === value} onClick={() => setLang(value)}>
							{value.toUpperCase()}
						</button>
					))}
				</div>
				<QuotaChip quota={quota} fallback={3} />
			</div>
			<p className="cd-live-info">
				<i className="fa-solid fa-circle-info" />
				실제로 요약합니다. 글을 고치거나 붙여 넣고 발행해 보세요. {MAX_SUMMARY_CHARS}자까지, 하루 {quota?.perIp ?? 3}
				번(사이트 전체 {quota?.total ?? 50}번) 만들 수 있습니다.
			</p>
			<label className="cd-voice-input">
				<span>본문</span>
				<textarea
					value={text}
					maxLength={MAX_SUMMARY_CHARS}
					rows={4}
					disabled={busy}
					onChange={(event) => setText(event.target.value)}
				/>
				<small>
					{[...text].length}/{MAX_SUMMARY_CHARS}
				</small>
			</label>
			<div className="cd-summary-box" data-open={open || undefined}>
				<button type="button" className="cd-summary-head" aria-expanded={open} onClick={() => setOpen(!open)}>
					<span>
						<i className="fa-solid fa-wand-magic-sparkles" /> AI 요약
					</span>
					<i className="fa-solid fa-chevron-down" />
				</button>
				<div className="cd-summary-body">
					<div>
						{/* 세 줄 자리를 늘 잡아 두고 내용만 바꾼다 */}
						<div className="cd-summary-text" data-empty={(!made && !busy) || undefined}>
							{busy ? (
								<p className="cd-dots">
									<i />
									<i />
									<i /> 요약을 만드는 중
								</p>
							) : made ? (
								<p key={`${lang}-${made.ko}`} className="cd-typed">
									{made[lang]}
								</p>
							) : (
								<p>발행하면 여기에 한국어·영어 요약이 붙습니다</p>
							)}
						</div>
					</div>
				</div>
			</div>
			<div className="cd-live-foot">
				<p className="cd-hint" role="status" data-error={(message && !busy) || undefined}>
					{message ??
						(made
							? `${made.provider ? `${made.provider}로 만든` : '만든'} 요약입니다. KO·EN으로 바꿔 보세요`
							: '예시: HYEONIVERSE 작업물의 설명')}
				</p>
			</div>
		</div>
	);
};
