// @format

// A Transport wraps the `chrome.debugger` connection for a given Debuggee.
// Passed into a Client.

class Transport {
  constructor(target) {
    this.target = target;
    this.protocolVersion = '1.1';
    this.attached = false;
  }

  async attach() {
    let maxAttempts = 5;

    for (let i = maxAttempts; i > 0; i--) {
      try {
        await chromeP.debugger.attach(this.target, this.protocolVersion);
        this.attached = true;
        console.log('Connected to', this.target);
        break;
      } catch (attachErr) {
        // Might be already connected.
        if (isError(attachErr, CDP_ERROR.ALREADY_ATTACHED)) {
          await this.detach();
        }
      }
    }

    // If we still didn't successfully attach, signal an error.
    if (!this.attached) {
      console.error(
        'Failed to attach to',
        this.target,
        chrome.runtime.lastError,
      );
    }
  }

  async detach() {
    try {
      await chromeP.debugger.detach(this.target);
      this.attached = false;
      console.log('Detached from', this.target);
    } catch (detachErr) {
      console.error('Unable to detach from', this.target, detachErr);
    }
  }

  async send(method, params) {
    // Must be attached before we can send.
    assert(this.attached, 'Must attach debugger before sending commands');
    return new Promise(resolve => {
      chrome.debugger.sendCommand(this.target, method, params, resolve);
    });
  }

  // Check whether another Debuggee target is the same as this one.
  targetMatches(target) {
    return target.tabId && target.tabId === this.target.tabId;
  }
}
