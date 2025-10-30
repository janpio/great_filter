// Expose a unified WebExtension API wrapper (`GFBrowser`) that normalizes the
// Promise-based `browser.*` interface across Chrome and Firefox.
(function() {
  const hasBrowser = typeof browser !== 'undefined';
  const hasChrome = typeof chrome !== 'undefined';

  const browserApi = hasBrowser ? browser : null;
  const chromeApi = hasChrome ? chrome : null;

  function getRuntimeLastError() {
    if (hasChrome && chromeApi.runtime && chromeApi.runtime.lastError) {
      return chromeApi.runtime.lastError;
    }
    if (hasBrowser && browserApi.runtime && browserApi.runtime.lastError) {
      return browserApi.runtime.lastError;
    }
    return null;
  }

  function storageSet(values) {
    if (browserApi && browserApi.storage && browserApi.storage.local && typeof browserApi.storage.local.set === 'function') {
      return browserApi.storage.local.set(values);
    }

    if (chromeApi && chromeApi.storage && chromeApi.storage.local && typeof chromeApi.storage.local.set === 'function') {
      return new Promise((resolve, reject) => {
        try {
          chromeApi.storage.local.set(values, () => {
            const error = getRuntimeLastError();
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        } catch (err) {
          reject(err);
        }
      });
    }

    return Promise.reject(new Error('Storage API is not available'));
  }

  function storageGet(keys) {
    if (browserApi && browserApi.storage && browserApi.storage.local && typeof browserApi.storage.local.get === 'function') {
      return browserApi.storage.local.get(keys);
    }

    if (chromeApi && chromeApi.storage && chromeApi.storage.local && typeof chromeApi.storage.local.get === 'function') {
      return new Promise((resolve, reject) => {
        try {
          chromeApi.storage.local.get(keys, (data) => {
            const error = getRuntimeLastError();
            if (error) {
              reject(error);
            } else {
              resolve(data);
            }
          });
        } catch (err) {
          reject(err);
        }
      });
    }

    return Promise.reject(new Error('Storage API is not available'));
  }

  function tabsQuery(queryInfo) {
    if (browserApi && browserApi.tabs && typeof browserApi.tabs.query === 'function') {
      return browserApi.tabs.query(queryInfo);
    }

    if (chromeApi && chromeApi.tabs && typeof chromeApi.tabs.query === 'function') {
      return new Promise((resolve, reject) => {
        try {
          chromeApi.tabs.query(queryInfo, (tabs) => {
            const error = getRuntimeLastError();
            if (error) {
              reject(error);
            } else {
              resolve(tabs || []);
            }
          });
        } catch (err) {
          reject(err);
        }
      });
    }

    return Promise.reject(new Error('Tabs API is not available'));
  }

  function tabsSendMessage(tabId, message, options) {
    if (browserApi && browserApi.tabs && typeof browserApi.tabs.sendMessage === 'function') {
      if (typeof options !== 'undefined') {
        return browserApi.tabs.sendMessage(tabId, message, options);
      }
      return browserApi.tabs.sendMessage(tabId, message);
    }

    if (chromeApi && chromeApi.tabs && typeof chromeApi.tabs.sendMessage === 'function') {
      return new Promise((resolve, reject) => {
        const callback = (response) => {
          const error = getRuntimeLastError();
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        };

        try {
          if (typeof options !== 'undefined') {
            chromeApi.tabs.sendMessage(tabId, message, options, callback);
          } else {
            chromeApi.tabs.sendMessage(tabId, message, callback);
          }
        } catch (err) {
          reject(err);
        }
      });
    }

    return Promise.reject(new Error('Tabs API is not available'));
  }

  function runtimeSendMessage(/* variable args */) {
    const args = Array.prototype.slice.call(arguments);

    if (browserApi && browserApi.runtime && typeof browserApi.runtime.sendMessage === 'function') {
      return browserApi.runtime.sendMessage.apply(browserApi.runtime, args);
    }

    if (chromeApi && chromeApi.runtime && typeof chromeApi.runtime.sendMessage === 'function') {
      return new Promise((resolve, reject) => {
        const callback = (response) => {
          const error = getRuntimeLastError();
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        };

        try {
          chromeApi.runtime.sendMessage.apply(chromeApi.runtime, args.concat(callback));
        } catch (err) {
          reject(err);
        }
      });
    }

    return Promise.reject(new Error('Runtime API is not available'));
  }

  const api = {
    storageSet,
    storageGet,
    tabsQuery,
    tabsSendMessage,
    runtimeSendMessage,
    getRuntimeLastError
  };

  if (typeof globalThis !== 'undefined') {
    globalThis.GFBrowser = api;
  } else if (typeof window !== 'undefined') {
    window.GFBrowser = api;
  } else if (typeof self !== 'undefined') {
    self.GFBrowser = api;
  }
})();
