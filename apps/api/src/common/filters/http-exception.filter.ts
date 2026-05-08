import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object' && 'message' in exceptionResponse) {
        message = Array.isArray((exceptionResponse as any).message)
          ? (exceptionResponse as any).message[0]
          : (exceptionResponse as any).message;
        code = (exceptionResponse as any).error || exception.constructor.name;
      } else {
        message = exception.message;
      }
    }

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url} → ${status}`, exception);
    }

    response.status(status).json({
      status: 'error',
      code,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
