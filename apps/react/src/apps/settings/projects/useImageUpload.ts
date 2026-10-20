import { useState } from 'react';
import { uploadFile } from '@/apps/memo/writer/attachmentsApi';
import { env } from '@/shared/config/env';

/** 그림 올리기 (POST /files): 올리는 중인지와 실패한 까닭을 함께 둔다. 그림 칸과 화면 목록의 줄이 같이 쓴다 */
export function useImageUpload(onUploaded: (url: string) => void) {
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const upload = async (file: File | undefined) => {
		if (!file) return;
		setUploading(true);
		setError(null);
		try {
			const uploaded = await uploadFile(env.apiUrl, file);
			if (!uploaded.image) throw new Error('그림 파일만 올릴 수 있습니다.');
			onUploaded(uploaded.url);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : '올리지 못했습니다.');
		} finally {
			setUploading(false);
		}
	};
	return { uploading, error, upload };
}
