/**
 * GM_xmlhttpRequest wrapper that returns Result<Response, FetchError>
 * compatible with @cosense/std's fetch option.
 *
 * This bypasses CSP restrictions that block cross-origin fetch requests.
 */
import { GM_xmlhttpRequest } from 'vite-plugin-monkey/dist/client';
import { createOk, createErr, type Result } from 'option-t/plain_result';

type FetchError =
  | { name: 'NetworkError'; message: string; request: Request }
  | { name: 'AbortError'; message: string; request: Request };

type RobustFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Result<Response, FetchError>>;

export const gmFetch: RobustFetch = async (input, init) => {
  const request = new Request(input, init);
  const url = request.url;
  const method = request.method;

  // Build headers object from Request
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    // Skip Content-Type for FormData - browser/GM sets it with boundary
    if (key.toLowerCase() !== 'content-type' || !(init?.body instanceof FormData)) {
      headers[key] = value;
    }
  });

  // Get body content
  let data: string | FormData | undefined;
  if (init?.body instanceof FormData) {
    data = init.body;
  } else if (request.body) {
    data = await request.text();
  }

  return new Promise((resolve) => {
    GM_xmlhttpRequest({
      method: method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD',
      url,
      headers,
      data,
      anonymous: false, // Send cookies
      responseType: 'blob',
      onload: (response) => {
        const responseHeaders = new Headers();
        response.responseHeaders.split('\r\n').forEach((line) => {
          const [key, ...valueParts] = line.split(':');
          if (key && valueParts.length > 0) {
            responseHeaders.set(key.trim(), valueParts.join(':').trim());
          }
        });

        const res = new Response(response.response as Blob, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });

        resolve(createOk(res));
      },
      onerror: (error) => {
        resolve(
          createErr({
            name: 'NetworkError',
            message: error.error || 'Network error',
            request,
          })
        );
      },
      onabort: () => {
        resolve(
          createErr({
            name: 'AbortError',
            message: 'Request aborted',
            request,
          })
        );
      },
    });
  });
};
