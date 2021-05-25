import { IsNotEmpty } from 'class-validator';

export class VoteModelDto {
  @IsNotEmpty()
  voteType: string;
}
