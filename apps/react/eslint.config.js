import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{ ignores: ['dist', 'playwright-report', 'test-results'] },
	{
		files: ['**/*.{ts,tsx}'],
		extends: [js.configs.recommended, ...tseslint.configs.recommended],
		languageOptions: {
			ecmaVersion: 2020,
			globals: globals.browser,
		},
		plugins: {
			'react-hooks': reactHooks,
			'react-refresh': reactRefresh,
		},
		rules: {
			...reactHooks.configs.recommended.rules,
			// 컴포넌트 파일은 컴포넌트만 내보낸다 (훅·목록은 따로 두어야 Fast Refresh가 상태를 지킨다)
			'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
			'no-console': ['warn', { allow: ['warn', 'error'] }],
			// 구조 분해로 특정 필드를 빼낼 때(`const { a, ...rest } = obj`) 쓰는 변수는 허용
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
		},
	}
);
