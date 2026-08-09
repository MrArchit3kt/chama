"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";

const saveRulesSchema = z.object({
  title: z.string().min(3).max(120),
  content: z.string().min(20),
});

export async function saveRules(formData: FormData) {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/dashboard");
  }

  const parsed = saveRulesSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    content: String(formData.get("content") ?? ""),
  });

  if (!parsed.success) {
    redirect("/admin/reglement?error=validation");
  }

  const { title, content } = parsed.data;

  try {
    const latest = await db.rulesVersion.findFirst({
      orderBy: {
        versionNumber: "desc",
      },
      select: {
        versionNumber: true,
      },
    });

    const nextVersionNumber = (latest?.versionNumber ?? 0) + 1;

    await db.$transaction(async (tx) => {
      await tx.rulesVersion.updateMany({
        where: {
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      await tx.rulesVersion.create({
        data: {
          versionNumber: nextVersionNumber,
          title,
          content,
          isActive: true,
          isPublished: true,
          publishedAt: new Date(),
          updatedById: admin.id,
        },
      });
    });
  } catch (error) {
    await logServerError("SAVE_RULES_ERROR", error);
    redirect("/admin/reglement?error=server");
  }

  redirect("/admin/reglement?success=1");
}