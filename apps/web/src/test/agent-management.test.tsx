import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentLanguage, AgentDto } from '@voice-ai/shared';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from '../app/dashboard/page';
import { AgentCard } from '../components/agents/agent-card';
import { DeleteAgentDialog } from '../components/agents/delete-agent-dialog';
import { apiClient } from '../lib/api-client';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('../lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Agent Management (WEB-04, WEB-06, WEB-14)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('WEB-04: Empty state when no agents exist', () => {
    it('displays "No agents yet" and "Create your first agent" link', async () => {
      vi.mocked(apiClient.get).mockImplementation((path: string) => {
        if (path.includes('/auth/me')) {
          return Promise.resolve({ id: '1', email: 'test@example.com', name: 'Test User' });
        }
        if (path.includes('/agents')) {
          return Promise.resolve({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 });
        }
        return Promise.resolve([]);
      });

      renderWithClient(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/no agents yet/i)).toBeInTheDocument();
        expect(screen.getByText(/create your first agent/i)).toBeInTheDocument();
      });
    });
  });

  describe('WEB-06: Delete agent confirmation dialog', () => {
    it('opens confirmation modal and triggers delete on confirm', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();
      const mockOnConfirm = vi.fn();

      // HTMLDialogElement showModal polyfill for JSDOM
      HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
        this.open = true;
      });
      HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
        this.open = false;
      });

      render(
        <DeleteAgentDialog
          isOpen={true}
          agentName="Sales Assistant"
          isDeleting={false}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(screen.getByRole('heading', { name: /delete agent/i })).toBeInTheDocument();
      expect(screen.getByText(/sales assistant/i)).toBeInTheDocument();

      const confirmButton = screen.getByRole('button', { name: /^delete agent$/i });
      await user.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('WEB-14: XSS payload prevention in agent name', () => {
    it('renders malicious HTML tags as safe plain text and does not execute script', () => {
      const xssName = '<img src=x onerror=alert(1)>';
      const mockAgent: AgentDto = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '11111111-1111-1111-1111-111111111111',
        name: xssName,
        systemPrompt: 'Harmless prompt',
        greeting: 'Hello',
        voice: 'af_heart',
        language: AgentLanguage.EN,
        llmModel: 'meta/llama-3.1-8b-instruct',
        temperature: 0.6,
        maxCallDurationSec: 600,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { container } = render(<AgentCard agent={mockAgent} onDelete={vi.fn()} />);

      // Verify that no img tag was created in DOM
      expect(container.querySelector('img')).toBeNull();
      // Verify that the string literal is present as text
      expect(screen.getByText(xssName)).toBeInTheDocument();
    });
  });
});
