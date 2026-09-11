// Sandbox work has no persistent or external effects. A recycled container may
// briefly refuse connections; wait for its fresh process namespace.
export async function sandboxRequest(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const deadline = Date.now() + 20000;
  for (;;) {
    try {
      const response = await fetch(url, init);
      if (response.status !== 409 || Date.now() >= deadline) return response;
    } catch (error) {
      if (
        Date.now() >= deadline ||
        (error as { cause?: { code?: string } }).cause?.code !== "ECONNREFUSED"
      )
        throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}
