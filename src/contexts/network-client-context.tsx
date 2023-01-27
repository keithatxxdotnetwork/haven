import type { CMix } from 'src/types';
import type {Message, MessageStatus } from 'src/store/messages/types';

import { ChannelJSON, VersionJSON } from 'src/contexts/utils-context';
import React, { FC, useState, useEffect,  useCallback, useMemo } from 'react';

import _ from 'lodash';
import Cookies from 'js-cookie';
import assert from 'assert';

import * as events from 'src/events';
import { WithChildren } from 'src/types';
import { decoder, encoder, exportDataToFile } from 'src/utils';
import { useAuthentication } from 'src/contexts/authentication-context';
import { PrivacyLevel, useUtils } from 'src/contexts/utils-context';
import { PIN_MESSAGE_LENGTH_MILLISECONDS, STATE_PATH } from '../constants';
import useNotification from 'src/hooks/useNotification';
import { useDb } from './db-context';
import useCmix from 'src/hooks/useCmix';
import { useAppDispatch, useAppSelector } from 'src/store/hooks';
import { MessageType } from 'src/store/messages/types';

import * as channels from 'src/store/channels'
import * as identity from 'src/store/identity';
import * as messages from 'src/store/messages';
import { ChannelId, ChannelInfo } from 'src/store/channels/types';

const BATCH_COUNT = 1000;

export type DBMessage = {
  id: number;
  nickname: string;
  message_id: string;
  channel_id: string;
  parent_message_id: null | string;
  timestamp: string;
  lease: number;
  status: MessageStatus;
  hidden: boolean,
  pinned: boolean;
  text: string;
  type: MessageType;
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
  GetStorageTag: () => string | undefined;
  SetNickname: (newNickname: string, channel: Uint8Array) => void;
  GetNickname: (channelId: Uint8Array) => string;
  GetIdentity: () => Uint8Array;
  GetShareURL: (cmixId: number, host: string, maxUses: number, channelId: Uint8Array) => Uint8Array;
  JoinChannelFromURL: (url: string, password: string) => Uint8Array;
  ExportPrivateIdentity: (password: string) => Uint8Array;
  ExportChannelAdminKey: (channelId: Uint8Array, encryptionPassword: string) => Uint8Array;
  ImportChannelAdminKey: (channelId: Uint8Array, encryptionPassword: string, privateKey: Uint8Array) => void;
}

export type IdentityJSON = {
  PubKey: string;
  Codename: string;
  Color: string;
  Extension: string;
  CodesetVersion: number;
}

type NetworkContext = {
  // state
  mutedUsers: User[] | undefined;
  userIsMuted: (pubkey: string) => boolean;
  setMutedUsers: React.Dispatch<React.SetStateAction<User[] | undefined>>;
  cmix?: CMix;
  isNetworkHealthy: boolean | undefined;
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
  getMutedUsers: () => Promise<User[]>;
  muteUser: (pubkey: string, unmute: boolean) => Promise<void>;
  shareChannel: () => void;
  sendMessage: (message: string) => void;
  leaveCurrentChannel: () => void;
  createChannelManager: (privateIdentity: Uint8Array) => Promise<void>;
  loadChannelManager: (storageTag: string, cmix?: CMix) => Promise<void>;
  handleInitialLoadData: () => Promise<void>;
  getNickName: () => string;
  setNickName: (nickname: string) => boolean;
  sendReply: (reply: string, replyToMessageId: string) => Promise<void>;
  sendReaction: (reaction: string, reactToMessageId: string) => Promise<void>;
  getPrettyPrint: (channelId: string) => string | undefined;
  getShareURL: (channelId: string) => ShareURL | null;
  getShareUrlType: (url: string) => PrivacyLevel | null;
  joinChannelFromURL: (url: string, password: string) => void;
  getVersion: () => string | null;
  getClientVersion: () => string | null;
  loadMoreChannelData: (channelId: string) => Promise<void>;
  exportPrivateIdentity: (password: string) => Uint8Array | false;
  pinMessage: (message: Message, unpin?: boolean) => Promise<void>;
  logout: (password: string) => boolean;
};

export const NetworkClientContext = React.createContext<NetworkContext>({
  cmix: undefined,
  networkStatus: NetworkStatus.DISCONNECTED,
  currentChannel: undefined,
  channels: [],
  messages: [],
  isNetworkHealthy: undefined,
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
  const dispatch = useAppDispatch();
  const db = useDb();
  const {
    addStorageTag,
    checkUser,
    setIsAuthenticated,
    storageTag,
  } = useAuthentication();
  const { messagePinned, messageReplied } = useNotification();
  const { utils } = useUtils();
  const [mutedUsers, setMutedUsers] = useState<User[]>();
  const { cipher, cmix, connect, disconnect, initializeCmix, status: cmixStatus } = useCmix();
  const [channelManager, setChannelManager] = useState<ChannelManager | undefined>();
  const bc = useMemo(() => new BroadcastChannel('join_channel'), []);
  const currentChannel = useAppSelector(channels.selectors.currentChannel);
  const currentChannels = useAppSelector(channels.selectors.channels);
  const userIdentity = useAppSelector(identity.selectors.identity);

  const initialize = useCallback(async (password: string) => {
    const statePassEncoded = checkUser(password);
    if (!statePassEncoded) {
      throw new Error('Incorrect password');
    } else {
      await initializeCmix(statePassEncoded);
    }
  }, [checkUser, initializeCmix]);

  const upgradeAdmin = useCallback(() => {
    dispatch(channels.actions.upgradeAdminInCurrentChannel());
  }, [dispatch])

  const fetchIdentity = useCallback((mngr?: ChannelManager) => {
    const manager = channelManager || mngr; 
    try {
      const json = decoder.decode(manager?.GetIdentity());

      const parsed = JSON.parse(json) as IdentityJSON;

      dispatch(identity.actions.set({
        codename: parsed.Codename,
        pubkey: parsed.PubKey,
        codesetVersion: parsed.CodesetVersion,
        color: parsed.Color.replace('0x', '#'),
        extension: parsed.Extension
      }));
    } catch (error) {
      console.error(error);
      return null;
    }
  }, [channelManager, dispatch]);

  const getShareURL = useCallback((
    channelId: string,
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
  }, [channelManager, cmix, utils]);

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
    (channelId: string) => getShareUrlType(getShareURL(channelId)?.url),
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
        const temp: ChannelInfo = {
          id: chanInfo.ChannelID,
          name: chanInfo.Name,
          privacyLevel: getPrivacyLevel(chanInfo.ChannelID),
          description: chanInfo.Description,
          isAdmin: channelManager.IsChannelAdmin(utils.Base64ToUint8Array(chanInfo.ChannelID)),
        };

        dispatch(channels.actions.selectChannel(temp.id));
        dispatch(channels.actions.upsert(temp));
      }
    }
  }, [channelManager, dispatch, getPrivacyLevel, utils]);

  const getCodeNameAndColor = useCallback((publicKey: string, codeset: number) => {
    try {
      assert(utils && typeof utils.ConstructIdentity === 'function' && utils.Base64ToUint8Array)
      const identityJson = JSON.parse(
        decoder.decode(
          utils.ConstructIdentity(
            utils.Base64ToUint8Array(publicKey),
            codeset
          )
        )
      ) as IdentityJSON;

      return {
        codename: identityJson.Codename,
        color: identityJson.Color.replace('0x', '#')
      };
    } catch (error) {
      console.error('Failed to get codename and color', error);
      throw error;
    }
  }, [utils]);

  useEffect(() => {
    bc.onmessage = async event => {
      if (event.data?.prettyPrint) {
        try {
          joinChannel(event.data.prettyPrint);
        } catch (error) {}
      }
    };
  }, [bc, channelManager, joinChannel]);


  const dbMessageMapper = useCallback((dbMsg: DBMessage): Message => {
    assert(cipher, 'Cipher required');
    return {
      ...getCodeNameAndColor(dbMsg.pubkey, dbMsg.codeset_version),
      id: dbMsg.message_id,
      body: cipher.decrypt(dbMsg.text) ?? undefined,
      repliedTo: dbMsg.parent_message_id,
      type: dbMsg.type,
      timestamp: dbMsg.timestamp,
      nickname: dbMsg.nickname || '',
      channelId: dbMsg.channel_id,
      status: dbMsg.status,
      uuid: dbMsg.id,
      round: dbMsg.round,
      pubkey: dbMsg.pubkey,
      pinned: dbMsg.pinned,
      hidden: dbMsg.hidden,
    }
  }, [cipher, getCodeNameAndColor]);

  const fetchRepliedToMessages = useCallback(async (messagesWhoseRepliesToFetch: Message[]) => {
    if (db) {
      const messagesParentIds = messagesWhoseRepliesToFetch
        .map(e => e.repliedTo)
        .filter((repliedTo): repliedTo is string => typeof repliedTo === 'string');

      const relatedMessages =
        (await db.table<DBMessage>('messages')
          .where('message_id')
          .anyOf(messagesParentIds)
          .filter(m => !m.hidden)
          .toArray()) || [];

      dispatch(messages.actions.upsertMany(relatedMessages.map(dbMessageMapper)));
    }
  }, [db, dbMessageMapper, dispatch]);

  const allMessages = useAppSelector(messages.selectors.allMessages);

  const handleMessageEvent = useCallback(async ({ messageId }: events.MessageReceivedEvent) => {
    if (db && cipher?.decrypt) {
      const receivedMessage = await db.table<DBMessage>('messages').get(messageId);

      // Notify user if someone replied to him
      if (
          receivedMessage?.type !== MessageType.Reaction && // Remove emoji reactions, Ben thinks theyre annoying
          receivedMessage?.parent_message_id
          && receivedMessage?.pubkey !== userIdentity?.pubkey) {
        const replyingTo = await db.table<DBMessage>('messages').where('message_id').equals(receivedMessage?.parent_message_id).first();
        if (replyingTo?.pubkey === userIdentity?.pubkey) {
          const { codename } = getCodeNameAndColor(receivedMessage.pubkey, receivedMessage.codeset_version);
          messageReplied(
            receivedMessage.nickname || codename,
            cipher.decrypt(receivedMessage.text)
          )
        }
      }

      const oldMessage = allMessages.find(({ uuid }) => receivedMessage?.id === uuid);

      if (!oldMessage?.pinned && receivedMessage?.pinned) {
        const foundChannel = currentChannels.find(({ id }) => receivedMessage.channel_id === id);
        messagePinned(
          cipher.decrypt(receivedMessage.text),
          foundChannel?.name ?? 'unknown'
        );
      }

      if (receivedMessage) {
        dispatch(messages.actions.upsert(dbMessageMapper(receivedMessage)));

        if (receivedMessage.channel_id !== currentChannel?.id) {
          dispatch(channels.actions.notifyNewMessage(receivedMessage.channel_id))
        }
      }
    }
  }, [
    cipher,
    currentChannel?.id,
    db,
    dbMessageMapper,
    dispatch,
    getCodeNameAndColor,
    messageReplied,
    userIdentity?.pubkey
  ]);

  useEffect(() => {
    events.bus.addListener(events.RECEIVED_MESSAGE, handleMessageEvent);

    return () => { events.bus.removeListener('message', handleMessageEvent) };
  }, [handleMessageEvent]);

  const fetchChannels = useCallback(async () => {
    assert(db);
    assert(channelManager);
    
    const fetchedChannels = await db.table<DBChannel>('channels').toArray();

    const channelList = fetchedChannels.map((ch: DBChannel) => ({
      ...ch,
      privacyLevel: getPrivacyLevel(ch.id),
      isAdmin: channelManager.IsChannelAdmin(utils.Base64ToUint8Array(ch.id)),
    }));

    channelList.forEach((channel) => dispatch(channels.actions.upsert(channel)))

    return channelList;
  }, [
    channelManager,
    db,
    dispatch,
    getPrivacyLevel,
    utils
  ]);

  const fetchMessages = useCallback(async (channelIds: ChannelId[]) => {
    const groupedMessages = await Promise.all(
      channelIds.map(async chId => {
        if (!db) {
          throw new Error('Dexie initialization error');
        }

        return db.table<DBMessage>('messages')
          .orderBy('timestamp')
          .reverse()
          .filter(m =>  !m.hidden && m.channel_id === chId && m.type === 1)
          .limit(BATCH_COUNT)
          .toArray();
      })
    );

    let msgs: DBMessage[] = [];

    groupedMessages.forEach(g => {
      msgs = [...msgs, ..._.reverse(g)];
    });

    const mappedMessages = msgs.map(dbMessageMapper);

    dispatch(messages.actions.upsertMany(mappedMessages));

    return mappedMessages;
  }, [db, dbMessageMapper, dispatch]);

  useEffect(() => {}, []);

  const fetchReactions = useCallback(async () => {
    if (currentChannel?.id !== undefined) {
      const channelReactions = await db?.table<DBMessage>('messages')
        .where('channel_id')
        .equals(currentChannel?.id)
        .filter((e) => {
          return !e.hidden && e.type === 3;
        })
        .toArray() ?? [];
        
      const reactions = channelReactions?.filter((r) => r.parent_message_id !== null)
        .map(dbMessageMapper);

      dispatch(messages.actions.upsertMany(reactions));
    }
  }, [currentChannel?.id, db, dbMessageMapper, dispatch]);

  const fetchPinnedMessages = useCallback(async (): Promise<void> => {
    if (db && currentChannel) {
      const fetchedPinnedMessages = (await db.table<DBMessage>('messages')
        .where('channel_id')
        .equals(currentChannel.id)
        .filter((m) => m.pinned && !m.hidden)
        .toArray())
        .map(dbMessageMapper);
      
      dispatch(messages.actions.upsertMany(fetchedPinnedMessages));
    }
  }, [currentChannel, db, dbMessageMapper, dispatch]);

  const fetchInitialData = useCallback(async () => {
    try {
      assert(db);
      assert(cmix);
      assert(channelManager);
    } catch (e) {
      return;
    }
    fetchIdentity();
    const fetchedChannels = await fetchChannels();
    const channelMessages = await fetchMessages(fetchedChannels.map((ch) => ch.id));
    fetchRepliedToMessages(channelMessages);

  }, [
    channelManager,
    cmix,
    db,
    fetchChannels,
    fetchIdentity,
    fetchMessages,
    fetchRepliedToMessages
  ]);

  useEffect(() => {
    if (!currentChannel && currentChannels.length > 0) {
      dispatch(channels.actions.selectChannel(currentChannels[0]?.id));
    }
  }, [currentChannel, currentChannels, dispatch])

  useEffect(() => {
    if (db && channelManager && cmix) {
      fetchInitialData();
    }
  }, [db, cmix, channelManager, fetchInitialData]);

  useEffect(() => {
    if (currentChannel?.id !== undefined) {
      fetchPinnedMessages();
      fetchReactions();
    }
  }, [currentChannel?.id, fetchPinnedMessages, fetchReactions]);


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
      setMutedUsers(users);
    }

    return users;
  }, [channelManager, currentChannel, db, getCodeNameAndColor, utils]);

  useEffect(() => {
    const listener = ({ body, channelId }: events.MessagePinEvent) => {
      const channelName = currentChannels.find((c) => c.id === channelId)?.name ?? 'unknown';
      messagePinned(body, channelName);
    };

    events.bus.addListener(events.MESSAGE_PINNED, listener);

    return () => { events.bus.removeListener(events.MESSAGE_PINNED, listener); }

  }, [currentChannels, messagePinned])

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
      if (tag) {
        addStorageTag(tag);
      }
    }
  }, [
    cipher,
    cmix,
    utils,
    addStorageTag
  ]);

  const loadMoreChannelData = useCallback(async (chId: string) => {
    if (db) {
      const foundChannel = currentChannels.find(ch => ch.id === chId);
      if (foundChannel) {
        const newMessages = await db
          .table<DBMessage>('messages')
          .orderBy('timestamp')
          .reverse()
          .filter(m => {
            return !m.hidden && m.channel_id === chId && m.type === 1;
          })
          .offset(foundChannel.currentPage + 1 * BATCH_COUNT)
          .limit(BATCH_COUNT)
          .toArray();
        
        if (newMessages.length > 0) {
          dispatch(channels.actions.incrementPage(chId));
          dispatch(messages.actions.upsertMany(newMessages.map(dbMessageMapper)));
        }
      }
    }
  }, [db, currentChannels, dispatch, dbMessageMapper]);

  const joinChannelFromURL = useCallback((url: string, password = '') => {
    if (channelManager && channelManager.JoinChannelFromURL) {
      try {
        const chanInfo = JSON.parse(
          decoder.decode(channelManager.JoinChannelFromURL(url, password))
        ) as ChannelJSON;

        if (chanInfo) {
          dispatch(channels.actions.upsert({
            id: chanInfo?.ChannelID,
            name: chanInfo?.Name,
            description: chanInfo?.Description,
            privacyLevel: getPrivacyLevel(chanInfo?.ChannelID),
            isAdmin: channelManager.IsChannelAdmin(utils.Base64ToUint8Array(chanInfo.ChannelID))
          }));
          dispatch(channels.actions.selectChannel(chanInfo.ChannelID));
        }
      } catch (error) {
        console.error('Error joining channel')
      }
    } else {
      return null;
    }
  }, [channelManager, dispatch, getPrivacyLevel, utils]);

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

        const channel: ChannelInfo = {
          id: channelInfo?.ChannelID,
          name: channelInfo?.Name,
          isAdmin: true,
          privacyLevel,
          description: channelInfo?.Description,
          prettyPrint: channelPrettyPrint,
        };

        joinChannel(channelPrettyPrint, false);
        savePrettyPrint(channel.id, channelPrettyPrint);
        dispatch(channels.actions.upsert(channel));
        dispatch(channels.actions.selectChannel(channel.id));
      }
  }, [cmix, channelManager, getChannelInfo, joinChannel, dispatch]);

  const shareChannel = () => {};

  const leaveCurrentChannel = useCallback(async () => {
    if (currentChannel && channelManager && channelManager.LeaveChannel && utils) {
      try {
        channelManager.LeaveChannel(
          utils.Base64ToUint8Array(currentChannel.id)
        );
        
        dispatch(channels.actions.leaveCurrentChannel())
      } catch (error) {
        console.error('Failed to leave Channel.');
      }
    }
  }, [channelManager, currentChannel, dispatch, utils]);

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
        const identityJson = JSON.parse(decoder.decode(publicIdentity)) as IdentityJSON;
        const codename = identityJson.Codename;
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
              setIsAuthenticated(true);
              resolve();
            }, 3000);
          }
        }
      }, 1000);
    });
  }, [cmix, createChannelManager, setIsAuthenticated]);

  const logout = useCallback((password: string) => {
    if (utils && utils.Purge && connect) {
      try {
        disconnect();
        utils.Purge(STATE_PATH, password);
        window.localStorage.clear();
        Cookies.remove('userAuthenticated', { path: '/' });
        setIsAuthenticated(false);
        setChannelManager(undefined);
        window.location.reload();
        return true;
      } catch (error) {
        console.error(error);
        connect();
        return false;
      }
    } else {
      return false;
    }
  }, [connect, disconnect, setIsAuthenticated, utils]);

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

    dispatch(messages.actions.delete(id));
  }, [channelManager, dispatch, utils]);

  useEffect(() => {
    const listener = (evt: events.MessageDeletedEvent) => {
      dispatch(messages.actions.delete(evt.messageId));
    };

    events.bus.addListener(events.MESSAGE_DELETED, listener);

    return () => { events.bus.removeListener(events.MESSAGE_DELETED, listener); }
  }, [dispatch])

  useEffect(() => {
    getMutedUsers();
  }, [currentChannel, getMutedUsers]);

  const userIsMuted = useCallback(
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


  const getMuted = useCallback(() => {
    if (currentChannel && channelManager) {
      return channelManager?.Muted(utils.Base64ToUint8Array(currentChannel.id))
    }
    return false;
  }, [channelManager, currentChannel, utils]);


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


  useEffect(() => {
    if (utils && utils.GetWasmSemanticVersion) {
      const version = JSON.parse(decoder.decode(utils.GetWasmSemanticVersion())) as VersionJSON;
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

  const ctx: NetworkContext = {
    decryptMessageContent: cipher?.decrypt,
    getMutedUsers,
    initialize,
    mutedUsers,
    isMuted,
    exportChannelAdminKeys,
    importChannelAdminKeys,
    userIsMuted: userIsMuted,
    setMutedUsers: setMutedUsers,
    muteUser,
    getMuted,
    cmix,
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
    setNickName,
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
    getCodeNameAndColor,
    isNetworkHealthy: cmixStatus === NetworkStatus.CONNECTED,
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
