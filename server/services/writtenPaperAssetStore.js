const fs = require('fs');

function encodeRemotePath(remotePath) {
  return String(remotePath).split('/').map(encodeURIComponent).join('/');
}

function remoteAssetUrl(asset) {
  if (asset?.remoteUrl) return asset.remoteUrl;
  const repository = process.env.HF_DATASET_REPO;
  if (!repository || !asset?.remotePath) return '';
  return `https://huggingface.co/datasets/${repository}/resolve/main/${encodeRemotePath(asset.remotePath)}?download=true`;
}

function localAssetPath(asset) {
  return asset?.path && fs.existsSync(asset.path) ? asset.path : '';
}

async function readAsset(asset, maxBytes) {
  const localPath = localAssetPath(asset);
  if (localPath) {
    const buffer = await fs.promises.readFile(localPath);
    return buffer.length <= maxBytes ? buffer : null;
  }
  const url = remoteAssetUrl(asset);
  if (!url) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const length = Number(response.headers.get('content-length') || 0);
    if (length > maxBytes) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.length && buffer.length <= maxBytes ? buffer : null;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { localAssetPath, readAsset, remoteAssetUrl };
