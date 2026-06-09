import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createTaskInput = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  priority: z.enum(["low", "medium", "high"]),
  dueDate: z.string().datetime().nullable().optional(),
});

const updateTaskInput = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export const listMyTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tasks")
      .select("id, title, description, status, priority, due_date, created_at, updated_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createTaskInput.parse(input))
  .handler(async ({ context, data }) => {
    const { data: created, error } = await context.supabase
      .from("tasks")
      .insert({
        user_id: context.userId,
        title: data.title,
        description: data.description ?? null,
        priority: data.priority,
        due_date: data.dueDate ?? null,
      })
      .select("id, title, description, status, priority, due_date, created_at, updated_at")
      .single();

    if (error) throw new Error(error.message);
    return created;
  });

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateTaskInput.parse(input))
  .handler(async ({ context, data }) => {
    const updates: {
      title?: string;
      description?: string | null;
      status?: "todo" | "in_progress" | "done";
      priority?: "low" | "medium" | "high";
      due_date?: string | null;
    } = {};

    if (data.title !== undefined) updates.title = data.title;
    if (data.description !== undefined) updates.description = data.description;
    if (data.status !== undefined) updates.status = data.status;
    if (data.priority !== undefined) updates.priority = data.priority;
    if (data.dueDate !== undefined) updates.due_date = data.dueDate;

    const { data: updated, error } = await context.supabase
      .from("tasks")
      .update(updates)
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("id, title, description, status, priority, due_date, created_at, updated_at")
      .single();

    if (error) throw new Error(error.message);
    return updated;
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("tasks")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);
    return { success: true };
  });