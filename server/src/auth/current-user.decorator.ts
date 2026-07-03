import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from './auth.types';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    const user = request.user;
    return data ? user[data as keyof AuthenticatedUser] : user;
  },
);

