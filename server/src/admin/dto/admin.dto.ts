import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../common/request.dto';

export class AdminListQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;
}

export class UpdateAdminUserDto {
  @IsOptional()
  @IsIn(['USER', 'ADMIN'])
  role?: 'USER' | 'ADMIN';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  projectLimitOverride?: number | null;
}

export class UpdatePlatformSettingsDto {
  @IsOptional()
  @IsBoolean()
  deploymentsPaused?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  defaultProjectLimit?: number;
}
