import { RxCacheGroup } from 'rx-core-query';

export class RxCacheManager {
  private caches = new Map<string, RxCacheGroup>();

  setCache(key: string, cache: RxCacheGroup) {
    this.caches.set(key, cache);
  }

  removeCache(key: string) {
    const cache = this.getCache(key);
    if (cache) {
      this.caches.delete(key);
      cache.destroy();
    }
  }

  freezeCache(key: string) {
    const cache = this.getCache(key);
    if (cache) {
      cache.freeze();
    }
  }

  getCache(key: string) {
    const cache = this.caches.get(key);
    if (cache && !cache.destroyed) {
      return cache;
    }
    this.caches.delete(key);
    return undefined;
  }
}
