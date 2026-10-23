import ApiError from '../utils/ApiError.js';

/**
 * Validate req[source] against a Zod schema and replace it with the parsed,
 * typed result. Unknown keys are stripped by the schemas themselves.
 */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const parsed = schema.safeParse(req[source]);
  if (!parsed.success) {
    return next(
      ApiError.validation(
        'Validation failed',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      ),
    );
  }
  req[source] = parsed.data;
  return next();
};

export const validateBody = (schema) => validate(schema, 'body');
export const validateQuery = (schema) => validate(schema, 'query');
export const validateParams = (schema) => validate(schema, 'params');

export default validate;
