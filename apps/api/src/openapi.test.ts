import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { AppModule } from './app.module.js';
import { createOpenApiDocument } from './app.setup.js';

// DB에는 연결하지 않는다 (PrismaService는 처음 쿼리할 때 연결한다). 문서만 만든다
process.env.DATABASE_URL ??= 'postgresql://macfolio:macfolio@localhost:5432/macfolio';

/**
 * 사이트의 'API 문서' 앱은 서버의 /docs를 띄우지 않고, 이 파일을 사이트 안에서 그린다 (서버가 꺼져 있어도 보인다).
 * 컨트롤러·DTO를 바꾸면 이 테스트가 실패한다. `pnpm --filter @macfolio/api openapi`로 파일을 다시 만든다
 */
describe('OpenAPI 문서', () => {
	it('사이트의 API 문서 앱이 쓰는 openapi.json이 코드와 같다', async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
		const app = moduleRef.createNestApplication();
		const document = createOpenApiDocument(app);
		await app.close();

		expect(document.paths).toHaveProperty('/health');
		await expect(`${JSON.stringify(document, null, '\t')}\n`).toMatchFileSnapshot(
			'../../react/src/apps/apidocs/openapi.json'
		);
	});
});
