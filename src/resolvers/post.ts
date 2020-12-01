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
import { getConnection, LessThan } from 'typeorm';
import { Post } from '../entities/Post';
import { Updoot } from '../entities/Updoot';
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

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async vote(
    @Arg('postId', () => Int) postId: number,
    @Arg('value', () => Int) value: number,
    @Ctx() { req }: MyContext
  ) {
    const isUpdoot = value !== -1;
    const realValue = isUpdoot ? 1 : -1;
    const { userId } = req.session;

    const queryRunner = getConnection().createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.insert(Updoot, {
        userId,
        postId,
        value: realValue,
      });

      await queryRunner.manager.update(
        Post,
        {
          id: postId,
        },
        { points: () => `points + ${realValue}` }
      );
      await queryRunner.commitTransaction();
    } catch {
      await queryRunner.rollbackTransaction();
      return false;
    } finally {
      await queryRunner.release();
    }

    return true;
  }

  @Query(() => PostsConnection)
  async postsConnection(
    @Arg('first', () => Int) first: number,
    @Arg('after', () => String) after: string
  ): Promise<PostsConnection> {
    const realLimit = Math.min(50, first);
    const realLimitPlusOne = realLimit + 1;

    const where = after
      ? { createdAt: LessThan(new Date(parseInt(after))) }
      : {};
    const posts = await Post.find({
      relations: ['creator'],
      order: { createdAt: -1, id: -1 },
      take: realLimitPlusOne,
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
