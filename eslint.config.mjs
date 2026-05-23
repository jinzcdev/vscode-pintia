import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default [
    {
        ignores: ["**/out", "**/out-test", "**/dist", "**/*.d.ts"],
    },
    {
        files: ["src/**/*.ts", "test/**/*.ts"],
        plugins: {
            "@typescript-eslint": typescriptEslint,
        },
        languageOptions: {
            parser: tsParser,
            ecmaVersion: 6,
            sourceType: "module",
        },
        rules: {
            curly: "warn",
            eqeqeq: "warn",
            "no-throw-literal": "warn",
        },
    },
    eslintConfigPrettier,
];
