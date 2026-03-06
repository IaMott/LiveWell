import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { type ReactNode } from 'react'
import { ProfileNav } from '../src/components/profile/ProfileNav'
import { useProfileState } from '@/components/profile/ProfileStateProvider'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/profile/nutrition'),
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

vi.mock('@/components/profile/ProfileStateProvider', () => ({
  useProfileState: vi.fn(),
}))

describe('ProfileNav completeness badges', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mostra percentuale completezza nelle sezioni profilo', () => {
    vi.mocked(useProfileState).mockReturnValue({
      completeness: {
        personal: { section: 'personal', completion: 50, missingFields: [], nextField: null },
        health: { section: 'health', completion: 40, missingFields: [], nextField: null },
        nutrition: { section: 'nutrition', completion: 80, missingFields: [], nextField: null },
        training: { section: 'training', completion: 10, missingFields: [], nextField: null },
        mindfulness: { section: 'mindfulness', completion: 60, missingFields: [], nextField: null },
        goals: { section: 'goals', completion: 100, missingFields: [], nextField: null },
      },
      completenessLoading: false,
      completenessError: '',
    } as never)

    render(<ProfileNav />)

    expect(screen.getByLabelText('completezza Nutrizione')).toHaveTextContent('80%')
    expect(screen.getByLabelText('completezza Obiettivi')).toHaveTextContent('100%')
  })

  it('mostra stato loading/error dei badge completezza', () => {
    vi.mocked(useProfileState).mockReturnValue({
      completeness: {
        personal: { section: 'personal', completion: 0, missingFields: [], nextField: null },
        health: { section: 'health', completion: 0, missingFields: [], nextField: null },
        nutrition: { section: 'nutrition', completion: 0, missingFields: [], nextField: null },
        training: { section: 'training', completion: 0, missingFields: [], nextField: null },
        mindfulness: { section: 'mindfulness', completion: 0, missingFields: [], nextField: null },
        goals: { section: 'goals', completion: 0, missingFields: [], nextField: null },
      },
      completenessLoading: true,
      completenessError: '',
    } as never)

    const { rerender } = render(<ProfileNav />)
    expect(screen.getByLabelText('completezza Salute')).toHaveTextContent('...')

    vi.mocked(useProfileState).mockReturnValue({
      completeness: {
        personal: { section: 'personal', completion: 0, missingFields: [], nextField: null },
        health: { section: 'health', completion: 0, missingFields: [], nextField: null },
        nutrition: { section: 'nutrition', completion: 0, missingFields: [], nextField: null },
        training: { section: 'training', completion: 0, missingFields: [], nextField: null },
        mindfulness: { section: 'mindfulness', completion: 0, missingFields: [], nextField: null },
        goals: { section: 'goals', completion: 0, missingFields: [], nextField: null },
      },
      completenessLoading: false,
      completenessError: 'boom',
    } as never)

    rerender(<ProfileNav />)
    expect(screen.getByLabelText('completezza Salute')).toHaveTextContent('!')
  })
})
