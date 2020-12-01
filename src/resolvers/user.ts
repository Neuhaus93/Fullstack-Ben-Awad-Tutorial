import argon2 from 'argon2';
import { MyContext } from 'src/types';
import {
  Arg,
  Ctx,
  Field,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from 'type-graphql';
import { v4 } from 'uuid';
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from '../constants';
import { User } from '../entities/User';
import { sendEmail } from '../utils/sendEmail';
import { validatePassword } from '../utils/validations/validatePassword';
import { validateRegister } from '../utils/validations/validateRegister';
import { FieldError } from './types/FieldError';
import { LoginInput, RegisterInput } from './types/UserInputs';

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
  async changePassword(
    @Arg('token') token: string,
    @Arg('newPassword') newPassword: string,
    @Ctx() { redis, req }: MyContext
  ): Promise<UserResponse> {
    const errors = [];
    const passwordError = validatePassword(newPassword, 'newPassword');

    passwordError && errors.push(passwordError);

    if (errors.length > 0) {
      return { errors };
    }

    const key = FORGET_PASSWORD_PREFIX + token;
    const userId = await redis.get(key);
    if (!userId) {
      return {
        errors: [
          {
            field: 'token',
            message: 'Token expired',
          },
        ],
      };
    }

    const userIdNum = parseInt(userId);
    const user = await User.findOne(userIdNum);

    if (!user) {
      return {
        errors: [
          {
            field: 'token',
            message: 'User no longer exists',
          },
        ],
      };
    }

    await User.update(
      { id: userIdNum },
      {
        password: await argon2.hash(newPassword),
      }
    );

    await redis.del(key);

    // Log in user after change password
    req.session.userId = user.id;

    return { user };
  }

  @Mutation(() => Boolean)
  async forgotPassword(
    @Arg('email') email: string,
    @Ctx() { redis }: MyContext
  ) {
    const user = await User.findOne({ where: email });

    if (!user) {
      // The email is not in the database
      return true;
    }

    const token = v4();

    await redis.set(
      FORGET_PASSWORD_PREFIX + token,
      user.id,
      'ex',
      1000 * 60 * 60 * 24 * 3 // 3 days
    );

    await sendEmail(
      email,
      `<a href="http://localhost:3000/change-password/${token}">reset password</a>`
    );

    return true;
  }

  /**
   * Debug Query to check what user is logged in
   * @returns Returns either a user or null
   */
  @Query(() => User, { nullable: true })
  me(@Ctx() { req }: MyContext): Promise<User | undefined> {
    // You are not logged in
    if (!req.session.userId) {
      return Promise.resolve(undefined);
    }

    return User.findOne(req.session.userId);
  }

  /**
   * REGISTER MUTATION - Register and logs the new user in if successful.
   * @param values Object containing the username and password
   * @returns Returns either an array of errors or a user
   */
  @Mutation(() => UserResponse)
  async register(
    @Arg('values') values: RegisterInput,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const { username, password, email } = values;
    const errors = validateRegister(values);

    if (errors && errors.length > 0) {
      return { errors };
    }

    /** Create a hashed password and add the new user to the databasee */
    const hashedPassword = await argon2.hash(password);
    let user;

    /** If the username is already taken, catch it */
    try {
      user = await User.create({
        username,
        email,
        password: hashedPassword,
      }).save();
    } catch (err) {
      console.log('err: ', err);
      if (err.code === '23505') {
        // unique_violation code
        return {
          errors: [
            {
              field: 'email',
              message: 'email already taken',
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
   * LOGIN MUTATION - Login the user and stores the user ID on the session
   * @param values Object containing the username and password
   * @returns Returns either an array of errors or a user
   */
  @Mutation(() => UserResponse)
  async login(
    @Arg('values') values: LoginInput,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const { email, password } = values;
    const user = await User.findOne({ email });

    /** No user found with the username */
    if (!user) {
      return {
        errors: [
          {
            field: 'email',
            message: 'Email not found',
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
            message: 'Incorrect password',
          },
        ],
      };
    }

    req.session.userId = user.id;

    /** Returning the user if the login was successful */
    return { user };
  }

  /**
   * LOGOUT MUTATION - Logs out the user and clears the session
   * @returns Boolean value indicating success (true) or failure (false)
   */
  @Mutation(() => Boolean)
  async logout(@Ctx() { req, res }: MyContext) {
    return new Promise((resolve) =>
      req.session.destroy((err) => {
        res.clearCookie(COOKIE_NAME);
        if (err) {
          console.log(err);
          resolve(false);
          return;
        }
        resolve(true);
      })
    );
  }
}
