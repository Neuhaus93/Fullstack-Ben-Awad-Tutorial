export const validatePassword = (password: string, field?: string) => {
  /** Password lengt must be greater than 5 */
  if (password.length <= 5) {
    return {
      field: field || 'password',
      message: 'Length must be greater than 5',
    };
  }

  return null;
};
