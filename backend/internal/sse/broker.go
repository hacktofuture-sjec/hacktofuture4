// Package sse provides a fan-out SSE event broker for streaming agent logs.
// Each incident gets its own channel. Multiple frontend clients can subscribe
// to the same incident by holding separate channels added to the same key.
package sse

import (
	"encoding/json"
	"sync"
)

// Event is the payload sent over the SSE wire.
type Event struct {
	Type string `json:"type"` // agent_log | status | done
	Data any    `json:"data"`
}

// Broker manages per-incident subscriber channels.
type Broker struct {
	mu      sync.RWMutex
	clients map[string][]chan Event
}

// NewBroker constructs a ready-to-use Broker.
func NewBroker() *Broker {
	return &Broker{
		clients: make(map[string][]chan Event),
	}
}

// Subscribe returns a channel that will receive events for the given incidentID.
// The channel is buffered; slow consumers silently drop events.
func (b *Broker) Subscribe(incidentID string) chan Event {
	ch := make(chan Event, 128)
	b.mu.Lock()
	b.clients[incidentID] = append(b.clients[incidentID], ch)
	b.mu.Unlock()
	return ch
}

// Unsubscribe removes a channel from the subscriber list and closes it.
func (b *Broker) Unsubscribe(incidentID string, ch chan Event) {
	b.mu.Lock()
	defer b.mu.Unlock()

	list := b.clients[incidentID]
	newList := list[:0]
	for _, c := range list {
		if c != ch {
			newList = append(newList, c)
		}
	}
	if len(newList) == 0 {
		delete(b.clients, incidentID)
	} else {
		b.clients[incidentID] = newList
	}
	close(ch)
}

// Publish sends an event to all subscribers of incidentID.
// Non-blocking: if a subscriber's buffer is full the event is dropped for that client.
func (b *Broker) Publish(incidentID string, ev Event) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	for _, ch := range b.clients[incidentID] {
		select {
		case ch <- ev:
		default:
		}
	}
}

// PublishDone signals that the pipeline for incidentID is complete.
// After this call, callers should drain and unsubscribe all channels.
func (b *Broker) PublishDone(incidentID string) {
	b.Publish(incidentID, Event{Type: "done", Data: map[string]string{}})
}

// SubscriberCount returns the number of active subscribers for debugging.
func (b *Broker) SubscriberCount(incidentID string) int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.clients[incidentID])
}

// Marshal returns the JSON-encoded SSE data line for an event.
func (e Event) Marshal() ([]byte, error) {
	return json.Marshal(e)
}
