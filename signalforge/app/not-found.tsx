import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap flex min-h-dvh flex-col items-start justify-center py-20">
      <p className="eyebrow mb-3">404</p>
      <h1 className="h-display text-[2.4rem]">No signal here.</h1>
      <p className="mt-3 text-ink-2">The page you asked for does not exist.</p>
      <Link href="/" className="mt-6 text-accent-ink underline underline-offset-4">
        Back to Signalforge
      </Link>
    </main>
  );
}
