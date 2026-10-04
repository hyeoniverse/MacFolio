import { Injectable } from '@nestjs/common';
import { ProviderFailure, refuse } from '../common/demo.js';
import type { CoverProvider } from './rules.js';

/** 만든 그림 (바이트와 종류) */
export interface CoverImage {
	bytes: Buffer;
	mime: string;
}

/**
 * Cloudflare Tunnel은 100초 안에 답하지 않으면 끊는다. 두 공급자를 이어 시도해도 그 안에 끝나게
 * NanoBanana는 50초까지 기다리고, Hugging Face는 40초에 끊는다
 */
const NANOBANANA_WAIT_MS = 50_000;
const NANOBANANA_POLL_MS = 3_000;
const HUGGINGFACE_TIMEOUT_MS = 40_000;
/** 받은 그림이 이보다 크면 버린다 (응답이 너무 커지지 않게) */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const imageOf = async (response: Response): Promise<CoverImage> => {
	const type = response.headers.get('content-type')?.split(';')[0].trim() ?? '';
	const bytes = Buffer.from(await response.arrayBuffer());
	if (!bytes.length) throw new ProviderFailure('빈 그림');
	if (bytes.length > MAX_IMAGE_BYTES) throw new ProviderFailure('그림이 너무 큽니다');
	return { bytes, mime: type.startsWith('image/') ? type : 'image/jpeg' };
};

/**
 * 공급자마다 그림을 받아 온다. 테스트에서는 이 클래스를 가짜로 바꿔 바깥에 요청하지 않는다.
 * 주소와 요청 모양은 HYEONIVERSE(api/cover/ai-generate)와 같다
 */
@Injectable()
export class CoverClient {
	/** NanoBanana: 만들기를 맡기고, 끝날 때까지 물어본 뒤 결과 주소에서 그림을 받는다 */
	async nanobanana(key: string, prompt: string): Promise<CoverImage> {
		const auth = { Authorization: `Bearer ${key}` };
		const created = await fetch('https://api.nanobananaapi.ai/api/v1/nanobanana/generate', {
			method: 'POST',
			headers: { ...auth, 'Content-Type': 'application/json' },
			// TEXTTOIAMGE는 그쪽 API의 철자 그대로다
			body: JSON.stringify({ prompt, type: 'TEXTTOIAMGE', numImages: 1, image_size: '16:9' }),
			signal: AbortSignal.timeout(20_000),
		});
		if (!created.ok) throw refuse(created);
		// HTTP 200 안의 code로 실패를 알린다 (401 키, 402 크레딧 등)
		const job = (await created.json().catch(() => ({}))) as { code?: number; data?: { taskId?: string } };
		if (job.code !== 200) throw refuse(new Response(null, { status: Number(job.code) || 502 }));
		const taskId = job.data?.taskId;
		if (!taskId) throw new ProviderFailure('빈 응답');

		const deadline = Date.now() + NANOBANANA_WAIT_MS;
		while (Date.now() < deadline) {
			await new Promise((resolve) => setTimeout(resolve, NANOBANANA_POLL_MS));
			const status = await fetch(
				`https://api.nanobananaapi.ai/api/v1/nanobanana/record-info?taskId=${encodeURIComponent(taskId)}`,
				{ headers: auth, signal: AbortSignal.timeout(10_000) }
			);
			if (!status.ok) throw refuse(status);
			const record = (await status.json().catch(() => ({}))) as {
				code?: number;
				data?: {
					successFlag?: number;
					response?: { resultImageUrl?: string };
					info?: { resultImageUrl?: string };
				};
			};
			const url = record.data?.response?.resultImageUrl || record.data?.info?.resultImageUrl;
			if (record.data?.successFlag === 1 && url) {
				const image = await fetch(url, { signal: AbortSignal.timeout(20_000) });
				if (!image.ok) throw new ProviderFailure('그림을 받지 못했습니다');
				return imageOf(image);
			}
			if (record.code && record.code >= 400) throw new ProviderFailure('만들지 못했습니다');
		}
		throw new ProviderFailure('시간이 너무 걸립니다');
	}

	/** Hugging Face FLUX.1-schnell: 그림 바이트를 바로 돌려준다 */
	async huggingface(key: string, prompt: string): Promise<CoverImage> {
		const response = await fetch('https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell', {
			method: 'POST',
			headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ inputs: prompt, parameters: { width: 1792, height: 1024 } }),
			signal: AbortSignal.timeout(HUGGINGFACE_TIMEOUT_MS),
		});
		if (!response.ok) throw refuse(response);
		return imageOf(response);
	}

	generate(provider: CoverProvider, keys: { nanobanana?: string; huggingface?: string }, prompt: string) {
		const key = keys[provider];
		if (!key) throw new ProviderFailure('키가 없습니다');
		return provider === 'nanobanana' ? this.nanobanana(key, prompt) : this.huggingface(key, prompt);
	}
}
