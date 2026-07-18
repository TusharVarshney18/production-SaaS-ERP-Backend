# Agent Communication Architecture

## Overview

The AgentMessagingService provides a decoupled communication layer for inter-agent messaging. It supports direct messaging, broadcast, and publish/subscribe event patterns.

## Message Envelope

```typescript
interface AgentEnvelope {
  messageId: string;        // Unique message ID
  correlationId: string;    // Links request to response
  type: MessageType;        // request | response | broadcast | event | error
  priority: MessagePriority; // low | normal | high | critical
  sourceAgent: string;      // Sender agent name
  targetAgent?: string;     // Direct recipient
  targetAgents?: string[];  // Broadcast recipients
  timestamp: string;        // ISO timestamp
  ttl?: number;             // Time-to-live in ms
}
```

## Communication Patterns

### 1. Direct Send (Fire-and-Forget)
```
AgentA.send(message) → inbox of AgentB
```
Sender does not wait for a response.

### 2. Send and Wait (Request/Response)
```
AgentA.sendAndWait(message) → inbox of AgentB
AgentA waits for response with timeout
AgentB sends response → pending request resolved via correlationId
```
Timeout after 30s by default. Uses correlation ID matching.

### 3. Broadcast
```
AgentA.broadcast(message, [AgentB, AgentC, AgentD])
                 ↓           ↓           ↓
            inbox(B)     inbox(C)     inbox(D)
```
Message delivered to all specified agents.

### 4. Event-Driven (Pub/Sub)
```
AgentX.subscribe("data.ready", handler)
AgentY.publishEvent("data.ready", payload)
                  ↓
           All subscribers notified
```
Events are dispatched to all registered handlers. Handlers run concurrently via `Promise.allSettled`.

## Message Delivery

```
send(message)
  ├── Generate messageId (generateId('msg'))
  ├── Set correlationId
  ├── Store in target agent's inbox
  ├── If pending request exists by correlationId → resolve immediately
  └── If type is 'event' or 'broadcast' → dispatch to event handlers

acknowledge(messageId)
  └── Find and remove message from all inboxes by messageId
```

## Event System

```
publishEvent(event, payload)
  ├── Create event message envelope
  └── For each handler subscribed to this event:
        └── Call handler(message) asynchronously

subscribe(event, handler)
  └── Add handler to event's handler set

unsubscribe(event, handler)
  └── Remove handler from event's handler set
```

## Integration with Existing Systems

| Existing System | Integration |
|----------------|-------------|
| Conversation Memory | Agent messages can be persisted via ConversationManagerService |
| Session Memory | Temporary variables per session for agent state |
| Agent Registry | Agent names used as message targets |
| Multi-Agent Events | `MULTI_AGENT_EVENTS` constants for standardized event names |
