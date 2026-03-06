import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HealthPageContent } from '../src/components/profile/pages/HealthPageContent'
import { useProfileState } from '@/components/profile/ProfileStateProvider'

vi.mock('@/components/profile/ProfileStateProvider', () => ({
  useProfileState: vi.fn(),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

describe('HealthPageContent completeness UX', () => {
  it('mostra nextField e campi mancanti con stato coerente', () => {
    vi.mocked(useProfileState).mockReturnValue({
      profile: { health: {} },
      loading: false,
      saving: false,
      error: '',
      success: '',
      saveSection: vi.fn(),
      getSectionCompleteness: vi.fn(() => ({
        section: 'health',
        completion: 40,
        missingFields: ['conditions', 'medications', 'notes'],
        nextField: 'conditions',
      })),
      completenessLoading: false,
      completenessError: '',
    } as never)

    render(<HealthPageContent />)

    expect(screen.getByText(/Completezza: 40%/i)).toBeInTheDocument()
    expect(screen.getByText(/Prossimo dato da completare:/i)).toBeInTheDocument()
    expect(screen.getAllByText(/patologie\/condizioni/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Mancano:/i)).toBeInTheDocument()
  })

  it('mostra errore completezza senza rompere la pagina', () => {
    vi.mocked(useProfileState).mockReturnValue({
      profile: { health: {} },
      loading: false,
      saving: false,
      error: '',
      success: '',
      saveSection: vi.fn(),
      getSectionCompleteness: vi.fn(() => ({
        section: 'health',
        completion: 0,
        missingFields: [],
        nextField: null,
      })),
      completenessLoading: false,
      completenessError: 'Errore nel caricamento completezza',
    } as never)

    render(<HealthPageContent />)

    expect(screen.getByText('Errore nel caricamento completezza')).toBeInTheDocument()
    expect(screen.getByText('Salute')).toBeInTheDocument()
  })
})
