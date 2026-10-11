/**
 * Applies `update` to the response's headers, copying the response first when
 * its headers are immutable (`Response.redirect`, or a `fetch` response).
 */
export function updateHeaders(
  res: Response,
  update: (headers: Headers) => void,
): Response {
  try {
    update(res.headers);
    return res;
  } catch {
    const copy = new Response(res.body, res);
    update(copy.headers);
    return copy;
  }
}
