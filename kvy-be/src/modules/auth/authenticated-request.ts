import type { Request } from 'express';
import type { UserPayload } from './auth.service';

export interface AuthenticatedRequest extends Request {
  user: UserPayload;
}
