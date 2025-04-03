import { MessageStatus } from 'src/types';

export interface RootState {
  // empty on purpose so that the slices extend the interface
}

// { [messageId]: { [emoji]: codename[] } }
export type ReactionInfo = { pubkey: string; codeset: number; id: string; status?: MessageStatus };
export type EmojiReactions = Record<string, Record<string, ReactionInfo[]>>;
