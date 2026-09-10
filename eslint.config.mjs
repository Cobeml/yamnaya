import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config(
  { ignores: ['**/.next/**', '**/node_modules/**', 'runtime/**', 'playwright-report/**', 'test-results/**', '**/next-env.d.ts'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  { languageOptions: { globals: { process: 'readonly', console: 'readonly', Buffer: 'readonly', fetch: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', URL: 'readonly' } }, rules: { '@typescript-eslint/no-explicit-any': 'error', '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } }
);
