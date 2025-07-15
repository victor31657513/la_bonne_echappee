export default [
  {
    ignores: ['libs/**', 'index.html']
  },
  {
    files: ['src/**/*.js', 'test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module'
    },
    rules: {
    }
  }
];
