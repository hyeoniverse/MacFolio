// GitHub에서 받은 값을 한동안 들고 있는 칸 (프로필·활동·저장소 언어가 함께 쓴다)

/** 받은 값을 한동안 들고 있다. 동시에 여럿이 물어도 한 번만 받고, 새로 받지 못하면 마지막 값을 준다 */
export class Cached<T> {
	private entry: { value: T; at: number } | null = null;
	private inflight: Promise<T> | null = null;

	/** 들고 있는 값 (오래되었어도) */
	peek(): T | null {
		return this.entry?.value ?? null;
	}

	/** 들고 있는 값을 버린다 (시험) */
	clear() {
		this.entry = null;
	}

	/** 다음에 물을 때 새로 받게 한다 */
	expire() {
		if (this.entry) this.entry.at = Number.NEGATIVE_INFINITY;
	}

	get(now: number, ttlMs: number, fetch: () => Promise<T>): Promise<T> {
		if (this.entry && now - this.entry.at < ttlMs) return Promise.resolve(this.entry.value);
		this.inflight ??= fetch()
			.then((value) => {
				this.entry = { value, at: now };
				return value;
			})
			.catch((error: unknown) => {
				// 새로 받지 못하면 오래된 값이라도 준다 (GitHub 장애·요청 제한)
				if (this.entry) return this.entry.value;
				throw error;
			})
			.finally(() => {
				this.inflight = null;
			});
		return this.inflight;
	}
}
