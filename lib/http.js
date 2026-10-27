import { timingSafeEqual } from "node:crypto";

/** A per-load owner capability protects host file browsing and process operations. */
export function handler(service, token, origin) {
  return async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    const respond = (status, body) => {
      res.writeHead(status);
      res.end(JSON.stringify(body));
    };
    const supplied = Buffer.from(
      String(req.headers.authorization || "").replace(/^Bearer /, ""),
    );
    const expected = Buffer.from(token);
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      return respond(401, { error: "Owner capability required" });
    if (
      req.method !== "POST" ||
      !/^application\/json(?:;|$)/i.test(req.headers["content-type"] || "")
    )
      return respond(405, { error: "POST JSON required" });
    if (req.headers.origin && req.headers.origin !== origin())
      return respond(403, { error: "Origin refused" });
    try {
      const chunks = [];
      let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 4 * 1024 * 1024)
          return respond(413, { error: "Request exceeds 4 MiB" });
        chunks.push(chunk);
      }
      // Decode once: a UTF-8 character can span two network chunks.
      const { action, payload } = JSON.parse(
        Buffer.concat(chunks).toString("utf8"),
      );
      respond(200, { result: await service.action(action, payload) });
    } catch (error) {
      respond(400, { error: error.message });
    }
  };
}
