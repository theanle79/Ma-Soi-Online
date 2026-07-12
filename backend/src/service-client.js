export class GatewayError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function normalizeBaseUrl(baseUrl) {
  const normalized = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!normalized) return normalized;
  return /^https?:\/\//i.test(normalized) ? normalized : `http://${normalized}`;
}

export function createServiceClient(baseUrl, serviceToken = "") {
  const serviceBaseUrl = normalizeBaseUrl(baseUrl);
  return async (path, { method = "GET", body } = {}) => {
    let response;
    try {
      const headers = {};
      if (body) headers["content-type"] = "application/json";
      if (serviceToken) headers.authorization = `Bearer ${serviceToken}`;
      response = await fetch(`${serviceBaseUrl}${path}`, {
        method,
        headers: Object.keys(headers).length ? headers : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new GatewayError("service_unavailable", "Dịch vụ trò chơi đang tạm thời không phản hồi.", 503);
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new GatewayError(
        payload.error || "service_error",
        payload.message || "Không thể hoàn tất thao tác.",
        response.status,
      );
    }
    return payload;
  };
}
