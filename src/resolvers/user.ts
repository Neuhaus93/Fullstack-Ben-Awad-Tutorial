import { User } from '../entities/User';
import { MyContext } from 'src/types';
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from 'type-graphql';
import argon2 from 'argon2';

@InputType()
class UsernamePasswordInput {
  @Field()
  username: string;
  @Field()
  password: string;
}

@ObjectType()
class FieldError {
  @Field()
  field: string;
  @Field()
  message: string;
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => User, { nullable: true })
  user?: User;
}

@Resolver()
export class UserResolver {
  /**
   * Debug Query to check what user is logged in
   * @returns Returns either a user or null
   */
  @Query(() => User, { nullable: true })
  async me(@Ctx() { em, req }: MyContext): Promise<User | null> {
    // You are not logged in
    if (!req.session.userId) {
      return null;
    }

    const user = em.findOne(User, { id: req.session.userId });
    return user;
  }

  /**
   * REGISTER MUTATION - Register and logs the new user in if successful.
   * @param values Object containing the username and password
   * @returns Returns either an array of errors or a user
   */
  @Mutation(() => UserResponse)
  async register(
    @Arg('values') values: UsernamePasswordInput,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const { username, password } = values;

    /** Username lengt must be greater than 2 */
    if (username.length <= 2) {
      return {
        errors: [
          {
            field: 'username',
            message: 'length must be greater than 2',
          },
        ],
      };
    }

    /** Password lengt must be greater than 6 */
    if (password.length <= 6) {
      return {
        errors: [
          {
            field: 'password',
            message: 'length must be greater than 6',
          },
        ],
      };
    }

    /** Create a hashed password and add the new user to the databasee */
    const hashedPassword = await argon2.hash(password);
    const user = em.create(User, { username, password: hashedPassword });

    /** If the username is already taken, catch it */
    try {
      await em.persistAndFlush(user);
    } catch (err) {
      if (err.code === '23505') {
        // unique_violation code
        return {
          errors: [
            {
              field: 'username',
              message: 'username already taken',
            },
          ],
        };
      } else {
        // Unkown error
        return {
          errors: [{ field: 'unkown', message: 'unexpected error' }],
        };
      }
    }

    /**
     * Store user id session
     * This will set a cookie on the user
     * Kepp them logged in
     */
    req.session.userId = user.id;

    return { user };
  }

  /**
   * Login Mutation
   * @param values Object containing the username and password
   * @returns Returns either an array of errors or a user
   */
  @Mutation(() => UserResponse)
  async login(
    @Arg('values') values: UsernamePasswordInput,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const { username, password } = values;
    const user = await em.findOne(User, { username });

    /** No user found with the username */
    if (!user) {
      return {
        errors: [
          {
            field: 'username',
            message: "username doesn't exist",
          },
        ],
      };
    }

    /** Verifying the password */
    const valid = await argon2.verify(user.password, password);
    if (!valid) {
      return {
        errors: [
          {
            field: 'password',
            message: 'incorrect password',
          },
        ],
      };
    }

    req.session.userId = user.id;

    /** Returning the user if the login was successful */
    return { user };
  }
}
