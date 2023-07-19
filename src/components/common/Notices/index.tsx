import { Trans, useTranslation } from 'react-i18next';
import { FC } from 'react';

import { useAppSelector } from 'src/store/hooks';
import * as channels from 'src/store/channels';
import * as messages from 'src/store/messages';
import * as dms from 'src/store/dms';
import { useUI } from '@contexts/ui-context';
import { WithChildren } from '@types';
import Identity from '../Identity';
import NoticeIcon from 'src/components/icons/Notice';

const Notice: FC<WithChildren> = ({ children }) => (
  <div className='px-6 py-10 flex space-x-2 items-center border-b border-charcoal-4 font-semibold'>
    <NoticeIcon className='w-14 h-14 text-charcoal-1' />
    <span>
      {children}
    </span>
  </div>
);

const Notices = () => {
  const { t } = useTranslation();
  const { sidebarView } = useUI();
  const allChannels = useAppSelector(channels.selectors.channels);
  const currentChannel = useAppSelector(channels.selectors.currentChannel);
  const msgs = useAppSelector(messages.selectors.currentChannelMessages);
  const conversations = useAppSelector(dms.selectors.conversations);
  const currentConversation = useAppSelector(dms.selectors.currentConversation);
  const currentDms = useAppSelector(dms.selectors.currentDirectMessages);

  return (
    <>
      {(allChannels.length === 0 && sidebarView === 'spaces') && (
        <Notice>
          <Trans t={t}>
            <strong className='text-primary'>Space Chats</strong>&nbsp;will
            show up here once you join or create one.
          </Trans>
        </Notice>
      )}
      {(currentChannel && (!msgs || msgs.length < 5) && sidebarView === 'spaces') && (
        <Notice>
          <Trans t={t}>
            This is the very beginning of the <strong className='text-primary'>{currentChannel.name}</strong>&nbsp;space
          </Trans>
          {currentChannel.description && (
            <p className='text-charcoal-1 font-normal mt-0.5'>
              {currentChannel.description}
            </p>
          )}
        </Notice>
      )}
      {(conversations?.length === 0 && sidebarView === 'dms') && (
        <Notice>
          <Trans t={t}>
            <strong className='text-primary'>Direct Messages</strong>&nbsp; will
            show up here once you or somebody else sends you a private message
          </Trans>
        </Notice>
      )}
      {(currentConversation && currentDms?.length === 0) && (
        <Notice>
          <Trans t={t}>
            This is the very beginning of your direct messages with <Identity {...currentConversation} />
          </Trans>
          <p className='text-charcoal-1 font-normal mt-0.5'>
            {t('Say "Hi..."')}
          </p>
        </Notice>
      )}
    </>
  );
}
export default Notices;
