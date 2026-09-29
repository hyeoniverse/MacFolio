import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { APP_CONFIG, type AppConfig } from './config.js';

// 로컬 개발: .env가 있으면 읽는다. 배포(Docker)에서는 환경 변수로 넘긴다
if (existsSync('.env')) process.loadEnvFile('.env');

const app = configureApp(await NestFactory.create(AppModule));
const { port } = app.get<AppConfig>(APP_CONFIG);
// 종료 신호(docker stop 등)를 받으면 DB 연결을 닫고 끝낸다
app.enableShutdownHooks();
await app.listen(port);
console.log(`MacFolio API: http://localhost:${port} (문서: /docs)`);
