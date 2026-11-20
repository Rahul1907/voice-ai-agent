import baseConfig from '@voice-ai/config/eslint';

export default [
  ...baseConfig,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
];
