/**
 * Cron Jobs — CGS Agrícola
 *
 * Schedules background tasks that run on a fixed schedule.
 * Currently registered jobs:
 *   - Daily Report: every day at 19:00 BRT (America/Sao_Paulo)
 */

import cron from "node-cron";
import { runDailyReport } from "./daily-report";

let initialized = false;

export function registerCronJobs(): void {
  if (initialized) return;
  initialized = true;

  // ── Daily Report at 19:00 BRT (America/Sao_Paulo) ──────────────────────────
  // Cron expression: minute=0, hour=19, day=*, month=*, weekday=*
  cron.schedule(
    "0 19 * * *",
    async () => {
      console.log("[Cron] Running daily report job (19:00 BRT)...");
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

  console.log("[Cron] Daily report scheduled for 19:00 BRT (America/Sao_Paulo)");
}
