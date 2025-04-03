import { FC, useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Spinner } from '@components/common';
import { useUI } from '@contexts/ui-context';
import useAccountSync, { AccountSyncStatus } from 'src/hooks/useAccountSync';

import ModalTitle from '../ModalTitle';

const AccountSyncView: FC = () => {
  const { t } = useTranslation();
  const { closeModal } = useUI();
  const { setStatus } = useAccountSync();
  const [loading] = useState(false);

  const ignoreSync = useCallback(() => {
    setStatus(AccountSyncStatus.Ignore);
    closeModal();
  }, [closeModal, setStatus]);

  useEffect(() => {
    ignoreSync();
  }, [ignoreSync]);

  return (
    <>
      <ModalTitle>{t('Account Sync')}</ModalTitle>
      <p className='text-sm font-medium mb-4'>
        Sync your account with multiple devices using the cloud with account sync. The file is
        encrypted so there are no privacy concerns with using these third party services.
      </p>
      <p className='text-orange font-bold mb-4'>
        <strong>Warning!</strong> Once you choose a cloud provider you will not be able to change to
        another service or revert to local-only.
      </p>
      {loading ? (
        <Spinner size='md' />
      ) : (
        <div data-testid='account-sync-buttons' className='grid grid-cols-2 gap-4 pt-4'>
          <div className='col-span-2 text-center'>
            <Button data-testid='account-sync-local-only-button' onClick={ignoreSync}>
              {t('Local-only')}
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default AccountSyncView;
