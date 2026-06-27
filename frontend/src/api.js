export async function api(path, { method = "GET", body, token } = {}) {
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const rawBody = await response.text();
  let data = {};
  try {
    data = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    if (response.status === 404 && String(path).startsWith("/api/eycon/")) {
      throw new Error("EyCon aún no está cargado en el backend activo. Reinicia el servidor backend para publicar las rutas nuevas.");
    }
    throw new Error(data.error || `Error de API (${response.status})`);
  }

  return data;
}
