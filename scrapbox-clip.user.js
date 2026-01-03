// ==UserScript==
// @name         Scrapbox Clip - Save to Scrapbox
// @namespace    https://github.com/your-username/scrapbox-clip
// @version      1.0.0
// @description  Save current page title, URL, and selected text to Scrapbox
// @author       You
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
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
  // Settings Dialog
  // ========================================
  function showSettingsDialog() {
    // Remove existing dialog if present
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
      <div class="buttons">
        <button class="cancel-btn" id="scrapbox-clip-cancel">Cancel</button>
        <button class="save-btn" id="scrapbox-clip-save">Save</button>
      </div>
    `;

    const overlay = document.createElement('div');
    overlay.id = 'scrapbox-clip-overlay';

    document.body.appendChild(overlay);
    document.body.appendChild(dialog);

    // Event listeners
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

    // Close on Escape key
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        closeDialog();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);

    function closeDialog() {
      dialog.remove();
      overlay.remove();
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
    // Scrapbox title cannot contain: / [ ] #
    // Replace them with similar characters
    return title
      .replace(/\//g, '／')
      .replace(/\[/g, '［')
      .replace(/\]/g, '］')
      .replace(/#/g, '＃');
  }

  function formatTextForScrapbox(text) {
    // Indent each line for quote block
    return text
      .split('\n')
      .map(line => ' > ' + line)
      .join('\n');
  }

  function showNotification(message, duration = 3000) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #323232;
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;

    // Add animation keyframes
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => {
        notification.remove();
        style.remove();
      }, 300);
    }, duration);
  }

  // ========================================
  // Core Functionality
  // ========================================
  function createScrapboxPage(selectedText = '') {
    const project = getConfig(CONFIG_KEYS.PROJECT);
    const autoOpen = getConfig(CONFIG_KEYS.AUTO_OPEN);

    if (!project || project === 'your-project') {
      alert('Please configure your Scrapbox project first.\n\nClick the Tampermonkey/Greasemonkey icon and select "Scrapbox Clip Settings".');
      showSettingsDialog();
      return;
    }

    const pageTitle = escapeScrapboxTitle(document.title);
    const pageUrl = location.href;

    // Build page body
    const lines = [];
    lines.push(`[${pageUrl} ${pageTitle}]`);
    lines.push('');

    if (selectedText) {
      lines.push(formatTextForScrapbox(selectedText));
      lines.push('');
    }

    // URL encode the body
    const body = encodeURIComponent(lines.join('\n'));
    const encodedTitle = encodeURIComponent(pageTitle);

    // Create Scrapbox URL
    const scrapboxUrl = `https://scrapbox.io/${project}/${encodedTitle}?body=${body}`;

    if (autoOpen) {
      GM_openInTab(scrapboxUrl, { active: true });
      showNotification(`Page created in ${project}`);
    } else {
      // Copy URL to clipboard
      navigator.clipboard.writeText(scrapboxUrl).then(() => {
        showNotification('Scrapbox URL copied to clipboard!');
      }).catch(() => {
        // Fallback: open in new tab anyway
        GM_openInTab(scrapboxUrl, { active: false });
        showNotification(`Page created in ${project} (background)`);
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

    // Show custom context menu on right-click when text is selected
    document.addEventListener('contextmenu', (e) => {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();

      if (selectedText) {
        e.preventDefault();
        currentSelection = selectedText;

        menu.style.display = 'block';
        menu.style.left = `${Math.min(e.clientX, window.innerWidth - 220)}px`;
        menu.style.top = `${Math.min(e.clientY, window.innerHeight - 100)}px`;

        // Show selection option
        document.getElementById('scrapbox-clip-save-selection').style.display = 'flex';
      }
    });

    // Hide menu on click outside
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target)) {
        menu.style.display = 'none';
      }
    });

    // Hide menu on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        menu.style.display = 'none';
      }
    });

    // Menu item click handlers
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
  // Keyboard Shortcut
  // ========================================
  function setupKeyboardShortcut() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+S (or Cmd+Shift+S on Mac)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        const selectedText = window.getSelection().toString().trim();
        createScrapboxPage(selectedText);
      }
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

  // ========================================
  // Initialize
  // ========================================
  function init() {
    createContextMenu();
    setupKeyboardShortcut();
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
