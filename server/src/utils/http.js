/**
 * Consistent success envelope for every endpoint.
 *   { data, meta? }
 */
export function sendData(res, data, statusCode = 200, meta) {
  const body = { data };
  if (meta !== undefined) body.meta = meta;
  return res.status(statusCode).json(body);
}

export function sendPaginated(res, items, { page, limit, total }, statusCode = 200) {
  return res.status(statusCode).json({
    data: items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasMore: page * limit < total,
    },
  });
}

export function parsePagination(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

/** Escape a user string before using it inside a RegExp (prevents regex injection). */
export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
