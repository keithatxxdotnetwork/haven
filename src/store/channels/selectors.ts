import { RootState } from 'src/store/types';
import { createSelector } from '@reduxjs/toolkit';
import { channelsSearch } from '../app/selectors';
import { sortBy } from 'lodash';
import { ChannelId } from './types';
import { NotificationStatus } from 'src/types';

export const channels = (state: RootState) => state.channels.sortedChannels;

export const searchFilteredChannels = (favorites: string[]) =>
  createSelector(channels, channelsSearch, (allChannels, search) => {
    const filteredChannels = allChannels.filter((c) =>
      c.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())
    );

    return sortBy(filteredChannels, (c) => (favorites.includes(c.id) ? 0 : 1));
  });

export const currentChannel = (state: RootState) =>
  state.app.selectedChannelIdOrConversationId !== null
    ? state.channels.byId[state.app.selectedChannelIdOrConversationId]
    : undefined;

export const channelPages = (state: RootState) => state.channels.currentPages;

export const channelNicknames = (state: RootState) => state.channels.nicknames;

export const currentChannelNickname =
  (channelId?: ChannelId) =>
  (state: RootState): string | undefined =>
    channelId && state.channels.nicknames[channelId];

export const mutedUsers = (state: RootState) => state.channels.mutedUsersByChannelId;

export const notificationLevels = (state: RootState) => state.channels.notificationLevels;
export const notificationStatuses = (state: RootState) => state.channels.notificationStatuses;

export const notificationLevel = (channelId?: ChannelId) => (state: RootState) =>
  channelId ? notificationLevels(state)[channelId] : undefined;
export const notificationStatus =
  (channelId?: ChannelId) =>
  (state: RootState): NotificationStatus | undefined =>
    channelId ? notificationStatuses(state)[channelId] : undefined;
export const dmsEnabled = (channelId?: ChannelId) => (state: RootState) =>
  !!(channelId && state.channels.dmsEnabled[channelId]);
