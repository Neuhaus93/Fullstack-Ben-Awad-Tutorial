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
import { Updoot } from '../entities/Updoot';
import { User } from '../entities/User';
import { isAuth } from '../middleware/isAuth';
import { MyContext } from '../types';
import { PostInput } from './types/PostInput';
import { Posts } from './types/Posts';
import { VoteResult } from './types/VoteResult';

@Resolver(Post)
export class PostResolver {
  @FieldResolver(() => String)
  textSnippet(@Root() root: Post) {
    return root.text.slice(0, 50);
  }

  @FieldResolver(() => User)
  creator(@Root() post: Post, @Ctx() { userLoader }: MyContext) {
    return userLoader.load(post.creatorId);
  }

  @FieldResolver(() => Int, { nullable: true })
  async voteStatus(
    @Root() post: Post,
    @Ctx() { updootLoader, req }: MyContext
  ) {
    if (!req.session.userId) {
      return null;
    }

    const updoot = await updootLoader.load({
      postId: post.id,
      userId: req.session.userId,
    });

    return updoot ? updoot.value : null;
  }

  @Mutation(() => VoteResult)
  @UseMiddleware(isAuth)
  async vote(
    @Arg('postId', () => Int) postId: number,
    @Arg('value', () => Int) value: number,
    @Ctx() { req }: MyContext
  ): Promise<VoteResult> {
    const isUpdoot = value !== -1;
    const realValue = isUpdoot ? 1 : -1;
    const { userId } = req.session;

    const updoot = await Updoot.findOne({ where: { postId, userId } });
    const hasAlreadyVoted = !!updoot;
    const votingOnTheSame = !!(updoot && updoot.value === realValue);
    let ammountChanged = 0;

    if (!hasAlreadyVoted) {
      ammountChanged = realValue;
    } else if (votingOnTheSame) {
      ammountChanged = -1 * realValue;
    } else {
      ammountChanged = 2 * realValue;
    }

    let newVoteStatus: number | null = null;
    if (!votingOnTheSame && ammountChanged > 0) {
      newVoteStatus = 1;
    } else if (!votingOnTheSame && ammountChanged < 0) {
      newVoteStatus = -1;
    }

    const queryRunner = getConnection().createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (!hasAlreadyVoted) {
        await queryRunner.manager.insert(Updoot, {
          userId,
          postId,
          value: realValue,
        });
      } else if (votingOnTheSame) {
        await queryRunner.manager.delete(Updoot, {
          userId,
          postId,
        });
      } else {
        await queryRunner.manager.update(
          Updoot,
          {
            userId,
            postId,
          },
          { value: realValue }
        );
      }

      await queryRunner.manager.update(
        Post,
        {
          id: postId,
        },
        {
          points: () => `points + ${ammountChanged}`,
        }
      );
      await queryRunner.commitTransaction();
    } catch {
      await queryRunner.rollbackTransaction();
      return {
        voteWasRegistered: false,
        ammountChanged: 0,
        newVoteStatus: null,
      };
    } finally {
      await queryRunner.release();
    }

    return { voteWasRegistered: true, ammountChanged, newVoteStatus };
  }

  @Query(() => Posts)
  async posts(
    @Arg('first', () => Int) first: number,
    @Arg('after', () => String) after: string
  ): Promise<Posts> {
    const realLimit = Math.min(50, first);
    const realLimitPlusOne = realLimit + 1;

    const replacements: any[] = [];

    if (after) {
      replacements.push(new Date(parseInt(after)));
    }

    const posts: Post[] = await getConnection().query(
      `
        select p.*
        from post p
        ${after ? `where p."createdAt" < $1` : ''}
        order by p."createdAt" DESC
        limit ${realLimitPlusOne}
    `,
      replacements
    );

    const edges = posts.filter((_, index) => index !== realLimit);
    // .map((post) => ({
    //   cursor: post.createdAt.toISOString(),
    //   node: post,
    // }));

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
    return Post.findOne({ where: { id } });
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
    @Arg('title') title: string,
    @Arg('text') text: string,
    @Ctx() { req }: MyContext
  ): Promise<Post | null> {
    const result = await getConnection()
      .createQueryBuilder()
      .update(Post)
      .set({ title, text })
      .whereInIds(id)
      .andWhere('"creatorId" = :cid', { cid: req.session.userId })
      .returning('*')
      .execute();

    return result.raw[0];
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async deletePost(
    @Arg('id', () => Int) id: number,
    @Ctx() { req }: MyContext
  ): Promise<Boolean> {
    const result = await getConnection()
      .createQueryBuilder()
      .delete()
      .from(Post)
      .whereInIds(id)
      .andWhere('"creatorId" = :cid', { cid: req.session.userId })
      .returning('id')
      .execute();

    if (!result.affected) {
      return false;
    }

    if (result.affected !== 0) {
      return true;
    }

    return false;
  }
}
