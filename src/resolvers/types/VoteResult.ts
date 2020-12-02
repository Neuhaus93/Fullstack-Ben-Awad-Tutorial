import { ObjectType, Field, Int } from 'type-graphql';

@ObjectType()
export class VoteResult {
  @Field(() => Boolean)
  voteWasRegistered: boolean;

  @Field(() => Int)
  ammountChanged: number;

  @Field(() => Int, { nullable: true })
  newVoteStatus: number | null;
}
