import { EffectReportArg } from "types"

type Request<I, O, A extends boolean> = {
  input: I
  output: O
  authenticated: A
}

type PostGameSessionStart = Request<
  {
    gamePackID: string
    effectReportArgs?: EffectReportArg[]
  },
  {
    gameSessionID: string
  },
  true
>

type PostGameSessionStop = Request<
  {
    gameSessionID?: string
  },
  {
    gameSessionID: string
  },
  true
>

type PostAuthTokenExtend = Request<
  {
    jti: string
  },
  {
    token: string
  },
  false
>

type PostAuthApplicationToken = Request<
  {
    appID: string
    code: string
    secret: string
  },
  {
    token: string
  },
  false
>

export type HttpRequestUnion = {
  postGameSessionStart: PostGameSessionStart
  postGameSessionStop: PostGameSessionStop
  postAuthTokenExtend: PostAuthTokenExtend
  postAuthApplicationToken: PostAuthApplicationToken
}

export type HttpRequestOptions<T extends keyof HttpRequestUnion> =
  (unknown extends HttpRequestUnion[T]['input'] ? { input?: undefined } : { input: HttpRequestUnion[T]['input'] }) &
  (true extends HttpRequestUnion[T]['authenticated'] ? { token: string } : { token?: undefined })

// TODO: typescript makes this basically impossible to use >.>
// export type HttpRequestFunction<T extends keyof HttpRequestUnion> = IfEmptyObject<
//   HttpRequestOptions<T>,
//   (key: T, options?: undefined) => HttpRequestUnion[T]['output'],
//   (key: T, options: HttpRequestOptions<T>) => HttpRequestUnion[T]['output']
// >

// Runtime Definitions

interface RuntimeRequestData {
  url: string
  method: 'GET' | 'POST'
}

export const requestData = {
  postGameSessionStart: {
    url: 'game-session/start',
    method: 'POST',
  },
  postGameSessionStop: {
    url: 'game-session/stop',
    method: 'POST',
  },
  postAuthTokenExtend: {
    url: 'auth/token/extend',
    method: 'POST',
  },
  postAuthApplicationToken: {
    url: 'auth/application/token',
    method: 'POST',
  },
} as const satisfies Record<keyof HttpRequestUnion, RuntimeRequestData>
