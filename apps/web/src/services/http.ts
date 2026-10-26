/** HTTP client for the NestJS API (same origin, cookie session). */

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function parse(res: Response) {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const code = data?.code ?? (res.status === 429 ? 'RATE_LIMIT' : 'ERROR');
    let message = data?.code ? data.message : null;
    if (!message) {
      if (res.status === 429) message = 'ស្នើច្រើនពេក។ សូមរង់ចាំបន្តិច រួចព្យាយាមម្ដងទៀត។';
      else if (res.status === 400) message = 'ព័ត៌មានដែលបានបញ្ចូលមិនត្រឹមត្រូវ';
      else if (res.status === 413) message = 'ឯកសារធំពេក';
      else message = 'មានបញ្ហាកើតឡើង។ សូមព្យាយាមម្ដងទៀត។';
    }
    throw new ApiError(code, message, res.status);
  }
  return data;
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch('/api' + path, {
    credentials: 'same-origin',
    ...rest,
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  }).catch(() => {
    throw new ApiError('NETWORK', 'មិនអាចភ្ជាប់ទៅម៉ាស៊ីនមេបានទេ។ សូមពិនិត្យអ៊ីនធឺណិត។', 0);
  });
  return parse(res) as Promise<T>;
}

/** Multipart upload with progress (fetch has no upload progress). Abortable. */
export function upload<T>(
  path: string,
  form: FormData,
  onProgress: (pct: number) => void,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api' + path);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => parse(new Response(xhr.responseText || null, { status: xhr.status })).then(resolve, reject);
    xhr.onerror = () => reject(new ApiError('NETWORK', 'ការផ្ទុកឡើងបរាជ័យ។ សូមពិនិត្យអ៊ីនធឺណិត។', 0));
    xhr.onabort = () => reject(new ApiError('ABORTED', 'បានបោះបង់', 0));
    signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(form);
  });
}
