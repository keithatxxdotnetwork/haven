import React, { FC, useEffect, useRef, useCallback, useMemo } from 'react';
import cn from 'classnames';

import { Message } from 'src/types';
import { Close } from 'src/components/icons';
import { useNetworkClient } from 'src/contexts/network-client-context';
import { useUI } from 'src/contexts/ui-context';
import s from './UserTextArea.module.scss';
import SendButton from '../SendButton';

type Props = {
  scrollToEnd: () => void;
  replyToMessage: Message | null | undefined;
  setReplyToMessage: (msg: Message | null) => void;
  messageBody: string;
  setMessageBody: React.Dispatch<React.SetStateAction<string>>
};

const MESSAGE_MAX_SIZE = 700;

const UserTextArea: FC<Props> = ({
  messageBody,
  replyToMessage,
  setMessageBody,
  setReplyToMessage,
}) => {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const { openModal, setModalView } = useUI();
  const {
    cmix,
    currentChannel,
    isMuted,
    sendMessage,
    sendReply
  } = useNetworkClient();

  const messageIsValid = useMemo(() => messageBody.trim().length <= MESSAGE_MAX_SIZE, [messageBody])
  const placeholder = useMemo(
    () => isMuted
      ? 'You can\'t send messages to this channel because you are muted by an admin of this channel.'
      : 'Type your message here...',
    [isMuted]
  );

  useEffect(() => {
    if (currentChannel?.id) {
      setMessageBody('');
    }
  }, [currentChannel?.id, setMessageBody]);

  const sendCurrentMessage = useCallback(() => {
    if (cmix && cmix.ReadyToSend && !cmix.ReadyToSend()) {
      setModalView('NETWORK_NOT_READY');
      openModal();
    } else {
      if (isMuted) {
        setModalView('USER_WAS_MUTED');
        openModal();
        return;
      }

      if (replyToMessage) {
        if (messageIsValid) {
          sendReply(messageBody.trim(), replyToMessage.id);
          setMessageBody('');
        }
      } else {
        if (messageIsValid) {
          sendMessage(messageBody.trim());
          setMessageBody('');
        }
      }
    }

    setReplyToMessage(null);
  }, [
    cmix,
    isMuted,
    messageBody,
    messageIsValid,
    openModal,
    replyToMessage,
    sendMessage,
    sendReply,
    setMessageBody,
    setModalView,
    setReplyToMessage
  ]);

  return (
    <div className={cn('relative', s.textArea)}>
      {replyToMessage && (
        <div className={cn(s.replyContainer)}>
          <div className='flex flex-col flex-1'>
            <span>Reply to {replyToMessage.codename}</span>
            <p>{replyToMessage.body}</p>
          </div>
          <Close
            width={14}
            height={14}
            fill={'var(--orange)'}
            onClick={() => {
              setReplyToMessage(null);
            }}
          />
        </div>
      )}

      <textarea
        className={cn({ [s.muted]: isMuted })}
        ref={textAreaRef}
        name=''
        placeholder={placeholder}
        value={messageBody}
        onChange={e => {
          setMessageBody(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.keyCode === 13 && !e.shiftKey) {
            sendCurrentMessage();
          }
        }}
      />

      <span style={{
        fontSize: 12,
        color: messageIsValid || isMuted ? 'var(--dark-9)' : 'var(--red)'}} className='absolute left-0 bottom-0 p-2'>
          {messageBody.trim().length ?? 0}/700
      </span>

      <div className={s.buttonsWrapper}>
        <SendButton
          disabled={!messageIsValid || isMuted}
          className={s.button}
          onClick={sendCurrentMessage}
        />
      </div>
    </div>
  );
};

export default UserTextArea;
