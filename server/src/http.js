'use strict';
// The deadline includes both headers and body. No retries of ambiguous writes.
async function fetchText(fetchImpl, url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const res = await fetchImpl(url, { ...options, signal: controller.signal });
        const text = await res.text();
        return { ok: res.ok, status: res.status, text: async () => text };
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => {
        controller.abort(); reject(new Error('External request timed out'));
      }, timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}
module.exports = { fetchText };
