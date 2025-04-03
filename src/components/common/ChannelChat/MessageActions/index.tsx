import React, { FC, useCallback, useEffect, useState, HTMLAttributes } from 'react';
import { Delete, Reply } from 'src/components/icons';
import { Mute, Pin } from 'src/components/icons';
import { useUI } from 'src/contexts/ui-context';
import { useAppSelector } from 'src/store/hooks';
import Envelope from 'src/components/icons/Envelope';
import { userIsMuted as userIsMutedSelector } from 'src/store/selectors';
import * as dms from 'src/store/dms';
import { AppEvents, awaitAppEvent as awaitEvent } from 'src/events';
import { WithChildren } from 'src/types';
import useDmClient from 'src/hooks/useDmClient';
import { EmojiPicker } from 'src/components/common/EmojiPortal';
import Block from 'src/components/icons/Block';

type Props = HTMLAttributes<HTMLDivElement> & {
  isMuted: boolean;
  isAdmin: boolean;
  isOwn: boolean;
  isPinned: boolean;
  dmsEnabled: boolean;
  pubkey: string;
  onDmClicked: () => void;
  onReplyClicked: () => void;
  onReactToMessage: (emoji: string) => void;
  onDeleteMessage: () => void;
  onMuteUser: (unmute: boolean) => void;
  onPinMessage: (unpin?: boolean) => Promise<void>;
};

const MessageAction: FC<WithChildren & HTMLAttributes<HTMLButtonElement>> = ({
  children,
  ...props
}) => {
  return (
    <button
      {...props}
      className={`text-charcoal-1 hover:text-primary w-5 ${props.className || ''}`}
    >
      {children}
    </button>
  );
};

const MessageActions: FC<Props> = ({
  dmsEnabled,
  isAdmin,
  isMuted,
  isOwn,
  isPinned,
  onDeleteMessage,
  onDmClicked,
  onMuteUser,
  onPinMessage,
  onReactToMessage,
  onReplyClicked,
  pubkey,
  ...props
}) => {
  const { toggleBlocked } = useDmClient();
  const isDms = !!useAppSelector(dms.selectors.currentConversation);
  const userIsMuted = useAppSelector(userIsMutedSelector);
  const { closeModal, openModal, setModalView } = useUI();
  const isBlocked = useAppSelector(dms.selectors.isBlocked(pubkey));

  const [loading, setLoading] = useState(false);
  const onUnpin = useCallback(async () => {
    setLoading(true);
    try {
      await onPinMessage(true);
    } catch (e) {
      setLoading(false);
      throw e;
    }
    setLoading(false);
  }, [onPinMessage]);

  useEffect(() => {
    if (loading) {
      setModalView('LOADING');
      openModal();
      awaitEvent(AppEvents.MESSAGE_UNPINNED).then(() => {
        closeModal();
      });
    }
  }, [closeModal, loading, openModal, setModalView]);

  return (
    <div
      {...props}
      className={`${props.className || ''} bg-near-black-80 p-3 backdrop-blur-md space-x-4 rounded-lg z-10`}
    >
      <>
        {dmsEnabled && (
          <MessageAction onClick={onDmClicked}>
            <Envelope />
          </MessageAction>
        )}
        {isAdmin && !isOwn && (
          <MessageAction onClick={() => onMuteUser(isMuted)}>
            <Mute className={isMuted ? 'text-primary' : ''} />
          </MessageAction>
        )}
        {isBlocked && !isOwn && (
          <MessageAction onClick={() => toggleBlocked(pubkey)}>
            <Block className='text-primary' />
          </MessageAction>
        )}
        {!isBlocked && !isOwn && (
          <MessageAction onClick={() => toggleBlocked(pubkey)}>
            <Block />
          </MessageAction>
        )}
        {isAdmin && !isPinned && !isDms && (
          <MessageAction onClick={() => onPinMessage()}>
            <Pin />
          </MessageAction>
        )}
        {isAdmin && isPinned && (
          <MessageAction onClick={onUnpin}>
            <Pin className='text-primary' />
          </MessageAction>
        )}
        {(isOwn || isAdmin) && !isPinned && !userIsMuted && (
          <MessageAction onClick={onDeleteMessage}>
            <Delete />
          </MessageAction>
        )}
        <MessageAction>
          <EmojiPicker onSelect={onReactToMessage} />
        </MessageAction>
        <MessageAction onClick={onReplyClicked}>
          <Reply />
        </MessageAction>
      </>
    </div>
  );
};

export default React.memo(MessageActions);
