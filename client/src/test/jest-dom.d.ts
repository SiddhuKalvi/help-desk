import type * as matchers from "@testing-library/jest-dom/matchers";

declare module "bun:test" {
  interface Matchers<T = unknown> extends matchers.TestingLibraryMatchers<unknown, T> {}
}
