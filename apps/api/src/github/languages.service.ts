import { Injectable, NotFoundException } from '@nestjs/common';
import { CODE_PROJECT_REPOS, githubRepoOf } from '@macfolio/desktop-core/site';
import { SiteService } from '../site/site.service.js';
import { Cached } from './cached.js';
import { GithubApiClient } from './github-api.client.js';
import { languageShares, type RepoLanguage } from './languages.js';
import { isFullName } from './showcase.js';

/** 받은 언어 비율을 들고 있는 시간 (언어 비율은 천천히 바뀐다) */
export const LANGUAGES_TTL_MS = 6 * 60 * 60 * 1000;
/** GitHub에 없는 저장소(404)라는 답을 들고 있는 시간 */
export const LANGUAGES_MISSING_TTL_MS = 30 * 60 * 1000;

const NOT_FOUND = '이 사이트의 프로젝트 저장소가 아니거나 GitHub에서 찾을 수 없습니다.';

/**
 * 프로젝트 저장소의 언어 비율 (repo 템플릿 옆 칸의 Languages). 누구나 읽는다.
 * 아무 저장소나 대신 묻는 통로가 되지 않게, 이 사이트의 프로젝트가 가리키는 저장소만 받는다:
 * 코드의 프로젝트(CODE_PROJECT_REPOS)와 관리자가 저장한 프로젝트(SiteContent.projects)의 주소. 그 밖은 404.
 * 방문자마다 GitHub에 묻지 않도록 저장소마다 6시간(없는 저장소는 30분) 들고 있고,
 * GitHub에 닿지 못하면 마지막으로 받은 값을, 그것도 없으면 502를 준다 (화면은 프로젝트의 주 언어로 그린다)
 */
@Injectable()
export class LanguagesService {
	private readonly caches = new Map<string, Cached<{ languages: RepoLanguage[] | null }>>();

	constructor(
		private readonly site: SiteService,
		private readonly github: GithubApiClient
	) {}

	/** 들고 있는 값을 모두 버린다 (시험) */
	clearCache() {
		this.caches.clear();
	}

	/** 이 사이트의 프로젝트가 가리키는 저장소 (소문자 owner/이름 → GitHub에 적힌 이름) */
	private async projectRepos(): Promise<Map<string, string>> {
		const names = [...CODE_PROJECT_REPOS];
		// DB를 읽지 못해도 코드의 프로젝트는 그대로 받는다
		const view = await this.site.view().catch(() => null);
		for (const entry of view?.projects?.items ?? []) {
			const repo = githubRepoOf(entry.override?.url);
			if (repo) names.push(`${repo.owner}/${repo.name}`);
		}
		return new Map(names.map((name) => [name.toLowerCase(), name]));
	}

	async languages(owner: string, name: string, now = Date.now()): Promise<RepoLanguage[]> {
		const asked = `${owner}/${name}`;
		if (!isFullName(asked)) throw new NotFoundException(NOT_FOUND);
		const key = asked.toLowerCase();
		const fullName = (await this.projectRepos()).get(key);
		if (!fullName) throw new NotFoundException(NOT_FOUND);

		let cache = this.caches.get(key);
		if (!cache) this.caches.set(key, (cache = new Cached()));
		const ttl = cache.peek()?.languages === null ? LANGUAGES_MISSING_TTL_MS : LANGUAGES_TTL_MS;
		const [repoOwner, repoName] = fullName.split('/');
		const { languages } = await cache.get(now, ttl, async () => {
			const raw = await this.github.languages(repoOwner, repoName);
			return { languages: raw ? languageShares(raw) : null };
		});
		if (!languages) throw new NotFoundException(NOT_FOUND);
		return languages;
	}
}
