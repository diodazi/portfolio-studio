import {timingSafeEqual} from 'node:crypto';

export function localRequest(req, port) {
  const peer = req.socket.remoteAddress;
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer)) return false;
  if (![`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`].includes(req.headers.host)) return false;
  if (Object.keys(req.headers).some(k => k === 'forwarded' || k.startsWith('x-forwarded-'))) return false;
  const origin = req.headers.origin;
  if (origin && origin !== `http://${req.headers.host}`) return false;
  if (['cross-site', 'same-site'].includes(req.headers['sec-fetch-site'])) return false;
  return true;
}

export function validMutation(req, token) {
  const supplied = req.headers['x-local-token'];
  return req.headers.origin === `http://${req.headers.host}` && typeof supplied === 'string' &&
    Buffer.byteLength(supplied) === Buffer.byteLength(token) && timingSafeEqual(Buffer.from(supplied), Buffer.from(token));
}
