import { FC, useState, useEffect, useRef, useCallback } from 'react';
import cn from 'classnames';

import { Message } from 'src/types';
import { Close } from 'src/components/icons';
import { useNetworkClient } from 'src/contexts/network-client-context';
import { useUI } from 'src/contexts/ui-context';
import s from './UserTextArea.module.scss';
import SendButton from '../SendButton';

type Props = {
  setAutoScrollToEnd: (scrollToEnd: boolean) => void;
  replyToMessage: Message | null | undefined;
  setReplyToMessage: (msg: Message | null) => void;
};

const UserTextArea: FC<Props> = ({
  replyToMessage,
  setAutoScrollToEnd,
  setReplyToMessage
}) => {
  const [messageBody, setMessageBody] = useState<string>('');
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const { openModal, setModalView } = useUI();
  const {
    currentChannel,
    cmix: network,
    sendMessage,
    sendReply
  } = useNetworkClient();

  useEffect(() => {
    setMessageBody('');
  }, [currentChannel?.id]);

  const checkMessageLength = useCallback(() => {
    if (messageBody.trim().length > 700) {
      setModalView('MESSAGE_LONG');
      openModal();
      return false;
    } else {
      return true;
    }
  }, [messageBody, openModal, setModalView]);

  return (
    <div className={s.textArea}>
      {replyToMessage && (
        <div className={cn(s.replyContainer)}>
          <div className='flex flex-col flex-1'>
            <span>Reply to {replyToMessage.codeName}</span>
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
        ref={textAreaRef}
        name=''
        placeholder='Type your message here...'
        value={messageBody}
        onChange={e => {
          setMessageBody(e.target.value);
        }}
        onKeyDown={e => {
          if (e.keyCode === 13 && !e.shiftKey) {
            e.preventDefault();
            if (network && network.ReadyToSend && !network.ReadyToSend()) {
              setModalView('NETWORK_NOT_READY');
              openModal();
            } else {
              if (replyToMessage) {
                if (checkMessageLength()) {
                  sendReply(messageBody.trim(), replyToMessage.id);
                  setMessageBody('');
                }
              } else {
                if (checkMessageLength()) {
                  sendMessage(messageBody.trim());
                  setMessageBody('');
                }
              }
            }

            setAutoScrollToEnd(true);
            setReplyToMessage(null);
          }
        }}
      />

      <div className={s.buttonsWrapper}>
        <SendButton
          cssClass={s.button}
          onClick={async () => {
            if (network && network.ReadyToSend && !network.ReadyToSend()) {
              setModalView('NETWORK_NOT_READY');
              openModal();
            } else {
              if (replyToMessage) {
                if (checkMessageLength()) {
                  sendReply(messageBody.trim(), replyToMessage.id);
                  setMessageBody('');
                }
              } else {
                if (checkMessageLength()) {
                  sendMessage(messageBody.trim());
                  setMessageBody('');
                }
              }
            }

            setAutoScrollToEnd(true);
            setReplyToMessage(null);
          }}
        />
      </div>
    </div>
  );
};

export default UserTextArea;
