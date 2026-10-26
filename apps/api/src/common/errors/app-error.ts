import { HttpException, HttpStatus } from '@nestjs/common';

/** Error with a stable code for the UI and a Khmer message for the user. */
export class AppError extends HttpException {
  constructor(code: string, message: string, status: HttpStatus = HttpStatus.BAD_REQUEST, extra: object = {}) {
    super({ code, message, ...extra }, status);
  }
}
