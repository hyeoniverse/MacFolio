// 메모 정리 내용을 API에서 읽고 쓴다. 누구나 읽고, 관리자만 쓴다 (서버가 세션으로 확인한다).
import { EMPTY_ORGANIZATION, normalizeOrganization, type Organization } from '@macfolio/desktop-core/memo';
import { api, apiFetch } from '@/shared/api/client';

/** 정리 내용을 읽는다. API가 없거나 읽지 못하면 빈 정리 내용 (글은 원래 폴더대로 보인다) */
export async function fetchOrganization(apiUrl: string, fetchImpl: typeof fetch = fetch): Promise<Organization> {
	try {
		return normalizeOrganization(await api('/memo/organization', { apiUrl, fetchImpl }));
	} catch {
		return EMPTY_ORGANIZATION;
	}
}

/** 정리 내용을 저장한다. 성공하면 true (관리자가 아니거나 규칙을 어기면 서버가 거절한다) */
export async function saveOrganization(
	apiUrl: string,
	organization: Organization,
	fetchImpl: typeof fetch = fetch
): Promise<boolean> {
	try {
		const response = await apiFetch('/memo/organization', { method: 'PUT', json: organization, apiUrl, fetchImpl });
		return response.ok;
	} catch {
		return false;
	}
}
