import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config({
	files: ['**/*.ts'],
	extends: [js.configs.recommended, ...tseslint.configs.recommended],
	languageOptions: { ecmaVersion: 2022 },
	rules: {
		'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
	},
});
