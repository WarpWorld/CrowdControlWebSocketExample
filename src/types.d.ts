interface Credentials {
  token: string
  payload: {
    type: string
    jti: string
    ccUID: string
    originID: string
    profileType: string
    name: string
    roles: string[]
    exp: number
    ver: string
  }
}

////////////////////
////// Events //////
////////////////////

interface DirectWhoAmIEvent {
  domain: 'direct'
  type: 'whoami'
  payload: {
    connectionID: string
  }
}

interface DirectLoginSuccessEvent {
  domain: 'direct'
  type: 'login-success'
  payload: {
    token: string
  }
}

interface DirectSubscriptionResultEvent {
  domain: 'direct'
  type: 'subscription-result'
  payload: {
    success: string[]
    failure: string[]
  }
}

interface PublicGameSessionStartEvent {
  domain: 'pub'
  type: 'game-session-start'
  payload: {
    gameSessionID: 'string'
  }
}

interface PublicGameSessionStopEvent {
  domain: 'pub'
  type: 'game-session-stop'
  payload: {
    gameSessionID: 'string'
  }
}

interface PublicEffectRequestEvent {
  domain: 'pub'
  type: 'effect-request'
  payload: {
    effect: {
      // GameSessionPublicEffectPayloadEffectData
      effectID: string // EffectID
      type: 'game' | 'overlay' | 'sfx'
      name:
        | string
        | {
            public: string
            sort?: string
          }
      image: string
      note?: string
      description?: string
      tags?: string[]
      disabled?: boolean
      new?: boolean
      inactive?: boolean
      admin?: boolean
      category?: string[]
      group?: string[]
      tiktok?: {
        name: string
        image: string
        id: number
        duration?: {
          value: number
          immutable?: boolean
        }
      }
      sessionCooldown?: {
        startTime: number
        duration: number
      }
      userCooldown?: {
        startTime: number
        duration: number
      }
      scale?: {
        duration: number
        percent: number
        startTime: number
        startScale: number
      }
      hidden?: boolean
      unavailable?: boolean
    }
    target: {
      // SanitizedUserRecord
      ccUID: string // CrowdControlUserID
      image: string
      name: string
      profile: // ProfileType
      'twitch' | 'tiktok' | 'youtube' | 'discord' | 'tiktok-gifter' | 'pulsoid'
      originID: string
    }
    origin?: {
      // SanitizedUserRecord
      ccUID: string // CrowdControlUserID
      image: string
      name: string
      profile: // ProfileType
      'twitch' | 'tiktok' | 'youtube' | 'discord' | 'tiktok-gifter' | 'pulsoid'
      originID: string
    }
    requester?: {
      // SanitizedUserRecord
      ccUID: string // CrowdControlUserID
      image: string
      name: string
      profile: // ProfileType
      'twitch' | 'tiktok' | 'youtube' | 'discord' | 'tiktok-gifter' | 'pulsoid'
      originID: string
    }
    sourceDetails?:
      | {
          // SanitizedSourceDetails
          type: 'crowd-control-test'
        }
      | {
          type: 'crowd-control-retry'
        }
      | {
          name: string
          type: 'twitch-channel-reward'
          rewardID: string
          redemptionID: string
          twitchID: string
          cost: number
        }
      | {
          type: 'crowd-control-chaos-mode'
        }
      | {
          type: 'pulsoid-trigger'
          cooldown: number
          heartRate: number
          uuid: string
          triggerType: 'rise-above' | 'fall-below'
          targetHeartRate: number
          holdTime: number
        }
      | {
          name: string
          type: 'tiktok-gift'
          userID: string
          cost: number
          giftName: string
          giftID: number
          transactionID?: string
        }
      | {
          type: 'stream-labs-donation'
          name?: string
          message?: string
        }
    anonymous?: boolean
    game: {
      // GameRecord
      gamePackID: string // GamePackID
      platform:
        | 'GB'
        | 'GBA'
        | 'GCN'
        | 'GEN'
        | 'GG'
        | 'IOT'
        | 'N64'
        | 'NES'
        | 'Other'
        | 'PC'
        | 'PS1'
        | 'PS2'
        | 'SNES'
        | 'Wii'
        | 'WiiU' // GamePackPlatform
      name: string
      proExclusive?: boolean
      image?: string
    }
    gamePack: {
      // GamePackRecord
      gamePackID: string // GamePackID
      platform:
        | 'GB'
        | 'GBA'
        | 'GCN'
        | 'GEN'
        | 'GG'
        | 'IOT'
        | 'N64'
        | 'NES'
        | 'Other'
        | 'PC'
        | 'PS1'
        | 'PS2'
        | 'SNES'
        | 'Wii'
        | 'WiiU' // GamePackPlatform
      name: string
      proExclusive?: boolean
      image?: string
    }
    parameters?: {
      // EffectRequestParameters
      [x: string]: {
        value: string
        type: 'options' | 'hex-color'
        title: string
        name?: string
      }
    }
    pooled?: boolean
    quantity?: number
    requestID: string // GameSessionRequestID
    timestamp: number
    example?: boolean
    localTimestamp?: number
  }
}

type CCEvent =
  | DirectWhoAmIEvent
  | DirectLoginSuccessEvent
  | DirectSubscriptionResultEvent
  | PublicGameSessionStartEvent
  | PublicGameSessionStopEvent
  | PublicEffectRequestEvent

////////////////////
//// RPC  Calls ////
////////////////////

interface BaseArg {
  id: string
  stamp: number
}

interface BaseCall {
  type: 'call'
  id: string
}

interface BaseEffectResponseArg extends BaseArg {
  request: string
  message: string
  stamp: number
}

interface InstantEffectResponseArg extends BaseEffectResponseArg {
  status: 'success' | 'failTemporary' | 'failPermanent' | 'timedEnd'
}

interface TimedEffectResponseArg extends BaseEffectResponseArg {
  status: 'timedBegin' | 'timedPause' | 'timedResume'
  timeRemaining: number
}

type EffectResponseArg =
  | InstantEffectResponseArg
  | TimedEffectResponseArg

interface EffectResponseCall extends BaseCall {
  method: 'effectResponse'
  args: [EffectResponseArg]
}

interface EffectReportArg extends BaseArg {
  identifierType?: 'effect' | 'category' | 'group'
  ids: string[]
  status: 'menuVisible' | 'menuHidden' | 'menuUnavailable' | 'menuAvailable'
}

interface EffectReportCall extends BaseCall {
  method: 'effectReport'
  args: EffectReportArg[]
}

type RPCCall = EffectResponseCall | EffectReportCall

////////////////////
///// Requests /////
////////////////////

interface WhoAmIRequest {
  action: 'whoami'
}

interface SubscribeRequest {
  action: 'subscribe'
  data: {
    topics: string[]
  }
}

interface RPCRequest {
  action: 'rpc'
  data: {
    token: string,
    call: RPCCall,
  }
}

type CCRequest =
  | WhoAmIRequest
  | SubscribeRequest
  | RPCRequest
