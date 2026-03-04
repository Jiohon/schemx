import js from "@eslint/js"
import prettier from "eslint-config-prettier"
import pluginImport from "eslint-plugin-import"
import jsxA11y from "eslint-plugin-jsx-a11y"
import unusedImports from "eslint-plugin-unused-imports"
import pluginVue from "eslint-plugin-vue"
import tseslint from "typescript-eslint"

export default tseslint.config(
  // 全局忽略
  {
    ignores: [
      "node_modules/**",
      "uni_modules/**",
      "dist/**",
      "build/**",
      "static/**",
      "**/*.d.ts",
    ],
  },

  // 基础配置
  js.configs.recommended,

  // TypeScript 配置
  ...tseslint.configs.recommended,

  // Vue 配置
  ...pluginVue.configs["flat/recommended"],

  // JSX A11y 配置
  jsxA11y.flatConfigs.recommended,

  // Prettier 配置（必须在最后）
  prettier,

  // 全局设置
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        // Node.js
        module: "readonly",
        require: "readonly",
        process: "readonly",
        __dirname: "readonly",
        // Browser
        window: "readonly",
        document: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
    plugins: {
      import: pluginImport,
      "unused-imports": unusedImports,
    },
    settings: {
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx"],
      },
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        },
        // node: {
        //   paths: ["src"],
        //   extensions: [".js", ".jsx", ".ts", ".tsx", ".vue"],
        // },
      },
      "import/internal-regex": "^@/|^src/",
    },
    rules: {
      // 导入排序
      "sort-imports": [
        "warn",
        {
          ignoreCase: true,
          ignoreDeclarationSort: true,
          ignoreMemberSort: false,
          memberSyntaxSortOrder: ["none", "all", "multiple", "single"],
          allowSeparatedGroups: true,
        },
      ],
      "import/order": [
        "warn",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "object",
            "type",
          ],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
          pathGroups: [
            {
              pattern: "vue",
              group: "external",
              position: "before",
            },
            {
              pattern: "vant",
              group: "external",
              position: "before",
            },
            {
              pattern: "@/**",
              group: "internal",
              position: "after",
            },
          ],
          pathGroupsExcludedImportTypes: ["vue"],
        },
      ],

      // 未使用导入
      "unused-imports/no-unused-imports": "error",

      // TypeScript
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],

      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-unsafe-function-type": "warn",

      // 通用规则
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-debugger": "warn",

      // 函数/模块之间空行
      "padding-line-between-statements": [
        "warn",
        // 函数声明前后空行
        { blankLine: "always", prev: "*", next: "function" },
        { blankLine: "always", prev: "function", next: "*" },
        // export 前空行
        { blankLine: "always", prev: "*", next: "export" },
        // class 前后空行
        { blankLine: "always", prev: "*", next: "class" },
        { blankLine: "always", prev: "class", next: "*" },
        // return 前空行
        { blankLine: "always", prev: "*", next: "return" },
        // 多行块语句后空行
        { blankLine: "always", prev: "block-like", next: "*" },
        // 连续 export 不需要空行
        { blankLine: "any", prev: "export", next: "export" },
      ],
      "no-unused-vars": "off",

      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/display-name": "off",
      "react/no-unescaped-entities": "off",

      // Import 规则
      "import/no-unresolved": "error",
      "import/named": "error",
      "import/namespace": "error",
      "import/default": "error",
      "import/export": "error",

      // JSX 可访问性
      "jsx-a11y/alt-text": "warn",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
    },
  },

  // Vue 文件特定配置
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
        extraFileExtensions: [".vue"],
        project: ["./tsconfig.json", "./examples/tsconfig.json"],
      },
    },
    rules: {
      "vue/multi-word-component-names": "off",
      "vue/no-v-html": "off",
      "vue/require-default-prop": "off",
      "vue/require-prop-types": "off",
    },
  },

  // TypeScript/TSX 文件特定配置
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
        project: ["./tsconfig.json", "./examples/tsconfig.json"],
      },
    },
  }
)
