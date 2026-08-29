/**
 * Loads .env then .env.local for the CLI scripts.
 *
 * Next.js does this itself, so the web app never needs it - but `tsx` does not,
 * and a bench run that silently sees no credentials looks like a broken key
 * rather than an unloaded file. Import this FIRST, before anything that reads
 * process.env at module scope.
 *
 * .env.local wins, matching Next's precedence.
 */
for (const file of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Absent is fine; either file is optional.
  }
}
