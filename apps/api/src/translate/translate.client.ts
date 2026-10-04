import { Injectable } from '@nestjs/common';
import { ProviderFailure, refuse } from '../common/demo.js';
import type { TranslateLang, TranslateProvider } from './rules.js';

/**
 * 공급자마다 번역을 받아 온다. 테스트에서는 이 클래스를 가짜로 바꿔 바깥에 요청하지 않는다.
 * 주소와 요청 모양은 HYEONIVERSE(lib/api/translationProviders)와 같다
 */
const DEEPL_LANG: Record<TranslateLang, string> = { ko: 'KO', en: 'EN' };

/** 무료 키는 끝이 ":fx"이고 api-free 주소만 받는다. 유료 키는 api 주소 */
const deeplUrl = (key: string) =>
	key.endsWith(':fx') ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';

/** 보낸 칸마다 번역이 왔는지 본다. 하나라도 비면 그 공급자는 실패로 (다음 공급자가 전부 다시 번역한다) */
const complete = (texts: string[], translated: (string | undefined)[] | undefined) => {
	const result = texts.map((_, i) => translated?.[i]?.trim() ?? '');
	if (result.some((text) => !text)) throw new ProviderFailure('빈 응답');
	return result;
};

@Injectable()
export class TranslateClient {
	async deepl(key: string, texts: string[], from: TranslateLang, to: TranslateLang): Promise<string[]> {
		const response = await fetch(deeplUrl(key), {
			method: 'POST',
			headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ text: texts, source_lang: DEEPL_LANG[from], target_lang: DEEPL_LANG[to] }),
			signal: AbortSignal.timeout(20_000),
		});
		if (!response.ok) throw refuse(response);
		const json = (await response.json().catch(() => null)) as { translations?: { text?: string }[] } | null;
		return complete(
			texts,
			json?.translations?.map((item) => item.text)
		);
	}

	async google(key: string, texts: string[], from: TranslateLang, to: TranslateLang): Promise<string[]> {
		const response = await fetch(
			`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ q: texts, source: from, target: to, format: 'text' }),
				signal: AbortSignal.timeout(20_000),
			}
		);
		if (!response.ok) throw refuse(response);
		const json = (await response.json().catch(() => null)) as {
			data?: { translations?: { translatedText?: string }[] };
		} | null;
		return complete(
			texts,
			json?.data?.translations?.map((item) => item.translatedText)
		);
	}

	translate(
		provider: TranslateProvider,
		keys: { deepl?: string; google?: string },
		texts: string[],
		from: TranslateLang,
		to: TranslateLang
	) {
		const key = keys[provider];
		if (!key) throw new ProviderFailure('키가 없습니다');
		return provider === 'deepl' ? this.deepl(key, texts, from, to) : this.google(key, texts, from, to);
	}
}
