import js from '@eslint/js'
import tseslint from 'typescript-eslint'

// Igual que la API: TS estricto con información de tipos. Las capas solo dependen hacia adentro
// (domain ← ports ← usecases ← infrastructure ← entry); lo vigila no-restricted-imports.
const layer = (files, forbidden) => ({
  files,
  rules: {
    'no-restricted-imports': ['error', { patterns: forbidden.map(dir => ({ group: [`**/${dir}/*`], message: `Esta capa no puede depender de ${dir}/` })) }],
  },
})

export default tseslint.config(
  { ignores: ['node_modules/', '.wrangler/', 'coverage/'] },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  layer(['src/domain/**'], ['ports', 'usecases', 'infrastructure', 'entry']),
  layer(['src/ports/**'], ['usecases', 'infrastructure', 'entry']),
  layer(['src/usecases/**'], ['infrastructure', 'entry']),
  layer(['src/infrastructure/**'], ['usecases', 'entry']),
  {
    // Pruebas: fakes y aserciones; sin las reglas de tipos más estrictas
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
)
