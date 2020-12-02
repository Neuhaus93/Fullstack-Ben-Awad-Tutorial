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
import { isAuth } from '../middleware/isAuth';
import { MyContext } from '../types';
import { PostInput } from './types/PostInput';
import { PostsConnection } from './types/PostsConnection';
import { VoteResult } from './types/VoteResult';

@Resolver(Post)
export class PostResolver {
  @FieldResolver(() => String)
  textSnippet(@Root() root: Post) {
    return root.text.slice(0, 50);
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

  @Query(() => PostsConnection)
  async postsConnection(
    @Arg('first', () => Int) first: number,
    @Arg('after', () => String) after: string,
    @Ctx() { req }: MyContext
  ): Promise<PostsConnection> {
    const realLimit = Math.min(50, first);
    const realLimitPlusOne = realLimit + 1;
    const userId = req.session.userId;

    const replacements: any[] = [];

    if (after) {
      replacements.push(new Date(parseInt(after)));
    }

    const posts: Post[] = await getConnection().query(
      `
        select p.*,
        json_build_object(
          'id', u.id,
          'username', u.username,
          'email', u.email,
          'createdAt', u."createdAt",
          'updatedAt', u."updatedAt"
          ) creator,
        ${
          userId
            ? `(select value from updoot where "userId" = ${userId} and "postId" = p.id) "voteStatus"`
            : 'null as "voteStatus"'
        }
        from post p
        left join public.user u on u.id = p."creatorId"
        ${after ? `where p."createdAt" < $1` : ''}
        order by p."createdAt" DESC
        limit ${realLimitPlusOne}
    `,
      replacements
    );

    // const posts = await getConnection()
    //   .createQueryBuilder()
    //   .select('post')
    //   .addSelect((sq) => {
    //     return sq
    //       .select('updoot.value')
    //       .from(Updoot, 'updoot')
    //       .where('updoot.userId = :uid and updoot.postId = post.id', {
    //         uid: userId,
    //       });
    //   })
    //   .from(Post, 'post')
    //   .orderBy('"post_createdAt"', 'DESC')
    //   .leftJoinAndSelect('post.creator', 'creator')
    //   .take(realLimitPlusOne)
    //   .getMany();

    // const where = after
    //   ? { createdAt: LessThan(new Date(parseInt(after))) }
    //   : {};
    // const posts = await Post.find({
    //   relations: ['creator'],
    //   select: undefined,
    //   order: { createdAt: -1, id: -1 },
    //   take: realLimitPlusOne,
    //   where,
    // });

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
