// ==UserScript==
// @name         Scrapbox Clip - Save to Scrapbox
// @namespace    https://github.com/masseater/userscripts
// @version      0.0.1
// @author       masseater
// @description  Save current page title, URL, and selected text to Scrapbox via API
// @license      MIT
// @homepageURL  https://github.com/masseater/userscripts
// @supportURL   https://github.com/masseater/userscripts/issues
// @match        *://*/*
// @connect      scrapbox.io
// @grant        GM_getValue
// @grant        GM_openInTab
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
  'use strict';

  var _GM_getValue = /* @__PURE__ */ (() => typeof GM_getValue != "undefined" ? GM_getValue : void 0)();
  var _GM_openInTab = /* @__PURE__ */ (() => typeof GM_openInTab != "undefined" ? GM_openInTab : void 0)();
  var _GM_registerMenuCommand = /* @__PURE__ */ (() => typeof GM_registerMenuCommand != "undefined" ? GM_registerMenuCommand : void 0)();
  var _GM_setValue = /* @__PURE__ */ (() => typeof GM_setValue != "undefined" ? GM_setValue : void 0)();
  var _GM_xmlhttpRequest = /* @__PURE__ */ (() => typeof GM_xmlhttpRequest != "undefined" ? GM_xmlhttpRequest : void 0)();
  const CONFIG_KEYS = {
    PROJECT: "scrapbox_project",
    AUTO_OPEN: "scrapbox_auto_open"
  };
  const DEFAULT_CONFIG = {
    [CONFIG_KEYS.PROJECT]: "your-project",
    [CONFIG_KEYS.AUTO_OPEN]: true
  };
  function getConfig(key) {
    return _GM_getValue(key, DEFAULT_CONFIG[key]);
  }
  function setConfig(key, value) {
    _GM_setValue(key, value);
  }
  if (Promise.withResolvers === void 0) {
    Promise.withResolvers = () => {
      const out = {};
      out.promise = new Promise((resolve_, reject_) => {
        out.resolve = resolve_;
        out.reject = reject_;
      });
      return out;
    };
  }
  const dntGlobals = {};
  const dntGlobalThis = createMergeProxy(globalThis, dntGlobals);
  function createMergeProxy(baseObj, extObj) {
    return new Proxy(baseObj, {
      get(_target, prop, _receiver) {
        if (prop in extObj) {
          return extObj[prop];
        } else {
          return baseObj[prop];
        }
      },
      set(_target, prop, value) {
        if (prop in extObj) {
          delete extObj[prop];
        }
        baseObj[prop] = value;
        return true;
      },
      deleteProperty(_target, prop) {
        let success = false;
        if (prop in extObj) {
          delete extObj[prop];
          success = true;
        }
        if (prop in baseObj) {
          delete baseObj[prop];
          success = true;
        }
        return success;
      },
      ownKeys(_target) {
        const baseKeys = Reflect.ownKeys(baseObj);
        const extKeys = Reflect.ownKeys(extObj);
        const extKeysSet = new Set(extKeys);
        return [...baseKeys.filter((k) => !extKeysSet.has(k)), ...extKeys];
      },
      defineProperty(_target, prop, desc) {
        if (prop in extObj) {
          delete extObj[prop];
        }
        Reflect.defineProperty(baseObj, prop, desc);
        return true;
      },
      getOwnPropertyDescriptor(_target, prop) {
        if (prop in extObj) {
          return Reflect.getOwnPropertyDescriptor(extObj, prop);
        } else {
          return Reflect.getOwnPropertyDescriptor(baseObj, prop);
        }
      },
      has(_target, prop) {
        return prop in extObj || prop in baseObj;
      }
    });
  }
  const ERR_MSG_CALLED_WITH$1 = "called with ";
  const ERR_TYPE_STR$1 = "`Err`";
  const ERR_MSG_UNWRAP_OK_BUT_INPUT_IS_ERR$1 = ERR_MSG_CALLED_WITH$1 + ERR_TYPE_STR$1;
  function createOk$1(val) {
    const r = {
      ok: true,
      val,
      // XXX:
      //  We need to fill with `null` to improve the compatibility with Next.js
      //  see https://github.com/option-t/option-t/pull/1256
      err: null
    };
    return r;
  }
  function isErr$1(input) {
    return !input.ok;
  }
  function createErr$1(err) {
    const r = {
      ok: false,
      // XXX:
      //  We need to fill with `null` to improve the compatibility with Next.js
      //  see https://github.com/option-t/option-t/pull/1256
      val: null,
      err
    };
    return r;
  }
  function unwrapOk$1(input) {
    return expectOk$1(input, ERR_MSG_UNWRAP_OK_BUT_INPUT_IS_ERR$1);
  }
  function expectOk$1(input, msg) {
    if (isErr$1(input)) {
      throw new TypeError(msg);
    }
    const val = input.val;
    return val;
  }
  function unsafeUnwrapValueInOkWithoutAnyCheck(input) {
    const val = input.val;
    return val;
  }
  function mapForResult(input, transformer) {
    if (isErr$1(input)) {
      return input;
    }
    const val = unsafeUnwrapValueInOkWithoutAnyCheck(input);
    const result = transformer(val);
    return createOk$1(result);
  }
  async function mapAsyncForResult(input, transformer) {
    if (isErr$1(input)) {
      const fallback = input;
      return fallback;
    }
    const inner = unsafeUnwrapValueInOkWithoutAnyCheck(input);
    const mapped = await transformer(inner);
    const result = createOk$1(mapped);
    return result;
  }
  const responseIntoResult = (response) => !response.ok ? createErr$1({
    name: "HTTPError",
    message: `${response.status} ${response.statusText}`,
    response
  }) : createOk$1(response);
  const robustFetch = async (input, init2) => {
    const request = new Request(input, init2);
    try {
      return createOk$1(await globalThis.fetch(request));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        return createErr$1({
          name: "AbortError",
          message: e.message,
          request
        });
      }
      if (e instanceof TypeError) {
        return createErr$1({
          name: "NetworkError",
          message: e.message,
          request
        });
      }
      throw e;
    }
  };
  const setDefaults = (options) => {
    const { fetch = robustFetch, hostName = "scrapbox.io", ...rest } = options;
    return { fetch, hostName, ...rest };
  };
  const getProfile_toRequest = (init2) => {
    const { sid, hostName } = setDefaults(init2 ?? {});
    return new Request(`https://${hostName}/api/users/me`, sid ? { headers: { Cookie: cookie(sid) } } : void 0);
  };
  const getProfile_fromResponse = (response) => mapAsyncForResult(responseIntoResult(response), async (res) => await res.json());
  const getProfile = /* @__PURE__ */ (() => {
    const fn = async (init2) => {
      const { fetch, ...rest } = setDefaults(init2 ?? {});
      const resResult = await fetch(getProfile_toRequest(rest));
      return isErr$1(resResult) ? resResult : getProfile_fromResponse(unwrapOk$1(resResult));
    };
    fn.toRequest = getProfile_toRequest;
    fn.fromResponse = getProfile_fromResponse;
    return fn;
  })();
  const cookie = (sid) => `connect.sid=${sid}`;
  const getCSRFToken = async (init2) => {
    const csrf = (init2 == null ? void 0 : init2.csrf) ?? dntGlobalThis._csrf;
    return csrf ? createOk$1(csrf) : mapForResult(await getProfile(init2), (user) => user.csrfToken);
  };
  const importPages = async (project, data, init2) => {
    if (data.pages.length === 0)
      return createOk$1("No pages to import.");
    const { sid, hostName, fetch } = setDefaults(init2 ?? {});
    const formData = new FormData();
    formData.append("import-file", new Blob([JSON.stringify(data)], {
      type: "application/octet-stream"
    }));
    formData.append("name", "undefined");
    const csrfResult = await getCSRFToken(init2);
    if (isErr$1(csrfResult))
      return csrfResult;
    const req = new Request(`https://${hostName}/api/page-data/import/${project}.json`, {
      method: "POST",
      headers: {
        ...sid ? { Cookie: cookie(sid) } : {},
        Accept: "application/json, text/plain, */*",
        "X-CSRF-TOKEN": unwrapOk$1(csrfResult)
      },
      body: formData
    });
    const res = await fetch(req);
    if (isErr$1(res))
      return res;
    return mapAsyncForResult(responseIntoResult(unwrapOk$1(res)), async (res2) => (await res2.json()).message);
  };
  const alphabet$1 = new TextEncoder().encode("0123456789abcdef");
  const rAlphabet$1 = new Uint8Array(128).fill(16);
  alphabet$1.forEach((byte, i) => rAlphabet$1[byte] = i);
  new TextEncoder().encode("ABCDEF").forEach((byte, i) => rAlphabet$1[byte] = i + 10);
  const alphabet = new TextEncoder().encode("0123456789abcdef");
  const rAlphabet = new Uint8Array(128).fill(16);
  alphabet.forEach((byte, i) => rAlphabet[byte] = i);
  new TextEncoder().encode("ABCDEF").forEach((byte, i) => rAlphabet[byte] = i + 10);
  const ERR_MSG_CALLED_WITH = "called with ";
  const ERR_TYPE_STR = "`Err`";
  const ERR_MSG_UNWRAP_OK_BUT_INPUT_IS_ERR = ERR_MSG_CALLED_WITH + ERR_TYPE_STR;
  function createOk(val) {
    const r = {
      ok: true,
      val,
      // XXX:
      //  We need to fill with `null` to improve the compatibility with Next.js
      //  see https://github.com/option-t/option-t/pull/1256
      err: null
    };
    return r;
  }
  function isErr(input) {
    return !input.ok;
  }
  function createErr(err) {
    const r = {
      ok: false,
      // XXX:
      //  We need to fill with `null` to improve the compatibility with Next.js
      //  see https://github.com/option-t/option-t/pull/1256
      val: null,
      err
    };
    return r;
  }
  function unwrapOk(input) {
    return expectOk(input, ERR_MSG_UNWRAP_OK_BUT_INPUT_IS_ERR);
  }
  function expectOk(input, msg) {
    if (isErr(input)) {
      throw new TypeError(msg);
    }
    const val = input.val;
    return val;
  }
  const gmFetch = async (input, init2) => {
    const request = new Request(input, init2);
    const url = request.url;
    const method = request.method;
    const headers = {};
    request.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "content-type" || !((init2 == null ? void 0 : init2.body) instanceof FormData)) {
        headers[key] = value;
      }
    });
    let data;
    if ((init2 == null ? void 0 : init2.body) instanceof FormData) {
      data = init2.body;
    } else if (request.body) {
      data = await request.text();
    }
    return new Promise((resolve) => {
      _GM_xmlhttpRequest({
        method,
        url,
        headers,
        data,
        anonymous: false,
        // Send cookies
        responseType: "blob",
        onload: (response) => {
          const responseHeaders = new Headers();
          response.responseHeaders.split("\r\n").forEach((line) => {
            const [key, ...valueParts] = line.split(":");
            if (key && valueParts.length > 0) {
              responseHeaders.set(key.trim(), valueParts.join(":").trim());
            }
          });
          const res = new Response(response.response, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders
          });
          resolve(createOk(res));
        },
        onerror: (error) => {
          resolve(
            createErr({
              name: "NetworkError",
              message: error.error || "Network error",
              request
            })
          );
        },
        onabort: () => {
          resolve(
            createErr({
              name: "AbortError",
              message: "Request aborted",
              request
            })
          );
        }
      });
    });
  };
  const fetchOptions = { fetch: gmFetch };
  function isLoggedIn(user) {
    return "id" in user && !("isGuest" in user && user.isGuest);
  }
  async function checkScrapboxLogin() {
    const result = await getProfile(fetchOptions);
    if (isErr(result)) {
      throw new Error("Failed to get profile");
    }
    const user = unwrapOk(result);
    if (!isLoggedIn(user)) {
      throw new Error("Not logged in");
    }
    return user;
  }
  async function importPageToScrapbox(project, title, lines) {
    const result = await importPages(
      project,
      { pages: [{ title, lines }] },
      fetchOptions
    );
    if (isErr(result)) {
      throw new Error(`Import failed: ${JSON.stringify(result)}`);
    }
  }
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
  function escapeScrapboxTitle(title) {
    return title.replace(/\//g, "／").replace(/\[/g, "［").replace(/\]/g, "］").replace(/#/g, "＃");
  }
  function formatTextForScrapbox(text) {
    return text.split("\n").map((line) => " > " + line).join("\n");
  }
  const COLORS = {
    info: "#323232",
    success: "#2e7d32",
    error: "#c62828",
    warning: "#f57c00"
  };
  function ensureStyles() {
    if (document.getElementById("scrapbox-clip-notification-style")) return;
    const style = document.createElement("style");
    style.id = "scrapbox-clip-notification-style";
    style.textContent = `
    @keyframes scrapbox-clip-slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
    document.head.appendChild(style);
  }
  function showNotification(message, type = "info", duration = 3e3, linkUrl = null) {
    ensureStyles();
    const notification = document.createElement("div");
    notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${COLORS[type]};
    color: white;
    padding: 12px 24px;
    border-radius: 4px;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    animation: scrapbox-clip-slideIn 0.3s ease;
    max-width: 300px;
    ${linkUrl ? "cursor: pointer;" : ""}
  `;
    notification.textContent = message;
    if (linkUrl) {
      notification.title = "Click to open page";
      notification.addEventListener("click", () => {
        _GM_openInTab(linkUrl, { active: true });
        notification.remove();
      });
    }
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.animation = "scrapbox-clip-slideIn 0.3s ease reverse";
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }
  const STYLES$1 = `
  #scrapbox-clip-settings {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #fff;
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 24px;
    z-index: 999999;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    min-width: 320px;
  }
  #scrapbox-clip-settings h2 {
    margin: 0 0 16px 0;
    font-size: 18px;
    color: #333;
    border-bottom: 2px solid #00bcd4;
    padding-bottom: 8px;
  }
  #scrapbox-clip-settings label {
    display: block;
    margin-bottom: 16px;
    color: #555;
    font-size: 14px;
  }
  #scrapbox-clip-settings input[type="text"] {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    margin-top: 4px;
    box-sizing: border-box;
  }
  #scrapbox-clip-settings input[type="text"]:focus {
    outline: none;
    border-color: #00bcd4;
  }
  #scrapbox-clip-settings .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }
  #scrapbox-clip-settings input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }
  #scrapbox-clip-settings .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
  }
  #scrapbox-clip-settings button {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.2s;
  }
  #scrapbox-clip-settings .save-btn {
    background: #00bcd4;
    color: white;
  }
  #scrapbox-clip-settings .save-btn:hover {
    background: #00acc1;
  }
  #scrapbox-clip-settings .cancel-btn {
    background: #e0e0e0;
    color: #333;
  }
  #scrapbox-clip-settings .cancel-btn:hover {
    background: #d0d0d0;
  }
  #scrapbox-clip-settings .test-btn {
    background: #4caf50;
    color: white;
    margin-right: auto;
  }
  #scrapbox-clip-settings .test-btn:hover {
    background: #43a047;
  }
  #scrapbox-clip-settings .status {
    margin-top: 12px;
    padding: 8px;
    border-radius: 4px;
    font-size: 13px;
    display: none;
  }
  #scrapbox-clip-settings .status.success {
    background: #e8f5e9;
    color: #2e7d32;
    display: block;
  }
  #scrapbox-clip-settings .status.error {
    background: #ffebee;
    color: #c62828;
    display: block;
  }
  #scrapbox-clip-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    z-index: 999998;
  }
`;
  function showSettingsDialog() {
    const existingDialog = document.getElementById("scrapbox-clip-settings");
    if (existingDialog) {
      existingDialog.remove();
      return;
    }
    const currentProject = getConfig(CONFIG_KEYS.PROJECT);
    const currentAutoOpen = getConfig(CONFIG_KEYS.AUTO_OPEN);
    const dialog = document.createElement("div");
    dialog.id = "scrapbox-clip-settings";
    dialog.innerHTML = `
    <style>${STYLES$1}</style>
    <h2>Scrapbox Clip Settings</h2>
    <label>
      Project Name:
      <input type="text" id="scrapbox-clip-project" value="${escapeHtml(currentProject)}" placeholder="your-project">
    </label>
    <label class="checkbox-label">
      <input type="checkbox" id="scrapbox-clip-auto-open" ${currentAutoOpen ? "checked" : ""}>
      Automatically open the created page
    </label>
    <div id="scrapbox-clip-status" class="status"></div>
    <div class="buttons">
      <button class="test-btn" id="scrapbox-clip-test">Test Connection</button>
      <button class="cancel-btn" id="scrapbox-clip-cancel">Cancel</button>
      <button class="save-btn" id="scrapbox-clip-save">Save</button>
    </div>
  `;
    const overlay = document.createElement("div");
    overlay.id = "scrapbox-clip-overlay";
    document.body.appendChild(overlay);
    document.body.appendChild(dialog);
    const statusEl = document.getElementById("scrapbox-clip-status");
    const closeDialog = () => {
      dialog.remove();
      overlay.remove();
      document.removeEventListener("keydown", escapeHandler);
    };
    const escapeHandler = (e) => {
      if (e.key === "Escape") closeDialog();
    };
    document.getElementById("scrapbox-clip-test").addEventListener("click", async () => {
      statusEl.className = "status";
      statusEl.textContent = "Testing...";
      statusEl.style.display = "block";
      statusEl.style.background = "#fff3e0";
      statusEl.style.color = "#e65100";
      try {
        const user = await checkScrapboxLogin();
        statusEl.className = "status success";
        statusEl.textContent = `Connected as: ${user.displayName || user.name}`;
      } catch {
        statusEl.className = "status error";
        statusEl.textContent = `Not logged in. Please login to scrapbox.io first.`;
      }
    });
    document.getElementById("scrapbox-clip-save").addEventListener("click", () => {
      const projectInput = document.getElementById("scrapbox-clip-project");
      const autoOpenInput = document.getElementById("scrapbox-clip-auto-open");
      const project = projectInput.value.trim();
      const autoOpen = autoOpenInput.checked;
      if (!project) {
        alert("Please enter a project name.");
        return;
      }
      setConfig(CONFIG_KEYS.PROJECT, project);
      setConfig(CONFIG_KEYS.AUTO_OPEN, autoOpen);
      closeDialog();
      showNotification("Settings saved!");
    });
    document.getElementById("scrapbox-clip-cancel").addEventListener("click", closeDialog);
    overlay.addEventListener("click", closeDialog);
    document.addEventListener("keydown", escapeHandler);
  }
  const STYLES = `
  #scrapbox-clip-context-menu {
    display: none;
    position: fixed;
    background: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    min-width: 200px;
    overflow: hidden;
  }
  #scrapbox-clip-context-menu .menu-item {
    padding: 10px 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  #scrapbox-clip-context-menu .menu-item:hover {
    background: #f5f5f5;
  }
  #scrapbox-clip-context-menu .menu-item svg {
    width: 16px;
    height: 16px;
    fill: #666;
  }
  #scrapbox-clip-context-menu .menu-separator {
    height: 1px;
    background: #e0e0e0;
    margin: 4px 0;
  }
`;
  const ICON_SELECTION = `<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>`;
  const ICON_PAGE = `<svg viewBox="0 0 24 24"><path d="M17 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm2 16H5V5h11.17L19 7.83V19zm-7-7c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`;
  function createContextMenu(onSave) {
    const menu = document.createElement("div");
    menu.id = "scrapbox-clip-context-menu";
    menu.innerHTML = `
    <style>${STYLES}</style>
    <div class="menu-item" id="scrapbox-clip-save-selection">
      ${ICON_SELECTION}
      <span>Save selection to Scrapbox</span>
    </div>
    <div class="menu-separator"></div>
    <div class="menu-item" id="scrapbox-clip-save-page">
      ${ICON_PAGE}
      <span>Save page to Scrapbox</span>
    </div>
  `;
    document.body.appendChild(menu);
    let currentSelection = "";
    const hideMenu = () => {
      menu.style.display = "none";
    };
    document.addEventListener("contextmenu", (e) => {
      if (!e.altKey) return;
      const selection = window.getSelection();
      const selectedText = (selection == null ? void 0 : selection.toString().trim()) ?? "";
      if (selectedText) {
        e.preventDefault();
        currentSelection = selectedText;
        menu.style.display = "block";
        menu.style.left = `${Math.min(e.clientX, window.innerWidth - 220)}px`;
        menu.style.top = `${Math.min(e.clientY, window.innerHeight - 100)}px`;
        document.getElementById("scrapbox-clip-save-selection").style.display = "flex";
      }
    });
    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target)) hideMenu();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hideMenu();
    });
    document.getElementById("scrapbox-clip-save-selection").addEventListener("click", () => {
      hideMenu();
      onSave(currentSelection);
    });
    document.getElementById("scrapbox-clip-save-page").addEventListener("click", () => {
      hideMenu();
      onSave("");
    });
  }
  async function createScrapboxPage(selectedText = "") {
    const project = getConfig(CONFIG_KEYS.PROJECT);
    const autoOpen = getConfig(CONFIG_KEYS.AUTO_OPEN);
    if (!project || project === "your-project") {
      alert(
        'Please configure your Scrapbox project first.\n\nClick the Tampermonkey/Greasemonkey icon and select "Scrapbox Clip Settings".'
      );
      showSettingsDialog();
      return;
    }
    const pageTitle = escapeScrapboxTitle(document.title);
    const pageUrl = location.href;
    const lines = [pageTitle, `[${pageUrl} ${pageTitle}]`, ""];
    if (selectedText) {
      const quotedLines = formatTextForScrapbox(selectedText).split("\n");
      lines.push(...quotedLines, "");
    }
    showNotification("Saving to Scrapbox...", "info", 1e4);
    try {
      await checkScrapboxLogin();
      await importPageToScrapbox(project, pageTitle, lines);
      const savedPageUrl = `https://scrapbox.io/${encodeURIComponent(project)}/${encodeURIComponent(pageTitle)}`;
      if (autoOpen) {
        _GM_openInTab(savedPageUrl, { active: true });
        showNotification(`Saved to ${project}!`, "success");
      } else {
        showNotification(`Saved to ${project}! (Click to open)`, "success", 8e3, savedPageUrl);
      }
    } catch (error) {
      console.error("Scrapbox Clip Error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      if (errorMessage.includes("Not logged in") || errorMessage.includes("Not authorized")) {
        showNotification("Please login to Scrapbox first!", "error", 5e3);
      } else {
        showNotification(`Error: ${errorMessage}`, "error", 8e3);
      }
    }
  }
  _GM_registerMenuCommand("Save to Scrapbox", () => {
    var _a;
    const selectedText = ((_a = window.getSelection()) == null ? void 0 : _a.toString().trim()) ?? "";
    createScrapboxPage(selectedText);
  });
  _GM_registerMenuCommand("Scrapbox Clip Settings", showSettingsDialog);
  _GM_registerMenuCommand("Check Scrapbox Login", async () => {
    try {
      const user = await checkScrapboxLogin();
      showNotification(`Logged in as: ${user.displayName || user.name}`, "success");
    } catch {
      showNotification("Not logged in to Scrapbox", "error");
      _GM_openInTab("https://scrapbox.io/", { active: true });
    }
  });
  function init() {
    createContextMenu(createScrapboxPage);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();