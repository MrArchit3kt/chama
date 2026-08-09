"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";

export async function closeContactRequest(formData: FormData) {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/dashboard");
  }

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    redirect("/admin/contact?error=server");
  }

  try {
    await db.contactRequest.update({
      where: { id },
      data: {
        status: "CLOSED",
      },
    });
  } catch (error) {
    await logServerError("CLOSE_CONTACT_REQUEST_ERROR", error);
    redirect("/admin/contact?error=server");
  }

  redirect("/admin/contact?closed=1");
}