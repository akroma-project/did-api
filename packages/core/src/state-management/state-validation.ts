import { StreamNext, StreamState, Stream } from '@ceramicnetwork/common'
import { CommitID } from '@ceramicnetwork/streamid'
import { Utils } from '../utils.js'
import { TileDocument } from '@ceramicnetwork/stream-tile'

type LoadDocumentFunc = <T extends Stream>(streamId: CommitID) => Promise<T>

export interface StateValidation {
  validate(state: StreamState | StreamNext, content: any): Promise<void>
}

/**
 * Pretend validating. Do nothing.
 */
export class FauxStateValidation implements StateValidation {
  async validate(state: StreamState | StreamNext, content: any): Promise<void> {
    return
  }
}

/**
 * Validate document state against its schema.
 */
export class RealStateValidation implements StateValidation {
  constructor(private readonly loadStream: LoadDocumentFunc) {}

  /**
   * Load schema by ID
   *
   * @param schemaStreamId - Schema document ID
   */
  private loadSchemaById<T>(schemaStreamId: string): Promise<T | null> {
    let commitId: CommitID
    try {
      commitId = CommitID.fromString(schemaStreamId)
    } catch {
      throw new Error('Commit missing when loading schema document')
    }
    return this.loadStream<TileDocument<T>>(commitId).then((doc) => doc.content)
  }

  /**
   * Load schema for the Stream
   */
  private async loadSchema<T>(state: StreamState | StreamNext): Promise<T | null> {
    const schemaId = state.metadata?.schema
    if (schemaId) {
      return this.loadSchemaById(schemaId)
    } else {
      return null
    }
  }

  /**
   * Validate document state against its schema.
   */
  async validate(state: StreamState | StreamNext, content: any): Promise<void> {
    const schema = await this.loadSchema(state)
    if (schema) {
      Utils.validate(content, schema)
    }
  }
}
