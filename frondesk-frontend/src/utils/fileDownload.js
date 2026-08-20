/**
 * Saves binary data via Electron (chunked temp file → save dialog),
 * or falls back to browser blob download.
 *
 * @param {Uint8Array|ArrayBuffer} data
 * @param {string} defaultPath
 * @param {{ name: string, extensions: string[] }[]} [filters]
 * @returns {Promise<{ saved: boolean, canceled?: boolean, filePath?: string }>}
 */

/** Keep IPC payloads small — avoid one giant Array.from(bytes) transfer. */
const EXPORT_CHUNK_BYTES = 512 * 1024;

function downloadViaBlob(bytes, defaultPath) {
  const ext = defaultPath.includes('.') ? defaultPath.split('.').pop() : 'bin';
  const mime = ext === 'xlsx'
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : ext === 'pdf'
      ? 'application/pdf'
      : 'application/octet-stream';
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultPath;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { saved: true };
}

async function saveViaChunkedTemp(bytes, defaultPath, filters) {
  const { tempPath } = await window.electronAPI.beginTempExport();
  try {
    for (let offset = 0; offset < bytes.length; offset += EXPORT_CHUNK_BYTES) {
      const slice = bytes.subarray(offset, offset + EXPORT_CHUNK_BYTES);
      // Structured-clone Uint8Array — never Array.from (number[] blows memory).
      await window.electronAPI.appendTempExport(tempPath, slice);
    }
    const result = await window.electronAPI.finishTempExport({
      tempPath,
      defaultPath,
      filters,
    });
    if (result?.canceled) return { saved: false, canceled: true };
    if (result?.ok) return { saved: true, filePath: result.filePath };
    throw new Error(result?.error || 'Failed to save file.');
  } catch (err) {
    try {
      await window.electronAPI.cancelTempExport?.(tempPath);
    } catch {
      /* ignore cleanup failure */
    }
    throw err;
  }
}

export async function saveBinaryFile(data, defaultPath, filters) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

  if (window.electronAPI?.beginTempExport
      && window.electronAPI?.appendTempExport
      && window.electronAPI?.finishTempExport) {
    try {
      return await saveViaChunkedTemp(bytes, defaultPath, filters);
    } catch (err) {
      const msg = String(err?.message || err);
      // Preload hot-reloads before main process — handlers may not exist yet.
      if (!/No handler registered/i.test(msg)) {
        throw err;
      }
    }
  }

  // Legacy single-shot path (dev hot-reload fallback).
  if (window.electronAPI?.saveFileBytes) {
    try {
      const result = await window.electronAPI.saveFileBytes({
        defaultPath,
        data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        filters,
      });
      if (result?.canceled) return { saved: false, canceled: true };
      if (result?.ok) return { saved: true, filePath: result.filePath };
      throw new Error(result?.error || 'Failed to save file.');
    } catch (err) {
      const msg = String(err?.message || err);
      if (!/No handler registered/i.test(msg)) {
        throw err;
      }
    }
  }

  return downloadViaBlob(bytes, defaultPath);
}
