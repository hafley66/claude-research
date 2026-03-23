// ============================================
// Str: parameterized string identity
// ============================================
// Every meaningful string is a pattern with typed holes.
// Say it once, then it exists.

model Str<TPattern extends string, TParams extends Record<string, unknown> = {}> {
  pattern: TPattern;
  params: TParams;
}

// Usage:
alias CounterPath = Str<"/counter">;
alias UserPath = Str<"/users/{id}", { id: UserId }>;
alias UserPostsPath = Str<"/users/{id}/posts/{postId}", {
  id: UserId;
  postId: PostId;
}>;

// Golden rule of strings:
//   Level 0: raw string (system boundary, untrusted)
//   Level 1: validated scalar (format constraint)
//   Level 2: named scalar (domain meaningful, infinite values)
//   Level 3: finite enum (all values known at compile time)
//   Level 4: union discriminant (string selects typed payload)
// Strings move UP the ladder as you learn more about them.
