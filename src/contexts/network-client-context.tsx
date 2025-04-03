import {
  CMix,
  DBMessage,
  DBChannel,
  ChannelJSON,
  ShareURLJSON,
  IsReadyInfoJSON,
  MessageReceivedEvent,
  ChannelNotificationLevel,
  NotificationStatus,
  MessageStatus,
  MessageId
} from 'src/types';
import { MessageType, PrivacyLevel, type Message, type WithChildren } from 'src/types';

import React, { FC, useState, useEffect, useCallback, useMemo } from 'react';

import Cookies from 'js-cookie';

import {
  AppEvents,
  ChannelEvents,
  appBus,
  awaitChannelEvent,
  onChannelEvent,
  useChannelsListener
} from 'src/events';
import { HTMLToPlaintext, decoder, encoder, exportDataToFile } from 'src/utils';
import { inflate } from 'src/utils/compression';
import { useAuthentication } from 'src/contexts/authentication-context';
import { useUtils } from 'src/contexts/utils-context';
import {
  MESSAGE_LEASE,
  PIN_MESSAGE_LENGTH_MILLISECONDS,
  CMIX_NETWORK_READINESS_THRESHOLD
} from '../constants';

import { useDb } from './db-context';
import useCmix, { NetworkStatus } from 'src/hooks/useCmix';
import { useAppDispatch, useAppSelector } from 'src/store/hooks';
import * as app from 'src/store/app';
import * as channels from 'src/store/channels';
import * as identity from 'src/store/identity';
import * as messages from 'src/store/messages';
import * as dms from 'src/store/dms';
import { Channel } from 'src/store/channels/types';
import usePagination from 'src/hooks/usePagination';
import useDmClient from 'src/hooks/useDmClient';
import {
  channelDecoder,
  identityDecoder,
  isReadyInfoDecoder,
  pubkeyArrayDecoder,
  shareUrlDecoder,
  versionDecoder
} from '@utils/decoders';
import useChannelsStorageTag from 'src/hooks/useChannelsStorageTag';

import { channelsIndexedDbWorkerPath } from 'xxdk-wasm';

const BATCH_COUNT = 1000;

export type User = {
  codename: string;
  codeset: number;
  color: string;
  pubkey: string;
};

export type ChannelManager = {
  GetID: () => number;
  AreDMsEnabled: (channelId: Uint8Array) => boolean;
  DisableDirectMessages: (channelId: Uint8Array) => void;
  EnableDirectMessages: (channelId: Uint8Array) => void;
  JoinChannel: (prettyPrint: string) => Promise<Uint8Array>;
  LeaveChannel: (channelId: Uint8Array) => Promise<void>;
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
    cmixParams: Uint8Array,
    tags: Uint8Array
  ) => Promise<Uint8Array>;
  PinMessage: (
    channelId: Uint8Array,
    messageId: Uint8Array,
    unpin: boolean,
    pinDurationInMilliseconds: number,
    cmixParams: Uint8Array
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
    messageValidityTimeoutMilliseconds: number,
    cmixParams: Uint8Array
  ) => Promise<Uint8Array>;
  SendReply: (
    channelId: Uint8Array,
    message: string,
    messageToReactTo: Uint8Array,
    messageValidityTimeoutMilliseconds: number,
    cmixParams: Uint8Array,
    tags: Uint8Array
  ) => Promise<Uint8Array>;
  IsChannelAdmin: (channelId: Uint8Array) => boolean;
  GetNotificationLevel: (channelId: Uint8Array) => ChannelNotificationLevel;
  GetNotificationStatus: (channelId: Uint8Array) => NotificationStatus;
  SetMobileNotificationsLevel: (
    channelId: Uint8Array,
    notificationLevel: ChannelNotificationLevel,
    notificationStatus: NotificationStatus
  ) => void;
  GenerateChannel: (
    channelname: string,
    description: string,
    privacyLevel: PrivacyLevel
  ) => Promise<string>;
  GetStorageTag: () => string | undefined;
  SetNickname: (newNickname: string, channel: Uint8Array) => void;
  GetNickname: (channelId: Uint8Array) => string;
  GetIdentity: () => Uint8Array;
  GetShareURL: (cmixId: number, host: string, maxUses: number, channelId: Uint8Array) => Uint8Array;
  JoinChannelFromURL: (url: string, password: string) => Uint8Array;
  ExportPrivateIdentity: (password: string) => Uint8Array;
  ExportChannelAdminKey: (channelId: Uint8Array, encryptionPassword: string) => Uint8Array;
  ImportChannelAdminKey: (
    channelId: Uint8Array,
    encryptionPassword: string,
    privateKey: Uint8Array
  ) => void;
};

export type NetworkContext = {
  // state
  mutedUsers: User[] | undefined;
  setMutedUsers: React.Dispatch<React.SetStateAction<User[] | undefined>>;
  cmix?: CMix;
  networkStatus?: NetworkStatus;
  isNetworkHealthy: boolean | undefined;
  // api
  checkRegistrationReadiness: (
    selectedPrivateIdentity: Uint8Array,
    onIsReadyInfoChange: (readinessInfo: IsReadyInfoJSON) => void
  ) => Promise<void>;
  pagination: ReturnType<typeof usePagination>;
  createChannel: (
    channelName: string,
    channelDescription: string,
    privacyLevel: 0 | 2,
    enableDms: boolean
  ) => void;
  decryptMessageContent?: (text: string) => string;
  upgradeAdmin: () => void;
  deleteMessage: (message: Pick<Message, 'id' | 'channelId'>) => Promise<void>;
  exportChannelAdminKeys: (encryptionPassword: string) => string;
  generateIdentities: (amountOfIdentites: number) => {
    codename: string;
    privateIdentity: Uint8Array;
    codeset: number;
    pubkey: string;
  }[];
  joinChannel: (prettyPrint: string, appendToCurrent?: boolean, enabledms?: boolean) => void;
  importChannelAdminKeys: (encryptionPassword: string, privateKeys: string) => void;
  getMutedUsers: () => Promise<User[]>;
  muteUser: (pubkey: string, unmute: boolean) => Promise<void>;
  shareChannel: () => void;
  sendMessage: (message: string, tags?: string[]) => void;
  leaveCurrentChannel: () => void;
  createChannelManager: (privateIdentity: Uint8Array) => Promise<void>;
  loadChannelManager: (storageTag: string, cmix?: CMix) => Promise<void>;
  handleInitialLoadData: () => Promise<void>;
  getNickName: () => string;
  setNickname: (nickname: string) => boolean;
  sendReply: (reply: string, replyToMessageId: string, tags?: string[]) => Promise<void>;
  sendReaction: (reaction: string, reactToMessageId: string) => Promise<void>;
  getPrettyPrint: (channelId: string) => string | undefined;
  getShareURL: (channelId: string) => ShareURLJSON | null;
  getShareUrlType: (url: string) => PrivacyLevel | null;
  joinChannelFromURL: (url: string, password: string) => void;
  getVersion: () => string | null;
  getClientVersion: () => string | null;
  loadMoreChannelData: (channelId: string) => Promise<void>;
  exportPrivateIdentity: (password: string) => Promise<Uint8Array | false>;
  pinMessage: (message: MessageId, unpin?: boolean) => Promise<void>;
  logout: (password: string) => boolean;
  channelManager?: ChannelManager;
  fetchChannels: () => Promise<void>;
};

export const NetworkClientContext = React.createContext<NetworkContext>({
  cmix: undefined,
  networkStatus: NetworkStatus.DISCONNECTED,
  currentChannel: undefined,
  channels: [],
  messages: [],
  isNetworkHealthy: undefined
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

export const NetworkProvider: FC<WithChildren> = (props) => {
  const pagination = usePagination();
  const dispatch = useAppDispatch();
  const db = useDb();
  const { setIsAuthenticated } = useAuthentication();
  const { set: setStorageTag, value: storageTag } = useChannelsStorageTag();
  const { getCodeNameAndColor, utils } = useUtils();
  const [mutedUsers, setMutedUsers] = useState<User[]>();
  const { cipher, cmix, disconnect, id: cmixId, status: cmixStatus } = useCmix();
  const [channelManager, setChannelManager] = useState<ChannelManager | undefined>();
  const bc = useMemo(() => new BroadcastChannel('join_channel'), []);
  const currentChannelPages = useAppSelector(channels.selectors.channelPages);
  const currentConversationId = useAppSelector(app.selectors.currentChannelOrConversationId);
  const currentChannel = useAppSelector(channels.selectors.currentChannel);
  const currentChannels = useAppSelector(channels.selectors.channels);
  const currentMessages = useAppSelector(messages.selectors.currentChannelMessages);
  const allMessagesByChannelId = useAppSelector(messages.selectors.messagesByChannelId);
  const currentConversation = useAppSelector(dms.selectors.currentConversation);
  const {
    deleteDirectMessage,
    getDmNickname,
    sendDMReaction,
    sendDMReply,
    sendDirectMessage,
    setDmNickname
  } = useDmClient();

  const upgradeAdmin = useCallback(() => {
    if (currentChannel?.id) {
      dispatch(channels.actions.updateAdmin({ channelId: currentChannel.id }));
    }
  }, [dispatch, currentChannel]);

  const fetchIdentity = useCallback(
    (mngr?: ChannelManager) => {
      const manager = channelManager || mngr;
      try {
        const json = decoder.decode(manager?.GetIdentity());

        const parsed = identityDecoder(JSON.parse(json));

        dispatch(
          identity.actions.set({
            codename: parsed.codename,
            pubkey: parsed.pubkey,
            codeset: parsed.codeset,
            color: parsed.color.replace('0x', '#'),
            extension: parsed.extension
          })
        );
      } catch (error) {
        console.error(error);
        return null;
      }
    },
    [channelManager, dispatch]
  );

  const getShareURL = useCallback(
    (channelId: string) => {
      if (cmix && channelManager && utils && utils.Base64ToUint8Array && channelId) {
        try {
          const currentHostName = window.location.host;
          const res = channelManager.GetShareURL(
            cmix?.GetID(),
            `http://${currentHostName}/join`,
            0,
            utils.Base64ToUint8Array(channelId)
          );

          return shareUrlDecoder(JSON.parse(decoder.decode(res)));
        } catch (error) {
          return null;
        }
      } else {
        return null;
      }
    },
    [channelManager, cmix, utils]
  );

  const getShareUrlType = useCallback(
    (url?: string) => {
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
    },
    [utils]
  );

  const getPrivacyLevel = useCallback(
    (channelId: string) => getShareUrlType(getShareURL(channelId)?.url),
    [getShareURL, getShareUrlType]
  );

  const joinChannel = useCallback(
    async (prettyPrint: string, appendToCurrent = true, enableDms = true) => {
      if (prettyPrint && channelManager && channelManager.JoinChannel) {
        let chanInfo = channelDecoder(
          JSON.parse(decoder.decode(utils.GetChannelJSON(prettyPrint)))
        );

        if (currentChannels.find((c) => c.id === chanInfo.receptionId)) {
          return;
        }

        chanInfo = channelDecoder(
          JSON.parse(decoder.decode(await channelManager.JoinChannel(prettyPrint)))
        );

        if (chanInfo.channelId === undefined) {
          throw new Error('ChannelID was not found');
        }

        const channel: Channel = {
          id: chanInfo.receptionId || chanInfo.channelId,
          name: chanInfo.name,
          privacyLevel: getPrivacyLevel(chanInfo.receptionId || chanInfo.channelId),
          description: chanInfo.description,
          isAdmin: channelManager.IsChannelAdmin(utils.Base64ToUint8Array(chanInfo.channelId))
        };

        if (appendToCurrent) {
          dispatch(channels.actions.upsert(channel));
          dispatch(app.actions.selectChannelOrConversation(channel.id));
        }

        if (enableDms) {
          channelManager.EnableDirectMessages(utils.Base64ToUint8Array(channel.id));
        } else {
          channelManager.DisableDirectMessages(utils.Base64ToUint8Array(channel.id));
        }
      }
    },
    [channelManager, currentChannels, dispatch, getPrivacyLevel, utils]
  );

  useEffect(() => {
    bc.onmessage = async (event) => {
      if (event.data) {
        try {
          await joinChannel(event.data.prettyPrint, true, event.data.dmsEnabled);
        } catch (error) {}
      }
    };
  }, [bc, channelManager, joinChannel]);

  useEffect(() => {
    if (currentChannel && channelManager) {
      dispatch(
        channels.actions.updateDmsEnabled({
          channelId: currentChannel.id,
          enabled: channelManager.AreDMsEnabled(utils.Base64ToUint8Array(currentChannel.id))
        })
      );
    }
  }, [channelManager, currentChannel, dispatch, utils]);

  const dbMessageMapper = useCallback(
    (dbMsg: DBMessage): Message => {
      if (!cipher) throw new Error('Cipher required');

      const decrypted = cipher.decrypt(dbMsg.text);
      const inflated = dbMsg.type !== MessageType.Reaction ? inflate(decrypted) : decrypted;
      const plaintext = HTMLToPlaintext(inflated);

      return {
        ...getCodeNameAndColor(dbMsg.pubkey, dbMsg.codeset_version),
        id: dbMsg.message_id,
        body: inflated ?? undefined,
        repliedTo: dbMsg.parent_message_id,
        plaintext,
        type: dbMsg.type,
        timestamp: dbMsg.timestamp,
        nickname: dbMsg.nickname || '',
        channelId: dbMsg.channel_id,
        status: dbMsg.status as unknown as MessageStatus,
        uuid: dbMsg.id,
        round: dbMsg.round,
        pubkey: dbMsg.pubkey,
        pinned: dbMsg.pinned,
        hidden: dbMsg.hidden,
        codeset: dbMsg.codeset_version,
        dmToken: dbMsg.dm_token === 0 ? undefined : dbMsg.dm_token
      };
    },
    [cipher, getCodeNameAndColor]
  );

  const handleMessageEvent = useCallback(
    async ({ uuid }: MessageReceivedEvent) => {
      if (db && cipher?.decrypt) {
        const receivedMessage = await db.table<DBMessage>('messages').get(uuid);

        if (receivedMessage) {
          const mappedMessage = dbMessageMapper(receivedMessage);
          const oldMessage = allMessagesByChannelId[mappedMessage.channelId]?.[mappedMessage.uuid];

          dispatch(messages.actions.upsert(mappedMessage));

          if (mappedMessage.status === MessageStatus.Delivered) {
            appBus.emit(AppEvents.MESSAGE_PROCESSED, mappedMessage, oldMessage);
          }

          if (receivedMessage.channel_id !== currentChannel?.id) {
            dispatch(app.actions.notifyNewMessage(mappedMessage));
          }
        }
      }
    },
    [allMessagesByChannelId, cipher?.decrypt, currentChannel?.id, db, dbMessageMapper, dispatch]
  );

  useChannelsListener(ChannelEvents.MESSAGE_RECEIVED, handleMessageEvent);

  const fetchChannels = useCallback(async () => {
    console.log('fetchedChannels');
    if (!db || !channelManager) throw new Error('DB and channel manager required');

    const fetchedChannels = await db.table<DBChannel>('channels').toArray();

    console.log('fetchedChannels', JSON.stringify(fetchedChannels));

    const channelList = fetchedChannels.map((ch: DBChannel) => ({
      ...ch,
      privacyLevel: getPrivacyLevel(ch.id),
      isAdmin: channelManager.IsChannelAdmin(utils.Base64ToUint8Array(ch.id))
    }));

    channelList.forEach((channel) => dispatch(channels.actions.upsert(channel)));
  }, [channelManager, db, dispatch, getPrivacyLevel, utils]);

  const fetchMessages = useCallback(async () => {
    if (!db) throw new Error('DB required to fetch messages');
    const msgs: DBMessage[] = await db
      .table<DBMessage>('messages')
      .orderBy('timestamp')
      .reverse()
      .filter((m) => !m.hidden)
      .toArray();

    const mappedMessages = msgs.map(dbMessageMapper);

    dispatch(messages.actions.upsertMany(mappedMessages));
  }, [db, dbMessageMapper, dispatch]);

  const fetchInitialData = useCallback(async () => {
    console.log('Fetching initial data...');
    if (!channelManager) {
      console.log('No channel manager available');
      return;
    }

    try {
      fetchIdentity();
      await fetchChannels();
      await fetchMessages();
      appBus.emit(AppEvents.MESSAGES_FETCHED, true);
    } catch (err) {
      console.error('Error fetching initial data:', err);
    }
  }, [channelManager, fetchChannels, fetchIdentity, fetchMessages]);

  useEffect(() => {
    if (!currentChannel && currentChannels.length > 0 && currentConversationId === null) {
      dispatch(app.actions.selectChannelOrConversation(currentChannels[0]?.id));
    }
  }, [currentChannel, currentChannels, currentConversationId, dispatch]);

  const loadChannelManager = useCallback(
    async (tag: string) => {
      console.log('Loading channel manager with tag:', tag);
      if (cmixId !== undefined && cipher && utils) {
        const notifications = utils.LoadNotificationsDummy(cmixId);
        const loadedChannelsManager = await utils.LoadChannelsManagerWithIndexedDb(
          cmixId,
          (await channelsIndexedDbWorkerPath()).toString(),
          tag,
          new Uint8Array(),
          notifications.GetID(),
          { EventUpdate: onChannelEvent },
          cipher?.id
        );

        setChannelManager(loadedChannelsManager);
        appBus.emit(AppEvents.CHANNEL_MANAGER_LOADED, loadedChannelsManager);
      }
    },
    [cipher, cmixId, utils]
  );

  useEffect(() => {
    console.log('Ready load channel manager dependencies:', {
      hasCmix: !!cmix,
      hasCipher: !!cipher,
      hasUtils: !!utils,
      storageTag
    });

    if (cmix && cipher && utils) {
      if (storageTag) {
        loadChannelManager(storageTag);
      } else {
        console.log(
          'No storage tag found, channel manager should have been created during registration/import'
        );
      }
    }
  }, [cipher, cmix, loadChannelManager, storageTag, utils]);

  const createChannelManager = useCallback(
    async (privIdentity: Uint8Array) => {
      console.log('Creating channel manager...');
      if (cmixId !== undefined && cipher && utils && utils.NewChannelsManagerWithIndexedDb) {
        const workerPath = (await channelsIndexedDbWorkerPath()).toString();
        const notifications = utils.LoadNotificationsDummy(cmixId);
        const createdChannelManager = await utils.NewChannelsManagerWithIndexedDb(
          cmixId,
          workerPath,
          privIdentity,
          new Uint8Array(),
          notifications.GetID(),
          { EventUpdate: onChannelEvent },
          cipher.id
        );

        const tag = createdChannelManager.GetStorageTag();
        console.log('Got storage tag from creation:', tag);
        if (tag) {
          setStorageTag(tag);
        }

        setChannelManager(createdChannelManager);
        appBus.emit(AppEvents.CHANNEL_MANAGER_LOADED, createdChannelManager);
      }
    },
    [cmixId, cipher, utils, setStorageTag]
  );

  const getMutedUsers = useCallback(async () => {
    let users: User[] = [];

    if (currentChannel && channelManager && db) {
      const mutedUserIds = pubkeyArrayDecoder(
        JSON.parse(
          decoder.decode(channelManager?.GetMutedUsers(utils.Base64ToUint8Array(currentChannel.id)))
        )
      );

      dispatch(
        channels.actions.setMutedUsers({
          channelId: currentChannel.id,
          mutedUsers: mutedUserIds
        })
      );

      const usersMap = (
        (await db
          .table<DBMessage>('messages')
          .filter(
            (obj) => obj.channel_id === currentChannel.id && mutedUserIds.includes(obj.pubkey)
          )
          .toArray()) || []
      )
        .reduce((acc, cur) => {
          if (mutedUserIds.includes(cur.pubkey) && !acc.get(cur.pubkey)) {
            const { codename: codename, color } = getCodeNameAndColor(
              cur.pubkey,
              cur.codeset_version
            );
            acc.set(cur.pubkey, {
              codename,
              color,
              pubkey: cur.pubkey,
              codeset: cur.codeset_version
            });
          }
          return acc;
        }, new Map<string, User>())
        .values();

      users = Array.from(usersMap);
    }

    return users;
  }, [channelManager, currentChannel, db, dispatch, getCodeNameAndColor, utils]);

  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    setHasMore(true);
  }, [currentChannel?.id]);

  const loadMoreChannelData = useCallback(
    async (chId: string) => {
      if (db) {
        const foundChannel = currentChannels.find((ch) => ch.id === chId);
        if (foundChannel) {
          const offset = (currentChannelPages[foundChannel.id] + 1) * BATCH_COUNT;

          const newMessages = await db
            .table<DBMessage>('messages')
            .orderBy('timestamp')
            .reverse()
            .filter((m) => {
              return !m.hidden && m.channel_id === chId && m.type === 1;
            })
            .offset(offset)
            .limit(BATCH_COUNT)
            .toArray();

          if (newMessages.length > 0) {
            dispatch(channels.actions.incrementPage(chId));
            dispatch(messages.actions.upsertMany(newMessages.map(dbMessageMapper)));
          } else {
            setHasMore(false);
          }
        }
      }
    },
    [db, currentChannels, currentChannelPages, dispatch, dbMessageMapper]
  );

  useEffect(() => {
    if (
      currentChannel?.id !== undefined &&
      pagination.end >= (currentMessages?.length ?? 0) &&
      hasMore
    ) {
      loadMoreChannelData(currentChannel?.id);
    }
  }, [currentChannel?.id, currentMessages?.length, hasMore, loadMoreChannelData, pagination.end]);

  const joinChannelFromURL = useCallback(
    (url: string, password = '') => {
      if (channelManager && channelManager.JoinChannelFromURL) {
        try {
          const chanInfo = channelDecoder(
            JSON.parse(decoder.decode(channelManager.JoinChannelFromURL(url, password)))
          );

          if (chanInfo && chanInfo?.channelId) {
            dispatch(
              channels.actions.upsert({
                id: chanInfo?.channelId,
                name: chanInfo?.name,
                description: chanInfo?.description,
                privacyLevel: getPrivacyLevel(chanInfo?.channelId),
                isAdmin: channelManager.IsChannelAdmin(utils.Base64ToUint8Array(chanInfo.channelId))
              })
            );
            dispatch(app.actions.selectChannelOrConversation(chanInfo.channelId));
          }
        } catch (error) {
          console.error('Error joining channel');
        }
      } else {
        return null;
      }
    },
    [channelManager, dispatch, getPrivacyLevel, utils]
  );

  const getChannelInfo = useCallback(
    (prettyPrint: string) => {
      if (utils && utils.GetChannelInfo && prettyPrint.length) {
        return channelDecoder(JSON.parse(decoder.decode(utils.GetChannelInfo(prettyPrint))));
      }
      return {};
    },
    [utils]
  );

  const createChannel = useCallback(
    async (
      channelName: string,
      channelDescription: string,
      privacyLevel: PrivacyLevel.Public | PrivacyLevel.Secret,
      enableDms = true
    ) => {
      if (cmix && channelName && channelManager) {
        const channelPrettyPrint = await channelManager?.GenerateChannel(
          channelName,
          channelDescription || '',
          privacyLevel
        );

        const channelInfo = getChannelInfo(channelPrettyPrint || '') as ChannelJSON;

        if (channelInfo.channelId === undefined) {
          throw new Error('ChannelID was not found');
        }

        const channel: Channel = {
          id: channelInfo?.channelId,
          name: channelInfo?.name,
          isAdmin: true,
          privacyLevel,
          description: channelInfo?.description,
          prettyPrint: channelPrettyPrint
        };

        await joinChannel(channelPrettyPrint, false);
        savePrettyPrint(channel.id, channelPrettyPrint);
        dispatch(channels.actions.upsert(channel));
        dispatch(app.actions.selectChannelOrConversation(channel.id));

        if (enableDms) {
          channelManager.EnableDirectMessages(utils.Base64ToUint8Array(channel.id));
        } else {
          channelManager.DisableDirectMessages(utils.Base64ToUint8Array(channel.id));
        }
      }
    },
    [cmix, channelManager, getChannelInfo, joinChannel, dispatch, utils]
  );

  const shareChannel = () => {};

  const leaveCurrentChannel = useCallback(async () => {
    if (currentChannel && channelManager && channelManager.LeaveChannel && utils) {
      try {
        await channelManager.LeaveChannel(utils.Base64ToUint8Array(currentChannel.id));

        dispatch(channels.actions.leaveChannel(currentChannel.id));
      } catch (error) {
        console.error('Failed to leave Channel:', error);
      }
    }
  }, [channelManager, currentChannel, dispatch, utils]);

  const sendMessage = useCallback(
    async (message: string, tags: string[] = []) => {
      if (!message.length || !utils?.Base64ToUint8Array) {
        console.error('Cannot send message - missing required dependencies:', {
          messageLength: !!message.length,
          channelManager: !!channelManager,
          base64Uint8Array: !!utils?.Base64ToUint8Array,
          currentChannel: !!currentChannel
        });
        return;
      }
      try {
        if (channelManager && currentChannel) {
          const messageId = await channelManager.SendMessage(
            utils.Base64ToUint8Array(currentChannel.id),
            message,
            MESSAGE_LEASE,
            new Uint8Array(),
            encoder.encode(JSON.stringify(tags))
          );

          // Log to verify the message was sent and we got a messageId back
          console.log('Message sent successfully, messageId:', messageId);

          return messageId;
        } else if (currentConversation) {
          sendDirectMessage(message);
        }
      } catch (e) {
        console.error('Error sending message:', e);
        throw e; // Propagate error to caller
      }
    },
    [channelManager, currentChannel, utils]
  );

  const sendReply = useCallback(
    async (reply: string, replyToMessageId: string, tags: string[] = []) => {
      if (reply.length && channelManager && utils && utils.Base64ToUint8Array && currentChannel) {
        try {
          await channelManager.SendReply(
            utils.Base64ToUint8Array(currentChannel.id),
            reply,
            utils.Base64ToUint8Array(replyToMessageId),
            30000,
            new Uint8Array(),
            encoder.encode(JSON.stringify(tags))
          );
        } catch (error) {
          console.error(`Test failed to reply to messageId ${replyToMessageId}`);
        }
      } else if (reply.length && currentConversation) {
        sendDMReply(reply, replyToMessageId);
      }
    },
    [channelManager, currentChannel, currentConversation, utils, sendDMReply]
  );

  const deleteMessage = useCallback(
    async ({ channelId, id }: Pick<Message, 'channelId' | 'id'>) => {
      if (currentChannel) {
        await channelManager?.DeleteMessage(
          utils.Base64ToUint8Array(channelId),
          utils.Base64ToUint8Array(id),
          utils.GetDefaultCMixParams()
        );

        dispatch(messages.actions.delete(id));
      } else if (currentConversation) {
        deleteDirectMessage(id);
      }
    },
    [channelManager, currentChannel, currentConversation, deleteDirectMessage, dispatch, utils]
  );

  const sendReaction = useCallback(
    async (reaction: string, reactToMessageId: string) => {
      if (channelManager && utils && utils.Base64ToUint8Array && currentChannel) {
        try {
          await channelManager.SendReaction(
            utils.Base64ToUint8Array(currentChannel.id),
            reaction,
            utils.Base64ToUint8Array(reactToMessageId),
            utils.ValidForever(),
            new Uint8Array()
          );
        } catch (error) {
          console.error(`Test failed to react to messageId ${reactToMessageId}`, error);
        }
      }

      if (currentConversationId !== null && currentConversation?.token !== undefined) {
        sendDMReaction(reaction, reactToMessageId);
      }
    },
    [
      currentConversationId,
      currentConversation?.token,
      channelManager,
      currentChannel,
      sendDMReaction,
      utils
    ]
  );

  const setNickname = useCallback(
    (nickName: string) => {
      if (channelManager && currentChannel?.id) {
        try {
          channelManager.SetNickname(nickName, utils.Base64ToUint8Array(currentChannel?.id));
          return true;
        } catch (error) {
          console.error(error);
          return false;
        }
      }

      if (currentConversation) {
        return setDmNickname(nickName);
      }
      return false;
    },
    [setDmNickname, channelManager, currentChannel?.id, currentConversation, utils]
  );

  const getNickName = useCallback(() => {
    let nickName = '';
    if (channelManager?.GetNickname && currentChannel) {
      try {
        nickName = channelManager?.GetNickname(utils.Base64ToUint8Array(currentChannel?.id));
      } catch (error) {
        nickName = '';
      }
    }

    if (currentConversation) {
      nickName = getDmNickname();
    }
    return nickName;
  }, [channelManager, currentChannel, currentConversation, getDmNickname, utils]);

  useEffect(() => {
    if (currentChannel) {
      dispatch(
        channels.actions.updateNickname({
          channelId: currentChannel.id,
          nickname: getNickName()
        })
      );
    } else if (currentConversation) {
      dispatch(dms.actions.setUserNickname(getNickName()));
    }
  }, [currentChannel, currentConversation, dispatch, getNickName]);

  const generateIdentities = useCallback(
    (amountOfIdentities: number) => {
      const identitiesObjects: ReturnType<NetworkContext['generateIdentities']> = [];
      if (utils && utils.GenerateChannelIdentity && cmix) {
        for (let i = 0; i < amountOfIdentities; i++) {
          const createdPrivateIdentity = utils.GenerateChannelIdentity(cmix?.GetID());
          const publicIdentity = utils.GetPublicChannelIdentityFromPrivate(createdPrivateIdentity);
          const identityJson = identityDecoder(JSON.parse(decoder.decode(publicIdentity)));
          const codename = identityJson.codename;
          identitiesObjects.push({
            privateIdentity: createdPrivateIdentity,
            codename,
            codeset: identityJson.codeset,
            pubkey: identityJson.pubkey
          });
        }
      }
      return identitiesObjects;
    },
    [cmix, utils]
  );

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

  const exportPrivateIdentity = useCallback(
    async (password: string) => {
      if (utils && utils.GetOrInitPassword) {
        try {
          const statePassEncoded = await utils.GetOrInitPassword(password);

          if (statePassEncoded && channelManager && channelManager.ExportPrivateIdentity) {
            const data = channelManager.ExportPrivateIdentity(password);
            exportDataToFile(data);
            return statePassEncoded;
          }
        } catch (error) {
          return false;
        }
      }
      return false;
    },
    [channelManager, utils]
  );

  const checkRegistrationReadiness = useCallback(
    (
      selectedPrivateIdentity: Uint8Array,
      onIsReadyInfoChange: (readinessInfo: IsReadyInfoJSON) => void
    ) => {
      console.log('Checking registration readiness...');
      return new Promise<void>((resolve) => {
        const intervalId = setInterval(() => {
          if (cmix) {
            const isReadyInfo = isReadyInfoDecoder(
              JSON.parse(decoder.decode(cmix?.IsReady(CMIX_NETWORK_READINESS_THRESHOLD)))
            );
            onIsReadyInfoChange(isReadyInfo);
            if (isReadyInfo.isReady) {
              clearInterval(intervalId);
              setTimeout(() => {
                console.log('Network ready, creating channel manager...');
                createChannelManager(selectedPrivateIdentity);
                setIsAuthenticated(true);
                resolve();
              }, 3000);
            }
          }
        }, 1000);
      });
    },
    [cmix, createChannelManager, setIsAuthenticated]
  );

  const logout = useCallback(
    (password: string) => {
      if (utils && utils.Purge) {
        disconnect();
        utils.Purge(password);
        window.localStorage.clear();
        Cookies.remove('userAuthenticated', { path: '/' });
        setIsAuthenticated(false);
        setChannelManager(undefined);
        window.location.reload();
        return true;
      } else {
        return false;
      }
    },
    [disconnect, setIsAuthenticated, utils]
  );

  const muteUser = useCallback(
    async (pubkey: string, muted: boolean) => {
      if (currentChannel) {
        await channelManager?.MuteUser(
          utils.Base64ToUint8Array(currentChannel?.id),
          utils.Base64ToUint8Array(pubkey),
          muted,
          utils.ValidForever(),
          utils.GetDefaultCMixParams()
        );

        await awaitChannelEvent(ChannelEvents.USER_MUTED, (e) => e.pubkey === pubkey);
      }
    },
    [channelManager, currentChannel, utils]
  );

  useEffect(() => {
    getMutedUsers();
  }, [currentChannel, getMutedUsers]);

  const pinMessage = useCallback(
    async (id: MessageId, unpin = false) => {
      if (currentChannel && channelManager) {
        await channelManager.PinMessage(
          utils.Base64ToUint8Array(currentChannel?.id),
          utils.Base64ToUint8Array(id),
          unpin,
          PIN_MESSAGE_LENGTH_MILLISECONDS,
          utils.GetDefaultCMixParams()
        );
      }
    },
    [channelManager, currentChannel, utils]
  );

  const exportChannelAdminKeys = useCallback(
    (encryptionPassword: string) => {
      if (channelManager && currentChannel) {
        return decoder.decode(
          channelManager.ExportChannelAdminKey(
            utils.Base64ToUint8Array(currentChannel.id),
            encryptionPassword
          )
        );
      }
      throw Error('Channel manager and current channel required.');
    },
    [channelManager, currentChannel, utils]
  );

  const importChannelAdminKeys = useCallback(
    (encryptionPassword: string, privateKey: string) => {
      if (channelManager && currentChannel) {
        channelManager.ImportChannelAdminKey(
          utils.Base64ToUint8Array(currentChannel.id),
          encryptionPassword,
          encoder.encode(privateKey)
        );
      } else {
        throw Error('Channel manager and current channel required.');
      }
    },
    [channelManager, currentChannel, utils]
  );

  useEffect(() => {
    if (utils && utils.GetWasmSemanticVersion) {
      const version = versionDecoder(JSON.parse(decoder.decode(utils.GetWasmSemanticVersion())));
      const isUpdate = version.updated;
      const outdatedVersion = '0.1.8';
      const [outdatedMajor, outdatedMinor] = outdatedVersion.split('.').map((i) => parseInt(i, 10));
      const [oldMajor, oldMinor] = version.old.split('.').map((i) => parseInt(i, 10));

      if (isUpdate && oldMinor <= outdatedMinor && oldMajor === outdatedMajor) {
        window.localStorage.clear();
        Cookies.remove('userAuthenticated', { path: '/' });
        window.location.reload();
      }
    }
  }, [utils]);

  useEffect(() => {
    if (channelManager) {
      console.log('Channel manager loaded, fetching initial data');
      fetchInitialData();
    }
  }, [channelManager, fetchInitialData]);

  const ctx: NetworkContext = {
    decryptMessageContent: cipher?.decrypt,
    channelManager,
    getMutedUsers,
    mutedUsers,
    exportChannelAdminKeys,
    importChannelAdminKeys,
    setMutedUsers: setMutedUsers,
    muteUser,
    cmix,
    networkStatus: cmixStatus,
    pagination,
    deleteMessage,
    joinChannel,
    createChannel,
    shareChannel,
    sendMessage,
    leaveCurrentChannel,
    generateIdentities: generateIdentities,
    createChannelManager,
    loadChannelManager,
    handleInitialLoadData: fetchInitialData,
    setNickname,
    getNickName,
    sendReply,
    sendReaction,
    getPrettyPrint,
    getShareURL,
    getShareUrlType,
    joinChannelFromURL,
    getVersion,
    getClientVersion,
    loadMoreChannelData,
    exportPrivateIdentity,
    isNetworkHealthy: cmixStatus === NetworkStatus.CONNECTED,
    checkRegistrationReadiness,
    pinMessage,
    logout,
    upgradeAdmin,
    fetchChannels
  };

  return <NetworkClientContext.Provider value={ctx} {...props} />;
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

export { NetworkStatus };
