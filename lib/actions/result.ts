export type ActionResult =
  | {
      ok: true;
      message?: string;
      journalLineCount?: number;
      jobCount?: number;
      documentNo?: string;
      documentId?: string;
    }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
    };

export function firstIssueMessage(
  error: {
    issues: Array<{ message: string; path: Array<string | number | symbol> }>;
  },
  fallback: string,
): string {
  const issue = error.issues[0];
  if (!issue) return fallback;
  const path = issue.path.filter((part) => typeof part === "string").join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

export function toFieldErrors(error: {
  issues: Array<{ message: string; path: Array<string | number | symbol> }>;
}): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path
      .filter((part) => typeof part === "string")
      .join(".");
    if (!key) continue;
    result[key] = [...(result[key] ?? []), issue.message];
  }
  return result;
}
