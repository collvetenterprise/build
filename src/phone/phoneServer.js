const dgram = require('dgram')
const EventEmitter = require('events')
const logger = require('../utils/logger')
const config = require('config')

class PhoneServer extends EventEmitter {
  constructor (aiEngine) {
    super()
    this.aiEngine = aiEngine
    this.sipPort = config.get('phone.sipPort') || 5060
    this.rtpPort = config.get('phone.rtpPort') || 10000
    this.sipServer = null
    this.rtpServer = null
    this.activeCalls = new Map()
    this.registeredClients = new Map()
    this.callStats = {
      total: 0,
      active: 0,
      completed: 0,
      failed: 0
    }
    this.isRunning = false
  }

  async initialize () {
    try {
      logger.info('Initializing Phone Server...')

      // Start SIP server
      await this.startSIPServer()

      // Start RTP server
      await this.startRTPServer()

      // Setup AI-powered call monitoring
      this.setupCallMonitoring()

      this.isRunning = true
      logger.info(`Phone Server initialized on SIP port ${this.sipPort}, RTP port ${this.rtpPort}`)
    } catch (error) {
      logger.error('Failed to initialize Phone Server:', error)
      throw error
    }
  }

  async startSIPServer () {
    return new Promise((resolve, reject) => {
      this.sipServer = dgram.createSocket('udp4')

      this.sipServer.on('message', (message, remote) => {
        this.handleSIPMessage(message, remote)
      })

      this.sipServer.on('error', (error) => {
        logger.error('SIP Server error:', error)
        reject(error)
      })

      this.sipServer.bind(this.sipPort, () => {
        logger.info(`SIP Server listening on port ${this.sipPort}`)
        resolve()
      })
    })
  }

  async startRTPServer () {
    return new Promise((resolve, reject) => {
      this.rtpServer = dgram.createSocket('udp4')

      this.rtpServer.on('message', (message, remote) => {
        this.handleRTPMessage(message, remote)
      })

      this.rtpServer.on('error', (error) => {
        logger.error('RTP Server error:', error)
        reject(error)
      })

      this.rtpServer.bind(this.rtpPort, () => {
        logger.info(`RTP Server listening on port ${this.rtpPort}`)
        resolve()
      })
    })
  }

  handleSIPMessage (message, remote) {
    try {
      const sipMessage = this.parseSIPMessage(message.toString())
      logger.debug(`SIP message from ${remote.address}:${remote.port}`, sipMessage.method)

      switch (sipMessage.method) {
        case 'REGISTER':
          this.handleRegister(sipMessage, remote)
          break
        case 'INVITE':
          this.handleInvite(sipMessage, remote)
          break
        case 'ACK':
          this.handleAck(sipMessage, remote)
          break
        case 'BYE':
          this.handleBye(sipMessage, remote)
          break
        case 'CANCEL':
          this.handleCancel(sipMessage, remote)
          break
        default:
          logger.warn(`Unsupported SIP method: ${sipMessage.method}`)
      }
    } catch (error) {
      logger.error('Error handling SIP message:', error)
    }
  }

  handleRTPMessage (message, remote) {
    // Handle RTP audio/video data
    const callId = this.findCallByEndpoint(remote)
    if (callId) {
      const call = this.activeCalls.get(callId)
      if (call) {
        // Update call statistics
        call.rtpPackets = (call.rtpPackets || 0) + 1
        call.lastRtpTime = Date.now()

        // AI-powered quality analysis
        this.analyzeCallQuality(callId, message, remote)

        // Forward RTP packet to destination
        this.forwardRTPPacket(message, call)
      }
    }
  }

  handleRegister (sipMessage, remote) {
    const userAgent = sipMessage.headers['user-agent'] || 'Unknown'
    const contact = sipMessage.headers.contact || `${remote.address}:${remote.port}`
    const expires = parseInt(sipMessage.headers.expires || '3600')

    // Register the client
    const clientId = this.extractClientId(sipMessage)
    this.registeredClients.set(clientId, {
      contact,
      userAgent,
      registeredAt: new Date(),
      expires,
      remote
    })

    // Send 200 OK response
    this.sendSIPResponse(200, 'OK', sipMessage, remote)

    logger.info(`Client registered: ${clientId} from ${remote.address}`)
  }

  async handleInvite (sipMessage, remote) {
    const callId = sipMessage.headers['call-id']
    const from = sipMessage.headers.from
    const to = sipMessage.headers.to

    // AI-powered call routing
    const routingDecision = this.aiEngine.optimizeCallRouting({
      from: this.extractPhoneNumber(from),
      to: this.extractPhoneNumber(to),
      systemLoad: this.getCurrentSystemLoad(),
      type: 'voice',
      priority: 'normal'
    })

    // Fraud detection
    const fraudAnalysis = this.aiEngine.detectFraud({
      from: this.extractPhoneNumber(from),
      to: this.extractPhoneNumber(to),
      location: remote.address,
      estimatedCost: this.estimateCallCost(from, to)
    })

    if (fraudAnalysis.isFraudulent) {
      logger.warn(`Fraudulent call detected: ${callId}`, fraudAnalysis)
      this.sendSIPResponse(403, 'Forbidden - Fraud Detected', sipMessage, remote)
      return
    }

    // Create call record
    const call = {
      id: callId,
      from: this.extractPhoneNumber(from),
      to: this.extractPhoneNumber(to),
      startTime: new Date(),
      status: 'ringing',
      remote,
      routingDecision,
      fraudScore: fraudAnalysis.riskScore,
      rtpPackets: 0,
      quality: {
        jitter: 0,
        latency: 0,
        packetLoss: 0,
        mos: 0
      }
    }

    this.activeCalls.set(callId, call)
    this.callStats.total++
    this.callStats.active++

    // Send 100 Trying
    this.sendSIPResponse(100, 'Trying', sipMessage, remote)

    // Ring the destination (simplified)
    setTimeout(() => {
      this.sendSIPResponse(180, 'Ringing', sipMessage, remote)
    }, 100)

    // Accept call after delay (simplified auto-answer)
    setTimeout(() => {
      call.status = 'answered'
      call.answerTime = new Date()
      this.sendSIPResponse(200, 'OK', sipMessage, remote, {
        'Content-Type': 'application/sdp',
        'Content-Length': '200'
      })

      logger.info(`Call answered: ${callId} (${call.from} -> ${call.to})`)
    }, 2000)
  }

  handleAck (sipMessage, _remote) {
    const callId = sipMessage.headers['call-id']
    const call = this.activeCalls.get(callId)

    if (call) {
      call.status = 'established'
      call.establishedTime = new Date()
      logger.info(`Call established: ${callId}`)
    }
  }

  handleBye (sipMessage, remote) {
    const callId = sipMessage.headers['call-id']
    const call = this.activeCalls.get(callId)

    if (call) {
      call.status = 'ended'
      call.endTime = new Date()
      call.duration = call.endTime - call.startTime

      // Send 200 OK
      this.sendSIPResponse(200, 'OK', sipMessage, remote)

      // Update statistics
      this.callStats.active--
      this.callStats.completed++

      // Store call record for analytics
      this.storeCallRecord(call)

      // Remove from active calls
      this.activeCalls.delete(callId)

      logger.info(`Call ended: ${callId} (duration: ${call.duration}ms)`)
    }
  }

  handleCancel (sipMessage, remote) {
    const callId = sipMessage.headers['call-id']
    const call = this.activeCalls.get(callId)

    if (call) {
      call.status = 'cancelled'
      call.endTime = new Date()

      this.sendSIPResponse(200, 'OK', sipMessage, remote)

      this.callStats.active--
      this.callStats.failed++

      this.activeCalls.delete(callId)

      logger.info(`Call cancelled: ${callId}`)
    }
  }

  analyzeCallQuality (callId, rtpPacket, _remote) {
    const call = this.activeCalls.get(callId)
    if (!call) return

    // Extract RTP header information
    const rtpHeader = this.parseRTPHeader(rtpPacket)

    // Calculate quality metrics
    const now = Date.now()
    const timeDiff = now - (call.lastRtpTime || now)

    // Update jitter calculation
    if (call.lastTimeDiff) {
      const jitter = Math.abs(timeDiff - call.lastTimeDiff)
      call.quality.jitter = (call.quality.jitter * 0.9) + (jitter * 0.1)
    }
    call.lastTimeDiff = timeDiff

    // Calculate packet loss
    if (call.lastSequence) {
      const expectedSeq = (call.lastSequence + 1) % 65536
      if (rtpHeader.sequence !== expectedSeq) {
        call.quality.packetLoss += 1
      }
    }
    call.lastSequence = rtpHeader.sequence

    // Estimate MOS (Mean Opinion Score)
    call.quality.mos = this.calculateMOS(call.quality)

    // Use AI to optimize quality
    if (call.rtpPackets % 100 === 0) { // Every 100 packets
      const optimization = this.aiEngine.optimizeQuality({
        jitter: call.quality.jitter,
        latency: call.quality.latency,
        packetLoss: call.quality.packetLoss / call.rtpPackets,
        mos: call.quality.mos,
        codec: 'G.711',
        bandwidth: 64000
      })

      // Apply optimization recommendations
      this.applyQualityOptimization(callId, optimization)
    }
  }

  calculateMOS (quality) {
    // Simplified MOS calculation
    let mos = 4.5

    if (quality.jitter > 40) mos -= 0.5
    if (quality.latency > 150) mos -= 0.3
    if (quality.packetLoss > 0.01) mos -= 0.7

    return Math.max(1.0, Math.min(5.0, mos))
  }

  setupCallMonitoring () {
    // Monitor call quality every 30 seconds
    setInterval(() => {
      this.activeCalls.forEach((call, callId) => {
        if (call.quality.mos < 3.0) {
          logger.warn(`Poor call quality detected: ${callId} (MOS: ${call.quality.mos})`)
          this.emit('qualityAlert', { callId, quality: call.quality })
        }
      })
    }, 30000)
  }

  // Utility methods
  parseSIPMessage (message) {
    const lines = message.split('\r\n')
    const firstLine = lines[0].split(' ')
    const headers = {}

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      const colonIndex = line.indexOf(':')
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).toLowerCase()
        const value = line.substring(colonIndex + 1).trim()
        headers[key] = value
      }
    }

    return {
      method: firstLine[0],
      uri: firstLine[1],
      version: firstLine[2],
      headers
    }
  }

  parseRTPHeader (packet) {
    // Simplified RTP header parsing
    const header = packet.readUInt32BE(0)
    return {
      version: (header >> 30) & 0x3,
      padding: (header >> 29) & 0x1,
      extension: (header >> 28) & 0x1,
      sequence: packet.readUInt16BE(2),
      timestamp: packet.readUInt32BE(4),
      ssrc: packet.readUInt32BE(8)
    }
  }

  sendSIPResponse (code, reason, originalMessage, remote, additionalHeaders = {}) {
    const response = this.buildSIPResponse(code, reason, originalMessage, additionalHeaders)
    this.sipServer.send(response, remote.port, remote.address)
  }

  buildSIPResponse (code, reason, originalMessage, additionalHeaders = {}) {
    const headers = {
      Via: originalMessage.headers.via,
      From: originalMessage.headers.from,
      To: originalMessage.headers.to,
      'Call-ID': originalMessage.headers['call-id'],
      CSeq: originalMessage.headers.cseq,
      'Content-Length': '0',
      ...additionalHeaders
    }

    let response = `SIP/2.0 ${code} ${reason}\r\n`
    for (const [key, value] of Object.entries(headers)) {
      response += `${key}: ${value}\r\n`
    }
    response += '\r\n'

    return Buffer.from(response)
  }

  extractClientId (sipMessage) {
    const from = sipMessage.headers.from
    const match = from.match(/<sip:([^@]+)@/)
    return match ? match[1] : 'unknown'
  }

  extractPhoneNumber (sipHeader) {
    const match = sipHeader.match(/<sip:([^@]+)@/)
    return match ? match[1] : 'unknown'
  }

  getCurrentSystemLoad () {
    return this.activeCalls.size / 100 // Simplified load calculation
  }

  estimateCallCost (_from, _to) {
    // Simplified cost estimation
    return Math.random() * 10
  }

  findCallByEndpoint (remote) {
    for (const [callId, call] of this.activeCalls) {
      if (call.remote.address === remote.address) {
        return callId
      }
    }
    return null
  }

  forwardRTPPacket (_packet, _call) {
    // Simplified RTP forwarding
    // In a real implementation, this would forward to the other party
  }

  applyQualityOptimization (callId, optimization) {
    logger.info(`Applying quality optimization for call ${callId}:`, optimization)
    // Implementation would apply codec changes, buffer adjustments, etc.
  }

  storeCallRecord (call) {
    // Store call record for analytics and billing
    logger.info('Storing call record:', {
      id: call.id,
      from: call.from,
      to: call.to,
      duration: call.duration,
      quality: call.quality
    })
  }

  getStats () {
    return {
      ...this.callStats,
      registeredClients: this.registeredClients.size,
      activeCalls: this.activeCalls.size
    }
  }

  isHealthy () {
    return this.isRunning && this.sipServer && this.rtpServer
  }

  async shutdown () {
    logger.info('Shutting down Phone Server...')

    if (this.sipServer) {
      this.sipServer.close()
    }

    if (this.rtpServer) {
      this.rtpServer.close()
    }

    this.activeCalls.clear()
    this.registeredClients.clear()
    this.isRunning = false
  }
}

module.exports = PhoneServer
