import type { z } from 'zod'

/**
 * Form inputs are all strings; the domain schemas expect nulls and numbers.
 * This bridges the two and maps each issue back onto the field it came from,
 * so validation messages land next to the input instead of above the form.
 */
export function schemaValidator<TValues>(
  schema: z.ZodType,
  normalise: (value: TValues) => unknown,
) {
  return ({ value }: { value: TValues }) => {
    const result = schema.safeParse(normalise(value))
    if (result.success) return undefined

    const fields: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && !(key in fields)) {
        fields[key] = issue.message
      }
    }
    return { fields }
  }
}
