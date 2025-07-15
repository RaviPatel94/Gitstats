export class CustomApiError extends Error {
  static readonly USER_NOT_FOUND = "USER_NOT_FOUND"
  static readonly GRAPHQL_ERROR = "GRAPHQL_ERROR"

  constructor(
    message: string,
    public code: string,
  ) {
    super(message)
    this.name = "CustomApiError"
  }
}
