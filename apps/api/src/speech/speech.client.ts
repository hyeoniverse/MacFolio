import { Injectable } from '@nestjs/common';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { ProviderFailure, refuse } from '../common/demo.js';
import type { SpeechLang, SpeechProvider } from './rules.js';

export { ProviderFailure } from '../common/demo.js';

/**
 * 공급자마다 MP3를 받아 온다. 테스트에서는 이 클래스를 가짜로 바꿔 바깥에 요청하지 않는다.
 * 목소리는 HYEONIVERSE 갤러리가 쓰는 것과 같다 (Fish: 20대 여성 / Aviavox English V2, Google: Neural2-A·F, Edge: SunHi·Ava)
 */
const FISH_VOICE: Record<SpeechLang, string> = {
	ko: '0ccd4dc7f23d4935956e225e158484c9',
	en: '81b6895ca7484e308ca5f30f7b0a4255',
};
const GOOGLE_VOICE: Record<SpeechLang, [string, string]> = {
	ko: ['ko-KR', 'ko-KR-Neural2-A'],
	en: ['en-US', 'en-US-Neural2-F'],
};
const EDGE_VOICE: Record<SpeechLang, string> = { ko: 'ko-KR-SunHiNeural', en: 'en-US-AvaNeural' };

@Injectable()
export class SpeechClient {
	async fish(key: string, text: string, lang: SpeechLang): Promise<Buffer> {
		const response = await fetch('https://api.fish.audio/v1/tts', {
			method: 'POST',
			headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', model: 's2.1-pro-free' },
			body: JSON.stringify({ text, format: 'mp3', mp3_bitrate: 128, reference_id: FISH_VOICE[lang] }),
			signal: AbortSignal.timeout(20_000),
		});
		if (!response.ok) throw refuse(response);
		return Buffer.from(await response.arrayBuffer());
	}

	async google(key: string, text: string, lang: SpeechLang): Promise<Buffer> {
		const [languageCode, name] = GOOGLE_VOICE[lang];
		const response = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
			body: JSON.stringify({
				input: { text },
				voice: { languageCode, name },
				audioConfig: { audioEncoding: 'MP3', sampleRateHertz: 24000 },
			}),
			signal: AbortSignal.timeout(20_000),
		});
		if (!response.ok) throw refuse(response);
		const json = (await response.json().catch(() => null)) as { audioContent?: string } | null;
		if (!json?.audioContent) throw new ProviderFailure('빈 응답');
		return Buffer.from(json.audioContent, 'base64');
	}

	/** Edge: 키도 한도도 없지만 비공식이라 언제 막힐지 모른다 (마지막 대체) */
	async edge(text: string, lang: SpeechLang): Promise<Buffer> {
		const tts = new MsEdgeTTS();
		try {
			await tts.setMetadata(EDGE_VOICE[lang], OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
			const { audioStream } = tts.toStream(text);
			const chunks: Buffer[] = [];
			for await (const chunk of audioStream) chunks.push(chunk as Buffer);
			return Buffer.concat(chunks);
		} finally {
			tts.close();
		}
	}

	synthesize(provider: SpeechProvider, keys: { fish?: string; google?: string }, text: string, lang: SpeechLang) {
		if (provider === 'fish') {
			if (!keys.fish) throw new ProviderFailure('키가 없습니다');
			return this.fish(keys.fish, text, lang);
		}
		if (provider === 'google') {
			if (!keys.google) throw new ProviderFailure('키가 없습니다');
			return this.google(keys.google, text, lang);
		}
		return this.edge(text, lang);
	}
}
