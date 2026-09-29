// Prisma 7 설정. Prisma는 .env를 스스로 읽지 않으므로, 있으면 여기서 읽는다 (CI처럼 없으면 환경 변수만 쓴다).
import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
	schema: 'prisma/schema.prisma',
	migrations: { path: 'prisma/migrations' },
	// generate에는 필요 없고 migrate에만 쓴다. 없어도 generate가 되도록 env() 대신 그대로 읽는다
	datasource: { url: process.env.DATABASE_URL },
});
