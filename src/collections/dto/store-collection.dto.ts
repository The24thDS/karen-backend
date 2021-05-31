import { IsNotEmpty, IsString } from 'class-validator';

export class StoreCollectionDTO {
  @IsString()
  @IsNotEmpty()
  name: string;
  @IsString()
  @IsNotEmpty()
  description: string;
  @IsString()
  @IsNotEmpty()
  visibility: string;
}
