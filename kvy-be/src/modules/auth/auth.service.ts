import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

export interface UserPayload {
  id: string;
  email: string;
  role: 'SELLER' | 'ADMIN';
}

export interface JwtPayload extends UserPayload {
  exp?: number;
}

const SEED_USERS = [
  {
    id: 'seller_1',
    email: 'seller1@kvy.tech',
    password: 'password123',
    role: 'SELLER' as const,
  },
  {
    id: 'seller_2',
    email: 'seller2@kvy.tech',
    password: 'password123',
    role: 'SELLER' as const,
  },
  {
    id: 'admin_1',
    email: 'admin@kvy.tech',
    password: 'adminpassword',
    role: 'ADMIN' as const,
  },
];

@Injectable()
export class AuthService {
  private readonly jwtSecret = this.getJwtSecret();

  private getJwtSecret(): string {
    if (process.env.JWT_SECRET) {
      return process.env.JWT_SECRET;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is required in production');
    }

    return 'local-development-only-secret';
  }

  private base64UrlEncode(str: string | Buffer): string {
    const buf = typeof str === 'string' ? Buffer.from(str) : str;
    return buf
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  private base64UrlDecode(str: string): string {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return Buffer.from(base64, 'base64').toString('utf8');
  }

  signToken(payload: UserPayload): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));

    const finalPayload = {
      ...payload,
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
    };
    const encodedPayload = this.base64UrlEncode(JSON.stringify(finalPayload));

    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(signatureInput)
      .digest();
    const encodedSignature = this.base64UrlEncode(signature);

    return `${signatureInput}.${encodedSignature}`;
  }

  verifyToken(token: string): UserPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const [header, payload, signature] = parts;
      const signatureInput = `${header}.${payload}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.jwtSecret)
        .update(signatureInput)
        .digest();
      const encodedExpectedSignature = this.base64UrlEncode(expectedSignature);

      if (signature !== encodedExpectedSignature) {
        return null;
      }

      const decodedPayload = JSON.parse(
        this.base64UrlDecode(payload),
      ) as JwtPayload;
      if (
        decodedPayload.exp &&
        decodedPayload.exp < Math.floor(Date.now() / 1000)
      ) {
        return null; // Expired
      }

      return {
        id: decodedPayload.id,
        email: decodedPayload.email,
        role: decodedPayload.role,
      };
    } catch {
      return null;
    }
  }

  login(email: string, password: string) {
    const user = SEED_USERS.find(
      (u) =>
        u.email.toLowerCase() === email.toLowerCase() &&
        u.password === password,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: UserPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const token = this.signToken(payload);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  getSeedUsers() {
    return SEED_USERS.map((u) => ({
      email: u.email,
      role: u.role,
      password: u.password,
    }));
  }
}
