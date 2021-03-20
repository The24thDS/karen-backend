import { ArrayNotEmpty, IsNotEmpty } from 'class-validator';

export class CreateModelDto {
  @IsNotEmpty()
  name: string;

  @ArrayNotEmpty()
  tags: string[];
}
