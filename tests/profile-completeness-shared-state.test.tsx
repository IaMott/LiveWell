import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { type ReactNode } from 'react'
import { ProfileStateProvider } from '../src/components/profile/ProfileStateProvider'
import { ProfileNav } from '../src/components/profile/ProfileNav'
import { HealthPageContent } from '../src/components/profile/pages/HealthPageContent'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/profile/health'),
}))

vi.mock('@/components/profile/profile-icons', () => {
  const Icon = () => <span aria-hidden="true" />
  return {
    User: Icon,
    Heart: Icon,
    Apple: Icon,
    Dumbbell: Icon,
    Brain: Icon,
    Target: Icon,
    Clock: Icon,
    Settings: Icon,
  }
})

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

describe('Profile completeness shared state', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('aggiorna badge nav dopo save sezione nella stessa vista', async () => {
    let healthCompletion = 40

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = init?.method ?? 'GET'

      if (url === '/api/profile' && method === 'GET') {
        return new Response(
          JSON.stringify({
            profile: {
              birthDate: null,
              gender: 'M',
              height: 178,
              weight: 80,
              health: {
                conditions: '',
                allergies: '',
                medications: '',
                bloodType: '',
                notes: '',
              },
              nutrition: null,
              training: null,
              mindfulness: null,
              goals: null,
              settings: null,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      if (url === '/api/profile/completeness' && method === 'GET') {
        return new Response(
          JSON.stringify({
            sections: [
              { section: 'personal', completion: 50, missingFields: [], nextField: null },
              {
                section: 'health',
                completion: healthCompletion,
                missingFields: [],
                nextField: null,
              },
              { section: 'nutrition', completion: 0, missingFields: [], nextField: null },
              { section: 'training', completion: 0, missingFields: [], nextField: null },
              { section: 'mindfulness', completion: 0, missingFields: [], nextField: null },
              { section: 'goals', completion: 0, missingFields: [], nextField: null },
            ],
            overallCompletion: 0,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      if (url === '/api/profile' && method === 'PUT') {
        healthCompletion = 80
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
    }) as typeof global.fetch

    render(
      <ProfileStateProvider>
        <ProfileNav />
        <HealthPageContent />
      </ProfileStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByLabelText('completezza Salute')).toHaveTextContent('40%')
    })

    fireEvent.change(screen.getByLabelText('Patologie o condizioni'), {
      target: { value: 'ipertensione' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }))

    await waitFor(() => {
      expect(screen.getByLabelText('completezza Salute')).toHaveTextContent('80%')
    })
  })
})
