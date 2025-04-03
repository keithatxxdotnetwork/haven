import {
  DMBlockedUserEvent,
  DMNotificationsUpdateEvent,
  DMReceivedEvent,
  TypedEventEmitter
} from 'src/types';
import {
  Decoder,
  dmNotificationsUpdateEventDecoder,
  blockedUserEventDecoder,
  dmReceivedEventDecoder
} from 'src/utils/decoders';
import { makeEventAwaiter, makeListenerHook } from '@utils/index';
import EventEmitter from 'events';

export enum DMEvents {
  DM_NOTIFICATION_UPDATE = 1000,
  DM_BLOCKED_USER = 2000,
  DM_MESSAGE_RECEIVED = 3000
}

export type DMEventHandler = (eventType: DMEvents, data: unknown) => void;

export type DMEventMap = {
  [DMEvents.DM_NOTIFICATION_UPDATE]: DMNotificationsUpdateEvent;
  [DMEvents.DM_BLOCKED_USER]: DMBlockedUserEvent;
  [DMEvents.DM_MESSAGE_RECEIVED]: DMReceivedEvent;
};

export type DMEventHandlers = {
  [P in keyof DMEventMap]: (event: DMEventMap[P]) => void;
};

export const dmBus = new EventEmitter() as TypedEventEmitter<DMEventHandlers>;

const dmDecoderMap: { [P in keyof DMEventMap]: Decoder<DMEventMap[P]> } = {
  [DMEvents.DM_NOTIFICATION_UPDATE]: dmNotificationsUpdateEventDecoder,
  [DMEvents.DM_BLOCKED_USER]: blockedUserEventDecoder,
  [DMEvents.DM_MESSAGE_RECEIVED]: dmReceivedEventDecoder
};

export const onDmEvent = (eventType: DMEvents, data: unknown) => {
  const eventDecoder = dmDecoderMap[eventType];

  if (!eventDecoder) {
    console.error('Unhandled channel event:', eventType, data);
  } else {
    dmBus.emit(eventType, eventDecoder(data) as any);
  }
};

export const useDmListener = makeListenerHook(dmBus);

export const awaitDmEvent = makeEventAwaiter(dmBus);
