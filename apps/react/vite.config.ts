import { execSync } from 'node:child_process';
import { appendFileSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defaultClientConditions, defaultServerConditions, defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
// 빌드한 dist가 아니라 src를 바로 쓴다 (seo/posts.ts가 desktop-core를 읽는 것과 같다)
import { loadOgAssets, ogImagePng } from '../../packages/og-card/src/index';
import { recentPosts, rssXml, seoPosts, siteChannel, sitemapXml, updatedDates, type ContentImages } from './seo/posts';
import { ogCardVersion, SITE_ORIGIN } from './seo/site';
import { DEFAULT_PROJECTS, PROFILE } from './src/shared/profile';
import { headersFileBlock, securityHeaders } from './worker/securityHeaders';

/**
 * 보안 헤더 (worker/securityHeaders.ts). 빌드하면 dist/_headers 끝에 모든 경로(/*) 덩어리를 더하고,
 * vite preview(E2E)에도 같은 헤더를 붙여 시험이 CSP를 켠 채로 돈다
 */
function securityHeadersPlugin(): Plugin {
	let headers: Record<string, string> = {};
	return {
		name: 'macfolio-security-headers',
		apply: (_config, { command, isPreview }) => command === 'build' || Boolean(isPreview),
		configResolved(config) {
			const env = loadEnv(config.mode, config.envDir || process.cwd(), '');
			headers = securityHeaders({
				apiUrl: env.VITE_API_URL,
				frameUrls: DEFAULT_PROJECTS.flatMap((project) => (project.demo ? [project.demo] : [])),
				// E2E의 가짜 API (e2e/fakeApi.ts의 FAKE_API). 배포 빌드에는 넣지 않는다
				testApiUrls: env.CSP_TEST_API_URL ? [env.CSP_TEST_API_URL] : [],
			});
		},
		configurePreviewServer(server) {
			server.middlewares.use((_req, res, next) => {
				for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
				next();
			});
		},
		writeBundle(options) {
			appendFileSync(
				`${options.dir}/_headers`,
				`\n# 보안 헤더 (vite.config.ts가 빌드할 때 더한다)\n${headersFileBlock(headers)}`
			);
		},
	};
}

/**
 * 검색엔진용 파일 (seo/posts.ts). 빌드하면 저장소의 글을 HTML로 그린 seo/posts.json(Worker가 글 주소의 첫 화면에 넣는다)과
 * sitemap.xml(첫 화면, 모든 글, 모든 프로젝트)을 dist에 둔다
 */
/**
 * 글 파일마다 마지막으로 고친 날 (git 기록). 기록을 일부만 받은 저장소(shallow clone)는 날짜가 틀리니 쓰지 않는다
 * (CI의 deploy는 fetch-depth: 0으로 받는다)
 */
function contentUpdatedDates(contentDir: string): Record<string, string> {
	try {
		const git = (args: string) =>
			execSync(`git ${args}`, {
				cwd: contentDir,
				env: { ...process.env, TZ: 'Asia/Seoul' },
				stdio: ['ignore', 'pipe', 'ignore'],
				maxBuffer: 64 * 1024 * 1024,
			}).toString();
		if (git('rev-parse --is-shallow-repository').trim() !== 'false') return {};
		return updatedDates(git('log --format=%x00%cd --date=format-local:%Y-%m-%d --name-only --relative -- .'));
	} catch {
		return {};
	}
}

const CONTENT_PREFIX = 'src/apps/memo/content/';

function seoPlugin(): Plugin {
	const contentDir = fileURLToPath(new URL('./src/apps/memo/content', import.meta.url));
	const publicDir = fileURLToPath(new URL('./public', import.meta.url));
	return {
		name: 'macfolio-seo',
		apply: 'build',
		async generateBundle(_options, bundle) {
			const files = Object.fromEntries(
				readdirSync(contentDir)
					.filter((name) => name.endsWith('.md'))
					.map((name) => [`./content/${name}`, readFileSync(join(contentDir, name), 'utf8')])
			);
			// 글의 그림(contentImages.ts가 빌드에 넣은 것): content 기준 경로 → 빌드한 주소. 작아서 자바스크립트 안에 넣은(inline) 그림은 여기 없어 뺀다
			const images: ContentImages = {};
			for (const output of Object.values(bundle)) {
				if (output.type !== 'asset') continue;
				for (const name of output.originalFileNames) {
					const path = name.replace(/\\/g, '/');
					const at = path.indexOf(CONTENT_PREFIX);
					if (at !== -1) images[path.slice(at + CONTENT_PREFIX.length)] = `/${output.fileName}`;
				}
			}
			const posts = await seoPosts(files, { images, updated: contentUpdatedDates(contentDir) });
			// 사진이 없는 글은 제목으로 공유 카드를 그린다 (packages/og-card). 서버에 쓴 글은 API가 그린다 (worker/serverPosts.ts)
			const assets = await loadOgAssets(publicDir);
			const site = siteChannel(PROFILE.name).title;
			await Promise.all(
				posts
					.filter((post) => !post.image)
					.map(async (post) => {
						// 이름에 내용의 해시를 붙인다: 제목을 고치면 새 주소가 되어 메신저·SNS의 캐시에 옛 그림이 남지 않는다
						const fileName = `og/${post.slug}-${ogCardVersion(post)}.png`;
						this.emitFile({ type: 'asset', fileName, source: await ogImagePng(post, { site, ...assets }) });
						post.image = `${SITE_ORIGIN}/${fileName}`;
					})
			);
			this.emitFile({ type: 'asset', fileName: 'seo/posts.json', source: JSON.stringify(posts) });
			this.emitFile({
				type: 'asset',
				fileName: 'sitemap.xml',
				source: sitemapXml(
					posts,
					DEFAULT_PROJECTS.map((project) => project.id)
				),
			});
			this.emitFile({ type: 'asset', fileName: 'rss.xml', source: rssXml(posts, siteChannel(PROFILE.name)) });
		},
	};
}

/** 위젯에 넣는 최근 글 수 */
const RECENT_POSTS = 6;

/**
 * 'virtual:recent-posts': 저장소의 최근 글 (제목·날짜·분류). 바탕화면·홈 화면 위젯이 첫 화면에서 쓰는데,
 * 메모 앱의 글 묶음(본문 전체)을 불러오지 않으려고 작은 목록만 따로 만든다. 개발 서버에서는 글이 바뀌면 다시 만든다
 */
function recentPostsPlugin(): Plugin {
	const id = 'virtual:recent-posts';
	const resolved = `\0${id}`;
	const contentDir = fileURLToPath(new URL('./src/apps/memo/content', import.meta.url));
	return {
		name: 'macfolio-recent-posts',
		resolveId: (source) => (source === id ? resolved : null),
		async load(source) {
			if (source !== resolved) return null;
			const names = readdirSync(contentDir).filter((name) => name.endsWith('.md'));
			for (const name of names) this.addWatchFile(join(contentDir, name));
			const files = Object.fromEntries(
				names.map((name) => [`./content/${name}`, readFileSync(join(contentDir, name), 'utf8')])
			);
			const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
			return `export default ${JSON.stringify(await recentPosts(files, RECENT_POSTS, today))};`;
		},
	};
}

/** public/imgs 아래의 그림·영상 (프로젝트의 화면 모음 폴더: src/shared/site/publicImages.ts) */
const IMAGE_FILE = /\.(png|jpe?g|webp|gif|avif|svg|mp4)$/i;

/**
 * 'virtual:public-images': public/imgs 아래 폴더마다 그 안의 그림 주소 목록 (이름 순).
 * 관리자가 프로젝트의 화면 모음을 폴더 하나로 정하면, 그 폴더의 그림을 모두 보여 준다
 */
function publicImagesPlugin(): Plugin {
	const id = 'virtual:public-images';
	const resolved = `\0${id}`;
	const root = fileURLToPath(new URL('./public', import.meta.url));
	const collect = (dir: string, out: Record<string, string[]>) => {
		const entries = readdirSync(join(root, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
		const files = entries
			.filter((entry) => entry.isFile() && IMAGE_FILE.test(entry.name))
			.map((entry) => `/${dir}/${entry.name}`);
		if (files.length) out[`/${dir}`] = files;
		for (const entry of entries) if (entry.isDirectory()) collect(`${dir}/${entry.name}`, out);
		return out;
	};
	return {
		name: 'macfolio-public-images',
		resolveId: (source) => (source === id ? resolved : null),
		load: (source) => (source === resolved ? `export default ${JSON.stringify(collect('imgs', {}))};` : null),
	};
}

/**
 * 첫 화면의 묶음을 미리 받기: main.tsx는 사이트 콘텐츠를 합친 뒤에야 boot.tsx를 import()로 부르므로, 브라우저는 main을 받아
 * 실행하기 전까지 boot 묶음이 있는 줄 모른다. index.html에 boot와 그 묶음이 바로 쓰는 묶음·CSS를 미리 받기로 적어
 * main과 함께 받게 한다 (실행 순서는 그대로). 빌드할 때만
 */
function bootPreloadPlugin(): Plugin {
	return {
		name: 'macfolio-boot-preload',
		apply: 'build',
		transformIndexHtml: {
			order: 'post',
			handler(html, ctx) {
				const bundle = ctx.bundle;
				// api-docs.html 같은 다른 페이지에는 넣지 않는다
				if (!bundle || !ctx.filename.endsWith('/index.html')) return;
				const chunks = Object.values(bundle).filter((item) => item.type === 'chunk');
				const boot = chunks.find((chunk) => chunk.facadeModuleId?.endsWith('/src/boot.tsx'));
				if (!boot) return;
				const files = new Set<string>();
				const css = new Set<string>();
				const visit = (fileName: string) => {
					if (files.has(fileName)) return;
					files.add(fileName);
					const chunk = chunks.find((item) => item.fileName === fileName);
					chunk?.viteMetadata?.importedCss.forEach((file) => css.add(file));
					chunk?.imports.forEach(visit);
				};
				visit(boot.fileName);
				// main이 바로 쓰는 묶음은 Vite가 이미 적었다
				const fresh = (file: string) => !html.includes(`href="/${file}"`);
				return [
					...[...files].filter(fresh).map((file) => ({
						tag: 'link',
						attrs: { rel: 'modulepreload', crossorigin: true, href: `/${file}` },
						injectTo: 'head' as const,
					})),
					...[...css].filter(fresh).map((file) => ({
						tag: 'link',
						attrs: { rel: 'preload', as: 'style', href: `/${file}` },
						injectTo: 'head' as const,
					})),
				];
			},
		},
	};
}

/**
 * 지금 브랜치의 PR 미리보기 주소 (ci.yml의 preview 작업과 같은 별칭 규칙). main이거나 git을 읽지 못하면 null.
 * 브랜치에서 바꾼 /files/*(새 파일 종류, Range)는 배포한 사이트에 아직 없어서, 그 브랜치의 미리보기 Worker가 내줘야 한다
 */
function branchPreviewOrigin(): string | null {
	try {
		const branch = execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
			.toString()
			.trim();
		if (!branch || branch === 'main' || branch === 'HEAD') return null;
		const alias = branch
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 40)
			.replace(/-+$/, '');
		return `https://${alias}-macfolio.hyeoniverse-dev.workers.dev`;
	} catch {
		return null;
	}
}

/** 로컬 개발에서 /files/*를 넘길 사이트: FILES_ORIGIN(명령 앞의 환경 변수가 .env.local보다 먼저) → 이 브랜치의 PR 미리보기 → 배포한 사이트 */
const FILES_ORIGIN =
	process.env.FILES_ORIGIN ||
	loadEnv('development', fileURLToPath(new URL('.', import.meta.url)), 'FILES_').FILES_ORIGIN ||
	branchPreviewOrigin() ||
	'https://macfolio.hyeoniverse.com';

export default defineConfig({
	plugins: [
		react(),
		securityHeadersPlugin(),
		publicImagesPlugin(),
		recentPostsPlugin(),
		seoPlugin(),
		bootPreloadPlugin(),
	],
	// 단위 시험(Vitest)도 desktop-core의 src를 읽는다
	ssr: { resolve: { conditions: ['source', ...defaultServerConditions] } },
	// 로컬 개발(pnpm dev)에는 사이트 Worker가 없어 /files/*(R2 문서 파일)를 내줄 곳이 없다. main이 아닌 브랜치면 그 PR 미리보기로, main이면 배포한 사이트로 넘긴다.
	// 다른 곳을 보려면 FILES_ORIGIN: 명령 앞에 붙이거나 apps/react/.env.local에 적는다.
	// E2E(vite preview)는 넘기지 않는다 (시험이 가짜 파일을 준다)
	server: {
		proxy: { '/files': { target: FILES_ORIGIN, changeOrigin: true } },
	},
	preview: { proxy: {} },
	build: {
		rollupOptions: {
			// api-docs.html: 'API 문서' 앱이 iframe으로 띄우는 페이지 (Scalar가 주소·CSS를 직접 써서 사이트와 떼어 둔다)
			input: {
				main: fileURLToPath(new URL('./index.html', import.meta.url)),
				apiDocs: fileURLToPath(new URL('./api-docs.html', import.meta.url)),
			},
		},
	},
	resolve: {
		// desktop-core는 빌드하지 않고 src를 바로 읽는다 (package.json exports의 source 조건). dist는 서버가 쓴다
		conditions: ['source', ...defaultClientConditions],
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
});
