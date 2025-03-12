import WebSocket from 'ws'
import fs from 'fs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { HttpRequestOptions, HttpRequestUnion, requestData } from './http'
import { CCEvent, CCRequest, Credentials, PublicGameSessionStartEvent, SortableString } from './types'

// Miscellaneous state

const wssUrl = 'wss://pubsub.crowdcontrol.live/'
const openApiUrl = 'https://openapi.crowdcontrol.live'
const application = {
  appID: 'ccaid-01jp3av56v4m33njwgkh4zh1vd',
  scopes: ['session:write', 'session:control'],
  packs: ['SuperGameDeluxe65'],
  secret: '160aadf42e92e2e37339acdef227ffbdcc0c3751047dbb18b93d3054b11c2879',
}
const ua = 'Super Game Deluxe 65'
let gameSessionID: PublicGameSessionStartEvent['payload']['gameSessionID']
let loginCode: string | undefined = undefined

// Load credentials

let creds: Credentials | undefined = undefined

/**
 * Parses the JWT token data into memory
 * @param token encoded JWT token
 */
function setCreds(token: string): void {
  const payload = jwt.decode(token)

  creds = { token, payload } as Credentials
}

if (fs.existsSync('creds.jwt')) {
  setCreds(fs.readFileSync('creds.jwt').toString('utf-8').trim())
}

// Open websocket

console.log("Connecting...")

const ws = new WebSocket(wssUrl, {
  headers: {
    'user-agent': ua,
  },
})

// Define type-validating input/output functions

/**
 * Fetches a resource from the OpenAPI.
 * @param key endpoint key defined in requestData
 * @param options extra options such as input and token
 * @returns response from the API
 */
async function fetchOpenApi<T extends keyof HttpRequestUnion>(key: T, options: HttpRequestOptions<T>): Promise<HttpRequestUnion[T]['output']> {
  const r = await fetch(new URL(requestData[key]['url'], openApiUrl), {
    method: requestData[key]['method'],
    ...(options?.input && { body: JSON.stringify(options.input) }),
    headers: {
      "Content-Type": "application/json",
      "User-Agent": ua,
      ...(options?.token && { "Authorization": `cc-auth-token ${options.token}` }),
      ...(options?.input && { "Accept": "application/json" }),
    },
  })
  const json = await r.json()
  return json
}

/**
 * Decodes an incoming WebSocket message into a CCEvent.
 * May return undefined is there is a parsing error.
 * @param data incoming WebSocket message
 * @returns parsed event if valid
 */
function asEvent(data: WebSocket.RawData): CCEvent | undefined {
  try {
    // You might consider using a validation library like Zod to ensure inputs are as expected!
    // Just don't use strictObjects or enums, we're always adding new features 😉

    const event = JSON.parse(data.toString('utf-8'))
    if (!event) return
    if (!('domain' in event)) return
    if (!('type' in event)) return

    return event as CCEvent
  } catch (e) {
  }
}

/**
 * Encodes and sends an outgoing WebSocket message.
 * @param request message to send
 */
function sendRequest(request: CCRequest): void {
  const data = JSON.stringify(request)
  ws.send(data)
}

/**
 * Gets the display value for a potentially sortable string.
 * @param name string or sotrable string
 * @returns display name of the string
 */
function getPublic(name: SortableString): string {
  return typeof name === 'object' ? name.public : name
}

/**
 * Gets the sort value for a potentially sortable string.
 * @param name string or sotrable string
 * @returns sort name of the string
 */
function getSort(name: SortableString): string {
  return typeof name === 'object' ? (name.sort ?? name.public) : name
}

/**
 * Sorts sortable strings.
 * @param a string A
 * @param b string B
 * @returns comparison value
 */
function sortStringFn(a: SortableString, b: SortableString): number {
  a = getSort(a)
  b = getSort(b)
  return a.localeCompare(b)
}

// Define function to run on connection & auth

/**
 * To be invoked upon first successful authentication
 */
async function onAuthenticated() {
  if (!creds) return
  const { token, payload } = creds

  console.log("Subscribing...")

  sendRequest({
    action: 'subscribe',
    data: {
      topics: [`pub/${payload.ccUID}`],
    },
  })

  console.log("Starting session...")
  const { packs: [gamePackID] } = application
  await fetchOpenApi('postGameSessionStart', { input: { gamePackID }, token })
}

// Define event listeners

ws.on('error', console.error)

ws.on('open', async () => {
  if (creds) {
    const loadedCreds = creds
    creds = undefined

    try {
      const { token } = await fetchOpenApi('postAuthTokenExtend', { input: { jti: loadedCreds.payload.jti } })
      fs.writeFileSync('creds.jwt', token)
      setCreds(token)
      await onAuthenticated()
      return
    } catch (e) {
      console.log("Failed to extend auth token", e)
    }
  }

  // avoid sending unnecessary data, can lead to errors
  const { secret, ...data } = application
  sendRequest({ action: "generate-auth-code", data })
})

ws.on('message', async (data) => {
  const event = asEvent(data)
  if (!event) return

  // non-authenticated events
  if (event.type === "application-auth-code") {
    loginCode = event.payload.code
    console.log(`Please authenticate on ${event.payload.url}`)
    return
  }
  if (event.type === "application-auth-code-redeemed") {
    if (!loginCode) {
      console.log("Unknown auth code redeemed")
      return
    }
    const { appID, secret } = application
    const { token } = await fetchOpenApi('postAuthApplicationToken', { input: {
      appID,
      secret,
      code: loginCode,
    } })
    fs.writeFileSync('creds.jwt', token)
    setCreds(token)
    onAuthenticated()
    return
  }
  if (event.type === "game-session-start") {
    gameSessionID = event.payload.gameSessionID
    console.log(`Started session ${gameSessionID}`)
    return
  }

  // authentication-requiring events
  if (!creds) return
  const { token, payload } = creds

  if (event.type === "subscription-result") {
    // We are now successfully listening for events!
    // Let's note it in the logs
    console.log(`Subscribed to WebSocket as ${payload.name}`)
    return
  }
  if (event.domain === 'pub' && event.type === 'effect-request') {
    console.log(`Accepting request for effect ${getPublic(event.payload.effect.name)} by ${event.payload.requester?.name ?? '[unknown user]'}`)
    sendRequest({
      action: 'rpc',
      data: {
        token,
        call: {
          id: uuidv4(),
          type: "call",
          method: "effectResponse",
          args: [{
            id: uuidv4(),
            request: event.payload.requestID,
            status: 'success',
            message: '',
            stamp: Date.now() / 1000,
          }]
        },
      }
    })
    return
  }
})

// Handle shutdown
async function handleShutdown(): Promise<void> {
  console.log('Shutting down...')
  if (creds && gameSessionID) {
    console.log('Stopping session...')
    const { token } = creds
    await fetchOpenApi('postGameSessionStop', { input: { gameSessionID }, token })
  }
  process.exit(0)
}

process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);
