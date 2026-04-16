import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
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

export default createJestConfig(config);
