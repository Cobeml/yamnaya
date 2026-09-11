export class DomainError extends Error {
  constructor(
    message: string,
    public code = "CONFLICT",
    public status = 409,
  ) {
    super(message);
  }
}
