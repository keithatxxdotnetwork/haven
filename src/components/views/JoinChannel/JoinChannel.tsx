import type { ChannelJSON } from 'src/types';
import { FC, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import cn from 'classnames';
import s from './JoinChannel.module.css';

import { Button } from 'src/components/common';
import WarningComponent from 'src/components/common/WarningComponent';

import CheckboxToggle from 'src/components/common/CheckboxToggle';

type Props = {
  channelInfo: ChannelJSON;
  url: string;
  onConfirm: () => void;
  dmsEnabled: boolean;
  onDmsEnabledChange: (value: boolean) => void;
};

const JoinChannelView: FC<Props> = ({
  channelInfo,
  dmsEnabled,
  onConfirm,
  onDmsEnabledChange,
  url
}) => {
  const { t } = useTranslation();
  const [success, setSuccess] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const handleConfirmation = useCallback(() => {
    onConfirm();
    setSuccess(true);
  }, [onConfirm]);

  const handleCancelation = useCallback(() => {
    setCancelled(true);
  }, []);

  if (cancelled) {
    return (
      <WarningComponent>
        {t(`You cancelled joining a new Chat. You may close this tab
        and return to your home tab.`)}
      </WarningComponent>
    );
  }

  if (success) {
    return (
      <WarningComponent>
        {t('You have successfully joined!')}
        <br />
        {t('Return to your home tab to continue.')}
        <br />
        {t('You may close this tab.')}
      </WarningComponent>
    );
  }

  return (
    <div className={cn('w-full flex flex-col justify-center items-center', s.root)}>
      <h2 className='mt-9 mb-6'>{t('Join a Chat')}</h2>
      <div>
        <div className={cn('mb-4')}>
          <h4>{channelInfo?.name || ''}</h4>
          <p className={cn('mt-2 text text--xs')}>{channelInfo?.description || ''}</p>
        </div>
        <div className={cn('text text--sm mb-2')}>
          <span className='font-bold mr-1'>{t('Chat id')}:</span>
          <span>{channelInfo?.receptionId || ''}</span>
        </div>
        <div className={cn(s.channelCredentials)}>
          <span className='text--sm font-bold'>{t('Chat invite link')}:</span>
          {<span className={cn('text text--xs')}>{url}</span>}
        </div>
      </div>
      <div className='flex justify-between mt-8 w-full px-3'>
        <h3 className='headline--sm'>{t('Enable Direct Messages')}</h3>
        <CheckboxToggle checked={dmsEnabled} onChange={() => onDmsEnabledChange(!dmsEnabled)} />
      </div>
      <div className='flex justify-center'>
        <Button className={cn('mb-7 mt-16 mr-4', s.button)} onClick={handleConfirmation}>
          {t('Join')}
        </Button>
        <Button className={cn('mb-7 mt-16', s.button)} onClick={handleCancelation}>
          {t('Cancel')}
        </Button>
      </div>
    </div>
  );
};

export default JoinChannelView;
