import { Injectable } from '@nestjs/common';
import { ProviderFailure, refuse } from '../common/demo.js';
import type { CoverProvider } from './rules.js';

/** 만든 그림 (바이트와 종류) */
export interface CoverImage {
	bytes: Buffer;
	mime: string;
}

/** Cloudflare Tunnel은 100초 안에 답하지 않으면 끊는다. 그 안에 끝나게 Hugging Face는 80초에 끊는다 */
const HUGGINGFACE_TIMEOUT_MS = 80_000;
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
 * 주소와 요청 모양은 HYEONIVERSE(api/cover/ai-generate)의 Hugging Face 쪽과 같다
 */
@Injectable()
export class CoverClient {
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

	generate(provider: CoverProvider, keys: { huggingface?: string }, prompt: string) {
		const key = keys[provider];
		if (!key) throw new ProviderFailure('키가 없습니다');
		return this.huggingface(key, prompt);
	}
}
