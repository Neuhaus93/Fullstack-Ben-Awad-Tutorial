import {
  Arg,
  Ctx,
  FieldResolver,
  Int,
  Mutation,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from 'type-graphql';
import { getConnection } from 'typeorm';
import { Post } from '../entities/Post';
import { isAuth } from '../middleware/isAuth';
import { MyContext } from '../types';
import { PostsConnection } from './types/PostsConnection';
import { PostInput } from './types/PostInput';

@Resolver(Post)
export class PostResolver {
  @FieldResolver(() => String)
  textSnippet(@Root() root: Post) {
    return root.text.slice(0, 50);
  }

  @Query(() => PostsConnection)
  async postsConnection(
    @Arg('first', () => Int) first: number,
    @Arg('after', () => String) after: string
  ): Promise<PostsConnection> {
    const realLimit = Math.min(50, first);
    const realLimitPlusOne = realLimit + 1;

    const qb = getConnection()
      .getRepository(Post)
      .createQueryBuilder('p')
      // .where("user.id = :id", { id: 1 })
      .orderBy('p."createdAt"', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .take(realLimitPlusOne);

    if (after) {
      qb.where('p."createdAt" < :cursor', {
        cursor: new Date(parseInt(after)),
      });
    }

    const posts = await qb.getMany();

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
    return Post.findOne(id);
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
