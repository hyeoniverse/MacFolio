// 시스템 설정 › 프로젝트의 입력칸 규칙 (React와 DOM 없이): 기간 읽기·쓰기, 자동완성 후보
import type { Project } from '@macfolio/desktop-core/site';

/** 기간: 시작일과 끝(날짜, 또는 '운영 중' 같은 글). 프로젝트의 period는 '2024.12.26 – 2025.02.05' 모양이다 */
export interface Period {
	/** YYYY-MM-DD (input type=date의 값). 비었으면 '' */
	start: string;
	end: string;
	/** 끝 대신 쓰는 글 (예: 운영 중). 있으면 end는 비운다 */
	ongoing: string;
}

const DATE = /(\d{4})\.(\d{1,2})\.(\d{1,2})/;
const toInput = (match: RegExpExecArray | null) =>
	match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : '';
const toPeriod = (value: string) => value.replaceAll('-', '.');

/** 기간 글을 읽는다. 날짜 모양이 아니면 null (그대로 글로 고치게 한다) */
export function parsePeriod(text: string | undefined): Period | null {
	if (!text?.trim()) return { start: '', end: '', ongoing: '' };
	const [head, ...rest] = text.split(/\s*[–-]\s*(?=\D|$|\d{4}\.)/);
	const start = DATE.exec(head);
	if (!start || start[0] !== head.trim()) return null;
	const tail = rest.join(' – ').trim();
	if (!tail) return { start: toInput(start), end: '', ongoing: '' };
	const end = DATE.exec(tail);
	if (end && end[0] === tail) return { start: toInput(start), end: toInput(end), ongoing: '' };
	if (/\d/.test(tail)) return null;
	return { start: toInput(start), end: '', ongoing: tail };
}

/** 기간을 글로 쓴다 ('2024.12.26 – 2025.02.05', '2026.02.05 – 운영 중', 끝을 모르면 '2024.10.22 –'). 시작이 없으면 undefined */
export function formatPeriod({ start, end, ongoing }: Period): string | undefined {
	if (!start) return undefined;
	const tail = ongoing.trim() || (end ? toPeriod(end) : '');
	return tail ? `${toPeriod(start)} – ${tail}` : `${toPeriod(start)} –`;
}

/** 자주 쓰는 언어 (GitHub linguist의 이름). 프로젝트들이 쓴 언어가 먼저 오고, 그다음 이 순서 */
const COMMON_LANGUAGES = [
	'TypeScript',
	'JavaScript',
	'Python',
	'Java',
	'Kotlin',
	'Swift',
	'Objective-C',
	'Go',
	'Rust',
	'C',
	'C++',
	'C#',
	'Dart',
	'Ruby',
	'PHP',
	'Scala',
	'Elixir',
	'Erlang',
	'Haskell',
	'OCaml',
	'F#',
	'Clojure',
	'Lua',
	'Perl',
	'R',
	'Julia',
	'MATLAB',
	'Zig',
	'Nim',
	'Solidity',
	'HTML',
	'CSS',
	'SCSS',
	'Less',
	'Vue',
	'Svelte',
	'Astro',
	'MDX',
	'Shell',
	'PowerShell',
	'SQL',
	'PLpgSQL',
	'GLSL',
	'HLSL',
	'WebAssembly',
	'Dockerfile',
	'HCL',
	'YAML',
	'Jupyter Notebook',
	'Assembly',
];

/** 자주 쓰는 기술 (프레임워크·라이브러리·도구·서비스). 프로젝트들이 쓴 것이 먼저 오고, 그다음 이 순서 */
const COMMON_STACKS = [
	// 프론트엔드
	'React',
	'Next.js',
	'Vue',
	'Nuxt',
	'Svelte',
	'SvelteKit',
	'Angular',
	'SolidJS',
	'Astro',
	'Remix',
	'React Router',
	'React Native',
	'Expo',
	'Flutter',
	'Electron',
	'Tauri',
	'Vite',
	'webpack',
	'Turbopack',
	'esbuild',
	'Rollup',
	'Babel',
	'SWC',
	'TailwindCSS',
	'styled-components',
	'Emotion',
	'vanilla-extract',
	'CSS Modules',
	'Sass',
	'PostCSS',
	'shadcn/ui',
	'Radix UI',
	'MUI',
	'Chakra UI',
	'Ant Design',
	'Storybook',
	'Redux',
	'Redux Toolkit',
	'Zustand',
	'Jotai',
	'Recoil',
	'MobX',
	'React Query',
	'TanStack Query',
	'SWR',
	'Apollo Client',
	'React Hook Form',
	'Zod',
	'GSAP',
	'Framer Motion',
	'Motion',
	'Three.js',
	'React Three Fiber',
	'D3.js',
	'Chart.js',
	'Recharts',
	'Mapbox',
	'Leaflet',
	'PWA',
	'Web Components',
	'Lit',
	// 백엔드
	'Node.js',
	'Express',
	'NestJS',
	'Fastify',
	'Hono',
	'Koa',
	'Bun',
	'Deno',
	'Spring Boot',
	'Spring',
	'Django',
	'FastAPI',
	'Flask',
	'Rails',
	'Laravel',
	'ASP.NET Core',
	'Gin',
	'Actix',
	'GraphQL',
	'Apollo Server',
	'tRPC',
	'gRPC',
	'REST API',
	'WebSocket',
	'Socket.IO',
	'Prisma',
	'Drizzle',
	'TypeORM',
	'Sequelize',
	'Mongoose',
	'Knex',
	'JWT',
	'OAuth',
	'Passport',
	'NextAuth',
	// 데이터
	'PostgreSQL',
	'MySQL',
	'MariaDB',
	'SQLite',
	'MongoDB',
	'Redis',
	'Elasticsearch',
	'Supabase',
	'Firebase',
	'Firestore',
	'DynamoDB',
	'PlanetScale',
	'Neon',
	'Turso',
	// 인프라·배포
	'Docker',
	'Docker Compose',
	'Kubernetes',
	'Nginx',
	'Vercel',
	'Netlify',
	'Cloudflare',
	'Cloudflare Workers',
	'Cloudflare Pages',
	'AWS',
	'AWS Lambda',
	'S3',
	'EC2',
	'GCP',
	'Azure',
	'Oracle Cloud',
	'Railway',
	'Render',
	'Fly.io',
	'Heroku',
	'GitHub Actions',
	'GitLab CI',
	'Terraform',
	'Linux',
	// 시험·품질
	'Vitest',
	'Jest',
	'Playwright',
	'Cypress',
	'Testing Library',
	'Storybook',
	'ESLint',
	'Prettier',
	'Biome',
	// 도구·협업
	'pnpm',
	'npm',
	'Yarn',
	'Turborepo',
	'Nx',
	'Git',
	'GitHub',
	'Figma',
	'Notion',
	'Jira',
	'Slack',
	// AI·기타
	'OpenAI API',
	'Gemini API',
	'Claude API',
	'Groq',
	'LangChain',
	'Hugging Face',
	'TensorFlow',
	'PyTorch',
	'Pandas',
	'NumPy',
	'Stripe',
	'Toss Payments',
	'Resend',
	'SendGrid',
	'Turnstile',
	'reCAPTCHA',
	'i18next',
	'Markdown',
	'Mermaid',
	'Milkdown',
	'ProseMirror',
	'TipTap',
	'Unity',
	'Godot',
	'Phaser',
	'Arduino',
	'Raspberry Pi',
];

const unique = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))];

/** 언어 후보: 프로젝트들이 쓴 언어 먼저, 그다음 자주 쓰는 언어 */
export const languageOptions = (projects: readonly Project[]) =>
	unique([...projects.map((project) => project.language), ...COMMON_LANGUAGES]);

/** 기술 후보: 프로젝트들의 기술과 다룰 수 있는 기술(많이 쓴 것부터), 그다음 자주 쓰는 기술 */
export function stackOptions(projects: readonly Project[], extra: readonly string[] = []): string[] {
	const counts = new Map<string, number>();
	for (const name of [...projects.flatMap((project) => project.stack), ...extra]) {
		const key = name.trim();
		if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	const used = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
	const seen = new Set(used.map((name) => name.toLowerCase()));
	return [...used, ...COMMON_STACKS.filter((name) => !seen.has(name.toLowerCase()))];
}

/**
 * 친 글자로 후보를 고른다: 이미 고른 것은 빼고, 앞부분이 맞는 것 먼저, 그다음 중간에 들어 있는 것. 대소문자는 가리지 않는다
 */
export function suggest(options: readonly string[], query: string, chosen: readonly string[] = [], limit = 8) {
	const q = query.trim().toLowerCase();
	const taken = new Set(chosen.map((item) => item.toLowerCase()));
	const pool = options.filter((option) => !taken.has(option.toLowerCase()));
	if (!q) return pool.slice(0, limit);
	const starts = pool.filter((option) => option.toLowerCase().startsWith(q));
	const contains = pool.filter((option) => !option.toLowerCase().startsWith(q) && option.toLowerCase().includes(q));
	return [...starts, ...contains].slice(0, limit);
}
