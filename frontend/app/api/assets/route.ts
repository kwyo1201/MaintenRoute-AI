const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const count = url.searchParams.get("number_of_assets") || "10";

    const response = await fetch(
      `${FASTAPI_URL}/assets?number_of_assets=${encodeURIComponent(count)}`,
      { cache: "no-store" }
    );

    const payload = await response.json().catch(() => ({}));

    return Response.json(
      payload,
      { status: response.status }
    );
  } catch {
    return Response.json(
      { detail: "FastAPI assets service is unavailable." },
      { status: 503 }
    );
  }
}
