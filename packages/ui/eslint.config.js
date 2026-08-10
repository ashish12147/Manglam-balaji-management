import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['coverage/**'],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
);
