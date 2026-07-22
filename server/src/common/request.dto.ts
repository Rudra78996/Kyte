import { Type } from 'class-transformer';
import {
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take = 20;
}

export class ProjectListQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,64}$/)
  organizationId?: string;
}

export class MetricsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([7, 30, 90])
  days: 7 | 30 | 90 = 7;
}
