import WebSocket from 'ws'
import fs from 'fs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'

// Miscellaneous state

const wssUrl = 'wss://pubsub.crowdcontrol.live/'
const openApiUrl = 'https://openapi.crowdcontrol.live'
const game = {
  name: 'Super Example Game 65',
  id: 'Minecraft',
}
let gameSessionID: PublicGameSessionStartEvent['payload']['gameSessionID']

// Load credentials

let creds: Credentials

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
    'user-agent': game.name,
  },
})

// Define type-validating input/output functions

function asEvent(data: WebSocket.RawData): CCEvent | undefined {
  try {
    const event = JSON.parse(data.toString('utf-8'))
    if (!event) return
    if (!('domain' in event)) return
    if (!('type' in event)) return

    return event as CCEvent
  } catch (e) {
  }
}

function sendRequest(request: CCRequest): void {
  const data = JSON.stringify(request)
  ws.send(data)
}

function getPublic(name: PublicEffectRequestEvent['payload']['effect']['name']): string {
  return typeof name === 'string' ? name : name.public
}

// Define function to run on connection & auth

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
  await fetch(`${openApiUrl}/game-session/start`, {
    method: 'POST',
    body: JSON.stringify({
      gamePackID: game.id,
    }),
    headers: {
      "Authorization": `cc-auth-token ${token}`,
      "Content-Type": "application/json",
      "User-Agent": game.name,
    },
  })
}

// Define event listeners

ws.on('error', console.error)

ws.on('open', async () => {
  if (creds) {
    await onAuthenticated()
  } else {
    sendRequest({ action: "whoami" })
  }
})

ws.on('message', async (data) => {
  const event = asEvent(data)
  if (!event) return

  // non-authenticated events
  if (event.type === "whoami") {
    console.log(`Please authenticate on https://auth.crowdcontrol.live/?connectionID=${event.payload.connectionID}`)
  }
  else if (event.type === "login-success") {
    fs.writeFileSync('creds.jwt', event.payload.token)
    setCreds(event.payload.token)
    onAuthenticated()
  }
  else if (event.type === "game-session-start") {
    gameSessionID = event.payload.gameSessionID
    console.log(`Started session ${gameSessionID}`)
  }

  // authentication-requiring events
  if (!creds) return
  const { token, payload } = creds

  if (event.type === "subscription-result") {
    // We are now successfully listening for events!
    // Let's note it in the logs
    console.log(`Subscribed to WebSocket as ${payload.name}`)
  }
  else if (event.domain === 'pub' && event.type === 'effect-request') {
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
  }
})

// Handle shutdown
async function handleShutdown(): Promise<void> {
  console.log('Shutting down...')
  if (creds && gameSessionID) {
    console.log('Stopping session...')
    const { token } = creds
    await fetch(`${openApiUrl}/game-session/stop`, {
      method: 'POST',
      body: JSON.stringify({
        gameSessionID,
      }),
      headers: {
        "Authorization": `cc-auth-token ${token}`,
        "Content-Type": "application/json",
        "User-Agent": game.name,
      },
    })
  }
  process.exit(0)
}

process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);
