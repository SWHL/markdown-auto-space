import createEslintConfig from 'talljack-eslint-config'

export default createEslintConfig({
  typescript: true,
  formatters: true,
  rules: {
    'jsdoc/require-jsdoc': 'off',
    'jsdoc/require-param': 'off',
    'jsdoc/require-param-description': 'off',
    'jsdoc/require-param-type': 'off',
    'jsdoc/require-returns': 'off',
  },
})
