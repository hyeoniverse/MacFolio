// 글에 넣는 이미지와 첨부 파일을 API(/files)에 올리고 커서 자리에 넣는다. 모양 규칙은 attachments.ts
import { env } from '@/shared/config/env';
import { notify } from '@/desktop/notifications/notificationStore';
import { editorControls } from './editorControls';
import { baseName, MAX_UPLOAD_BYTES, type Uploaded } from './attachments';

/** 파일을 올린다. 실패하면 이유를 담은 Error */
export async function uploadFile(apiUrl: string, file: File): Promise<Uploaded> {
	if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name}: 10MB까지 올릴 수 있습니다.`);
	const form = new FormData();
	form.append('file', file);
	let response: Response;
	try {
		response = await fetch(`${apiUrl}/files`, { method: 'POST', body: form, credentials: 'include' });
	} catch {
		throw new Error('서버에 연결하지 못했습니다.');
	}
	if (response.status === 401) throw new Error('관리자 로그인이 끝났습니다. 다시 로그인해 주세요.');
	if (response.status === 413) throw new Error(`${file.name}: 10MB까지 올릴 수 있습니다.`);
	if (!response.ok) throw new Error(`${file.name}을(를) 올리지 못했습니다.`);
	const body = (await response.json()) as Omit<Uploaded, 'url'> & { path: string };
	return {
		id: body.id,
		name: body.name,
		type: body.type,
		size: body.size,
		image: body.image,
		url: `${apiUrl}${body.path}`,
	};
}

/**
 * 파일을 차례로 올리고 커서 자리에 넣는다. 이미지는 그림으로, 나머지는 첨부 파일 링크로.
 * 도구 막대, 붙여넣기, 끌어다 놓기가 함께 쓴다. 실패하면 알림으로 이유를 보여 준다.
 * @param asImage true면 이미지가 아닌 파일은 넣지 않는다 (이미지 단추로 고른 경우)
 */
export async function uploadAndInsert(
	files: File[],
	{ alt, title, asImage = false }: { alt?: string; title?: string; asImage?: boolean } = {}
) {
	const bump = (delta: number) =>
		editorControls.setState((state) => ({ ...state, uploading: state.uploading + delta }));
	for (const file of files) {
		bump(1);
		try {
			const uploaded = await uploadFile(env.apiUrl, file);
			const run = editorControls.getState().run;
			if (!run) continue;
			if (uploaded.image) run({ type: 'image', src: uploaded.url, alt: alt || baseName(uploaded.name), title });
			else if (asImage) throw new Error(`${file.name}: 이미지(PNG·JPEG·GIF·WebP)만 넣을 수 있습니다.`);
			else run({ type: 'attachment', href: uploaded.url, name: uploaded.name, size: uploaded.size });
		} catch (error) {
			notify({
				app: 'memo',
				title: '파일을 넣지 못했습니다',
				body: error instanceof Error ? error.message : String(error),
			});
		} finally {
			bump(-1);
		}
	}
}
