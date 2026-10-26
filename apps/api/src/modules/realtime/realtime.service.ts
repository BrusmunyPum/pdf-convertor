import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { RealtimeEvent, rooms } from './realtime.events';

export interface Owner {
  userId?: string | null;
  guestId?: string | null;
}

/** Pushes live updates to the right browsers. Other modules only talk to this service. */
@Injectable()
export class RealtimeService {
  private readonly log = new Logger(RealtimeService.name);
  private server: Server | null = null;

  attach(server: Server) {
    this.server = server;
  }

  private room(owner: Owner): string | null {
    if (owner.userId) return rooms.user(owner.userId);
    if (owner.guestId) return rooms.guest(owner.guestId);
    return null;
  }

  toOwner(owner: Owner, event: string, payload: unknown) {
    const room = this.room(owner);
    if (!this.server || !room) return;
    this.server.to(room).emit(event, payload);
  }

  toAdmins(event: string, payload: unknown) {
    this.server?.to(rooms.admins).emit(event, payload);
  }

  jobUpdated(owner: Owner, job: unknown) {
    this.toOwner(owner, RealtimeEvent.JobUpdate, job);
    this.toAdmins(RealtimeEvent.AdminJob, job);
  }

  jobRemoved(owner: Owner, id: string) {
    this.toOwner(owner, RealtimeEvent.JobRemoved, { id });
  }

  creditsChanged(owner: Owner, credits: number) {
    this.toOwner(owner, RealtimeEvent.Credits, { credits });
  }
}
