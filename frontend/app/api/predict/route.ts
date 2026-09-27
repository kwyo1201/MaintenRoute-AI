const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch(`${FASTAPI_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store"
    });
    const payload = await response.json().catch(() => ({}));
    return Response.json(payload, { status: response.status });
  } catch {
    return Response.json({ detail: "FastAPI prediction service is unavailable." }, { status: 503 });
  }
}
