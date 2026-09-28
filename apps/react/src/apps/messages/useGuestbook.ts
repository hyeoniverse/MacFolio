import { useCallback, useEffect, useState } from 'react';
import { validateInput, type GuestbookEntry, type GuestbookInput, type GuestbookInputErrors } from './guestbook';
import { getGuestbookRepository, type DeleteResult } from './repository';

type Status = 'loading' | 'ready' | 'error';

/** 방명록 목록을 불러오고, 작성·삭제한다. */
export function useGuestbook() {
	const [entries, setEntries] = useState<GuestbookEntry[]>([]);
	const [status, setStatus] = useState<Status>('loading');

	useEffect(() => {
		let cancelled = false;
		getGuestbookRepository()
			.list()
			.then((list) => {
				if (cancelled) return;
				setEntries(list);
				setStatus('ready');
			})
			.catch(() => !cancelled && setStatus('error'));
		return () => {
			cancelled = true;
		};
	}, []);

	/** 검증에 실패하면 필드별 에러를, 성공하면 빈 객체를 돌려준다 */
	const create = useCallback(async (input: GuestbookInput): Promise<GuestbookInputErrors> => {
		const { value, errors } = validateInput(input);
		if (Object.keys(errors).length > 0) return errors;
		const entry = await getGuestbookRepository().create(value);
		setEntries((prev) => [...prev, entry]);
		return {};
	}, []);

	const remove = useCallback(async (id: string, password: string): Promise<DeleteResult> => {
		const result = await getGuestbookRepository().remove(id, password);
		if (result === 'deleted') setEntries((prev) => prev.filter((entry) => entry.id !== id));
		return result;
	}, []);

	return { entries, status, create, remove };
}
