import { User } from '@prisma/client';
import { Request } from 'express';

/** Who is calling: a signed-in user and/or an anonymous guest (one per browser). */
export interface Identity {
  user: User | null;
  guestId: string;
  ipHash: string;
}

export type AppRequest = Request & { identity: Identity };
