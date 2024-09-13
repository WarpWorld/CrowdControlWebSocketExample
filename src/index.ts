import WebSocket from 'ws'
import fs from 'fs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'

// Load credentials

let creds: Credentials | undefined

function setCreds(token: string): void {
  const payload = jwt.decode(token)

  creds = { token, payload } as Credentials
}

if (fs.existsSync('creds.jwt')) {
  setCreds(fs.readFileSync('creds.jwt').toString('utf-8').trim())
}

// Open websocket

console.log("Connecting...")

const ws = new WebSocket('wss://pubsub.crowdcontrol.live/', {
  headers: {
    'user-agent': 'Super Example Game 65',
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

function onAuthenticated() {
  if (!creds) return

  console.log("Subscribing...")

  sendRequest({
    action: 'subscribe',
    data: {
      topics: [`pub/${creds.payload.ccUID}`],
    },
  })
}

// Define event listeners

ws.on('error', console.error)

ws.on('open', () => {
  if (creds) {
    onAuthenticated()
  } else {
    sendRequest({ action: "whoami" })
  }
})

ws.on('message', (data) => {
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

  // authentication-requiring events
  if (!creds) return
  const { token, payload } = creds

  if (event.type === "subscription-result") {
    // We are now successfully listening for events!
    // Let's note it in the logs
    console.log(`Connected to WebSocket as ${payload.name}`)
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
