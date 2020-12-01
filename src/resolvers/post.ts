import { GraphQLResolveInfo } from 'graphql';
import {
  Arg,
  Ctx,
  FieldResolver,
  Info,
  Int,
  Mutation,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from 'type-graphql';
import { LessThan } from 'typeorm';
import { Post } from '../entities/Post';
import { isAuth } from '../middleware/isAuth';
import { MyContext } from '../types';
import { PostInput } from './types/PostInput';
import { PostsConnection } from './types/PostsConnection';

@Resolver(Post)
export class PostResolver {
  @FieldResolver(() => String)
  textSnippet(@Root() root: Post) {
    return root.text.slice(0, 50);
  }

  @Query(() => PostsConnection)
  async postsConnection(
    @Arg('first', () => Int) first: number,
    @Arg('after', () => String) after: string,
    @Info() info: GraphQLResolveInfo
  ): Promise<PostsConnection> {
    const realLimit = Math.min(50, first);
    const realLimitPlusOne = realLimit + 1;

    const where = after
      ? { createdAt: LessThan(new Date(parseInt(after))) }
      : {};
    const posts = await Post.find({
      relations: ['creator'],
      order: { createdAt: -1, id: -1 },
      take: realLimit,
      where,
    });

    const edges = posts
      .filter((_, index) => index !== realLimit)
      .map((post) => ({
        cursor: post.createdAt.toISOString(),
        node: post,
      }));

    return {
      edges,
      pageInfo: {
        hasNextPage: posts.length === realLimitPlusOne,
        hasPreviousPage: false,
        startCursor: '',
        endCursor: '',
      },
    };
  }

  @Query(() => Post, { nullable: true })
  post(@Arg('id', () => Int) id: number): Promise<Post | undefined> {
    return Post.findOne({ where: { id }, relations: ['creator'] });
    // return Post.findOne(id);
  }

  @Mutation(() => Post)
  @UseMiddleware(isAuth)
  async createPost(
    @Arg('input') input: PostInput,
    @Ctx() { req }: MyContext
  ): Promise<Post> {
    return Post.create({ ...input, creatorId: req.session.userId }).save();
  }

  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg('id', () => Int) id: number,
    @Arg('title', () => String, { nullable: true }) title: string
  ): Promise<Post | undefined> {
    const post = await Post.findOne(id);
    if (!post) {
      return undefined;
    }
    if (typeof title !== 'undefined') {
      await Post.update({ id }, { title });
    }

    return post;
  }

  @Mutation(() => Boolean, { nullable: true })
  async deletePost(@Arg('id', () => Int) id: number): Promise<Boolean> {
    await Post.delete(id);
    return true;
  }
}
