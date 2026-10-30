import { useEffect, useState } from 'react';
import { fetchFileText } from '@/shared/api/remoteFileApi';

/** 주소로 받은 파일의 글자. 받는 중이면 text가 null, 실패하면 error */
export function useRemoteText(url: string | null): { text: string | null; error: boolean } {
	const [state, setState] = useState<{ url: string | null; text: string | null; error: boolean }>({
		url: null,
		text: null,
		error: false,
	});
	useEffect(() => {
		if (!url) return;
		let alive = true;
		fetchFileText(url).then(
			(text) => alive && setState({ url, text, error: false }),
			() => alive && setState({ url, text: null, error: true })
		);
		return () => {
			alive = false;
		};
	}, [url]);
	return state.url === url ? { text: state.text, error: state.error } : { text: null, error: false };
}
