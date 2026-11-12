import "server-only";

export const json = (data: unknown, status = 200) => Response.json(data, { status });
export const fail = (error: string, status = 400) => Response.json({ error }, { status });

export async function readBody<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
