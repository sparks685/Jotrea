import "@testing-library/jest-dom";
import { vi } from "vitest";

Object.defineProperty(window, "scrollTo", {
  configurable: true,
  writable: true,
  value: vi.fn(),
});
