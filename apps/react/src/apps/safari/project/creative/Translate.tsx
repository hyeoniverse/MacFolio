import React, { useState } from 'react';
import { cssVars } from '@/shared/lib/cssVars';
import { useLiveDemo } from './liveDemo';
import { QuotaChip } from './QuotaChip';

/** 번역 데모의 칸: HYEONIVERSE 작업물의 실제 한국어 부제와 설명. 고칠 수 있다 */
const FIELDS = [
	{ label: '부제', ko: '디자인 시스템부터 관리자 CMS 까지 혼자 설계하고 운영하는 포트폴리오 사이트' },
	{
		label: '설명',
		ko: '흩어져 있던 프로젝트와 글을 한 곳에서 보여 주고 계속 갱신하기 위해 만든 개인 포트폴리오입니다.',
	},
	{ label: '갤러리 대본 4', ko: '방문자가 보는 사이트와, 그 사이트를 운영하는 관리자 CMS를 함께 만들었습니다.' },
];
/** 세 칸을 합친 글자 수 상한 (서버도 같은 값으로 막는다) */
const MAX_TRANSLATE_CHARS = 200;
type TranslateProvider = 'deepl' | 'google';
const TRANSLATE_NAME: Record<TranslateProvider, string> = { deepl: 'DeepL', google: 'Google' };

/**
 * 번역: 한국어 칸을 고치고 EN을 누르면, MacFolio API가 DeepL(실패하면 Google)로 세 칸을 한 번에 실제로 번역한다.
 * 비용 때문에 세 칸 합쳐 200자까지, IP마다 하루 3번(사이트 전체 50번). 상태가 바뀌어도 칸 크기는 그대로다
 */
export const Translate: React.FC = () => {
	const [lang, setLang] = useState<'ko' | 'en'>('ko');
	const [ko, setKo] = useState(() => FIELDS.map((field) => field.ko));
	const [made, setMade] = useState<{ texts: string[]; provider: TranslateProvider; note?: string } | null>(null);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [run, setRun] = useState(0);
	const { quota, send } = useLiveDemo<{
		provider: TranslateProvider;
		attempts?: { provider: TranslateProvider; state: string; reason?: string }[];
		texts: string[];
	}>('translate', '번역하');
	const used = [...ko.join('')].length;
	const left = quota?.remaining;

	const translate = async () => {
		setLang('en');
		if (ko.some((text) => !text.trim())) {
			setMessage('비어 있는 한국어 칸이 있습니다.');
			return;
		}
		setBusy(true);
		setMessage(null);
		const { data, error } = await send({ texts: ko, from: 'ko', to: 'en' });
		setBusy(false);
		if (!data || !Array.isArray(data.texts)) {
			setMessage(error ?? '번역하지 못했습니다.');
			return;
		}
		// 앞 공급자가 실패해 넘어왔으면 그 이유를 함께 보여 준다
		const failed = data.attempts?.find((attempt) => attempt.state === 'fail');
		setMade({
			texts: data.texts,
			provider: data.provider,
			note: failed ? `${TRANSLATE_NAME[failed.provider]} 실패(${failed.reason ?? ''}) → ` : undefined,
		});
		setRun((n) => n + 1);
	};
	const switchTo = (value: 'ko' | 'en') => {
		setLang(value);
		if (value === 'en' && !made && !busy && !message) void translate();
	};

	const status = message
		? message
		: lang === 'ko'
			? '한국어 칸을 고치고 EN을 눌러 보세요. 비어 있는 영어 칸을 번역해 채웁니다'
			: busy
				? 'DeepL로 번역하는 중'
				: made
					? `${made.note ?? ''}${TRANSLATE_NAME[made.provider]}로 번역했습니다`
					: '다시 번역을 눌러 보세요';

	return (
		<div className="cd-translate">
			<div className="cd-translate-head">
				<div className="cd-seg" role="group" aria-label="편집 언어">
					{(['ko', 'en'] as const).map((value) => (
						<button key={value} type="button" aria-pressed={lang === value} onClick={() => switchTo(value)}>
							{value.toUpperCase()}
						</button>
					))}
				</div>
				<button
					type="button"
					className="cd-ghost"
					onClick={() => void translate()}
					disabled={busy || !used || used > MAX_TRANSLATE_CHARS || left === 0}
				>
					다시 번역
				</button>
				<span className="cd-chip">
					<i className="fa-solid fa-language" /> {made ? TRANSLATE_NAME[made.provider] : 'DeepL → Google'}
				</span>
				<QuotaChip quota={quota} fallback={3} />
			</div>
			<p className="cd-live-info">
				<i className="fa-solid fa-circle-info" />
				실제로 번역합니다. 세 칸 합쳐 {MAX_TRANSLATE_CHARS}자까지, 하루 {quota?.perIp ?? 3}번(사이트 전체{' '}
				{quota?.total ?? 50}번) 번역할 수 있습니다.
			</p>
			<dl className="cd-fields">
				{FIELDS.map((field, i) => (
					<div key={field.label}>
						<dt>{field.label}</dt>
						{/* 두 줄 자리를 늘 잡아 두고 내용만 바꾼다 (상태에 따라 아래가 밀리지 않게) */}
						<dd data-busy={(lang === 'en' && busy) || undefined}>
							{lang === 'ko' ? (
								<textarea
									aria-label={`${field.label} (한국어)`}
									value={ko[i]}
									rows={2}
									disabled={busy}
									onChange={(event) => {
										const next = [...ko];
										next[i] = event.target.value;
										setKo(next);
										// 원문이 바뀌면 옛 번역은 맞지 않으므로 비운다
										setMade(null);
										setMessage(null);
									}}
								/>
							) : busy ? (
								<span className="cd-shimmer" />
							) : made ? (
								<span className="cd-typed" key={run} style={cssVars({ i })}>
									{made.texts[i]}
								</span>
							) : (
								<em>비어 있음</em>
							)}
						</dd>
					</div>
				))}
			</dl>
			<div className="cd-live-foot">
				<p className="cd-hint" role="status" data-error={(message && !busy) || undefined}>
					{status}
				</p>
				<small data-over={used > MAX_TRANSLATE_CHARS || undefined}>
					{used}/{MAX_TRANSLATE_CHARS}
				</small>
			</div>
		</div>
	);
};
