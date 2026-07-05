// Supabase returns a PostgrestError — a PLAIN OBJECT ({message, details, hint, code}),
// NOT an Error instance. So `err instanceof Error` is false for RPC/query failures and
// swallows the real message (e.g. "those times were just taken"). Read `.message` off
// the object shape first, then fall back.
export function errMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
