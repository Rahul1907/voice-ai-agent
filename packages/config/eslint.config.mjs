import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Creates a reusable ESLint 9+ flat configuration for TypeScript workspaces.
 * @param {object} [options]
 * @param {string[]} [options.ignores] - Extra glob patterns to ignore.
 */
export function createBaseConfig(options = {}) {
  const extraIgnores = options.ignores ?? [];

  return tseslint.config(
    {
      ignores: [
        'dist/**',
        'build/**',
        '.next/**',
        'coverage/**',
        'node_modules/**',
        ...extraIgnores,
      ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
      languageOptions: {
        globals: {
          ...globals.node,
        },
      },
      rules: {
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
          },
        ],
      },
    },
    eslintConfigPrettier,
  );
}

export default createBaseConfig();
