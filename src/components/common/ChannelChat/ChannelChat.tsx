import { Message } from 'src/types';

import { FC, useState, useEffect, useMemo, CSSProperties } from 'react';

import UserTextArea from './UserTextArea/UserTextArea';
import { useNetworkClient } from 'src/contexts/network-client-context';

import MessagesContainer from './MessagesContainer';
import * as channels from 'src/store/channels';
import * as dms from 'src/store/dms';
import { useAppSelector } from 'src/store/hooks';
import ScrollDiv from './ScrollDiv';
import { useTranslation } from 'react-i18next';
import { EasterEggs, useUI } from '@contexts/ui-context';
import Spaceman from '@components/icons/Spaceman';

type Props = {
  messages: Message[];
  isPinnedMessages?: boolean;
};

const ChannelChat: FC<Props> = ({ messages }) => {
  const { t } = useTranslation();
  const { pagination } = useNetworkClient();
  const { reset } = pagination;
  const { easterEggs, leftSidebarView: sidebarView, triggerEasterEgg } = useUI();
  const currentChannel = useAppSelector(channels.selectors.currentChannel);
  const currentConversation = useAppSelector(dms.selectors.currentConversation);
  const paginatedItems = useMemo(() => pagination.paginate(messages), [messages, pagination]);

  useEffect(() => {
    pagination.setCount(messages.length);
  }, [messages.length, pagination]);

  const [autoScroll, setAutoScroll] = useState(true);
  useEffect(() => {
    reset();
    setAutoScroll(true);
  }, [currentChannel?.id, reset]);

  const spacemanStyles = useMemo(
    () =>
      easterEggs.includes(EasterEggs.Spaceman)
        ? ({
            '--near-black': '#FF10F0',
            '--charcoal-4': '#00CCCC'
          } as CSSProperties)
        : {},
    [easterEggs]
  );

  return (
    <>
      {((currentChannel && sidebarView === 'spaces') ||
        (currentConversation && sidebarView === 'dms')) && (
        <>
          {messages.length === 0 ? (
            <div className='flex flex-col justify-center items-center flex-grow relative'>
              <div
                onClick={() => triggerEasterEgg(EasterEggs.Spaceman)}
                className='w-3.5 h-3.5 cursor-pointer absolute z-10 top-[52%] left-[51%]'
              />
              <Spaceman className='w-full absolute -mt-10' style={spacemanStyles} />
              <p className='text-charcoal-2 font-bold absolute top-[72%]'>
                {t("It's pretty quiet in this space...")}
              </p>
            </div>
          ) : (
            <ScrollDiv
              canSetAutoScroll={pagination.page === 1}
              autoScrollBottom={autoScroll}
              setAutoScrollBottom={setAutoScroll}
              nearBottom={pagination.previous}
              nearTop={pagination.next}
              className='flex grow shrink basis-auto flex-col-reverse overflow-auto'
            >
              <MessagesContainer messages={paginatedItems} />
            </ScrollDiv>
          )}
          <UserTextArea className='relative grow-0 shrink-0 basis-10' />
        </>
      )}
    </>
  );
};

export default ChannelChat;
