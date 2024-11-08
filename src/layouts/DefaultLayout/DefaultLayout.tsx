import type { WithChildren } from 'src/types';

import React, { FC, useEffect } from 'react';
import { useRouter } from 'next/router';

import { useUI } from 'src/contexts/ui-context';
import { useNetworkClient } from 'src/contexts/network-client-context';
import { useAuthentication } from 'src/contexts/authentication-context';

import AuthenticationUI from './AuthenticationUI';
import NotificationBanner from 'src/components/common/NotificationBanner';
import LeftHeader from 'src/components/common/LeftHeader';

import UpdatesModal from '../../components/modals/UpdatesModal';
import ConnectingDimmer from './ConnectingDimmer';
import useAccountSync, { AccountSyncStatus } from 'src/hooks/useAccountSync';
import { NetworkStatus } from 'src/hooks/useCmix';
import useEvents from 'src/hooks/useEvents';
import useGoogleRemoteStore from 'src/hooks/useGoogleRemoteStore';
import useDropboxRemoteStore from 'src/hooks/useDropboxRemoteStore';
import LeftSideBar from '@components/common/LeftSideBar';
import MainHeader from '@components/common/MainHeader';

import AppModals from 'src/components/modals/AppModals';
import SettingsView from '@components/views/SettingsViews';

import Notices from '@components/common/Notices';
import { RightSideBar } from '@components/common';
import PinnedMessage from '@components/common/ChannelChat/PinnedMessage';

const DefaultLayout: FC<WithChildren> = ({ children }) => {
  useGoogleRemoteStore();
  useDropboxRemoteStore();
  useEvents();
  const accountSync = useAccountSync();
  const router = useRouter();
  const { isAuthenticated } = useAuthentication();
  const { cmix, getShareUrlType, networkStatus } = useNetworkClient();
  const { leftSidebarView: sidebarView, openModal, setChannelInviteLink, setModalView } = useUI();

  useEffect(() => {
    const privacyLevel = getShareUrlType(window.location.href);

    if (
      privacyLevel !== null &&
      cmix &&
      networkStatus === NetworkStatus.CONNECTED &&
      isAuthenticated &&
      window.location.search
    ) {
      setChannelInviteLink(window.location.href);
      setModalView('JOIN_CHANNEL');
      openModal();
    }
  }, [
    cmix,
    isAuthenticated,
    networkStatus,
    getShareUrlType,
    setChannelInviteLink,
    setModalView,
    openModal,
    router
  ]);

  useEffect(() => {
    if (
      networkStatus === NetworkStatus.CONNECTED &&
      isAuthenticated &&
      accountSync.status === AccountSyncStatus.NotSynced
    ) {
      setModalView('ACCOUNT_SYNC', false);
      openModal();
    }
  }, [accountSync.status, isAuthenticated, networkStatus, openModal, setModalView]);

  return (
    <>
      <NotificationBanner />
      <UpdatesModal />
      {isAuthenticated ? (
        <>
          <ConnectingDimmer />
          <AppModals />
          <div className={'grid grid-cols-1 md:grid-cols-[21.75rem_1fr] h-screen'}>
            <input type='checkbox' id='mobileToggle' className='hidden peer' />

            <div className='flex flex-col h-screen peer-checked:hidden md:peer-checked:flex md:flex'>
              <LeftHeader className='h-[3.75rem]' />
              <LeftSideBar className='' />
            </div>

            <div className='flex flex-col overflow-x-hidden h-screen hidden peer-checked:flex md:peer-checked:flex md:flex'>
              <MainHeader className='h-[3.75rem] flex items-middle' />
              <div className='overflow-hidden flex grow flex-col items-stretch'>
                <div className='flex min-h-0 flex-1 w-full relative'>
                  <div className='flex flex-col flex-1 min-w-0'>
                    <Notices />
                    {sidebarView === 'spaces' && <PinnedMessage />}
                    {sidebarView === 'settings' && <SettingsView />}
                    {(sidebarView === 'spaces' || sidebarView === 'dms') && <>{children}</>}
                  </div>
                  <RightSideBar />
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <AuthenticationUI />
      )}
    </>
  );
};

export default DefaultLayout;
