export function GET() {
  return Response.json(
    { status: "ok", service: "south-operation", timestamp: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
