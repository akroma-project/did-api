import { jest } from '@jest/globals'
import tmp from 'tmp-promise'
import { LevelStateStore } from '../level-state-store.js'
import {
  AnchorStatus,
  Stream,
  CommitType,
  SignatureStatus,
  StreamUtils,
  TestUtils,
} from '@ceramicnetwork/common'
import { CID } from 'multiformats/cid'
import { StreamID } from '@ceramicnetwork/streamid'

let mockStorage: Map<string, any>
const mockPut = jest.fn((id: string, state: any) => mockStorage.set(id, state))
let mockGet: any = jest.fn((id: string) => mockStorage.get(id))
const mockDel = jest.fn(() => Promise.resolve())
const mockStreamResult = ['1', '2', '3']
const mockStream = jest.fn(async () => mockStreamResult)

const streamIdTest = 'kjzl6cwe1jw147dvq16zluojmraqvwdmbh61dx9e0c59i344lcrsgqfohexp60s'

const levelFactory = jest.fn().mockImplementation(() => {
  return {
    put: mockPut,
    get: mockGet,
    del: mockDel,
    stream: mockStream,
  }
})

class FakeType extends Stream {
  isReadOnly = true
  makeReadOnly() {
    throw new Error('Method not implemented.')
  }
}

let levelPath: string
let stateStore: LevelStateStore
const NETWORK = 'fakeNetwork'

beforeEach(async () => {
  mockStorage = new Map()
  levelPath = await tmp.tmpName()
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  stateStore = new LevelStateStore(levelPath, levelFactory)
  mockGet = jest.fn((id: string) => mockStorage.get(id))
})

const state = {
  type: 0,
  content: { num: 0 },
  metadata: {
    controllers: [''],
  },
  signature: SignatureStatus.GENESIS,
  anchorStatus: AnchorStatus.NOT_REQUESTED,
  log: [
    { type: CommitType.GENESIS, cid: CID.parse('QmSnuWmxptJZdLJpKRarxBMS2Ju2oANVrgbr2xWbie9b2D') },
  ],
}

test('#open', async () => {
  expect(levelFactory).not.toBeCalled()
  expect(stateStore.store).toBeUndefined()
  stateStore.open(NETWORK)
  const expectedPath = levelPath + '/' + NETWORK
  expect(levelFactory).toBeCalledWith(expectedPath)
})

test('#save and #load', async () => {
  const stream = new FakeType(TestUtils.runningState(state), {})
  stateStore.open(NETWORK)
  await stateStore.save(stream)
  const streamId = stream.id.baseID
  expect(mockPut).toBeCalledWith(streamId.toString(), StreamUtils.serializeState(state))

  const retrieved = await stateStore.load(streamId)
  expect(mockGet).toBeCalledWith(streamId.toString())
  expect(retrieved).toEqual(state)
})

describe('#load', () => {
  test('#load not found', async () => {
    mockGet = jest.fn(() => {
      throw { notFound: true }
    })
    stateStore.open(NETWORK)
    const streamid = StreamID.fromString(streamIdTest)
    const retrieved = await stateStore.load(streamid)
    expect(retrieved).toBeNull()
  })

  test('#load passes errors', async () => {
    mockGet = jest.fn(() => {
      throw new Error('something internal to LevelDB')
    })
    stateStore.open(NETWORK)
    const streamid = StreamID.fromString(streamIdTest)
    await expect(stateStore.load(streamid)).rejects.toThrow('something internal to LevelDB')
  })
})

test('#remove', async () => {
  stateStore.open(NETWORK)
  const streamid = StreamID.fromString(streamIdTest)
  await stateStore.remove(streamid)
  expect(mockDel).toBeCalledWith(streamid.toString())
})

describe('#list', () => {
  test('saved entries', async () => {
    stateStore.open(NETWORK)
    const list = await stateStore.list()
    expect(list).toEqual(mockStreamResult)
    expect(mockStream).toBeCalledWith({ keys: true, values: false })
  })
  test('report if streamId is saved', async () => {
    stateStore.open(NETWORK)
    stateStore.load = jest.fn(() => Promise.resolve(state))
    const streamid = StreamID.fromString(streamIdTest)
    const list = await stateStore.list(streamid)
    expect(list).toEqual([streamid.toString()])
  })
  test('report if streamId is absent', async () => {
    stateStore.open(NETWORK)
    stateStore.load = jest.fn(() => Promise.resolve(null))
    const streamid = StreamID.fromString(streamIdTest)
    const list = await stateStore.list(streamid)
    expect(list).toEqual([])
  })
})
