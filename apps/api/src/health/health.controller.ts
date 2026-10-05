import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';

export class HealthResponse {
	@ApiProperty({ example: 'ok' })
	status!: 'ok';

	@ApiProperty({ example: 'up', description: 'DB에 쿼리가 되는지' })
	database!: 'up';

	@ApiProperty({
		example: 'sha-1a2b3c4',
		description: '배포한 커밋 (자동 배포가 새 버전이 떴는지 확인한다). 로컬은 dev',
	})
	version!: string;
}

/** 서버와 DB가 살아 있는지. 프론트엔드 로딩 화면에서 미리 불러 서버를 깨운다 */
@ApiTags('health')
@Controller('health')
export class HealthController {
	constructor(
		private readonly prisma: PrismaService,
		@Inject(APP_CONFIG) private readonly config: AppConfig
	) {}

	@Get()
	@ApiOkResponse({ type: HealthResponse })
	@ApiServiceUnavailableResponse({ description: 'DB에 연결할 수 없다' })
	async check(): Promise<HealthResponse> {
		try {
			await this.prisma.$queryRaw`SELECT 1`;
		} catch {
			throw new ServiceUnavailableException('DB에 연결할 수 없습니다.');
		}
		return { status: 'ok', database: 'up', version: this.config.version };
	}
}
