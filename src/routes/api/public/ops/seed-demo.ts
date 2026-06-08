import { createFileRoute } from "@tanstack/react-router";

import { getDbStatus, seedDemoData } from "@/lib/demo-seed.server";

export const Route = createFileRoute("/api/public/ops/seed-demo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const shouldSeed = url.searchParams.get("seed") === "1";
          const before = await getDbStatus();

          if (!shouldSeed) {
            return Response.json({ ok: true, dryRun: true, before });
          }

          const seeded = await seedDemoData();
          const after = await getDbStatus();
          return Response.json({ ok: true, seeded, before, after });
        } catch (error) {
          return Response.json(
            { ok: false, message: error instanceof Error ? error.message : "تعذر تنفيذ seed" },
            { status: 500 },
          );
        }
      },
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const dryRun = url.searchParams.get("dry") === "1";

          const before = await getDbStatus();
          if (dryRun) {
            return Response.json({ ok: true, dryRun: true, before });
          }

          const seeded = await seedDemoData();
          const after = await getDbStatus();

          return Response.json({ ok: true, seeded, before, after });
        } catch (error) {
          return Response.json(
            {
              ok: false,
              message: error instanceof Error ? error.message : "تعذر تنفيذ seed",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
