// ==UserScript==
// @name         Scrapbox Clip - Save to Scrapbox
// @namespace    https://github.com/your-username/scrapbox-clip
// @version      2.0.0
// @description  Save current page title, URL, and selected text to Scrapbox via API
// @author       You
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// @grant        GM_xmlhttpRequest
// @connect      scrapbox.io
// @license      MIT
// @homepageURL  https://github.com/your-username/scrapbox-clip
// @supportURL   https://github.com/your-username/scrapbox-clip/issues
// ==/UserScript==

(function () {
  'use strict';

  // ========================================
  // Configuration
  // ========================================
  const CONFIG_KEYS = {
    PROJECT: 'scrapbox_project',
    AUTO_OPEN: 'scrapbox_auto_open',
  };

  const DEFAULT_CONFIG = {
    [CONFIG_KEYS.PROJECT]: 'your-project',
    [CONFIG_KEYS.AUTO_OPEN]: true,
  };

  const SCRAPBOX_API_BASE = 'https://scrapbox.io/api';

  // ========================================
  // Config Management
  // ========================================
  function getConfig(key) {
    return GM_getValue(key, DEFAULT_CONFIG[key]);
  }

  function setConfig(key, value) {
    GM_setValue(key, value);
  }

  // ========================================
  // Scrapbox API Functions
  // ========================================

  /**
   * Check if user is logged into Scrapbox
   */
  function checkScrapboxLogin() {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: `${SCRAPBOX_API_BASE}/users/me`,
        withCredentials: true,
        onload: (response) => {
          if (response.status === 200) {
            try {
              const user = JSON.parse(response.responseText);
              if (user && user.id) {
                resolve(user);
              } else {
                reject(new Error('Not logged in'));
              }
            } catch {
              reject(new Error('Invalid response'));
            }
          } else {
            reject(new Error(`HTTP ${response.status}`));
          }
        },
        onerror: (error) => {
          reject(new Error('Network error'));
        },
      });
    });
  }

  /**
   * Import pages to Scrapbox project
   * Uses the import API to create/update pages
   */
  function importPageToScrapbox(project, title, lines) {
    return new Promise((resolve, reject) => {
      const importData = {
        pages: [
          {
            title: title,
            lines: lines,
          },
        ],
      };

      GM_xmlhttpRequest({
        method: 'POST',
        url: `${SCRAPBOX_API_BASE}/page-data/import/${encodeURIComponent(project)}.json`,
        headers: {
          'Content-Type': 'application/json;charset=utf-8',
        },
        data: JSON.stringify(importData),
        withCredentials: true,
        onload: (response) => {
          if (response.status === 200) {
            try {
              const result = JSON.parse(response.responseText);
              resolve(result);
            } catch {
              // Some success responses may not be JSON
              resolve({ success: true });
            }
          } else if (response.status === 401 || response.status === 403) {
            reject(new Error('Not authorized. Please login to Scrapbox first.'));
          } else {
            reject(new Error(`API Error: HTTP ${response.status}`));
          }
        },
        onerror: () => {
          reject(new Error('Network error. Please check your connection.'));
        },
      });
    });
  }

  /**
   * Check if page exists in project
   */
  function checkPageExists(project, title) {
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: `${SCRAPBOX_API_BASE}/pages/${encodeURIComponent(project)}/${encodeURIComponent(title)}`,
        withCredentials: true,
        onload: (response) => {
          resolve(response.status === 200);
        },
        onerror: () => {
          resolve(false);
        },
      });
    });
  }

  // ========================================
  // Settings Dialog
  // ========================================
  function showSettingsDialog() {
    const existingDialog = document.getElementById('scrapbox-clip-settings');
    if (existingDialog) {
      existingDialog.remove();
      return;
    }

    const currentProject = getConfig(CONFIG_KEYS.PROJECT);
    const currentAutoOpen = getConfig(CONFIG_KEYS.AUTO_OPEN);

    const dialog = document.createElement('div');
    dialog.id = 'scrapbox-clip-settings';
    dialog.innerHTML = `
      <style>
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
      </style>
      <h2>Scrapbox Clip Settings</h2>
      <label>
        Project Name:
        <input type="text" id="scrapbox-clip-project" value="${escapeHtml(currentProject)}" placeholder="your-project">
      </label>
      <label class="checkbox-label">
        <input type="checkbox" id="scrapbox-clip-auto-open" ${currentAutoOpen ? 'checked' : ''}>
        Automatically open the created page
      </label>
      <div id="scrapbox-clip-status" class="status"></div>
      <div class="buttons">
        <button class="test-btn" id="scrapbox-clip-test">Test Connection</button>
        <button class="cancel-btn" id="scrapbox-clip-cancel">Cancel</button>
        <button class="save-btn" id="scrapbox-clip-save">Save</button>
      </div>
    `;

    const overlay = document.createElement('div');
    overlay.id = 'scrapbox-clip-overlay';

    document.body.appendChild(overlay);
    document.body.appendChild(dialog);

    const statusEl = document.getElementById('scrapbox-clip-status');

    // Test connection
    document.getElementById('scrapbox-clip-test').addEventListener('click', async () => {
      statusEl.className = 'status';
      statusEl.textContent = 'Testing...';
      statusEl.style.display = 'block';
      statusEl.style.background = '#fff3e0';
      statusEl.style.color = '#e65100';

      try {
        const user = await checkScrapboxLogin();
        statusEl.className = 'status success';
        statusEl.textContent = `Connected as: ${user.displayName || user.name}`;
      } catch (error) {
        statusEl.className = 'status error';
        statusEl.textContent = `Not logged in. Please login to scrapbox.io first.`;
      }
    });

    // Save settings
    document.getElementById('scrapbox-clip-save').addEventListener('click', () => {
      const project = document.getElementById('scrapbox-clip-project').value.trim();
      const autoOpen = document.getElementById('scrapbox-clip-auto-open').checked;

      if (!project) {
        alert('Please enter a project name.');
        return;
      }

      setConfig(CONFIG_KEYS.PROJECT, project);
      setConfig(CONFIG_KEYS.AUTO_OPEN, autoOpen);
      closeDialog();
      showNotification('Settings saved!');
    });

    document.getElementById('scrapbox-clip-cancel').addEventListener('click', closeDialog);
    overlay.addEventListener('click', closeDialog);

    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        closeDialog();
      }
    };
    document.addEventListener('keydown', escapeHandler);

    function closeDialog() {
      dialog.remove();
      overlay.remove();
      document.removeEventListener('keydown', escapeHandler);
    }
  }

  // ========================================
  // Utility Functions
  // ========================================
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function escapeScrapboxTitle(title) {
    return title
      .replace(/\//g, '／')
      .replace(/\[/g, '［')
      .replace(/\]/g, '］')
      .replace(/#/g, '＃');
  }

  function formatTextForScrapbox(text) {
    return text
      .split('\n')
      .map((line) => ' > ' + line)
      .join('\n');
  }

  function showNotification(message, type = 'info', duration = 3000) {
    if (!document.getElementById('scrapbox-clip-notification-style')) {
      const style = document.createElement('style');
      style.id = 'scrapbox-clip-notification-style';
      style.textContent = `
        @keyframes scrapbox-clip-slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    const colors = {
      info: '#323232',
      success: '#2e7d32',
      error: '#c62828',
      warning: '#f57c00',
    };

    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${colors[type] || colors.info};
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      animation: scrapbox-clip-slideIn 0.3s ease;
      max-width: 300px;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'scrapbox-clip-slideIn 0.3s ease reverse';
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, duration);
  }

  // ========================================
  // Core Functionality
  // ========================================
  async function createScrapboxPage(selectedText = '') {
    const project = getConfig(CONFIG_KEYS.PROJECT);
    const autoOpen = getConfig(CONFIG_KEYS.AUTO_OPEN);

    if (!project || project === 'your-project') {
      alert(
        'Please configure your Scrapbox project first.\n\nClick the Tampermonkey/Greasemonkey icon and select "Scrapbox Clip Settings".'
      );
      showSettingsDialog();
      return;
    }

    const pageTitle = escapeScrapboxTitle(document.title);
    const pageUrl = location.href;

    // Build page lines for Scrapbox
    const lines = [pageTitle, `[${pageUrl} ${pageTitle}]`, ''];

    if (selectedText) {
      const quotedLines = formatTextForScrapbox(selectedText).split('\n');
      lines.push(...quotedLines, '');
    }

    showNotification('Saving to Scrapbox...', 'info', 10000);

    try {
      // Check login status
      await checkScrapboxLogin();

      // Import page via API
      await importPageToScrapbox(project, pageTitle, lines);

      showNotification(`Saved to ${project}!`, 'success');

      if (autoOpen) {
        const pageUrl = `https://scrapbox.io/${encodeURIComponent(project)}/${encodeURIComponent(pageTitle)}`;
        GM_openInTab(pageUrl, { active: true });
      }
    } catch (error) {
      console.error('Scrapbox Clip Error:', error);

      if (error.message.includes('Not logged in') || error.message.includes('Not authorized')) {
        showNotification('Please login to Scrapbox first!', 'error', 5000);
        // Open Scrapbox login page
        GM_openInTab('https://scrapbox.io/', { active: true });
      } else {
        // Fallback to URL method
        showNotification('API failed, using URL fallback...', 'warning');
        fallbackToUrlMethod(project, pageTitle, pageUrl, selectedText, autoOpen);
      }
    }
  }

  /**
   * Fallback to URL-based page creation when API fails
   */
  function fallbackToUrlMethod(project, pageTitle, pageUrl, selectedText, autoOpen) {
    const lines = [`[${pageUrl} ${pageTitle}]`, ''];

    if (selectedText) {
      lines.push(formatTextForScrapbox(selectedText), '');
    }

    const body = encodeURIComponent(lines.join('\n'));
    const encodedTitle = encodeURIComponent(pageTitle);
    const scrapboxUrl = `https://scrapbox.io/${encodeURIComponent(project)}/${encodedTitle}?body=${body}`;

    if (autoOpen) {
      GM_openInTab(scrapboxUrl, { active: true });
    } else {
      navigator.clipboard.writeText(scrapboxUrl).then(() => {
        showNotification('Scrapbox URL copied to clipboard!', 'success');
      });
    }
  }

  // ========================================
  // Context Menu (Right-click)
  // ========================================
  function createContextMenu() {
    const menu = document.createElement('div');
    menu.id = 'scrapbox-clip-context-menu';
    menu.innerHTML = `
      <style>
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
      </style>
      <div class="menu-item" id="scrapbox-clip-save-selection">
        <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
        <span>Save selection to Scrapbox</span>
      </div>
      <div class="menu-separator"></div>
      <div class="menu-item" id="scrapbox-clip-save-page">
        <svg viewBox="0 0 24 24"><path d="M17 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm2 16H5V5h11.17L19 7.83V19zm-7-7c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
        <span>Save page to Scrapbox</span>
      </div>
    `;
    document.body.appendChild(menu);

    let currentSelection = '';

    // Show custom context menu on Alt+right-click when text is selected
    document.addEventListener('contextmenu', (e) => {
      if (!e.altKey) {
        return;
      }

      const selection = window.getSelection();
      const selectedText = selection.toString().trim();

      if (selectedText) {
        e.preventDefault();
        currentSelection = selectedText;

        menu.style.display = 'block';
        menu.style.left = `${Math.min(e.clientX, window.innerWidth - 220)}px`;
        menu.style.top = `${Math.min(e.clientY, window.innerHeight - 100)}px`;

        document.getElementById('scrapbox-clip-save-selection').style.display = 'flex';
      }
    });

    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target)) {
        menu.style.display = 'none';
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        menu.style.display = 'none';
      }
    });

    document.getElementById('scrapbox-clip-save-selection').addEventListener('click', () => {
      menu.style.display = 'none';
      createScrapboxPage(currentSelection);
    });

    document.getElementById('scrapbox-clip-save-page').addEventListener('click', () => {
      menu.style.display = 'none';
      createScrapboxPage();
    });
  }

  // ========================================
  // Register Menu Commands
  // ========================================
  GM_registerMenuCommand('Save to Scrapbox', () => {
    const selectedText = window.getSelection().toString().trim();
    createScrapboxPage(selectedText);
  });

  GM_registerMenuCommand('Scrapbox Clip Settings', showSettingsDialog);

  GM_registerMenuCommand('Check Scrapbox Login', async () => {
    try {
      const user = await checkScrapboxLogin();
      showNotification(`Logged in as: ${user.displayName || user.name}`, 'success');
    } catch {
      showNotification('Not logged in to Scrapbox', 'error');
      GM_openInTab('https://scrapbox.io/', { active: true });
    }
  });

  // ========================================
  // Initialize
  // ========================================
  function init() {
    createContextMenu();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
