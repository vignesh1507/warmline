import { redirect } from "next/navigation";
import { isSignedIn } from "@/lib/session";
import { signIn } from "@/lib/actions/auth";
import { Button, inputClass } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  if (await isSignedIn()) redirect(next && next.startsWith("/") ? next : "/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <svg viewBox="0 0 20 20" className="size-6 text-ember" aria-hidden="true" fill="currentColor">
            <path d="M10 1.5c.3 2.1-.6 3.3-1.8 4.4C6.7 7.2 5 8.6 5 11.4A5 5 0 0 0 15 12c0-2.2-1-3.6-2.1-5-.9-1.1-1.6-2.3-1.3-3.9-.5.4-1.1 1-1.6 1.8-.3-1.2-.3-2.3 0-3.4Z" />
          </svg>
          Warmline
        </h1>
        <p className="mt-2 text-sm muted">
          Private by default. Everything you save stays in your own database, and nothing is sent to
          anyone without you pressing something.
        </p>
      </div>

      <form action={signIn} className="card space-y-3 p-5">
        <input type="hidden" name="next" value={next ?? "/"} />
        <div>
          <label className="block text-xs font-medium muted mb-1" htmlFor="passcode">
            Passcode
          </label>
          <input
            id="passcode"
            name="passcode"
            type="password"
            autoFocus
            autoComplete="current-password"
            className={inputClass}
            placeholder="the one in your .env"
          />
        </div>
        {error ? <p className="text-sm text-red-600 dark:text-red-400">That passcode didn&apos;t match.</p> : null}
        <Button type="submit" className="w-full">
          Open Warmline
        </Button>
      </form>
    </main>
  );
}
