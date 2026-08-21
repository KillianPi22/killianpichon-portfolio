(function () {
  'use strict';

  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const attempts = new Map();
  const MAX_BLOCK_MS = 5 * 60 * 1000;

  function accessError(code, retryAfter = 0) {
    const error = new Error(code);
    error.code = code;
    error.retryAfter = retryAfter;
    return error;
  }

  function decodeBase64(value) {
    if (typeof value !== 'string' || !value) throw accessError('INVALID_RESOURCE');
    try {
      const binary = window.atob(value);
      return Uint8Array.from(binary, character => character.charCodeAt(0));
    } catch (_error) {
      throw accessError('INVALID_RESOURCE');
    }
  }

  function getAttemptState(resourceId) {
    return attempts.get(resourceId) || { failures: 0, blockedUntil: 0 };
  }

  function getLockStatus(resourceId) {
    const state = getAttemptState(resourceId);
    return {
      failures: state.failures,
      retryAfter: Math.max(0, Math.ceil((state.blockedUntil - Date.now()) / 1000))
    };
  }

  function registerFailure(resourceId) {
    const state = getAttemptState(resourceId);
    const failures = state.failures + 1;
    const delay = failures < 3 ? 0 : Math.min(MAX_BLOCK_MS, 15000 * 2 ** (failures - 3));
    attempts.set(resourceId, {
      failures,
      blockedUntil: Date.now() + delay
    });
    return Math.ceil(delay / 1000);
  }

  function validateResource(resource) {
    if (!resource || typeof resource.id !== 'string' || !resource.id) {
      throw accessError('INVALID_RESOURCE');
    }
    if (!Number.isInteger(resource.iterations) || resource.iterations < 100000) {
      throw accessError('INVALID_RESOURCE');
    }
    return {
      salt: decodeBase64(resource.salt),
      iv: decodeBase64(resource.iv),
      ciphertext: decodeBase64(resource.ciphertext)
    };
  }

  function validateTarget(resource, target) {
    if (!target || typeof target.url !== 'string') throw accessError('INVALID_RESOURCE');
    let url;
    try {
      url = new URL(target.url, window.location.href);
    } catch (_error) {
      throw accessError('INVALID_RESOURCE');
    }

    const sameOrigin = url.origin === window.location.origin;
    const allowedHosts = Array.isArray(resource.allowedHosts)
      ? resource.allowedHosts.map(host => String(host).toLowerCase())
      : [];
    const allowedExternalHost = url.protocol === 'https:' && allowedHosts.includes(url.hostname.toLowerCase());
    if (!sameOrigin && !allowedExternalHost) throw accessError('INVALID_RESOURCE');

    return Object.freeze({
      ...target,
      url: url.href
    });
  }

  async function unlock(resource, accessCode) {
    if (!window.isSecureContext || !window.crypto || !window.crypto.subtle) {
      throw accessError('UNSUPPORTED');
    }
    if (typeof accessCode !== 'string' || !accessCode || accessCode.length > 256) {
      throw accessError('INVALID_CODE');
    }

    const lock = getLockStatus(resource && resource.id);
    if (lock.retryAfter > 0) throw accessError('RATE_LIMITED', lock.retryAfter);

    const values = validateResource(resource);
    try {
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(accessCode.normalize('NFC')),
        'PBKDF2',
        false,
        ['deriveKey']
      );
      const key = await window.crypto.subtle.deriveKey({
        name: 'PBKDF2',
        salt: values.salt,
        iterations: resource.iterations,
        hash: 'SHA-256'
      }, keyMaterial, {
        name: 'AES-GCM',
        length: 256
      }, false, ['decrypt']);
      const plaintext = await window.crypto.subtle.decrypt({
        name: 'AES-GCM',
        iv: values.iv,
        additionalData: encoder.encode(`kp-protected-content:${resource.id}:v${resource.version || 1}`),
        tagLength: 128
      }, key, values.ciphertext);
      const target = JSON.parse(decoder.decode(plaintext));
      attempts.delete(resource.id);
      return validateTarget(resource, target);
    } catch (error) {
      if (error && error.code === 'INVALID_RESOURCE') throw error;
      const retryAfter = registerFailure(resource.id);
      throw accessError(retryAfter > 0 ? 'RATE_LIMITED' : 'INVALID_CODE', retryAfter);
    }
  }

  window.KPProtectedContent = Object.freeze({
    getLockStatus,
    unlock
  });
})();
