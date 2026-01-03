# Gotchas

## Scrapbox API

### Login Detection
- Scrapbox `/api/users/me` returns `200 OK` for both authenticated and unauthenticated requests
- **Unauthenticated:** `{"isGuest": true, "csrfToken": "..."}`
- **Authenticated:** `{"isGuest": false, "id": "...", "name": "...", "csrfToken": "...", ...}`
- Always check `isGuest` field, NOT just the presence of `id`

### CSRF Token Required for Write APIs
- Import API (`/api/page-data/import/`) requires `X-CSRF-TOKEN` header
- CSRF token is returned in `/api/users/me` response as `csrfToken` field
- Store the token from login check and use it in subsequent write requests
- Reference: https://scrapbox.io/villagepump/X-CSRF-TOKEN

### Import API Requires File Upload Format
- `/api/page-data/import/{project}.json` expects `multipart/form-data` with file attachment
- Error `{"message":"import file is not attached"}` means JSON body was sent instead of file
- Correct approach: Use `FormData` with `Blob` to simulate file upload:
  ```javascript
  const blob = new Blob([jsonString], { type: 'application/json' });
  const formData = new FormData();
  formData.append('import-file', blob, 'import.json');
  ```

### GM_xmlhttpRequest Cookie Handling
- `anonymous: false` is supposed to send cookies, but behavior varies across userscript managers (Tampermonkey, Greasemonkey, Violentmonkey)
- Always test cookie-authenticated requests across different userscript managers

### GM_xmlhttpRequest FormData Support
- `GM_xmlhttpRequest` CAN handle `FormData` objects in the `data` property
- **CRITICAL:** Do NOT set `Content-Type` header manually when using FormData
  - Browser must set it automatically with correct boundary
  - Setting it manually breaks multipart/form-data encoding
- Native `fetch` is blocked by page's CSP for cross-origin requests
- `GM_xmlhttpRequest` bypasses CSP - use it for cross-origin API calls
- Example:
  ```javascript
  const formData = new FormData();
  formData.append('file', blob, 'filename.json');
  GM_xmlhttpRequest({
    method: 'POST',
    url: url,
    headers: { 'X-CSRF-TOKEN': token },  // OK, but NO Content-Type!
    data: formData,
    anonymous: false,
  });
  ```
- The `@connect` directive must include the target domain for cross-origin requests

## @cosense/std Library Integration

### CSP Bypass with Custom Fetch
- `@cosense/std` functions (`getProfile`, `importPages`, etc.) use `fetch` API internally
- Page CSP blocks cross-origin requests to `scrapbox.io`
- Solution: Pass a custom `fetch` option that wraps `GM_xmlhttpRequest`
- The `fetch` option expects a function returning `Result<Response, FetchError>` (from `option-t`)
- Example:
  ```typescript
  import { getProfile } from '@cosense/std/rest';
  import { gmFetch } from './gm-fetch';

  const result = await getProfile({ fetch: gmFetch });
  ```

## General Userscript Patterns

### Avoid Auto-Opening Tabs on Errors
- Never automatically open new tabs in error handlers without rate limiting
- Users may trigger the action repeatedly, causing infinite tab loops
- Use notifications or confirmations instead of automatic tab opening
