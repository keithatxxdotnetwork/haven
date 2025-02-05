import { ChannelNotificationLevel, NotificationStatus } from 'src/types';
import { PrivacyLevel } from 'src/types';
export { PrivacyLevel };

export type Channel = {
  name: string;
  id: string;
  description: string;
  isAdmin: boolean;
  privacyLevel: PrivacyLevel | null;
  prettyPrint?: string;
};

export type ChannelId = Channel['id'];

export type ChannelsState = {
  byId: Record<ChannelId, Channel>;
  sortedChannels: Array<Channel>;
  currentPages: Record<ChannelId, number>;
  nicknames: Record<ChannelId, string | undefined>;
  mutedUsersByChannelId: Record<ChannelId, string[]>;
  notificationLevels: Record<ChannelId, ChannelNotificationLevel | undefined>;
  notificationStatuses: Record<ChannelId, NotificationStatus | undefined>;
  dmsEnabled: Record<ChannelId, boolean>;
};

declare module 'src/store/types' {
  interface RootState {
    channels: ChannelsState;
  }
}
