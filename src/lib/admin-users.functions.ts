import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const createUserSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(100),
  fullName: z.string().trim().min(1).max(100),
  isAdmin: z.boolean().optional().default(false),
  associationIds: z.array(z.string().uuid()).max(100).optional().default([]),
});

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Response("Forbidden", { status: 403 });
}

export const createUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) {
      throw new Response(error?.message ?? "Falha ao criar usuário", { status: 400 });
    }
    const newId = created.user.id;

    // Trigger handle_new_user inserts profile + 'user' role automatically.
    if (data.isAdmin) {
      await supabaseAdmin.from("user_roles").insert({ user_id: newId, role: "admin" });
    }
    if (data.associationIds.length > 0) {
      await supabaseAdmin.from("user_associations").insert(
        data.associationIds.map((aid) => ({ user_id: newId, association_id: aid })),
      );
    }
    return { id: newId };
  });

export const deleteUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) {
      throw new Response("Você não pode excluir a própria conta", { status: 400 });
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });
