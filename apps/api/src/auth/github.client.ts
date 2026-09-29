import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export interface GithubUser {
	/** 바뀌지 않는 숫자 ID */
	id: number;
	/** 계정 이름 (바꿀 수 있다) */
	login: string;
	avatarUrl: string;
}

/**
 * GitHub OAuth와 사용자 정보 API. 테스트에서는 이 클래스를 가짜로 바꿔 GitHub에 요청하지 않는다.
 */
@Injectable()
export class GithubClient {
	/** 인가 코드를 액세스 토큰으로 바꾼다. 실패하면 null */
	async exchangeCode(params: {
		clientId: string;
		clientSecret: string;
		code: string;
		redirectUri: string;
	}): Promise<string | null> {
		const response = await fetch('https://github.com/login/oauth/access_token', {
			method: 'POST',
			headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
			body: JSON.stringify({
				client_id: params.clientId,
				client_secret: params.clientSecret,
				code: params.code,
				redirect_uri: params.redirectUri,
			}),
		}).catch(() => {
			throw new ServiceUnavailableException('GitHub에 연결할 수 없습니다.');
		});
		const body = (await response.json().catch(() => ({}))) as { access_token?: string };
		return response.ok && body.access_token ? body.access_token : null;
	}

	/** 토큰 주인의 계정 */
	async getUser(accessToken: string): Promise<GithubUser | null> {
		const response = await fetch('https://api.github.com/user', {
			headers: {
				Accept: 'application/vnd.github+json',
				Authorization: `Bearer ${accessToken}`,
				'User-Agent': 'macfolio-api',
			},
		}).catch(() => {
			throw new ServiceUnavailableException('GitHub에 연결할 수 없습니다.');
		});
		if (!response.ok) return null;
		const body = (await response.json()) as { id: number; login: string; avatar_url: string };
		return { id: body.id, login: body.login, avatarUrl: body.avatar_url };
	}
}
