/** DSH's Connection registry authenticates the owner and checks Host/Origin before this route runs. */
export const actionPath = "/api/dsh-strata";

export function handler(service) {
  return async (request) => {
    const respond = (status, body) =>
      Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
    if (
      request.method !== "POST" ||
      !/^application\/json(?:;|$)/i.test(
        request.headers.get("content-type") || "",
      )
    )
      return respond(405, { error: "POST JSON required" });
    try {
      const body = await request.text();
      if (new TextEncoder().encode(body).length > 4 * 1024 * 1024)
        return respond(413, { error: "Request exceeds 4 MiB" });
      const { action, payload } = JSON.parse(body);
      return respond(200, { result: await service.action(action, payload) });
    } catch (error) {
      return respond(400, { error: error.message });
    }
  };
}
