import { ChangeEvent, FC, useCallback, useMemo, useState } from 'react';
import cn from 'classnames';
import { Collapse } from 'src/components/common';

import { SpeakEasy, Plus, MissedMessagesIcon, NetworkStatusIcon  } from 'src/components/icons';
import { useUI } from 'src/contexts/ui-context';
import { useNetworkClient } from 'src/contexts/network-client-context';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar } from '@fortawesome/free-solid-svg-icons';

import s from './LeftSideBar.module.scss';
import { useAppDispatch, useAppSelector } from 'src/store/hooks';
import * as channels from 'src/store/channels';
import * as app from 'src/store/app';
import * as dms from 'src/store/dms';
import Dropdown from '../Dropdown';
import Identity from '../Identity';

type ChannelListItemProps = {
  currentId: string | null,
  id: string,
  name: React.ReactNode,
  onClick: (id: string) => void,
  notification: boolean;
  hasDraft: boolean;
  isFavorite?: boolean;
}

const ChannelListItem: FC<ChannelListItemProps> = ({ currentId, hasDraft, id, isFavorite, name, notification, onClick }) => {
  return(
    <div className='flex justify-between items-center' key={id}>
      <span
        className={cn(s.channelPill, 'headline--xs flex justify-between items-center', {
          [s.channelPill__active]:  id === currentId
        })}
        onClick={() => onClick(id)}
      >
        <span>
          {name}
          {isFavorite && (
            <FontAwesomeIcon className='ml-1' size='xs' color='var(--orange)' icon={faStar} />
          )}
        </span>
        <span className='flex items-center justify-end'>
          {notification && (
            <span className='mr-1'>
              <MissedMessagesIcon></MissedMessagesIcon>
            </span>
          )}
          {!notification && hasDraft && (
            <span className='mr-1'>
              <MissedMessagesIcon muted={true}></MissedMessagesIcon>
            </span>
          )}
        </span>
      </span>
    </div>
  )
}

const LeftSideBar: FC<{ cssClasses?: string; }> = ({ cssClasses }) => {
  const [showCreateNewChannel, setShowCreateNewChannel] = useState(false);
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { openModal, setModalView } = useUI();
  const {
    getClientVersion,
    getVersion,
  } = useNetworkClient();

  const channelFavorites = useAppSelector(app.selectors.channelFavorites);
  const currentChannelId = useAppSelector(app.selectors.currentChannelId);
  const channelsSearch = useAppSelector(app.selectors.channelsSearch);
  const currentConversationId = useAppSelector(app.selectors.currentConversationId);
  const drafts = useAppSelector((state) => state.app.messageDraftsByChannelId);
  const missedMessages = useAppSelector(channels.selectors.missedMessages);
  const allChannels = useAppSelector(channels.selectors.searchFilteredChannels);
    const newDmsNotification = useAppSelector(dms.selectors.newDmsNotifications);
  const allConversations = useAppSelector(dms.selectors.searchFilteredConversations);

  const selectChannel = useCallback((chId: string) => () => {
    dispatch(app.actions.selectChannel(chId));
    dispatch(channels.actions.dismissNewMessagesNotification(chId))
  }, [dispatch]);

  const selectDm = useCallback((pubkey: string) => () => {
    dispatch(app.actions.selectConversation(pubkey));
    dispatch(dms.actions.dismissNewMessages(pubkey));
  }, [dispatch]);

  const updateChannelsSearch = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    dispatch(app.actions.updateChannelsSearch(e.target.value));
  }, [dispatch]);

  const channelsTitle = useMemo(() => (
    <div className={cn('flex justify-between')}>
      <span>{t('Joined')}</span>
      <div className='flex items-center'>
        <Plus
          className={cn('mr-1', s.plus, {})}
          onClick={(e) => {
            if (e && e.stopPropagation) {
              e.stopPropagation();
            }

            setShowCreateNewChannel((v) => !v);
          }}
        />
        
      </div>
    </div>
  ), [t]);

  const dmsTitle = useMemo(() => (
    <div className={cn('flex justify-between')}>
      <span>{t('Direct Messages')}</span>
    </div>
  ), [t]);

  return (
    <div className={cn(s.root, cssClasses)}>
      <div className={s.header}>
        <div className={s.logo}>
          <SpeakEasy />
        </div>
        <NetworkStatusIcon />
      </div>
      <div className={cn(s.content, 'relative')}>
        <div className={s.search}>
          <input onChange={updateChannelsSearch} value={channelsSearch} placeholder={t('Search...')}/>
          <div className='absolute inset-y-0 right-2 flex items-center pl-3 pointer-events-none'>
            <svg aria-hidden='true' className='w-5 h-5 text-gray-500 dark:text-gray-400' fill='none' stroke='currentColor' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'></path></svg>
          </div>
        </div>
        {showCreateNewChannel && (
          <Dropdown isOpen={showCreateNewChannel} onChange={setShowCreateNewChannel}>
            <ul style={{ backgroundColor: 'var(--dark-2)', zIndex: 2 }} className='text-right w-full rounded-lg p-2 bold'>
              <li className='px-2 py-1'>
                <button className='underline' onClick={() => {
                  setModalView('CREATE_CHANNEL');
                  openModal();
                  setShowCreateNewChannel(false);
                }}>
                  {t('Create new')}
                </button>
              </li>
              <li className='px-2 py-1'>
                <button className='underline' onClick={() => {
                  setModalView('JOIN_CHANNEL');
                  openModal();
                  setShowCreateNewChannel(false);
                }}>
                  {t('Join existing by url')}
                </button>
              </li>
            </ul>
          </Dropdown>
        )}
        <Collapse className='mb-3' title={channelsTitle} defaultActive>
          <div className='flex flex-col'>
            {allChannels.map((ch) => (
                <ChannelListItem
                  key={ch.id}
                  {...ch}
                  isFavorite={channelFavorites.includes(ch.id)}
                  currentId={currentChannelId}
                  onClick={selectChannel(ch.id)}
                  notification={!!missedMessages[ch.id]}
                  hasDraft={!!drafts[ch.id]}
                />
              )
            )}
          </div>
        </Collapse>
        <Collapse title={dmsTitle} defaultActive>
          {allConversations.map((c) => (
            <ChannelListItem
              key={c.pubkey}
              id={c.pubkey}
              currentId={currentConversationId}
              isFavorite={channelFavorites.includes(c.pubkey)}
              onClick={selectDm(c.pubkey)}
              name={<Identity {...c} />}
              notification={newDmsNotification[c.pubkey]}
              hasDraft={!!drafts[c.pubkey]}
            />
          ))}
        </Collapse>
      </div>
      <div className={s.footer}>
        <div className={cn(s.version)}>
          {getClientVersion() && <span>{t('XXDK version {{version}}', { version: getClientVersion() })}</span>}
          {getVersion() && <span>{t('Wasm version {{version}}', { version: getVersion() })}</span>}
          <span>{t('App version {{version}}', { version: process.env.NEXT_PUBLIC_APP_VERSION })}</span>
        </div>
      </div>
    </div>
  );
};

export default LeftSideBar;
