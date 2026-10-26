export const AUTH_COOKIE = 'access_token';
export const GUEST_COOKIE = 'gid';

export const FORMATS = ['docx', 'pptx', 'xlsx', 'csv', 'txt', 'png', 'jpg'] as const;
export type Format = (typeof FORMATS)[number];

export const CONVERSION_QUEUE = 'conversions';

/** Socket.IO endpoint, under /api so nginx proxies it with the rest of the API. */
export const SOCKET_PATH = '/api/socket.io';
