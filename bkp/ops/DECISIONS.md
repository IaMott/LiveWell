
## ADR-010: PR operativa su branch rebased
- **Date**: 2026-03-04 15:26
- **Decision**: usare  come branch sorgente PR verso .
- **Rationale**: branch precedente aveva storia non allineata con  e causava problemi operativi.

## ADR-011: Correzione record PR
- **Date**: 2026-03-04 15:26
- **Decision**: confermato che la PR operativa è la #1 da feat/orchestration-profile-live-redesign-v2 a main.
- **Rationale**: riallineare il tracciamento memoria senza errori di escaping shell.

## ADR-012: Blocco output JSON in chat utente
- **Date**: 2026-03-04 15:41
- **Decision**: intercettare output strutturati e normalizzarli in linguaggio naturale prima della consegna UI.
- **Rationale**: allineamento UX con requirement di conversazione umana continua.

## ADR-013: Coesistenza professionisti con panel esplicito
- **Date**: 2026-03-04 15:48
- **Decision**: quando coinvolti più specialisti, generare contributi separati per ciascuno nello stesso turno (no cambio-cappello implicito).
- **Rationale**: allineare UX al modello "co-working" richiesto dall’utente.

## ADR-014: Stato/memoria separata per professionista (per conversazione)
- **Date**: 2026-03-04 15:53
- **Decision**: memorizzare memoria specialistica in .
- **Rationale**: mantenere continuità di contesto per singolo professionista senza dipendere da cambio-cappello.

## ADR-015: Turnazione esplicita multi-agent in streaming
- **Date**: 2026-03-04 15:53
- **Decision**: introdurre eventi SSE per agente (, , ) e persistere messaggi assistant separati per autore.
- **Rationale**: rappresentare coesistenza professionisti in modo trasparente e testabile in UI.

## ADR-014: Stato/memoria separata per professionista (per conversazione)
- **Date**: 2026-03-04 15:54
- **Decision**: memorizzare memoria specialistica in settings.aiSpecialistMemory[conversationId][specialistId].
- **Rationale**: mantenere continuità di contesto per singolo professionista senza dipendere da cambio-cappello.

## ADR-015: Turnazione esplicita multi-agent in streaming
- **Date**: 2026-03-04 15:54
- **Decision**: introdurre eventi SSE per agente (agent_turn, agent_delta, agent_done) e persistere messaggi assistant separati per autore.
- **Rationale**: rappresentare coesistenza professionisti in modo trasparente e testabile in UI.

## ADR-016: Routing hard-priority su richiesta professionista esplicita
- **Date**: 2026-03-04 16:17
- **Decision**: se l’utente richiede esplicitamente un professionista, `routeMessage` forza direttamente quello specialista come primario e salta il gating da intervistatore.
- **Rationale**: eliminare interruzioni/fake-handoff e rendere il passaggio di testimone effettivo nel turno successivo.

## ADR-017: Handoff contestuale automatico multi-professionista
- **Date**: 2026-03-04 16:21
- **Decision**: il passaggio di testimone non dipende solo da richiesta esplicita; il routing usa dominio+knownData per attivare automaticamente uno o piu professionisti.
- **Rationale**: garantire coesistenza reale dei professionisti quando il contesto lo richiede, evitando risposte monolitiche dell'analista.
