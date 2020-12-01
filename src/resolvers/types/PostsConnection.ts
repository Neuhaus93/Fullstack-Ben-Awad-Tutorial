import { Field, ObjectType } from 'type-graphql';
import { Post } from '../../entities/Post';

@ObjectType()
class PageInfo {
  @Field()
  hasNextPage: boolean;

  @Field()
  hasPreviousPage: boolean;

  @Field()
  startCursor: string;

  @Field()
  endCursor: string;
}

@ObjectType()
class Edge {
  @Field()
  cursor: string; // A marker for an edge's position in the connection

  @Field(() => Post)
  node: Post;
}

@ObjectType()
export class PostsConnection {
  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field(() => [Edge])
  edges: Edge[];
}
