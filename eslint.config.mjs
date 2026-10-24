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
            // 未使用的变量/导入此前无人拦截（例如 ptaManager 里那句
            // `import { t } from "@vscode/l10n"` 一直是死代码）
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    args: "after-used",
                    // 形参以 _ 开头表示刻意不用（如接口实现里的占位参数）
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrors: "none",
                },
            ],
        },
    },
    eslintConfigPrettier,
];
