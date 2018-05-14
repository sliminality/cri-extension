// @format

// Development utilities.

// A better console.assert that actually throws.
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// To use with Chrome's callback-driven API.
function defaultCallback(
  data,
  handleOk = console.log,
  handleErr = console.error,
) {
  const { lastError } = chrome.runtime;
  if (lastError) {
    handleErr(lastError);
    return;
  }
  handleOk(data);
}

// Promisify chrome.xxx commands for convenience.
// e.g. chrome.tabs.query -> chrome.tabs.queryP
function promisify(apis) {
  const chromeP = {};
  for (const api of apis) {
    chromeP[api] = {};
    for (const method in chrome[api]) {
      const oldMethod = chrome[api][method];
      const withPromise = (...args) =>
        new Promise((resolve, reject) => {
          oldMethod(...args, data => {
            defaultCallback(data, resolve, reject);
          });
        });
      chromeP[api][method] = withPromise;
    }
  }
  return chromeP;
}

// Simplify error handling for Chrome APIs.
const CDP_ERROR = {
  ALREADY_ATTACHED: 'Another debugger is already attached',
};

function isError(error, prefix) {
  return error.message && error.message.startsWith(prefix);
}
