import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '../app/(auth)/login/page';
import RegisterPage from '../app/(auth)/register/page';
import { apiClient } from '../lib/api-client';

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('../lib/api-client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    messages: string[];
    constructor(data: { message: string[] | string }) {
      const msg = Array.isArray(data.message) ? data.message.join(' ') : data.message;
      super(msg);
      this.messages = Array.isArray(data.message) ? data.message : [msg];
    }
  },
}));

describe('Auth Forms (WEB-01, WEB-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('WEB-01: Register form invalid inputs', () => {
    it('disables submit button and shows inline validation errors when fields are invalid', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      const submitButton = screen.getByRole('button', { name: /create account/i });
      expect(submitButton).toBeDisabled();

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);

      // Enter invalid email
      await user.type(emailInput, 'invalid-email');
      // Enter short password
      await user.type(passwordInput, '1234');

      await waitFor(() => {
        expect(screen.getByText(/invalid email address/i)).toBeInTheDocument();
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
      });

      expect(submitButton).toBeDisabled();
    });

    it('enables submit button and calls API when valid inputs are provided', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.post).mockResolvedValueOnce({ id: '123' });

      render(<RegisterPage />);

      const nameInput = screen.getByLabelText(/full name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await user.type(nameInput, 'Jane Doe');
      await user.type(emailInput, 'jane@example.com');
      await user.type(passwordInput, 'SuperSecret123');

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });

      await user.click(submitButton);

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/auth/register', {
          name: 'Jane Doe',
          email: 'jane@example.com',
          password: 'SuperSecret123',
        });
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });
  });

  describe('WEB-02: Login form success and failure', () => {
    it('redirects to /dashboard on successful login', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.post).mockResolvedValueOnce({ id: '123', email: 'test@example.com' });

      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
          email: 'test@example.com',
          password: 'password123',
        });
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('displays error alert on login failure', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.post).mockRejectedValueOnce(
        new Error('Invalid email or password. Please try again.'),
      );

      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'wrong@example.com');
      await user.type(passwordInput, 'wrongpass');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
      });
    });
  });
});
