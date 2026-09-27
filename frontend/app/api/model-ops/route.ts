const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

export async function GET() {
  try {
    const response = await fetch(`${FASTAPI_URL}/model-ops`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    return Response.json(payload, { status: response.status });
  } catch {
    return Response.json({ detail: "Model operations service is unavailable." }, { status: 503 });
  }
}
