/**
 * Cron Jobs — CGS Agrícola
 *
 * Schedules background tasks that run on a fixed schedule.
 * Currently registered jobs:
 *   - Daily Report: every day at 07:00 BRT (UTC-3 = 10:00 UTC)
 */

import cron from "node-cron";
import { runDailyReport } from "./daily-report";

let initialized = false;

export function registerCronJobs(): void {
  if (initialized) return;
  initialized = true;

  // ── Daily Report at 07:00 BRT (10:00 UTC) ──────────────────────────────────
  // Cron expression: second=0, minute=0, hour=10, day=*, month=*, weekday=*
  cron.schedule(
    "0 10 * * *",
    async () => {
      console.log("[Cron] Running daily report job...");
      try {
        await runDailyReport();
      } catch (err) {
        console.error("[Cron] Daily report job failed:", err);
      }
    },
    {
      timezone: "America/Sao_Paulo",
    },
  );

  console.log("[Cron] Daily report scheduled for 07:00 BRT (America/Sao_Paulo)");
}
