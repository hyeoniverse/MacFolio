import { env } from '@/shared/config/env';
import { ApiError, apiFetch } from './client';

/**
 * 글에 올린 파일의 내용을 글자로 받는다 (텍스트 편집기의 Markdown·글자 파일, Safari의 HTML).
 * 올린 파일은 API 서버의 /files/<id>에 있으므로 API 주소로 시작하는 것만 받는다
 */
export async function fetchFileText(url: string): Promise<string> {
	return (await fetchFile(url)).text();
}

/** 글에 올린 파일을 내려받기 위해 내용 그대로 받는다 */
export async function fetchFileBlob(url: string): Promise<Blob> {
	return (await fetchFile(url)).blob();
}

async function fetchFile(url: string): Promise<Response> {
	const apiUrl = env.apiUrl;
	if (!apiUrl || !url.startsWith(`${apiUrl}/`)) throw new ApiError(0, ['이 사이트에 올린 파일만 열 수 있습니다.']);
	const response = await apiFetch(url.slice(apiUrl.length));
	if (!response.ok) throw new ApiError(response.status, ['파일을 불러오지 못했습니다.']);
	return response;
}
