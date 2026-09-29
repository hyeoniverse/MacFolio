import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	// NestJS의 의존성 주입은 데코레이터 타입 정보(emitDecoratorMetadata)를 쓰는데 esbuild는 이를 만들지 않는다. SWC로 컴파일한다
	plugins: [swc.vite({ module: { type: 'es6' } })],
	test: {
		projects: [
			// 단위 테스트: DB 없이 돈다
			{ extends: true, test: { name: 'unit', include: ['src/**/*.test.ts'] } },
			// e2e: 실제 PostgreSQL이 필요하다 (로컬: pnpm db:up, CI: 서비스 컨테이너)
			// 파일들이 같은 DB 테이블을 비우고 채우므로 한 파일씩 돌린다
			{ extends: true, test: { name: 'e2e', include: ['test/**/*.e2e.test.ts'], fileParallelism: false } },
		],
	},
});
