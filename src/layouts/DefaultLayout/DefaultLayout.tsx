import type { WithChildren } from 'src/types';

import cn from 'classnames';
import React, { FC, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';

import { LeftSideBar, RightSideBar } from 'src/components/common';
import Modal from 'src/components/modals/Modal';
import { ModalViews, useUI } from 'src/contexts/ui-context';
import { useNetworkClient, Channel } from 'src/contexts/network-client-context';
import { useAuthentication } from 'src/contexts/authentication-context';
import { PrivacyLevel, useUtils } from 'src/contexts/utils-context';
import { Loading } from 'src/components/common';
import AuthenticationUI from './AuthenticationUI';
import NotificationBanner from 'src/components/common/NotificationBanner';

import {
  CreateChannelView,
  ClaimAdminKeys,
  JoinChannelView,
  ShareChannelView,
  LeaveChannelConfirmationView,
  NickNameSetView,
  ChannelActionsView,
  SettingsView,
  ExportCodenameView,
  NetworkNotReadyView,
  JoinChannelSuccessView,
  LogoutView,
  UserWasMuted,
  ViewPinnedMessages,
  ExportAdminKeys
} from 'src/components/modals';

import s from './DefaultLayout.module.scss';
import ViewMutedUsers from '@components/modals/ViewMutedUsers';

type ModalMap = Omit<Record<ModalViews, React.ReactNode>, 'IMPORT_CODENAME'>;

const AuthenticatedUserModals: FC<{ currentChannel?: Channel }> = ({
  currentChannel
}) => {
  const { closeModal, displayModal, modalView = '' } = useUI();
  const modalClass = modalView?.toLowerCase().replace(/_/g, '-');

  const modals = useMemo<ModalMap>(() => ({
    CLAIM_ADMIN_KEYS: <ClaimAdminKeys />,
    EXPORT_CODENAME:  <ExportCodenameView />,
    EXPORT_ADMIN_KEYS: <ExportAdminKeys />,
    SHARE_CHANNEL: <ShareChannelView />,
    CREATE_CHANNEL: <CreateChannelView />,
    JOIN_CHANNEL: <JoinChannelView />,
    LOGOUT: <LogoutView />,
    LEAVE_CHANNEL_CONFIRMATION: <LeaveChannelConfirmationView />,
    SET_NICK_NAME: currentChannel && <NickNameSetView />,
    CHANNEL_ACTIONS: <ChannelActionsView />,
    SETTINGS: <SettingsView />,
    NETWORK_NOT_READY: <NetworkNotReadyView />,
    JOIN_CHANNEL_SUCCESS: <JoinChannelSuccessView />,
    USER_WAS_MUTED: <UserWasMuted />,
    VIEW_MUTED_USERS: <ViewMutedUsers />,
    VIEW_PINNED_MESSAGES: <ViewPinnedMessages />
  }), [currentChannel]);

  return displayModal && modalView && modalView !== 'IMPORT_CODENAME' ? (
    <Modal className={s[modalClass]} onClose={closeModal}>
      {modals[modalView]}
    </Modal>
  ) : null;
};

const DefaultLayout: FC<WithChildren> = ({
  children,
}) => {
  const router = useRouter();
  const { isAuthenticated, storageTag } = useAuthentication();
  const { utilsLoaded } = useUtils();
  const {
    cmix,
    currentChannel,
    getShareUrlType,
    isNetworkHealthy,
    isReadyToRegister
  } = useNetworkClient();
  const { openModal, setChannelInviteLink, setModalView } = useUI();

  useEffect(() => {
    const privacyLevel = getShareUrlType(window.location.href);
    if (
      privacyLevel !== null &&
      cmix &&
      isNetworkHealthy &&
      isAuthenticated &&
      storageTag &&
      isReadyToRegister &&
      window.location.search &&
      [
        PrivacyLevel.Private,
        PrivacyLevel.Secret
      ].includes(privacyLevel)
    ) {
      setChannelInviteLink(window.location.href);
      setModalView('JOIN_CHANNEL');
      openModal();
      router.replace(window.location.pathname);
    }
  }, [
    cmix,
    isAuthenticated,
    isReadyToRegister,
    isNetworkHealthy,
    storageTag,
    getShareUrlType,
    setChannelInviteLink,
    setModalView,
    openModal,
    router
  ]);

  return (
    <>
      <NotificationBanner />
      <div className={cn(s.root)}>
      {utilsLoaded ? (
        cmix && isAuthenticated && storageTag && isReadyToRegister ? (
          <>
            <LeftSideBar cssClasses={s.leftSideBar} />
            <main className=''>{children}</main>
            <RightSideBar cssClasses={s.rightSideBar} />
            <AuthenticatedUserModals currentChannel={currentChannel} />
          </>
        ) : (
          <>
            <AuthenticationUI />
          </>
        )
      ) : (
        <Loading />
      )}
    </div>
    </>
    
  );
};

export default DefaultLayout;
