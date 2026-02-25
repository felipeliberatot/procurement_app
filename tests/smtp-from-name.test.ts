import { describe, it, expect } from "vitest";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

describe("SMTP_FROM_NAME configuration", () => {
  it("should have SMTP_FROM_NAME set to CGS Agrícola", () => {
    const fromName = process.env.SMTP_FROM_NAME ?? "CGS Agrícola";
    expect(fromName).toBe("CGS Agrícola");
  });
});
