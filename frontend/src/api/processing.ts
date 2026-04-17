/**
 * processing.urls — LangGraph pipeline observability.
 */
import { apiGet } from './client';
import type { Paginated, ProcessingRun, ProcessingStep } from './types';

export const processingApi = {
  listRuns: (params?: Record<string, string | number | undefined>) =>
    apiGet<Paginated<ProcessingRun> | ProcessingRun[]>('/processing/runs/', {
      params,
    }),

  getRun: (id: string) => apiGet<ProcessingRun>(`/processing/runs/${id}/`),

  listSteps: (runId: string) =>
    apiGet<Paginated<ProcessingStep> | ProcessingStep[]>(
      `/processing/runs/${runId}/steps/`
    ),
};
