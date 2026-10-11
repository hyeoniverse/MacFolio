// 다룰 수 있는 기술과 이 사이트를 만든 기술 (GitHub 프로필 README의 Tech Stack, 이 Mac에 관하여)

/** 다룰 수 있는 기술 (GitHub 프로필 README의 Tech Stack) */
export const SKILLS = {
	frontend: ['React', 'Next.js', 'TypeScript', 'JavaScript', 'TailwindCSS', 'Zustand'],
	backend: ['Node.js', 'Express', 'MySQL', 'Supabase', 'Firebase'],
	interaction: ['GSAP', 'Framer Motion', 'Three.js'],
} as const;

/** 이 사이트(MacFolio)를 만든 기술 */
export const SITE_STACK = [
	'React 19',
	'TypeScript',
	'Vite',
	'pnpm workspaces + Turborepo',
	'Vitest, Playwright',
	'Cloudflare Workers',
] as const;
