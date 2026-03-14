/**
 * Tests for content moderation layer.
 *
 * Note: persistModerationLog is fire-and-forget and writes to DB — not tested here.
 * These tests verify the pure logic in moderateText().
 */

import { describe, it, expect } from 'vitest'
import { moderateText } from '@/lib/ai/contentModeration'

describe('moderateText', () => {
  describe('clean messages', () => {
    it('returns none for normal health query', () => {
      const r = moderateText('Ho mal di testa da ieri sera, cosa posso fare?')
      expect(r.action).toBe('none')
      expect(r.flags).toHaveLength(0)
    })

    it('returns none for nutrition question', () => {
      const r = moderateText('Quante calorie ha una mela?')
      expect(r.action).toBe('none')
      expect(r.flags).toHaveLength(0)
    })

    it('returns none for training question', () => {
      const r = moderateText('Quali esercizi sono migliori per le spalle?')
      expect(r.action).toBe('none')
    })
  })

  describe('self_harm detection', () => {
    it('blocks explicit suicide ideation', () => {
      const r = moderateText('voglio togliermi la vita, non riesco ad andare avanti')
      expect(r.action).toBe('block')
      expect(r.flags.some((f) => f.type === 'self_harm' && f.severity === 'high')).toBe(true)
      expect(r.emergencyMessage).toBeDefined()
      expect(r.emergencyMessage).toContain('118')
    })

    it('blocks "voglio morire" pattern', () => {
      const r = moderateText('non ce la faccio più, voglio morire')
      expect(r.action).toBe('block')
      expect(r.flags[0].type).toBe('self_harm')
    })

    it('blocks "farla finita"', () => {
      const r = moderateText('penso di farla finita')
      expect(r.action).toBe('block')
    })

    it('is case-insensitive', () => {
      const r = moderateText('VOGLIO SUICIDARMI')
      expect(r.action).toBe('block')
    })

    it('does NOT block "morto di fame" (colloquial)', () => {
      const r = moderateText('sono morto di fame, cosa mangio?')
      // "morire" is not present, should be clean
      expect(r.action).toBe('none')
    })
  })

  describe('medical_emergency detection', () => {
    it('escalates severe chest pain + intensity modifier', () => {
      const r = moderateText('ho un forte dolore al petto che non passa da ore')
      expect(r.action).toBe('escalate')
      expect(r.flags.some((f) => f.type === 'medical_emergency' && f.severity === 'high')).toBe(
        true,
      )
      expect(r.emergencyMessage).toContain('118')
    })

    it('warns for standalone chest pain without modifier', () => {
      const r = moderateText('ho dolore al petto')
      // Medium severity → warn
      expect(['warn', 'escalate']).toContain(r.action)
      expect(r.flags.some((f) => f.type === 'medical_emergency')).toBe(true)
    })

    it('escalates breathing difficulty', () => {
      const r = moderateText('non riesco a respirare affatto')
      expect(r.action).toBe('escalate')
    })

    it('escalates anaphylaxis', () => {
      const r = moderateText('sto avendo una reazione allergica grave, shock anafilattico')
      expect(r.action).toBe('escalate')
    })
  })

  describe('violence detection', () => {
    it('blocks explicit violence toward others', () => {
      const r = moderateText('voglio fare del male a qualcuno')
      expect(r.action).toBe('block')
      expect(r.flags.some((f) => f.type === 'violence')).toBe(true)
    })
  })

  describe('PII detection', () => {
    it('warns on Italian fiscal code', () => {
      const r = moderateText('Il mio codice fiscale è RSSMRA85M01H501Z')
      expect(r.action).toBe('warn')
      expect(r.flags.some((f) => f.type === 'pii')).toBe(true)
    })

    it('warns on credit card number', () => {
      const r = moderateText('La mia carta è 4532 1234 5678 9012')
      expect(r.action).toBe('warn')
      expect(r.flags.some((f) => f.type === 'pii')).toBe(true)
    })

    it('does NOT flag partial numbers as CC', () => {
      const r = moderateText('Ho bruciato 1200 calorie in palestra')
      expect(r.flags.some((f) => f.type === 'pii')).toBe(false)
    })
  })

  describe('priority ordering', () => {
    it('self_harm takes priority over PII', () => {
      const r = moderateText('voglio morire, il mio CF è RSSMRA85M01H501Z')
      // self_harm is block, should win
      expect(r.action).toBe('block')
      expect(r.flags.some((f) => f.type === 'self_harm')).toBe(true)
    })
  })
})
