const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g;

/**
 * Checks if the email input is a valid email
 * @param email string to be verified
 * @returns null if valid. Error object if unvalid.
 */
export const validateEmail = (email: string) => {
  const isValidEmail = emailRegex.test(email);

  if (isValidEmail) {
    return null;
  } else {
    return {
      field: 'email',
      message: 'Email address already taken',
    };
  }
};
