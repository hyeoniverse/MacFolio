import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config.js';

type Json = Record<string, unknown>;

/**
 * GitHub REST API (공개 정보만 읽는다). 테스트에서는 이 클래스를 가짜로 바꿔 GitHub에 요청하지 않는다.
 * 돌려주는 값은 GitHub JSON 그대로이고, 모양 맞추기는 showcase.ts가 한다.
 * 없는 것(404)은 null, 연결할 수 없거나 요청 제한에 걸리면 502.
 */
@Injectable()
export class GithubApiClient {
	constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

	private async request(path: string, accept = 'application/vnd.github+json'): Promise<Response | null> {
		const headers: Record<string, string> = {
			Accept: accept,
			'User-Agent': 'macfolio-api',
			'X-GitHub-Api-Version': '2022-11-28',
		};
		if (this.config.githubToken) headers.Authorization = `Bearer ${this.config.githubToken}`;
		const response = await fetch(`https://api.github.com${path}`, { headers }).catch(() => {
			throw new BadGatewayException('GitHub에 연결할 수 없습니다.');
		});
		if (response.status === 404) return null;
		if (!response.ok) {
			const limited = response.headers.get('x-ratelimit-remaining') === '0';
			throw new BadGatewayException(
				limited ? 'GitHub API 요청 제한에 걸렸습니다.' : `GitHub가 요청을 거절했습니다 (${response.status}).`
			);
		}
		return response;
	}

	private async json<T>(path: string): Promise<T | null> {
		const response = await this.request(path);
		return response ? ((await response.json()) as T) : null;
	}

	/** 숫자 ID로 계정을 찾는다 (계정 이름이 바뀌어도 같은 사람) */
	userById(id: number) {
		return this.json<Json>(`/user/${id}`);
	}

	/** 계정이 가진 공개 저장소 (최근에 올린 순서, 100개까지) */
	async userRepos(login: string) {
		return (
			(await this.json<Json[]>(`/users/${encodeURIComponent(login)}/repos?type=owner&sort=pushed&per_page=100`)) ?? []
		);
	}

	/** 계정이 공개로 속한 조직 */
	async userOrgs(login: string) {
		const orgs = (await this.json<Json[]>(`/users/${encodeURIComponent(login)}/orgs?per_page=100`)) ?? [];
		return orgs.map((org) => String(org.login));
	}

	/** 조직의 공개 저장소 (최근에 올린 순서, 100개까지) */
	async orgRepos(org: string) {
		return (
			(await this.json<Json[]>(`/orgs/${encodeURIComponent(org)}/repos?type=public&sort=pushed&per_page=100`)) ?? []
		);
	}

	/** 저장소 하나 */
	repo(fullName: string) {
		const [owner, name] = fullName.split('/');
		return this.json<Json>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`);
	}

	/** 공개 활동 (GitHub가 최근 90일, 300개까지 준다. 첫 100개만 받는다) */
	async userEvents(login: string) {
		return (await this.json<Json[]>(`/users/${encodeURIComponent(login)}/events/public?per_page=100`)) ?? [];
	}

	/**
	 * 기여 달력 (프로필 화면의 잔디). API에는 토큰 없이 읽는 길이 없어 github.com의 HTML 조각을 받는다.
	 * 읽기는 activity.ts의 parseContributions가 한다. 없는 계정이면 null
	 */
	async contributionsHtml(login: string): Promise<string | null> {
		const response = await fetch(`https://github.com/users/${encodeURIComponent(login)}/contributions`, {
			headers: { Accept: 'text/html', 'User-Agent': 'macfolio-api' },
		}).catch(() => {
			throw new BadGatewayException('GitHub에 연결할 수 없습니다.');
		});
		if (response.status === 404) return null;
		if (!response.ok) throw new BadGatewayException(`GitHub가 요청을 거절했습니다 (${response.status}).`);
		return response.text();
	}

	/** 프로필 README (계정 이름과 같은 저장소의 README.md). 없으면 null */
	async profileReadme(login: string): Promise<string | null> {
		const name = encodeURIComponent(login);
		const response = await this.request(`/repos/${name}/${name}/readme`, 'application/vnd.github.raw+json');
		return response ? response.text() : null;
	}
}
