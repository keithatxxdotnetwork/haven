import { FC, useCallback, useEffect, useState } from 'react';
import cn from 'classnames';
import { useTranslation, Trans } from 'react-i18next';

import { Button, Spinner } from 'src/components/common';

import s from './Login.module.scss';

import { NormalHaven, OpenSource, NormalHash } from 'src/components/icons';
import { useAuthentication } from '@contexts/authentication-context';
import useAccountSync, { AccountSyncService, AccountSyncStatus } from 'src/hooks/useAccountSync';
import { AppEvents, appBus as bus } from 'src/events';
import Input from '@components/common/Input';

const LoginView: FC = () => {
  const { t } = useTranslation();
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const { attemptingSyncedLogin, cancelSyncLogin, getOrInitPassword, setIsAuthenticated } =
    useAuthentication();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingInfo, setLoadingInfo] = useState('');

  const { service: accountSyncService, status: accountSyncStatus } = useAccountSync();

  useEffect(() => {
    const listener = () => {
      setError(t('Something went wrong, please check your credentials.'));
      setIsLoading(false);
      setLoadingInfo('');
    };

    bus.addListener(AppEvents.NEW_SYNC_CMIX_FAILED, listener);

    return () => {
      bus.removeListener(AppEvents.NEW_SYNC_CMIX_FAILED, listener);
    };
  }, [t]);

  const handleSubmit = useCallback(async () => {
    setError('');
    setIsLoading(true);
    setTimeout(async () => {
      try {
        const success = await getOrInitPassword(password);
        if (success) {
          setIsAuthenticated(true);
        } else {
          setError(t('Something went wrong, please check your credentials.'));
        }
        setIsLoading(false);
      } catch (e) {
        setError((e as Error).message);
        setIsLoading(false);
      }
    }, 1);
  }, [getOrInitPassword, password, setIsAuthenticated, t]);

  return (
    <div className={cn('px-12 md:px-[3.75rem]', s.root)}>
      <div className={cn('w-full flex flex-col', s.wrapper)}>
        <div className={'my-16 w-full md:mt-16 md:mb-[6.5rem]'}>
          <NormalHaven data-testid='haven-logo' />
        </div>
        <div className={cn('grid grid-cols-1 gap-0 md:grid-cols-12', s.content)}>
          <div className='col-span-9 flex flex-col items-start'>
            <Trans>
              <span className={cn(s.golden)}>True Freedom</span>
              <span className={cn(s.thick)}>to express yourself,</span>
              <span className={cn(s.golden)}>your thoughts, your beliefs.</span>
              <span className={cn(s.normal)}>
                Speak easily to a group of friends or a global community.{' '}
                <span className={cn(s.highlighted)}>Talk about what you want.</span>
              </span>
            </Trans>
            <Trans>
              <span className={cn(s.normal)}>
                Surveillance free. Censorship proof.
                <span className={cn(s.highlighted)}>Your Haven chats are yours.</span>
              </span>
            </Trans>
          </div>
          <div className='order-first mb-16 md:col-span-3 md:pl-3 md:order-none'>
            <h2 className='mb-2'>{t('Login')}</h2>
            <p className='mb-8 text' style={{ color: '#5B5D62', lineHeight: '17px' }}>
              {t('Use your password to unlock your Haven identity')}
            </p>
            <Input
              data-testid='password-input'
              type='password'
              placeholder={t('Enter your password')}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (accountSyncStatus !== AccountSyncStatus.Synced) {
                    e.preventDefault();
                    handleSubmit();
                  }

                  if (
                    accountSyncStatus === AccountSyncStatus.Synced &&
                    accountSyncService === AccountSyncService.Dropbox
                  ) {
                    const dropboxButton = document.getElementById('dropbox-button');
                    dropboxButton?.click();
                  }

                  if (
                    accountSyncStatus === AccountSyncStatus.Synced &&
                    accountSyncService === AccountSyncService.Google
                  ) {
                    const googleButton = document.getElementById('google-auth-button');
                    googleButton?.click();
                  }
                }
              }}
            />
            <div className='flex flex-col mt-4 space-y-3'>
              {accountSyncStatus !== AccountSyncStatus.Synced && (
                <Button data-testid='login-button' disabled={isLoading} onClick={handleSubmit}>
                  {t('Login')}
                </Button>
              )}
              {attemptingSyncedLogin && (
                <Button variant='secondary' onClick={cancelSyncLogin}>
                  Cancel
                </Button>
              )}
            </div>
            {isLoading && (
              <div className={s.loading}>
                {loadingInfo && <p className='mt-4'>{loadingInfo}</p>}
                <Spinner />
              </div>
            )}

            {error && (
              <div
                data-testid='login-error'
                style={{
                  color: 'var(--red)',
                  marginTop: '14px',
                  fontSize: '11px',

                  textAlign: 'center',
                  border: 'solid 1px #E3304B',
                  backgroundColor: 'rgba(227, 48, 75, 0.1)',
                  padding: '16px'
                }}
              >
                {error}
              </div>
            )}
          </div>
        </div>
        <div className={cn('grid grid-cols-12 gap-0', s.footer)}>
          <a
            href='https://git.xx.network/elixxir/speakeasy-web'
            target='_blank'
            rel='noreferrer'
            className={cn('flex flex-col col-span-6 md:col-span-4', s.perkCard)}
          >
            <OpenSource />
            <span className={cn(s.perkCard__title)}>{t('Open Source')}</span>
            <span className={cn(s.perkCard__description)}>
              {t('Every line — open source. Forever.')}
            </span>
          </a>
          <a
            href='https://learn.xx.network/'
            target='_blank'
            rel='noreferrer'
            className={cn('flex flex-col col-span-6 md:col-span-4', s.perkCard)}
          >
            <NormalHash />
            <span className={cn(s.perkCard__title)}>{t('Fundamentally Different')}</span>
            <span className={cn(s.perkCard__description)}>
              {t('Powered by the first decentralized mixnet-blockchain')}
            </span>
          </a>
        </div>
      </div>
      <div className={cn(s.links, 'flex-wrap gap-y-3 xs:flex-row')}>
        <a href='https://xx.network/' target='_blank' rel='noreferrer'>
          {t('xx network')}
        </a>
        <a href='https://xx.network/privacy-policy/' target='_blank' rel='noreferrer'>
          {t('Privacy Policy')}
        </a>

        <a href='https://xx.network/terms-of-use/' target='_blank' rel='noreferrer'>
          {t('Terms of Use')}
        </a>

        <a href='https://xxfoundation.org/' target='_blank' rel='noreferrer'>
          {t('xx foundation')}
        </a>
        <a href='https://x.com/xx_network' target='_blank' rel='noreferrer'>
          Twitter
        </a>
      </div>
    </div>
  );
};

export default LoginView;
