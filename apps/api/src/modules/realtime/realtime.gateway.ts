import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AUTH_COOKIE, GUEST_COOKIE, SOCKET_PATH } from '../../common/constants';
import { parseCookieHeader, readSignedCookie } from '../../common/utils/cookies';
import { PrismaService } from '../../prisma/prisma.service';
import { rooms } from './realtime.events';
import { RealtimeService } from './realtime.service';

/**
 * WebSocket endpoint. A browser is identified exactly like an HTTP request: by its
 * httpOnly JWT cookie (signed-in user) and its signed guest cookie, both sent with the
 * handshake. It then joins its private room, plus the admin room for admins.
 */
@WebSocketGateway({ path: SOCKET_PATH, serveClient: false, transports: ['websocket', 'polling'] })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly log = new Logger(RealtimeGateway.name);
  @WebSocketServer() server: Server;

  constructor(
    private readonly realtime: RealtimeService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    this.realtime.attach(server);
  }

  async handleConnection(client: Socket) {
    const cookies = parseCookieHeader(client.handshake.headers.cookie);
    const guestId = readSignedCookie(cookies[GUEST_COOKIE]);
    let joined = 0;

    const token = cookies[AUTH_COOKIE];
    if (token) {
      try {
        const { sub } = await this.jwt.verifyAsync<{ sub: string }>(token);
        const user = await this.prisma.user.findUnique({ where: { id: sub } });
        if (user?.isActive) {
          await client.join(rooms.user(user.id));
          if (user.role === 'ADMIN') await client.join(rooms.admins);
          joined++;
        }
      } catch {
        /* expired token: treat as guest */
      }
    }
    if (!joined && guestId) {
      await client.join(rooms.guest(guestId));
      joined++;
    }
    if (!joined) client.disconnect(true);
  }
}
