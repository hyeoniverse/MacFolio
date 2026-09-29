import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GithubClient } from './github.client.js';
import { hashToken, randomToken, SESSION_TTL_MS } from './session.js';

export interface AdminIdentity {
	/** GitHub 계정 */
	login: string;
}

/**
 * 관리자 로그인. GitHub로 로그인한 계정의 숫자 ID가 ADMIN_GITHUB_ID와 같을 때만 세션을 만든다.
 * 계정 이름이 아니라 ID로 비교한다: 이름은 바꿀 수 있고, 바꾼 옛 이름은 다른 사람이 가져갈 수 있다.
 * 비밀번호를 보관하지 않는다. 세션 토큰은 쿠키에만 있고 DB에는 해시만 있다.
 */
@Injectable()
export class AuthService {
	private readonly logger = new Logger(AuthService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly github: GithubClient,
		@Inject(APP_CONFIG) private readonly config: AppConfig
	) {}

	/** GitHub OAuth App 값이 설정되어 있는지 */
	get enabled() {
		return Boolean(this.config.auth.githubClientId && this.config.auth.githubClientSecret);
	}

	get callbackUrl() {
		return `${this.config.apiUrl}/auth/github/callback`;
	}

	/** GitHub 로그인 화면 주소. 공개 프로필만 읽으면 되므로 권한(scope)을 달라고 하지 않는다 */
	authorizeUrl(state: string) {
		const url = new URL('https://github.com/login/oauth/authorize');
		url.searchParams.set('client_id', this.config.auth.githubClientId ?? '');
		url.searchParams.set('redirect_uri', this.callbackUrl);
		url.searchParams.set('state', state);
		url.searchParams.set('allow_signup', 'false');
		return url.toString();
	}

	/**
	 * GitHub에서 돌아온 인가 코드로 로그인한다.
	 * 관리자면 새 세션 토큰을, 관리자가 아닌 계정이면 null을 돌려준다.
	 */
	async signIn(code: string, now = new Date()): Promise<{ token: string; login: string } | null> {
		const { githubClientId, githubClientSecret, adminGithubId } = this.config.auth;
		const accessToken = await this.github.exchangeCode({
			clientId: githubClientId ?? '',
			clientSecret: githubClientSecret ?? '',
			code,
			redirectUri: this.callbackUrl,
		});
		const user = accessToken ? await this.github.getUser(accessToken) : null;
		if (!user) throw new UnauthorizedException('GitHub 로그인에 실패했습니다.');
		if (user.id !== adminGithubId) {
			// 관리자가 아닌 계정의 시도는 기록만 하고 돌려보낸다 (GitHub 계정 이름과 ID는 공개 정보다)
			this.logger.warn(`관리자가 아닌 GitHub 계정의 로그인 시도: ${user.login} (${user.id})`);
			return null;
		}

		// 만료된 세션은 새로 로그인할 때 치운다
		await this.prisma.adminSession.deleteMany({ where: { expiresAt: { lte: now } } });
		const token = randomToken();
		await this.prisma.adminSession.create({
			data: {
				tokenHash: hashToken(token),
				githubId: user.id,
				githubLogin: user.login,
				expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
			},
		});
		return { token, login: user.login };
	}

	/** 쿠키의 세션 토큰으로 관리자를 찾는다. 없거나 만료되었으면 null */
	async findAdmin(token: string | undefined, now = new Date()): Promise<AdminIdentity | null> {
		if (!token) return null;
		const session = await this.prisma.adminSession.findUnique({ where: { tokenHash: hashToken(token) } });
		// 관리자 ID를 바꾸면(ADMIN_GITHUB_ID) 이전 관리자의 세션은 더는 통하지 않는다
		if (!session || session.expiresAt <= now || session.githubId !== this.config.auth.adminGithubId) return null;
		return { login: session.githubLogin };
	}

	/** 세션을 지운다. 쿠키를 훔쳐 갔어도 로그아웃하면 더는 쓸 수 없다 */
	async signOut(token: string | undefined) {
		if (!token) return;
		await this.prisma.adminSession.deleteMany({ where: { tokenHash: hashToken(token) } });
	}
}
