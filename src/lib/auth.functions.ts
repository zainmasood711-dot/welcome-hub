import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const resolveLoginSchema = z.object({
  identifier: z.string().trim().min(3).max(255),
});

export const resolveEmailByIdentifier = createServerFn({ method: "POST" })
  .inputValidator((input) => resolveLoginSchema.parse(input))
  .handler(async ({ data }) => {
    const identifier = data.identifier.trim();
    if (identifier.includes("@")) {
      return { email: identifier.toLowerCase() };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("phone", identifier)
      .maybeSingle();

    if (error) throw new Error("تعذر التحقق من بيانات تسجيل الدخول");
    if (!profile?.email) throw new Error("بيانات الدخول غير صحيحة");

    return { email: profile.email.toLowerCase() };
  });