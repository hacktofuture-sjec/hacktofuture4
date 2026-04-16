package sse_test

import (
	"testing"
	"time"

	"github.com/rekall/backend/internal/sse"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBroker_SubscribeReceivesPublishedEvents(t *testing.T) {
	b := sse.NewBroker()
	const incidentID = "incident-001"

	ch := b.Subscribe(incidentID)
	defer b.Unsubscribe(incidentID, ch)

	ev := sse.Event{Type: "agent_log", Data: map[string]string{"step": "monitor"}}
	b.Publish(incidentID, ev)

	select {
	case got := <-ch:
		assert.Equal(t, "agent_log", got.Type)
	case <-time.After(100 * time.Millisecond):
		t.Fatal("timed out waiting for event")
	}
}

func TestBroker_MultipleSubscribersReceiveSameEvent(t *testing.T) {
	b := sse.NewBroker()
	const incidentID = "incident-002"

	ch1 := b.Subscribe(incidentID)
	ch2 := b.Subscribe(incidentID)
	defer b.Unsubscribe(incidentID, ch1)
	defer b.Unsubscribe(incidentID, ch2)

	b.Publish(incidentID, sse.Event{Type: "status", Data: "ok"})

	for _, ch := range []chan sse.Event{ch1, ch2} {
		select {
		case got := <-ch:
			assert.Equal(t, "status", got.Type)
		case <-time.After(100 * time.Millisecond):
			t.Fatal("subscriber did not receive event")
		}
	}
}

func TestBroker_UnsubscribeRemovesChannel(t *testing.T) {
	b := sse.NewBroker()
	const incidentID = "incident-003"

	ch := b.Subscribe(incidentID)
	assert.Equal(t, 1, b.SubscriberCount(incidentID))

	b.Unsubscribe(incidentID, ch)
	assert.Equal(t, 0, b.SubscriberCount(incidentID))
}

func TestBroker_DifferentIncidentsAreIsolated(t *testing.T) {
	b := sse.NewBroker()

	ch1 := b.Subscribe("inc-A")
	ch2 := b.Subscribe("inc-B")
	defer b.Unsubscribe("inc-A", ch1)
	defer b.Unsubscribe("inc-B", ch2)

	b.Publish("inc-A", sse.Event{Type: "agent_log", Data: "A"})

	select {
	case <-ch1:
		// correct: ch1 received inc-A's event
	case <-time.After(100 * time.Millisecond):
		t.Fatal("ch1 did not receive event for inc-A")
	}

	select {
	case ev := <-ch2:
		t.Fatalf("ch2 unexpectedly received event: %v", ev)
	case <-time.After(50 * time.Millisecond):
		// correct: ch2 received nothing
	}
}

func TestBroker_PublishDoneSentinel(t *testing.T) {
	b := sse.NewBroker()
	ch := b.Subscribe("inc-done")
	defer b.Unsubscribe("inc-done", ch)

	b.PublishDone("inc-done")

	select {
	case got := <-ch:
		assert.Equal(t, "done", got.Type)
	case <-time.After(100 * time.Millisecond):
		t.Fatal("did not receive done event")
	}
}

func TestEvent_Marshal(t *testing.T) {
	ev := sse.Event{Type: "agent_log", Data: map[string]string{"step": "fix"}}
	b, err := ev.Marshal()
	require.NoError(t, err)
	assert.Contains(t, string(b), "agent_log")
}
