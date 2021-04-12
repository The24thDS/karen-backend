import { IsNotEmpty } from 'class-validator';

export class SearchModelDto {
  @IsNotEmpty()
  searchString: string;
}
