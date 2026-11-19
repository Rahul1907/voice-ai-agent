import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { AppConfigService } from '../../config/app-config.service';

interface ExceptionResponseObject {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly configService: AppConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const requestId =
      request.id || (request.headers['x-request-id'] as string | undefined) || randomUUID();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorTitle = 'Internal Server Error';
    let messages: string[] = ['An unexpected internal error occurred'];

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        messages = [res];
        errorTitle = exception.name.replace(/Exception$/, '');
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as ExceptionResponseObject;
        if (Array.isArray(resObj.message)) {
          messages = resObj.message;
        } else if (typeof resObj.message === 'string') {
          messages = [resObj.message];
        }

        if (resObj.error) {
          errorTitle = resObj.error;
        } else {
          errorTitle = exception.name.replace(/Exception$/, '');
        }
      }
    } else if (exception instanceof Error) {
      if (!this.configService.isProduction) {
        messages = [exception.message];
      }
    }

    // Set standard response header for tracing
    response.setHeader('x-request-id', requestId);

    if (statusCode >= 500) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} - ${statusCode} - ${
          exception instanceof Error ? exception.stack : JSON.stringify(exception)
        }`,
      );
    } else {
      this.logger.warn(
        `[${requestId}] ${request.method} ${request.url} - ${statusCode} - ${messages.join('; ')}`,
      );
    }

    response.status(statusCode).json({
      statusCode,
      error: errorTitle,
      message: messages,
      requestId,
    });
  }
}
