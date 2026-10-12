const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const mongoose = require('mongoose');

const cacheRoot = path.resolve(__dirname, '..', 'storage', 'downloaded-papers');
const inFlight = new Map();
const MAX_PDF_BYTES = 50 * 1024 * 1024;

function once(key, task) {
  if (!inFlight.has(key)) {
    const promise = Promise.resolve().then(task).finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
  }
  return inFlight.get(key);
}

async function writePdf(stream, destination) {
  await fs.promises.mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${crypto.randomUUID()}.partial`;
  let bytes = 0;
  const limiter = new Transform({
    transform(chunk, encoding, callback) {
      bytes += chunk.length;
      callback(bytes > MAX_PDF_BYTES ? new Error('PDF exceeds the download limit') : null, chunk);
    },
  });
  try {
    await pipeline(stream, limiter, fs.createWriteStream(temporary, { flags: 'wx' }));
    const handle = await fs.promises.open(temporary, 'r');
    try {
      const signature = Buffer.alloc(5);
      await handle.read(signature, 0, 5, 0);
      if (signature.toString('ascii') !== '%PDF-') throw new Error('Archive did not return a PDF');
    } finally {
      await handle.close();
    }
    await fs.promises.rename(temporary, destination);
    return destination;
  } finally {
    await fs.promises.unlink(temporary).catch(() => {});
  }
}

function libraryRelativePath(paper, type) {
  const { syllabusCode, year, sessionCode, component } = paper;
  if (!/^\d{4}$/.test(String(syllabusCode)) || !/^20\d{2}$/.test(String(year))
      || !/^[msw]$/.test(sessionCode) || !/^1[123]$/.test(String(component))) {
    throw new Error('Invalid MCQ archive location');
  }
  return `${syllabusCode}/${year}/${sessionCode}/${component}/${type === 'question' ? 'question' : 'mark_scheme'}.pdf`;
}

function libraryRemoteUrls(paper, type) {
  const urls = [];
  const repository = process.env.HF_DATASET_REPO;
  const prefix = process.env.MCQ_HF_PREFIX;
  if (repository && prefix) {
    const remotePath = `${prefix}/${libraryRelativePath(paper, type)}`;
    urls.push(`https://huggingface.co/datasets/${repository}/resolve/main/${remotePath}`);
  }
  const source = type === 'question' ? paper.questionPaperSourceUrl : paper.markingSchemeSourceUrl;
  if (source) {
    const url = new URL(source);
    if (url.protocol === 'https:' && ['pastpapers.papacambridge.com', 'dynamicpapers.com'].includes(url.hostname)) {
      urls.push(url.href);
    }
  }
  return urls;
}

async function resolveLibraryPdf(paper, type = 'question') {
  const stored = type === 'question' ? paper.questionPaperPath : paper.markingSchemePath;
  if (stored && fs.existsSync(stored)) return path.resolve(stored);
  const relative = libraryRelativePath(paper, type);
  const local = path.resolve(__dirname, '..', 'storage', 'papers', 'caie', relative);
  if (fs.existsSync(local)) return local;
  const cached = path.join(cacheRoot, 'library', relative);
  if (fs.existsSync(cached)) return cached;
  return once(cached, async () => {
    for (const url of libraryRemoteUrls(paper, type)) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
        if (!response.ok || Number(response.headers.get('content-length')) > MAX_PDF_BYTES) {
          await response.body?.cancel();
          continue;
        }
        return await writePdf(Readable.fromWeb(response.body), cached);
      } catch {
        // Try the original source if the public archive is temporarily unavailable.
      }
    }
    const error = new Error('This paper could not be downloaded. Please try again shortly.');
    error.statusCode = 503;
    throw error;
  });
}

function privateBucket() {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'privatePdfs' });
}

function privateId(reference) {
  const id = String(reference).slice('gridfs:'.length);
  if (!/^[a-f\d]{24}$/i.test(id)) throw new Error('Invalid stored PDF reference');
  return new mongoose.Types.ObjectId(id);
}

async function storePrivatePdf(file, userId) {
  if (process.env.UPLOAD_STORAGE !== 'gridfs') return file.path;
  const bucket = privateBucket();
  const stream = bucket.openUploadStream(crypto.randomUUID() + '.pdf', {
    metadata: { userId: String(userId), contentType: 'application/pdf' },
  });
  try {
    await pipeline(fs.createReadStream(file.path), stream);
    return `gridfs:${stream.id}`;
  } catch (error) {
    await bucket.delete(stream.id).catch(() => {});
    throw error;
  }
}

async function resolvePrivatePdf(reference) {
  if (!String(reference).startsWith('gridfs:')) return path.resolve(reference);
  const id = privateId(reference);
  const cached = path.join(cacheRoot, 'private', `${id}.pdf`);
  if (fs.existsSync(cached)) return cached;
  return once(cached, () => writePdf(privateBucket().openDownloadStream(id), cached));
}

async function deletePrivatePdf(reference) {
  if (!String(reference).startsWith('gridfs:')) {
    await fs.promises.unlink(reference).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    return;
  }
  const id = privateId(reference);
  const bucket = privateBucket();
  if (await bucket.find({ _id: id }).hasNext()) await bucket.delete(id);
  await fs.promises.unlink(path.join(cacheRoot, 'private', `${id}.pdf`)).catch(() => {});
}

module.exports = {
  libraryRelativePath, libraryRemoteUrls, resolveLibraryPdf,
  storePrivatePdf, resolvePrivatePdf, deletePrivatePdf, writePdf,
};
