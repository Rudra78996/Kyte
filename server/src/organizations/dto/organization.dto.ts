import { IsString, Length, Matches } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @Length(1, 80)
  name!: string;

  @IsString()
  @Length(1, 60)
  @Matches(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/, {
    message: 'slug may contain letters, numbers, and single hyphens',
  })
  slug!: string;
}
