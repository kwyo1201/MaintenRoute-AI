const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const response = await fetch(`${FASTAPI_URL}/training-dataset`, {
      method: "POST",
      body: form,
      cache: "no-store"
    });
    const payload = await response.json().catch(() => ({}));
    return Response.json(payload, { status: response.status });
  } catch {
    return Response.json({ detail: "Dataset upload service is unavailable." }, { status: 503 });
  }
}

export async function DELETE() {
  try {
    const response = await fetch(`${FASTAPI_URL}/training-dataset`, {
      method: "DELETE",
      cache: "no-store"
    });
    const payload = await response.json().catch(() => ({}));
    return Response.json(payload, { status: response.status });
  } catch {
    return Response.json({ detail: "Dataset reset service is unavailable." }, { status: 503 });
  }
}
