// @format

// Top-level interface for managing multiple debugging connections.
// Each connection corresponds to a Target.
// The ClientPool initializes new connections using a given protocol
// descriptor, and serves as a thin wrapper around a Map<Target, Client>.

class ClientPool {
  constructor(protocolDescriptor) {
    this._clients = new Map();
    this._protocolDescriptor = protocolDescriptor;
  }

  async attach(target) {
    if (this._clients.has(target)) {
      await this._clients.get(target).detach();
    }
    const transport = new Transport(target);
    await transport.attach();
    const client = new Client(transport, this._protocolDescriptor);
    this._clients.set(target, client);

    // Update the global reference to the most recently-attached Client.
    window.cdp = client;

    return client;
  }

  async detach(target) {
    if (this._clients.has(target)) {
      const client = this._clients.get(target);
      await client.detach();
    }
  }

  get(target) {
    return this._clients.get(target);
  }

  list() {
    return [...this._clients.keys()];
  }

  has(target) {
    return this._clients.has(target);
  }

  static async detachAll(onlyManaged = true) {
    const detached = [];

    // Only detach the managed Clients.
    if (onlyManaged) {
      for (const [target, client] of this._clients) {
        await client.transport.detach();
        detached.push(target);
      }
    } else {
      // Detach everything, even not just the ones we manage.
      const targets = await chromeP.debugger.getTargets();
      const attached = targets.filter(
        target => target.attached && typeof target.tabId === 'number',
      );
      for (const { tabId } of attached) {
        await chromeP.debugger.detach({ tabId });
        detached.push(tabId);
      }
    }

    console.log('Detached from', detached);
    this._clients.clear();
  }
}
