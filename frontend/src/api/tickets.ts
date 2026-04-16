/**
 * tickets.urls — unified tickets, activities, comments.
 */
import { apiGet } from './client';
import type {
  Paginated,
  TicketActivity,
  TicketComment,
  UnifiedTicket,
} from './types';

export interface TicketFilters {
  status?: string;
  assignee?: string;
  type?: string;
  q?: string;
  page?: number;
  page_size?: number;
}

export const ticketsApi = {
  list: (filters?: TicketFilters) =>
    apiGet<Paginated<UnifiedTicket> | UnifiedTicket[]>('/tickets/', {
      params: filters,
    }),

  get: (id: string) => apiGet<UnifiedTicket>(`/tickets/${id}/`),

  activities: (ticketId: string) =>
    apiGet<Paginated<TicketActivity> | TicketActivity[]>(
      `/tickets/${ticketId}/activities/`
    ),

  comments: (ticketId: string) =>
    apiGet<Paginated<TicketComment> | TicketComment[]>(
      `/tickets/${ticketId}/comments/`
    ),
};
