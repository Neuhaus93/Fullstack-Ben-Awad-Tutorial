import { Field, InputType } from 'type-graphql';

@InputType()
class PostInput {
  @Field()
  title: string;

  @Field()
  text: string;
}

export { PostInput };
