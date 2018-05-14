// @format

// A Client bundles a Transport with a protocol definition, providing a
// convenience wrapper around the chrome.debugger API much like
// chrome-remote-interface.

class Client {
  constructor(transport, protocol) {
    this._transport = transport;

    for (const domain of protocol.domains) {
      const { domain: domainName } = domain;
      this[domainName] = new Domain(domain, transport);
    }

    chrome.debugger.onEvent.addListener((source, chainedEvent, params) => {
      if (!this._transport.targetMatches(source)) {
        return;
      }
      // `chainedEvent` is something like `Page.loadEventFired`.
      const [domain, event] = chainedEvent.split('.');

      // TODO: Make this cleaner using a map of Domains, and dynamically
      // defining getters for each.
      this[domain].handleEvent(event, params);
    });
  }

  get transport() {
    return this._transport;
  }

  async detach() {
    await this.transport.detach();
  }

  async attach() {
    await this.transport.attach();
  }
}

// A Domain is a lower-level class that helps the Client delegate methods
// to domains of the Chrome Remote Debugging Protocol.

class Domain {
  constructor(description, transport) {
    this._transport = transport;

    const { domain, dependencies, commands, events } = description;

    this.name = domain;
    this.dependencies = dependencies;
    this._listeners = new Map();

    // Register methods.
    for (const { name } of commands) {
      const method = this._formatMethod(name);
      this[name] = (...args) => this._transport.send(method, ...args);
    }

    // #NotAllDomains define events.
    if (events) {
      for (const { name } of events) {
        this._listeners.set(name, []);

        // `Page.frameResized(fn)` => `Page.on('frameResized', fn)`
        // `Page.frameResized()`   => `Page.off('frameResized')`
        this[name] = (handler = null) => {
          if (handler) {
            this.on(name, handler);
          } else {
            this.off(name);
          }
        };
      }
    }
  }

  handleEvent(event, params) {
    if (this._listeners.has(event)) {
      const listeners = this._listeners.get(event);
      for (const listener of listeners) {
        listener(params);
      }
    }
  }

  // Bind a new domain event handler.
  // e.g. Network.on('requestWillBeSent', function (params) {...});
  on(event, handler) {
    if (!this._listeners.has(event)) {
      const eventName = _formatMethod(event);
      console.error(eventName, 'is not an event');
      return;
    }
    const listeners = this._listeners.get(event);
    listeners.push(handler);
  }

  off(event = null, handler = null) {
    if (!event) {
      // Deregister all handlers for all methods.
      for (const [event, _] of this._listeners) {
        this._listeners.set(event, []);
      }
    } else {
      // Ensure the event is recognized.
      if (!this._listeners.has(event)) {
        const fullName = _formatMethod(event);
        console.error(fullName, 'is not an event');
        return;
      }
      if (handler) {
        // Deregister that specific handler.
        const listeners = this._listeners.get(event);
        const update = listeners.filter(f => f !== handler);
        this._listeners.set(event, update);
      } else {
        // Deregister all handlers for the given event.
        this._listeners.set(event, []);
      }
    }
  }

  // Utility for printing domain-method strings.
  // e.g. 'requestWillBeSent' -> 'Network.requestWillBeSent'
  _formatMethod(method) {
    return `${this.name}.${method}`;
  }
}
