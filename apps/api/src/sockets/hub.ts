import type { Server } from 'socket.io';

let io: Server | undefined;

export function setSocketServer(server: Server) { io = server; }
export function publish(event: string, payload: unknown) { io?.emit(event, payload); }
