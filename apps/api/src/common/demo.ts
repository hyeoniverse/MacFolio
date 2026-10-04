// 방문자가 실제 AI 서비스를 불러 보는 데모(음성, 번역, 요약, 커버)가 함께 쓰는 규칙: 받을 글, 하루 상한, 공급자 실패.
// 바깥 호출 없이 시험할 수 있게 여기에 모은다.

/** 주소·메일처럼 데모에 필요 없는 것과, 데모에 어울리지 않는 말 몇 가지 */
export const BLOCKED = [/https?:\/\//i, /www\./i, /\S+@\S+\.\S+/, /씨발|시발|병신|좆|fuck|shit|bitch/i];

/** 받을 수 없는 입력 (사람이 읽을 이유를 담는다. 400으로 바꾼다) */
export class DemoInputError extends Error {}

/**
 * 몸통의 글 한 칸을 검사해 정리한다. 맞지 않으면 DemoInputError를 던진다.
 * lines가 아니면 줄바꿈까지 띄어쓰기 하나로 줄이고, lines면 줄바꿈은 남기고 빈 줄만 줄인다
 */
export function demoText(
	value: unknown,
	{ max, empty, refused, lines = false }: { max: number; empty: string; refused: string; lines?: boolean }
) {
	const raw = typeof value === 'string' ? value : '';
	const text = lines
		? raw
				.replace(/\r\n?/g, '\n')
				.replace(/[^\S\n]+/g, ' ')
				.replace(/ ?\n ?/g, '\n')
				.replace(/\n{3,}/g, '\n\n')
				.trim()
		: raw.replace(/\s+/g, ' ').trim();
	if (!text) throw new DemoInputError(empty);
	if ([...text].length > max) throw new DemoInputError(`${max}자까지만 받습니다.`);
	// 제어 문자는 받지 않는다 (줄바꿈은 위에서 정리했다)
	if (/[^\P{Cc}\n]/u.test(text)) throw new DemoInputError('읽을 수 없는 글자가 있습니다.');
	if (BLOCKED.some((pattern) => pattern.test(text))) throw new DemoInputError(refused);
	return text;
}

/** 아는 공급자만 남긴다 (화면에서 막아 둔 공급자) */
export const pickProviders = <P extends string>(all: readonly P[], value: unknown): P[] =>
	Array.isArray(value) ? all.filter((provider) => (value as unknown[]).includes(provider)) : [];

/**
 * 하루 상한: IP(HMAC)마다 perIp번, 사이트 전체 total번. 날짜(UTC)가 바뀌면 새로 센다.
 * 서버 메모리에만 둔다 (다시 띄우면 처음부터 센다): 데모 비용을 막는 용도라 그 정도면 충분하다
 */
export class DailyQuota {
	private day = '';
	private total = 0;
	private byIp = new Map<string, number>();

	constructor(
		private readonly perIp: number,
		private readonly totalLimit: number,
		private readonly today: () => string = () => new Date().toISOString().slice(0, 10)
	) {}

	private roll() {
		const day = this.today();
		if (day === this.day) return;
		this.day = day;
		this.total = 0;
		this.byIp.clear();
	}

	/** 이 IP가 오늘 더 만들 수 있는 횟수 (사이트 전체 남은 횟수보다 많을 수 없다) */
	remaining(ipHash: string) {
		this.roll();
		return Math.max(0, Math.min(this.perIp - (this.byIp.get(ipHash) ?? 0), this.totalLimit - this.total));
	}

	/** 한 번 쓴다. 남은 횟수가 없으면 false */
	take(ipHash: string) {
		if (this.remaining(ipHash) <= 0) return false;
		this.byIp.set(ipHash, (this.byIp.get(ipHash) ?? 0) + 1);
		this.total += 1;
		return true;
	}

	/** 만들지 못했으면(모든 공급자 실패) 쓴 횟수를 돌려준다 */
	refund(ipHash: string) {
		this.roll();
		const used = this.byIp.get(ipHash) ?? 0;
		if (used <= 0) return;
		this.byIp.set(ipHash, used - 1);
		this.total = Math.max(0, this.total - 1);
	}

	get limits() {
		return { perIp: this.perIp, total: this.totalLimit };
	}
}

/** 공급자가 거절한 이유 (화면에 그대로 보인다: 키·주소는 담지 않는다) */
export class ProviderFailure extends Error {}

/** 실패한 응답을 화면에 보일 이유로 바꾼다 */
export const refuse = (response: Response) => {
	if (response.status === 401 || response.status === 403) return new ProviderFailure('키가 거절되었습니다');
	// DeepL은 한도를 456으로 알린다
	if (response.status === 402 || response.status === 456) return new ProviderFailure('사용 한도에 닿았습니다');
	if (response.status === 429) return new ProviderFailure('요청이 너무 많습니다');
	return new ProviderFailure(`응답 ${response.status}`);
};

/** 공급자 하나를 시도한 결과 (화면이 차례대로 그린다) */
export interface Attempt<P extends string> {
	provider: P;
	state: 'ok' | 'fail' | 'skip';
	reason?: string;
}

/**
 * 차례대로 시도한다: 막아 둔 공급자는 건너뛰고, 실패하면 다음으로. 처음 성공한 값과 시도 기록을 돌려준다.
 * 모두 실패하면 value 없이 기록만. ProviderFailure가 아닌 실패(연결 끊김 등)는 warn으로 남긴다
 */
export async function tryInOrder<P extends string, T>(
	order: readonly P[],
	skip: readonly P[],
	call: (provider: P) => Promise<T>,
	warn: (message: string) => void
): Promise<{ attempts: Attempt<P>[]; provider?: P; value?: T }> {
	const attempts: Attempt<P>[] = [];
	for (const provider of order) {
		if (skip.includes(provider)) {
			attempts.push({ provider, state: 'skip', reason: '막아 둠' });
			continue;
		}
		try {
			const value = await call(provider);
			attempts.push({ provider, state: 'ok' });
			return { attempts, provider, value };
		} catch (error) {
			if (!(error instanceof ProviderFailure)) warn(`${provider}: ${String(error)}`);
			const reason = error instanceof ProviderFailure ? error.message : '연결하지 못했습니다';
			attempts.push({ provider, state: 'fail', reason });
		}
	}
	return { attempts };
}

/** 실패한 시도를 한 줄로 (에러 응답은 message만 나가므로 이유를 여기에 담는다) */
export const failureLine = <P extends string>(attempts: Attempt<P>[], names: Record<P, string>) =>
	attempts
		.filter((attempt) => attempt.state !== 'ok')
		.map((attempt) => `${names[attempt.provider]}: ${attempt.reason ?? ''}`)
		.join(' · ');
