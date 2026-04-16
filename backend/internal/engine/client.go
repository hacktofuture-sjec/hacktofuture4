// Package engine provides an HTTP client for communicating with the Python
// rekall_engine microservice.
package engine

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client talks to the Python engine service.
type Client struct {
	baseURL    string
	httpClient *http.Client
}

// NewClient constructs a Client pointing at the given engine service URL.
func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

// PipelineRequest is sent to POST /pipeline/run.
type PipelineRequest struct {
	IncidentID string         `json:"incident_id"`
	Payload    map[string]any `json:"payload"`
}

// PipelineResponse is returned by the engine service.
type PipelineResponse struct {
	OK      bool   `json:"ok"`
	Message string `json:"message,omitempty"`
}

// LearnRequest is sent to POST /pipeline/learn.
type LearnRequest struct {
	IncidentID    string  `json:"incident_id"`
	FixProposalID string  `json:"fix_proposal_id"`
	Result        string  `json:"result"` // success | failure | rejected
	ReviewedBy    string  `json:"reviewed_by,omitempty"`
	Notes         *string `json:"notes,omitempty"`
	FixTier       string  `json:"fix_tier,omitempty"`       // T1_human | T2_synthetic | T3_llm
	VaultEntryID  string  `json:"vault_entry_id,omitempty"` // vault entry that was used
}

// RunPipeline instructs the engine to begin processing an incident.
// This call returns immediately; the engine executes asynchronously and
// reports progress by posting agent-log events back to the callback URL.
func (c *Client) RunPipeline(ctx context.Context, req PipelineRequest) (*PipelineResponse, error) {
	return c.post(ctx, "/pipeline/run", req)
}

// Learn submits an outcome so the engine can update vault confidence.
func (c *Client) Learn(ctx context.Context, req LearnRequest) (*PipelineResponse, error) {
	return c.post(ctx, "/pipeline/learn", req)
}

// Healthy returns true if the engine service responds to its health endpoint.
func (c *Client) Healthy(ctx context.Context) bool {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/health", nil)
	if err != nil {
		return false
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

func (c *Client) post(ctx context.Context, path string, body any) (*PipelineResponse, error) {
	b, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(b))
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("engine returned %d: %s", resp.StatusCode, string(raw))
	}

	var pr PipelineResponse
	if err := json.Unmarshal(raw, &pr); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}
	return &pr, nil
}
