import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Ignore compiled output and worktrees
  { ignores: ["dist/**", ".claude/worktrees/**"] },

  // Base JS rules
  js.configs.recommended,

  // TypeScript rules — strict but practical for a Node.js MCP server
  ...tseslint.configs.recommended,

  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Allow `any` only in test files (smoke tests need escape hatches)
      "@typescript-eslint/no-explicit-any": ["error", { ignoreRestArgs: false }],
      // Unused vars: underscore prefix exempts params used as placeholders
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // No console.log in production code — use process.stderr for MCP servers
      "no-console": "error",
    },
  },

  // Relax rules in test files
  {
    files: ["src/__tests__/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },
);
