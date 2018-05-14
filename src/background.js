// @format

// Get that Promise API.
const chromeP = promisify(['debugger', 'tabs']);

window.targets = []; // Hold references to debuggee targets.
window.clients = null; // ClientPool
window.cdp = null; // Reference to the most recently-attached target.

async function main(tab) {
  const tabId = tab.id;
  const target = { tabId: tab.id };
  const clients = new ClientPool(window.protocol);
  await clients.attach(target);

  // Stick everything on the window for debugging.
  window.targets.push(target);
  window.clients = clients;

  // HACK: Bind global protocol method shorthand.
  // Assumes we aren't using multiple connections yet.
  for (const { domain } of window.protocol.domains) {
    window[domain] = window.cdp[domain];
  }

  // Testing.
  Page.enable();
  Page.loadEventFired(ts => console.log('Load event fired', ts));
}

chrome.browserAction.onClicked.addListener(main);
