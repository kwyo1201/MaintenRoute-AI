const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

export async function GET() {
  try {
    const response = await fetch(`${FASTAPI_URL}/model-selection/status`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    return Response.json(payload, { status: response.status });
  } catch {
    return Response.json({ detail: "Model selection status is unavailable." }, { status: 503 });
  }
}

export async function POST() {
  try {
    const response = await fetch(`${FASTAPI_URL}/model-selection`, {
      method: "POST",
      cache: "no-store"
    });
    const payload = await response.json().catch(() => ({}));
    return Response.json(payload, { status: response.status });
  } catch {
    return Response.json({ detail: "Model selection service is unavailable." }, { status: 503 });
  }
}
