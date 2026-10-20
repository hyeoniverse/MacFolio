/** 고를 수 있는 필드를 바꾼다: undefined가 된 키는 지운다 */
export const patchOf = <T extends object>(item: T, change: Partial<T>): T => {
	const next = { ...item, ...change };
	for (const key of Object.keys(change) as (keyof T)[]) if (next[key] === undefined) delete next[key];
	return next;
};
