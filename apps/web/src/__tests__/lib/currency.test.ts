import { describe, it, expect } from "vitest";
import {
  getMinorUnitExponent,
  toMinorUnits,
  fromMinorUnits,
} from "@/lib/currency";

describe("currency", () => {
  describe("getMinorUnitExponent", () => {
    it("returns 2 for USD", () => {
      expect(getMinorUnitExponent("USD")).toBe(2);
    });

    it("returns 2 for EUR", () => {
      expect(getMinorUnitExponent("EUR")).toBe(2);
    });

    it("returns 0 for JPY", () => {
      expect(getMinorUnitExponent("JPY")).toBe(0);
    });

    it("returns 3 for BHD", () => {
      expect(getMinorUnitExponent("BHD")).toBe(3);
    });

    it("defaults to 2 for unknown currencies", () => {
      expect(getMinorUnitExponent("XYZ")).toBe(2);
    });
  });

  describe("toMinorUnits", () => {
    it("converts 45.67 USD to 4567", () => {
      expect(toMinorUnits(45.67, "USD")).toBe(4567);
    });

    it("converts 1000 JPY to 1000", () => {
      expect(toMinorUnits(1000, "JPY")).toBe(1000);
    });

    it("converts 1.234 BHD to 1234", () => {
      expect(toMinorUnits(1.234, "BHD")).toBe(1234);
    });
  });

  describe("fromMinorUnits", () => {
    it("converts 4567 USD cents to 45.67", () => {
      expect(fromMinorUnits(4567, "USD")).toBe(45.67);
    });

    it("converts 1000 JPY to 1000", () => {
      expect(fromMinorUnits(1000, "JPY")).toBe(1000);
    });

    it("converts 1234 BHD fils to 1.234", () => {
      expect(fromMinorUnits(1234, "BHD")).toBe(1.234);
    });
  });
});
