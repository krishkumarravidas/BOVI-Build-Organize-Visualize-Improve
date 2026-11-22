import { DurableObject } from 'cloudflare:workers';

import { route } from './router.ts';
import { StoreLogic, type InboxItem, type KV, type Snapshot } from './store.ts';

interface Env {
  BOVI_SECRET?: string;
  STORE: DurableObjectNamespace<BoviStore>;
}

/** One instance holds everything, so syncs and additions never race each other. */
export class BoviStore extends DurableObject<Env> {
  private logic = new StoreLogic(this.ctx.storage as unknown as KV);

  read() {
    return this.logic.read();
  }
  inbox() {
    return this.logic.inbox();
  }
  sync(snapshot: Snapshot, handled: string[], now: number) {
    return this.logic.sync(snapshot, handled, now);
  }
  enqueue(item: InboxItem) {
    return this.logic.enqueue(item);
  }
}

export default {
  fetch(req: Request, env: Env): Promise<Response> {
    return route(req, {
      secret: env.BOVI_SECRET,
      // The Durable Object stub exposes the same methods as StoreLogic over RPC.
      store: () => env.STORE.get(env.STORE.idFromName('bovi')) as unknown as StoreLogic,
    });
  },
};
