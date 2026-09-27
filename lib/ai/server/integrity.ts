export class AiOutputError extends Error {}

/** Never attach content to a different slide by falling back to its array position. */
export function exactIds<T extends { id: string }>(expected: { id: string }[], output: T[]): Map<string, T> {
  const wanted = new Set(expected.map((item) => item.id));
  const mapped = new Map(output.map((item) => [item.id, item]));
  if (wanted.size !== expected.length || mapped.size !== output.length || mapped.size !== wanted.size || [...mapped.keys()].some((id) => !wanted.has(id))) {
    throw new AiOutputError("The response did not contain each requested slide exactly once.");
  }
  return mapped;
}
