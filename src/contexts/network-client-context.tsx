import type { CMix } from 'src/types';
import { ChannelJSON } from 'src/contexts/utils-context';
import React, { FC, useState, useEffect, useRef, useCallback, useMemo } from 'react';

import _ from 'lodash';
import Cookies from 'js-cookie';
import assert from 'assert';
import { uniq } from 'lodash';

import * as events from 'src/events';
import { Message, WithChildren } from 'src/types';
import { decoder, encoder, exportDataToFile } from 'src/utils';
import { useAuthentication } from 'src/contexts/authentication-context';
import { PrivacyLevel, useUtils } from 'src/contexts/utils-context';
import { PIN_MESSAGE_LENGTH_MILLISECONDS, STATE_PATH } from '../constants';
import useNotification from 'src/hooks/useNotification';
import usePrevious from 'src/hooks/usePrevious';
import { useDb } from './db-context';
import useCmix from 'src/hooks/useCmix';

const batchCount = 100;

enum DBMessageType {
  Normal = 1,
  Reply = 2,
  Reaction = 3
}

enum DBMessageStatus {
  Sending = 1,
  Sent = 2,
  Delivered = 3
}

export type DBMessage = {
  id: number;
  nickname: string;
  message_id: string;
  channel_id: string;
  parent_message_id: null | string;
  timestamp: string;
  lease: number;
  status: DBMessageStatus;
  hidden: boolean,
  pinned: boolean;
  text: string;
  type: DBMessageType;
  round: number;
  pubkey: string;
  codeset_version: number;
}

export type DBChannel = {
  id: string;
  name: string;
  description: string;
}

export type User = {
  codename: string;
  color: string;
  pubkey: string;
}

export enum NetworkStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  FAILED = 'failed'
}

export enum MessageType {
  Text = 1,
  AdminText = 2,
  Reaction = 3
}

export type IsReadyInfo = {
  IsReady: boolean;
  HowClose: number;
}

type ShareURL = {
  url: string;
  password: string;
}

export type DatabaseCipher = {
  GetID: () => number;
  Decrypt: (plaintext: Uint8Array) => Uint8Array;
}

export type ChannelManager = {
  GetChannels: () => Uint8Array;
  GetID: () => number;
  JoinChannel: (channelId: string) => Uint8Array;
  LeaveChannel: (channelId: Uint8Array) => void;
  GetMutedUsers: (channelId: Uint8Array) => Uint8Array;
  Muted: (channelId: Uint8Array) => boolean;
  MuteUser: (
    channelId: Uint8Array,
    publicKey: Uint8Array,
    mute: boolean,
    messageValidityTimeoutMilliseconds: number,
    cmixParams?: Uint8Array
  ) => Promise<void>;
  SendMessage: (
    channelId: Uint8Array,
    message: string,
    messageValidityTimeoutMilliseconds: number,
    cmixParams: Uint8Array
  ) => Promise<Uint8Array>;
  PinMessage: (
    channelId: Uint8Array,
    messageId: Uint8Array,
    unpin: boolean,
    pinDurationInMilliseconds: number,
    cmixParams: Uint8Array,
  ) => Promise<Uint8Array>;
  DeleteMessage: (
    channelId: Uint8Array,
    messageId: Uint8Array,
    cmixParams: Uint8Array
  ) => Promise<void>;
  SendReaction: (
    channelId: Uint8Array,
    reaction: string,
    messageToReactTo: Uint8Array,
    cmixParams: Uint8Array
  ) => Promise<Uint8Array>;
  SendReply: (
    channelId: Uint8Array,
    message: string,
    messageToReactTo: Uint8Array,
    messageValidityTimeoutMilliseconds: number,
    cmixParams: Uint8Array
  ) => Promise<Uint8Array>;
  IsChannelAdmin: (channelId: Uint8Array) => boolean;
  GenerateChannel: (channelname: string, description: string, privacyLevel: PrivacyLevel) => Promise<string>;
  GetStorageTag: () => string;
  SetNickname: (newNickname: string, channel: Uint8Array) => void;
  GetNickname: (channelId: Uint8Array) => string;
  GetIdentity: () => Uint8Array;
  GetShareURL: (cmixId: number, host: string, maxUses: number, channelId: Uint8Array) => Uint8Array;
  JoinChannelFromURL: (url: string, password: string) => Uint8Array;
  ExportPrivateIdentity: (password: string) => Uint8Array;
  ExportChannelAdminKey: (channelId: Uint8Array, encryptionPassword: string) => Uint8Array;
  ImportChannelAdminKey: (channelId: Uint8Array, encryptionPassword: string, privateKey: Uint8Array) => void;
}

export interface Channel {
  prettyPrint?: string;
  name: string;
  id: string;
  description: string;
  isAdmin: boolean;
  privacyLevel: PrivacyLevel | null;
  isLoading?: boolean;
  withMissedMessages?: boolean;
  currentMessagesBatch?: number;
}

export type IdentityJSON = {
  PubKey: string;
  Codename: string;
  Color: string;
  Extension: string;
  CodesetVersion: number;
}
// { [messageId]: { [emoji]: codename[] } }
type EmojiReactions =  Record<string, Record<string, string[]>>;

type NetworkContext = {
  // state
  mutedUsers: User[] | undefined;
  userIsMuted: (pubkey: string) => boolean;
  setMutedUsers: React.Dispatch<React.SetStateAction<User[] | undefined>>;
  channels: Channel[];
  messages: Message[];
  cmix?: CMix;
  currentChannel?: Channel;
  isNetworkHealthy: boolean | undefined;
  isReadyToRegister: boolean | undefined;
  channelIdentity: IdentityJSON | null;
  pinnedMessages?: Message[];
  messageReactions?: EmojiReactions;
  setMessageReactions: React.Dispatch<React.SetStateAction<EmojiReactions | undefined>>;
  // api
  checkRegistrationReadiness: (
    selectedPrivateIdentity: Uint8Array,
    onIsReadyInfoChange: (readinessInfo: IsReadyInfo) => void
  ) => Promise<void>;
  createChannel: (
    channelName: string,
    channelDescription: string,
    privacyLevel: 0 | 2
  ) => void;
  decryptMessageContent?: (text: string) => string;
  upgradeAdmin: () => void;
  deleteMessage: (message: Message) => Promise<void>;
  exportChannelAdminKeys: (encryptionPassword: string) => string;
  getCodeNameAndColor: (publicKey: string, codeSet: number) => { codename: string, color: string };
  generateIdentities: (amountOfIdentites: number) => {
    privateIdentity: Uint8Array;
    codename: string;
  }[];
  initialize: (password: string) => Promise<void>;
  getMuted: () => boolean;
  isMuted: boolean;
  joinChannel: (prettyPrint: string, appendToCurrent?: boolean) => void;
  importChannelAdminKeys: (encryptionPassword: string, privateKeys: string) => void;
  setPinnedMessages: React.Dispatch<React.SetStateAction<Message[] | undefined>>;
  fetchPinnedMessages: () => Promise<Message[]>;
  getMutedUsers: () => Promise<User[]>;
  mapDbMessagesToMessages: (messages: DBMessage[]) => Promise<Message[]>;
  muteUser: (pubkey: string, unmute: boolean) => Promise<void>;
  setMessages: (messages: Message[]) => void;
  setCurrentChannel: (channel: Channel) => void;
  shareChannel: () => void;
  sendMessage: (message: string) => void;
  leaveCurrentChannel: () => void;
  createChannelManager: (privateIdentity: Uint8Array) => Promise<void>;
  loadChannelManager: (storageTag: string, cmix?: CMix) => Promise<void>;
  handleInitialLoadData: () => Promise<void>;
  getNickName: () => string;
  setNickName: (nickname: string) => boolean;
  getIdentity: () => IdentityJSON | null;
  sendReply: (reply: string, replyToMessageId: string) => Promise<void>;
  sendReaction: (reaction: string, reactToMessageId: string) => Promise<void>;
  getPrettyPrint: (channelId: string) => string | undefined;
  getShareURL: () => ShareURL | null;
  getShareUrlType: (url: string) => PrivacyLevel | null;
  joinChannelFromURL: (url: string, password: string) => void;
  getVersion: () => string | null;
  getClientVersion: () => string | null;
  loadMoreChannelData: (channelId: string) => Promise<void>;
  exportPrivateIdentity: (password: string) => Uint8Array | false;
  pinMessage: (message: Message, unpin?: boolean) => Promise<void>;
  setIsReadyToRegister: (isReady: boolean | undefined) => void;
  logout: (password: string) => boolean;
};

export const NetworkClientContext = React.createContext<NetworkContext>({
  cmix: undefined,
  networkStatus: NetworkStatus.DISCONNECTED,
  currentChannel: undefined,
  channels: [],
  messages: [],
  isNetworkHealthy: undefined,
  isReadyToRegister: undefined,
} as unknown as NetworkContext);

NetworkClientContext.displayName = 'NetworkClientContext';

const getPrettyPrint = (channelId: string) => {
  const prev = JSON.parse(localStorage.getItem('prettyprints') || '{}');
  return prev[channelId];
};

const savePrettyPrint = (channelId: string, prettyPrint: string) => {
  const prev = JSON.parse(localStorage.getItem('prettyprints') || '{}');

  prev[channelId] = prettyPrint;

  localStorage.setItem('prettyprints', JSON.stringify(prev));
};

export const NetworkProvider: FC<WithChildren> = props => {
  const db = useDb();
  const {
    addStorageTag,
    checkUser,
    setIsAuthenticated,
    storageTag,
  } = useAuthentication();
  const { messagePinned, messageReplied } = useNotification();
  const { utils } = useUtils();
  const [mutedUsers, setBannedUsers] = useState<User[]>();
  const { cipher, cmix, initializeCmix } = useCmix();
  const [currentChannel, setCurrentChannel] = useState<Channel | undefined>();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [channelManager, setChannelManager] = useState<ChannelManager | undefined>();
  const [messageReactions, setMessageReactions] = useState<EmojiReactions>();
  const [isNetworkHealthy, setIsNetworkHealthy] = useState<boolean | undefined>(
    undefined
  );
  const [channelIdentity, setChannelIdentity] = useState<IdentityJSON | null>(null);
  
  const [isReadyToRegister, setIsReadyToRegister] = useState<
    boolean | undefined
  >(undefined);
  const bc = useMemo(() => new BroadcastChannel('join_channel'), []);
  const [blockedEvents, setBlockedEvents] = useState<DBMessage[]>([]);
  const currentCodeNameRef = useRef<string>('');
  const currentChannelRef = useRef<Channel>();
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>();

  useEffect(() => {
    if (currentChannel) {
      currentChannelRef.current = currentChannel;
      setChannels(prev => {
        return prev.map((ch) => {
          if (ch?.id === currentChannel?.id) {
            return { ...ch, withMissedMessages: false };
          } else {
            return ch;
          }
        });
      });
    }
  }, [currentChannel]);

  const initialize = useCallback(async (password: string) => {
    const statePassEncoded = checkUser(password);
    if (!statePassEncoded) {
      throw new Error('Incorrect password');
    } else {
      await initializeCmix(statePassEncoded);
    }
  }, [checkUser, initializeCmix]);

  useEffect(() => {
    if (cmix) {
      setIsAuthenticated(true);
    }
  }, [cmix, setIsAuthenticated]);


  const upgradeAdmin = useCallback(() => {
    if (currentChannel) {
      setCurrentChannel(ch => ch && ({
        ...ch,
        isAdmin: true,
      }))
      setChannels(prev => {
        return prev.map((ch) => {
          if (ch?.id === currentChannel?.id) {
            return { ...ch, isAdmin: true };
          } else {
            return ch;
          }
        });
      });
    }
  }, [currentChannel])

  const getIdentity = useCallback((mngr?: ChannelManager) => {
    const manager = channelManager || mngr; 
    try {
      const identity = decoder.decode(manager?.GetIdentity());

      return JSON.parse(identity) as IdentityJSON;
    } catch (error) {
      console.error(error);
      return null;
    }
  }, [channelManager]);


  useEffect(() => {
    if (currentChannel && !currentChannel?.isLoading) {
      const identity = getIdentity();
      setChannelIdentity(identity);
    }
  }, [currentChannel, getIdentity]);

  const getShareURL = useCallback((
    channelId = currentChannel?.id,
  ) => {
    if (
      cmix &&
      channelManager &&
      utils &&
      utils.Base64ToUint8Array &&
      channelId
    ) {
      try {
        const currentHostName = window.location.host;
        const res = channelManager.GetShareURL(
          cmix?.GetID(),
          `http://${currentHostName}/join`,
          0,
          utils.Base64ToUint8Array(channelId)
        );
        
        return JSON.parse(decoder.decode(res)) as ShareURL;
      } catch (error) {
        return null;
      }
    } else {
      return null;
    }
  }, [channelManager, currentChannel, cmix, utils]);

  const getShareUrlType = useCallback((url?: string) => {
    if (url && utils && utils.GetShareUrlType) {
      try {
        const res = utils.GetShareUrlType(url);
        return res;
      } catch (error) {
        return null;
      }
    } else {
      return null;
    }
  }, [utils]);

  const getPrivacyLevel = useCallback(
    (channelId: string) => {
      return getShareUrlType(getShareURL(channelId)?.url)
    },
    [getShareURL, getShareUrlType]
  );
  
  const joinChannel = useCallback((
    prettyPrint: string,
    appendToCurrent = true
  ) => {
    if (prettyPrint && channelManager && channelManager.JoinChannel) {
      const chanInfo = JSON.parse(
        decoder.decode(channelManager.JoinChannel(prettyPrint))
      ) as ChannelJSON;

      if (appendToCurrent) {
        const temp: Channel = {
          id: chanInfo.ChannelID,
          name: chanInfo.Name,
          privacyLevel: getPrivacyLevel(chanInfo.ChannelID),
          description: chanInfo.Description,
          isAdmin: channelManager.IsChannelAdmin(utils.Base64ToUint8Array(chanInfo.ChannelID)),
          isLoading: true
        };
        setCurrentChannel(temp);
        setChannels(prev => [...prev, temp]);
        setTimeout(() => {
          setCurrentChannel((prev) => {
            if (prev && prev?.id === temp.id) {
              return {
                ...prev,
                isLoading: false
              };
            } else {
              return prev;
            }
          });
          setChannels(prev => {
            return prev.map(ch => {
              if (ch.id === temp.id) {
                return {
                  ...temp,
                  isLoading: false
                };
              } else {
                return ch;
              }
            });
          });
        }, 5000);
      }
    }
  }, [channelManager, getPrivacyLevel, utils]);

  const getCodeNameAndColor = useCallback((publicKey: string, codeset: number) => {
    try {
      assert(utils && typeof utils.ConstructIdentity === 'function' && utils.Base64ToUint8Array)
      const identity = JSON.parse(
        decoder.decode(
          utils.ConstructIdentity(
            utils.Base64ToUint8Array(publicKey),
            codeset
          )
        )
      ) as IdentityJSON;

      return {
        codename: identity.Codename,
        color: identity.Color
      };
    } catch (error) {
      console.error('Failed to get codename and color', error);
      throw error;
    }
  }, [utils]);

  useEffect(() => {
    if (channelManager) {
      const identity = getIdentity();
      if (identity) {
        currentCodeNameRef.current = identity.Codename;
      }
      Cookies.set('userAuthenticated', 'true', { path: '/' });
    }
  }, [channelManager, getIdentity]);

  useEffect(() => {
    bc.onmessage = async event => {
      if (event.data?.prettyPrint) {
        try {
          joinChannel(event.data.prettyPrint);
        } catch (error) {}
      }
    };
  }, [bc, channelManager, joinChannel]);

  const mapDbMessagesToMessages = useCallback(async (msgs: DBMessage[]) => {
    if (!db || !cipher) {
      return [];
    } else {
      const messagesParentIds = msgs
        .map(e => e.parent_message_id)
        .filter((parentId): parentId is string => typeof parentId === 'string');

      const relatedMessages =
        (await db.table<DBMessage>('messages')
          .where('message_id')
          .anyOf(messagesParentIds)
          .filter(m => !m.hidden)
          .toArray()) || [];

      const mappedMessages: Message[] = [];

      msgs.forEach((m) => {
        if (m.parent_message_id && m.type === 1) {
          const replyToMessage = relatedMessages.find(
            ms => ms.message_id === m.parent_message_id
          );

          // If there is no replyTo message then it is not yet received
          if (!replyToMessage) {
            setBlockedEvents((e) => e.concat(m));
            return;
          }

          const {
            codename: messageCodeName,
            color: messageColor
          } = getCodeNameAndColor(m.pubkey, m.codeset_version);

          const {
            codename: replyToMessageCodeName,
            color: replyToMessageColor
          } = getCodeNameAndColor(
            replyToMessage.pubkey,
            replyToMessage.codeset_version
          );

          const resolvedMessage: Message = {
            id: m.message_id,
            body: cipher.decrypt(m.text),
            timestamp: m.timestamp,
            codename: messageCodeName,
            nickname: m.nickname || '',
            color: messageColor,
            channelId: m.channel_id,
            status: m.status,
            uuid: m.id,
            round: m.round,
            pubkey: m.pubkey,
            pinned: m.pinned,
            hidden: m.hidden,
            replyToMessage: {
              id: replyToMessage.message_id,
              body: cipher.decrypt(replyToMessage.text),
              timestamp: replyToMessage.timestamp,
              codename: replyToMessageCodeName,
              nickname: replyToMessage.nickname || '',
              color: replyToMessageColor,
              channelId: replyToMessage.channel_id,
              status: replyToMessage.status,
              uuid: replyToMessage.id,
              round: replyToMessage.round,
              pubkey: replyToMessage.pubkey,
              pinned: replyToMessage.pinned,
              hidden: replyToMessage.hidden
            }
          };
          mappedMessages.push(resolvedMessage);
        } else if (!m.parent_message_id) {
          // This is normal message
          const {
            codename: messageCodeName,
            color: messageColor
          } = getCodeNameAndColor(m.pubkey, m.codeset_version);
          const resolvedMessage: Message = {
            id: m.message_id,
            body: cipher.decrypt(m.text),
            timestamp: m.timestamp,
            codename: messageCodeName,
            nickname: m.nickname || '',
            color: messageColor,
            channelId: m.channel_id,
            status: m.status,
            uuid: m.id,
            round: m.round,
            pubkey: m.pubkey,
            pinned: m.pinned,
            hidden: m.hidden,
          };
          mappedMessages.push(resolvedMessage);
        }
      });
      return mappedMessages;
    }
  }, [cipher, db, getCodeNameAndColor]);


  const dbMessageToReaction = useCallback((reaction: DBMessage) => {
    assert(cipher, 'Cipher required');
    return ({
      reactingTo: reaction.parent_message_id as string,
      emoji: cipher.decrypt(reaction.text) ?? '',
      codename: getCodeNameAndColor(reaction.pubkey, reaction.codeset_version).codename
    })
  }, [cipher, getCodeNameAndColor]);

  const handleReactionReceived = useCallback((dbMessage: DBMessage) => {
    const { codename, emoji, reactingTo } = dbMessageToReaction(dbMessage);
    setMessageReactions((reactions) => ({
      ...reactions,
      [reactingTo]: {
        ...reactions?.[reactingTo],
        [emoji]: uniq(reactions?.[reactingTo]?.[emoji]?.concat(codename) ?? [codename])
      }
    }));
    
  }, [dbMessageToReaction]);

  const updateSenderMessageStatus = useCallback((message: DBMessage) => {
    setMessages(prevMessages => {
      return prevMessages.map(m => {
        if (m.uuid === message.id) {
          return {
            ...m,
            id: message.message_id,
            status: message.status,
            round: message.round
          };
        } else return m;
      });
    });
  }, []);

  const resolveBlockedEvent = useCallback(async (event: DBMessage) => {
    if (event.type === 3) {
      handleReactionReceived(event);
    } else if (event.type === 1) {
      const mappedMessages = await mapDbMessagesToMessages([event]);

      if (mappedMessages.length) {
        const newMessage = mappedMessages[0];

        setMessages(prev => {
          // Sorting if needed
          if (prev.length === 0) {
            return [newMessage];
          } else {
            const channelMessages = prev.filter(
              m => m.channelId === newMessage.channelId
            );

            // This is the first message for this channel
            if (channelMessages.length === 0) {
              return [...prev, newMessage];
            } else {
              const lastChannelMessageTimestamp = new Date(
                channelMessages[channelMessages.length - 1].timestamp
              ).getTime();
              const newMessageTimestamp = new Date(
                newMessage.timestamp
              ).getTime();

              // No need to sort
              if (newMessageTimestamp >= lastChannelMessageTimestamp) {
                return [...prev, newMessage];
              } else {
                const newMessages = [...prev, newMessage];
                const sortedNewMessages = newMessages.sort((x, y) => {
                  return (
                    new Date(x.timestamp).getTime() -
                    new Date(y.timestamp).getTime()
                  );
                });
                return sortedNewMessages;
              }
            }
          }
        });
      }
    }
  }, [handleReactionReceived, mapDbMessagesToMessages]);

  const checkIfWillResolveBlockedEvent = useCallback((receivedMessage: DBMessage) => {
    const blockedEventsToResolve = blockedEvents.filter(
      e => e.parent_message_id === receivedMessage.message_id
    );

    if (blockedEventsToResolve?.length) {
      setBlockedEvents(
        (evts) => evts.filter(
          (e) => e.parent_message_id !== 
            blockedEventsToResolve[0].parent_message_id
        )
      );
      blockedEventsToResolve.forEach(e => {
        resolveBlockedEvent(e);
      });
    }
  }, [blockedEvents, resolveBlockedEvent]);

  const handleMessageEvent = useCallback(async ({ messageId, update }: events.MessageReceivedEvent) => {
    if (db && cipher?.decrypt) {
      const receivedMessage = await db.table<DBMessage>('messages').get(messageId);

      if (receivedMessage?.hidden === true) {
        return;
      }

      if (update && receivedMessage) {
        if ([1, 2, 3].includes(receivedMessage.status)) {
          updateSenderMessageStatus(receivedMessage);
          return;
        }
      }

      if (receivedMessage?.parent_message_id
          && receivedMessage?.pubkey !== channelIdentity?.PubKey) {
        const replyingTo = await db.table<DBMessage>('messages').where('message_id').equals(receivedMessage?.parent_message_id).first();
        if (replyingTo?.pubkey === channelIdentity?.PubKey) {
          const { codename } = getCodeNameAndColor(receivedMessage.pubkey, receivedMessage.codeset_version);
          messageReplied(
            receivedMessage.nickname || codename,
            cipher.decrypt(receivedMessage.text)
          )
        }
      }

      if (receivedMessage?.type === DBMessageType.Reaction) {
        // It's reaction event
        handleReactionReceived(receivedMessage);
      } else if (receivedMessage && receivedMessage?.type === DBMessageType.Normal) {
        const receivedMessageChannelId = receivedMessage?.channel_id;

        if (receivedMessageChannelId !== currentChannelRef?.current?.id) {
          setChannels(prev => {
            return prev.map(ch => {
              if (ch?.id === receivedMessageChannelId) {
                return {
                  ...ch,
                  withMissedMessages: true
                };
              } else {
                return ch;
              }
            });
          });
        }

        // It's normal message or reply to message event
        const mappedMessages = await mapDbMessagesToMessages([receivedMessage]);
        if (mappedMessages.length) {
          const newMessage = mappedMessages[0];
          setMessages((prev) => {
            // Sorting if needed
            if (prev.length === 0) {
              return [newMessage];
            } else {
              const channelMessages = prev.filter(
                m => m.channelId === newMessage.channelId
              );

              // This is the first message for this channel
              if (channelMessages.length === 0) {
                return [...prev, newMessage];
              } else {
                const lastChannelMessageTimestamp = new Date(
                  channelMessages[channelMessages.length - 1].timestamp
                ).getTime();
                const newMessageTimestamp = new Date(
                  newMessage.timestamp
                ).getTime();

                // No need to sort
                if (newMessageTimestamp >= lastChannelMessageTimestamp) {
                  return [...prev, newMessage];
                } else {
                  const newMessages = [...prev, newMessage];
                  const sortedNewMessages = newMessages.sort((x, y) => {
                    return (
                      new Date(x.timestamp).getTime() -
                      new Date(y.timestamp).getTime()
                    );
                  });
                  return sortedNewMessages;
                }
              }
            }
          });
        }
      }
      if (receivedMessage) {
        checkIfWillResolveBlockedEvent(receivedMessage);
      }
    }
  }, [
    channelIdentity?.PubKey,
    checkIfWillResolveBlockedEvent,
    cipher,
    db,
    getCodeNameAndColor,
    handleReactionReceived,
    mapDbMessagesToMessages,
    messageReplied,
    updateSenderMessageStatus
  ]);

  useEffect(() => {
    events.bus.addListener(events.RECEIVED_MESSAGE, handleMessageEvent);

    return () => { events.bus.removeListener('message', handleMessageEvent) };
  }, [handleMessageEvent])

  const mapInitialLoadDataToCurrentState = useCallback(async (
    channs: DBChannel[],
    msgs: DBMessage[]
  ) => {
    const mappedChannels = channs.map((c) => {
      return { ...c }; // Find a way to get the pretty print for the returned channels
    });

    const mappedMessages = await mapDbMessagesToMessages(msgs);

    return { mappedChannels, mappedMessages };
  }, [mapDbMessagesToMessages]);

  const fetchReactions = useCallback(async () => {
    const allReactionMessages = await db?.table<DBMessage>('messages')
      .filter((e) => {
        return !e.hidden && e.type === 3;
      })
      .toArray() ?? [];
      
    const reactionsDecrypted = allReactionMessages?.filter((r) => r.parent_message_id !== null)
      .map(dbMessageToReaction);

    const mapped = reactionsDecrypted?.reduce((map, { codename, emoji, reactingTo }) => {
      return {
        ...map,
        [reactingTo]: {
          ...map[reactingTo],
          [emoji]: uniq(map[reactingTo]?.[emoji]?.concat(codename) ?? [codename]),
        }
        
      };
    }, {} as EmojiReactions);

    setMessageReactions(mapped);
  }, [db, dbMessageToReaction]);

  const handleInitialLoadData = useCallback(async () => {
    assert(db);
    assert(cmix);
    assert(channelManager);

    const fetchedChannels = await db.table<DBChannel>('channels').toArray();

    const channelsIds = fetchedChannels.map(ch => ch.id);

    const groupedMessages = await Promise.all(
      channelsIds.map(async chId => {
        if (!db) {
          throw new Error('Dexie initialization error');
        }

        return db.table<DBMessage>('messages')
          .orderBy('timestamp')
          .reverse()
          .filter(m => {
            return !m.hidden && m.channel_id === chId && m.type === 1;
          })
          .limit(batchCount)
          .toArray();
      })
    );
    let msgs: DBMessage[] = [];

    groupedMessages.forEach(g => {
      msgs = [...msgs, ..._.reverse(g)];
    });

    const result = await mapInitialLoadDataToCurrentState(
      fetchedChannels,
      msgs
    );

    const mappedMessages = result.mappedMessages;
    const mappedChannels = result.mappedChannels;

    setChannels(
      mappedChannels.map((ch: DBChannel) => {
        return {
          ...ch,
          privacyLevel: getPrivacyLevel(ch.id),
          isAdmin: channelManager.IsChannelAdmin(utils.Base64ToUint8Array(ch.id)),
          currentMessagesBatch: 1
        };
      })
    );

    setMessages(mappedMessages);
  }, [
    channelManager,
    cmix,
    db,
    getPrivacyLevel,
    mapInitialLoadDataToCurrentState,
    utils
  ]);

  useEffect(() => {
    if (messages && cipher && channelManager) {
      fetchReactions();
    }
  }, [channelManager, cipher, fetchReactions, messages])

  useEffect(() => {
    if (db && channelManager && cmix) {
      handleInitialLoadData();
    }
  }, [channelManager, cmix, db, handleInitialLoadData])

  const loadChannelManager = useCallback(async () => {
    if (
      cmix &&
      cipher &&
      utils &&
      storageTag
    ) {
      const loadedChannelsManager = await utils
        .LoadChannelsManagerWithIndexedDb(
          cmix.GetID(),
          storageTag,
          events.onMessageReceived,
          events.onMessageDelete,
          events.onMutedUser,
          cipher?.id
        );

      setChannelManager(loadedChannelsManager);
    }
  }, [cipher, cmix, storageTag, utils]);

  useEffect(() => {
    if (cmix && cipher && utils && storageTag) {
      loadChannelManager();
    }
  }, [cipher, cmix, loadChannelManager, storageTag, utils]);

  const getMutedUsers = useCallback(async () => {
    let users: User[] = [];

    if (currentChannel && channelManager && db) {
      const mutedUserIds = JSON.parse(decoder.decode(channelManager?.GetMutedUsers(
        utils.Base64ToUint8Array(currentChannel.id)
      ))) as string[];

      const usersMap = (await db.table<DBMessage>('messages')
        .filter((obj) => obj.channel_id === currentChannel.id && mutedUserIds.includes(obj.pubkey))
        .toArray() || []).reduce((acc, cur) => {
          if (mutedUserIds.includes(cur.pubkey) && !acc.get(cur.pubkey)) {
            const { codename: codename, color } = getCodeNameAndColor(cur.pubkey, cur.codeset_version);
            acc.set(
              cur.pubkey, {
                codename,
                color,
                pubkey: cur.pubkey
              }
            );
          }
          return acc;
        }, new Map<string, User>()).values();
      
      users = Array.from(usersMap);
      setBannedUsers(users);
    }

    return users;
  }, [channelManager, currentChannel, db, getCodeNameAndColor, utils]);

  useEffect(() => {
    const listener = () => {
      getMutedUsers();
    }
    events.bus.addListener(events.USER_MUTED, listener);

    return () => { events.bus.removeListener(events.USER_MUTED, listener); };
  }, [getMutedUsers]);

  const createChannelManager = useCallback(async (privateIdentity: Uint8Array) => {
    if (
      cmix &&
      cipher &&
      utils &&
      utils.NewChannelsManagerWithIndexedDb
    ) {
      const createdChannelManager = await utils.NewChannelsManagerWithIndexedDb(
        cmix.GetID(),
        privateIdentity,
        events.onMessageReceived,
        events.onMessageDelete,
        events.onMutedUser,
        cipher.id
      );
      
      setChannelManager(createdChannelManager);
      const tag = createdChannelManager.GetStorageTag();
      addStorageTag(tag);
    }
  }, [
    cipher,
    cmix,
    utils,
    addStorageTag
  ]);

  useEffect(() => {
    if (!currentChannel && channels.length) {
      setCurrentChannel(channels[0]);
    }
  }, [channels, currentChannel]);

  const loadMoreChannelData = useCallback(async (chId: string) => {
    if (db) {
      const foundChannel = channels.find(ch => ch.id === chId);
      const currentChannelBatch = foundChannel?.currentMessagesBatch || 1;
      const newMessages = await db
        .table<DBMessage>('messages')
        .orderBy('timestamp')
        .reverse()
        .filter(m => {
          return !m.hidden && m.channel_id === chId && m.type === 1;
        })
        .offset(currentChannelBatch * batchCount)
        .limit(batchCount)
        .toArray();

      const result = await mapInitialLoadDataToCurrentState([], newMessages);
      // Here we should apply the reactions then change the state
      const { mappedMessages } = result;

      if (mappedMessages.length) {
        setMessages(prev => {
          return [..._.reverse(mappedMessages), ...prev];
        });

        setChannels((prevChannels: Channel[]) => {
          return prevChannels.map(ch => {
            if (ch.id === chId) {
              return {
                ...ch,
                currentMessagesBatch: currentChannelBatch + 1
              };
            } else {
              return ch;
            }
          });
        });
      }
    }
  }, [
    db,
    channels,
    mapInitialLoadDataToCurrentState
  ]);

  const joinChannelFromURL = useCallback((url: string, password = '') => {
    if (cmix && channelManager && channelManager.JoinChannelFromURL) {
      try {
        const chanInfo = JSON.parse(
          decoder.decode(channelManager.JoinChannelFromURL(url, password))
        );

        const temp: Channel = {
          id: chanInfo?.ChannelID,
          name: chanInfo?.Name,
          description: chanInfo?.Description,
          privacyLevel: getPrivacyLevel(chanInfo?.ChannelID),
          isAdmin: channelManager.IsChannelAdmin(utils.Base64ToUint8Array(chanInfo.ChannelID)),
          isLoading: true
        };
        setCurrentChannel(temp);
        setChannels([...channels, temp]);
        setTimeout(() => {
          setCurrentChannel((prev) => {
            if (prev && prev?.id === temp.id) {
              return {
                ...prev,
                isLoading: false
              };
            } else {
              return prev;
            }
          });
          setChannels(prev => {
            return prev.map(ch => {
              if (ch.id === temp.id) {
                return {
                  ...temp,
                  isLoading: false
                };
              } else {
                return ch;
              }
            });
          });
        }, 5000);
      } catch (error) {
        console.error('Error joining channel')
      }
    } else {
      return null;
    }
  }, [channelManager, channels, cmix, getPrivacyLevel, utils]);

  const getChannelInfo = useCallback((prettyPrint: string) => {
    if (utils && utils.GetChannelInfo && prettyPrint.length) {
      return JSON.parse(decoder.decode(utils.GetChannelInfo(prettyPrint)));
    }
    return {};
  }, [utils]);

  const createChannel = useCallback(async (
    channelName: string,
    channelDescription: string,
    privacyLevel: PrivacyLevel.Public | PrivacyLevel.Secret
  ) => {
      if (cmix && channelName && channelManager) {
        const channelPrettyPrint = await channelManager?.GenerateChannel(
          channelName,
          channelDescription || '',
          privacyLevel,
        );
   
        const channelInfo = getChannelInfo(channelPrettyPrint || '') as ChannelJSON;

        const temp: Channel = {
          id: channelInfo?.ChannelID,
          name: channelInfo?.Name,
          isAdmin: true,
          privacyLevel,
          description: channelInfo?.Description,
          prettyPrint: channelPrettyPrint,
          isLoading: false
        };
        joinChannel(channelPrettyPrint, false);
        savePrettyPrint(temp.id, channelPrettyPrint);
        setCurrentChannel(temp);
        setChannels([...channels, temp]);
      }
  }, [
    cmix,
    channelManager,
    getChannelInfo,
    joinChannel,
    channels
  ]);

  const shareChannel = () => {};

  const leaveCurrentChannel = useCallback(async () => {
    if (currentChannel && channelManager && channelManager.LeaveChannel && utils) {
      try {
        channelManager.LeaveChannel(
          utils.Base64ToUint8Array(currentChannel.id)
        );
        const temp = currentChannel;
        const channelId = temp.id;
        setMessages(prev => {
          return prev.filter(m => m.channelId !== channelId);
        });
        setCurrentChannel(undefined);
        setChannels(
          channels.filter((c: Channel) => {
            return c.id != temp.id;
          })
        );
      } catch (error) {
        console.error('Failed to leave Channel.');
      }
    }
  }, [channelManager, channels, currentChannel, utils]);

  const sendMessage = useCallback(async (message: string) => {
    if (
      message.length &&
      channelManager &&
      utils &&
      utils.Base64ToUint8Array &&
      currentChannel
    ) {
      try {
        await channelManager.SendMessage(
          utils.Base64ToUint8Array(currentChannel.id),
          message,
          30000,
          new Uint8Array()
        );
      } catch (e) {
        console.error('Error sending message', e);
      }
    }
  }, [channelManager, currentChannel, utils]);

  const sendReply = useCallback(async (reply: string, replyToMessageId: string) => {
    if (
      reply.length &&
      channelManager &&
      utils &&
      utils.Base64ToUint8Array &&
      currentChannel
    ) {
      try {
        await channelManager.SendReply(
          utils.Base64ToUint8Array(currentChannel.id),
          reply,
          utils.Base64ToUint8Array(replyToMessageId),
          30000,
          new Uint8Array()
        );
      } catch (error) {
        console.error(`Test failed to reply to messageId ${replyToMessageId}`);
      }
    }
  }, [channelManager, currentChannel, utils]);

  const sendReaction = useCallback(async (reaction: string, reactToMessageId: string) => {
    if (channelManager && utils && utils.Base64ToUint8Array && currentChannel) {
      try {
        await channelManager.SendReaction(
          utils.Base64ToUint8Array(currentChannel.id),
          reaction,
          utils.Base64ToUint8Array(reactToMessageId),
          new Uint8Array()
        );
      } catch (error) {
        console.error(
          `Test failed to react to messageId ${reactToMessageId}`,
          error
        );
      }
    }
  }, [channelManager, currentChannel, utils]);

  const setNickName = useCallback((nickName: string) => {
    if (channelManager?.SetNickname && currentChannel?.id) {
      try {
        channelManager?.SetNickname(
          nickName,
          utils.Base64ToUint8Array(currentChannel?.id)
        );
        return true;
      } catch (error) {
        return false;
      }
    }
    return false;
  }, [channelManager, currentChannel?.id, utils]);

  const getNickName = useCallback(() => {
    let nickName = '';
    if (channelManager?.GetNickname && currentChannel) {
      try {
        nickName = channelManager?.GetNickname(
          utils.Base64ToUint8Array(currentChannel?.id)
        );
      } catch (error) {
        nickName = '';
      }
    }
    return nickName;
  }, [channelManager, currentChannel, utils]);

  // Identity object is combination of private identity and code name
  const generateIdentities = useCallback((amountOfIdentities: number) => {
    const identitiesObjects = [];
    if (utils && utils.GenerateChannelIdentity && cmix) {
      for (let i = 0; i < amountOfIdentities; i++) {
        const privateIdentity = utils.GenerateChannelIdentity(cmix?.GetID());
        const publicIdentity = utils.GetPublicChannelIdentityFromPrivate(
          privateIdentity
        );
        const identity = JSON.parse(decoder.decode(publicIdentity)) as IdentityJSON;
        const codename = identity.Codename;
        identitiesObjects.push({ privateIdentity, codename });
      }
    }
    return identitiesObjects;
  }, [cmix, utils])

  const getVersion = useCallback(() => {
    if (utils && utils.GetVersion) {
      return utils.GetVersion();
    } else return null;
  }, [utils]);

  const getClientVersion = useCallback(() => {
    if (utils && utils.GetClientVersion) {
      return utils.GetClientVersion();
    } else return null;
  }, [utils]);

  const exportPrivateIdentity = useCallback((password: string) => {
    if (utils && utils.GetOrInitPassword) {
      try {
        const statePassEncoded = utils.GetOrInitPassword(password);

        if (
          statePassEncoded &&
          channelManager &&
          channelManager.ExportPrivateIdentity
        ) {
          const data = channelManager.ExportPrivateIdentity(password);
          exportDataToFile(data);
          return statePassEncoded;
        }
      } catch (error) {
        return false;
      }
    }
    return false;
  }, [channelManager, utils]);

  const checkRegistrationReadiness = useCallback((
    selectedPrivateIdentity: Uint8Array,
    onIsReadyInfoChange: (readinessInfo: IsReadyInfo) => void
  ) => {
    return new Promise<void>((resolve) => {
      const intervalId = setInterval(() => {
        if (cmix) {
          const isReadyInfo = JSON.parse(decoder.decode(cmix?.IsReady(0.7))) as IsReadyInfo;

          onIsReadyInfoChange(isReadyInfo);
          if (isReadyInfo.IsReady) {
            clearInterval(intervalId);
            setTimeout(() => {
              createChannelManager(selectedPrivateIdentity);
              setIsReadyToRegister(true);
              resolve();
            }, 3000);
          }
        }
      }, 1000);
    });
  }, [createChannelManager, cmix]);

  const logout = useCallback((password: string) => {
    if (utils && utils.Purge && cmix && cmix.StopNetworkFollower) {
      try {
        cmix.StopNetworkFollower();
        utils.Purge(STATE_PATH, password);
        window.localStorage.clear();
        Cookies.remove('userAuthenticated', { path: '/' });
        setIsAuthenticated(false);
        setIsReadyToRegister(undefined);
        setIsNetworkHealthy(undefined);
        setChannels([]);
        setCurrentChannel(undefined);
        setChannelManager(undefined);
        setMessages([]);
        setBlockedEvents([]);
        currentCodeNameRef.current = '';
        currentChannelRef.current = undefined;

        return true;
      } catch (error) {
        console.error(error);
        // If something wrong happened like wrong password then we should start network follower again
        cmix.StartNetworkFollower(50000);
        return false;
      }
    } else {
      return false;
    }
  }, [cmix, setIsAuthenticated, utils]);

  const muteUser = useCallback(async (pubkey: string, muted: boolean) => {
    if (currentChannel) {
      await channelManager?.MuteUser(
        utils.Base64ToUint8Array(currentChannel?.id),
        utils.Base64ToUint8Array(pubkey),
        muted,
        utils.ValidForever(),
        utils.GetDefaultCMixParams()
      )
    }
  }, [channelManager, currentChannel, utils]);

  const deleteMessage = useCallback(async ({ channelId, id }: Message) => {
    await channelManager?.DeleteMessage(
      utils.Base64ToUint8Array(channelId),
      utils.Base64ToUint8Array(id),
      utils.GetDefaultCMixParams()
    );

    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, [channelManager, utils]);

  useEffect(() => {
    const listener = (evt: events.MessageDeletedEvent) => {
      setMessages((msgs) => msgs.filter((msg) => msg.id !== evt.messageId));
      setPinnedMessages((msgs) => msgs?.filter((msg) => msg.id !== evt.messageId));
    };

    events.bus.addListener(events.MESSAGE_DELETED, listener);

    return () => { events.bus.removeListener(events.MESSAGE_DELETED, listener); }
  }, [])

  useEffect(() => {
    getMutedUsers();
  }, [currentChannel, getMutedUsers]);

  const userIsBanned = useCallback(
    (pubkey: string) => !!mutedUsers?.find((u) => u.pubkey === pubkey),
    [mutedUsers]
  );

  const pinMessage = useCallback(async ({ id }: Message, unpin = false) => {
    if (currentChannel && channelManager) {
      await channelManager.PinMessage(
        utils.Base64ToUint8Array(currentChannel?.id),
        utils.Base64ToUint8Array(id),
        unpin,
        PIN_MESSAGE_LENGTH_MILLISECONDS,
        utils.GetDefaultCMixParams()
      )
    }
  }, [channelManager, currentChannel, utils]);

  const fetchPinnedMessages = useCallback(async (): Promise<Message[]> => {
    if (db && currentChannel) {
      const fetchedPinnedMessages = await db.table<DBMessage>('messages')
        .filter((m) => m.pinned && !m.hidden && m.channel_id === currentChannel.id)
        .toArray()
        .then(mapDbMessagesToMessages);

      
      setPinnedMessages(fetchedPinnedMessages);

      return fetchedPinnedMessages;
    }
    return [];
  }, [currentChannel, db, mapDbMessagesToMessages]);

  const getMuted = useCallback(() => {
    if (currentChannel && channelManager) {
      return channelManager?.Muted(utils.Base64ToUint8Array(currentChannel.id))
    }
    return false;
  }, [channelManager, currentChannel, utils]);

  const previouslyPinned = usePrevious(pinnedMessages);
  const previousChannel = usePrevious(currentChannel);
  const [notified, setNotified] = useState<string[]>([]);

  useEffect(() => {
    if (currentChannel) {
      setPinnedMessages(undefined);
      fetchPinnedMessages();
    }
  }, [currentChannel, fetchPinnedMessages]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchPinnedMessages();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchPinnedMessages]);


  useEffect(() => {
    const notInitialLoad = previouslyPinned !== undefined;

    if (notInitialLoad && pinnedMessages) {
      const previouslyPinnedIds = previouslyPinned?.map((message) => message.id);
      const newPinnedMessages = pinnedMessages
        .filter(({ id }) => !previouslyPinnedIds.includes(id) && !notified.includes(id));
      if (newPinnedMessages.length > 0) {
        setNotified((notifieds) => notifieds.concat(newPinnedMessages.map((m) => m.id)))
        newPinnedMessages.forEach((m) => {
          const foundChannel = channels.find((c) => c.id === m.channelId);
          if (foundChannel) {
            messagePinned(m.body, foundChannel.name);
          }
        });
      }
    }
  }, [
    channels,
    currentChannel,
    messagePinned,
    notified,
    pinnedMessages,
    previousChannel?.id,
    previouslyPinned
  ]);

  const exportChannelAdminKeys = useCallback((encryptionPassword: string) => {
    if (channelManager && currentChannel) {
      return decoder.decode(channelManager.ExportChannelAdminKey(
        utils.Base64ToUint8Array(currentChannel.id),
        encryptionPassword
      ));
    }
    throw Error('Channel manager and current channel required.');
  }, [channelManager, currentChannel, utils]);


  const importChannelAdminKeys = useCallback((encryptionPassword: string, privateKey: string) => {
    if (channelManager && currentChannel) {
      channelManager.ImportChannelAdminKey(
        utils.Base64ToUint8Array(currentChannel.id),
        encryptionPassword,
        encoder.encode(privateKey)
      );
    } else {
      throw Error('Channel manager and current channel required.');
    }
  }, [channelManager, currentChannel, utils]);

  const [isMuted, setIsMuted] = useState(false);
  useEffect(() => {
    const checkMuted = () => setIsMuted(getMuted);
    if (currentChannel?.id) {
      checkMuted();
    }

    events.bus.addListener(events.USER_MUTED, checkMuted);

    return () => { events.bus.removeListener(events.USER_MUTED, checkMuted); }
  }, [currentChannel?.id, getMuted]);


  const ctx: NetworkContext = {
    channelIdentity,
    decryptMessageContent: cipher?.decrypt,
    getMutedUsers,
    initialize,
    mutedUsers,
    isMuted,
    exportChannelAdminKeys,
    importChannelAdminKeys,
    userIsMuted: userIsBanned,
    setMutedUsers: setBannedUsers,
    muteUser,
    getMuted,
    cmix,
    deleteMessage,
    fetchPinnedMessages,
    joinChannel,
    createChannel,
    shareChannel,
    channels,
    messageReactions,
    setMessageReactions,
    messages,
    setMessages,
    currentChannel,
    mapDbMessagesToMessages,
    setCurrentChannel,
    sendMessage,
    leaveCurrentChannel,
    generateIdentities: generateIdentities,
    createChannelManager,
    loadChannelManager,
    handleInitialLoadData,
    setNickName,
    getNickName,
    getIdentity,
    sendReply,
    sendReaction,
    getPrettyPrint,
    getShareURL,
    getShareUrlType,
    joinChannelFromURL,
    pinnedMessages,
    setPinnedMessages,
    getVersion,
    getClientVersion,
    loadMoreChannelData,
    exportPrivateIdentity,
    getCodeNameAndColor,
    isNetworkHealthy,
    isReadyToRegister,
    setIsReadyToRegister,
    checkRegistrationReadiness,
    pinMessage,
    logout,
    upgradeAdmin
  }

  return (
    <NetworkClientContext.Provider
      value={ctx}
      {...props}
    />
  );
};

export const useNetworkClient = () => {
  const context = React.useContext(NetworkClientContext);
  if (context === undefined) {
    throw new Error('useNetworkClient must be used within a NetworkProvider');
  }
  return context;
};

export const ManagedNetworkContext: FC<WithChildren> = ({ children }) => (
  <NetworkProvider>{children}</NetworkProvider>
);
