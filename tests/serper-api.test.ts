import { describe, it, expect } from "vitest";
import "../scripts/load-env.js";

describe("Serper API Key", () => {
  it("should have SERPER_API_KEY configured", () => {
    expect(process.env.SERPER_API_KEY).toBeTruthy();
  });

  it("should successfully search Google Shopping with Serper API", async () => {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) throw new Error("SERPER_API_KEY not set");

    const response = await fetch("https://google.serper.dev/shopping", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: "bomba dagua 1.5cv",
        gl: "br",
        hl: "pt-br",
        num: 3,
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json() as any;
    expect(data).toHaveProperty("shopping");
    expect(Array.isArray(data.shopping)).toBe(true);
    console.log("Serper API test passed. Sample result:", data.shopping?.[0]?.title);
  }, 15000);
});
