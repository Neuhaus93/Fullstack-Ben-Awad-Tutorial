import { User } from '../entities/User';
import { MyContext } from 'src/types';
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  ObjectType,
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
  @Mutation(() => UserResponse)
  async register(
    @Arg('options') options: UsernamePasswordInput,
    @Ctx() { em }: MyContext
  ): Promise<UserResponse> {
    const { username, password } = options;

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

    return { user };
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg('options') options: UsernamePasswordInput,
    @Ctx() { em }: MyContext
  ): Promise<UserResponse> {
    const { username, password } = options;
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

    /** Returning the user if the login was successful */
    return { user };
  }
}
