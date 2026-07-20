import { IsString, Length, Matches } from 'class-validator';

export class GithubCallbackDto {
  @IsString()
  @Length(1, 256)
  @Matches(/^[A-Za-z0-9_-]+$/)
  code!: string;

  @IsString()
  @Length(40, 128)
  @Matches(/^[A-Za-z0-9_-]+$/)
  state!: string;
}
