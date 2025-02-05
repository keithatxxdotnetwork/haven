import { Message, MessageStatus, MuteUserAction } from 'src/types';
import { FC, useEffect } from 'react';

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import MessageActions from '../MessageActions';
import ChatMessage from '../ChatMessage/ChatMessage';
import { useNetworkClient } from 'src/contexts/network-client-context';
import useToggle from 'src/hooks/useToggle';
import PinMessageModal from 'src/components/modals/PinMessageModal';
import MuteUserModal from 'src/components/modals/MuteUser';
import DeleteMessageModal from 'src/components/modals/DeleteMessage';
import * as channels from 'src/store/channels';
import * as app from 'src/store/app';
import { useAppDispatch, useAppSelector } from 'src/store/hooks';
import * as identity from 'src/store/identity';
import { AppEvents, awaitAppEvent } from 'src/events';

import useAsync from 'src/hooks/useAsync';
import { useUI } from '@contexts/ui-context';
import useDmClient from 'src/hooks/useDmClient';
import assert from 'assert';

type Props = {
  message: Message;
  clamped?: boolean;
  className?: string;
  readonly?: boolean;
};

const MessageContainer: FC<Props> = ({ clamped = false, className, message, readonly }) => {
  const { t } = useTranslation();

  const dispatch = useAppDispatch();
  const { createConversation } = useDmClient();
  const [isNewMessage, setIsNewMessage] = useState(false);
  const missedMessages = useAppSelector(app.selectors.missedMessages);
  const mutedUsers = useAppSelector(channels.selectors.mutedUsers);
  const { pubkey } = useAppSelector(identity.selectors.identity) ?? {};
  const currentChannel = useAppSelector(channels.selectors.currentChannel);
  const [showActionsWrapper, setShowActionsWrapper] = useState(false);
  const { deleteMessage, muteUser, pinMessage, sendReaction } = useNetworkClient();
  const { setLeftSidebarView } = useUI();

  const [muteUserModalOpen, muteUserModalToggle] = useToggle();
  const [
    deleteMessageModalOpened,
    { toggleOff: hideDeleteMessageModal, toggleOn: showDeleteMessageModal }
  ] = useToggle();
  const [pinMessageModalOpen, { toggleOff: hidePinModal, toggleOn: showPinModal }] = useToggle();

  const onReplyMessage = useCallback(() => {
    dispatch(app.actions.replyTo(message.id));
  }, [dispatch, message.id]);

  const handleDeleteMessage = useCallback(async () => {
    await deleteMessage(message);
    hideDeleteMessageModal();
  }, [deleteMessage, hideDeleteMessageModal, message]);

  const handleMuteUser = useCallback(
    async (action: MuteUserAction) => {
      const promises: Promise<unknown>[] = [];

      if (action === 'mute+delete') {
        promises.push(handleDeleteMessage());
      }

      promises.push(muteUser(message.pubkey, false));

      await Promise.all(promises);

      muteUserModalToggle.toggleOff();
    },
    [handleDeleteMessage, message.pubkey, muteUser, muteUserModalToggle]
  );

  const handlePinMessage = useCallback(
    async (unpin?: boolean) => {
      if (unpin === true) {
        await Promise.all([
          pinMessage(message.id, unpin),
          awaitAppEvent(AppEvents.MESSAGE_UNPINNED) // delay to let the nodes propagate
        ]);
      } else {
        showPinModal();
      }
    },
    [message, pinMessage, showPinModal]
  );

  const pinSelectedMessage = useCallback(async () => {
    await Promise.all([
      pinMessage(message.id),
      awaitAppEvent(AppEvents.MESSAGE_PINNED) // delay to let the nodes propagate
    ]);
    hidePinModal();
  }, [hidePinModal, message, pinMessage]);

  const handleEmojiReaction = useCallback(
    (emoji: string) => {
      sendReaction(emoji, message.id);
    },
    [message.id, sendReaction]
  );

  useEffect(() => {
    if (missedMessages?.[message.channelId]?.[0] === message.id) {
      setIsNewMessage(true);
      dispatch(app.actions.dismissNewMessages(message.channelId));
    }
  }, [dispatch, message.channelId, message.id, missedMessages]);

  const handleMute = useCallback(
    async (unmute: boolean) => {
      if (!unmute) {
        muteUserModalToggle.toggleOn();
      } else {
        await muteUser(message.pubkey, unmute);
      }
    },
    [message.pubkey, muteUser, muteUserModalToggle]
  );

  const asyncMuter = useAsync(handleMute);

  const dmUser = useCallback(() => {
    if (!message.dmToken) {
      throw new Error('dmToken is required to dm a user');
    }
    setLeftSidebarView('dms');
    dispatch(app.actions.selectUser(message.pubkey));
    createConversation({
      pubkey: message.pubkey,
      token: message.dmToken,
      color: message.color ?? '#fefefe',
      codename: message.codename,
      codeset: message.codeset
    });
  }, [
    createConversation,
    dispatch,
    message.codename,
    message.codeset,
    message.color,
    message.dmToken,
    message.pubkey,
    setLeftSidebarView
  ]);

  return (
    <>
      {isNewMessage && (
        <div className="relative flex items-center px-4">
          <div className="flex-grow border-t border-primary"></div>
          <span className="flex-shrink mx-4 text-primary">
            {t('New!')}
          </span>
        </div>
      )}
      {!readonly && (
        <>
          {muteUserModalOpen && (
            <MuteUserModal onConfirm={handleMuteUser} onCancel={muteUserModalToggle.toggleOff} />
          )}
          {deleteMessageModalOpened && (
            <DeleteMessageModal onConfirm={handleDeleteMessage} onCancel={hideDeleteMessageModal} />
          )}
          {pinMessageModalOpen && (
            <PinMessageModal onConfirm={pinSelectedMessage} onCancel={hidePinModal} />
          )}
          {message.status === MessageStatus.Delivered && (
            <div className="relative">
              <MessageActions
                pubkey={message.pubkey}
                onMouseEnter={() => setShowActionsWrapper(true)}
                onMouseLeave={() => setShowActionsWrapper(false)}
                className={`
                  absolute right-4 -top-12 opacity-0 transition-opacity duration-200
                  ${showActionsWrapper ? 'opacity-100' : ''}
                `}
                onDmClicked={dmUser}
                dmsEnabled={message.dmToken !== undefined}
                isPinned={message.pinned}
                isMuted={mutedUsers[message.channelId]?.includes(message.pubkey)}
                onMuteUser={asyncMuter.execute}
                onPinMessage={handlePinMessage}
                onReactToMessage={handleEmojiReaction}
                onReplyClicked={onReplyMessage}
                isAdmin={currentChannel?.isAdmin ?? false}
                isOwn={pubkey === message.pubkey}
                onDeleteMessage={showDeleteMessageModal}
              />
            </div>
          )}
        </>
      )}
      <ChatMessage
        className={className}
        clamped={clamped}
        onMouseEnter={() => setShowActionsWrapper(true)}
        onMouseLeave={() => setShowActionsWrapper(false)}
        onTouchEnd={() => setShowActionsWrapper(true)}
        message={message}
      />
    </>
  );
};

export default MessageContainer;
