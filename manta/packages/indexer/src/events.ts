import type { SuiEvent } from '@mysten/sui/client';
import type { Db } from '@manta/shared';
import type { IndexerConfig } from './config.js';
import type { ObjectReader } from './object-reader.js';
import type {
  MantaEvent,
  IndexerEvent,
  MemoryCreatedEvent,
  MemoryAppendedEvent,
  MemoryUpdatedEvent,
  CapDelegatedEvent,
  CapRevokedEvent,
  MemoryDestroyedEvent,
  OwnershipTransferredEvent,
} from './types.js';
import { EVENT_TYPES } from './types.js';

export class EventProcessor {
  constructor(
    private db: Db,
    private config: IndexerConfig,
    private objectReader: ObjectReader,
  ) { }

  // ============================================================
  // Parse raw Sui event → typed MantaEvent
  // ============================================================

  parseEvent(suiEvent: SuiEvent): IndexerEvent {
    const eventType = suiEvent.type;
    const data = suiEvent.parsedJson as Record<string, unknown>;

    // Event type format: "{package_id}::memory::EventName"
    const suffix = eventType.split('::').pop() ?? '';

    let event: MantaEvent;

    switch (suffix) {
      case EVENT_TYPES.MemoryCreated:
        event = {
          type: 'MemoryCreated',
          data: data as unknown as MemoryCreatedEvent,
        };
        break;

      case EVENT_TYPES.EpisodicAppend:
        event = {
          type: 'EpisodicAppend',
          data: data as unknown as MemoryAppendedEvent,
        };
        break;

      case EVENT_TYPES.SemanticUpdate:
        event = {
          type: 'SemanticUpdate',
          data: data as unknown as MemoryUpdatedEvent,
        };
        break;

      case EVENT_TYPES.CapabilityDelegated:
        event = {
          type: 'CapabilityDelegated',
          data: data as unknown as CapDelegatedEvent,
        };
        break;

      case EVENT_TYPES.CapabilityRevoked:
        event = {
          type: 'CapabilityRevoked',
          data: data as unknown as CapRevokedEvent,
        };
        break;

      case EVENT_TYPES.MemoryDestroyed:
        event = {
          type: 'MemoryDestroyed',
          data: data as unknown as MemoryDestroyedEvent,
        };
        break;

      case EVENT_TYPES.OwnershipTransferred:
        event = {
          type: 'OwnershipTransferred',
          data: data as unknown as OwnershipTransferredEvent,
        };
        break;

      default:
        event = { type: 'Unknown', data };
        break;
    }

    return {
      txDigest: suiEvent.id.txDigest,
      eventSeq: suiEvent.id.eventSeq,
      timestampMs: suiEvent.timestampMs ?? null,
      event,
    };
  }

  // ============================================================
  // Process a single parsed event → write to DB
  // ============================================================

  async process(ev: IndexerEvent): Promise<void> {
    // Store raw event for replay/debugging
    await this.db.storeRawEvent(
      ev.txDigest,
      ev.eventSeq,
      ev.event.type,
      ev.event.data,
    );

    switch (ev.event.type) {
      case 'MemoryCreated': {
        const e = ev.event.data;
        await this.db.upsertMemory(
          e.memory_id,
          e.owner,
          e.schema_type,
          0, // initial version
          ev.txDigest,
          null,
        );
        console.log(
          `[event] MemoryCreated: ${e.memory_id} owner=${e.owner} schema=${e.schema_type}`,
        );
        break;
      }

      case 'EpisodicAppend': {
        const e = ev.event.data;
        const version = parseInt(e.version, 10);
        await this.db.updateMemoryVersion(e.memory_id, version);

        // Fetch full object state from chain
        await this.objectReader.syncObject(
          e.memory_id,
          ev.txDigest,
          e.actor,
          ev.timestampMs,
        );

        console.log(
          `[event] EpisodicAppend: ${e.memory_id} actor=${e.actor} v=${e.version}`,
        );
        break;
      }

      case 'SemanticUpdate': {
        const e = ev.event.data;
        const version = parseInt(e.version, 10);
        await this.db.updateMemoryVersion(e.memory_id, version);

        // Fetch full object state from chain
        await this.objectReader.syncObject(
          e.memory_id,
          ev.txDigest,
          e.actor,
          ev.timestampMs,
        );

        console.log(
          `[event] SemanticUpdate: ${e.memory_id} actor=${e.actor} v=${e.version}`,
        );
        break;
      }

      case 'CapabilityDelegated': {
        const e = ev.event.data;
        await this.db.upsertCap(
          e.cap_id,
          e.memory_id,
          e.grantee,
          e.permissions,
          e.expiry ? parseInt(e.expiry, 10) : null,
          ev.txDigest,
        );
        console.log(
          `[event] CapDelegated: ${e.cap_id} → ${e.grantee} perms=${e.permissions}`,
        );
        break;
      }

      case 'CapabilityRevoked': {
        const e = ev.event.data;
        await this.db.revokeCap(e.cap_id);
        console.log(`[event] CapRevoked: ${e.cap_id}`);
        break;
      }

      case 'MemoryDestroyed': {
        const e = ev.event.data;
        await this.db.markMemoryDeleted(e.memory_id);
        console.log(`[event] MemoryDestroyed: ${e.memory_id}`);
        break;
      }

      case 'OwnershipTransferred': {
        const e = ev.event.data;
        await this.db.transferMemoryOwner(e.memory_id, e.new_owner);
        console.log(
          `[event] OwnershipTransferred: ${e.memory_id} → ${e.new_owner}`,
        );
        break;
      }

      case 'Unknown':
        // Skip silently
        break;
    }

    // Update cursor after successful processing
    await this.db.updateCursor(ev.txDigest, ev.eventSeq);
  }
}
