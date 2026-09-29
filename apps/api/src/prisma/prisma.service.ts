import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { APP_CONFIG, type AppConfig } from '../config.js';

/**
 * DB 접근. Prisma 7은 드라이버 어댑터(pg)로 연결한다.
 * 시작할 때 미리 연결하지 않는다: DB가 잠시 내려가 있어도 서버는 뜨고, /health가 그 상태를 알린다.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
	constructor(@Inject(APP_CONFIG) config: AppConfig) {
		super({ adapter: new PrismaPg({ connectionString: config.databaseUrl }) });
	}

	async onModuleDestroy() {
		await this.$disconnect();
	}
}
