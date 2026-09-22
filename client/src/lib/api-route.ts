import { errorResponse, requestIdFrom } from "@south-operation/server/errors";

type ApiResult = { data: unknown; status?: number };
type Handler<Ctx> = (request: Request, context: Ctx, requestId: string) => Promise<ApiResult>;

export function apiRoute<Ctx>(handler: Handler<Ctx>) {
  return async (request: Request, context: Ctx) => {
    const requestId = requestIdFrom(request);
    try {
      const { data, status } = await handler(request, context, requestId);
      return Response.json(
        { data, requestId },
        { status: status ?? 200, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
      );
    } catch (error) {
      return errorResponse(error, requestId);
    }
  };
}
