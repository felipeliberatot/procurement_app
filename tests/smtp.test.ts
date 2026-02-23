import { describe, it, expect } from "vitest";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env" });

describe("SMTP Configuration", () => {
  it("should connect to SMTP server and verify credentials", async () => {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT ?? "465");
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    expect(host).toBeTruthy();
    expect(user).toBeTruthy();
    expect(pass).toBeTruthy();

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
      socketTimeout: 10000,
    });

    // Verify connection
    const verified = await transporter.verify();
    expect(verified).toBe(true);
  }, 15000);
});
