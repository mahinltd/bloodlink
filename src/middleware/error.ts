import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { errorCatalogue } from '../config/errors.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly ref: string;
  public readonly fields: Record<string, string> | undefined;

  constructor(
    statusCode: number,
    code: string,
    ref: string,
    message: string,
    fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.ref = ref;
    this.fields = fields;
  }
}

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', 'BL-404', 'The requested resource was not found.'));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const requestId = res.locals.requestId ?? 'unknown';
  if (error instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of error.issues) {
      const field = issue.path.join('.') || 'request';
      fields[field] = 'INVALID';
    }
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        ref: 'BL-400',
        message: { bn: errorCatalogue.VALIDATION_ERROR.bn, en: errorCatalogue.VALIDATION_ERROR.en },
        fields,
        requestId,
      },
    });
    return;
  }

  const appError = error instanceof AppError ? error : undefined;
  const statusCode = appError?.statusCode ?? 500;
  if (!appError) {
    req.log?.error({ err: error, requestId }, 'Unhandled request error');
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: appError?.code ?? 'INTERNAL_ERROR',
      ref: appError?.ref ?? 'BL-500',
      message: appError
        ? { bn: appError.message, en: appError.message }
        : { bn: errorCatalogue.INTERNAL_ERROR.bn, en: errorCatalogue.INTERNAL_ERROR.en },
      ...(appError?.fields ? { fields: appError.fields } : {}),
      requestId,
    },
  });
};
