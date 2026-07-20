import {
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

@Injectable()
export class ResourceIdPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
      throw new BadRequestException('Invalid resource identifier');
    }
    return value;
  }
}

@Injectable()
export class EnvironmentKeyPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(value)) {
      throw new BadRequestException('Invalid environment variable key');
    }
    return value;
  }
}
