import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { Prisma } from '../generated/prisma/client.js';
import {
	parseProfile,
	parseProjects,
	readProfile,
	readProjects,
	type SiteProfile,
	type SiteProjects,
} from '@macfolio/desktop-core/site';
import { PrismaService } from '../prisma/prisma.service.js';
import { OWNER_NAME } from '../comments/rules.js';

const ROW_ID = 1;

export interface SiteView {
	/** 관리자가 저장한 프로필 (없으면 null: 화면이 코드의 기본값을 쓴다) */
	profile: SiteProfile | null;
	/** 관리자가 고친 프로젝트 (순서·숨김·덮어쓸 필드·새 프로젝트). 없으면 null: 화면이 코드의 기본값을 쓴다 */
	projects: SiteProjects | null;
	updatedAt: string | null;
}

/**
 * 사이트 콘텐츠: 관리자가 시스템 설정에서 고친 사이트 주인의 정보와 프로젝트. 누구나 읽고, 관리자만 바꾼다.
 * 쓰기마다 DB를 읽지 않게 메모리에 들고 있다 (바꾸면 새로 읽는다). 관리자가 쓴 댓글·메시지의 이름도 여기서 정한다
 */
@Injectable()
export class SiteService {
	private cache: Promise<SiteView> | null = null;

	constructor(
		private readonly prisma: PrismaService,
		@Inject(APP_CONFIG) private readonly config: AppConfig
	) {}

	/** 올린 그림(/files/<id>)은 이 서버의 주소라, 로컬의 http 주소도 받는다 */
	private get parseOptions() {
		return { allowOrigins: [this.config.apiUrl] };
	}

	view(): Promise<SiteView> {
		this.cache ??= this.prisma.siteContent.findUnique({ where: { id: ROW_ID } }).then((row) => ({
			profile: readProfile(row?.profile),
			projects: readProjects(row?.projects, this.parseOptions),
			updatedAt: row?.updatedAt.toISOString() ?? null,
		}));
		this.cache.catch(() => (this.cache = null));
		return this.cache;
	}

	/** 관리자가 쓴 댓글·메시지에 붙일 이름: 저장한 프로필의 이름, 없으면 코드의 기본 이름 */
	async ownerName(): Promise<string> {
		return (await this.view()).profile?.name ?? OWNER_NAME;
	}

	/** 프로필을 통째로 바꾼다. 규칙을 어기면 400 */
	async saveProfile(input: unknown, admin: string): Promise<SiteView> {
		const parsed = parseProfile(input);
		if ('errors' in parsed) throw new BadRequestException(parsed.errors);
		const profile = parsed.value as unknown as Prisma.InputJsonValue;
		await this.prisma.siteContent.upsert({
			where: { id: ROW_ID },
			create: { id: ROW_ID, profile, updatedBy: admin },
			update: { profile, updatedBy: admin },
		});
		this.cache = null;
		return this.view();
	}

	/** 저장한 프로필을 지운다 (코드의 기본값으로 돌아간다) */
	async resetProfile(admin: string): Promise<SiteView> {
		await this.prisma.siteContent.upsert({
			where: { id: ROW_ID },
			create: { id: ROW_ID, profile: Prisma.DbNull, updatedBy: admin },
			update: { profile: Prisma.DbNull, updatedBy: admin },
		});
		this.cache = null;
		return this.view();
	}

	/** 프로젝트를 통째로 바꾼다 (순서·숨김·덮어쓸 필드). 규칙을 어기면 400과 이유 전부 */
	async saveProjects(input: unknown, admin: string): Promise<SiteView> {
		const parsed = parseProjects(input, this.parseOptions);
		if ('errors' in parsed) throw new BadRequestException(parsed.errors);
		const projects = parsed.value as unknown as Prisma.InputJsonValue;
		await this.prisma.siteContent.upsert({
			where: { id: ROW_ID },
			create: { id: ROW_ID, projects, updatedBy: admin },
			update: { projects, updatedBy: admin },
		});
		this.cache = null;
		return this.view();
	}

	/** 저장한 프로젝트를 지운다 (코드의 기본값으로 돌아간다) */
	async resetProjects(admin: string): Promise<SiteView> {
		await this.prisma.siteContent.upsert({
			where: { id: ROW_ID },
			create: { id: ROW_ID, projects: Prisma.DbNull, updatedBy: admin },
			update: { projects: Prisma.DbNull, updatedBy: admin },
		});
		this.cache = null;
		return this.view();
	}
}
