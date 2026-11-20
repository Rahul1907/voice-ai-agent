import baseConfig from '@voice-ai/config/eslint';

export default [
  ...baseConfig,
  {
    ignores: ['.next/**', 'dist/**', 'node_modules/**', 'next-env.d.ts'],
  },
];
