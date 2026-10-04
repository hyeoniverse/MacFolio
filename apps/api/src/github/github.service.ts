import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseContributions, toActivities, type ActivityItem, type Contributions } from './activity.js';
import { GithubApiClient } from './github-api.client.js';
import {
	DEFAULT_SHOWCASE,
	isFullName,
	mergeCandidates,
	parseShowcase,
	sameRepo,
	toProfile,
	toRepoCard,
	type GithubProfile,
	type RepoCard,
} from './showcase.js';

const ROW_ID = 1;

export interface ProfileResponse {
	profile: GithubProfile;
	/** 프로필 README (Markdown). 없으면 null */
	readme: string | null;
	/** README 안의 상대 주소(./profile/stats.svg)를 풀 기준 주소 */
	readmeBaseUrl: string;
	/** 고른 저장소 (고른 순서). 지워졌거나 비공개가 된 저장소는 빠진다 */
	repos: RepoCard[];
	/** GitHub에서 받은 때 */
	fetchedAt: string;
}

export interface ActivityResponse {
	/** 기여 달력. 읽지 못했으면 null */
	contributions: Contributions | null;
	/** 최근 공개 활동 (최근 것부터) */
	events: ActivityItem[];
	fetchedAt: string;
}

/** 받은 값을 한동안 들고 있다. 동시에 여럿이 물어도 한 번만 받고, 새로 받지 못하면 마지막 값을 준다 */
class Cached<T> {
	private entry: { value: T; at: number } | null = null;
	private inflight: Promise<T> | null = null;

	/** 들고 있는 값 (오래되었어도) */
	peek(): T | null {
		return this.entry?.value ?? null;
	}

	/** 들고 있는 값을 버린다 (시험) */
	clear() {
		this.entry = null;
	}

	/** 다음에 물을 때 새로 받게 한다 */
	expire() {
		if (this.entry) this.entry.at = Number.NEGATIVE_INFINITY;
	}

	get(now: number, ttlMs: number, fetch: () => Promise<T>): Promise<T> {
		if (this.entry && now - this.entry.at < ttlMs) return Promise.resolve(this.entry.value);
		this.inflight ??= fetch()
			.then((value) => {
				this.entry = { value, at: now };
				return value;
			})
			.catch((error: unknown) => {
				// 새로 받지 못하면 오래된 값이라도 준다 (GitHub 장애·요청 제한)
				if (this.entry) return this.entry.value;
				throw error;
			})
			.finally(() => {
				this.inflight = null;
			});
		return this.inflight;
	}
}

/**
 * GitHub 앱에 보여 줄 관리자의 GitHub 프로필·README·저장소와 활동.
 * 방문자마다 GitHub에 묻지 않도록 받은 값을 한동안 들고 있다 (토큰이 없으면 서버 IP로 시간당 60번까지).
 * GitHub에 닿지 못하면 마지막으로 받은 값을 그대로 준다.
 */
@Injectable()
export class GithubService {
	private readonly profileCache = new Cached<ProfileResponse>();
	private readonly activityCache = new Cached<ActivityResponse>();

	/** 들고 있는 값을 모두 버린다 (시험마다 GitHub에서 새로 받게) */
	clearCache() {
		this.profileCache.clear();
		this.activityCache.clear();
	}

	constructor(
		private readonly prisma: PrismaService,
		private readonly github: GithubApiClient,
		@Inject(APP_CONFIG) private readonly config: AppConfig
	) {}

	/** 받은 값을 들고 있는 시간. 토큰이 있으면 10분, 없으면 30분 */
	get ttlMs() {
		return (this.config.githubToken ? 10 : 30) * 60 * 1000;
	}

	/** 고른 저장소 이름 (아직 고른 적 없으면 기본 목록) */
	async showcase(): Promise<string[]> {
		const row = await this.prisma.githubShowcase.findUnique({ where: { id: ROW_ID } });
		return row ? (row.repos as string[]) : DEFAULT_SHOWCASE;
	}

	private async login() {
		const raw = await this.github.userById(this.config.auth.adminGithubId);
		if (!raw) throw new NotFoundException('관리자 GitHub 계정을 찾을 수 없습니다.');
		return toProfile(raw);
	}

	/** 이름 목록 → 카드. 내 저장소 목록에 있으면 그것을 쓰고, 없을 때만 따로 묻는다 (요청 수를 줄인다) */
	private async cards(names: string[], known: RepoCard[]): Promise<RepoCard[]> {
		const cards = await Promise.all(
			names.map(async (name) => {
				const found = known.find((repo) => sameRepo(repo.fullName, name));
				if (found) return found;
				const raw = await this.github.repo(name);
				return raw ? toRepoCard(raw) : null;
			})
		);
		return cards.filter((card): card is RepoCard => card !== null);
	}

	private async fetchProfile(now: number): Promise<ProfileResponse> {
		const profile = await this.login();
		const [readme, own, names] = await Promise.all([
			this.github.profileReadme(profile.login),
			this.github.userRepos(profile.login),
			this.showcase(),
		]);
		const known = own.map(toRepoCard).filter((card): card is RepoCard => card !== null);
		return {
			profile,
			readme,
			readmeBaseUrl: `https://raw.githubusercontent.com/${profile.login}/${profile.login}/HEAD/`,
			repos: await this.cards(names, known),
			fetchedAt: new Date(now).toISOString(),
		};
	}

	/** GitHub 앱이 그릴 값. 들고 있는 값이 오래되었으면 새로 받는다 (동시에 여럿이 물어도 한 번만) */
	profile(now = Date.now()): Promise<ProfileResponse> {
		return this.profileCache.get(now, this.ttlMs, () => this.fetchProfile(now));
	}

	/**
	 * 기여 달력과 최근 공개 활동. 둘 중 하나만 받지 못하면 그 부분은 이전 값을 쓰고,
	 * 둘 다 받지 못하면 마지막으로 받은 값을 준다
	 */
	activity(now = Date.now()): Promise<ActivityResponse> {
		return this.activityCache.get(now, this.ttlMs, async () => {
			const login = this.profileCache.peek()?.profile.login ?? (await this.login()).login;
			const [html, events] = await Promise.allSettled([
				this.github.contributionsHtml(login),
				this.github.userEvents(login),
			]);
			if (html.status === 'rejected' && events.status === 'rejected') throw html.reason;
			const previous = this.activityCache.peek();
			return {
				contributions:
					html.status === 'fulfilled'
						? html.value
							? parseContributions(html.value)
							: null
						: (previous?.contributions ?? null),
				events: events.status === 'fulfilled' ? toActivities(events.value) : (previous?.events ?? []),
				fetchedAt: new Date(now).toISOString(),
			};
		});
	}

	/** 고를 수 있는 저장소 (관리자): 내 공개 저장소, 공개로 속한 조직의 저장소, 이미 고른 저장소 */
	async candidates(): Promise<{ selected: string[]; repos: RepoCard[] }> {
		const { login } = await this.login();
		const [own, orgs, selected] = await Promise.all([
			this.github.userRepos(login),
			this.github.userOrgs(login),
			this.showcase(),
		]);
		const orgRepos = await Promise.all(orgs.map((org) => this.github.orgRepos(org)));
		const groups = [own, ...orgRepos].map((list) =>
			list.map(toRepoCard).filter((card): card is RepoCard => card !== null)
		);
		const selectedCards = await this.cards(selected, groups.flat());
		return { selected, repos: mergeCandidates(selectedCards, groups) };
	}

	/** 직접 입력한 저장소를 찾는다 (관리자). 없거나 비공개면 404 */
	async lookup(fullName: string): Promise<RepoCard> {
		if (!isFullName(fullName)) throw new BadRequestException('저장소는 "owner/이름"으로 적어 주세요.');
		const raw = await this.github.repo(fullName);
		const card = raw ? toRepoCard(raw) : null;
		if (!card) throw new NotFoundException('공개 저장소를 찾을 수 없습니다.');
		return card;
	}

	/** 고른 저장소를 바꾼다 (관리자). 새로 더한 저장소는 GitHub에 있는지 확인한다. 바꾸면 GitHub 앱 값을 새로 받는다 */
	async saveShowcase(input: unknown, admin: string): Promise<{ repos: string[] }> {
		const parsed = parseShowcase(input);
		if ('errors' in parsed) throw new BadRequestException(parsed.errors);
		const before = await this.showcase();
		// 이름은 GitHub에 적힌 대로 (대소문자) 저장한다. 이미 고른 저장소는 저장해 둔 이름을, 새로 더한 저장소는 GitHub에 묻는다
		const repos: string[] = [];
		for (const name of parsed.value) {
			const kept = before.find((old) => sameRepo(old, name));
			repos.push(kept ?? (await this.lookup(name)).fullName);
		}

		await this.prisma.githubShowcase.upsert({
			where: { id: ROW_ID },
			create: { id: ROW_ID, repos, updatedBy: admin },
			update: { repos, updatedBy: admin },
		});
		// 다음에 물을 때 새로 받는다 (GitHub에 닿지 못하면 이전 값을 준다)
		this.profileCache.expire();
		return { repos };
	}
}
