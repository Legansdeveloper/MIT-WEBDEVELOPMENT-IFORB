let csrfTokenPromise;

export async function getCsrfToken() {
  const csrfInput = document.querySelector('[name="csrfmiddlewaretoken"]');
  if (csrfInput?.value) return csrfInput.value;

  const csrfCookie = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("csrftoken="))
    ?.slice("csrftoken=".length);
  if (csrfCookie) return decodeURIComponent(csrfCookie);

  csrfTokenPromise ??= fetch("/api/csrf/", {
    credentials: "same-origin",
  })
    .then(async (response) => {
      if (!response.ok) throw new Error("Token keamanan sesi tidak dapat dimuat.");
      const payload = await response.json();
      return payload.csrfToken;
    })
    .finally(() => {
      csrfTokenPromise = undefined;
    });

  return csrfTokenPromise;
}

export async function analyzeMessage(formData) {
  const csrfToken = await getCsrfToken();
  const response = await fetch("/api/analyze/", {
    method: "POST",
    credentials: "same-origin",
    headers: { "X-CSRFToken": csrfToken },
    body: formData,
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Pesan tidak dapat diperiksa.");
  }
  return payload;
}
