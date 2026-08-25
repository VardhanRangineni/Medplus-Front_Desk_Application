import { lazy } from 'react';

/** Retry once on stale webpack chunks after `rs` or dev-server hiccups. */
export function lazyWithRetry(importFn, chunkLabel) {
  return lazy(() => importFn().catch((err) => {
    const isChunk = err?.name === 'ChunkLoadError' || /loading chunk/i.test(String(err?.message));
    if (isChunk && typeof sessionStorage !== 'undefined') {
      const key = `mvms_chunk_retry_${chunkLabel}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
        return new Promise(() => {});
      }
      sessionStorage.removeItem(key);
    }
    throw err;
  }));
}
