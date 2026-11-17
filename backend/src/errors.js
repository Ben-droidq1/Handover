export class HttpError extends Error {
  constructor(status, message, code) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
  }
}

export const notFound = (what = 'Not found') => new HttpError(404, what, 'not_found')
export const badRequest = (message) => new HttpError(400, message, 'bad_request')
export const conflict = (message) => new HttpError(409, message, 'conflict')

export function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}
