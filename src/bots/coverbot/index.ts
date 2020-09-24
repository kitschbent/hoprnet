import { getHOPRNodeAddressFromContent } from '../../utils/utils'
import Web3 from 'web3'
import { Bot } from '../bot'
import { IMessage } from '../../message/message'
import { TweetMessage, TweetState } from '../../lib/twitter/twitter'
//@TODO: Isolate these utilities to avoid importing the entire package
import { convertPubKeyFromB58String, u8aToHex } from '@hoprnet/hopr-utils'
import { Utils } from '@hoprnet/hopr-core-ethereum'
import { Networks, HOPR_CHANNELS } from '@hoprnet/hopr-core-ethereum/lib/ethereum/addresses'
import {
  COVERBOT_DEBUG_MODE,
  COVERBOT_CHAIN_PROVIDER,
  COVERBOT_VERIFICATION_CYCLE_IN_MS,
  COVERBOT_XDAI_THRESHOLD,
  HOPR_ENVIRONMENT,
} from '../../utils/env'
import db from './db'
import { BotCommands, NodeStates, ScoreRewards } from './state'
import { RELAY_VERIFICATION_CYCLE_IN_MS } from './constants'
import { BotResponses, NodeStateResponses } from './responses'
import { HoprNode } from './coverbot'
import debug from 'debug'
import Core from '../../lib/hopr/core'


const log = debug('hopr-chatbot:coverbot')
const error = debug('hopr-chatbot:coverbot:error')
const { fromWei } = Web3.utils

const scoreDbRef = db.ref(`/${HOPR_ENVIRONMENT}/score`)
const stateDbRef = db.ref(`/${HOPR_ENVIRONMENT}/state`)

export class Coverbot implements Bot {
  node: Core
  botName: string
  address: string
  timestamp: Date
  status: Map<string, NodeStates>
  tweets: Map<string, TweetMessage>
  twitterTimestamp: Date

  verifiedHoprNodes: Map<string, HoprNode>
  relayTimeouts: Map<string, NodeJS.Timeout>
  verificationTimeout: NodeJS.Timeout

  xdaiWeb3: Web3
  ethereumAddress: string
  chainId: number
  network: Networks
  loadedDb: boolean

  constructor(node: Core, address: string, timestamp: Date, twitterTimestamp: Date) {
    this.node = node
    this.address = address
    this.timestamp = timestamp
    this.status = new Map<string, NodeStates>()
    this.tweets = new Map<string, TweetMessage>()
    this.twitterTimestamp = twitterTimestamp
    this.botName = '💰 Coverbot'
    this.loadedDb = false

    log(`- constructor | ${this.botName} has been added`)
    log(`- constructor | ⛓ EVM Network: ${COVERBOT_CHAIN_PROVIDER}`)
    log(`- constructor | 📦 DB Environment: ${HOPR_ENVIRONMENT}`)
    log(`- constructor | 💸 Threshold: ${COVERBOT_XDAI_THRESHOLD}`)
    log(`- constructor | 🐛 Debug Mode: ${COVERBOT_DEBUG_MODE}`)
    log(`- constructor | 👀 Verification Cycle: ${COVERBOT_VERIFICATION_CYCLE_IN_MS}`)
    log(`- constructor | 🔍 Relaying Cycle: ${RELAY_VERIFICATION_CYCLE_IN_MS}`)

    this.ethereumAddress = null
    this.chainId = null
    this.network = null

    this.xdaiWeb3 = new Web3(new Web3.providers.HttpProvider(COVERBOT_CHAIN_PROVIDER))
    this.verificationTimeout = setInterval(this._verificationCycle.bind(this), COVERBOT_VERIFICATION_CYCLE_IN_MS)

    this.verifiedHoprNodes = new Map<string, HoprNode>()
    this.relayTimeouts = new Map<string, NodeJS.Timeout>()
    this.loadData()
  }

  private async _getEthereumAddressFromHOPRAddress(hoprAddress: string): Promise<string> {
    const pubkey = await convertPubKeyFromB58String(hoprAddress)
    const ethereumAddress = u8aToHex(await Utils.pubKeyToAccountId(pubkey.marshal()))
    return ethereumAddress
  }

  private async _getEthereumAddressScore(ethereumAddress: string): Promise<number> {
    return new Promise((resolve, reject) => {
      scoreDbRef.child(ethereumAddress).once('value', (snapshot, error) => {
        if (error) return reject(error)
        return resolve(snapshot.val() || 0)
      })
    })
  }

  private async _setEthereumAddressScore(ethereumAddress: string, score: number): Promise<void> {
    return new Promise((resolve, reject) => {
      scoreDbRef.child(ethereumAddress).setWithPriority(score, -score, (error) => {
        if (error) return reject(error)
        return resolve()
      })
    })
  }

  private async loadData(): Promise<void> {
    return new Promise((resolve, reject) => {
      stateDbRef.once('value', (snapshot, error) => {
        if (error) return reject(error)
        if (!snapshot.exists()) {
          console.log("DB doesn't exist")
          return resolve()
        }
        const state = snapshot.val()
        if (!state.connected) {
          console.log('No connected')
          return resolve()
        }
        this.verifiedHoprNodes = new Map<string, HoprNode>()
        state.connected.forEach((n) => this.verifiedHoprNodes.set(n.id, n))
        this.loadedDb = true
        return resolve()
      })
    })
  }

  protected async dumpData() {
    //@TODO: Ideally we move this to a more suitable place.
    if (!this.ethereumAddress) {
      this.chainId = await Utils.getChainId(this.xdaiWeb3)
      this.network = Utils.getNetworkName(this.chainId) as Networks
      this.ethereumAddress = await this._getEthereumAddressFromHOPRAddress(this.address)
    }

    const connectedNodes = this.node.listConnectedPeers()

    const state = {
      connectedNodes,
      env: {
        COVERBOT_CHAIN_PROVIDER,
        COVERBOT_DEBUG_MODE,
        COVERBOT_VERIFICATION_CYCLE_IN_MS,
        COVERBOT_XDAI_THRESHOLD,
      },
      hoprCoverbotAddress: await this._getEthereumAddressFromHOPRAddress(this.address),
      hoprChannelContract: HOPR_CHANNELS[this.network],
      address: this.address,
      balance: fromWei(await this.xdaiWeb3.eth.getBalance(this.ethereumAddress)),
      available: fromWei(await this.node.getHoprBalance()),
      locked: 0, //@TODO: Retrieve balances from open channels.
      connected: Array.from(this.verifiedHoprNodes.values()),
      refreshed: new Date().toISOString(),
    }

    return new Promise((resolve, reject) => {
      stateDbRef.set(state, (error) => {
        if (error) return reject(error)
        console.log(`Saved data in our Database at ${state.refreshed}`)
        return resolve()
      })
    })
  }

  protected _sendMessageFromBot(recipient, message) {
    return this.node.send({
        peerId: recipient,
        payload: message
    })
  }

  protected async _sendMessageOpeningChannels(recipient, message, intermediatePeerIds) {
    return this.node.send({
        peerId: recipient,
        payload: message,
        intermediatePeerIds
    })
  }

  protected async _verificationCycle() {
    if (!this.loadedDb) {
      await this.loadData()
    }

    console.log(`${COVERBOT_VERIFICATION_CYCLE_IN_MS}ms has passed. Verifying nodes...`)

    await this.dumpData()

    const _verifiedNodes = Array.from(this.verifiedHoprNodes.values())
    const randomIndex = Math.floor(Math.random() * _verifiedNodes.length)
    const hoprNode: HoprNode = _verifiedNodes[randomIndex]

    if (!hoprNode) {
      console.log('No node found. Skipping...')
      return
    }

    if (this.relayTimeouts.get(hoprNode.id)) {
      console.log('Node selected is going through relaying. Skipping...')
      return
    }

    try {
      const tweet = new TweetMessage(hoprNode.tweetUrl)
      await tweet.fetch({ mock: COVERBOT_DEBUG_MODE })
      const _hoprNodeAddress = tweet.getHOPRNode()

      if (_hoprNodeAddress.length === 0) {
        // We got no HOPR Node here. Remove and update.
        this.verifiedHoprNodes.delete(hoprNode.id)
        await this.dumpData()
      } else {
        this._sendMessageFromBot(_hoprNodeAddress, BotResponses[BotCommands.verify])
        .catch(err => {
          console.log(`Trying to reach ${_hoprNodeAddress} failed.`)
          throw new Error(err)
        })
        /*
         * We switched from “send and forget” to “send and listen”
         * 1. We inmediately send a message to user, telling them we find them online.
         * 2. We use them as a relayer, expecting to get our message later.
         * 3. We save a timeout, to fail the node if the relayed package doesnt come back.
         * 4. We wait RELAY_VERIFICATION_CYCLE_IN_MS seconds for the relay to get back.
         *    4.1 If we don't get the message back before RELAY_VERIFICATION_CYCLE_IN_MS,
         *        then we remove the node from the verification table and redump data.
         *    4.2 If we DO get the message back, then we go and execute the payout function.
         */

        // 1.
        console.log(`Relaying node ${_hoprNodeAddress}, checking in ${RELAY_VERIFICATION_CYCLE_IN_MS}`)
        this._sendMessageFromBot(_hoprNodeAddress, NodeStateResponses[NodeStates.onlineNode])

        // 2.
        this._sendMessageOpeningChannels(this.address, ` Packet relayed by ${_hoprNodeAddress}`, [_hoprNodeAddress])

        // 3.
        this.relayTimeouts.set(
          _hoprNodeAddress,
          setTimeout(() => {
            // 4.1
            /*
             * The timeout passed, and we didn‘t get the message back.
             * 4.1.1 Internally log that this is the case.
             * 4.1.2 Let the node that we couldn't get our response back in time.
             * 4.1.3 Remove from timeout so they can try again somehow.
             * NB: DELETED BY PB AFTER CHAT 10/9 [4.1.4 Remove from our verified node and write to the database]
             */

            // 4.1.1
            console.log(`No response from ${_hoprNodeAddress}.`) // Removing as valid node.`)

            // 4.1.2
            this._sendMessageFromBot(_hoprNodeAddress, NodeStateResponses[NodeStates.relayingNodeFailed])

            // 4.1.3
            this.relayTimeouts.delete(_hoprNodeAddress)

            // 4.1.4
            //this.verifiedHoprNodes.delete(_hoprNodeAddress)
            //this.dumpData()
          }, RELAY_VERIFICATION_CYCLE_IN_MS),
        )
      }
    } catch (err) {
      console.log('[ _verificationCycle ] Error caught - ', err)

      // Something failed. We better remove node and update.
      // @TODO: Clean this up, removed for now to ask users to try again.
      // this.verifiedHoprNodes.delete(hoprNode.id)
      // this.dumpData()
    }
  }

  protected async _verifyBalance(message: IMessage): Promise<[number, NodeStates]> {
    const pubkey = await convertPubKeyFromB58String(message.from)
    const nodeEthereumAddress = u8aToHex(await Utils.pubKeyToAccountId(pubkey.marshal()))
    const weiBalance = await this.xdaiWeb3.eth.getBalance(nodeEthereumAddress)
    const balance = +Web3.utils.fromWei(weiBalance)

    return balance >= COVERBOT_XDAI_THRESHOLD
      ? [balance, NodeStates.xdaiBalanceSucceeded]
      : [balance, NodeStates.xdaiBalanceFailed]
  }

  protected async _verifyTweet(message: IMessage): Promise<[TweetMessage, NodeStates]> {
    //@TODO: Catch error here.
    const tweet = new TweetMessage(message.text)
    this.tweets.set(message.from, tweet)

    await tweet.fetch({ mock: COVERBOT_DEBUG_MODE })

    if (tweet.hasTag('hoprnetwork')) {
      tweet.status.hasTag = true
    }
    if (tweet.hasMention('hoprnet')) {
      tweet.status.hasMention = true
    }
    if (tweet.hasSameHOPRNode(message.from) || COVERBOT_DEBUG_MODE) {
      tweet.status.sameNode = true
    }
    return tweet.status.isValid()
      ? [tweet, NodeStates.tweetVerificationSucceeded]
      : [tweet, NodeStates.tweetVerificationFailed]
  }

  async handleMessage(message: IMessage) {
    console.log(`${this.botName} <- ${message.from}: ${message.text}`)

    if (message.from === this.address) {
      /*
       * We have done a succeful round trip!
       * 1. Lets avoid sending more messages to eternally loop
       *    messages across the network by returning within this if.
       * 2. Let's notify the user about the successful relay.
       * 3. Let's recover the timeout from our relayerTimeout
       *    and clear it before it removes the node.
       * 4. Let's pay the good node some sweet xHOPR for being alive
       *    and relaying messages successfully.
       */
      const relayerAddress = getHOPRNodeAddressFromContent(message.text)

      // 2.
      console.log(`Successful Relay: ${relayerAddress}`)
      this._sendMessageFromBot(relayerAddress, NodeStateResponses[NodeStates.relayingNodeSucceded])

      // 3.
      const relayerTimeout = this.relayTimeouts.get(relayerAddress)
      clearTimeout(relayerTimeout)
      this.relayTimeouts.delete(relayerAddress)

      // 4.
      const relayerEthereumAddress = await this._getEthereumAddressFromHOPRAddress(relayerAddress)
      const score = await this._getEthereumAddressScore(relayerEthereumAddress)
      const newScore = score + ScoreRewards.relayed

      await Promise.all([
        this._setEthereumAddressScore(relayerEthereumAddress, newScore),
        // @TODO: Actually send tokens.
        // sendXHOPR(relayerEthereumAddress, RELAY_HOPR_REWARD),
      ])
      console.log(`xHOPR tokens sent to ${relayerAddress}`)
      this._sendMessageFromBot(relayerAddress, NodeStateResponses[NodeStates.verifiedNode])

      // 1.
      return
    }

    if (this.relayTimeouts.get(message.from)) {
      /*
       * There‘s a particular case where someone can send us a message while
       * we are trying to relay them a package. We'll skip the entire process
       * if this is the case, as the timeout will clear them out.
       *
       * 1. Detect if we have someone waiting for timeout (this if).
       * 2. If so, then quickly return them a message telling we are waiting.
       * 3. Return as to avoid going through the entire process again.
       *
       */

      // 2.
      this._sendMessageFromBot(message.from, NodeStateResponses[NodeStates.relayingNodeInProgress])

      // 3.
      return
    }

    let tweet, nodeState
    if (message.text.match(/https:\/\/twitter.com.*?$/i)) {
      this._sendMessageFromBot(message.from, NodeStateResponses[NodeStates.tweetVerificationInProgress])
      ;[tweet, nodeState] = await this._verifyTweet(message)
    } else {
      ;[tweet, nodeState] = [undefined, NodeStates.newUnverifiedNode]
    }

    switch (nodeState) {
      case NodeStates.newUnverifiedNode:
        this._sendMessageFromBot(message.from, NodeStateResponses[nodeState])
        break
      case NodeStates.tweetVerificationFailed:
        this._sendMessageFromBot(message.from, NodeStateResponses[nodeState](this.tweets.get(message.from).status))
        break
      case NodeStates.tweetVerificationSucceeded:
        this._sendMessageFromBot(message.from, NodeStateResponses[nodeState])
        const [balance, xDaiBalanceNodeState] = await this._verifyBalance(message)
        switch (xDaiBalanceNodeState) {
          case NodeStates.xdaiBalanceFailed:
            this._sendMessageFromBot(message.from, NodeStateResponses[xDaiBalanceNodeState](balance))
            break
          case NodeStates.xdaiBalanceSucceeded: {
            const ethAddress = await this._getEthereumAddressFromHOPRAddress(message.from)

            this.verifiedHoprNodes.set(message.from, {
              id: message.from,
              tweetId: tweet.id,
              tweetUrl: tweet.url,
              address: ethAddress,
            })

            const score = await this._getEthereumAddressScore(ethAddress)
            if (score === 0) {
              await this._setEthereumAddressScore(ethAddress, ScoreRewards.verified)
            }

            this._sendMessageFromBot(message.from, NodeStateResponses[xDaiBalanceNodeState](balance))
            break
          }
        }
        this._sendMessageFromBot(message.from, BotResponses[BotCommands.status](xDaiBalanceNodeState))
        break
    }
    this._sendMessageFromBot(message.from, BotResponses[BotCommands.status](nodeState))
  }
}
