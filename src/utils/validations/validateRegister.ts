import { FieldError } from '../../resolvers/types/FieldError';
import { RegisterInput } from '../../resolvers/types/UserInputs';
import { validateEmail } from './validateEmail';
import { validatePassword } from './validatePassword';

/**
 * Validate the register entries
 * @param values object containing the email, username and password
 * @returns null if no errors were found {errors: [{field, message}]} if an error was found
 */
export const validateRegister = (values: RegisterInput) => {
  const { email, username, password } = values;
  const errors = [] as FieldError[];

  /** Must be a valid email */
  const emailError = validateEmail(email);
  emailError && errors.push(emailError);

  /** Username lengt must be greater than 2 */
  if (username.length <= 2) {
    errors.push({
      field: 'username',
      message: 'Length must be greater than 2',
    });
  }

  /** Must be a valid password */
  const passwordError = validatePassword(password);
  passwordError && errors.push(passwordError);

  if (errors.length > 0) {
    return errors;
  }

  return null;
};
