import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import type { Response, Request } from 'express';

export interface ApiResponse<T> {
  statusCode: number;
  timestamp: Date;
  path: string;
  data: T;
}

export class ApiResponseTransformerInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<any> | Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((data) => ({
        statusCode: res.statusCode,
        timestamp: new Date().toISOString(),
        path: req.url,
        data: data,
      })),
    );
  }
}
