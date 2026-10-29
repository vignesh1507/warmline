import { prisma, type BridgeStatus } from "@warmline/db";
import { revalidatePath } from "next/cache";
import { bridgeAuthorized, unauthorized } from "@/lib/bridge-auth";

/**
 * The bridge reports its connection state here, including the QR code, so the
 * Settings screen can show it. The QR is a login — it is stored only while it is
 * pending, and cleared as soon as the link is made.
 */
export async function POST(request: Request) {
  if (!bridgeAuthorized(request)) return unauthorized();

  const body = (await request.json().catch(() => ({}))) as {
    status?: BridgeStatus;
    qrDataUrl?: string | null;
    phoneHint?: string | null;
    lastError?: string | null;
    fake?: boolean;
  };

  const status = body.status ?? "DISCONNECTED";
  const data = {
    status,
    qrDataUrl: status === "QR_PENDING" ? (body.qrDataUrl ?? null) : null,
    phoneHint: body.phoneHint ?? null,
    lastError: body.lastError ? String(body.lastError).slice(0, 500) : null,
    lastSeenAt: new Date(),
    fake: Boolean(body.fake),
  };

  await prisma.bridgeState.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  revalidatePath("/settings");
  return Response.json({ ok: true });
}

export async function GET(request: Request) {
  if (!bridgeAuthorized(request)) return unauthorized();
  const state = await prisma.bridgeState.findUnique({ where: { id: "singleton" } });
  return Response.json({ ok: true, state });
}
