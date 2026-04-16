import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const customConfig: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["<rootDir>/__tests__/**/*.{test,spec}.{ts,tsx}"],
  collectCoverageFrom: [
    "components/**/*.tsx",
    "lib/**/*.ts",
    "app/**/*.tsx",
    "!**/*.d.ts",
  ],
};

// nextJest wraps our config — we must override transformIgnorePatterns AFTER
// the wrap, otherwise it gets overridden by next/jest's built-ins.
const jestConfig = async (): Promise<Config> => {
  const nextConfig = await createJestConfig(customConfig)();
  return {
    ...nextConfig,
    // Allow Jest to transform ESM-only packages (lucide-react ships ESM only)
    transformIgnorePatterns: [
      "/node_modules/(?!(lucide-react)/)",
    ],
  };
};

export default jestConfig;
