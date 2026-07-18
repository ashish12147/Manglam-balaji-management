import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import { ApiError } from '../../common/http/api-error.js';
import type { AppEnvironment } from '../../config/env.schema.js';
import {
  signRefreshCookie,
  verifyRefreshCookie,
} from './signed-refresh-cookie.js';

const REFRESH_COOKIE_NAME = '__Host-mb_refresh';

export type RefreshCookieReadResult =
  | { readonly present: false }
  | { readonly present: true; readonly token: string };

@Injectable()
export class RefreshCookieService {
  private readonly secret: string;
  private readonly trustedOrigins: ReadonlySet<string>;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.secret = config.get('COOKIE_SECRET', { infer: true });
    this.trustedOrigins = new Set(
      [
        config.get('ADMIN_WEB_URL', { infer: true }),
        ...config.get('CORS_ORIGINS', { infer: true }),
      ].map((value) => new URL(value).origin),
    );
  }

  read(request: Request): RefreshCookieReadResult {
    const matches = parseCookieHeader(request.headers.cookie).filter(
      ([name]) => name === REFRESH_COOKIE_NAME,
    );
    if (matches.length === 0) {
      return { present: false };
    }
    if (matches.length !== 1) {
      throw authenticationFailure();
    }
    const token = verifyRefreshCookie(matches[0]![1], this.secret);
    if (!token) {
      throw authenticationFailure();
    }
    return { present: true, token };
  }

  assertTrustedOrigin(request: Request): void {
    const value = request.headers.origin;
    let origin: string;
    try {
      origin = value ? new URL(value).origin : '';
    } catch {
      throw originFailure();
    }
    if (!origin || !this.trustedOrigins.has(origin)) {
      throw originFailure();
    }
  }

  set(response: Response, token: string, expiresAt: Date): void {
    const maxAge = Math.max(
      0,
      Math.floor((expiresAt.getTime() - Date.now()) / 1_000),
    );
    appendSetCookie(
      response,
      `${REFRESH_COOKIE_NAME}=${signRefreshCookie(token, this.secret)}; Path=/; Expires=${expiresAt.toUTCString()}; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Strict`,
    );
  }

  clear(response: Response): void {
    appendSetCookie(
      response,
      `${REFRESH_COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Secure; HttpOnly; SameSite=Strict`,
    );
  }
}

function parseCookieHeader(value: string | undefined): [string, string][] {
  if (!value || value.length > 8_192) return [];
  return value.split(';').flatMap((part) => {
    const separator = part.indexOf('=');
    if (separator <= 0) return [];
    return [[part.slice(0, separator).trim(), part.slice(separator + 1).trim()]];
  });
}

function appendSetCookie(response: Response, value: string): void {
  const current = response.getHeader('Set-Cookie');
  const values = Array.isArray(current)
    ? [...current.map(String), value]
    : current
      ? [String(current), value]
      : [value];
  response.setHeader('Set-Cookie', values);
}

function authenticationFailure(): ApiError {
  return new ApiError({
    code: 'AUTHENTICATION_REQUIRED',
    details: {},
    message: 'The supplied session is invalid.',
    status: HttpStatus.UNAUTHORIZED,
  });
}

function originFailure(): ApiError {
  return new ApiError({
    code: 'ORIGIN_NOT_ALLOWED',
    details: {},
    message: 'The browser request origin is not allowed.',
    status: HttpStatus.FORBIDDEN,
  });
}
